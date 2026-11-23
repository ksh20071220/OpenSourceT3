/*
 * ChatScreen.jsx — 캐릭터와 대화
 * [담당: 곽수호]
 *
 * 주소: /chat/:id?p=목적ID[&c=기타 목적 글][&b=1(비교용 단순 프롬프트)]
 */
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { getPersona } from '../../persona/persona.js'
import { getPurpose, CRISIS_NOTICE } from '../../common/purposes.js'
import { isAbortError } from '../../common/errors.js'
import { apiChat } from '../../api/api.js'
import { loadHistory, clearHistory } from '../../memory/memory.js'
import { useApp } from '../AppContext.jsx'
import { useAsync } from '../hooks.js'
import { Avatar } from '../components/Avatar.jsx'
import { Icon } from '../components/Icons.jsx'
import { MessageText } from '../components/MessageText.jsx'
import { ConfirmModal } from '../components/Modal.jsx'

function Bubble({ role, name, children }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white dark:bg-brand-500 dark:text-stone-950">
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={name} size="sm" />
      <div className="min-w-0 max-w-[80%]">
        <p className="mb-1 text-xs font-semibold text-stone-500 dark:text-stone-400">{name}</p>
        <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          {children}
        </div>
      </div>
    </div>
  )
}

function Typing() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="답변 쓰는 중">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot size-1.5 rounded-full bg-stone-400" />
      ))}
    </span>
  )
}

export function ChatScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const purpose = getPurpose(params.get('p'), params.get('c'))
  const baseline = params.get('b') === '1'
  const { configured, toastError, refreshData, dataVersion } = useApp()

  const { data: rec, loading } = useAsync(() => getPersona(id), [id, dataVersion])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(null) // 받는 중인 답변 (null이면 대기 상태)
  const [confirmClear, setConfirmClear] = useState(false)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadHistory(id).then(setMessages, toastError)
  }, [id, toastError, dataVersion])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, streaming])

  useEffect(() => () => abortRef.current?.abort(), []) // 화면을 떠나면 요청 중단

  if (!params.get('p') || !purpose) return <Navigate to={`/characters/${id}`} replace />
  if (loading && !rec) return <div className="p-6">불러오는 중…</div>
  if (!rec) return <Navigate to="/" replace />

  const name = rec.persona.character.name
  const busy = streaming !== null

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text, at: Date.now() }])
    setStreaming('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await apiChat({ personaId: id, purpose, userText: text, baseline, signal: ctrl.signal, onChunk: (c) => setStreaming((s) => (s ?? '') + c) })
    } catch (err) {
      if (!isAbortError(err)) toastError(err)
    } finally {
      abortRef.current = null
      setStreaming(null)
      setMessages(await loadHistory(id)) // 저장된 기록이 기준 (실패하면 입력이 빠질 수 있음)
      refreshData()
      inputRef.current?.focus()
    }
  }

  async function clear() {
    await clearHistory(id)
    setMessages([])
    refreshData()
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-stone-200 bg-stone-50/90 px-2 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <Link to={`/characters/${id}`} className="icon-btn" aria-label="뒤로">
          <Icon name="back" />
        </Link>
        <Avatar name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{name}</p>
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">
            {purpose.name}
            {baseline && ' · 비교용 단순 프롬프트'}
          </p>
        </div>
        <button className="icon-btn" onClick={() => setConfirmClear(true)} aria-label="대화 기록 지우기" title="대화 기록 지우기" disabled={busy || !messages.length}>
          <Icon name="trash" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
          {purpose.crisis_notice && (
            <p className="rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" role="note">
              {CRISIS_NOTICE}
            </p>
          )}
          {!configured && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              AI 연결이 아직 안 되어 있어요.{' '}
              <Link to="/setup" className="font-semibold underline">
                지금 연결하기
              </Link>
            </p>
          )}
          {messages.length === 0 && !busy && (
            <div className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
              <Avatar name={name} size="lg" className="mx-auto mb-3" />
              <p className="font-semibold text-stone-700 dark:text-stone-200">{name}와(과) “{purpose.name}” 대화를 시작해 보세요.</p>
              <p className="mt-1 text-xs">*별표*로 감싸면 행동이나 상황 묘사로 표시돼요.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={`${m.at}-${i}`} role={m.role} name={name}>
              <MessageText text={m.content} />
            </Bubble>
          ))}
          {busy && (
            <Bubble role="assistant" name={name}>
              {streaming ? <MessageText text={streaming} /> : <Typing />}
            </Bubble>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-stone-200 bg-stone-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-stone-800 dark:bg-stone-950">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            className="input max-h-40 min-h-11 resize-none"
            rows={1}
            value={input}
            placeholder={`${name}에게 메시지 보내기`}
            aria-label="메시지"
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
            }}
            onKeyDown={(e) => {
              // 한글 조합 중(isComposing) Enter는 글자 확정이라 보내지 않는다
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e)
            }}
          />
          {busy ? (
            <button type="button" className="btn btn-secondary size-11 shrink-0 p-0" onClick={() => abortRef.current?.abort()} aria-label="답변 중단" title="답변 중단">
              <Icon name="stop" />
            </button>
          ) : (
            <button className="btn btn-primary size-11 shrink-0 p-0" disabled={!input.trim()} aria-label="보내기">
              <Icon name="send" />
            </button>
          )}
        </div>
      </form>

      <ConfirmModal open={confirmClear} title="대화 기록을 지울까요?" danger confirmText="지우기" onConfirm={clear} onClose={() => setConfirmClear(false)}>
        {name}와(과)의 대화가 모두 지워져요. 캐릭터는 그대로 남아요.
      </ConfirmModal>
    </div>
  )
}
