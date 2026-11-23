/*
 * generate.js — AI로 페르소나 만들기
 * [담당: 손석현]
 *
 * 제안서 흐름 (검색으로 만들기)
 *   1. 웹 검색으로 공식 설정·성격 묘사·대사·작중 행적 수집 (출처와 출처 종류 기록)
 *   2. 고성능 모델로 근거의 신뢰도를 매기고 인격을 추론 → 페르소나 JSON
 *   3. 형식 검사 → 틀리면 오류를 알려 주고 한 번 더 고치게 함
 *
 * 설정 글로 만들기는 1번 대신 사용자가 쓴 설정 글을 근거로 쓴다.
 *
 * TODO(손석현):
 *   [ ] 검색을 주제별로 여러 번 (설정 / 대사 / 행적) 나눠서 자료를 더 모으기
 *   [ ] 같은 내용을 말하는 근거 합치기(중복 제거), 서로 모순되는 근거 표시
 *   [ ] 참고 자료 캐시 (같은 캐릭터를 다시 만들 때 검색 생략)
 */
import { AppError, ErrCode } from '../common/errors.js'
import { apiComplete, apiSearch } from '../api/api.js'
import { SCHEMA_VERSION, validatePersona } from './schema.js'

const SEARCH_SYSTEM = [
  '너는 캐릭터 자료 조사원이다. 웹 검색으로 요청한 캐릭터의 자료를 찾아 한국어로 정리한다.',
  '찾을 것: 공식 설정(나이·직업·배경), 성격 묘사, 가치관, 말투와 대표 대사, 작중 행적(어떤 상황에서 어떻게 행동했는지), 잘하는 분야와 못하는 분야.',
  '각 내용마다 출처 이름, URL, 출처 종류(공식 / 위키 / 기사 / 커뮤니티)를 적는다.',
  '팬들의 추측이나 해석은 "추측"이라고 표시한다. 찾지 못한 내용은 지어내지 말고 "찾지 못함"이라고 적는다.',
].join('\n')

const SCHEMA_GUIDE = `출력 JSON 형식 (schema_version "${SCHEMA_VERSION}"):
{
  "schema_version": "${SCHEMA_VERSION}",
  "character": { "name": 이름, "source": 작품명 또는 "자체 창작", "setting_version": 어떤 설정 기준인지 },
  "personality": {
    "traits": [ { "name": 성격 특성, "strength": 0~1, "confidence": "low"|"medium"|"high", "basis": "explicit"|"inferred", "evidence_ids": ["E001"] } ],
    "values": [ 가치관 ],
    "speech_style": { "tone": 말투 설명, "formality": "formal"|"informal", "expressiveness": "low"|"medium"|"high", "sample_lines": [ 말투를 보여 주는 대사 2~4개 ] }
  },
  "evidence": [ { "id": "E001", "type": "scene"|"description", "situation": 상황(scene), "action": 행동(scene), "observation": 설명(description), "source": 출처 이름, "url": 출처 주소(있으면), "reliability": "low"|"medium"|"high" } ],
  "behavior_rules": [ { "condition": 어떤 상황에서, "priority": "low"|"medium"|"high", "response": 어떻게 행동하는지, "exception": 예외(있으면), "evidence_ids": ["E001"] } ],
  "expertise": { "strengths": [ 잘하는 분야 ], "limitations": [ 못하는 분야 ] },
  "uncertainties": [ { "question": 자료로 확인 못 한 점, "status": "unresolved"|"inferred" } ]
}`

const INFER_RULES = `규칙:
- 근거(evidence)마다 신뢰도를 매긴다: 공식 자료·원작 장면 = high, 위키·기사 = medium, 커뮤니티 추측 = low.
- 자료에 직접 나온 특성은 basis "explicit", 자료를 바탕으로 추론한 특성은 "inferred"로 표시하고 confidence를 낮춘다.
- 근거끼리 모순되면 신뢰도가 높은 쪽을 따르고, 모순 자체는 uncertainties 에 적는다.
- 행동 원칙(behavior_rules)은 "어떤 상황에서 어떻게 행동하는가"를 3~8개 만든다. 대화 중 새로운 상황에서도 판단할 수 있게 구체적으로.
- 자료로 확인할 수 없는 중요한 부분은 지어내지 말고 uncertainties 에 남긴다.
- 모든 문장은 한국어로 쓴다. 대사(sample_lines)는 원작 언어 그대로가 아니라 한국어로 자연스럽게 쓴다.
- JSON 객체 하나만 출력한다.`

const INFER_SYSTEM = `너는 캐릭터 인격 분석가다. 주어진 자료만 근거로 캐릭터의 성격, 가치관, 말투, 상황별 행동 원칙을 추론해 페르소나 JSON을 만든다.\n\n${SCHEMA_GUIDE}\n\n${INFER_RULES}`

/** 모델 답변에서 JSON 객체 꺼내기 (```json 코드 블록이나 앞뒤 설명이 붙어 와도) */
export function extractJson(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AppError(ErrCode.PARSE, 'JSON을 찾지 못했습니다')
  try {
    return JSON.parse(s.slice(start, end + 1))
  } catch (e) {
    throw new AppError(ErrCode.PARSE, 'JSON 형식이 깨졌습니다', e)
  }
}

