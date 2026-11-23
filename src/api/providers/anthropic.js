/*
 * anthropic.js — Claude (Messages API)
 * [담당: 오승민]
 *
 * 브라우저에서 직접 부르려면 'anthropic-dangerous-direct-browser-access' 헤더가 필요하다.
 * ("dangerous"는 회사 키를 브라우저에 넣으면 노출된다는 경고다. 우리는 사용자 본인 키(BYOK)라 해당 없음)
 */
import { AppError, ErrCode } from '../../common/errors.js'
import { request, requestJson, readSSE, tryJson } from '../http.js'
import { dedupe } from './openaiCompat.js'

const BASE = 'https://api.anthropic.com/v1/'
const MAX_TOKENS = 4096

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': cfg.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

/**
 * Claude는 user/assistant가 번갈아 나와야 하고 user로 시작해야 한다.
 * 중단·오류로 같은 역할이 연달아 저장된 기록도 보낼 수 있게 정리한다.
 */
export function normalizeMessages(messages) {
  const out = []
  for (const m of messages) {
    if (!m?.content) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) last.content += `\n\n${m.content}`
    else out.push({ role: m.role, content: m.content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

function body(cfg, model, extra) {
  const b = { model, max_tokens: MAX_TOKENS, ...extra }
  if (cfg.temperature !== null && cfg.temperature !== undefined) b.temperature = cfg.temperature
  return b
}

function textOf(j) {
  if (j?.stop_reason === 'refusal') throw new AppError(ErrCode.REFUSED, '답변 거절')
  return (j?.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('')
}

export const anthropic = {
  async chat({ cfg, model, system, messages, onChunk, signal }) {
    const res = await request(`${BASE}messages`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body(cfg, model, { system, messages: normalizeMessages(messages), stream: true })),
      signal,
    })
    let text = ''
    for await (const { event, data } of readSSE(res, signal)) {
      const j = tryJson(data)
      if (event === 'content_block_delta' && j?.delta?.type === 'text_delta') {
        text += j.delta.text
        onChunk?.(j.delta.text)
      } else if (event === 'message_delta' && j?.delta?.stop_reason === 'refusal' && !text) {
        throw new AppError(ErrCode.REFUSED, '답변 거절')
      } else if (event === 'error') {
        throw new AppError(ErrCode.API, j?.error?.message || '스트리밍 오류')
      }
    }
    return text
  },

  async complete({ cfg, model, system, prompt, json, signal }) {
    // Claude에는 JSON 모드 옵션 대신 지시문으로 요청하고, 받은 뒤 persona 쪽에서 JSON을 꺼낸다
    const sys = json ? `${system || ''}\n\n반드시 JSON 객체 하나만 출력한다. 설명이나 코드 블록 표시는 붙이지 않는다.` : system
    const j = await requestJson(`${BASE}messages`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body(cfg, model, { ...(sys ? { system: sys } : {}), messages: [{ role: 'user', content: prompt }] })),
      signal,
    })
    const text = textOf(j)
    if (!text) throw new AppError(ErrCode.PARSE, '빈 응답')
    return text
  },

  /** web_search 도구 사용. 콘솔에서 웹 검색을 켜 두어야 한다 (providers.json 안내 참고) */
  async search({ cfg, model, system, query, signal }) {
    const j = await requestJson(`${BASE}messages`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(
        body(cfg, model, {
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: query }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        }),
      ),
      signal,
    })
    const sources = []
    for (const block of j?.content || []) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === 'web_search_result') sources.push({ title: r.title || r.url, url: r.url })
      }
      if (block.type === 'text') {
        for (const c of block.citations || []) if (c.url) sources.push({ title: c.title || c.url, url: c.url })
      }
    }
    // TODO(오승민): stop_reason이 'pause_turn'이면 이어서 요청해 검색을 마저 끝내기
    return { text: textOf(j), sources: dedupe(sources) }
  },

  async listModels(cfg) {
    const j = await requestJson(`${BASE}models?limit=100`, { headers: headers(cfg) })
    return (j?.data || []).map((m) => m.id).filter(Boolean)
  },
}
