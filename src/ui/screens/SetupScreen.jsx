/*
 * SetupScreen.jsx — 처음 설정 (AI 연결)
 * [담당: 곽수호]
 */
import { useNavigate } from 'react-router'
import { Page, PageHeader } from '../components/Layout.jsx'
import { ProviderSetup } from '../components/ProviderSetup.jsx'

export function SetupScreen() {
  const nav = useNavigate()
  return (
    <Page>
      <PageHeader title="AI 연결하기" subtitle="내 API 키(BYOK)로 AI를 연결해요. 키는 이 브라우저에만 저장돼요." back="/" />
      <ProviderSetup submitText="연결하고 시작하기" onSaved={() => nav('/')} />
    </Page>
  )
}
