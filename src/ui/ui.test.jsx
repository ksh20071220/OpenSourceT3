// [곽수호] 화면 기본 동작 테스트 (테스트 모드)
import { describe, it, expect, beforeEach } from 'vitest'
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
})
