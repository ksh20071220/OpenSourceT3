-- supabase/schema.sql — 로그인(선택 기능)용 DB 표와 접근 규칙
-- [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
--
-- 사용법: Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여 넣고 Run (한 번만)
--
-- 원칙
--   * 각 행의 주인은 user_id (로그인한 사람의 id가 자동으로 들어감)
--   * RLS(Row Level Security): 로그인한 사람은 "자기 행"만 읽고·쓰고·지울 수 있다
--   * API 키는 이 DB에 저장하지 않는다 (앱 코드에도 그런 경로가 없음)
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
