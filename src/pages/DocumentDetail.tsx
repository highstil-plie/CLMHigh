import { ChevronDown, ChevronLeft, ChevronUp, Clock, Copy, Download, GitBranch, Info, ListChecks, MessageSquare, Search, Tag, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Modal, StatusBadge, useToast } from '../components/ui'
import { AssinafyPanel, SignatureDialog } from '../components/SignatureDialog'
import { firebaseEnabled } from '../lib/firebase'
import { renderDocument, renderPlainText } from '../lib/engine'
import { cx, daysUntil, downloadText, fmtCurrency, fmtDate, fmtDateTime, fromInputDate, relativeTime, toInputDate } from '../lib/utils'
import { useCurrentUser, useStore } from '../store'
import type { Document } from '../types'

type Panel = 'info' | 'tags' | 'tasks' | 'history' | 'versions' | 'comments' | 'workflow'

export function DocumentPaper({ doc, className }: { doc: Document; className?: string }) {
  const templates = useStore((s) => s.templates)
  const parties = useStore((s) => s.parties)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const users = useStore((s) => s.users)
  const tpl = templates.find((t) => t.id === doc.templateId)
  const party = parties.find((p) => p.id === doc.partyId)
  const owner = users.find((u) => u.id === doc.ownerId)
  const blocks = useMemo(() => (tpl ? renderDocument({ template: tpl, data: doc.formData, party, company, clauses, owner, createdAt: doc.createdAt }) : []), [tpl, doc, party, company, clauses, owner])
  return (
    <div className={cx('doc-paper bg-white shadow-lg mx-auto max-w-[900px] px-16 py-14 min-h-[1100px]', className)}>
      <div className="logo">{company.name}</div>
      {blocks.map((b, i) => {
        if (b.kind === 'title') return <h1 key={i}>{b.text}</h1>
        if (b.kind === 'h2') return <h2 key={i}>{b.text}</h2>
        if (b.kind === 'clause')
          return (
            <p key={i}>
              <b>{b.title}</b> {b.text}
            </p>
          )
        if (b.kind === 'signature') {
          const [a, c] = b.text.split('||')
          return (
            <div key={i} className="sig">
              <div>
                <b>{a}</b>
                <br />
                Representante legal
              </div>
              <div>
                <b>{c}</b>
                <br />
                Representante legal
              </div>
            </div>
          )
        }
        return <p key={i}>{b.text}</p>
      })}
      {!tpl && <p className="text-gray-500 text-center mt-20">Pré-visualização indisponível para este documento.</p>}
    </div>
  )
}

