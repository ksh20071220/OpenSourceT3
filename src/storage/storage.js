/*
 * storage.js — 저장소 규격 (캐릭터·대화 기록을 어디에 저장하든 같은 함수로)
 * [담당: 오승민]   규격(함수 이름·모양)은 docs/INTERFACE.md 와 같아야 한다.
 *
 * 동작 방식 ("로컬 우선")
 *   1. 항상 브라우저 저장소(IndexedDB)에 먼저 저장한다 → 인터넷이 끊겨도 동작
 *   2. 로그인한 상태면 같은 내용을 계정(Supabase)에도 올린다 (실패해도 로컬 저장은 성공으로 본다)
 *   3. 로그인하면 syncFromCloud()로 계정 ↔ 이 기기를 맞춘다 (updatedAt이 더 최신인 쪽이 이김)
 *
 * 저장하는 기록의 모양
 *   personas      : { id, persona(페르소나 JSON), origin, createdAt, updatedAt }
 *   conversations : { personaId, messages: [{ role, content, at, purposeId }], updatedAt }
 *
 * 사용하는 쪽: persona/ (personas), memory/ (conversations), ui/ (로그인·백업 메뉴)
 */
import { db, dbNameFor, STORES } from './db.js'
import { cloud } from './cloud.js'

let activeUserId = null

/** 로그인 상태가 바뀌면 ui가 부른다. null이면 로그인 안 한 상태. */
export function setActiveUser(userId) {
  activeUserId = userId || null
}

export function getActiveUser() {
  return activeUserId
}

function current() {
  return dbNameFor(activeUserId)
}

function cloudOn() {
  return activeUserId !== null && cloud.enabled()
}

/** 계정 저장 실패는 화면을 막지 않고 경고만 남긴다. 다음 syncFromCloud() 때 다시 올라간다. */
async function cloudTry(fn) {
  if (!cloudOn()) return
  try {
    await fn()
  } catch (e) {
    console.warn('[storage] 계정 동기화 실패 — 이 기기에는 저장됨', e)
    // TODO(오승민): 화면에 "동기화 대기 중" 표시할 수 있게 상태 알려 주기
  }
}

function makeStore(store, keyName) {
  return {
    async list() {
      const all = await db.getAll(current(), store)
      return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    },
    async get(key) {
      return (await db.get(current(), store, key)) ?? null
    },
    /** updatedAt을 지금 시각으로 바꿔서 저장하고, 저장된 기록을 돌려준다 */
    async put(record) {
      const rec = { ...record, updatedAt: Date.now() }
      if (!rec[keyName]) throw new Error(`${store}.put: ${keyName}가 없습니다`)
      await db.put(current(), store, rec)
      await cloudTry(() => cloud.put(store, rec))
      return rec
    },
    async remove(key) {
      await db.remove(current(), store, key)
      // TODO(오승민): 계정 삭제가 실패하면 다음 동기화 때 되살아난다 → 삭제 기록(tombstone) 남기기
      await cloudTry(() => cloud.remove(store, key))
    },
  }
}

export const personasStore = makeStore(STORES.personas, 'id')
export const conversationsStore = makeStore(STORES.conversations, 'personaId')

const KEYS = { personas: 'id', conversations: 'personaId' }

/**
 * 계정 ↔ 이 기기 맞추기. 로그인 직후 한 번 부른다.
 * @returns {Promise<{down: number, up: number}>} 내려받은 수, 올린 수
 */
export async function syncFromCloud() {
  if (!cloudOn()) return { down: 0, up: 0 }
  let down = 0
  let up = 0
  for (const store of Object.values(STORES)) {
    const key = KEYS[store]
    const remote = await cloud.getAll(store)
    const local = await db.getAll(current(), store)
    const localMap = new Map(local.map((r) => [r[key], r]))
    const remoteMap = new Map(remote.map((r) => [r[key], r]))
    for (const r of remote) {
      const l = localMap.get(r[key])
      if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) {
        await db.put(current(), store, r)
        down++
      }
    }
    for (const l of local) {
      const r = remoteMap.get(l[key])
      if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) {
        await cloud.put(store, l)
        up++
      }
    }
  }
  return { down, up }
}

/** 로그인 전(guest)에 이 기기에 저장한 데이터가 있는지 */
export async function hasGuestData() {
  const name = dbNameFor(null)
  const [p, c] = await Promise.all([db.getAll(name, STORES.personas), db.getAll(name, STORES.conversations)])
  return p.length + c.length > 0
}

/**
 * 로그인 전 데이터를 지금 계정으로 복사 ("이 기기의 데이터를 계정으로 옮길까요?" → 예)
 * @param {{removeFromGuest?: boolean}} [opts] true면 복사 후 guest 데이터를 지운다
 * @returns {Promise<number>} 옮긴 기록 수
 */
export async function copyGuestDataToAccount({ removeFromGuest = true } = {}) {
  if (!activeUserId) return 0
  const guest = dbNameFor(null)
  let n = 0
  for (const store of Object.values(STORES)) {
    for (const rec of await db.getAll(guest, store)) {
      const exists = await db.get(current(), store, rec[KEYS[store]])
      if (!exists || (rec.updatedAt || 0) > (exists.updatedAt || 0)) {
        await db.put(current(), store, rec)
        await cloudTry(() => cloud.put(store, rec))
        n++
      }
    }
    if (removeFromGuest) await db.clear(guest, store)
  }
  return n
}

/** 지금 계정(또는 guest)의 데이터를 이 기기에서만 지우기 */
export async function clearLocalData() {
  for (const store of Object.values(STORES)) await db.clear(current(), store)
}

/** 계정에 저장된 데이터 전부 삭제 + 이 기기 사본도 삭제 */
export async function deleteAccountData() {
  if (cloudOn()) await cloud.removeAll()
  await clearLocalData()
}

/** 백업: 지금 보이는 데이터 전부를 하나의 객체로 */
export async function exportAll() {
  return {
    app: 'opensourcet3',
    exportedAt: new Date().toISOString(),
    personas: await personasStore.list(),
    conversations: await conversationsStore.list(),
  }
}

/**
 * 백업 불러오기. 같은 ID는 덮어쓴다.
 * @returns {Promise<number>} 불러온 기록 수
 */
export async function importAll(backup) {
  if (!backup || backup.app !== 'opensourcet3') throw new Error('OpenSourceT3 백업 파일이 아닙니다.')
  let n = 0
  for (const rec of backup.personas || []) {
    if (rec?.id && rec.persona) {
      await personasStore.put(rec)
      n++
    }
  }
  for (const rec of backup.conversations || []) {
    if (rec?.personaId && Array.isArray(rec.messages)) {
      await conversationsStore.put(rec)
      n++
    }
  }
  return n
}
