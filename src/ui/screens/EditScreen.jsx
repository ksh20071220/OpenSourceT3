/*
 * EditScreen.jsx — 직접 입력으로 만들기(/create/form) / 캐릭터 수정(/characters/:id/edit)
 * [담당: 곽수호]
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getPersona, savePersona, emptyPersona } from '../../persona/persona.js'
import { useApp } from '../AppContext.jsx'
import { useAsync } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { PersonaForm } from '../components/PersonaForm.jsx'

export function EditScreen() {
  const { id } = useParams() // 없으면 새로 만들기
  const nav = useNavigate()
  const { refreshData, toast, toastError } = useApp()
  const [busy, setBusy] = useState(false)
  const { data: rec, loading } = useAsync(() => (id ? getPersona(id) : null), [id])

  if (id && loading) return <Page>불러오는 중…</Page>
  if (id && !rec)
    return (
      <Page>
        <PageHeader title="캐릭터를 찾을 수 없어요" back="/" />
      </Page>
    )

  async function save(persona) {
    setBusy(true)
    try {
      const saved = await savePersona(persona, id ? { id } : { origin: 'form' })
      refreshData()
      toast(id ? '저장했어요.' : `'${persona.character.name}' 캐릭터를 만들었어요.`)
      nav(`/characters/${saved.id}`)
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title={id ? `${rec.persona.character.name} 수정` : '직접 입력하기'} back={id ? `/characters/${id}` : '/create'} />
      <PersonaForm key={id || 'new'} initial={id ? rec.persona : emptyPersona('', '자체 창작')} onSubmit={save} submitText={id ? '저장' : '만들기'} busy={busy} />
    </Page>
  )
}
