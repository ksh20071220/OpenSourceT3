/*
 * PasswordModal.jsx — "API 키 비밀번호" 입력 창
 * [담당: 곽수호]
 *
 * mode
 *   'unlock' : 비밀번호 1칸 (+ "비밀번호를 잊었어요")
 *   'create' : 새 비밀번호 + 확인 (8자 이상)
 *   'change' : 지금 비밀번호 + 새 비밀번호 + 확인
 *
 * onSubmit 은 Promise 를 돌려준다. 실패하면 창을 닫지 않고 오류를 보여 준다.
 * LOCKED(너무 많이 틀림)면 남은 초를 세고 그동안 확인 버튼을 막는다.
 */
import { useEffect, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../storage/keyVault.js'
import { ErrCode, errorMessage } from '../../common/errors.js'
import { Modal } from './Modal.jsx'

export function PasswordModal({
  open,
  mode = 'unlock',
  title,
  description,
  submitText = '확인',
  cancelText = '취소',
  lockedSeconds = 0, // 열 때 이미 잠겨 있으면 남은 초
  onSubmit,
  onClose,
  onForgot,
}) {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lockLeft, setLockLeft] = useState(0)

  // 창을 열 때마다 입력 초기화
  useEffect(() => {
    if (open) {
      setValues({ current: '', next: '', confirm: '' })
      setError('')
      setBusy(false)
      setLockLeft(lockedSeconds || 0)
    }
  }, [open, mode, lockedSeconds])

  // 잠김 남은 시간 세기
  useEffect(() => {
    if (lockLeft <= 0) return
    const t = setTimeout(() => {
      setLockLeft((s) => s - 1)
      if (lockLeft === 1) setError('') // 잠금이 풀리면 안내 문구도 지운다
    }, 1000)
    return () => clearTimeout(t)
  }, [lockLeft])

  const set = (k) => (e) => {
    setError('')
    setValues((v) => ({ ...v, [k]: e.target.value }))
  }
  const needsNew = mode === 'create' || mode === 'change'
  const needsCurrent = mode === 'unlock' || mode === 'change'

  async function submit(e) {
    e.preventDefault()
    if (busy || lockLeft > 0) return
    if (needsNew) {
      if (Array.from(values.next).length < MIN_PASSWORD_LENGTH) return setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`)
      if (values.next !== values.confirm) return setError('두 비밀번호가 서로 달라요.')
    }
    if (needsCurrent && !values.current) return setError('비밀번호를 입력해 주세요.')
    setBusy(true)
    try {
      await onSubmit({ password: values.current, newPassword: values.next })
    } catch (err) {
      if (err?.code === ErrCode.LOCKED) setLockLeft(err.details?.retryAfter || 30)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <Modal open={open} title={title} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} className="space-y-3">
        {description && <p>{description}</p>}
        {needsCurrent && (
          <div>
            <label className="label" htmlFor="pw-current">
              {mode === 'change' ? '지금 비밀번호' : 'API 키 비밀번호'}
            </label>
            <input id="pw-current" className="input" type={type} autoComplete="current-password" value={values.current} onChange={set('current')} autoFocus />
          </div>
        )}
        {needsNew && (
          <>
            <div>
              <label className="label" htmlFor="pw-next">
                {mode === 'change' ? '새 비밀번호' : 'API 키 비밀번호 정하기'}
              </label>
              <input id="pw-next" className="input" type={type} autoComplete="new-password" value={values.next} onChange={set('next')} autoFocus={mode === 'create'} />
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">
                한 번 더 입력
              </label>
              <input id="pw-confirm" className="input" type={type} autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />
            </div>
            <p className="hint">
              {MIN_PASSWORD_LENGTH}자 이상. 구글 비밀번호와 다른 비밀번호를 쓰세요. 잊으면 되찾을 수 없고, 키를 다시 입력해야 해요.
            </p>
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <input type="checkbox" className="accent-brand-600" checked={show} onChange={(e) => setShow(e.target.checked)} />
          비밀번호 보기
        </label>

        {(error || lockLeft > 0) && (
          <p className="rounded-xl bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
            {lockLeft > 0 ? `비밀번호를 여러 번 틀려서 잠시 잠겼어요. ${lockLeft}초 뒤에 다시 시도해 주세요.` : error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {mode === 'unlock' && onForgot ? (
            <button type="button" className="text-xs text-stone-500 underline" onClick={onForgot} disabled={busy}>
              비밀번호를 잊었어요
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {cancelText}
            </button>
            <button className="btn btn-primary" disabled={busy || lockLeft > 0}>
              {busy ? '확인하는 중…' : submitText}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
