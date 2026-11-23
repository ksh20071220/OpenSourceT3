/*
 * PurposePicker.jsx — 사용 목적 고르기 (분류 탭 + 기타 직접 입력)
 * [담당: 곽수호]
 */
import { useState } from 'react'
import { CATEGORIES, purposesByCategory, CUSTOM_PURPOSE_ID } from '../../common/purposes.js'
import { Icon } from './Icons.jsx'

const TABS = [...CATEGORIES, '기타']
const CATEGORY_DESC = {
  학습: '캐릭터의 전문성을 살려 함께 공부해요',
  실무: '자료 조사·글쓰기·요약 같은 일을 도와줘요',
  상담: '고민을 털어놓고 이야기해요',
  대화: '편하게 이야기를 나눠요',
  기타: '원하는 목적을 직접 적어요',
}

/** onSelect(purposeId, customText?) */
export function PurposePicker({ onSelect }) {
  const [tab, setTab] = useState('대화')
  const [custom, setCustom] = useState('')
  const groups = purposesByCategory()

  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1 dark:bg-stone-900" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === t ? 'bg-white shadow-sm dark:bg-stone-800' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">{CATEGORY_DESC[tab]}</p>

      {tab === '기타' ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (custom.trim()) onSelect(CUSTOM_PURPOSE_ID, custom.trim())
          }}
        >
          <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="예: 면접 연습, 소설 설정 회의" maxLength={60} />
          <button className="btn btn-primary shrink-0" disabled={!custom.trim()}>
            시작
          </button>
        </form>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups[tab].map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="card flex items-center gap-3 p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/50 dark:hover:border-brand-600 dark:hover:bg-brand-900/20"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  {p.name}
                  {p.tier === 'heavy' && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">고성능</span>}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">{p.description}</p>
              </div>
              <Icon name="send" className="size-4 shrink-0 text-stone-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
