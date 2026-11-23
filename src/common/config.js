/*
 * config.js — AI 연결 설정 (회사, API 키, 모델)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 저장 위치 (BYOK 원칙: 키는 사용자 브라우저에만, 계정 DB에는 절대 올리지 않음)
 *   - 회사·모델 이름 등 : localStorage
 *   - API 키            : rememberKey가 true면 localStorage, false면 sessionStorage(탭을 닫으면 지워짐)
 */
import { getProvider } from './providers.js'

const CONFIG_KEY = 'ost3.config'
const API_KEY_KEY = 'ost3.apiKey'

/**
 * @typedef {object} AppConfig
 * @property {string} provider   'openai' | 'gemini' | 'claude' | 'test'
 * @property {string} apiKey
 * @property {string} modelLight 일상 대화용 저비용 모델
 * @property {string} modelHeavy 인격 생성·복잡한 작업용 고성능 모델
 * @property {number|null} temperature null이면 모델 기본값
 * @property {boolean} rememberKey
 */

/** @returns {AppConfig} */
export function defaultConfig() {
  return { provider: '', apiKey: '', modelLight: '', modelHeavy: '', temperature: null, rememberKey: true }
}

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null // 사생활 보호 모드 등에서 저장소 접근이 막힐 수 있다
  }
}

function safeSet(storage, key, value) {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, value)
  } catch {
    /* 저장 실패는 무시: 이번 탭에서는 메모리 값으로 계속 동작 */
  }
}

/** @returns {AppConfig} */
export function loadConfig() {
  const cfg = defaultConfig()
  try {
    const raw = safeGet(globalThis.localStorage, CONFIG_KEY)
    if (raw) Object.assign(cfg, JSON.parse(raw))
  } catch {
    /* 깨진 설정은 무시하고 기본값 */
  }
  delete cfg.apiKey // 혹시 예전 형식으로 키가 들어 있어도 쓰지 않는다
  cfg.apiKey =
    safeGet(globalThis.localStorage, API_KEY_KEY) || safeGet(globalThis.sessionStorage, API_KEY_KEY) || ''
  return cfg
}

/** @param {AppConfig} cfg */
export function saveConfig(cfg) {
  const { apiKey, ...rest } = { ...defaultConfig(), ...cfg }
  safeSet(globalThis.localStorage, CONFIG_KEY, JSON.stringify(rest))
  // 키는 한 곳에만 둔다
  safeSet(globalThis.localStorage, API_KEY_KEY, null)
  safeSet(globalThis.sessionStorage, API_KEY_KEY, null)
  if (apiKey) safeSet(rest.rememberKey ? globalThis.localStorage : globalThis.sessionStorage, API_KEY_KEY, apiKey)
}

/** 이 브라우저에서 API 키만 지우기 */
export function clearApiKey() {
  safeSet(globalThis.localStorage, API_KEY_KEY, null)
  safeSet(globalThis.sessionStorage, API_KEY_KEY, null)
}

/** 대화를 시작할 수 있을 만큼 설정이 끝났는지 */
export function isConfigured(cfg) {
  if (!cfg?.provider || !getProvider(cfg.provider)) return false
  if (cfg.provider === 'test') return true
  return Boolean(cfg.apiKey && (cfg.modelLight || cfg.modelHeavy))
}

/**
 * 목적의 tier에 맞는 모델 이름 (모델 라우팅). 한쪽만 입력했으면 그쪽을 쓴다.
 * @param {AppConfig} cfg
 * @param {'light'|'heavy'} tier
 */
export function modelForTier(cfg, tier) {
  return tier === 'heavy' ? cfg.modelHeavy || cfg.modelLight : cfg.modelLight || cfg.modelHeavy
}
