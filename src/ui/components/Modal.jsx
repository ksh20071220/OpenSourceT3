/*
 * Modal.jsx — 확인 창
 * [담당: 곽수호]
 */
import { useEffect } from 'react'

export function Modal({ open, title, children, actions, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-2 text-base font-bold">{title}</h2>}
        <div className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{children}</div>
        {actions && <div className="mt-5 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * 간단한 "정말 할까요?" 창
 * <ConfirmModal open={...} title="삭제할까요?" danger confirmText="삭제" onConfirm={...} onClose={...}>설명</ConfirmModal>
 */
export function ConfirmModal({ open, title, children, confirmText = '확인', danger, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button
            className={danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn btn-primary'}
            onClick={() => {
              onClose?.()
              onConfirm?.()
            }}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
