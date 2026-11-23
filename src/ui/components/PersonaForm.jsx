/*
 * PersonaForm.jsx — 페르소나를 칸마다 직접 입력·수정하는 양식
 * [담당: 곽수호]   형식 검사는 persona 모듈의 validatePersona 가 한다.
 *
 * 양식에 없는 필드(evidence 등)는 건드리지 않고 그대로 보존한다.
 */
import { useState } from 'react'
import { validatePersona } from '../../persona/persona.js'
import { Icon } from './Icons.jsx'

/** 문자열 목록 (가치관, 잘하는 분야 등) — 칩 + 추가 입력칸 */
function StringList({ id, label, hint, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="chip">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`${v} 삭제`} className="-mr-1 rounded-full p-0.5 hover:bg-stone-300 dark:hover:bg-stone-700">
                <Icon name="x" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className="input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={add}>
          추가
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/** 객체 목록 (성격 특성, 행동 원칙 등) — 줄마다 여러 칸 */
function RowList({ label, hint, rows, onChange, fields, makeEmpty, addText }) {
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div>
      <p className="label">{label}</p>
      {hint && <p className="hint -mt-1 mb-2">{hint}</p>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 rounded-xl bg-stone-100 p-2.5 dark:bg-stone-900">
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                  {f.type === 'select' ? (
                    <select className="input py-2" value={row[f.key] ?? ''} onChange={(e) => update(i, { [f.key]: e.target.value })} aria-label={f.label}>
                      {f.options.map(([v, t]) => (
                        <option key={v} value={v}>
                          {f.label}: {t}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'range' ? (
                    <label className="flex items-center gap-2 text-xs text-stone-500">
                      {f.label}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        className="flex-1 accent-brand-600"
                        value={row[f.key] ?? 0.5}
                        onChange={(e) => update(i, { [f.key]: Number(e.target.value) })}
                      />
                      <span className="w-7 tabular-nums">{(row[f.key] ?? 0.5).toFixed(1)}</span>
                    </label>
                  ) : (
                    <input className="input py-2" value={row[f.key] ?? ''} placeholder={f.label} aria-label={f.label} onChange={(e) => update(i, { [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="icon-btn size-8 shrink-0" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="이 줄 삭제">
              <Icon name="x" className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-ghost mt-2 px-2 py-1.5 text-sm" onClick={() => onChange([...rows, makeEmpty()])}>
        <Icon name="plus" className="size-4" /> {addText}
      </button>
    </div>
  )
}

const LEVEL = [
  ['low', '낮음'],
  ['medium', '보통'],
  ['high', '높음'],
]

/** 빈 칸은 저장 전에 정리 (빈 줄·빈 문자열 제거) */
function clean(p) {
  const out = structuredClone(p)
  out.character.name = out.character.name.trim()
  out.character.source = out.character.source?.trim() || '자체 창작'
  const ps = out.personality
  ps.traits = ps.traits.filter((t) => t.name?.trim())
  ps.speech_style.sample_lines = (ps.speech_style.sample_lines || []).map((s) => s.trim()).filter(Boolean)
  out.behavior_rules = out.behavior_rules.filter((r) => r.condition?.trim() && r.response?.trim())
  out.uncertainties = out.uncertainties.filter((u) => u.question?.trim())
  for (const r of out.behavior_rules) if (!r.exception) delete r.exception
  return out
}

/** 양식에 필요한 필드가 없으면 기본값으로 채운다 (예전 형식·가져온 파일 대비) */
function withDefaults(p) {
  const x = structuredClone(p)
  x.character ||= { name: '', source: '' }
  x.personality ||= {}
  x.personality.traits ||= []
  x.personality.values ||= []
  x.personality.speech_style = { formality: 'informal', expressiveness: 'medium', tone: '', sample_lines: [], ...(x.personality.speech_style || {}) }
  x.personality.speech_style.sample_lines ||= []
  x.behavior_rules ||= []
  x.expertise = { strengths: [], limitations: [], ...(x.expertise || {}) }
  x.uncertainties ||= []
  return x
}

export function PersonaForm({ initial, onSubmit, submitText = '저장', busy }) {
  const [p, setP] = useState(() => withDefaults(initial))
  const [errors, setErrors] = useState([])
  const edit = (fn) =>
    setP((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  const style = p.personality.speech_style

  function submit(e) {
    e.preventDefault()
    const cleaned = clean(p)
    const check = validatePersona(cleaned)
    setErrors(check.errors)
    if (check.ok) onSubmit(cleaned)
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="section-title">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-name">
              이름 <span className="text-red-500">*</span>
            </label>
            <input id="pf-name" className="input" required maxLength={40} value={p.character.name} onChange={(e) => edit((x) => (x.character.name = e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="pf-source">
              작품명
            </label>
            <input id="pf-source" className="input" maxLength={60} value={p.character.source} onChange={(e) => edit((x) => (x.character.source = e.target.value))} placeholder="자체 창작" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pf-ver">
            설정 기준
          </label>
          <input id="pf-ver" className="input" value={p.character.setting_version || ''} onChange={(e) => edit((x) => (x.character.setting_version = e.target.value))} placeholder="예: 원작 3권까지, 초기 설정" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">말투</h2>
        <div>
          <label className="label" htmlFor="pf-tone">
            말투 설명
          </label>
          <input id="pf-tone" className="input" value={style.tone} onChange={(e) => edit((x) => (x.personality.speech_style.tone = e.target.value))} placeholder="예: 차분하고 직설적, 가끔 농담" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-formal">
              존댓말 / 반말
            </label>
            <select id="pf-formal" className="input" value={style.formality} onChange={(e) => edit((x) => (x.personality.speech_style.formality = e.target.value))}>
              <option value="informal">반말</option>
              <option value="formal">존댓말</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-expr">
              감정 표현
            </label>
            <select id="pf-expr" className="input" value={style.expressiveness} onChange={(e) => edit((x) => (x.personality.speech_style.expressiveness = e.target.value))}>
              {LEVEL.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <RowList
          label="대사 예시"
          hint="저비용 모델은 설명보다 예시 대사를 더 잘 따라 해요. 2~4개 추천."
          rows={style.sample_lines.map((s) => ({ line: s }))}
          onChange={(rows) => edit((x) => (x.personality.speech_style.sample_lines = rows.map((r) => r.line ?? '')))}
          fields={[{ key: 'line', label: '이 캐릭터가 할 법한 한마디', wide: true }]}
          makeEmpty={() => ({ line: '' })}
          addText="대사 추가"
        />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">성격과 가치관</h2>
        <RowList
          label="성격 특성"
          rows={p.personality.traits}
          onChange={(rows) => edit((x) => (x.personality.traits = rows))}
          fields={[
            { key: 'name', label: '특성 (예: 냉정함)' },
            { key: 'strength', label: '강도', type: 'range' },
          ]}
          makeEmpty={() => ({ name: '', strength: 0.5, confidence: 'high', basis: 'explicit' })}
          addText="특성 추가"
        />
        <StringList id="pf-values" label="가치관" values={p.personality.values} onChange={(v) => edit((x) => (x.personality.values = v))} placeholder="예: 동료의 안전" />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">행동 원칙</h2>
        <RowList
          label="이런 상황에서는 이렇게 행동한다"
          hint="새로운 상황에서도 캐릭터답게 판단하는 데 가장 중요한 부분이에요."
          rows={p.behavior_rules}
          onChange={(rows) => edit((x) => (x.behavior_rules = rows))}
          fields={[
            { key: 'condition', label: '상황 (예: 동료가 위험할 때)' },
            { key: 'response', label: '행동 (예: 자신을 희생해서라도 구한다)' },
            { key: 'exception', label: '예외 (선택)' },
            { key: 'priority', label: '중요도', type: 'select', options: LEVEL },
          ]}
          makeEmpty={() => ({ condition: '', response: '', priority: 'medium' })}
          addText="원칙 추가"
        />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">전문성</h2>
        <p className="hint -mt-2">학습·실무 목적으로 대화할 때 참고해요.</p>
        <StringList id="pf-str" label="잘하는 분야" values={p.expertise.strengths} onChange={(v) => edit((x) => (x.expertise.strengths = v))} placeholder="예: 전략 수립" />
        <StringList id="pf-lim" label="못하는 분야" values={p.expertise.limitations} onChange={(v) => edit((x) => (x.expertise.limitations = v))} placeholder="예: 감정 표현" />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">아직 정하지 않은 부분</h2>
        <RowList
          label="확실하지 않은 점"
          hint="여기 적은 상황이 오면 캐릭터 성격에 맞게 추론하되 단정하지 않아요."
          rows={p.uncertainties}
          onChange={(rows) => edit((x) => (x.uncertainties = rows))}
          fields={[{ key: 'question', label: '예: 낯선 사람에게도 친절한가?', wide: true }]}
          makeEmpty={() => ({ question: '', status: 'unresolved' })}
          addText="항목 추가"
        />
      </section>

      {errors.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
          <p className="font-semibold">고쳐야 할 부분</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="sticky bottom-20 md:bottom-4">
        <button className="btn btn-primary w-full shadow-lg" disabled={busy}>
          {submitText}
        </button>
      </div>
    </form>
  )
}
