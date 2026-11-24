// [오승민] API 키 계정 저장 테스트
// 실제 Supabase 대신, supabase/schema.sql 의 함수와 같은 규칙(5번 틀리면 30초 잠금)으로 동작하는 가짜 서버를 쓴다.
// (bcrypt 대신 문자열 비교 — 여기서는 브라우저 쪽 암호화·흐름을 확인하는 게 목적)
import { describe, it, expect, beforeEach, vi } from 'vitest'

const server = vi.hoisted(() => ({ rows: new Map(), now: 0, calls: [] }))

vi.mock('../common/auth.js', async () => {
  const { getActiveUser } = await import('./storage.js')
  const ok = (data) => ({ data, error: null })
  return {
    isCloudEnabled: () => true,
    supabase: {
      async rpc(name, args) {
        server.calls.push({ name, args })
        const uid = getActiveUser()
        if (!uid) return { data: null, error: { message: 'login required' } }
        const row = server.rows.get(uid)
        const lockedLeft = () => Math.max(0, Math.ceil(((row?.locked_until ?? 0) - server.now) / 1000))
        switch (name) {
          case 'save_user_key':
            if (args.p_iterations < 1000) return { data: null, error: { message: 'invalid arguments' } }
            server.rows.set(uid, { ...args, failed: 0, locked_until: null, updated_at: new Date(server.now).toISOString() })
            return ok(null)
          case 'get_user_key_info':
            if (!row) return ok(null)
            return ok({
              provider: row.p_provider,
              model_light: row.p_model_light,
              model_heavy: row.p_model_heavy,
              salt: row.p_salt,
              iterations: row.p_iterations,
              updated_at: row.updated_at,
              locked_seconds: lockedLeft(),
            })
          case 'unlock_user_key':
            if (!row) return ok({ ok: false, reason: 'not_found' })
            if (lockedLeft() > 0) return ok({ ok: false, reason: 'locked', retry_after: lockedLeft() })
            if (args.p_auth === row.p_auth) {
              row.failed = 0
              row.locked_until = null
              return ok({ ok: true, ciphertext: row.p_ciphertext, iv: row.p_iv, provider: row.p_provider, model_light: row.p_model_light, model_heavy: row.p_model_heavy })
            }
            if (row.failed + 1 >= 5) {
              row.failed = 0
              row.locked_until = server.now + 30_000
              return ok({ ok: false, reason: 'locked', retry_after: 30 })
            }
            row.failed += 1
            return ok({ ok: false, reason: 'wrong', remaining: 5 - row.failed })
          case 'delete_user_key':
            server.rows.delete(uid)
            return ok(null)
          default:
            return { data: null, error: { message: `unknown rpc ${name}` } }
        }
      },
    },
  }
})

const { setActiveUser } = await import('./storage.js')
const {
  saveKeyToAccount,
  unlockKeyFromAccount,
  getAccountKeyInfo,
  changeKeyPassword,
  deleteKeyFromAccount,
  keyVaultOptions,
  MIN_PASSWORD_LENGTH,
} = await import('./keyVault.js')

const KEY = 'AIzaSy-THIS-IS-A-FAKE-KEY-1234567890'
const PW = 'correct horse 1'
const CFG = { provider: 'gemini', apiKey: KEY, modelLight: 'gemini-3.5-flash-lite', modelHeavy: 'gemini-3.8-flash' }

beforeEach(() => {
  server.rows.clear()
  server.calls.length = 0
  server.now = 0
  keyVaultOptions.iterations = 2000 // 테스트 속도를 위해서만 줄임 (앱 기본값은 아래에서 확인)
  keyVaultOptions.minIterations = 1000
  setActiveUser('user-1')
})

describe('저장', () => {
  it('앱 기본 반복 횟수는 60만 번, 최소 길이 8자', async () => {
    const mod = await import('./keyVault.js?fresh')
    expect(mod.keyVaultOptions.iterations).toBe(600_000)
    expect(mod.keyVaultOptions.minIterations).toBe(600_000)
    expect(MIN_PASSWORD_LENGTH).toBe(8)
  })

  it('서버로 원문 키·비밀번호가 가지 않는다', async () => {
    await saveKeyToAccount(CFG, PW)
    const sent = JSON.stringify(server.calls)
    expect(sent).not.toContain(KEY)
    expect(sent).not.toContain(PW)
    const row = server.rows.get('user-1')
    expect(row.p_provider).toBe('gemini')
    expect(row.p_auth).toMatch(/^[0-9a-f]{64}$/)
  })

  it('회사·모델 이름은 불러오기 전에도 보인다 (키는 안 보임)', async () => {
    await saveKeyToAccount(CFG, PW)
    const info = await getAccountKeyInfo()
    expect(info).toMatchObject({ provider: 'gemini', modelLight: 'gemini-3.5-flash-lite', modelHeavy: 'gemini-3.8-flash', lockedSeconds: 0 })
    expect(JSON.stringify(info)).not.toContain(KEY)
  })

  it('짧은 비밀번호, 빈 키, 테스트 모드는 저장하지 않는다', async () => {
    await expect(saveKeyToAccount(CFG, '1234567')).rejects.toMatchObject({ code: 'INVALID_ARG' })
    await expect(saveKeyToAccount(CFG, '        ')).rejects.toMatchObject({ code: 'INVALID_ARG' })
    await expect(saveKeyToAccount({ ...CFG, apiKey: '' }, PW)).rejects.toMatchObject({ code: 'INVALID_ARG' })
    await expect(saveKeyToAccount({ provider: 'test', apiKey: 'x' }, PW)).rejects.toMatchObject({ code: 'INVALID_ARG' })
    expect(server.rows.size).toBe(0)
  })

  it('로그인 안 했으면 정보는 null, 저장은 거절', async () => {
    setActiveUser(null)
    expect(await getAccountKeyInfo()).toBeNull()
    await expect(saveKeyToAccount(CFG, PW)).rejects.toMatchObject({ code: 'STORAGE' })
  })
})

