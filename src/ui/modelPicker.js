/*
 * modelPicker.js — 모델 목록에서 대화용 모델만 고르고, 저비용/고성능 기본값 추천
 * [담당: 곽수호]
 *
 * AI 회사의 모델 목록에는 음악(lyria)·그림(imagen)·음성(tts)·화면 조작(computer-use) 같은
 * 대화가 안 되는 모델도 섞여 있다. 이름 규칙으로 걸러 내고, 버전 숫자가 큰 순서로 정렬한다.
 * 모델 이름 규칙이 바뀌면 이 파일의 목록만 고치면 된다.
 */

/** 대화용 모델 이름의 시작 */
const CHAT_PREFIX = /^(gemini|gemma|gpt|chatgpt|o\d|claude)/i

/** 이름에 들어 있으면 대화용이 아닌 모델
 *  (codex·instruct: OpenAI의 chat/completions 로 부를 수 없는 모델) */
const NON_CHAT =
  /(image|imagen|tts|audio|speech|live|embed|computer-use|lyria|veo|transcribe|realtime|search|translate|moderation|whisper|dall-e|sora|omni|robotics|aqa|codex|instruct)/i

/** 정식 버전이 아닌 모델 (같은 버전이면 정식을 먼저 추천) */
const UNSTABLE = /(preview|exp|experimental)/i

export function isChatModel(id) {
  return CHAT_PREFIX.test(id) && !NON_CHAT.test(id)
}

/**
 * 이름에서 버전 숫자 뽑기 (비교용)
 *   gemini-3.8-flash → [3, 8]
 *   claude-sonnet-4-5-20250929 → [4, 5] (8자리 날짜는 버전이 아님)
 *   gpt-5.1-mini → [5, 1]
 *   gpt-5-mini-2025-08-07 → [5] (끝의 날짜는 버전이 아님)
 */
export function versionOf(id) {
  const nums = String(id)
    .replace(/^o(\d)/i, '$1') // o3-mini → 3-mini
    .split(/(preview|exp|latest)/i)[0] // "preview-09-2026" 같은 날짜는 버전이 아님
    .replace(/-\d{4}-\d{2}-\d{2}$|-\d{8}$/, '') // 끝에 붙은 날짜 (2025-08-07, 20250929)
    .replace(/\d+b\b/gi, '') // 모델 크기 (120b, 27b)
    .match(/\d+/g)
  // 4자리 이상은 날짜 같은 것이라 버전에서 뺀다
  return (nums || []).filter((n) => n.length < 4).slice(0, 3).map(Number)
}

/** 목록 뒤쪽에 둘 모델 (gemma: 쓸 수는 있지만 gemini 보다 약한 오픈 모델) */
const MINOR = /^gemma/i

function compareVersionDesc(a, b) {
  const ma = MINOR.test(a) ? 1 : 0
  const mb = MINOR.test(b) ? 1 : 0
  if (ma !== mb) return ma - mb
  const va = versionOf(a)
  const vb = versionOf(b)
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? 0) - (va[i] ?? 0)
    if (d) return d
  }
  // 같은 버전이면 정식 → 미리보기, 그다음 짧은 이름(날짜 없는 별칭) 먼저
  const ua = UNSTABLE.test(a) ? 1 : 0
  const ub = UNSTABLE.test(b) ? 1 : 0
  if (ua !== ub) return ua - ub
  return a.length - b.length || a.localeCompare(b)
}

/** 대화용 모델만, 최신 버전 순. 걸러서 하나도 안 남으면 원래 목록을 그대로 돌려준다. */
export function sortChatModels(list) {
  const chat = [...new Set(list)].filter(isChatModel).sort(compareVersionDesc)
  return chat.length ? chat : [...list]
}

/**
 * 이 회사에서 대화에 쓸 수 있는 모델만, 최신 순.
 * OpenAI의 pro 모델(gpt-5-pro, o3-pro …)은 chat/completions 로 부를 수 없어서 목록에서도 뺀다.
 */
export function chatModelsFor(provider, list) {
  const sorted = sortChatModels(list)
  if (provider !== 'openai') return sorted
  const usable = sorted.filter((m) => !/-pro\b/i.test(m))
  return usable.length ? usable : sorted
}

const has = (re) => (id) => re.test(id)

/**
 * 회사별 기본 추천
 *   Gemini : 저비용·고성능 모두 최신 flash (무료 키에서는 pro를 쓸 수 없기 때문)
 *   OpenAI : 저비용 최신 mini, 고성능 최신 일반 모델 (pro는 대화 API로 못 부르고 매우 비싸서 제외)
 *   Claude : 저비용 최신 haiku, 고성능 최신 sonnet (없으면 opus)
 * @returns {{light: string, heavy: string}}
 */
export function recommendModels(provider, list) {
  const sorted = chatModelsFor(provider, list)
  const first = (...tests) => {
    for (const t of tests) {
      const hit = sorted.find(t)
      if (hit) return hit
    }
    // 조건에 맞는 게 없으면 비싼 pro 가 아닌 첫 모델
    return sorted.find((m) => !/-pro\b/i.test(m)) || sorted[0] || ''
  }
  if (provider === 'gemini') {
    // gemma 는 목록에는 남기지만 추천은 flash 에서만
    const flash = first((m) => /^gemini.*flash/i.test(m) && !/lite/i.test(m), has(/^gemini.*flash/i))
    return { light: flash, heavy: flash }
  }
  if (provider === 'openai') {
    return {
      light: first((m) => /mini/i.test(m) && !/-pro/i.test(m)),
      heavy: first((m) => !/(mini|nano|-pro|oss)/i.test(m)),
    }
  }
  if (provider === 'claude') {
    return { light: first(has(/haiku/i)), heavy: first(has(/sonnet/i), has(/opus/i)) }
  }
  return { light: sorted[0] || '', heavy: sorted[0] || '' }
}
