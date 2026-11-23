/*
 * db.js — 브라우저 저장소(IndexedDB) 얇은 래퍼
 * [담당: 오승민]
 *
 * IndexedDB는 브라우저 안에 들어 있는 DB다. localStorage보다 훨씬 많이(수백 MB) 저장할 수 있고
 * JSON 객체를 그대로 넣을 수 있어서 캐릭터·대화 기록 저장에 쓴다.
 *
 * DB 이름을 사용자별로 나눈다:
 *   - 로그인 안 함 : opensourcet3-guest
 *   - 로그인       : opensourcet3-<계정 id>
 * 그래서 한 컴퓨터를 여러 계정이 써도 데이터가 섞이지 않는다.
 */
import { AppError, ErrCode } from '../common/errors.js'

const DB_VERSION = 1
export const STORES = Object.freeze({ personas: 'personas', conversations: 'conversations' })

const KEY_PATHS = { personas: 'id', conversations: 'personaId' }
const opened = new Map() // dbName → Promise<IDBDatabase>

export function dbNameFor(userId) {
  return userId ? `opensourcet3-${userId}` : 'opensourcet3-guest'
}

function req2promise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function open(dbName) {
  if (!opened.has(dbName)) {
    const p = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new AppError(ErrCode.STORAGE, '이 브라우저는 IndexedDB를 지원하지 않습니다.'))
        return
      }
      const req = indexedDB.open(dbName, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const [name, keyPath] of Object.entries(KEY_PATHS)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(new AppError(ErrCode.STORAGE, 'DB를 열지 못했습니다.', req.error))
    })
    opened.set(dbName, p)
    p.catch(() => opened.delete(dbName)) // 실패하면 다음에 다시 시도
  }
  return opened.get(dbName)
}

async function run(dbName, store, mode, fn) {
  const db = await open(dbName)
  try {
    const tx = db.transaction(store, mode)
    const result = await req2promise(fn(tx.objectStore(store)))
    return result
  } catch (e) {
    throw e instanceof AppError ? e : new AppError(ErrCode.STORAGE, `${store} 저장소 작업 실패`, e)
  }
}

export const db = {
  get: (dbName, store, key) => run(dbName, store, 'readonly', (s) => s.get(key)),
  getAll: (dbName, store) => run(dbName, store, 'readonly', (s) => s.getAll()),
  put: (dbName, store, value) => run(dbName, store, 'readwrite', (s) => s.put(value)),
  remove: (dbName, store, key) => run(dbName, store, 'readwrite', (s) => s.delete(key)),
  clear: (dbName, store) => run(dbName, store, 'readwrite', (s) => s.clear()),
}

/** 테스트용: 열린 DB 연결 닫기 */
export async function closeAll() {
  for (const p of opened.values()) {
    try {
      ;(await p).close()
    } catch {
      /* 무시 */
    }
  }
  opened.clear()
}
