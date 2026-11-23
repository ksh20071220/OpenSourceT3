/*
 * cloud.js — 로그인한 사용자의 데이터를 Supabase DB에 올리고 내려받기
 * [담당: 오승민]
 *
 * 표 구조는 supabase/schema.sql 참고. 각 행은 기록 전체를 data(jsonb)에 통째로 넣는다.
 * user_id는 DB가 로그인 정보(auth.uid())로 자동으로 채우고, RLS 규칙 때문에 남의 행은 읽을 수도 쓸 수도 없다.
 * API 키는 여기로 절대 보내지 않는다 (config.js에만 있음).
 */
import { supabase } from '../common/auth.js'
import { AppError, ErrCode } from '../common/errors.js'

const TABLES = {
  personas: { table: 'personas', key: 'id', column: 'id' },
  conversations: { table: 'conversations', key: 'personaId', column: 'persona_id' },
}

function check(error, what) {
  if (error) throw new AppError(ErrCode.STORAGE, `계정 저장소 ${what} 실패: ${error.message}`, error)
}

export const cloud = {
  enabled: () => supabase !== null,

  /** @returns {Promise<Array<object>>} 내 계정의 기록 전부 */
  async getAll(store) {
    const t = TABLES[store]
    const { data, error } = await supabase.from(t.table).select('data')
    check(error, '읽기')
    return (data || []).map((row) => row.data)
  },

  async put(store, record) {
    const t = TABLES[store]
    const row = { [t.column]: record[t.key], data: record, updated_at: new Date(record.updatedAt || Date.now()).toISOString() }
    const { error } = await supabase.from(t.table).upsert(row, { onConflict: `user_id,${t.column}` })
    check(error, '쓰기')
  },

  async remove(store, key) {
    const t = TABLES[store]
    const { error } = await supabase.from(t.table).delete().eq(t.column, key)
    check(error, '삭제')
  },

  /** 내 계정의 데이터 전부 삭제 (설정 화면의 "계정 데이터 삭제") */
  async removeAll() {
    for (const t of Object.values(TABLES)) {
      // RLS 때문에 내 행만 지워진다. delete()는 조건이 필요해서 항상 참인 조건을 준다.
      const { error } = await supabase.from(t.table).delete().not(t.column, 'is', null)
      check(error, '전체 삭제')
    }
  },
}
