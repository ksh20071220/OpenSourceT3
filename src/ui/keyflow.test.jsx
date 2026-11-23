// [곽수호] 로그인 첫 화면 + API 키 불러오기/저장 팝업 테스트
// 로그인(Supabase)과 keyVault 는 가짜로 바꿔서 화면 흐름만 확인한다.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const auth = vi.hoisted(() => ({ user: null }))
const vault = vi.hoisted(() => ({
  info: null,
  getAccountKeyInfo: null,
  saveKeyToAccount: null,
  unlockKeyFromAccount: null,
  changeKeyPassword: null,
  deleteKeyFromAccount: null,
}))

vi.mock('../common/auth.js', () => ({
  supabase: {},
  isCloudEnabled: () => true,
  getCurrentUser: async () => auth.user,
  onAuthChange: () => () => {},
  signInWithGoogle: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}))

vi.mock('../storage/keyVault.js', async (orig) => ({
  ...(await orig()),
  getAccountKeyInfo: (...a) => vault.getAccountKeyInfo(...a),
  saveKeyToAccount: (...a) => vault.saveKeyToAccount(...a),
  unlockKeyFromAccount: (...a) => vault.unlockKeyFromAccount(...a),
  changeKeyPassword: (...a) => vault.changeKeyPassword(...a),
  deleteKeyFromAccount: (...a) => vault.deleteKeyFromAccount(...a),
}))

// 계정 동기화는 이 테스트의 관심사가 아니라서 아무것도 안 하게
vi.mock('../storage/storage.js', async (orig) => ({
  ...(await orig()),
  syncFromCloud: async () => ({ down: 0, up: 0 }),
  hasGuestData: async () => false,
}))

const { App } = await import('./App.jsx')
const { signInWithGoogle } = await import('../common/auth.js')
const { saveConfig, loadConfig } = await import('../common/config.js')
const { clearLocalData, setActiveUser } = await import('../storage/storage.js')
const { AppError, ErrCode } = await import('../common/errors.js')

const KEY_CFG = { provider: 'gemini', apiKey: 'AIza-real', modelLight: 'gemini-3.5-flash-lite', modelHeavy: 'gemini-3.8-flash' }

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  setActiveUser(null)
  await clearLocalData()
  auth.user = null
  vault.info = null
  vault.getAccountKeyInfo = vi.fn(async () => vault.info)
  vault.saveKeyToAccount = vi.fn(async () => {})
  vault.unlockKeyFromAccount = vi.fn(async () => KEY_CFG)
  vault.changeKeyPassword = vi.fn(async () => {})
  vault.deleteKeyFromAccount = vi.fn(async () => {
    vault.info = null
  })
})

describe('처음 시작 화면', () => {
  it('처음 열면 시작 화면 → 로그인 없이 써 보기 → 홈, 다음부터는 바로 홈', async () => {
    renderAt('/')
    expect(await screen.findByText('Google로 시작하기')).toBeTruthy()
    fireEvent.click(screen.getByText('로그인 없이 써 보기'))
    expect(await screen.findByText('내 캐릭터')).toBeTruthy()
    cleanup()
    renderAt('/')
    expect(await screen.findByText('내 캐릭터')).toBeTruthy()
    expect(screen.queryByText('Google로 시작하기')).toBeNull()
  })

  it('Google로 시작하기를 누르면 구글 로그인으로', async () => {
    renderAt('/chats')
    fireEvent.click(await screen.findByText('Google로 시작하기'))
    expect(signInWithGoogle).toHaveBeenCalled()
  })

  it('개인정보 처리방침은 시작 화면 없이 볼 수 있다', async () => {
    renderAt('/privacy')
    expect(await screen.findByText(/API 키 계정 저장/)).toBeTruthy()
  })

  it('로그인한 사람은 시작 화면을 건너뛴다', async () => {
    auth.user = { id: 'u1', email: 'a@b.c' }
    renderAt('/')
    expect(await screen.findByText('내 캐릭터')).toBeTruthy()
    expect(screen.queryByText('Google로 시작하기')).toBeNull()
  })
})

