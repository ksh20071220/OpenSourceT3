/*
 * CreateScreen.jsx — 새 캐릭터 만들기 (검색 / 설정 글 / 직접 입력 / 파일 가져오기)
 * [담당: 곽수호]
 */
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPersonaFromSearch, createPersonaFromText, importPersonaJson } from '../../persona/persona.js'
import { errorMessage, isAbortError } from '../../common/errors.js'
import { useApp } from '../AppContext.jsx'
import { pickTextFile } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { Icon } from '../components/Icons.jsx'

const MODES = [
  { id: 'search', icon: 'search', title: '검색으로 만들기', desc: '이름과 작품명만 넣으면 AI가 웹에서 자료를 찾아 성격·말투·행동 원칙을 정리해요.' },
  { id: 'text', icon: 'sparkle', title: '설정 글로 만들기', desc: '내가 만든 캐릭터의 설정을 자유롭게 쓰면 AI가 정리해 줘요.' },
  { id: 'form', icon: 'pen', title: '직접 입력하기', desc: 'AI 없이 성격·말투·행동 원칙을 칸마다 직접 채워요. 요금이 들지 않아요.' },
  { id: 'import', icon: 'upload', title: 'JSON 파일 가져오기', desc: '친구에게 받았거나 내보내 둔 캐릭터 파일을 불러와요.' },
]

function Progress({ progress, onCancel }) {
  return (
    <div className="card p-5" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{progress.step}</span>
        <span className="tabular-nums text-stone-500">{progress.percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">검색과 인격 추론에 1~2분 걸릴 수 있어요. 고성능 모델과 웹 검색 요금이 들어요.</p>
      <button className="btn btn-ghost mt-3" onClick={onCancel}>
        중단
      </button>
    </div>
  )
}

export function CreateScreen() {
  const nav = useNavigate()
  const { configured, refreshData, toast, toastError } = useApp()
  const [mode, setMode] = useState(null)
  const [form, setForm] = useState({ name: '', source: '', keywords: '', text: '' })
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function choose(m) {
    setError('')
    if (m === 'form') return nav('/create/form')
    if (m === 'import') {
      const text = await pickTextFile()
      if (!text) return
      try {
        const rec = await importPersonaJson(text)
        refreshData()
        toast(`${rec.persona.character.name}을(를) 가져왔어요.`)
        nav(`/characters/${rec.id}`)
      } catch (e) {
        toastError(e)
      }
      return
    }
    setMode(m)
  }

  async function run(e) {
    e.preventDefault()
    setError('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setProgress({ percent: 0, step: '준비 중' })
    try {
      const common = { name: form.name, source: form.source, onProgress: setProgress, signal: ctrl.signal }
      const rec =
        mode === 'search'
          ? await createPersonaFromSearch({ ...common, keywords: form.keywords })
          : await createPersonaFromText({ ...common, text: form.text })
      refreshData()
      toast(`'${rec.persona.character.name}' 캐릭터를 만들었어요.`)
      nav(`/characters/${rec.id}`)
    } catch (err) {
      if (!isAbortError(err)) setError(errorMessage(err))
    } finally {
      abortRef.current = null
      setProgress(null)
    }
  }

  if (!mode) {
    return (
      <Page>
        <PageHeader title="새 캐릭터 만들기" subtitle="어떤 방법으로 만들까요?" />
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => choose(m.id)} className="card flex items-start gap-3 p-4 text-left transition hover:border-brand-400 dark:hover:border-brand-600">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Icon name={m.icon} />
              </span>
              <span>
                <span className="block font-bold">{m.title}</span>
                <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          만든 캐릭터는 이 브라우저(로그인하면 내 계정)에만 저장되고, 다른 사람에게 공개되지 않아요. 작품 속 캐릭터는 개인적인 대화 용도로만 써 주세요.
        </p>
      </Page>
    )
  }

  const meta = MODES.find((m) => m.id === mode)
  return (
    <Page>
      <div className="mb-5 flex items-center gap-2">
        <button className="icon-btn -ml-2" onClick={() => !progress && setMode(null)} aria-label="뒤로" disabled={!!progress}>
          <Icon name="back" />
        </button>
        <div>
          <h1 className="text-xl font-bold md:text-2xl">{meta.title}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{meta.desc}</p>
        </div>
      </div>

      {!configured && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          AI로 만들려면 먼저{' '}
          <Link to="/setup" className="font-semibold underline">
            AI 연결
          </Link>
          을 해 주세요. 키 없이 만들려면 '직접 입력하기'를 쓰세요.
        </p>
      )}

      {progress ? (
        <Progress progress={progress} onCancel={() => abortRef.current?.abort()} />
      ) : (
        <form onSubmit={run} className="space-y-4">
          <div>
            <label className="label" htmlFor="c-name">
              캐릭터 이름 <span className="text-red-500">*</span>
            </label>
            <input id="c-name" className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} required />
          </div>
          <div>
            <label className="label" htmlFor="c-source">
              작품명
            </label>
            <input
              id="c-source"
              className="input"
              value={form.source}
              onChange={(e) => set({ source: e.target.value })}
              placeholder={mode === 'search' ? '모르면 비워 두세요' : '비우면 "자체 창작"'}
              maxLength={60}
            />
          </div>
          {mode === 'search' ? (
            <div>
              <label className="label" htmlFor="c-kw">
                추가 키워드·설정
              </label>
              <input id="c-kw" className="input" value={form.keywords} onChange={(e) => set({ keywords: e.target.value })} placeholder="예: 2부 이후 설정, 극장판 기준" maxLength={120} />
              <p className="hint">동명이인이 있거나 특정 시점의 성격을 원할 때 적어 주세요.</p>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="c-text">
                설정 글 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="c-text"
                className="input min-h-48"
                value={form.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder={'나이, 성격, 말투, 좋아하는 것, 과거 이야기, 이런 상황에서는 이렇게 행동한다… 자유롭게 써 주세요.\n예) 스무 살 의대생. 평소엔 무뚝뚝하지만 친구가 힘들어하면 말없이 옆에 있어 준다.'}
                maxLength={6000}
                required
              />
              <p className="hint">{form.text.length} / 6000자</p>
            </div>
          )}
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={!configured || !form.name.trim()}>
            <Icon name="sparkle" className="size-4" /> 만들기
          </button>
        </form>
      )}
    </Page>
  )
}
