/*
 * http.js — fetch 공통 처리 (오류 코드 변환, 스트리밍 읽기)
 * [담당: 오승민]
 */
import { AppError, ErrCode } from '../common/errors.js'

/** 서버가 준 오류 JSON에서 사람이 읽을 메시지 꺼내기 (회사마다 모양이 조금씩 다름) */
function extractMessage(body) {
  if (!body) return ''
  const b = Array.isArray(body) ? body[0] : body // Gemini는 배열로 줄 때가 있다
  return b?.error?.message || b?.message || (typeof b === 'string' ? b.slice(0, 300) : '')
}

/** HTTP 상태 코드 → ErrCode */
export function statusToCode(status) {
  if (status === 401 || status === 403) return ErrCode.AUTH
  if (status === 402 || status === 429) return ErrCode.QUOTA
  return ErrCode.API
}

/**
 * fetch + 오류 변환. 성공하면 Response를 그대로 돌려준다.
 * 실패하면 AppError를 던진다: 네트워크 → NETWORK, 중단 → CANCELLED, HTTP 오류 → statusToCode
 */
export async function request(url, { signal, ...init } = {}) {
  let res
  try {
    res = await fetch(url, { ...init, signal })
  } catch (e) {
    if (e?.name === 'AbortError') throw new AppError(ErrCode.CANCELLED, '요청 중단', e)
    // 브라우저는 CORS 차단도 네트워크 오류(TypeError)로 보여 준다
    throw new AppError(ErrCode.NETWORK, '서버에 연결하지 못했습니다', e)
  }
  if (!res.ok) {
    let body = null
    try {
      const text = await res.text()
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    } catch {
      /* 본문 읽기 실패 무시 */
    }
    const msg = extractMessage(body) || `HTTP ${res.status}`
    throw new AppError(statusToCode(res.status), msg)
  }
  return res
}

/** request() 후 JSON으로 읽기 */
export async function requestJson(url, init) {
  const res = await request(url, init)
  try {
    return await res.json()
  } catch (e) {
    throw new AppError(ErrCode.PARSE, '응답 JSON을 읽지 못했습니다', e)
  }
}

/**
 * Server-Sent Events(스트리밍 응답) 읽기.
 * 서버는 "event: 이름\ndata: 내용\n\n" 덩어리를 조금씩 보내 준다. 덩어리 하나마다 { event, data }를 내보낸다.
 * @param {Response} res
 * @param {AbortSignal} [signal]
 */
export async function* readSSE(res, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      if (signal?.aborted) throw new AppError(ErrCode.CANCELLED, '요청 중단')
      let chunk
      try {
        chunk = await reader.read()
      } catch (e) {
        if (e?.name === 'AbortError' || signal?.aborted) throw new AppError(ErrCode.CANCELLED, '요청 중단', e)
        throw new AppError(ErrCode.NETWORK, '응답을 받는 중 연결이 끊겼습니다', e)
      }
      if (chunk.done) break
      buf += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n')
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const ev = parseBlock(block)
        if (ev) yield ev
      }
    }
    const ev = parseBlock(buf + decoder.decode())
    if (ev) yield ev
  } finally {
    reader.releaseLock?.()
  }
}

function parseBlock(block) {
  let event = 'message'
  const data = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  return data.length ? { event, data: data.join('\n') } : null
}

/** JSON.parse 실패하면 null */
export function tryJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
