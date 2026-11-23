/*
 * prompt.js — 대화 때 LLM에 넣을 캐릭터 설명문 만들기
 * [담당: 손석현]
 *
 * 제안서: "대화 과정에서 JSON 파일에 저장된 설정을 선택적으로 참조해 토큰을 절약한다"
 * → 매번 전부 넣지 않고, 말투·성격 핵심 + 입력과 관련된 행동 원칙 + (학습·실무일 때) 전문성만 고른다.
 *   evidence(근거)는 생성·검증용이라 대화에는 넣지 않는다.
 *
 * TODO(손석현):
 *   [ ] 행동 원칙 고르기를 단어 겹침 대신 더 똑똑하게 (예: 저비용 모델로 관련도 판단)
 *   [ ] 성격 특성끼리 모순될 때 상황에 따라 고르는 규칙 (제안서 "모순 요소는 맥락에 따라 선택")
 */

const MAX_TRAITS = 6
const MAX_RULES = 5
const MAX_SAMPLES = 4
const MAX_UNCERTAIN = 3

const strengthWord = (s) => (typeof s !== 'number' ? '' : s >= 0.75 ? '강함' : s >= 0.4 ? '보통' : '약함')
const formalityWord = { formal: '존댓말', informal: '반말' }
const levelWord = { low: '적게', medium: '보통으로', high: '풍부하게' }
const priorityRank = { high: 0, medium: 1, low: 2 }

/** 사용자 입력과 겹치는 단어가 있는 행동 원칙을 앞으로, 그다음 우선순위 높은 순 */
export function selectRules(rules, userText, max = MAX_RULES) {
  if (!Array.isArray(rules)) return []
  const words = String(userText || '')
    .toLowerCase()
    .split(/[\s.,!?~"'()[\]{}:;·…]+/)
    .filter((w) => w.length >= 2)
  const score = (r) => {
    const cond = String(r.condition || '').toLowerCase()
    const hit = words.some((w) => cond.includes(w) || (w.length >= 3 && cond.includes(w.slice(0, -1))))
    return (hit ? 0 : 10) + (priorityRank[r.priority] ?? 1)
  }
  return [...rules].filter((r) => r?.condition && r?.response).sort((a, b) => score(a) - score(b)).slice(0, max)
}

/**
 * 캐릭터 설명문
 * @param {object} persona   페르소나 JSON
 * @param {object|null} purpose  사용 목적 (use_expertise 가 true면 전문성 포함)
 * @param {string} [userText]   이번 사용자 입력 (관련 행동 원칙 고르기용)
 * @returns {string}
 */
export function buildPersonaPrompt(persona, purpose, userText) {
  const c = persona?.character || {}
  const pers = persona?.personality || {}
  const style = pers.speech_style || {}
  const lines = []

  lines.push(`너는 '${c.name}'(출처: ${c.source || '알 수 없음'})이다. 아래 설정에 맞게 생각하고 말한다.`)
  lines.push('설정에 나오지 않는 상황에서는 이 캐릭터의 성격과 가치관이라면 어떻게 할지 추론해서 행동한다.')

  const styleBits = [
    style.tone,
    formalityWord[style.formality],
    style.expressiveness && `감정 표현은 ${levelWord[style.expressiveness]}`,
  ].filter(Boolean)
  if (styleBits.length) lines.push(`\n[말투] ${styleBits.join(', ')}`)
  const samples = (style.sample_lines || []).filter(Boolean).slice(0, MAX_SAMPLES)
  if (samples.length) lines.push(`[말투 예시]\n${samples.map((s) => `- ${s}`).join('\n')}`)

  const traits = [...(pers.traits || [])]
    .filter((t) => t?.name)
    .sort((a, b) => (b.strength ?? 0.5) - (a.strength ?? 0.5))
    .slice(0, MAX_TRAITS)
  if (traits.length) {
    lines.push(`\n[성격] ${traits.map((t) => (strengthWord(t.strength) ? `${t.name}(${strengthWord(t.strength)})` : t.name)).join(', ')}`)
  }
  if (pers.values?.length) lines.push(`[가치관] ${pers.values.join(', ')}`)

  const rules = selectRules(persona?.behavior_rules, userText)
  if (rules.length) {
    lines.push('\n[행동 원칙]')
    for (const r of rules) lines.push(`- ${r.condition}: ${r.response}${r.exception ? ` (단, ${r.exception})` : ''}`)
  }

  if (purpose?.use_expertise && persona?.expertise) {
    const { strengths = [], limitations = [] } = persona.expertise
    if (strengths.length) lines.push(`\n[잘 아는 분야] ${strengths.join(', ')}`)
    if (limitations.length) lines.push(`[잘 모르는 분야] ${limitations.join(', ')} — 이 분야는 아는 척하지 말고 솔직하게 말한다.`)
  }

  const unsure = (persona?.uncertainties || []).filter((u) => u?.question && u.status !== 'inferred').slice(0, MAX_UNCERTAIN)
  if (unsure.length) {
    lines.push(`\n[자료로 확인되지 않은 부분] ${unsure.map((u) => u.question).join(' / ')}`)
    lines.push('이런 상황이 오면 성격에 맞게 추론하되, 원작의 사실처럼 단정하지 않는다.')
  }

  lines.push('\n캐릭터를 유지하되, 사용자가 진지하게 AI인지 묻거나 현실의 도움이 필요해 보이면 솔직하게 답한다.')
  return lines.join('\n')
}

/**
 * 비교용 단순 프롬프트 방식 (제안서의 OOC 비교 검증용 baseline)
 * 페르소나 JSON 없이 캐릭터 이름과 작품명만 넣는다.
 */
export function buildBaselinePrompt(persona) {
  const c = persona?.character || {}
  return `너는 '${c.name}'(출처: ${c.source || '알 수 없음'})이다. 이 캐릭터처럼 대화한다.`
}