describe('로그인 후 API 키 팝업', () => {
  beforeEach(() => {
    auth.user = { id: 'u1', email: 'a@b.c' }
  })

  it('계정에 키가 있고 이 기기에 없으면 "불러오시겠습니까?" → 비밀번호 → 설정 완료', async () => {
    vault.info = { provider: 'gemini', modelLight: KEY_CFG.modelLight, modelHeavy: KEY_CFG.modelHeavy, updatedAt: 0, lockedSeconds: 0 }
    renderAt('/')
    expect(await screen.findByText('저장된 API 키를 불러오시겠습니까?')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('API 키 비밀번호'), { target: { value: 'my password' } })
    fireEvent.click(screen.getByText('불러오기'))
    await waitFor(() => expect(loadConfig()).toMatchObject(KEY_CFG))
    expect(vault.unlockKeyFromAccount).toHaveBeenCalledWith('my password')
    await waitFor(() => expect(screen.queryByText('저장된 API 키를 불러오시겠습니까?')).toBeNull())
  })

  it('비밀번호가 틀리면 남은 기회, 잠기면 남은 초를 보여 주고 창은 그대로', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    vault.unlockKeyFromAccount = vi
      .fn()
      .mockRejectedValueOnce(new AppError(ErrCode.WRONG_PASSWORD, '', null, { remaining: 4 }))
      .mockRejectedValueOnce(new AppError(ErrCode.LOCKED, '', null, { retryAfter: 30 }))
    renderAt('/')
    const box = await screen.findByLabelText('API 키 비밀번호')
    fireEvent.change(box, { target: { value: 'wrong pass' } })
    fireEvent.click(screen.getByText('불러오기'))
    expect(await screen.findByText(/남은 기회 4번/, {}, { timeout: 4000 })).toBeTruthy()
    fireEvent.change(box, { target: { value: 'wrong again' } })
    fireEvent.click(screen.getByText('불러오기'))
    expect(await screen.findByText(/30초 뒤/, {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByText('불러오기').closest('button').disabled).toBe(true)
  })

  it('"아니요"를 누르면 이 기기에서는 다시 묻지 않는다', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    renderAt('/')
    fireEvent.click(await screen.findByText('아니요'))
    cleanup()
    renderAt('/')
    await screen.findByText('내 캐릭터')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('저장된 API 키를 불러오시겠습니까?')).toBeNull()
  })

  it('이 기기에 키가 있고 계정에 없으면 "저장할까요?" → 비밀번호 두 번 → 저장', async () => {
    saveConfig({ ...KEY_CFG, rememberKey: true })
    renderAt('/')
    expect(await screen.findByText('이 API 키를 계정에 저장할까요?')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('API 키 비밀번호 정하기'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('한 번 더 입력'), { target: { value: 'short' } })
    fireEvent.click(screen.getByText('저장'))
    expect(await screen.findByText(/8자 이상이어야/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('API 키 비밀번호 정하기'), { target: { value: 'long enough 1' } })
    fireEvent.change(screen.getByLabelText('한 번 더 입력'), { target: { value: 'long enough 2' } })
    fireEvent.click(screen.getByText('저장'))
    expect(await screen.findByText(/서로 달라요/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('한 번 더 입력'), { target: { value: 'long enough 1' } })
    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => expect(vault.saveKeyToAccount).toHaveBeenCalled())
    expect(vault.saveKeyToAccount.mock.calls[0][0]).toMatchObject(KEY_CFG)
    expect(vault.saveKeyToAccount.mock.calls[0][1]).toBe('long enough 1')
  })

  it('이 기기와 계정에 둘 다 키가 있으면 묻지 않는다', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    saveConfig({ ...KEY_CFG, rememberKey: true })
    renderAt('/')
    await screen.findByText('내 캐릭터')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('저장된 API 키를 불러오시겠습니까?')).toBeNull()
    expect(screen.queryByText(/계정에 저장할까요/)).toBeNull()
  })

  it('이미 잠겨 있으면 창을 열 때부터 남은 초를 보여 주고 버튼을 막는다', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 20 }
    renderAt('/')
    expect(await screen.findByText(/20초 뒤에 다시/)).toBeTruthy()
    expect(screen.getByText('불러오기').closest('button').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('API 키 비밀번호'), { target: { value: 'typing' } })
    expect(screen.getByText(/초 뒤에 다시/)).toBeTruthy() // 입력해도 안내가 사라지지 않음
  })

  it('테스트 모드 키는 저장하자고 묻지 않는다', async () => {
    saveConfig({ provider: 'test' })
    renderAt('/')
    await screen.findByText('내 캐릭터')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('이 API 키를 계정에 저장할까요?')).toBeNull()
  })

  it('비밀번호를 잊었어요 → 확인 → 계정의 키 삭제', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    renderAt('/')
    fireEvent.click(await screen.findByText('비밀번호를 잊었어요'))
    fireEvent.click(await screen.findByText('지우기'))
    await waitFor(() => expect(vault.deleteKeyFromAccount).toHaveBeenCalled())
  })
})

