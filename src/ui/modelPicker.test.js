// [곽수호] 모델 자동 추천 테스트 — 실제로 문제가 됐던 목록(음악·화면 조작 모델 섞임)으로 확인
import { describe, it, expect } from 'vitest'
import { isChatModel, versionOf, sortChatModels, chatModelsFor, recommendModels } from './modelPicker.js'

const GEMINI = [
  'aqa',
  'gemini-2.5-computer-use-preview-10-2025',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-flash-image-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.8-flash-preview-09-2026',
  'gemini-3.8-live',
  'gemini-embedding-001',
  'gemma-3-27b-it',
  'imagen-4.0-generate-001',
  'lyria-realtime-exp',
  'veo-3.0-generate-001',
]

const OPENAI = [
  'chatgpt-4o-latest',
  'dall-e-3',
  'gpt-4o',
  'gpt-4o-audio-preview',
  'gpt-4o-mini',
  'gpt-4o-realtime-preview',
  'gpt-4o-search-preview',
  'gpt-5-nano',
  'gpt-5.1',
  'gpt-5.1-mini',
  'gpt-image-1',
  'o3',
  'o4-mini',
  'text-embedding-3-small',
  'tts-1',
  'whisper-1',
]

// 실제 OpenAI 목록처럼 날짜 붙은 이름, codex·pro·instruct·oss 가 섞인 경우
const OPENAI_REAL = [
  'babbage-002',
  'chatgpt-4o-latest',
  'gpt-3.5-turbo-instruct',
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4o-2024-11-20',
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5-chat-latest',
  'gpt-5-codex',
  'gpt-5-mini',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'gpt-5.1-codex-mini',
  'gpt-oss-120b',
  'o1',
  'o3-pro',
]

const CLAUDE = [
  'claude-3-5-haiku-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-haiku-4-5-20251001',
  'claude-haiku-5-5',
  'claude-opus-5-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-5-5',
]

describe('대화용 모델 걸러 내기', () => {
  it('음악·그림·음성·화면 조작·임베딩 모델은 뺀다', () => {
    const chat = sortChatModels(GEMINI)
    for (const bad of ['lyria-realtime-exp', 'gemini-2.5-computer-use-preview-10-2025', 'gemini-3.1-flash-image-preview', 'gemini-3.8-live', 'gemini-embedding-001', 'imagen-4.0-generate-001', 'veo-3.0-generate-001', 'aqa']) {
      expect(chat).not.toContain(bad)
    }
    expect(isChatModel('gpt-4o-realtime-preview')).toBe(false)
    expect(isChatModel('o4-mini')).toBe(true)
    expect(isChatModel('gpt-5-codex')).toBe(false)
    expect(isChatModel('gpt-3.5-turbo-instruct')).toBe(false)
    expect(isChatModel('gemma-3-27b-it')).toBe(true)
  })
  it('버전 숫자가 큰 순서, 같은 버전이면 정식 먼저', () => {
    expect(sortChatModels(GEMINI).slice(0, 3)).toEqual(['gemini-3.8-flash', 'gemini-3.8-flash-preview-09-2026', 'gemini-3.6-flash'])
    expect(versionOf('claude-sonnet-4-5-20250929')).toEqual([4, 5])
    expect(versionOf('o3-mini')).toEqual([3])
    expect(versionOf('gpt-5-mini-2025-08-07')).toEqual([5])
    expect(versionOf('gpt-oss-120b')).toEqual([])
  })
  it('하나도 안 남으면 원래 목록 그대로', () => {
    expect(sortChatModels(['my-custom-model'])).toEqual(['my-custom-model'])
  })
})

describe('회사별 추천', () => {
  it('Gemini: 두 칸 모두 최신 flash (lite·pro 아님)', () => {
    expect(recommendModels('gemini', GEMINI)).toEqual({ light: 'gemini-3.8-flash', heavy: 'gemini-3.8-flash' })
  })
  it('OpenAI: 최신 mini / 최신 일반 모델', () => {
    expect(recommendModels('openai', OPENAI)).toEqual({ light: 'gpt-5.1-mini', heavy: 'gpt-5.1' })
  })
  it('OpenAI 실제 목록: 날짜 붙은 이름·codex·pro·oss 를 고르지 않는다', () => {
    expect(recommendModels('openai', OPENAI_REAL)).toEqual({ light: 'gpt-5-mini', heavy: 'gpt-5' })
  })
  it('OpenAI 목록에서는 pro 모델을 뺀다, 맞는 게 없어도 pro 를 고르지 않는다', () => {
    expect(chatModelsFor('openai', OPENAI_REAL)).not.toContain('gpt-5-pro')
    expect(chatModelsFor('gemini', ['gemini-3.1-pro-preview'])).toEqual(['gemini-3.1-pro-preview'])
    expect(recommendModels('openai', ['gpt-5-pro', 'gpt-5-nano'])).toEqual({ light: 'gpt-5-nano', heavy: 'gpt-5-nano' })
  })
  it('Claude: 최신 haiku / 최신 sonnet', () => {
    expect(recommendModels('claude', CLAUDE)).toEqual({ light: 'claude-haiku-5-5', heavy: 'claude-sonnet-5-5' })
  })
  it('목록이 비면 빈 값', () => {
    expect(recommendModels('openai', [])).toEqual({ light: '', heavy: '' })
  })
})
