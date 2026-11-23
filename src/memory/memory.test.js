// [오승민] 대화 기록·저장소 테스트
import { describe, it, expect, beforeEach } from 'vitest'
import { appendMessages, loadHistory, clearHistory, recentMessages, listConversations } from './memory.js'
import {
  setActiveUser,
  personasStore,
  hasGuestData,
  copyGuestDataToAccount,
  clearLocalData,
  exportAll,
  importAll,
} from '../storage/storage.js'

beforeEach(async () => {
  setActiveUser('u1')
  await clearLocalData()
  setActiveUser(null)
  await clearLocalData()
})

describe('대화 기록', () => {
  it('추가·불러오기·초기화', async () => {
    await appendMessages('a', [
      { role: 'user', content: '안녕', purposeId: 'chat_daily' },
      { role: 'assistant', content: '반가워' },
      { role: 'system', content: '무시됨' },
    ])
    const h = await loadHistory('a')
    expect(h.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(h[0].purposeId).toBe('chat_daily')
    expect(h[1].at).toBeGreaterThan(h[0].at - 1)
    await clearHistory('a')
    expect(await loadHistory('a')).toEqual([])
  })
  it('최근 n개 고르기', () => {
    const h = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: String(i) }))
    expect(recentMessages(h, 2).map((m) => m.content)).toEqual(['28', '29'])
    expect(recentMessages(h)).toHaveLength(20)
    expect(recentMessages(null)).toEqual([])
  })
  it('대화 목록은 최근 순, 빈 기록 제외', async () => {
    await appendMessages('a', [{ role: 'user', content: '1' }])
    await new Promise((r) => setTimeout(r, 5))
    await appendMessages('b', [{ role: 'user', content: '2' }])
    const list = await listConversations()
    expect(list.map((c) => c.personaId)).toEqual(['b', 'a'])
    expect(list[0].last.content).toBe('2')
  })
})

describe('저장소: 계정별 분리와 옮기기', () => {
  it('로그인 계정마다 데이터가 따로', async () => {
    await personasStore.put({ id: 'g1', persona: {} })
    setActiveUser('u1')
    expect(await personasStore.get('g1')).toBeNull()
    expect(await hasGuestData()).toBe(true)
    expect(await copyGuestDataToAccount()).toBe(1)
    expect(await personasStore.get('g1')).not.toBeNull()
    expect(await hasGuestData()).toBe(false) // 옮긴 뒤 guest 쪽은 비운다
  })
  it('백업 내보내기 → 불러오기', async () => {
    await personasStore.put({ id: 'p1', persona: { a: 1 } })
    await appendMessages('p1', [{ role: 'user', content: 'x' }])
    const backup = await exportAll()
    await clearLocalData()
    expect(await importAll(backup)).toBe(2)
    expect((await personasStore.get('p1')).persona).toEqual({ a: 1 })
    await expect(importAll({ app: 'other' })).rejects.toThrow()
  })
})
