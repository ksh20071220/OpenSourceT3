/*
 * SettingsScreen.jsx — 설정: AI 연결, 계정, 데이터, 정보
 * (밝은/어두운 화면 전환은 메뉴의 해·달 버튼으로 한다)
 * [담당: 곽수호]
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { getProvider } from '../../common/providers.js'
import { clearApiKey, loadConfig } from '../../common/config.js'
import { signInWithGoogle, signOut } from '../../common/auth.js'
import { exportAll, importAll, clearLocalData, deleteAccountData } from '../../storage/storage.js'
import { useApp } from '../AppContext.jsx'
import { downloadText, pickTextFile } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { ProviderSetup } from '../components/ProviderSetup.jsx'
import { ConfirmModal } from '../components/Modal.jsx'
import { Icon } from '../components/Icons.jsx'

function Section({ id, title, children }) {
  return (
    <section id={id} className="card scroll-mt-20 p-5">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsScreen() {
  const { config, setConfig, configured, user, cloudEnabled, refreshData, toast, toastError } = useApp()
  const [editing, setEditing] = useState(!configured)
  const [confirm, setConfirm] = useState(null) // 'local' | 'account'
  const { hash } = useLocation()
  const nav = useNavigate()
  const provider = getProvider(config.provider)

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView?.()
  }, [hash])

  async function backup() {
    try {
      downloadText(`opensourcet3-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportAll(), null, 2))
    } catch (e) {
      toastError(e)
    }
  }

  async function restore() {
    const text = await pickTextFile()
    if (!text) return
    try {
      const n = await importAll(JSON.parse(text))
      refreshData()
      toast(`${n}개 기록을 불러왔어요.`)
    } catch (e) {
      toastError(e)
    }
  }

  async function wipe(kind) {
    try {
      if (kind === 'account') await deleteAccountData()
      else await clearLocalData()
      refreshData()
      toast('삭제했어요.')
      nav('/')
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Page>
      <PageHeader title="설정" />
      <div className="space-y-4">
        <Section id="ai" title="AI 연결">
          {configured && !editing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold">{provider?.name}</p>
                {config.provider !== 'test' && (
                  <p className="text-stone-500 dark:text-stone-400">
                    저비용: {config.modelLight || '—'} · 고성능: {config.modelHeavy || '(저비용과 같음)'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {config.provider !== 'test' && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      clearApiKey()
                      setConfig({ ...loadConfig(), apiKey: '' })
                      toast('이 브라우저에서 API 키를 지웠어요.')
                    }}
                  >
                    키 지우기
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                  변경
                </button>
              </div>
            </div>
          ) : (
            <ProviderSetup onSaved={() => setEditing(false)} />
          )}
        </Section>

        <Section id="account" title="계정">
          {!cloudEnabled ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              이 사이트에는 로그인 기능이 설정되어 있지 않아요. 캐릭터와 대화는 이 브라우저에만 저장돼요.
            </p>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <Icon name="user" className="size-10 rounded-full bg-stone-200 p-2 dark:bg-stone-800" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-semibold">{user.user_metadata?.full_name || '구글 계정'}</p>
                  <p className="truncate text-stone-500">{user.email}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => signOut().catch(toastError)}>
                  로그아웃
                </button>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">캐릭터와 대화 기록이 계정에 저장돼 다른 기기에서도 이어서 쓸 수 있어요. API 키는 계정에 저장되지 않아요.</p>
              <button className="btn btn-danger" onClick={() => setConfirm('account')}>
                계정에 저장된 데이터 전부 삭제
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-stone-300">로그인은 선택이에요. 로그인하면 캐릭터와 대화 기록을 다른 기기에서도 이어서 쓸 수 있어요.</p>
              <button className="btn btn-secondary w-full sm:w-auto" onClick={() => signInWithGoogle().catch(toastError)}>
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
                </svg>
                Google로 로그인
              </button>
              <p className="text-xs text-stone-500">
                로그인하면{' '}
                <Link to="/privacy" className="underline">
                  개인정보 처리방침
                </Link>
                에 동의하는 것으로 봐요.
              </p>
            </div>
          )}
        </Section>

        <Section id="data" title="데이터">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={backup}>
              <Icon name="download" className="size-4" /> 백업 파일로 내보내기
            </button>
            <button className="btn btn-secondary" onClick={restore}>
              <Icon name="upload" className="size-4" /> 백업 불러오기
            </button>
            <button className="btn btn-danger" onClick={() => setConfirm('local')}>
              이 브라우저 데이터 삭제
            </button>
          </div>
          <p className="hint mt-3">백업 파일에는 캐릭터와 대화 기록이 들어 있고, API 키는 들어 있지 않아요.</p>
        </Section>

        <Section id="about" title="정보">
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/privacy" className="text-brand-700 hover:underline dark:text-brand-400">
                개인정보 처리방침
              </Link>
            </li>
            <li>
              <a href="https://github.com/ksh20071220/OpenSourceT3" target="_blank" rel="noreferrer" className="text-brand-700 hover:underline dark:text-brand-400">
                소스 코드 (GitHub)
              </a>
            </li>
            <li className="text-stone-500">OpenSourceT3 v0.2 · GPL v3 · 1반 3팀</li>
          </ul>
        </Section>
      </div>

      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'account' ? '계정 데이터를 전부 삭제할까요?' : '이 브라우저의 데이터를 삭제할까요?'}
        danger
        confirmText="삭제"
        onConfirm={() => wipe(confirm)}
        onClose={() => setConfirm(null)}
      >
        {confirm === 'account'
          ? '계정에 저장된 캐릭터와 대화 기록이 모두 삭제되고, 이 기기에 있는 사본도 지워져요. 되돌릴 수 없어요.'
          : user
            ? '이 브라우저에 있는 사본만 지워져요. 계정에 저장된 데이터는 다시 로그인하면 내려받아요.'
            : '이 브라우저에 저장된 캐릭터와 대화 기록이 모두 지워져요. 필요하면 먼저 백업하세요.'}
      </ConfirmModal>
    </Page>
  )
}