export default function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const doc = useStore((s) => s.documents.find((d) => d.id === id))
  const users = useStore((s) => s.users)
  const parties = useStore((s) => s.parties)
  const tasks = useStore((s) => s.tasks)
  const templates = useStore((s) => s.templates)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const addComment = useStore((s) => s.addComment)
  const resolveComment = useStore((s) => s.resolveComment)
  const addTask = useStore((s) => s.addTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const completeStep = useStore((s) => s.completeStep)
  const reopenDocument = useStore((s) => s.reopenDocument)
  const updateDocument = useStore((s) => s.updateDocument)
  const me = useCurrentUser()
  const { toast, node: toastNode } = useToast()

  const [panel, setPanel] = useState<Panel | null>('comments')
  const [comment, setComment] = useState('')
  const [page, setPage] = useState(1)
  const [taskModal, setTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(me.id)
  const [taskDue, setTaskDue] = useState(toInputDate(new Date(Date.now() + 3 * 86400000).toISOString()))
  const [rejectNote, setRejectNote] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [signDialog, setSignDialog] = useState(false)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const [caretBump, setCaretBump] = useState(0)

  useEffect(() => {
    if (caretBump === 0) return
    const el = commentRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [caretBump])

  if (!doc) {
    return (
      <div className="p-10 text-center">
        <p>Documento não encontrado.</p>
        <Link to="/clm/documentos" className="text-brand hover:underline">Voltar para documentos</Link>
      </div>
    )
  }

  const party = parties.find((p) => p.id === doc.partyId)
  const user = (uid?: string) => users.find((u) => u.id === uid)
  const docTasks = tasks.filter((t) => t.documentId === doc.id)
  const openTasks = docTasks.filter((t) => t.status === 'open')
  const myTaskCount = openTasks.filter((t) => t.assigneeId === me.id).length
  const currentStep = doc.workflow.find((w) => w.status === 'in_progress')
  const canAct = currentStep && (currentStep.assigneeId === me.id || currentStep.assigneeId === undefined || me.role.startsWith('Diretor'))
  const rejectedStep = doc.workflow.find((w) => w.status === 'rejected')

  const RAIL: { id: Panel; icon: ReactNode; label: string; badge?: number }[] = [
    { id: 'info', icon: <Info size={20} />, label: 'Informações' },
    { id: 'tags', icon: <Tag size={20} />, label: 'Tags' },
    { id: 'tasks', icon: <ListChecks size={20} />, label: 'Tarefas', badge: myTaskCount },
    { id: 'history', icon: <Clock size={20} />, label: 'Histórico' },
    { id: 'versions', icon: <Copy size={20} />, label: 'Versões' },
    { id: 'comments', icon: <MessageSquare size={20} />, label: 'Comentários', badge: doc.comments.filter((c) => !c.resolved).length || undefined },
    { id: 'workflow', icon: <GitBranch size={20} />, label: 'Fluxo de trabalho' },
  ]

  const submitComment = () => {
    if (!comment.trim()) return
    addComment(doc.id, comment.trim())
    const mentioned = users.filter((u) => comment.includes(`@${u.name}`) && u.id !== me.id)
    toast(mentioned.length ? `Comentário publicado. Tarefa atribuída a ${mentioned.map((m) => m.name).join(', ')}.` : 'Comentário publicado')
    setComment('')
  }

  const exportDoc = () => {
    const tpl = templates.find((t) => t.id === doc.templateId)
    if (!tpl) return toast('Sem conteúdo para exportar')
    const text = renderPlainText({ template: tpl, data: doc.formData, party, company, clauses, createdAt: doc.createdAt })
    downloadText(doc.name.replace(/\.(docx|pdf)$/, '.txt'), text)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {toastNode}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-line bg-white">
        <button className="p-1 rounded hover:bg-gray-100" onClick={() => navigate(-1)} aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <div className="font-medium truncate">{doc.name}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <StatusBadge status={doc.status} />
            <span>{party?.name}</span>
            <span>·</span>
            <span>Modificado {relativeTime(doc.modifiedAt)}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {rejectedStep && (
            <button className="btn-secondary" onClick={() => { reopenDocument(doc.id); toast('Documento reaberto') }}>Reabrir após ajustes</button>
          )}
          {currentStep && canAct && !rejectedStep && (
            <>
              <button className="btn-secondary" onClick={() => setRejectModal(true)}>Rejeitar</button>
              {currentStep.name === 'Assinatura em Andamento' && firebaseEnabled && !doc.assinafy ? (
                <button className="btn-primary" onClick={() => setSignDialog(true)}>Enviar para assinatura</button>
              ) : (
                <button className="btn-primary" onClick={() => { completeStep(doc.id, 'approve'); toast(`${currentStep.name} concluída`) }}>
                  {currentStep.name === 'Assinatura em Andamento' ? 'Marcar como assinado' : currentStep.name === 'Revisão Externa' ? 'Concluir revisão externa' : `Aprovar ${currentStep.name}`}
                </button>
              )}
            </>
          )}
          {currentStep && !canAct && !rejectedStep && (
            <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">Aguardando {user(currentStep.assigneeId)?.name ?? 'responsável'} · {currentStep.name}</span>
          )}
          <button className="btn-ghost" onClick={exportDoc} title="Exportar">
            <Download size={18} />
          </button>
          <Avatar name={me.name} initials={me.initials} size={34} color="bg-teal" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-16 border-r border-line bg-white flex flex-col items-center py-3 gap-1">
          {RAIL.map((r) => (
            <button key={r.id} className={cx('relative p-2.5 rounded hover:bg-gray-100 text-gray-700', panel === r.id && 'bg-gray-200 text-ink')} title={r.label} onClick={() => setPanel(panel === r.id ? null : r.id)}>
              {r.icon}
              {r.badge ? <span className="absolute -top-0.5 -right-0.5 rounded-full bg-red-600 text-white text-[10px] px-1.5 leading-4">{r.badge}</span> : null}
            </button>
          ))}
        </div>

        {panel && (
          <aside className="w-[340px] border-r border-line bg-white flex flex-col min-h-0">
            <div className="flex items-start justify-between px-6 pt-6 pb-2">
              <h2 className="text-3xl font-medium">{RAIL.find((r) => r.id === panel)?.label}</h2>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setPanel(null)} aria-label="Fechar painel">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto flex-1 text-sm">
              {panel === 'comments' && (
                <>
                  <div className="flex items-center gap-2 font-medium text-lg mb-3">Todos <ChevronDown size={16} className="text-gray-500" /></div>
                  {myTaskCount > 0 && <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-t">Tarefa atribuída a <b>Mim</b></div>}
                  <ul className="space-y-3">
                    {doc.comments.map((c) => {
                      const a = user(c.authorId)
                      return (
                        <li key={c.id} className={cx('border border-line rounded p-3', c.resolved && 'opacity-60')}>
                          <div className="flex items-center gap-2">
                            <Avatar name={a?.name ?? ''} initials={a?.initials ?? '?'} size={30} />
                            <div className="flex-1">
                              <div className="font-semibold">{a?.name}</div>
                              <div className="text-xs text-gray-500">{fmtDateTime(c.createdAt)}</div>
                            </div>
                            <button className="text-xs text-gray-500 hover:text-ink" onClick={() => resolveComment(doc.id, c.id)}>{c.resolved ? 'Reabrir' : 'Resolver'}</button>
                          </div>
                          <p className="mt-2 leading-relaxed">
                            {c.text.split(/(@[A-Za-zÀ-ú]+(?:\s[A-Za-zÀ-ú]+)?)/g).map((part, i) => (users.some((u) => `@${u.name}` === part) ? <span key={i} className="text-brand font-medium">{part}</span> : <span key={i}>{part}</span>))}
                          </p>
                        </li>
                      )
                    })}
                    {doc.comments.length === 0 && <li className="text-gray-500 py-4">Nenhum comentário ainda.</li>}
                  </ul>
                  <div className="mt-4 relative">
                    <textarea
                      ref={commentRef}
                      className="input min-h-[90px]"
                      placeholder="Escreva um comentário. Use @ para mencionar e criar uma tarefa."
                      value={comment}
                      onChange={(e) => { setComment(e.target.value); setMentionOpen(/@[^\s@]*$/.test(e.target.value)) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment() }}
                    />
                    {mentionOpen && (
                      <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-line rounded shadow-lg max-h-48 overflow-y-auto z-10">
                        {users
                          .filter((u) => u.name.toLowerCase().includes((comment.match(/@([^\s@]*)$/)?.[1] ?? '').toLowerCase()))
                          .map((u) => (
                            <button
                              key={u.id}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setComment((c) => c.replace(/@[^\s@]*$/, `@${u.name} `))
                                setMentionOpen(false)
                                setCaretBump((n) => n + 1)
                              }}
                            >
                              <Avatar name={u.name} initials={u.initials} size={22} /> {u.name} <span className="text-xs text-gray-500 ml-auto">{u.role.split(' - ')[0]}</span>
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">Ctrl+Enter para publicar</span>
                      <button className="btn-primary py-1.5" onClick={submitComment} disabled={!comment.trim()}>Publicar</button>
                    </div>
                  </div>
                </>
              )}

              {panel === 'tasks' && (
                <>
                  <button className="btn-secondary w-full mb-4" onClick={() => setTaskModal(true)}>Nova tarefa</button>
                  <ul className="space-y-2">
                    {docTasks.map((t) => (
                      <li key={t.id} className="border border-line rounded p-3 flex gap-3">
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={t.status === 'done'} onChange={() => toggleTask(t.id)} />
                        <div className="min-w-0">
                          <div className={cx(t.status === 'done' && 'line-through text-gray-500')}>{t.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Para <b>{user(t.assigneeId)?.name}</b> · Prazo {fmtDate(t.dueDate)} {t.status === 'open' && daysUntil(t.dueDate) < 0 && <span className="text-red-600">(atrasada)</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                    {docTasks.length === 0 && <li className="text-gray-500">Nenhuma tarefa para este documento.</li>}
                  </ul>
                </>
              )}

              {panel === 'workflow' && (
                <ol className="relative border-l-2 border-line ml-3 space-y-5 mt-2">
                  {doc.workflow.map((w) => (
                    <li key={w.id} className="pl-5 relative">
                      <span
                        className={cx(
                          'absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white',
                          w.status === 'done' ? 'bg-teal' : w.status === 'in_progress' ? 'bg-primary ring-4 ring-primary/20' : w.status === 'rejected' ? 'bg-red-600' : 'bg-gray-300',
                        )}
                      />
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-gray-600">
                        {w.status === 'done' && <>Concluída {w.completedAt ? fmtDateTime(w.completedAt) : ''} {w.durationHours ? `· ${w.durationHours} h` : ''}</>}
                        {w.status === 'in_progress' && <>Em andamento desde {fmtDateTime(w.startedAt)}</>}
                        {w.status === 'pending' && 'Pendente'}
                        {w.status === 'rejected' && <span className="text-red-600">Rejeitada {fmtDateTime(w.completedAt)}</span>}
                      </div>
                      {w.assigneeId && <div className="text-xs text-gray-600">Responsável: {user(w.assigneeId)?.name}</div>}
                      {w.note && <div className="text-xs text-gray-500 italic mt-0.5">{w.note}</div>}
                    </li>
                  ))}
                </ol>
              )}

              {panel === 'info' && (
                <dl className="space-y-3">
                  <Row k="ID" v={doc.code} />
                  <Row k="Tipo" v={doc.type} />
                  <Row k="Parte" v={party ? <Link className="text-brand hover:underline" to={`/clm/partes/${party.id}`}>{party.name}</Link> : '—'} />
                  <Row k="Proprietário" v={user(doc.ownerId)?.name ?? '—'} />
                  <Row k="Valor contratual" v={fmtCurrency(doc.value)} />
                  <Row k="Prazo" v={`${doc.termMonths} meses`} />
                  <Row k="Início" v={fmtDate(doc.startDate)} />
                  <Row
                    k="Término"
                    v={
                      <input type="date" className="input py-1" value={toInputDate(doc.endDate)} onChange={(e) => e.target.value && updateDocument(doc.id, { endDate: fromInputDate(e.target.value) })} />
                    }
                  />
                  <Row k="Localização" v={doc.location} />
                  <Row k="Geografia" v={doc.region} />
                  <Row k="Páginas" v={String(doc.pages)} />
                  <Row k="Criado em" v={fmtDateTime(doc.createdAt)} />
                  <Row k="Descrição" v={<textarea className="input" rows={3} defaultValue={doc.description} onBlur={(e) => e.target.value !== doc.description && updateDocument(doc.id, { description: e.target.value })} />} />
                  {doc.assinafy && <Row k="Assinatura" v={<AssinafyPanel doc={doc} />} />}
                  {doc.attachments.length > 0 && <Row k="Anexos" v={doc.attachments.map((a) => <div key={a.id}>{a.name} <span className="text-gray-500">({Math.round(a.size / 1024)} KB)</span></div>)} />}
                </dl>
              )}

              {panel === 'tags' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {doc.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                        <button onClick={() => updateDocument(doc.id, { tags: doc.tags.filter((x) => x !== t) })} aria-label="Remover"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (tagInput.trim() && !doc.tags.includes(tagInput.trim())) updateDocument(doc.id, { tags: [...doc.tags, tagInput.trim()] })
                      setTagInput('')
                    }}
                  >
                    <input className="input" placeholder="Nova tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
                    <button className="btn-secondary">Adicionar</button>
                  </form>
                </>
              )}

              {panel === 'history' && (
                <ul className="space-y-3">
                  {[...doc.versions.map((v) => ({ at: v.createdAt, text: `Versão ${v.number}: ${v.note}`, by: user(v.createdById)?.name ?? 'Workflow' })),
                    ...doc.comments.map((c) => ({ at: c.createdAt, text: 'Comentário adicionado', by: user(c.authorId)?.name ?? '' })),
                    ...doc.workflow.filter((w) => w.completedAt).map((w) => ({ at: w.completedAt!, text: `${w.name} ${w.status === 'rejected' ? 'rejeitada' : 'concluída'}`, by: user(w.assigneeId)?.name ?? 'Workflow' }))]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((h, i) => (
                      <li key={i} className="border-l-2 border-line pl-3">
                        <div>{h.text}</div>
                        <div className="text-xs text-gray-500">{h.by} · {fmtDateTime(h.at)}</div>
                      </li>
                    ))}
                </ul>
              )}

              {panel === 'versions' && (
                <ul className="space-y-2">
                  {[...doc.versions].reverse().map((v) => (
                    <li key={v.id} className="border border-line rounded p-3">
                      <div className="font-medium">Versão {v.number}{v.number === doc.versions.length && <span className="ml-2 text-xs bg-teal-100 text-teal-800 rounded px-1.5 py-0.5">atual</span>}</div>
                      <div className="text-xs text-gray-600">{v.note}</div>
                      <div className="text-xs text-gray-500">{user(v.createdById)?.name ?? 'Workflow'} · {fmtDateTime(v.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 bg-gray-100 overflow-y-auto relative">
          <div className="py-8 px-6">
            <DocumentPaper doc={doc} />
          </div>
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white shadow-lg border border-line rounded flex items-center gap-2 px-3 py-1.5 text-sm">
              <Search size={16} className="text-gray-500" />
              <input className="w-10 text-center border border-gray-300 rounded py-0.5" value={page} onChange={(e) => setPage(Math.min(doc.pages, Math.max(1, Number(e.target.value) || 1)))} />
              <span className="text-gray-600">/ {doc.pages}</span>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior"><ChevronUp size={16} /></button>
              <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setPage((p) => Math.min(doc.pages, p + 1))} aria-label="Próxima página"><ChevronDown size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title="Nova tarefa"
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTaskModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!taskTitle.trim()} onClick={() => { addTask(doc.id, taskTitle.trim(), taskAssignee, fromInputDate(taskDue)); setTaskTitle(''); setTaskModal(false); toast('Tarefa criada') }}>Criar tarefa</button>
          </>
        }
      >
        <label className="label req">Título</label>
        <input className="input mb-4" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} autoFocus />
        <label className="label req">Responsável</label>
        <select className="input mb-4" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="label req">Prazo</label>
        <input type="date" className="input" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
      </Modal>

      <SignatureDialog doc={doc} open={signDialog} onClose={() => setSignDialog(false)} onSent={(m) => toast(m)} />

      <Modal
        open={rejectModal}
        onClose={() => setRejectModal(false)}
        title={`Rejeitar: ${currentStep?.name ?? ''}`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRejectModal(false)}>Cancelar</button>
            <button className="btn-danger" onClick={() => { completeStep(doc.id, 'reject', rejectNote); setRejectModal(false); setRejectNote(''); toast('Etapa rejeitada') }}>Rejeitar</button>
          </>
        }
      >
        <label className="label">Motivo</label>
        <textarea className="input" rows={4} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Descreva os ajustes necessários" />
      </Modal>
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  )
}
