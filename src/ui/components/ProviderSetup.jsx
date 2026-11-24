/*
 * ProviderSetup.jsx — AI 연결 설정 (회사 → 키 발급 안내 → 키 입력 → 모델 고르기)
 * [담당: 곽수호]   첫 설정 화면과 설정 화면에서 같이 쓴다.
 */
import { useId, useRef, useState } from 'react'
import { listProviders } from '../../common/providers.js'
import { isConfigured } from '../../common/config.js'
import { errorMessage } from '../../common/errors.js'
import { apiListModels } from '../../api/api.js'
import { useApp } from '../AppContext.jsx'
import { Icon } from './Icons.jsx'
import { chatModelsFor, recommendModels } from '../modelPicker.js'
import { useKeyVault } from '../KeyVaultContext.jsx'

export function ProviderSetup({ onSaved, submitText = '저장' }) {
  const { config, setConfig, toast, user } = useApp()
  const keyVault = useKeyVault()
  // 로그인했을 때만 보이는 "계정에도 저장". 사용자가 건드리기 전에는, 계정에 저장된 키가 없을 때만 켜 둔다
  // (이미 저장돼 있는데 모델만 바꿔 저장할 때마다 비밀번호 창이 뜨지 않게)
  const [saveChoice, setSaveChoice] = useState(null)
  const saveToAccount = saveChoice ?? !keyVault.info
  const [draft, setDraft] = useState(() => ({ ...config, provider: config.provider || '' }))
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [error, setError] = useState('')
  const listId = useId()
  const loadSeq = useRef(0) // 불러오는 중에 회사를 바꾸면 늦게 온 결과를 버리기 위한 번호
  const providers = listProviders()
  const p = providers.find((x) => x.id === draft.provider)
  const isTest = draft.provider === 'test'

  const set = (patch) => {
    setError('')
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function loadModels() {
    const seq = ++loadSeq.current
    const provider = draft.provider
    setLoadingModels(true)
    setError('')
    try {
      const raw = await apiListModels(draft)
      if (seq !== loadSeq.current) return // 그사이 회사를 바꿨으면 버림
      const list = chatModelsFor(provider, raw) // 대화용 모델만, 최신 순
      setModels(list)
      // 비어 있거나, 목록에는 있지만 대화용이 아닌 모델(예: 음악 모델)이면 추천값으로 바꾼다.
      // 목록에 없는 이름은 사용자가 직접 쓴 별칭일 수 있어서 그대로 둔다.
      const rec = recommendModels(provider, list)
      const keep = (v) => v && (list.includes(v) || !raw.includes(v))
      setDraft((d) => ({ ...d, modelLight: keep(d.modelLight) ? d.modelLight : rec.light, modelHeavy: keep(d.modelHeavy) ? d.modelHeavy : rec.heavy }))
      toast(`대화용 모델 ${list.length}개를 불러왔어요. 키가 정상이에요.`)
    } catch (e) {
      if (seq === loadSeq.current) setError(errorMessage(e))
    } finally {
      if (seq === loadSeq.current) setLoadingModels(false)
    }
  }

  function save(e) {
    e.preventDefault()
    const next = isTest ? { ...draft, apiKey: '', modelLight: 'test-light', modelHeavy: 'test-heavy' } : draft
    if (!isConfigured(next)) {
      setError('API 키와 모델 이름(적어도 하나)을 입력해 주세요.')
      return
    }
    setConfig(next)
    toast('AI 연결을 저장했어요.')
    // 로그인했고 실제 키면: 비밀번호를 정해서 계정에도 저장 (창은 화면이 바뀌어도 유지됨)
    if (user && !isTest && saveToAccount) keyVault.openSave(next)
    onSaved?.()
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset>
        <legend className="label">1. AI 회사 고르기</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {providers.map((x) => (
            <label
              key={x.id}
              className={`card flex cursor-pointer items-center gap-3 p-3.5 transition ${
                draft.provider === x.id ? 'border-brand-500 ring-2 ring-brand-500/30 dark:border-brand-400' : 'hover:border-stone-300 dark:hover:border-stone-700'
              }`}
            >
              <input
                type="radio"
                name="provider"
                className="accent-brand-600"
                checked={draft.provider === x.id}
                onChange={() => {
                  loadSeq.current++ // 불러오던 목록은 버린다
                  setLoadingModels(false)
                  setModels([])
                  set({ provider: x.id, modelLight: '', modelHeavy: '' })
                }}
              />
              <span className="text-sm font-semibold">{x.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {p && (
        <div className="rounded-2xl bg-stone-100 p-4 text-sm dark:bg-stone-900">
          <p className="mb-2 font-semibold">{isTest ? '테스트 모드란?' : `${p.name} API 키 발급 방법`}</p>
          <ol className="space-y-1 text-stone-600 dark:text-stone-400">
            {p.guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
          {p.note && <p className="mt-2 text-xs text-stone-500">※ {p.note}</p>}
          {p.key_url && (
            <a href={p.key_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              <Icon name="link" className="size-4" /> 키 발급 페이지 열기
            </a>
          )}
        </div>
      )}

      {p && !isTest && (
        <>
          <div>
            <label className="label" htmlFor="apikey">
              2. API 키
            </label>
            <div className="flex gap-2">
              <input
                id="apikey"
                className="input font-mono"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={draft.apiKey}
                onChange={(e) => {
                  loadSeq.current++ // 키를 바꾸면 이전 키로 불러오던 목록은 버린다
                  setLoadingModels(false)
                  set({ apiKey: e.target.value.trim() })
                }}
                placeholder="붙여 넣기"
              />
              <button type="button" className="btn btn-secondary shrink-0" onClick={() => setShowKey((s) => !s)}>
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
              <input type="checkbox" className="accent-brand-600" checked={draft.rememberKey} onChange={(e) => set({ rememberKey: e.target.checked })} />
              이 브라우저에 키 기억하기 (끄면 탭을 닫을 때 지워져요)
            </label>
            {user ? (
              <label className="mt-2 flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400">
                <input type="checkbox" className="mt-0.5 accent-brand-600" checked={saveToAccount} onChange={(e) => setSaveChoice(e.target.checked)} />
                <span>
                  {keyVault.info ? '계정에 저장된 키도 이 키로 바꾸기 (API 키 비밀번호로 잠금)' : '계정에도 저장 (API 키 비밀번호로 잠금)'}
                  <span className="hint block">저장을 누르면 비밀번호를 정해요. 다른 기기에서는 로그인 후 이 비밀번호만 입력하면 돼요.</span>
                </span>
              </label>
            ) : (
              <p className="hint">키는 이 브라우저에만 저장돼요. 로그인하면 비밀번호로 잠가 계정에도 저장할 수 있어요.</p>
            )}
            <p className="hint">AI 회사 사이트에서 월 사용 한도(예산)를 꼭 설정해 두세요.</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">3. 모델 고르기</span>
              <button type="button" className="btn btn-secondary px-3 py-1.5 text-xs" disabled={!draft.apiKey || loadingModels} onClick={loadModels}>
                <Icon name="refresh" className="size-4" />
                {loadingModels ? '불러오는 중…' : '모델 목록 불러오기'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-stone-500" htmlFor="m-light">
                  일상 대화용 (저비용)
                </label>
                <input id="m-light" className="input mt-1" list={listId} value={draft.modelLight} onChange={(e) => set({ modelLight: e.target.value.trim() })} placeholder="'모델 목록 불러오기'를 누르면 추천값이 채워져요" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500" htmlFor="m-heavy">
                  캐릭터 생성·어려운 작업용 (고성능)
                </label>
                <input id="m-heavy" className="input mt-1" list={listId} value={draft.modelHeavy} onChange={(e) => set({ modelHeavy: e.target.value.trim() })} placeholder="비우면 저비용 모델 사용" />
              </div>
            </div>
            <datalist id={listId}>
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {p.models_url && (
              <p className="hint">
                모델 설명:{' '}
                <a className="underline" href={p.models_url} target="_blank" rel="noreferrer">
                  {p.models_url}
                </a>
              </p>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full" disabled={!p}>
        {submitText}
      </button>
    </form>
  )
}
