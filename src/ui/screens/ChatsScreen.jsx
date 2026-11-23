/*
 * ChatsScreen.jsx — 대화 목록 (최근 대화한 캐릭터 순)
 * [담당: 곽수호]
 */
import { Link } from 'react-router'
import { listConversations } from '../../memory/memory.js'
import { listPersonas } from '../../persona/persona.js'
import { getPurpose } from '../../common/purposes.js'
import { useApp } from '../AppContext.jsx'
import { useAsync, timeAgo } from '../hooks.js'
import { Page, PageHeader } from '../components/Layout.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { chatUrl } from './CharacterScreen.jsx'

export function ChatsScreen() {
  const { dataVersion, ready } = useApp()
  const { data } = useAsync(async () => {
    if (!ready) return []
    const [convs, personas] = await Promise.all([listConversations(), listPersonas()])
    const byId = new Map(personas.map((p) => [p.id, p]))
    return convs.filter((c) => byId.has(c.personaId)).map((c) => ({ ...c, rec: byId.get(c.personaId) }))
  }, [dataVersion, ready])

  return (
    <Page>
      <PageHeader title="대화" />
      {data?.length === 0 && (
        <p className="py-16 text-center text-sm text-stone-500">
          아직 대화가 없어요.{' '}
          <Link to="/" className="font-semibold text-brand-700 underline dark:text-brand-400">
            캐릭터를 골라
          </Link>{' '}
          대화를 시작해 보세요.
        </p>
      )}
      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {(data || []).map((c) => {
          const name = c.rec.persona.character.name
          // 마지막으로 쓴 목적으로 이어서 대화 (목적을 알 수 없으면 일상 대화)
          const pid = c.last?.purposeId && getPurpose(c.last.purposeId) ? c.last.purposeId : 'chat_daily'
          return (
            <li key={c.personaId}>
              <Link to={chatUrl(c.personaId, pid)} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-stone-100 dark:hover:bg-stone-900">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{name}</p>
                    <span className="shrink-0 text-xs text-stone-400">{timeAgo(c.updatedAt)}</span>
                  </div>
                  <p className="truncate text-sm text-stone-500 dark:text-stone-400">
                    {c.last?.role === 'user' ? '나: ' : ''}
                    {c.last?.content}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
