/*
 * keyVault.js — API 키를 "API 키 비밀번호"로 잠가서 계정에 저장하고 불러오기
 * [담당: 오승민]   규격은 docs/INTERFACE.md 6-1, DB 쪽은 supabase/schema.sql 의 user_keys 함수
 *
 * 왜 이렇게 하나
 *   - API 키 원문을 DB에 넣으면 DB나 구글 계정이 털렸을 때 남이 내 돈으로 AI를 쓸 수 있다.
 *   - 그래서 브라우저 안에서 사용자 비밀번호로 잠근(암호화한) 값만 올린다. 원문 키·비밀번호·잠금 열쇠는 서버로 가지 않는다.
 *
 * 어떻게
 *   1. 비밀번호 + 무작위 salt → PBKDF2-SHA256 (60만 번 반복, 느리게 만들어 마구 맞혀 보기를 어렵게) → 64바이트
 *   2. 앞 32바이트 = 잠금 열쇠 → API 키를 AES-GCM 으로 암호화 (계정 id를 같이 묶어 다른 계정으로 옮기면 안 풀리게)
 *   3. 뒤 32바이트 = 확인용 값 → 서버에 보내면 서버가 bcrypt 로 감싸 저장. 불러올 때 이 값이 맞아야 잠긴 값을 내준다.
 *   4. 틀린 횟수는 서버(DB 함수)가 센다: 5번 틀리면 30초 잠금.
 *
 * 브라우저 내장 Web Crypto 만 쓴다 (외부 라이브러리 없음).
 */
import { supabase } from '../common/auth.js'
import { AppError, ErrCode } from '../common/errors.js'
import { getActiveUser } from './storage.js'

export const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 256

/** 테스트에서만 반복 횟수를 줄이기 위한 설정. 앱에서는 바꾸지 않는다 (AGENTS.md: 약하게 바꾸지 않기) */
export const keyVaultOptions = { iterations: 600_000 }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))

/** 비밀번호 규칙 검사. 틀리면 INVALID_ARG */
export function checkPassword(password) {
  const len = Array.from(String(password ?? '')).length
  if (len < MIN_PASSWORD_LENGTH) throw new AppError(ErrCode.INVALID_ARG, `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다`)
  if (len > MAX_PASSWORD_LENGTH) throw new AppError(ErrCode.INVALID_ARG, `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다`)
  if (!String(password).trim()) throw new AppError(ErrCode.INVALID_ARG, '공백만으로 된 비밀번호는 쓸 수 없습니다')
}

/** 비밀번호 → { 잠금 열쇠, 확인용 값(hex) } */
async function deriveKeys(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 512))
  const encKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const auth = toHex(bits.slice(32))
  bits.fill(0) // 메모리에 열쇠 재료를 오래 남기지 않는다
  return { encKey, auth }
}

function requireLogin() {
  if (!supabase) throw new AppError(ErrCode.NOT_CONFIGURED, '로그인 기능이 설정되지 않았습니다')
  const uid = getActiveUser()
  if (!uid) throw new AppError(ErrCode.STORAGE, '로그인이 필요합니다')
  return uid
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new AppError(ErrCode.STORAGE, `${name} 실패: ${error.message}`, error)
  return data
}

/**
 * 계정에 키가 저장돼 있는지 (키 자체는 주지 않음). 로그인 안 했거나 없으면 null.
 * @returns {Promise<null | {provider: string, modelLight: string, modelHeavy: string, updatedAt: number, lockedSeconds: number}>}
 */
export async function getAccountKeyInfo() {
  if (!supabase || !getActiveUser()) return null
  const d = await rpc('get_user_key_info')
  if (!d) return null
  return {
    provider: d.provider,
    modelLight: d.model_light || '',
    modelHeavy: d.model_heavy || '',
    updatedAt: d.updated_at ? Date.parse(d.updated_at) : 0,
    lockedSeconds: d.locked_seconds || 0,
  }
}

/**
 * 잠가서 계정에 저장 (이미 있으면 덮어쓰고 틀린 횟수도 초기화)
 * @param {{provider: string, apiKey: string, modelLight?: string, modelHeavy?: string}} cfg
 * @param {string} password  API 키 비밀번호 (8자 이상)
 */
export async function saveKeyToAccount({ provider, apiKey, modelLight = '', modelHeavy = '' }, password) {
  const uid = requireLogin()
  if (!provider || provider === 'test' || !apiKey) throw new AppError(ErrCode.INVALID_ARG, '저장할 API 키가 없습니다')
  checkPassword(password)
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const iterations = keyVaultOptions.iterations
  const { encKey, auth } = await deriveKeys(password, salt, iterations)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(uid) }, encKey, encoder.encode(apiKey))
  await rpc('save_user_key', {
    p_provider: provider,
    p_model_light: modelLight,
    p_model_heavy: modelHeavy,
    p_ciphertext: toB64(ciphertext),
    p_iv: toB64(iv),
    p_salt: toB64(salt),
    p_iterations: iterations,
    p_auth: auth,
  })
}

/**
 * 비밀번호로 풀어서 가져오기
 * @returns {Promise<{provider: string, apiKey: string, modelLight: string, modelHeavy: string}>}
 * @throws WRONG_PASSWORD (details.remaining) / LOCKED (details.retryAfter) / NOT_FOUND
 */
export async function unlockKeyFromAccount(password) {
  const uid = requireLogin()
  const info = await rpc('get_user_key_info')
  if (!info) throw new AppError(ErrCode.NOT_FOUND, '계정에 저장된 API 키가 없습니다')
  // 잠겨 있으면 느린 열쇠 계산을 하지 않고 바로 알려 준다 (서버도 어차피 거절함)
  if (info.locked_seconds > 0) throw new AppError(ErrCode.LOCKED, '잠김', null, { retryAfter: info.locked_seconds })

  const { encKey, auth } = await deriveKeys(password ?? '', fromB64(info.salt), info.iterations)
  const r = await rpc('unlock_user_key', { p_auth: auth })
  if (!r?.ok) {
    if (r?.reason === 'wrong') throw new AppError(ErrCode.WRONG_PASSWORD, '비밀번호 틀림', null, { remaining: r.remaining })
    if (r?.reason === 'locked') throw new AppError(ErrCode.LOCKED, '잠김', null, { retryAfter: r.retry_after })
    throw new AppError(ErrCode.NOT_FOUND, '계정에 저장된 API 키가 없습니다')
  }
  let apiKey
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(r.iv), additionalData: encoder.encode(uid) }, encKey, fromB64(r.ciphertext))
    apiKey = decoder.decode(plain)
  } catch (e) {
    // 확인용 값은 맞는데 안 풀리면 저장된 값이 깨졌거나 다른 계정 것 — 다시 저장해야 한다
    throw new AppError(ErrCode.PARSE, '저장된 키를 풀지 못했습니다. 키를 다시 저장해 주세요.', e)
  }
  return { provider: info.provider, apiKey, modelLight: info.model_light || '', modelHeavy: info.model_heavy || '' }
}

/** 비밀번호 바꾸기: 예전 비밀번호로 풀고 새 비밀번호로 다시 잠근다 */
export async function changeKeyPassword(oldPassword, newPassword) {
  checkPassword(newPassword)
  const saved = await unlockKeyFromAccount(oldPassword)
  await saveKeyToAccount(saved, newPassword)
}

/** 계정에서 키 지우기 (비밀번호를 잊었을 때) */
export async function deleteKeyFromAccount() {
  requireLogin()
  await rpc('delete_user_key')
}
