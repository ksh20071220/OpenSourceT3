-- supabase/schema.sql — 로그인(선택 기능)용 DB 표와 접근 규칙
-- [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
--
-- 사용법: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여 넣고 Run
--         여러 번 실행해도 안전하다 (이미 있는 표·함수는 그대로 두거나 새 내용으로 바꿈).
--         이 파일이 바뀌면 다시 한 번 실행한다.
--
-- 원칙
--   * 각 행의 주인은 user_id (로그인한 사람의 id가 자동으로 들어감)
--   * RLS(Row Level Security): 로그인한 사람은 "자기 행"만 읽고·쓰고·지울 수 있다
--   * API 키 원문은 이 DB에 저장하지 않는다. 사용자가 정한 "API 키 비밀번호"로 브라우저에서 잠근(암호화한)
--     형태만 user_keys 표에 저장하고, 그 표는 아래 함수로만 읽고 쓸 수 있다 (src/storage/keyVault.js)
--   * data 열에 앱의 기록(JSON)을 통째로 넣는다 → 앱 쪽 형식이 바뀌어도 표를 바꿀 필요가 적다

-- 캐릭터
create table if not exists public.personas (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 대화 기록 (캐릭터 하나당 한 행)
create table if not exists public.conversations (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  persona_id text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, persona_id)
);

alter table public.personas enable row level security;
alter table public.conversations enable row level security;

-- 자기 행만 (select / insert / update / delete 모두)
drop policy if exists "own personas" on public.personas;
create policy "own personas" on public.personas
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 로그인하지 않은 사용자(anon)는 아무것도 못 하게 권한 자체를 뺀다 (RLS와 이중 잠금)
revoke all on public.personas from anon;
revoke all on public.conversations from anon;
grant select, insert, update, delete on public.personas to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- API 키 계정 저장 (선택 기능) — src/storage/keyVault.js 가 아래 함수만 부른다
--
-- 브라우저가 하는 일: 비밀번호 + salt 로 PBKDF2 → 앞 32바이트 = 암호화 열쇠, 뒤 32바이트 = 확인용 값(auth)
--   * 암호화 열쇠로 API 키를 AES-GCM 으로 잠가 ciphertext 로 보낸다 (열쇠 자체는 보내지 않음)
--   * 확인용 값(auth)만 보내고, DB는 그것을 bcrypt 로 한 번 더 감싸 auth_hash 로 저장한다
-- 그래서 DB에는 API 키 원문도, 비밀번호도 없다.
--
-- 틀린 비밀번호 제한: 5번 틀리면 30초 잠금. 이 횟수는 브라우저가 아니라 DB가 센다.
-- 표를 직접 읽을 수 있으면 잠긴 값을 가져가 횟수 제한 없이 맞혀 볼 수 있으므로,
-- 표에는 아무 권한도 주지 않고 아래 함수(security definer)로만 접근하게 한다.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.user_keys (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  provider        text not null,              -- AI 회사 (비밀 아님: 불러오기 전 화면에 보여 줌)
  model_light     text not null default '',   -- 저비용 모델 이름 (비밀 아님)
  model_heavy     text not null default '',   -- 고성능 모델 이름 (비밀 아님)
  ciphertext      text not null,              -- 잠긴 API 키 (base64)
  iv              text not null,              -- AES-GCM iv (base64)
  salt            text not null,              -- PBKDF2 salt (base64)
  iterations      integer not null,           -- PBKDF2 반복 횟수
  auth_hash       text not null,              -- 확인용 값의 bcrypt
  failed_attempts integer not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.user_keys enable row level security;
-- 정책(policy)을 하나도 만들지 않아서 함수 밖에서는 아무도 읽고 쓸 수 없다 (이중 잠금)
revoke all on public.user_keys from anon, authenticated;

-- 저장 / 덮어쓰기. 덮어쓰면 틀린 횟수도 초기화한다.
create or replace function public.save_user_key(
  p_provider text, p_model_light text, p_model_heavy text,
  p_ciphertext text, p_iv text, p_salt text, p_iterations integer, p_auth text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;
  -- 빈 값, 약한 반복 횟수(AGENTS.md: 60만 번 미만 금지), 터무니없이 큰 값은 거절
  if coalesce(p_ciphertext, '') = '' or coalesce(p_iv, '') = '' or coalesce(p_salt, '') = ''
     or coalesce(p_auth, '') = '' or coalesce(p_provider, '') = ''
     or p_iterations is null or p_iterations < 600000 or p_iterations > 5000000
     or length(p_ciphertext) > 4096 or length(p_iv) > 64 or length(p_salt) > 64 or length(p_auth) > 256
     or length(p_provider) > 64 or length(coalesce(p_model_light, '')) > 200 or length(coalesce(p_model_heavy, '')) > 200 then
    raise exception 'invalid arguments';
  end if;
  insert into public.user_keys as k
    (user_id, provider, model_light, model_heavy, ciphertext, iv, salt, iterations, auth_hash,
     failed_attempts, locked_until, updated_at)
  values
    (auth.uid(), p_provider, coalesce(p_model_light, ''), coalesce(p_model_heavy, ''), p_ciphertext, p_iv, p_salt,
     p_iterations, extensions.crypt(p_auth, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (user_id) do update set
    provider = excluded.provider, model_light = excluded.model_light, model_heavy = excluded.model_heavy,
    ciphertext = excluded.ciphertext, iv = excluded.iv, salt = excluded.salt, iterations = excluded.iterations,
    auth_hash = excluded.auth_hash, failed_attempts = 0, locked_until = null, updated_at = now();
end;
$$;

-- 불러오기 전 정보: 저장돼 있는지, 회사·모델 이름, 열쇠를 만들 salt·반복 횟수, 잠금 상태 (잠긴 값은 주지 않음)
create or replace function public.get_user_key_info()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'provider', provider, 'model_light', model_light, 'model_heavy', model_heavy,
    'salt', salt, 'iterations', iterations, 'updated_at', updated_at,
    'locked_seconds', greatest(0, ceil(extract(epoch from (locked_until - now()))))::int
  )
  from public.user_keys where user_id = auth.uid();
$$;

-- 비밀번호 확인 후 잠긴 값 돌려주기.
-- 오류를 raise 하면 틀린 횟수 기록까지 취소되므로, 결과를 jsonb 로 돌려준다:
--   { ok: true, ciphertext, iv, provider, model_light, model_heavy }
--     (회사·모델 이름도 같이 줘서, 그사이 다른 기기에서 다시 저장해도 키와 이름이 섞이지 않게)
--   { ok: false, reason: 'wrong', remaining: 남은 기회 }
--   { ok: false, reason: 'locked', retry_after: 남은 초 }
--   { ok: false, reason: 'not_found' }
create or replace function public.unlock_user_key(p_auth text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k public.user_keys%rowtype;
  max_attempts constant integer := 5;
  lock_seconds constant integer := 30;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;
  select * into k from public.user_keys where user_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if k.locked_until is not null and k.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked',
      'retry_after', ceil(extract(epoch from (k.locked_until - now())))::int);
  end if;
  if k.auth_hash = extensions.crypt(coalesce(p_auth, ''), k.auth_hash) then
    update public.user_keys set failed_attempts = 0, locked_until = null where user_id = auth.uid();
    return jsonb_build_object('ok', true, 'ciphertext', k.ciphertext, 'iv', k.iv,
      'provider', k.provider, 'model_light', k.model_light, 'model_heavy', k.model_heavy);
  end if;
  if k.failed_attempts + 1 >= max_attempts then
    update public.user_keys set failed_attempts = 0, locked_until = now() + make_interval(secs => lock_seconds)
      where user_id = auth.uid();
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_after', lock_seconds);
  end if;
  update public.user_keys set failed_attempts = k.failed_attempts + 1, locked_until = null where user_id = auth.uid();
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'remaining', max_attempts - (k.failed_attempts + 1));
end;
$$;

-- 계정에서 키 지우기 (비밀번호를 잊었을 때, 계정 데이터 전부 삭제할 때)
create or replace function public.delete_user_key()
returns void
language sql security definer set search_path = '' as $$
  delete from public.user_keys where user_id = auth.uid();
$$;

-- 로그인한 사람만 함수를 부를 수 있다
revoke all on function public.save_user_key(text, text, text, text, text, text, integer, text) from public, anon;
revoke all on function public.get_user_key_info() from public, anon;
revoke all on function public.unlock_user_key(text) from public, anon;
revoke all on function public.delete_user_key() from public, anon;
grant execute on function public.save_user_key(text, text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.get_user_key_info() to authenticated;
grant execute on function public.unlock_user_key(text) to authenticated;
grant execute on function public.delete_user_key() to authenticated;
