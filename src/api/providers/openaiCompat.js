/*
 * openaiCompat.js — OpenAI 호환(chat/completions) 방식: OpenAI, Gemini
 * [담당: 오승민]
 *
 * 웹 검색은 회사마다 방식이 달라서 따로 처리한다.
 *   - OpenAI : Responses API + web_search 도구
 *   - Gemini : Gemini 기본 API(generateContent) + google_search 도구
 *
 * 모든 provider 파일은 같은 모양의 객체를 내보낸다: { chat, complete, search, listModels }
 */
import { AppError, ErrCode } from '../../common/errors.js'
import { getProvider } from '../../common/providers.js'
import { request, requestJson, readSSE, tryJson } from '../http.js'

function base(cfg) {
  const p = getProvider(cfg.provider)
  if (!p?.base_url) throw new AppError(ErrCode.NOT_CONFIGURED, '알 수 없는 AI 회사')
  return p.base_url
}

function headers(cfg) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` }
}

/** Gemini의 모델 목록은 "models/gemini-..." 형태라 앞부분을 뗀다 */
function cleanModel(id) {
  return String(id || '').replace(/^models\//, '')
}

function body(cfg, model, messages, extra = {}) {
  const b = { model: cleanModel(model), messages, ...extra }
  if (cfg.temperature !== null && cfg.temperature !== undefined) b.temperature = cfg.temperature
  return b
}

export const openaiCompat = {
  /** 스트리밍 대화. 조각이 올 때마다 onChunk(조각), 끝나면 전체 텍스트 반환 */
  async chat({ cfg, model, system, messages, onChunk, signal }) {
    const res = await request(`${base(cfg)}chat/completions`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body(cfg, model, [{ role: 'system', content: system }, ...messages], { stream: true })),
      signal,
    })
    let text = ''
    let finish = null
    for await (const { data } of readSSE(res, signal)) {
      if (data === '[DONE]') break
      const j = tryJson(data)
      const choice = j?.choices?.[0]
      const piece = choice?.delta?.content
      if (piece) {
        text += piece
        onChunk?.(piece)
      }
      if (choice?.finish_reason) finish = choice.finish_reason
    }
    if (!text && finish === 'content_filter') throw new AppError(ErrCode.REFUSED, '안전 필터로 답변이 차단됨')
    return text
  },

  /** 한 번에 받는 호출. json=true면 JSON 객체만 돌려 달라고 요청 */
  async complete({ cfg, model, system, prompt, json, signal }) {
    const messages = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }]
    const extra = json ? { response_format: { type: 'json_object' } } : {}
    const j = await requestJson(`${base(cfg)}chat/completions`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body(cfg, model, messages, extra)),
      signal,
    })
    const choice = j?.choices?.[0]
    const text = choice?.message?.content
    if (!text) {
      if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal)
        throw new AppError(ErrCode.REFUSED, choice?.message?.refusal || '답변 거절')
      throw new AppError(ErrCode.PARSE, '빈 응답')
    }
    return text
  },

  /** 웹 검색 + 정리. @returns {{text: string, sources: Array<{title, url}>}} */
  async search({ cfg, model, system, query, signal }) {
    if (cfg.provider === 'gemini') return geminiSearch({ cfg, model, system, query, signal })
    // OpenAI: Responses API의 web_search 도구
    const j = await requestJson(`${base(cfg)}responses`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({
        model: cleanModel(model),
        instructions: system,
        input: query,
        tools: [{ type: 'web_search' }],
      }),
      signal,
    })
    const texts = []
    const sources = []
    for (const item of j?.output || []) {
      if (item.type !== 'message') continue
      for (const c of item.content || []) {
        if (c.type === 'output_text') {
          texts.push(c.text)
          for (const a of c.annotations || []) {
            if (a.type === 'url_citation') sources.push({ title: a.title || a.url, url: a.url })
          }
        } else if (c.type === 'refusal') {
          throw new AppError(ErrCode.REFUSED, c.refusal)
        }
      }
    }
    return { text: texts.join('\n'), sources: dedupe(sources) }
  },

  async listModels(cfg) {
    const j = await requestJson(`${base(cfg)}models`, { headers: headers(cfg) })
    return (j?.data || []).map((m) => cleanModel(m.id)).filter(Boolean)
  },
}

async function geminiSearch({ cfg, model, system, query, signal }) {
  const p = getProvider('gemini')
  const url = `${p.native_url}models/${encodeURIComponent(cleanModel(model))}:generateContent`
  const j = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    }),
    signal,
  })
  const cand = j?.candidates?.[0]
  if (!cand) throw new AppError(ErrCode.REFUSED, j?.promptFeedback?.blockReason || '빈 응답')
  const text = (cand.content?.parts || []).map((x) => x.text || '').join('')
  const sources = (cand.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ title: w.title || w.uri, url: w.uri }))
  return { text, sources: dedupe(sources) }
}

export function dedupe(sources) {
  const seen = new Set()
  return sources.filter((s) => s?.url && !seen.has(s.url) && seen.add(s.url))
}
