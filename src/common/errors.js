/*
 * errors.js — 오류 코드와 사용자용 메시지
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * 모든 모듈은 실패하면 AppError를 던진다(throw).
 * 화면(ui)은 try/catch로 잡아서 errorMessage(err)로 한국어 안내를 보여 주면 된다.
 */

export const ErrCode = Object.freeze({
  INVALID_ARG: 'INVALID_ARG', // 잘못된 입력 (빈 이름, 모델 미설정 등)
  NOT_CONFIGURED: 'NOT_CONFIGURED', // AI 연결(키·모델)이 아직 안 됨
  AUTH: 'AUTH', // API 키가 틀림 / 권한 없음
  QUOTA: 'QUOTA', // 사용량 초과, 크레딧 부족
  NETWORK: 'NETWORK', // 인터넷 연결 문제
  API: 'API', // AI 회사 서버가 오류를 돌려줌
  REFUSED: 'REFUSED', // 모델이 답변을 거절함
  PARSE: 'PARSE', // JSON 형식이 깨짐
  NOT_FOUND: 'NOT_FOUND', // 캐릭터·기록이 없음
  STORAGE: 'STORAGE', // 브라우저 저장소·계정 저장 실패
  CANCELLED: 'CANCELLED', // 사용자가 중단함
  UNKNOWN: 'UNKNOWN',
})

export class AppError extends Error {
  /**
   * @param {string} code    ErrCode 값
   * @param {string} message 개발자용 상세 메시지 (화면에는 errorMessage()를 쓴다)
   * @param {unknown} [cause] 원래 오류
   */
  constructor(code, message, cause) {
    super(message || code)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

const MESSAGES = {
  INVALID_ARG: '입력한 내용을 다시 확인해 주세요.',
  NOT_CONFIGURED: 'AI 연결이 아직 안 되어 있어요. 설정에서 API 키와 모델을 먼저 입력해 주세요.',
  AUTH: 'API 키가 올바르지 않거나 권한이 없어요. 설정에서 키를 다시 확인해 주세요.',
  QUOTA: '사용량 한도를 넘었거나 크레딧이 부족해요. AI 회사 사이트에서 결제·사용량을 확인해 주세요.',
  NETWORK: '인터넷 연결을 확인해 주세요.',
  API: 'AI 서버에서 오류가 났어요. 잠시 후 다시 시도해 주세요.',
  REFUSED: '모델이 이 요청에 답하지 않았어요.',
  PARSE: '응답 형식을 읽지 못했어요. 다시 시도해 주세요.',
  NOT_FOUND: '찾을 수 없어요.',
  STORAGE: '저장하지 못했어요. 브라우저 저장 공간이나 로그인 상태를 확인해 주세요.',
  CANCELLED: '중단했어요.',
  UNKNOWN: '알 수 없는 오류가 났어요.',
}

/** 화면에 보여 줄 한국어 메시지. AppError가 아니어도 받는다. */
export function errorMessage(err) {
  if (err instanceof AppError) {
    const base = MESSAGES[err.code] || MESSAGES.UNKNOWN
    // API 오류는 서버가 준 설명이 도움이 되므로 덧붙인다
    if ((err.code === ErrCode.API || err.code === ErrCode.INVALID_ARG) && err.message && err.message !== err.code) {
      return `${base} (${err.message})`
    }
    return base
  }
  return MESSAGES.UNKNOWN
}

/** fetch를 중단(AbortController)했을 때 나는 오류인지 */
export function isAbortError(err) {
  return err?.name === 'AbortError' || (err instanceof AppError && err.code === ErrCode.CANCELLED)
}
