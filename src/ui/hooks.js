/*
 * hooks.js — 화면에서 자주 쓰는 React 훅
 * [담당: 곽수호]
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 비동기 함수 결과 불러오기.
 * const { data, loading, error, reload } = useAsync(() => listPersonas(), [dataVersion])
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => alive && setState({ data, loading: false, error: null }),
        (error) => alive && setState({ data: undefined, loading: false, error }),
      )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

/** 파일 다운로드 (JSON 내보내기용) */
export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 파일 고르기 창을 열어 텍스트로 읽기. 취소하면 null */
export function pickTextFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      f.text().then(resolve, () => resolve(null))
    }
    input.click()
  })
}

/** "3분 전" 같은 상대 시간 */
export function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`
  return new Date(ms).toLocaleDateString('ko-KR')
}
