import { ChevronDown, FileText, Search, SlidersHorizontal, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Checkbox, Modal, SortHeader, StatusBadge, useToast } from '../components/ui'
import { renderDocument } from '../lib/engine'
import { daysUntil, fmtDate, fmtTime, highlight, normalize, cx } from '../lib/utils'
import { useStore } from '../store'
import type { DocStatus, DocType, Document } from '../types'

type SortField = 'name' | 'description' | 'location' | 'modifiedBy' | 'modifiedAt' | 'status' | 'value' | 'endDate'

const ALL_FILTERS: { id: string; label: string }[] = [
  { id: 'createdAt', label: 'Data de criação' },
  { id: 'modifiedAt', label: 'Data de modificação' },
  { id: 'description', label: 'Descrição' },
  { id: 'code', label: 'ID' },
  { id: 'location', label: 'Localização' },
  { id: 'endDate', label: 'Data de validade' },
  { id: 'party', label: 'Parte' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Tipo de documento' },
  { id: 'value', label: 'Valor contratual' },
  { id: 'owner', label: 'Proprietário' },
  { id: 'region', label: 'Geografia' },
  { id: 'tags', label: 'Tags' },
  { id: 'excludes', label: 'Não contém' },
]

const STATUSES: DocStatus[] = ['Rascunho', 'Revisão Jurídica', 'Revisão Financeira', 'Revisão Externa', 'Aprovação Executiva', 'Assinatura em Andamento', 'Assinado', 'Expirado', 'Rejeitado']

export default function Documents() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const documents = useStore((s) => s.documents)
  const parties = useStore((s) => s.parties)
  const users = useStore((s) => s.users)
  const templates = useStore((s) => s.templates)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const favorites = useStore((s) => s.favoriteFilters)
  const toggleFavorite = useStore((s) => s.toggleFavoriteFilter)
  const applied = useStore((s) => s.appliedFilters)
  const setApplied = useStore((s) => s.setAppliedFilters)
  const deleteDocuments = useStore((s) => s.deleteDocuments)
  const { toast, node: toastNode } = useToast()

  const [q, setQ] = useState(params.get('q') ?? '')
  const [statusF, setStatusF] = useState<string>(params.get('status') ?? '')
  const [partyF, setPartyF] = useState<string>(params.get('party') ?? '')
  const [typeF, setTypeF] = useState<string>('')
  const [expF, setExpF] = useState<string>(params.get('expirando') ?? '')
  const [excl, setExcl] = useState('')
  const [createdF, setCreatedF] = useState<string>('365')
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'starred'>('all')
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'modifiedAt', dir: 'desc' })
  const [showFolders, setShowFolders] = useState(false)
  const [pendingApplied, setPendingApplied] = useState<string[]>(applied)

  useEffect(() => {
    setQ(params.get('q') ?? '')
    if (params.get('status')) setStatusF(params.get('status')!)
    if (params.get('expirando')) setExpF(params.get('expirando')!)
    if (params.get('party')) setPartyF(params.get('party')!)
  }, [params])

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? '—'
  const userName = (id: string) => (id === 'workflow' ? 'Workflow' : users.find((u) => u.id === id)?.name ?? '—')
  const userEmail = (id: string) => (id === 'workflow' ? '' : users.find((u) => u.id === id)?.email ?? '')

  const snippets = useMemo(() => {
    const m = new Map<string, string>()
    if (!q.trim()) return m
    const nq = normalize(q)
    for (const d of documents) {
      const tpl = templates.find((t) => t.id === d.templateId)
      const party = parties.find((p) => p.id === d.partyId)
      let text = d.description
      if (tpl) {
        const blocks = renderDocument({ template: tpl, data: d.formData, party, company, clauses, createdAt: d.createdAt })
        const full = blocks.filter((b) => b.kind !== 'signature').map((b) => (b.title ? b.title + ' ' : '') + b.text).join(' ')
        const idx = normalize(full).indexOf(nq)
        text = idx >= 0 ? full.slice(Math.max(0, idx - 90), idx + 90) : full.slice(0, 180)
      }
      m.set(d.id, text)
    }
    return m
  }, [q, documents, templates, parties, company, clauses])

  const filtered = useMemo(() => {
    const nq = normalize(q)
    const nex = normalize(excl)
    let list = documents.filter((d) => {
      if (nq) {
        const hay = normalize(`${d.name} ${d.code} ${d.description} ${d.type} ${partyName(d.partyId)} ${d.tags.join(' ')} ${snippets.get(d.id) ?? ''}`)
        if (!hay.includes(nq)) return false
      }
      if (nex && normalize(`${d.name} ${d.description} ${d.type} ${partyName(d.partyId)}`).includes(nex)) return false
      if (statusF === 'andamento') {
        if (['Assinado', 'Expirado', 'Rascunho', 'Rejeitado'].includes(d.status)) return false
      } else if (statusF && d.status !== statusF) return false
      if (partyF && d.partyId !== partyF) return false
      if (typeF && d.type !== typeF) return false
      if (expF) {
        const du = daysUntil(d.endDate)
        if (du < 0 || du > Number(expF)) return false
      }
      if (createdF && createdF !== 'all') {
        if (new Date(d.createdAt).getTime() < Date.now() - Number(createdF) * 86400000) return false
      }
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = (d: Document): string | number => {
      switch (sort.field) {
        case 'name': return d.name.toLowerCase()
        case 'description': return d.description.toLowerCase()
        case 'location': return d.location.toLowerCase()
        case 'modifiedBy': return userName(d.modifiedById).toLowerCase()
        case 'status': return d.status
        case 'value': return d.value
        case 'endDate': return d.endDate
        default: return d.modifiedAt
      }
    }
    list = [...list].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, q, excl, statusF, partyF, typeF, expF, createdF, sort, snippets])

  const folders = useMemo(() => {
    const m = new Map<string, number>()
    filtered.forEach((d) => m.set(d.location, (m.get(d.location) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  const onSort = (f: SortField) => setSort((s) => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))
  const allChecked = filtered.length > 0 && filtered.every((d) => selected.includes(d.id))

  const filterList = ALL_FILTERS.filter((f) => normalize(f.label).includes(normalize(filterSearch))).filter((f) => (tab === 'starred' ? favorites.includes(f.id) : true))

  const activeChip = (on: boolean) => cx('chip', on && 'chip-active')

  return (
    <div className="px-6 py-8 max-w-[1500px]">
      {toastNode}
      <h1 className="text-3xl font-semibold tracking-tight">
        {q ? (
          <>
            {filtered.length} resultados para: “{q}”
          </>
        ) : (
          <>Documentos <span className="text-lg text-gray-500 font-normal ml-2">{filtered.length} itens</span></>
        )}
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            setParams(q ? { q } : {})
          }}
        >
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-10 pr-9 w-[380px] py-2.5" placeholder="Pesquisar em documentos e conteúdo" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-ink" onClick={() => { setQ(''); setParams({}) }} aria-label="Limpar">
              <X size={18} />
            </button>
          )}
        </form>

        {applied.includes('endDate') || expF ? (
          <div className="relative">
            <select className={cx(activeChip(Boolean(expF)), 'appearance-none pr-8')} value={expF} onChange={(e) => setExpF(e.target.value)}>
              <option value="">Data de validade</option>
              <option value="30">Expira em 30 dias</option>
              <option value="60">Expira em 60 dias</option>
              <option value="90">Expira em 90 dias</option>
              <option value="180">Expira em 180 dias</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : null}
        <div className="relative">
          <select className={cx(activeChip(Boolean(partyF)), 'appearance-none pr-8')} value={partyF} onChange={(e) => setPartyF(e.target.value)}>
            <option value="">Parte</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {applied.includes('status') || statusF ? (
          <div className="relative">
            <select className={cx(activeChip(Boolean(statusF)), 'appearance-none pr-8')} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">Status</option>
              <option value="andamento">Em andamento</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : null}
        {applied.includes('type') && (
          <div className="relative">
            <select className={cx(activeChip(Boolean(typeF)), 'appearance-none pr-8')} value={typeF} onChange={(e) => setTypeF(e.target.value)}>
              <option value="">Tipo de documento</option>
              {[...new Set(documents.map((d) => d.type))].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
        {applied.includes('createdAt') && (
          <div className="relative">
            <select className={cx(activeChip(createdF !== 'all'), 'appearance-none pr-8')} value={createdF} onChange={(e) => setCreatedF(e.target.value)}>
              <option value="all">Data de criação</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 365 dias</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
        <div className="relative">
          <input className={cx(activeChip(Boolean(excl)), 'w-40')} placeholder="Não contém" value={excl} onChange={(e) => setExcl(e.target.value)} />
        </div>
        <button className="inline-flex items-center gap-2 text-sm font-medium px-2 py-1.5 hover:bg-gray-100 rounded" onClick={() => { setPendingApplied(applied); setModal(true) }}>
          <SlidersHorizontal size={16} /> Todos os filtros
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-700 flex items-center gap-2">
        {showFolders ? 'Exibindo pastas e documentos' : 'Exibindo apenas documentos'}
        <button className="text-brand hover:underline" onClick={() => setShowFolders((v) => !v)}>Alterar</button>
        {selected.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-gray-600">{selected.length} selecionado(s)</span>
            <button
              className="btn-secondary py-1"
              onClick={() => {
                if (confirm(`Excluir ${selected.length} documento(s)? Esta ação não pode ser desfeita.`)) {
                  deleteDocuments(selected)
                  setSelected([])
                  toast('Documentos excluídos')
                }
              }}
            >
              <Trash2 size={14} /> Excluir
            </button>
          </span>
        )}
      </div>

      {showFolders && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {folders.map(([name, n]) => (
            <button key={name} className="card p-3 text-left hover:bg-gray-50" onClick={() => { setQ(''); setParams({}); setPartyF(''); setStatusF(''); setExcl(''); setCreatedF('all'); setTypeF(''); setExpF(''); setShowFolders(false); setSort({ field: 'location', dir: 'asc' }); setTimeout(() => setExcl(''), 0); setLocationFilter(name) }}>
              <div className="text-2xl">📁</div>
              <div className="text-sm font-medium truncate mt-1">{name}</div>
              <div className="text-xs text-gray-500">{n} documento(s)</div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-line">
              <th className="th w-10">
                <Checkbox checked={allChecked} indeterminate={!allChecked && selected.length > 0} onChange={(v) => setSelected(v ? filtered.map((d) => d.id) : [])} />
              </th>
              <SortHeader label="Nome" field="name" sort={sort} onSort={onSort} />
              <SortHeader label="Descrição" field="description" sort={sort} onSort={onSort} />
              <SortHeader label="Status" field="status" sort={sort} onSort={onSort} />
              <SortHeader label="Localização" field="location" sort={sort} onSort={onSort} />
              <SortHeader label="Modificado por" field="modifiedBy" sort={sort} onSort={onSort} />
              <SortHeader label="Data de modificação" field="modifiedAt" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((d) => {
              const snippet = snippets.get(d.id)
              return (
                <tr key={d.id} className={cx('border-b border-line hover:bg-gray-50', selected.includes(d.id) && 'bg-blue-50')}>
                  <td className="td">
                    <Checkbox checked={selected.includes(d.id)} onChange={(v) => setSelected((s) => (v ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
                  </td>
                  <td className="td">
                    <div className="flex items-start gap-2">
                      <FileText size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <Link to={`/clm/documentos/${d.id}`} className="text-ink underline decoration-gray-400 hover:decoration-ink font-medium" dangerouslySetInnerHTML={{ __html: highlight(d.name, q) }} />
                        {snippet && <div className="text-xs text-gray-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: '…' + highlight(snippet, q) + '…' }} />}
                      </div>
                    </div>
                  </td>
                  <td className="td text-gray-700 max-w-[300px]">
                    <span dangerouslySetInnerHTML={{ __html: highlight(d.description, q) }} />
                  </td>
                  <td className="td"><StatusBadge status={d.status} /></td>
                  <td className="td text-gray-700">{d.location}</td>
                  <td className="td">
                    <div>{userName(d.modifiedById)}</div>
                    <div className="text-xs text-gray-500">{userEmail(d.modifiedById)}</div>
                  </td>
                  <td className="td whitespace-nowrap">
                    <div>{fmtDate(d.modifiedAt)}</div>
                    <div className="text-xs text-gray-500">{fmtTime(d.modifiedAt)}</div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="td text-center text-gray-500 py-16" colSpan={7}>
                  Nenhum documento encontrado. <button className="text-brand hover:underline" onClick={() => navigate('/clm/gerar')}>Gerar um novo documento</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Todos os filtros"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPendingApplied(applied)}>Desfazer alterações</button>
            <button className="btn-brand" onClick={() => { setApplied(pendingApplied); setModal(false) }}>Salvar</button>
          </>
        }
      >
        <div className="relative mb-5">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-10" placeholder="Localizar pelo nome do filtro" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <div className="font-semibold">Aplicado</div>
          <button className="text-sm hover:underline" onClick={() => setPendingApplied([])}>Desmarcar tudo</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 mb-5 min-h-[40px]">
          {pendingApplied.map((id) => {
            const f = ALL_FILTERS.find((x) => x.id === id)!
            return (
              <button key={id} className="chip chip-active" onClick={() => setPendingApplied((p) => p.filter((x) => x !== id))}>
                {f.label}{id === 'createdAt' ? `: Últimos ${createdF === 'all' ? '365' : createdF}...` : ''} <ChevronDown size={14} />
              </button>
            )
          })}
          {pendingApplied.length === 0 && <span className="text-sm text-gray-500">Nenhum filtro aplicado</span>}
        </div>
        <div className="border-t border-line flex gap-6 text-sm">
          <button className={cx('tab', tab === 'all' && 'tab-active')} onClick={() => setTab('all')}>Todos ({ALL_FILTERS.length})</button>
          <button className={cx('tab', tab === 'starred' && 'tab-active')} onClick={() => setTab('starred')}>Favoritos ({favorites.length})</button>
        </div>
        <ul className="divide-y divide-line">
          {filterList.map((f) => {
            const on = pendingApplied.includes(f.id)
            return (
              <li key={f.id} className="py-3 flex items-center justify-between">
                <button className={cx('chip', on && 'chip-active')} onClick={() => setPendingApplied((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))}>
                  {f.label} <ChevronDown size={14} />
                </button>
                <button className="p-1 text-gray-500 hover:text-amber-500" onClick={() => toggleFavorite(f.id)} aria-label="Favoritar">
                  <Star size={20} className={favorites.includes(f.id) ? 'fill-amber-400 text-amber-400' : ''} />
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>
    </div>
  )

  function setLocationFilter(name: string) {
    setQ(name)
    setParams({ q: name })
  }
}

export type { DocType }
