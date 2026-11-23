// [손석현] 페르소나 엔진 테스트 — 테스트 모드라 API 키 없이 돈다
import { describe, it, expect, beforeEach } from 'vitest'
import yunseo from '../assets/personas/yunseo.json'
import {
  validatePersona,
  emptyPersona,
  buildPersonaPrompt,
  buildBaselinePrompt,
  savePersona,
  getPersona,
  listPersonas,
  deletePersona,
  importPersonaJson,
  exportPersonaJson,
  createPersonaFromSearch,
  createPersonaFromText,
  ensureSamples,
} from './persona.js'
import { selectRules } from './prompt.js'
import { extractJson } from './generate.js'
import { saveConfig } from '../common/config.js'
import { appendMessages, loadHistory } from '../memory/memory.js'
import { clearLocalData } from '../storage/storage.js'

beforeEach(async () => {
  localStorage.clear()
  await clearLocalData()
  saveConfig({ provider: 'test' })
})

describe('형식 검사', () => {
  it('샘플 윤서는 통과', () => {
    expect(validatePersona(yunseo)).toMatchObject({ ok: true, errors: [] })
  })
  it('이름이 없거나 값이 틀리면 실패', () => {
    expect(validatePersona(emptyPersona('')).ok).toBe(false)
    const bad = structuredClone(yunseo)
    bad.personality.traits[0].strength = 3
    bad.personality.speech_style.formality = 'polite'
    const r = validatePersona(bad)
    expect(r.ok).toBe(false)
    expect(r.errors).toHaveLength(2)
    expect(validatePersona(null).ok).toBe(false)
  })
  it('없는 근거를 가리키면 경고만', () => {
    const p = emptyPersona('테스트')
    p.behavior_rules.push({ condition: 'a', response: 'b', evidence_ids: ['E999'] })
    const r = validatePersona(p)
    expect(r.ok).toBe(true)
    expect(r.warnings[0]).toContain('E999')
  })
})

describe('대화용 설명문', () => {
  it('학습·실무 목적에서만 전문성을 넣는다', () => {
    const study = buildPersonaPrompt(yunseo, { use_expertise: true }, '')
    const chat = buildPersonaPrompt(yunseo, { use_expertise: false }, '')
    expect(study).toContain('윤서')
    expect(study).toContain('전략 수립')
    expect(chat).not.toContain('전략 수립')
    expect(chat).toContain('차분하고 직설적')
    expect(chat).not.toContain('E001') // 근거 ID는 대화에 넣지 않는다
  })
  it('입력과 관련된 행동 원칙을 앞으로', () => {
    const rules = [
      { condition: '처음 만난 사람', priority: 'high', response: 'x' },
      { condition: '동료가 위험할 때', priority: 'low', response: 'y' },
    ]
    expect(selectRules(rules, '동료가 다쳤어')[0].response).toBe('y')
    expect(selectRules(rules, '안녕')[0].response).toBe('x')
  })
  it('비교용 단순 프롬프트는 이름만', () => {
    const b = buildBaselinePrompt(yunseo)
    expect(b).toContain('윤서')
    expect(b).not.toContain('차분')
  })
})

describe('저장·삭제·가져오기', () => {
  it('저장하고 목록·조회·삭제 (대화 기록도 같이 삭제)', async () => {
    const rec = await savePersona(yunseo, { origin: 'form' })
    expect(rec.id).toMatch(/^char_/)
    expect((await listPersonas()).map((r) => r.id)).toContain(rec.id)
    await appendMessages(rec.id, [{ role: 'user', content: '안녕' }])
    await deletePersona(rec.id)
    expect(await getPersona(rec.id)).toBeNull()
    expect(await loadHistory(rec.id)).toEqual([])
  })
  it('형식이 틀리면 저장하지 않는다', async () => {
    await expect(savePersona(emptyPersona(''))).rejects.toMatchObject({ code: 'INVALID_ARG' })
    expect(await listPersonas()).toHaveLength(0)
  })
  it('내보낸 JSON을 다시 가져오면 새 캐릭터', async () => {
    const rec = await savePersona(yunseo)
    const again = await importPersonaJson(exportPersonaJson(rec))
    expect(again.id).not.toBe(rec.id)
    expect(again.origin).toBe('import')
    await expect(importPersonaJson('not json')).rejects.toMatchObject({ code: 'PARSE' })
  })
  it('샘플은 처음 한 번만', async () => {
    await ensureSamples()
    expect((await listPersonas()).map((r) => r.id)).toEqual(['yunseo'])
    await deletePersona('yunseo')
    await ensureSamples()
    expect(await listPersonas()).toHaveLength(0)
  })
})

describe('AI로 만들기 (테스트 모드)', () => {
  it('검색으로 만들기: 진행률 → 저장, 입력한 이름·작품명 유지', async () => {
    const steps = []
    const rec = await createPersonaFromSearch({ name: '테스트 캐릭터', source: '테스트 작품', onProgress: (p) => steps.push(p.percent) })
    expect(rec.persona.character).toMatchObject({ name: '테스트 캐릭터', source: '테스트 작품' })
    expect(rec.origin).toBe('search')
    expect(rec.sources.length).toBeGreaterThan(0)
    expect(steps.at(-1)).toBe(100)
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
  })
  it('설정 글로 만들기: 작품명을 비우면 자체 창작', async () => {
    const rec = await createPersonaFromText({ name: '하루', text: '조용하지만 친구를 위해서라면 앞장서는 고등학생 탐정.' })
    expect(rec.persona.character.source).toBe('자체 창작')
    await expect(createPersonaFromText({ name: '하루', text: '짧음' })).rejects.toMatchObject({ code: 'INVALID_ARG' })
  })
  it('이름이 없으면 바로 거절', async () => {
    await expect(createPersonaFromSearch({ name: ' ' })).rejects.toMatchObject({ code: 'INVALID_ARG' })
  })
  it('코드 블록이 붙은 JSON도 꺼낸다', () => {
    expect(extractJson('여기요\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(() => extractJson('없음')).toThrow()
  })
})
