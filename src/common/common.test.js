// [공통] 설정·목적·회사 목록 테스트
import { describe, it, expect, beforeEach } from 'vitest'
import { listPurposes, purposesByCategory, getPurpose, makeCustomPurpose, CATEGORIES } from './purposes.js'
import { listProviders, getProvider } from './providers.js'
import { loadConfig, saveConfig, clearApiKey, isConfigured, modelForTier } from './config.js'
import { AppError, ErrCode, errorMessage } from './errors.js'
import { newId, isValidId } from './ids.js'

describe('사용 목적', () => {
  it('26개 목적이 4개 분류로 나뉜다', () => {
    expect(listPurposes()).toHaveLength(26)
    const by = purposesByCategory()
    expect(Object.keys(by)).toEqual(CATEGORIES)
    expect(Object.values(by).flat()).toHaveLength(26)
  })
  it('기타 목적은 입력한 글로 만든다', () => {
    expect(makeCustomPurpose('  ')).toBeNull()
    const p = getPurpose('custom', '면접 연습')
    expect(p.name).toBe('면접 연습')
    expect(p.instruction).toContain('면접 연습')
    expect(getPurpose('study_physics').tier).toBe('light')
  })
})

describe('AI 회사', () => {
  it('3개 회사 + 테스트 모드', () => {
    expect(listProviders().map((p) => p.id)).toEqual(['openai', 'gemini', 'claude', 'test'])
    expect(getProvider('claude').api).toBe('anthropic')
    expect(getProvider('nope')).toBeNull()
  })
})

describe('설정 저장', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  it('키 기억하기를 켜면 localStorage, 끄면 sessionStorage에만', () => {
    saveConfig({ provider: 'openai', apiKey: 'sk-1', modelLight: 'a', rememberKey: true })
    expect(localStorage.getItem('ost3.apiKey')).toBe('sk-1')
    expect(localStorage.getItem('ost3.config')).not.toContain('sk-1') // 설정 JSON에는 키가 없다
    saveConfig({ provider: 'openai', apiKey: 'sk-2', modelLight: 'a', rememberKey: false })
    expect(localStorage.getItem('ost3.apiKey')).toBeNull()
    expect(sessionStorage.getItem('ost3.apiKey')).toBe('sk-2')
    expect(loadConfig().apiKey).toBe('sk-2')
    clearApiKey()
    expect(loadConfig().apiKey).toBe('')
  })
  it('설정 완료 판단과 모델 라우팅', () => {
    expect(isConfigured({ provider: 'test' })).toBe(true)
    expect(isConfigured({ provider: 'openai', apiKey: 'k' })).toBe(false)
    const cfg = { provider: 'openai', apiKey: 'k', modelLight: 'mini', modelHeavy: '' }
    expect(isConfigured(cfg)).toBe(true)
    expect(modelForTier(cfg, 'heavy')).toBe('mini') // 고성능을 비워 두면 저비용 모델로
    expect(modelForTier({ ...cfg, modelHeavy: 'big' }, 'heavy')).toBe('big')
  })
})

describe('오류와 ID', () => {
  it('오류 메시지는 한국어', () => {
    expect(errorMessage(new AppError(ErrCode.AUTH))).toContain('API 키')
    expect(errorMessage(new Error('x'))).toContain('알 수 없는')
  })
  it('ID 규칙', () => {
    const id = newId()
    expect(isValidId(id)).toBe(true)
    expect(isValidId('../etc')).toBe(false)
  })
})
