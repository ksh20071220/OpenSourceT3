/*
 * memory.js — 대화 기록과 기억
 * [담당: 오승민]   규격은 docs/INTERFACE.md
 *
 * 캐릭터 하나당 대화 기록 하나 (목적이 바뀌어도 같은 기록에 이어 쓰고, 메시지마다 purposeId를 남긴다).
 * 메시지 모양: { role: 'user' | 'assistant', content, at(밀리초), purposeId }
 *
 * TODO(오승민):
 *   [ ] 긴 대화 요약 기억: 오래된 메시지를 저비용 모델로 요약해 summary 필드에 보관 → buildContext에 포함
 *   [ ] 메시지 하나 삭제 / 다시 생성
 */
import { conversationsStore } from '../storage/storage.js'

/** LLM에 보낼 최근 메시지 수 (토큰 절약) */
export const RECENT_MESSAGES = 20

/** @returns {Promise<Array<object>>} 메시지 목록 (없으면 빈 배열) */
export async function loadHistory(personaId) {
  const rec = await conversationsStore.get(personaId)
  return rec?.messages ?? []
}

/**
 * 메시지 여러 개를 기록 끝에 추가
 * @param {string} personaId
 * @param {Array<{role: string, content: string, purposeId?: string}>} messages
 */
export async function appendMessages(personaId, messages) {
  const rec = (await conversationsStore.get(personaId)) || { personaId, messages: [] }
  const now = Date.now()
  const added = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m, i) => ({ role: m.role, content: m.content, at: m.at ?? now + i, purposeId: m.purposeId ?? null }))
  await conversationsStore.put({ ...rec, messages: [...rec.messages, ...added] })
}

export async function clearHistory(personaId) {
  await conversationsStore.remove(personaId)
}

/** 최근 n개만 고르기 (LLM 요청에 넣을 부분) */
export function recentMessages(history, n = RECENT_MESSAGES) {
  if (!Array.isArray(history) || n <= 0) return []
  return history.slice(-n)
}

/**
 * 대화 목록 화면용: 대화가 있는 캐릭터와 마지막 메시지
 * @returns {Promise<Array<{personaId: string, last: object|null, count: number, updatedAt: number}>>}
 */
export async function listConversations() {
  const all = await conversationsStore.list()
  return all
    .filter((c) => c.messages?.length)
    .map((c) => ({
      personaId: c.personaId,
      last: c.messages[c.messages.length - 1] ?? null,
      count: c.messages.length,
      updatedAt: c.updatedAt,
    }))
}
