/*
 * Layout.jsx — 화면 틀: 위 막대 + (휴대폰) 아래 탭 / (컴퓨터) 왼쪽 메뉴
 * [담당: 곽수호]
 */
import { NavLink, Outlet, useLocation, Link } from 'react-router'
import { useApp } from '../AppContext.jsx'
import { Icon } from './Icons.jsx'

const NAV = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/chats', label: '대화', icon: 'chat' },
  { to: '/create', label: '만들기', icon: 'plus' },
  { to: '/settings', label: '설정', icon: 'settings' },
]

export function ThemeButton() {
  const { theme, toggleTheme } = useApp()
  const dark = theme === 'dark'
  return (
    <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? '밝은 화면으로' : '어두운 화면으로'} title={dark ? '밝은 화면으로' : '어두운 화면으로'}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}

function AccountButton() {
  const { user, cloudEnabled } = useApp()
  if (!cloudEnabled) return null
  const photo = user?.user_metadata?.avatar_url
  return (
    <Link to="/settings#account" className="icon-btn overflow-hidden" aria-label={user ? '계정' : '로그인'} title={user ? user.email : '로그인'}>
      {photo ? <img src={photo} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" /> : <Icon name="user" />}
    </Link>
  )
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-xl bg-brand-600 text-sm text-white dark:bg-brand-500 dark:text-stone-950">T3</span>
      <span>OpenSourceT3</span>
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const fullscreen = pathname.startsWith('/chat/') // 대화 화면은 휴대폰에서 탭·위 막대 없이 꽉 차게

  return (
    <div className="min-h-dvh md:flex">
      {/* 컴퓨터: 왼쪽 메뉴 */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-stone-200 p-4 md:flex dark:border-stone-800">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800'
                }`
              }
            >
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-1">
          <ThemeButton />
          <AccountButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 휴대폰: 위 막대 */}
        {!fullscreen && (
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/90">
            <Logo />
            <div className="flex items-center">
              <ThemeButton />
              <AccountButton />
            </div>
          </header>
        )}

        <main className={`flex-1 ${fullscreen ? '' : 'pb-20 md:pb-0'}`}>
          <Outlet />
        </main>

        {/* 휴대폰: 아래 탭 */}
        {!fullscreen && (
          <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-900/95">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'
                  }`
                }
              >
                <Icon name={n.icon} className="size-6" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}

/** 화면 제목 줄 (뒤로 가기 버튼 선택) */
export function PageHeader({ title, back, actions, subtitle }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {back && (
        <Link to={back} className="icon-btn -ml-2" aria-label="뒤로">
          <Icon name="back" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

/** 본문 가운데 정렬 상자 */
export function Page({ children, wide }) {
  return <div className={`mx-auto w-full px-4 py-5 md:px-8 md:py-8 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>
}
