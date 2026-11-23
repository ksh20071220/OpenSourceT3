/*
 * schema.js — 페르소나 JSON 형식 검사
 * [담당: 손석현]   형식 설명은 docs/persona-schema.md
 *
 * 다른 모듈은 validatePersona() 결과만 보고, 필드를 직접 검사하지 않는다.
 *
 * TODO(손석현):
 *   [ ] evidence_ids 가 없는 근거를 가리키면 경고 → 오류로 올릴지 결정
 *   [ ] schema_version 이 바뀌면 예전 형식을 새 형식으로 바꿔 주는 함수(migrate)
 */

export const SCHEMA_VERSION = '1.1'

const CONFIDENCE = ['low', 'medium', 'high']
const BASIS = ['explicit', 'inferred']
const FORMALITY = ['formal', 'informal']
const LEVEL = ['low', 'medium', 'high']
const RELIABILITY = ['low', 'medium', 'high']
const EVIDENCE_TYPE = ['scene', 'description']
const UNCERTAINTY = ['unresolved', 'inferred']

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'
const isStrArr = (v) => Array.isArray(v) && v.every(isStr)

/** 빈 페르소나 (양식 직접 입력의 시작점) */
export function emptyPersona(name = '', source = '자체 창작') {
  return {
    schema_version: SCHEMA_VERSION,
    character: { name, source, setting_version: '' },
    personality: {
      traits: [],
      values: [],
      speech_style: { tone: '', formality: 'informal', expressiveness: 'medium', sample_lines: [] },
    },
    evidence: [],
    behavior_rules: [],
    expertise: { strengths: [], limitations: [] },
    uncertainties: [],
  }
}

/**
 * 형식 검사
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function validatePersona(p) {
  const errors = []
  const warnings = []
  const err = (m) => errors.push(m)
  const enumCheck = (v, list, where) => {
    if (v !== undefined && !list.includes(v)) err(`${where} 값은 ${list.join(' / ')} 중 하나여야 합니다`)
  }

  if (!isObj(p)) return { ok: false, errors: ['페르소나가 JSON 객체가 아닙니다'], warnings }
  if (!isStr(p.schema_version)) err('schema_version 이 없습니다')
  if (!isObj(p.character)) err('character 가 없습니다')
  else {
    if (!isStr(p.character.name) || !p.character.name.trim()) err('character.name(캐릭터 이름)이 비어 있습니다')
    if (!isStr(p.character.source)) err('character.source(작품명)가 없습니다')
  }

  const pers = p.personality
  if (pers !== undefined) {
    if (!isObj(pers)) err('personality 는 객체여야 합니다')
    else {
      if (pers.traits !== undefined) {
        if (!Array.isArray(pers.traits)) err('personality.traits 는 배열이어야 합니다')
        else
          pers.traits.forEach((t, i) => {
            const w = `traits[${i}]`
            if (!isObj(t) || !isStr(t.name) || !t.name) return err(`${w}.name 이 없습니다`)
            if (t.strength !== undefined && !(typeof t.strength === 'number' && t.strength >= 0 && t.strength <= 1))
              err(`${w}.strength 는 0~1 숫자여야 합니다`)
            enumCheck(t.confidence, CONFIDENCE, `${w}.confidence`)
            enumCheck(t.basis, BASIS, `${w}.basis`)
            if (t.evidence_ids !== undefined && !isStrArr(t.evidence_ids)) err(`${w}.evidence_ids 는 문자열 배열이어야 합니다`)
          })
      }
      if (pers.values !== undefined && !isStrArr(pers.values)) err('personality.values 는 문자열 배열이어야 합니다')
      const s = pers.speech_style
      if (s !== undefined) {
        if (!isObj(s)) err('speech_style 은 객체여야 합니다')
        else {
          if (s.tone !== undefined && !isStr(s.tone)) err('speech_style.tone 은 문자열이어야 합니다')
          enumCheck(s.formality, FORMALITY, 'speech_style.formality')
          enumCheck(s.expressiveness, LEVEL, 'speech_style.expressiveness')
          if (s.sample_lines !== undefined && !isStrArr(s.sample_lines)) err('speech_style.sample_lines 는 문자열 배열이어야 합니다')
        }
      }
    }
  }

  const ids = new Set()
  if (p.evidence !== undefined) {
    if (!Array.isArray(p.evidence)) err('evidence 는 배열이어야 합니다')
    else
      p.evidence.forEach((e, i) => {
        if (!isObj(e) || !isStr(e.id) || !e.id) return err(`evidence[${i}].id 가 없습니다`)
        ids.add(e.id)
        enumCheck(e.type, EVIDENCE_TYPE, `evidence[${i}].type`)
        enumCheck(e.reliability, RELIABILITY, `evidence[${i}].reliability`)
      })
  }

  if (p.behavior_rules !== undefined) {
    if (!Array.isArray(p.behavior_rules)) err('behavior_rules 는 배열이어야 합니다')
    else
      p.behavior_rules.forEach((r, i) => {
        if (!isObj(r) || !isStr(r.condition) || !isStr(r.response)) err(`behavior_rules[${i}] 에 condition, response 가 필요합니다`)
        else enumCheck(r.priority, LEVEL, `behavior_rules[${i}].priority`)
      })
  }

  if (p.expertise !== undefined) {
    if (!isObj(p.expertise)) err('expertise 는 객체여야 합니다')
    else {
      if (p.expertise.strengths !== undefined && !isStrArr(p.expertise.strengths)) err('expertise.strengths 는 문자열 배열이어야 합니다')
      if (p.expertise.limitations !== undefined && !isStrArr(p.expertise.limitations)) err('expertise.limitations 는 문자열 배열이어야 합니다')
    }
  }

  if (p.uncertainties !== undefined) {
    if (!Array.isArray(p.uncertainties)) err('uncertainties 는 배열이어야 합니다')
    else
      p.uncertainties.forEach((u, i) => {
        if (!isObj(u) || !isStr(u.question)) err(`uncertainties[${i}].question 이 없습니다`)
        else enumCheck(u.status, UNCERTAINTY, `uncertainties[${i}].status`)
      })
  }

  // 없는 근거를 가리키는 evidence_ids 는 경고만 (사용자가 양식으로 만들 때 흔함)
  const refs = [
    ...(pers?.traits || []).flatMap((t) => t?.evidence_ids || []),
    ...(p.behavior_rules || []).flatMap((r) => r?.evidence_ids || []),
  ]
  for (const id of refs) if (!ids.has(id)) warnings.push(`근거 ${id} 가 evidence 에 없습니다`)

  return { ok: errors.length === 0, errors, warnings }
}
