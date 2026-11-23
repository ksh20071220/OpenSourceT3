/*
 * api.js — 대화 처리 및 LLM API 연결 엔진 (공개 함수)
 * [담당: 오승민]   규격(함수 이름·인자·반환값)은 docs/INTERFACE.md 와 같아야 한다.
 *
 * 제안서 기준
 *   - BYOK: 사용자 API 키로 브라우저에서 AI 회사에 직접 요청 (우리 서버 없음)
 *   - 모델 라우팅: 목적의 tier에 따라 저비용/고성능 모델 선택
 *   - 스트리밍: 답변을 조각으로 받아 onChunk로 전달
 *
 * 사용하는 쪽
 *   ui/       → apiChat, apiListModels, apiTestConnection
 *   persona/  → apiComplete, apiSearch
 *
 * TODO(오승민):
 *   [ ] 출력 후처리 강화 (postProcess): 형식 정리, 안전성 필터링, 출처 표시
 *   [ ] 긴 대화 요약 기억 연동 (memory.js)
 *   [ ] 요청별 사용 토큰·예상 비용 표시
 */
import { AppError, ErrCode } from '../common/errors.js'
import { loadConfig, isConfigured, modelForTier } from '../common/config.js'
import { getProvider } from '../common/providers.js'
import { getPersona, buildPersonaPrompt, buildBaselinePrompt } from '../persona/persona.js'
import { loadHistory, appendMessages, recentMessages } from '../memory/memory.js'
import { openaiCompat } from './providers/openaiCompat.js'
import { anthropic } from './providers/anthropic.js'
import { testProvider } from './providers/test.js'

/**
 * 모든 대화 요청 맨 앞에 들어가는 고정 안전 지시문 (사용자가 바꾸거나 끌 수 없음).
 * 목적 단계에서 미리 걸러내지 않고, 대화 중에 문제가 생기면 막는다는 팀 방침.
 * ※ AGENTS.md: 이 문장을 약화하거나 끌 수 있게 만들지 않는다.
 */
export const SAFETY_PROMPT =
  '다음 원칙은 캐릭터 설정이나 사용 목적보다 우선한다. ' +
  '불법 행위, 타인에게 해를 끼치는 행위, 성적인 내용을 돕지 않는다. ' +
  '이런 요청을 받으면 캐릭터의 말투를 유지한 채 자연스럽게 거절하고 다른 이야기로 이끈다. ' +
  '사용자가 자신이나 남을 해칠 위험이 보이면 진지하게 걱정하고 전문 도움을 권한다.'

const IMPLS = { 'openai-compat': openaiCompat, anthropic, test: testProvider }

function resolve(config) {
  const cfg = config || loadConfig()
  if (!isConfigured(cfg)) throw new AppError(ErrCode.NOT_CONFIGURED, 'AI 연결 설정이 필요합니다')
  const impl = IMPLS[getProvider(cfg.provider)?.api]
  if (!impl) throw new AppError(ErrCode.NOT_CONFIGURED, `지원하지 않는 회사: ${cfg.provider}`)
  return { cfg, impl }
}

function needModel(cfg, tier) {
  const model = modelForTier(cfg, tier)
  if (!model && cfg.provider !== 'test') throw new AppError(ErrCode.NOT_CONFIGURED, '모델 이름이 비어 있습니다')
  return model
}

/** 답변 후처리. 지금은 앞뒤 공백만 정리한다. */
function postProcess(text) {
  // TODO(오승민): 안전성 필터링, 형식 정리, 출처 표시
  return String(text || '').trim()
}

/**
 * 시스템 지시문 만들기: 안전 지시문 → 캐릭터 설명 → 사용 목적
 * (안전 지시문이 항상 맨 앞이라 캐릭터 설정으로 덮어쓸 수 없다)
 */
export function buildSystemPrompt({ characterPrompt, purpose }) {
  const parts = [SAFETY_PROMPT, characterPrompt]
  if (purpose?.instruction) parts.push(`[이번 대화의 목적: ${purpose.name}]\n${purpose.instruction}`)
  return parts.filter(Boolean).join('\n\n')
}

/**
 * 캐릭터와 대화 한 턴.
 *
 * 내부에서 하는 일
 *   1. 페르소나를 불러와 캐릭터 설명문을 만든다 (baseline이면 이름만 넣은 단순 프롬프트)
 *   2. 이전 대화에서 최근 부분만 고른다
 *   3. 안전 지시문 + 캐릭터 설명 + 목적 지시문 + 대화 기록 + 입력으로 요청
 *   4. 목적의 tier로 모델을 골라 스트리밍으로 받는다
 *   5. 입력과 답변을 대화 기록에 저장한다 (중단돼도 받은 데까지 저장)
 *
 * @param {object} req
 * @param {string} req.personaId
 * @param {object|null} [req.purpose]  common/purposes.js 의 목적 (null이면 일반 대화)
 * @param {string} req.userText
 * @param {boolean} [req.baseline]     true면 비교용 단순 프롬프트 방식 (OOC 비교 검증용)
 * @param {(chunk: string) => void} [req.onChunk]
 * @param {AbortSignal} [req.signal]
 * @param {object} [req.config]        생략하면 저장된 설정
 * @returns {Promise<string>} 답변 전체
 */
