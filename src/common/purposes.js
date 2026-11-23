/*
 * purposes.js — 사용 목적 목록 (학습·실무·상담·대화 + 기타)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 목적 하나의 모양:
 *   { id, name, category, tier: 'light'|'heavy', use_expertise, crisis_notice, description, instruction }
 *   tier: 저비용(light) / 고성능(heavy) 모델 중 무엇을 쓸지 (제안서의 모델 라우팅)
 */
import data from '../assets/purposes.json'

export const CATEGORIES = Object.freeze(['학습', '실무', '상담', '대화'])

/** 화면 맨 끝의 '기타(직접 입력)' 목적 ID */
export const CUSTOM_PURPOSE_ID = 'custom'

/** 상담 목적(crisis_notice: true)일 때 대화 화면에 보여 줄 안내 */
export const CRISIS_NOTICE =
  '이 대화는 AI 캐릭터와의 대화이며 전문 상담을 대신하지 않습니다. ' +
  '마음이 많이 힘들거나 위험하다고 느껴지면 자살예방 상담전화 109, 정신건강 위기상담 1577-0199로 연락하거나, ' +
  '긴급할 때는 119·112에 연락하세요.'

export function listPurposes() {
  return data.purposes
}

/** @returns {Record<string, Array<object>>} 분류별 목록 */
export function purposesByCategory() {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, []]))
  for (const p of data.purposes) (out[p.category] ||= []).push(p)
  return out
}

/**
 * 목적 찾기. 'custom'이면 customText로 기타 목적을 만든다.
 * @returns {object|null}
 */
export function getPurpose(id, customText) {
  if (id === CUSTOM_PURPOSE_ID) return customText ? makeCustomPurpose(customText) : null
  return data.purposes.find((p) => p.id === id) || null
}

/** 사용자가 직접 적은 목적으로 목적 객체 만들기 */
export function makeCustomPurpose(text) {
  const t = String(text || '').trim()
  if (!t) return null
  return {
    id: CUSTOM_PURPOSE_ID,
    name: t,
    category: '기타',
    tier: 'light',
    use_expertise: true,
    crisis_notice: false,
    description: t,
    instruction: `사용자가 직접 정한 대화 목적: "${t}". 캐릭터의 성격과 말투를 유지하면서 이 목적에 맞게 도와준다.`,
  }
}
