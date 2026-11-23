// [곽수호] 화면 기본 동작 테스트 (테스트 모드)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from './App.jsx'
import { saveConfig } from '../common/config.js'
import { clearLocalData } from '../storage/storage.js'

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
  await clearLocalData()
})
afterEach(() => vi.unstubAllGlobals())

describe('화면', () => {
  it('처음 열면 AI 연결 안내와 샘플 캐릭터', async () => {
    renderAt('/')
    expect(await screen.findByText('윤서')).toBeTruthy()
    expect(screen.getAllByText('AI 연결하기').length).toBeGreaterThan(0)
  })

  it('테스트 모드로 대화하면 답변이 보인다', async () => {
    saveConfig({ provider: 'test' })
    renderAt('/chat/yunseo?p=chat_daily')
    const box = await screen.findByLabelText('메시지')
    fireEvent.change(box, { target: { value: '안녕' } })
    fireEvent.click(screen.getByLabelText('보내기'))
    expect(await screen.findByText(/테스트 모드라서/)).toBeTruthy()
  })

  it('상담 목적이면 위기 상담 안내', async () => {
    saveConfig({ provider: 'test' })
    renderAt('/chat/yunseo?p=talk_mind')
    expect(await screen.findByText(/109/)).toBeTruthy()
  })

  it('목적 없이 대화 주소로 오면 프로필로', async () => {
    renderAt('/chat/yunseo')
    expect(await screen.findByText('무엇을 할까요?')).toBeTruthy()
  })

  it('모델 목록을 불러오면 대화용 모델로 추천값을 채운다 (잘못 저장된 값도 바꿈)', async () => {
    saveConfig({ provider: 'gemini', apiKey: 'g-key', modelLight: 'lyria-realtime-exp', modelHeavy: 'lyria-realtime-exp' })
    const ids = ['lyria-realtime-exp', 'gemini-2.5-computer-use-preview-10-2025', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id: `models/${id}` })) }), { status: 200 })))
    renderAt('/setup')
    fireEvent.click(await screen.findByText('모델 목록 불러오기'))
    await screen.findByText(/대화용 모델 2개/)
    expect(screen.getByLabelText('일상 대화용 (저비용)').value).toBe('gemini-3.8-flash')
    expect(screen.getByLabelText('캐릭터 생성·어려운 작업용 (고성능)').value).toBe('gemini-3.8-flash')
  })

  it('목록에 없는 이름을 직접 썼으면 그대로 둔다 (별칭일 수 있음)', async () => {
    saveConfig({ provider: 'claude', apiKey: 'k', modelLight: 'claude-haiku-4-5', modelHeavy: '' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'claude-haiku-4-5-20251001' }, { id: 'claude-sonnet-4-5-20250929' }] }), { status: 200 })))
    renderAt('/setup')
    fireEvent.click(await screen.findByText('모델 목록 불러오기'))
    await screen.findByText(/대화용 모델 2개/)
    expect(screen.getByLabelText('일상 대화용 (저비용)').value).toBe('claude-haiku-4-5')
    expect(screen.getByLabelText('캐릭터 생성·어려운 작업용 (고성능)').value).toBe('claude-sonnet-4-5-20250929')
  })

  it('설정에는 화면(어두운 화면) 항목이 없다', async () => {
    renderAt('/settings')
    await screen.findByText('AI 연결')
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText('어두운 화면')).toBeNull()
  })
})