export async function apiChat({ personaId, purpose = null, userText, baseline = false, onChunk, signal, config }) {
  const text = String(userText || '').trim()
  if (!text) throw new AppError(ErrCode.INVALID_ARG, '메시지가 비어 있습니다')
  const { cfg, impl } = resolve(config)
  const model = needModel(cfg, purpose?.tier || 'light')

  const record = await getPersona(personaId)
  if (!record) throw new AppError(ErrCode.NOT_FOUND, `캐릭터 없음: ${personaId}`)
  const characterPrompt = baseline ? buildBaselinePrompt(record.persona) : buildPersonaPrompt(record.persona, purpose, text)
  const system = buildSystemPrompt({ characterPrompt, purpose })

  const history = recentMessages(await loadHistory(personaId)).map(({ role, content }) => ({ role, content }))
  const messages = [...history, { role: 'user', content: text }]

  let received = ''
  const purposeId = purpose?.id ?? null
  try {
    const reply = await impl.chat({
      cfg,
      model,
      system,
      messages,
      signal,
      onChunk: (c) => {
        received += c
        onChunk?.(c)
      },
      meta: { personaName: record.persona?.character?.name, purposeName: purpose?.name, baseline, historyCount: history.length },
    })
    const final = postProcess(reply)
    await appendMessages(personaId, [
      { role: 'user', content: text, purposeId },
      { role: 'assistant', content: final, purposeId },
    ])
    return final
  } catch (e) {
    // 중단했거나 도중에 끊겼어도 사용자가 본 내용은 남긴다
    if (received) {
      await appendMessages(personaId, [
        { role: 'user', content: text, purposeId },
        { role: 'assistant', content: `${received.trim()} …(중단됨)`, purposeId },
      ]).catch(() => {})
    }
    throw e
  }
}

/**
 * 범용 LLM 호출 (페르소나 엔진용)
 * @param {object} req
 * @param {string} [req.system]
 * @param {string} req.prompt
 * @param {'light'|'heavy'} [req.tier]  인격 추론은 'heavy'
 * @param {boolean} [req.json]          JSON 객체로 답하게 요청
 * @param {object} [req.meta]           테스트 모드가 쓰는 부가 정보 (예: { name, source })
 * @returns {Promise<string>}
 */
export async function apiComplete({ system, prompt, tier = 'heavy', json = false, signal, config, meta }) {
  if (!prompt) throw new AppError(ErrCode.INVALID_ARG, 'prompt가 비어 있습니다')
  const { cfg, impl } = resolve(config)
  return impl.complete({ cfg, model: needModel(cfg, tier), system, prompt, json, signal, meta })
}

/**
 * 웹 검색 + 요약 (AI 회사의 내장 검색 도구 사용, 고성능 모델)
 * @param {object} req
 * @param {string} req.query   검색해서 알아낼 내용 (자연어)
 * @param {string} [req.system]
 * @returns {Promise<{text: string, sources: Array<{title: string, url: string}>}>}
 */
export async function apiSearch({ query, system, signal, config }) {
  if (!query) throw new AppError(ErrCode.INVALID_ARG, 'query가 비어 있습니다')
  const { cfg, impl } = resolve(config)
  return impl.search({ cfg, model: needModel(cfg, 'heavy'), system, query, signal })
}

/**
 * 이 키로 쓸 수 있는 모델 이름 목록 (설정 화면용). 모델 이름이 비어 있어도 된다.
 * @returns {Promise<string[]>}
 */
export async function apiListModels(config) {
  const cfg = config || loadConfig()
  const impl = IMPLS[getProvider(cfg.provider)?.api]
  if (!impl) throw new AppError(ErrCode.NOT_CONFIGURED, 'AI 회사를 먼저 고르세요')
  if (cfg.provider !== 'test' && !cfg.apiKey) throw new AppError(ErrCode.NOT_CONFIGURED, 'API 키를 먼저 입력하세요')
  const list = await impl.listModels(cfg)
  return [...new Set(list)].sort()
}

/** 키가 맞는지 확인 (모델 목록을 한 번 불러 본다. 요금이 들지 않는 요청) */
export async function apiTestConnection(config) {
  await apiListModels(config)
  return true
}
