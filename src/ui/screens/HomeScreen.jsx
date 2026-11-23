/*
 * HomeScreen.jsx — 홈: 내 캐릭터 카드 목록
 * [담당: 곽수호]
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { listPersonas } from '../../persona/persona.js'
import { useApp } from '../AppContext.jsx'
import { useAsync } from '../hooks.js'
import { Page } from '../components/Layout.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { Icon } from '../components/Icons.jsx'

const ORIGIN_LABEL = { search: '검색 생성', text: '설정 글', form: '직접 입력', import: '가져옴', sample: '샘플' }

export function CharacterCard({ rec }) {
  const c = rec.persona.character
  const traits = (rec.persona.personality?.traits || []).slice(0, 2).map((t) => t.name)
  return (
    <Link to={`/characters/${rec.id}`} className="group block" aria-label={`${c.name} 프로필`}>
      <div className="relative overflow-hidden rounded-2xl">
        <Avatar name={c.name} size="card" className="transition duration-300 group-hover:scale-[1.03]" />
        <span className="absolute left-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {ORIGIN_LABEL[rec.origin] || '캐릭터'}
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate font-bold">{c.name}</p>
        <p className="truncate text-xs text-stone-500 dark:text-stone-400">{c.source}</p>
        {traits.length > 0 && <p className="mt-1 truncate text-xs text-stone-600 dark:text-stone-300">#{traits.join(' #')}</p>}
      </div>
    </Link>
  )
}

export function HomeScreen() {
  const { configured, dataVersion, ready } = useApp()
  const [q, setQ] = useState('')
  const { data: list, loading, error } = useAsync(() => (ready ? listPersonas() : []), [dataVersion, ready])

  const filtered = (list || []).filter((r) => {
    const c = r.persona.character
    return !q || `${c.name} ${c.source}`.toLowerCase().includes(q.toLowerCase())
  })

  return (
    <Page wide>
      {!configured && (
        <Link
          to="/setup"
          className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 p-4 text-white shadow-sm dark:from-brand-700 dark:to-brand-600"
        >
          <Icon name="key" className="size-6 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">AI 연결하기</p>
            <p className="text-sm opacity-90">내 API 키를 연결하면 캐릭터와 대화할 수 있어요. 키 없이 둘러보려면 테스트 모드를 고르세요.</p>
          </div>
          <Icon name="send" />
        </Link>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">내 캐릭터</h1>
        <div className="relative w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="이름·작품 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="캐릭터 검색" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">목록을 불러오지 못했어요.</p>}
      {loading && !list && <p className="text-sm text-stone-500">불러오는 중…</p>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Link
          to="/create"
          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-stone-500 transition hover:border-brand-500 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
        >
          <Icon name="plus" className="size-8" />
          <span className="text-sm font-semibold">새 캐릭터</span>
        </Link>
        {filtered.map((rec) => (
          <CharacterCard key={rec.id} rec={rec} />
        ))}
      </div>

      {list && list.length === 0 && (
        <p className="mt-8 text-center text-sm text-stone-500">아직 캐릭터가 없어요. 이름만 넣으면 AI가 자료를 찾아 만들어 줘요.</p>
      )}
    </Page>
  )
}
