/*
 * CharacterScreen.jsx — 캐릭터 프로필 + 사용 목적 고르고 대화 시작
 * [담당: 곽수호]
 */
import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { getPersona, deletePersona, exportPersonaJson } from '../../persona/persona.js'
import { useApp } from '../AppContext.jsx'
import { useAsync, downloadText } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { Icon } from '../components/Icons.jsx'
import { PurposePicker } from '../components/PurposePicker.jsx'
import { ConfirmModal } from '../components/Modal.jsx'

export function chatUrl(id, purposeId, customText, baseline) {
  const q = new URLSearchParams({ p: purposeId })
  if (customText) q.set('c', customText)
  if (baseline) q.set('b', '1')
  return `/chat/${id}?${q}`
}

export function CharacterScreen() {
  const { id } = useParams()
  const nav = useNavigate()
  const { dataVersion, refreshData, toast, toastError, configured } = useApp()
  const { data: rec, loading } = useAsync(() => getPersona(id), [id, dataVersion])
  const [confirmDel, setConfirmDel] = useState(false)
  const [baseline, setBaseline] = useState(false)

  if (loading && !rec) return <Page>불러오는 중…</Page>
  if (!rec)
    return (
      <Page>
        <PageHeader title="캐릭터를 찾을 수 없어요" back="/" />
      </Page>
    )

  const p = rec.persona
  const c = p.character
  const style = p.personality?.speech_style || {}
  // 출처 주소는 AI 검색 결과·가져온 파일에서 오므로 http(s)만 링크로 쓴다 (javascript: 같은 주소 차단)
  const safeSources = (rec.sources || []).filter((s) => /^https?:\/\//i.test(s?.url || ''))

  async function remove() {
    try {
      await deletePersona(id)
      refreshData()
      toast(`${c.name}을(를) 삭제했어요.`)
      nav('/')
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Page>
      <PageHeader
        title=""
        back="/"
        actions={
          <div className="flex">
            <Link to={`/characters/${id}/edit`} className="icon-btn" aria-label="편집" title="편집">
              <Icon name="edit" />
            </Link>
            <button className="icon-btn" aria-label="JSON 내보내기" title="JSON 내보내기" onClick={() => downloadText(`${c.name}.json`, exportPersonaJson(rec))}>
              <Icon name="download" />
            </button>
            <button className="icon-btn text-red-500" aria-label="삭제" title="삭제" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" />
            </button>
          </div>
        }
      />

      <section className="mb-8 flex flex-col items-center text-center">
        <Avatar name={c.name} size="lg" />
        <h1 className="mt-3 text-2xl font-bold">{c.name}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {c.source}
          {c.setting_version ? ` · ${c.setting_version}` : ''}
        </p>
        {style.tone && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">“{style.tone}”</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {(p.personality?.traits || []).map((t) => (
            <span key={t.name} className="chip" title={t.basis === 'inferred' ? '자료로 추론한 특성' : '자료에 나온 특성'}>
              {t.name}
              {t.basis === 'inferred' && <span className="text-stone-400">·추론</span>}
            </span>
          ))}
        </div>
        {p.personality?.values?.length > 0 && (
          <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">가치관: {p.personality.values.join(', ')}</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="section-title mb-3">무엇을 할까요?</h2>
        {!configured && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            대화하려면 먼저{' '}
            <Link to="/setup" className="font-semibold underline">
              AI 연결
            </Link>
            을 해 주세요.
          </p>
        )}
        <PurposePicker onSelect={(pid, custom) => nav(chatUrl(id, pid, custom, baseline))} />
        <label className="mt-4 flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
          <input type="checkbox" className="mt-0.5 accent-brand-600" checked={baseline} onChange={(e) => setBaseline(e.target.checked)} />
          <span>
            <b>비교용 단순 프롬프트 모드</b> — 페르소나 없이 이름만 넣고 대화해요. 인격 일관성(OOC) 비교 실험용이에요.
          </span>
        </label>
      </section>

      {safeSources.length > 0 && (
        <section className="mb-8">
          <h2 className="section-title mb-2">참고한 자료</h2>
          <ul className="space-y-1 text-sm">
            {safeSources.slice(0, 10).map((s) => (
              <li key={s.url} className="truncate">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline dark:text-brand-400">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmModal open={confirmDel} title={`${c.name}을(를) 삭제할까요?`} danger confirmText="삭제" onConfirm={remove} onClose={() => setConfirmDel(false)}>
        캐릭터와 대화 기록이 모두 지워져요. 되돌릴 수 없어요.
      </ConfirmModal>
    </Page>
  )
}
