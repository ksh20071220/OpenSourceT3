/*
 * persona.js — 페르소나 엔진 (공개 함수)
 * [담당: 손석현]   규격은 docs/INTERFACE.md, 형식은 docs/persona-schema.md
 *
 * 저장 기록 모양 (storage/personasStore)
 *   { id, persona, origin: 'search'|'form'|'text'|'import'|'sample', sources: [{title, url}], createdAt, updatedAt }
 *
 * 사용하는 쪽: ui/ (목록·만들기·편집), api/ (대화할 때 설명문)
 */
import { AppError, ErrCode } from '../common/errors.js'
import { newId } from '../common/ids.js'
import { personasStore, getActiveUser } from '../storage/storage.js'
import { clearHistory } from '../memory/memory.js'
import { validatePersona, emptyPersona, SCHEMA_VERSION } from './schema.js'
import { buildPersonaPrompt, buildBaselinePrompt } from './prompt.js'
import { generateFromSearch, generateFromText } from './generate.js'
import yunseo from '../assets/personas/yunseo.json'

export { validatePersona, emptyPersona, SCHEMA_VERSION, buildPersonaPrompt, buildBaselinePrompt }

/** @returns {Promise<Array<object>>} 최근에 바뀐 순 */
export function listPersonas() {
  return personasStore.list()
}

/** @returns {Promise<object|null>} 저장 기록 (페르소나 JSON은 .persona) */
export function getPersona(id) {
  return personasStore.get(id)
}

/**
 * 저장 (새로 만들기 / 고치기). 형식이 틀리면 AppError(INVALID_ARG)를 던지고 저장하지 않는다.
 * @param {object} persona
 * @param {{id?: string, origin?: string, sources?: Array}} [opts]  id가 있으면 그 캐릭터를 덮어쓴다
 * @returns {Promise<object>} 저장된 기록
 */
export async function savePersona(persona, { id, origin = 'form', sources } = {}) {
  const check = validatePersona(persona)
  if (!check.ok) throw new AppError(ErrCode.INVALID_ARG, check.errors.join(', '))
  const prev = id ? await personasStore.get(id) : null
  return personasStore.put({
    id: id || newId('char'),
    persona,
    origin: prev?.origin || origin,
    sources: sources ?? prev?.sources ?? [],
    createdAt: prev?.createdAt || Date.now(),
  })
}

/** 캐릭터와 그 대화 기록까지 삭제 */
export async function deletePersona(id) {
  await personasStore.remove(id)
  await clearHistory(id)
}

/** 파일로 내보낼 JSON 문자열 (페르소나 JSON만) */
export function exportPersonaJson(record) {
  return JSON.stringify(record.persona, null, 2)
}

/** 파일에서 가져오기. 항상 새 캐릭터로 저장한다. */
export async function importPersonaJson(text) {
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    throw new AppError(ErrCode.PARSE, 'JSON 파일이 아닙니다', e)
  }
  return savePersona(obj, { origin: 'import' })
}

/** 검색으로 만들기 + 저장 (generate.js 설명 참고) */
export async function createPersonaFromSearch({ name, source, keywords, onProgress, signal }) {
  const { persona, sources } = await generateFromSearch({ name, source, keywords, onProgress, signal })
  onProgress?.({ percent: 95, step: '저장 중' })
  const rec = await savePersona(persona, { origin: 'search', sources })
  onProgress?.({ percent: 100, step: '완료' })
  return rec
}

/** 설정 글로 만들기 + 저장 */
export async function createPersonaFromText({ name, source, text, onProgress, signal }) {
  const { persona } = await generateFromText({ name, source, text, onProgress, signal })
  onProgress?.({ percent: 95, step: '저장 중' })
  const rec = await savePersona(persona, { origin: 'text' })
  onProgress?.({ percent: 100, step: '완료' })
  return rec
}

/**
 * 처음 쓰는 사람에게 샘플 캐릭터(자체 창작 '윤서') 넣어 주기. 한 번만 넣는다 (지워도 다시 안 생김).
 */
export async function ensureSamples() {
  const flag = `ost3.samplesSeeded.${getActiveUser() || 'guest'}`
  try {
    if (globalThis.localStorage?.getItem(flag)) return
  } catch {
    /* 저장소 접근 불가면 그냥 진행 */
  }
  if (!(await personasStore.get('yunseo')) && (await personasStore.list()).length === 0) {
    await savePersona(yunseo, { id: 'yunseo', origin: 'sample' })
  }
  try {
    globalThis.localStorage?.setItem(flag, '1')
  } catch {
    /* 무시 */
  }
}
