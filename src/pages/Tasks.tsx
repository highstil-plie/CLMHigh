import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, PageHeader } from '../components/ui'
import { cx, daysUntil, fmtDate } from '../lib/utils'
import { useCurrentUser, useStore } from '../store'

export default function Tasks() {
  const tasks = useStore((s) => s.tasks)
  const documents = useStore((s) => s.documents)
  const users = useStore((s) => s.users)
  const toggleTask = useStore((s) => s.toggleTask)
  const me = useCurrentUser()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [show, setShow] = useState<'open' | 'done'>('open')

  const list = useMemo(
    () =>
      tasks
        .filter((t) => (scope === 'mine' ? t.assigneeId === me.id : true))
        .filter((t) => t.status === show)
        .sort((a, b) => (show === 'open' ? a.dueDate.localeCompare(b.dueDate) : (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))),
    [tasks, scope, show, me.id],
  )
  const openMine = tasks.filter((t) => t.assigneeId === me.id && t.status === 'open').length
  const lateMine = tasks.filter((t) => t.assigneeId === me.id && t.status === 'open' && daysUntil(t.dueDate) < 0).length

  return (
    <div className="px-6 py-8 max-w-[1300px]">
      <PageHeader title="Tarefas" subtitle={`${openMine} tarefas abertas atribuídas a você${lateMine ? `, ${lateMine} atrasada(s)` : ''}`} />
      <div className="flex items-center gap-6 border-b border-line">
        <div className="flex">
          <button className={cx('tab', scope === 'mine' && 'tab-active')} onClick={() => setScope('mine')}>Minhas tarefas</button>
          <button className={cx('tab', scope === 'all' && 'tab-active')} onClick={() => setScope('all')}>Todas</button>
        </div>
        <div className="ml-auto flex gap-2 pb-2">
          <button className={cx('chip', show === 'open' && 'chip-active')} onClick={() => setShow('open')}>Abertas</button>
          <button className={cx('chip', show === 'done' && 'chip-active')} onClick={() => setShow('done')}>Concluídas</button>
        </div>
      </div>
      <table className="w-full mt-2">
        <thead>
          <tr className="border-b border-line">
            <th className="th w-10"></th>
            <th className="th">Tarefa</th>
            <th className="th">Documento</th>
            <th className="th">Responsável</th>
            <th className="th">Criada por</th>
            <th className="th">Prazo</th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const d = documents.find((x) => x.id === t.documentId)
            const a = users.find((u) => u.id === t.assigneeId)
            const c = users.find((u) => u.id === t.createdById)
            const late = t.status === 'open' && daysUntil(t.dueDate) < 0
            return (
              <tr key={t.id} className="border-b border-line hover:bg-gray-50">
                <td className="td"><input type="checkbox" className="h-4 w-4 accent-primary" checked={t.status === 'done'} onChange={() => toggleTask(t.id)} /></td>
                <td className={cx('td', t.status === 'done' && 'line-through text-gray-500')}>{t.title}</td>
                <td className="td">{d ? <Link className="text-brand hover:underline" to={`/clm/documentos/${d.id}`}>{d.code}</Link> : '—'}</td>
                <td className="td">
                  <span className="inline-flex items-center gap-2">{a && <Avatar name={a.name} initials={a.initials} size={24} />}{a?.name}</span>
                </td>
                <td className="td text-gray-700">{t.createdById === 'workflow' ? 'Workflow' : c?.name}</td>
                <td className={cx('td whitespace-nowrap', late && 'text-red-600 font-medium')}>{fmtDate(t.dueDate)}{late && ' · atrasada'}</td>
              </tr>
            )
          })}
          {list.length === 0 && (
            <tr>
              <td className="td text-center text-gray-500 py-16" colSpan={6}>Nenhuma tarefa {show === 'open' ? 'aberta' : 'concluída'}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
