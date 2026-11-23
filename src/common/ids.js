/*
 * ids.js — ID 만들기
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 캐릭터 ID는 영문 소문자·숫자·_ 만 쓴다 (docs/persona-schema.md 규칙).
 */

export function newId(prefix = 'char') {
  const rand =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ||
    Math.random().toString(36).slice(2, 14)
  return `${prefix}_${rand}`.toLowerCase()
}

export function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9_]{1,63}$/.test(id)
}