describe('설정 → 계정', () => {
  beforeEach(() => {
    auth.user = { id: 'u1', email: 'a@b.c' }
    localStorage.setItem('ost3.keyPromptDismissed.u1', '1') // 자동 팝업은 이 묶음에서 끔
  })

  it('AI 연결 저장: 계정에 키가 없으면 "계정에도 저장"이 켜져 있어 비밀번호 창이 뜬다', async () => {
    saveConfig({ ...KEY_CFG, rememberKey: true })
    renderAt('/settings')
    fireEvent.click(await screen.findByText('변경'))
    const box = await screen.findByLabelText(/계정에도 저장/)
    expect(box.checked).toBe(true)
    fireEvent.click(screen.getByText('저장'))
    expect(await screen.findByText(/계정에 저장할까요/)).toBeTruthy()
  })

  it('AI 연결 저장: 계정에 이미 키가 있으면 기본으로 끄고, 저장해도 비밀번호 창이 안 뜬다', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    saveConfig({ ...KEY_CFG, rememberKey: true })
    renderAt('/settings')
    await screen.findByText(/계정에 저장된 API 키/)
    fireEvent.click(await screen.findByText('변경'))
    const box = await screen.findByLabelText(/이 키로 바꾸기/)
    expect(box.checked).toBe(false)
    fireEvent.click(screen.getByText('저장'))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/계정에 저장된 키를 이 키로 바꿀까요/)).toBeNull()
  })

  it('설정에서 불러오기를 열면 잠금 정보를 새로 받는다 (낡은 남은 시간 안 보임)', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 20 }
    renderAt('/settings')
    await screen.findByText(/계정에 저장된 API 키/)
    vault.info = { ...vault.info, lockedSeconds: 0 } // 그사이 잠금이 풀림
    fireEvent.click(screen.getByText('불러오기'))
    await screen.findByText('저장된 API 키를 불러오시겠습니까?')
    expect(screen.queryByText(/초 뒤에 다시/)).toBeNull()
    expect(screen.getAllByText('불러오기').at(-1).closest('button').disabled).toBe(false)
  })

  it('비밀번호 바꾸기', async () => {
    vault.info = { provider: 'gemini', modelLight: '', modelHeavy: '', updatedAt: 0, lockedSeconds: 0 }
    renderAt('/settings')
    fireEvent.click(await screen.findByText('비밀번호 바꾸기'))
    fireEvent.change(await screen.findByLabelText('지금 비밀번호'), { target: { value: 'old password' } })
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'new password!' } })
    fireEvent.change(screen.getByLabelText('한 번 더 입력'), { target: { value: 'new password!' } })
    fireEvent.click(screen.getByText('바꾸기'))
    await waitFor(() => expect(vault.changeKeyPassword).toHaveBeenCalledWith('old password', 'new password!'))
  })

  it('저장된 키 정보와 관리 버튼, 로그아웃할 때 이 브라우저의 키 지우기', async () => {
    vault.info = { provider: 'gemini', modelLight: 'lite-a', modelHeavy: 'flash-b', updatedAt: 0, lockedSeconds: 0 }
    saveConfig({ ...KEY_CFG, rememberKey: true })
    renderAt('/settings')
    expect(await screen.findByText(/저비용 lite-a · 고성능 flash-b/)).toBeTruthy()
    expect(screen.getByText('비밀번호 바꾸기')).toBeTruthy()
    expect(screen.getByText('이 기기의 키로 바꾸기')).toBeTruthy()
    fireEvent.click(screen.getByText('로그아웃'))
    const check = await screen.findByLabelText(/이 브라우저의 API 키도 지우기/)
    expect(check.checked).toBe(true)
    fireEvent.click(screen.getAllByText('로그아웃').at(-1))
    await waitFor(() => expect(loadConfig().apiKey).toBe(''))
  })
})
