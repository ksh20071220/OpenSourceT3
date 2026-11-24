/*
 * SettingsScreen.jsx — 설정: AI 연결, 계정, 데이터, 정보
 * (밝은/어두운 화면 전환은 메뉴의 해·달 버튼으로 한다)
 * [담당: 곽수호]
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { getProvider } from '../../common/providers.js'
import { clearApiKey, loadConfig } from '../../common/config.js'
import { signOut } from '../../common/auth.js'
import { exportAll, importAll, clearLocalData, deleteAccountData } from '../../storage/storage.js'
import { useApp } from '../AppContext.jsx'
import { downloadText, pickTextFile } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { ProviderSetup } from '../components/ProviderSetup.jsx'
import { ConfirmModal } from '../components/Modal.jsx'
import { Icon } from '../components/Icons.jsx'
import { GoogleButton } from '../components/GoogleButton.jsx'
import { Modal } from '../components/Modal.jsx'
import { useKeyVault, hasLocalKey } from '../KeyVaultContext.jsx'

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
  const [confirm, setConfirm] = useState(null) // 'local' | 'account' | 'key'
  const [logoutAsk, setLogoutAsk] = useState(false)
  const [clearKeyOnLogout, setClearKeyOnLogout] = useState(true)
  const kv = useKeyVault()
  const { hash } = useLocation()
  const nav = useNavigate()
  const provider = getProvider(config.provider)

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView?.()
  }, [hash])

  async function logout() {
    setLogoutAsk(false)
    try {
      if (clearKeyOnLogout) {
        clearApiKey()
        setConfig({ ...loadConfig(), apiKey: '' })
      }
      await signOut()
    } catch (e) {
      toastError(e)
    }
  }

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
      if (kind === 'key') {
        await kv.removeFromAccount()
        toast('계정에서 API 키를 지웠어요. 이 브라우저의 키는 그대로예요.')
        return
      }
      if (kind === 'account') {
        await deleteAccountData()
        await kv.refreshInfo()
      }
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
            <div className="space-y-5">
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
                <button className="btn btn-secondary" onClick={() => setLogoutAsk(true)}>
                  로그아웃
                </button>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">캐릭터와 대화 기록이 계정에 저장돼 다른 기기에서도 이어서 쓸 수 있어요.</p>

              <div className="rounded-xl bg-stone-100 p-4 dark:bg-stone-800/60">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon name="key" className="size-4" /> 계정에 저장된 API 키
                </p>
                {kv.info ? (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {getProvider(kv.info.provider)?.name || kv.info.provider} · 저비용 {kv.info.modelLight || '-'} · 고성능 {kv.info.modelHeavy || '-'}
                    {kv.info.updatedAt ? ` · ${new Date(kv.info.updatedAt).toLocaleDateString('ko-KR')} 저장` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    저장된 키가 없어요. 비밀번호로 잠가서 저장하면 다른 기기에서 로그인 후 비밀번호만 입력하면 돼요.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {kv.info && (
                    <button className="btn btn-secondary px-3 py-2" onClick={kv.openLoad}>
                      불러오기
                    </button>
                  )}
                  {hasLocalKey(config) && (
                    <button className="btn btn-secondary px-3 py-2" onClick={() => kv.openSave(config)}>
                      {kv.info ? '이 기기의 키로 바꾸기' : '이 기기의 키 저장'}
                    </button>
                  )}
                  {kv.info && (
                    <button className="btn btn-secondary px-3 py-2" onClick={kv.openChange}>
                      비밀번호 바꾸기
                    </button>
                  )}
                  {kv.info && (
                    <button className="btn btn-danger px-3 py-2" onClick={() => setConfirm('key')}>
                      계정에서 키 삭제
                    </button>
                  )}
                </div>
                <p className="hint mt-2">원래 키와 비밀번호는 서버에 저장되지 않아요. 비밀번호를 5번 틀리면 30초 동안 잠겨요.</p>
              </div>

              <button className="btn btn-danger" onClick={() => setConfirm('account')}>
                계정에 저장된 데이터 전부 삭제
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-stone-300">
                로그인은 선택이에요. 로그인하면 캐릭터와 대화 기록, 그리고 비밀번호로 잠근 API 키를 다른 기기에서도 이어서 쓸 수 있어요. 처음이면 자동으로
                가입돼요.
              </p>
              <GoogleButton className="w-full sm:w-auto" />
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
        title={
          confirm === 'key' ? '계정에 저장된 API 키를 지울까요?' : confirm === 'account' ? '계정 데이터를 전부 삭제할까요?' : '이 브라우저의 데이터를 삭제할까요?'
        }
        danger
        confirmText="삭제"
        onConfirm={() => wipe(confirm)}
        onClose={() => setConfirm(null)}
      >
        {confirm === 'key'
          ? '다른 기기에서 더 이상 불러올 수 없게 돼요. 이 브라우저에 있는 키는 그대로 남아요.'
          : confirm === 'account'
          ? '계정에 저장된 캐릭터와 대화 기록, 잠가 둔 API 키가 모두 삭제되고, 이 기기에 있는 사본도 지워져요. 되돌릴 수 없어요.'
          : user
            ? '이 브라우저에 있는 사본만 지워져요. 계정에 저장된 데이터는 다시 로그인하면 내려받아요.'
            : '이 브라우저에 저장된 캐릭터와 대화 기록이 모두 지워져요. 필요하면 먼저 백업하세요.'}
      </ConfirmModal>

      <Modal
        open={logoutAsk}
        title="로그아웃할까요?"
        onClose={() => setLogoutAsk(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setLogoutAsk(false)}>
              취소
            </button>
            <button className="btn btn-primary" onClick={logout}>
              로그아웃
            </button>
          </>
        }
      >
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 accent-brand-600" checked={clearKeyOnLogout} onChange={(e) => setClearKeyOnLogout(e.target.checked)} />
          <span>
            이 브라우저의 API 키도 지우기
            <span className="block text-xs text-stone-500">
              {kv.info ? '계정에 저장돼 있어서 다시 로그인하면 비밀번호로 불러올 수 있어요.' : '계정에 저장된 키가 없어서, 지우면 다시 입력해야 해요.'} 공용 컴퓨터라면 꼭 켜 두세요.
            </span>
          </span>
        </label>
      </Modal>
    </Page>
  )
}