describe('불러오기', () => {
  it('맞는 비밀번호면 회사·키·모델을 한 번에', async () => {
    await saveKeyToAccount(CFG, PW)
    expect(await unlockKeyFromAccount(PW)).toEqual(CFG)
  })

  it('틀리면 남은 기회, 5번째에 30초 잠금, 잠긴 동안은 맞아도 거절', async () => {
    await saveKeyToAccount(CFG, PW)
    for (const remaining of [4, 3, 2, 1]) {
      await expect(unlockKeyFromAccount('wrong-password')).rejects.toMatchObject({ code: 'WRONG_PASSWORD', details: { remaining } })
    }
    await expect(unlockKeyFromAccount('wrong-password')).rejects.toMatchObject({ code: 'LOCKED', details: { retryAfter: 30 } })
    server.now = 10_000
    await expect(unlockKeyFromAccount(PW)).rejects.toMatchObject({ code: 'LOCKED', details: { retryAfter: 20 } })
    server.now = 31_000
    expect((await unlockKeyFromAccount(PW)).apiKey).toBe(KEY)
  })

  it('저장된 게 없으면 NOT_FOUND', async () => {
    await expect(unlockKeyFromAccount(PW)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('다른 계정으로 옮긴 잠긴 값은 비밀번호가 맞아도 안 풀린다', async () => {
    await saveKeyToAccount(CFG, PW)
    server.rows.set('user-2', { ...server.rows.get('user-1') })
    setActiveUser('user-2')
    await expect(unlockKeyFromAccount(PW)).rejects.toMatchObject({ code: 'PARSE' })
  })

  it('서버가 알려 준 반복 횟수가 너무 작거나 크면 비밀번호 확인 값을 보내지 않는다', async () => {
    await saveKeyToAccount(CFG, PW)
    for (const bad of [1, 999, 10_000_000]) {
      server.rows.get('user-1').p_iterations = bad
      server.calls.length = 0
      await expect(unlockKeyFromAccount(PW)).rejects.toMatchObject({ code: 'PARSE' })
      expect(server.calls.map((c) => c.name)).not.toContain('unlock_user_key')
    }
  })

  it('불러올 때 회사·모델 이름은 잠긴 값과 같은 순간의 것', async () => {
    await saveKeyToAccount(CFG, PW)
    const realRpc = (await import('../common/auth.js')).supabase.rpc
    const auth = await import('../common/auth.js')
    auth.supabase.rpc = async (name, args) => {
      const res = await realRpc(name, args)
      if (name === 'get_user_key_info') res.data.model_light = 'stale-model' // 오래된 정보라고 가정
      return res
    }
    try {
      expect((await unlockKeyFromAccount(PW)).modelLight).toBe('gemini-3.5-flash-lite')
    } finally {
      auth.supabase.rpc = realRpc
    }
  })

  it('한글을 자모로 나눈 형태(NFD)로 붙여 넣어도 글자 수는 합친 형태로 센다', async () => {
    const nfd = '한글비번'.normalize('NFD') // 4글자지만 자모로는 10개 이상
    expect(Array.from(nfd).length).toBeGreaterThanOrEqual(8)
    await expect(saveKeyToAccount(CFG, nfd)).rejects.toMatchObject({ code: 'INVALID_ARG' })
    await saveKeyToAccount(CFG, '한글비밀번호입니다'.normalize('NFD'))
    expect((await unlockKeyFromAccount('한글비밀번호입니다')).apiKey).toBe(KEY) // 합친 형태로 입력해도 풀림
  })

  it('한글·이모지 비밀번호도 된다', async () => {
    await saveKeyToAccount(CFG, '비밀번호🔑한글로')
    expect((await unlockKeyFromAccount('비밀번호🔑한글로')).apiKey).toBe(KEY)
  })
})

describe('비밀번호 바꾸기·삭제', () => {
  it('바꾸면 예전 비밀번호는 안 되고 새 비밀번호로 풀린다', async () => {
    await saveKeyToAccount(CFG, PW)
    await changeKeyPassword(PW, 'new password 2')
    await expect(unlockKeyFromAccount(PW)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    expect(await unlockKeyFromAccount('new password 2')).toEqual(CFG)
  })

  it('예전 비밀번호가 틀리면 바꾸지 않는다', async () => {
    await saveKeyToAccount(CFG, PW)
    await expect(changeKeyPassword('nope-nope', 'new password 2')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    expect((await unlockKeyFromAccount(PW)).apiKey).toBe(KEY)
  })

  it('삭제하면 정보가 사라진다 (비밀번호를 잊었을 때)', async () => {
    await saveKeyToAccount(CFG, PW)
    await deleteKeyFromAccount()
    expect(await getAccountKeyInfo()).toBeNull()
  })
})