/** 입력값으로 이름·작품명을 고정하고 빠진 기본 필드 채우기 */
function finalize(p, { name, source }) {
  p.schema_version = SCHEMA_VERSION
  p.character = { ...(p.character || {}) }
  if (name) p.character.name = name
  if (source) p.character.source = source
  if (!p.character.source) p.character.source = '알 수 없음'
  return p
}

/** 추론 → 검사 → (틀리면 한 번 고치기) */
async function inferAndValidate({ prompt, name, source, signal, onProgress }) {
  onProgress?.({ percent: 45, step: '인격 추론 중 (고성능 모델)' })
  const meta = { name, source }
  let persona = finalize(extractJson(await apiComplete({ system: INFER_SYSTEM, prompt, tier: 'heavy', json: true, signal, meta })), meta)

  onProgress?.({ percent: 85, step: '형식 검사 중' })
  let check = validatePersona(persona)
  if (!check.ok) {
    onProgress?.({ percent: 88, step: '형식 오류 고치는 중' })
    const fixPrompt =
      `아래 페르소나 JSON에 형식 오류가 있다. 오류를 고친 JSON 객체 하나만 다시 출력해라.\n\n` +
      `[오류]\n${check.errors.map((e) => `- ${e}`).join('\n')}\n\n[JSON]\n${JSON.stringify(persona)}`
    persona = finalize(extractJson(await apiComplete({ system: INFER_SYSTEM, prompt: fixPrompt, tier: 'heavy', json: true, signal, meta })), meta)
    check = validatePersona(persona)
    if (!check.ok) throw new AppError(ErrCode.PARSE, `페르소나 형식 오류: ${check.errors.join(', ')}`)
  }
  return persona
}

/**
 * 검색으로 만들기 (제안서 핵심 기능)
 * @param {object} req
 * @param {string} req.name       캐릭터 이름
 * @param {string} [req.source]   작품명 (모르면 비움)
 * @param {string} [req.keywords] 추가 키워드·설정
 * @param {(p: {percent: number, step: string}) => void} [req.onProgress]
 * @param {AbortSignal} [req.signal]
 * @returns {Promise<{persona: object, sources: Array<{title, url}>}>}
 */
export async function generateFromSearch({ name, source = '', keywords = '', onProgress, signal }) {
  const n = String(name || '').trim()
  if (!n) throw new AppError(ErrCode.INVALID_ARG, '캐릭터 이름을 입력하세요')
  onProgress?.({ percent: 10, step: '웹에서 자료 검색 중' })
  const query =
    `캐릭터: ${n}\n작품: ${source || '(모름 — 이름으로 찾아서 어떤 작품인지도 알려 줘)'}\n` +
    `추가 키워드: ${keywords || '없음'}\n\n이 캐릭터의 자료를 조사해서 정리해 줘.`
  const research = await apiSearch({ query, system: SEARCH_SYSTEM, signal })
  if (!research.text) throw new AppError(ErrCode.API, '검색 결과가 비어 있습니다')

  const sourceList = research.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n')
  const prompt =
    `캐릭터 이름: ${n}\n작품명: ${source || '(자료에서 확인)'}\n사용자가 추가로 준 키워드: ${keywords || '없음'}\n\n` +
    `[조사 자료]\n${research.text}\n\n[출처 목록]\n${sourceList || '(출처 정보 없음)'}\n\n위 자료로 페르소나 JSON을 만들어라.`
  const persona = await inferAndValidate({ prompt, name: n, source, signal, onProgress })
  return { persona, sources: research.sources }
}

/**
 * 설정 글로 만들기 (자체 창작 캐릭터)
 * @param {object} req
 * @param {string} req.name
 * @param {string} [req.source]  비우면 "자체 창작"
 * @param {string} req.text      사용자가 쓴 설정 글
 */
export async function generateFromText({ name, source = '', text, onProgress, signal }) {
  const n = String(name || '').trim()
  const t = String(text || '').trim()
  if (!n) throw new AppError(ErrCode.INVALID_ARG, '캐릭터 이름을 입력하세요')
  if (t.length < 10) throw new AppError(ErrCode.INVALID_ARG, '설정 글을 조금 더 자세히 써 주세요 (10자 이상)')
  const src = source.trim() || '자체 창작'
  onProgress?.({ percent: 15, step: '설정 글 읽는 중' })
  const prompt =
    `캐릭터 이름: ${n}\n작품명: ${src}\n\n[사용자가 쓴 설정 글 — 이 캐릭터의 공식 설정으로 취급한다]\n${t}\n\n` +
    `위 설정 글을 근거로 페르소나 JSON을 만들어라. 설정 글에 직접 나온 내용은 출처 "사용자 설정 글", 신뢰도 high로 기록한다.`
  const persona = await inferAndValidate({ prompt, name: n, source: src, signal, onProgress })
  return { persona, sources: [] }
}
