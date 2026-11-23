/*
 * AppContext.jsx — 앱 전체가 함께 쓰는 상태 (설정, 로그인, 테마, 알림)
 * [담당: 곽수호]
 *
 * 화면에서는 const { config, user, toast, ... } = useApp() 으로 꺼내 쓴다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadConfig, saveConfig, isConfigured } from '../common/config.js'
import { getCurrentUser, onAuthChange, isCloudEnabled } from '../common/auth.js'
import { errorMessage } from '../common/errors.js'
import { setActiveUser, syncFromCloud, hasGuestData, copyGuestDataToAccount } from '../storage/storage.js'
import { ensureSamples } from '../persona/persona.js'
import { Modal } from './components/Modal.jsx'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const THEME_KEY = 'ost3.theme'

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* 무시 */
  }
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }) {
  const [config, setConfigState] = useState(loadConfig)
  const [theme, setTheme] = useState(initialTheme)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false) // 로그인 확인 + 샘플 준비가 끝났는지
  const [dataVersion, setDataVersion] = useState(0) // 데이터가 바뀌면 올려서 목록을 다시 불러오게
  const [toasts, setToasts] = useState([])
  const [migrateAsk, setMigrateAsk] = useState(false)
  const lastUserId = useRef(undefined)

  const refreshData = useCallback(() => setDataVersion((v) => v + 1), [])

  const toast = useCallback((message, kind = 'info') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const toastError = useCallback((err) => toast(errorMessage(err), 'error'), [toast])

  const setConfig = useCallback((cfg) => {
    saveConfig(cfg)
    setConfigState(loadConfig())
  }, [])

  // 테마: <html class="dark">
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* 무시 */
    }
  }, [theme])
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  // 로그인 상태가 바뀌면: 저장소 계정 전환 → (처음이면 옮기기 질문) → 동기화
  const applyUser = useCallback(
    async (u) => {
      const uid = u?.id ?? null
      if (lastUserId.current === uid) return
      lastUserId.current = uid
      setUser(u)
      setActiveUser(uid)
      try {
        if (uid) {
          await syncFromCloud()
          if (await hasGuestData()) setMigrateAsk(true)
        }
        await ensureSamples()
      } catch (e) {
        toastError(e)
      }
      refreshData()
      setReady(true)
    },
    [refreshData, toastError],
  )

  useEffect(() => {
    let alive = true
    getCurrentUser()
      .catch(() => null)
      .then((u) => alive && applyUser(u))
    const off = onAuthChange((u) => applyUser(u))
    return () => {
      alive = false
      off()
    }
  }, [applyUser])

  async function answerMigrate(yes) {
    setMigrateAsk(false)
    if (!yes) return
    try {
      const n = await copyGuestDataToAccount()
      toast(`${n}개 기록을 계정으로 옮겼어요.`)
      refreshData()
    } catch (e) {
      toastError(e)
    }
  }

  const value = useMemo(
    () => ({
      config,
      setConfig,
      configured: isConfigured(config),
      theme,
      toggleTheme,
      user,
      cloudEnabled: isCloudEnabled(),
      ready,
      dataVersion,
      refreshData,
      toast,
      toastError,
    }),
    [config, setConfig, theme, toggleTheme, user, ready, dataVersion, refreshData, toast, toastError],
  )

  return (
    <AppContext.Provider value={value}>
      {/* 로그인 확인·저장소 준비가 끝나기 전에 화면을 그리면 다른 계정의 저장소를 읽을 수 있어서 기다린다 */}
      {ready ? (
        children
      ) : (
        <div className="flex min-h-dvh items-center justify-center text-sm text-stone-500" role="status">
          불러오는 중…
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
      <Modal
        open={migrateAsk}
        title="이 기기의 데이터를 계정으로 옮길까요?"
        onClose={() => answerMigrate(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => answerMigrate(false)}>
              나중에
            </button>
            <button className="btn btn-primary" onClick={() => answerMigrate(true)}>
              옮기기
            </button>
          </>
        }
      >
        로그인하기 전에 이 브라우저에서 만든 캐릭터와 대화가 있어요. 계정으로 옮기면 다른 기기에서도 이어서 쓸 수 있어요.
      </Modal>
    </AppContext.Provider>
  )
}
