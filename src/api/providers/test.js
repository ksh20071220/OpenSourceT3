/*
 * test.js — 테스트 모드: 실제 AI를 부르지 않고 더미 답변을 돌려준다
 * [담당: 오승민]
 *
 * 화면 개발, 자동 테스트, 발표 시연(인터넷·키 없이)에 쓴다.
 */
import { AppError, ErrCode } from '../../common/errors.js'

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AppError(ErrCode.CANCELLED, '요청 중단'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener?.('abort', () => {
      clearTimeout(t)
      reject(new AppError(ErrCode.CANCELLED, '요청 중단'))
    }, { once: true })
  })
}

/** 테스트에서 지연을 없애고 싶을 때 0으로 */
export const testOptions = { chunkDelayMs: 25 }

function dummyPersona(name, source) {
  return {
    schema_version: '1.1',
    character: { name: name || '이름 없음', source: source || '자체 창작', setting_version: '테스트 모드 생성' },
    personality: {
      traits: [{ name: '호기심', strength: 0.7, confidence: 'low', basis: 'inferred', evidence_ids: ['E001'] }],
      values: ['새로운 것을 배우는 즐거움'],
      speech_style: { tone: '밝고 친근함', formality: 'informal', expressiveness: 'medium', sample_lines: ['오, 그거 재밌겠다!'] },
    },
    evidence: [
      { id: 'E001', type: 'description', observation: '테스트 모드에서 만든 더미 근거', source: '테스트 모드', reliability: 'low' },
    ],
    behavior_rules: [
      { condition: '모르는 것을 물어볼 때', priority: 'medium', response: '솔직하게 모른다고 말하고 함께 찾아본다', evidence_ids: ['E001'] },
    ],
    expertise: { strengths: ['대화'], limitations: ['테스트용이라 실제 지식 없음'] },
    uncertainties: [{ question: '실제 성격은?', status: 'unresolved' }],
  }
}

export const testProvider = {
  async chat({ onChunk, signal, meta = {} }) {
    const text =
      `[더미 답변] 나는 ${meta.personaName || '캐릭터'}. 지금은 테스트 모드라서 정해진 답을 하고 있어. ` +
      `(목적: ${meta.purposeName || '일반 대화'} / ${meta.baseline ? '비교용 단순 프롬프트' : '페르소나 적용'} / 이전 대화 ${meta.historyCount ?? 0}개 참고)`
    let out = ''
    for (const piece of text.match(/.{1,6}/gsu) || []) {
      if (testOptions.chunkDelayMs) await sleep(testOptions.chunkDelayMs, signal)
      else if (signal?.aborted) throw new AppError(ErrCode.CANCELLED, '요청 중단')
      out += piece
      onChunk?.(piece)
    }
    return out
  },

  async complete({ json, signal, meta = {} }) {
    if (testOptions.chunkDelayMs) await sleep(testOptions.chunkDelayMs * 4, signal)
    if (json) return JSON.stringify(dummyPersona(meta.name, meta.source))
    return '[더미 응답] 테스트 모드입니다.'
  },

  async search({ query, signal }) {
    if (testOptions.chunkDelayMs) await sleep(testOptions.chunkDelayMs * 4, signal)
    return {
      text: `[더미 검색 결과] "${query}"에 대한 자료를 찾은 것처럼 보여 주는 테스트 문장입니다.`,
      sources: [{ title: '테스트 출처', url: 'https://example.com/' }],
    }
  },

  async listModels() {
    return ['test-light', 'test-heavy']
  },
}
