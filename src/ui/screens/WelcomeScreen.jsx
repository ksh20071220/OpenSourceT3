/*
 * WelcomeScreen.jsx — 처음 시작 화면: Google로 시작하기 / 로그인 없이 써 보기
 * [담당: 곽수호]
 *
 * 로그인 기능(Supabase)이 설정된 사이트에서, 로그인하지 않았고 아직 고른 적이 없을 때만 보인다 (WelcomeGate).
 * Google 로그인은 처음이면 자동으로 가입된다 (따로 회원가입 화면이 없음).
 */
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useApp } from '../AppContext.jsx'
import { GoogleButton } from '../components/GoogleButton.jsx'
import { ThemeButton } from '../components/Layout.jsx'
import { Icon } from '../components/Icons.jsx'

const WELCOMED_KEY = 'ost3.welcomed'
let chosenInMemory = false // 저장소에 못 쓰는 브라우저에서도 이번 방문 동안은 다시 막지 않게

export function hasChosenStart() {
  if (chosenInMemory) return true
  try {
    return localStorage.getItem(WELCOMED_KEY) === '1'
  } catch {
    return true // 저장소를 못 쓰면 매번 막지 않는다
  }
}

function markChosen() {
  try {
    localStorage.setItem(WELCOMED_KEY, '1')
  } catch {
    chosenInMemory = true // 저장이 안 되면 이번 방문 동안만 기억
  }
}

/** 첫 방문이면 시작 화면으로 보내는 문 (Layout 바깥에서 감싼다) */
export function WelcomeGate({ children }) {
  const { user, cloudEnabled } = useApp()
  const location = useLocation()
  const exempt = location.pathname === '/privacy'
  if (cloudEnabled && !user && !exempt && !hasChosenStart()) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search + location.hash }} />
  }
  return children
}

const POINTS = [
  { icon: 'search', text: '이름만 넣으면 AI가 자료를 찾아 캐릭터의 성격·말투·행동 원칙을 만들어요' },
  { icon: 'key', text: '내 API 키로 써요. 키는 비밀번호로 잠가서만 계정에 저장돼요' },
  { icon: 'chat', text: '로그인하면 캐릭터와 대화를 다른 기기에서도 이어서 써요' },
]

export function WelcomeScreen() {
  const { user, cloudEnabled } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  if (user || !cloudEnabled) return <Navigate to="/" replace />
  const from = location.state?.from || '/'

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="absolute right-3 top-3">
        <ThemeButton />
      </div>
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-extrabold text-white shadow-lg dark:bg-brand-500 dark:text-stone-950">
          T3
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">OpenSourceT3</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">근거로 만드는 캐릭터 채팅</p>

        <ul className="mt-8 space-y-3 text-left">
          {POINTS.map((p) => (
            <li key={p.icon} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Icon name={p.icon} className="size-4" />
              </span>
              <span className="pt-1.5">{p.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 space-y-3">
          <GoogleButton className="w-full py-3" onBeforeSignIn={markChosen}>
            Google로 시작하기
          </GoogleButton>
          <p className="text-xs text-stone-500">처음이면 자동으로 가입돼요.</p>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => {
              markChosen()
              navigate(from, { replace: true })
            }}
          >
            로그인 없이 써 보기
          </button>
          <p className="text-xs text-stone-500">로그인 없이 쓰면 이 브라우저에만 저장돼요. 나중에 설정에서 언제든 로그인할 수 있어요.</p>
        </div>

        <Link to="/privacy" className="mt-8 inline-block text-xs text-stone-500 underline">
          개인정보 처리방침
        </Link>
      </div>
    </div>
  )
}
