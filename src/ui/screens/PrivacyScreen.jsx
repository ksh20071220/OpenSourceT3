/*
 * PrivacyScreen.jsx — 개인정보 처리방침
 * [담당: 곽수호]   내용 수정은 팀 합의 후 (수업 프로젝트용 초안)
 */
import { Page, PageHeader } from '../components/Layout.jsx'

const ITEMS = [
  ['운영 주체', 'OpenSourceT3는 수업 과제로 만든 비영리 오픈소스 프로젝트입니다 (1반 3팀).'],
  [
    '로그인하지 않는 경우',
    '캐릭터, 대화 기록, 설정, API 키는 모두 사용자의 브라우저에만 저장되며 우리 쪽 서버로 전송되지 않습니다.',
  ],
  [
    '로그인(Google)하는 경우 수집하는 정보',
    'Google 계정의 이메일, 이름, 프로필 사진 주소와, 사용자가 만든 캐릭터 및 대화 기록을 Supabase(데이터베이스 서비스)에 저장합니다. API 키는 저장하지 않습니다.',
  ],
  ['이용 목적', '다른 기기에서 같은 캐릭터와 대화 기록을 이어서 쓰게 하기 위해서만 사용합니다. 광고·분석·제3자 제공에 쓰지 않습니다.'],
  ['보관과 삭제', '설정 → 계정 → "계정에 저장된 데이터 전부 삭제"로 언제든 직접 지울 수 있습니다. 프로젝트가 끝나면 데이터베이스를 삭제합니다.'],
  [
    'AI 회사로 전송되는 정보',
    '대화할 때 입력한 내용과 캐릭터 설정은 사용자가 고른 AI 회사(OpenAI, Google, Anthropic)로 사용자 본인의 API 키를 통해 직접 전송되며, 각 회사의 개인정보 처리방침을 따릅니다. 민감한 개인정보는 입력하지 않는 것을 권장합니다.',
  ],
  ['문의', 'GitHub 저장소(ksh20071220/OpenSourceT3)의 Issues로 문의해 주세요.'],
]

export function PrivacyScreen() {
  return (
    <Page>
      <PageHeader title="개인정보 처리방침" back="/settings" />
      <dl className="space-y-5">
        {ITEMS.map(([t, d]) => (
          <div key={t}>
            <dt className="font-bold">{t}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{d}</dd>
          </div>
        ))}
      </dl>
    </Page>
  )
}
