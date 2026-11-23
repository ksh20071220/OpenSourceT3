/*
 * auth.js — 구글 로그인 (선택 기능, Supabase Auth)
 * [공통 파일] 수정은 PR + 팀원 3명 확인 후에만
 *
 * .env 에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 없으면 로그인 기능 전체가 꺼지고,
 * 앱은 "로그인 없이 브라우저에만 저장" 모드로 그대로 동작한다.
 * (anon key는 공개돼도 되는 키다. 데이터 보호는 supabase/schema.sql 의 RLS 규칙이 맡는다.)
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

/** Supabase 클라이언트. 설정이 없으면 null */
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export function isCloudEnabled() {
  return supabase !== null
}

/** 구글 로그인 페이지로 이동. 로그인 후 이 사이트로 돌아온다. */
export async function signInWithGoogle() {
  if (!supabase) throw new Error('로그인 기능이 설정되지 않았습니다.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** 지금 로그인한 사용자 (없으면 null) */
export async function getCurrentUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

/**
 * 로그인 상태가 바뀔 때마다 callback(user | null) 호출.
 * @returns {() => void} 구독 해제 함수
 */
export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null))
  return () => data.subscription.unsubscribe()
}
