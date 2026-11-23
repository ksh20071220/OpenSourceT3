/*
 * providers.js — AI 회사 목록
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 */
import data from '../assets/providers.json'

/** 키 없이 더미 답변을 내는 테스트 모드 (개발·발표 시연용). providers.json에는 넣지 않는다. */
export const TEST_PROVIDER = Object.freeze({
  id: 'test',
  name: '테스트 모드 (API 키 없이 더미 답변)',
  api: 'test',
  guide: ['API 키 없이 화면과 흐름을 확인하는 모드입니다. 답변은 미리 정해진 더미 문장입니다.'],
  note: '실제 AI는 호출하지 않으므로 요금이 나가지 않습니다.',
})

/** @returns {Array<object>} 실제 AI 회사 + 테스트 모드 */
export function listProviders() {
  return [...data.providers, TEST_PROVIDER]
}

export function getProvider(id) {
  return listProviders().find((p) => p.id === id) || null
}
