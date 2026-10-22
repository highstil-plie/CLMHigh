import { ChevronDown, Download, Pencil, Search, Settings, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Checkbox, Dropdown, MenuItem, Modal, PageHeader, StatusBadge, useToast } from '../components/ui'
import { csv, cx, daysUntil, downloadText, fmtCurrency, fmtDate, normalize } from '../lib/utils'
import { useStore } from '../store'
import type { DocStatus, DocType, Document, Report } from '../types'

const STATUSES: DocStatus[] = ['Rascunho', 'Revisão Jurídica', 'Revisão Financeira', 'Revisão Externa', 'Aprovação Executiva', 'Assinatura em Andamento', 'Assinado', 'Expirado', 'Rejeitado']
const TYPES: DocType[] = ['Acordo Principal de Serviço', 'Acordo de Confidencialidade', 'Acordo de Serviços', 'Ordem de Compra', 'Declaração de Trabalho', 'Emenda', 'Contrato de Locação', 'Adendo', 'Formulário de Pedido']

export function runReport(r: Report, documents: Document[]): Document[] {
  const f = r.filters
  return documents.filter((d) => {
    if (f.partyId && d.partyId !== f.partyId) return false
    if (f.status?.length && !f.status.includes(d.status)) return false
    if (f.docType?.length && !f.docType.includes(d.type)) return false
    if (f.minValue !== undefined && d.value < f.minValue) return false
    if (f.expiringWithinDays !== undefined) {
      const du = daysUntil(d.endDate)
      if (du < 0 || du > f.expiringWithinDays) return false
    }
    return true
  })
}

function ReportForm({ initial, onSave, onCancel }: { initial?: Report; onSave: (r: Omit<Report, 'id' | 'createdAt' | 'modifiedAt' | 'createdById'>) => void; onCancel: () => void }) {
  const parties = useStore((s) => s.parties)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [partyId, setPartyId] = useState(initial?.filters.partyId ?? '')
  const [status, setStatus] = useState<DocStatus[]>(initial?.filters.status ?? [])
  const [docType, setDocType] = useState<DocType[]>(initial?.filters.docType ?? [])
  const [exp, setExp] = useState(initial?.filters.expiringWithinDays?.toString() ?? '')
  const [minValue, setMinValue] = useState(initial?.filters.minValue?.toString() ?? '')
  return (
    <>
      <label className="label req">Nome</label>
      <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <label className="label">Descrição</label>
      <input className="input mb-4" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Parte</label>
          <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Todas</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expira em (dias)</label>
          <input className="input" type="number" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="Ex.: 90" />
        </div>
        <div>
          <label className="label">Valor mínimo (R$)</label>
          <input className="input" type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <div className="label">Status</div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={cx('chip', status.includes(s) && 'chip-active')} onClick={() => setStatus((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}>{s}</button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <div className="label">Tipo de documento</div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((s) => (
            <button key={s} type="button" className={cx('chip', docType.includes(s) && 'chip-active')} onClick={() => setDocType((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))}>{s}</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-line">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              description,
              type: 'Documento',
              filters: { partyId: partyId || undefined, status: status.length ? status : undefined, docType: docType.length ? docType : undefined, expiringWithinDays: exp ? Number(exp) : undefined, minValue: minValue ? Number(minValue) : undefined },
            })
          }
        >
          Salvar relatório
        </button>
      </div>
    </>
  )
}

export default function Reports() {
  const reports = useStore((s) => s.reports)
  const users = useStore((s) => s.users)
  const documents = useStore((s) => s.documents)
  const parties = useStore((s) => s.parties)
  const addReport = useStore((s) => s.addReport)
  const updateReport = useStore((s) => s.updateReport)
  const deleteReports = useStore((s) => s.deleteReports)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast, node } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [modal, setModal] = useState<false | 'new' | 'edit'>(false)
  const [q, setQ] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sort, setSort] = useState<'createdAt' | 'modifiedAt' | 'name'>('createdAt')

  useEffect(() => {
    if (params.get('novo')) {
      setModal('new')
      setParams({})
    }
  }, [params, setParams])

  const list = useMemo(
    () => reports.filter((r) => normalize(r.name).includes(normalize(q))).sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort].localeCompare(a[sort]))),
    [reports, q, sort],
  )
  const editing = modal === 'edit' ? reports.find((r) => r.id === selected[0]) : undefined

  const exportSelected = (format: 'csv' | 'json') => {
    const rs = reports.filter((r) => selected.includes(r.id))
    for (const r of rs) {
      const docs = runReport(r, documents)
      if (format === 'json') downloadText(`${r.name}.json`, JSON.stringify(docs, null, 2), 'application/json')
      else
        downloadText(
          `${r.name}.csv`,
          csv([
            ['ID', 'Nome', 'Tipo', 'Status', 'Parte', 'Valor', 'Início', 'Término'],
            ...docs.map((d) => [d.code, d.name, d.type, d.status, parties.find((p) => p.id === d.partyId)?.name ?? '', d.value, fmtDate(d.startDate), fmtDate(d.endDate)]),
          ]),
          'text/csv',
        )
    }
    toast(`${rs.length} relatório(s) exportado(s)`)
  }

  return (
    <div className="px-6 py-8 max-w-[1500px]">
      {node}
      <PageHeader
        title="Relatórios"
        actions={
          <Dropdown align="right" trigger={<button className="btn-primary">Novo relatório <ChevronDown size={16} /></button>}>
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); setModal('new') }}>Relatório de documentos</MenuItem>
                <MenuItem disabled>Relatório de tarefas (em breve)</MenuItem>
                <MenuItem disabled>Relatório de partes (em breve)</MenuItem>
              </>
            )}
          </Dropdown>
        }
      />
      <div className="border-t border-line pt-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Todos os relatórios <span className="text-sm text-gray-500 font-normal ml-1">{list.length} relatórios</span></h2>
          <div className="text-xs text-gray-500 mt-1">Os dados do relatório podem ter até 24 horas.</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" disabled={selected.length !== 1} onClick={() => setModal('edit')}><Pencil size={14} /> Editar</button>
          <Dropdown align="right" trigger={<button className="btn-secondary" disabled={selected.length === 0}><Download size={14} /> Exportar <ChevronDown size={14} /></button>}>
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); exportSelected('csv') }}>CSV</MenuItem>
                <MenuItem onClick={() => { close(); exportSelected('json') }}>JSON</MenuItem>
              </>
            )}
          </Dropdown>
          <button className="btn-secondary" disabled={selected.length === 0} onClick={() => { if (confirm(`Excluir ${selected.length} relatório(s)?`)) { deleteReports(selected); setSelected([]); toast('Relatórios excluídos') } }}><Trash2 size={14} /> Excluir</button>
          {showSearch ? (
            <input autoFocus className="input w-56" placeholder="Buscar relatório" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setShowSearch(false)} />
          ) : (
            <button className="btn-secondary px-2.5" onClick={() => setShowSearch(true)} aria-label="Buscar"><Search size={16} /></button>
          )}
        </div>
      </div>
      <table className="w-full mt-4">
        <thead>
          <tr className="border-b border-line text-gray-600">
            <th className="th w-10"><Checkbox checked={list.length > 0 && list.every((r) => selected.includes(r.id))} onChange={(v) => setSelected(v ? list.map((r) => r.id) : [])} /></th>
            <th className="th cursor-pointer" onClick={() => setSort('name')}>Nome {sort === 'name' && '↓'}</th>
            <th className="th">Descrição</th>
            <th className="th">Tipo</th>
            <th className="th cursor-pointer" onClick={() => setSort('modifiedAt')}>Última modificação {sort === 'modifiedAt' && '↓'}</th>
            <th className="th cursor-pointer" onClick={() => setSort('createdAt')}>Data de criação {sort === 'createdAt' && '↓'}</th>
            <th className="th">Criado por</th>
            <th className="th w-10"><Settings size={14} /></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id} className={cx('border-b border-line hover:bg-gray-100', i % 2 === 1 && 'bg-gray-50')}>
              <td className="td"><Checkbox checked={selected.includes(r.id)} onChange={(v) => setSelected((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))} /></td>
              <td className="td"><Link className="hover:underline" to={`/clm/relatorios/${r.id}`}>{r.name}</Link></td>
              <td className="td text-gray-600">{r.description}</td>
              <td className="td">{r.type}</td>
              <td className="td">{fmtDate(r.modifiedAt)}</td>
              <td className="td">{fmtDate(r.createdAt)}</td>
              <td className="td text-gray-700">{users.find((u) => u.id === r.createdById)?.email ?? '—'}</td>
              <td className="td text-gray-500 text-xs">{runReport(r, documents).length}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td className="td text-center text-gray-500 py-16" colSpan={8}>
                {reports.length === 0 ? 'Nenhum relatório criado ainda. Use "Novo relatório" para salvar um recorte do repositório.' : 'Nenhum relatório corresponde à busca.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal open={Boolean(modal)} onClose={() => setModal(false)} title={modal === 'edit' ? 'Editar relatório' : 'Novo relatório de documentos'}>
        <ReportForm
          key={modal === 'edit' ? editing?.id : 'new'}
          initial={editing}
          onCancel={() => setModal(false)}
          onSave={(r) => {
            if (modal === 'edit' && editing) {
              updateReport(editing.id, r)
              toast('Relatório atualizado')
              setModal(false)
            } else {
              const id = addReport(r)
              setModal(false)
              navigate(`/clm/relatorios/${id}`)
            }
          }}
        />
      </Modal>
    </div>
  )
}

export function ReportDetail() {
  const { id } = useParams()
  const report = useStore((s) => s.reports.find((r) => r.id === id))
  const documents = useStore((s) => s.documents)
  const parties = useStore((s) => s.parties)
  const users = useStore((s) => s.users)
  if (!report) return <div className="p-10">Relatório não encontrado. <Link className="text-brand" to="/clm/relatorios">Voltar</Link></div>
  const docs = runReport(report, documents)
  const total = docs.reduce((s, d) => s + d.value, 0)
  const partyName = (pid: string) => parties.find((p) => p.id === pid)?.name ?? '—'
  return (
    <div className="px-6 py-8 max-w-[1500px]">
      <Link to="/clm/relatorios" className="text-sm text-gray-600 hover:underline">← Relatórios</Link>
      <PageHeader
        title={report.name}
        subtitle={<>{report.description} · criado por {users.find((u) => u.id === report.createdById)?.name}</>}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              downloadText(
                `${report.name}.csv`,
                csv([['ID', 'Nome', 'Tipo', 'Status', 'Parte', 'Valor', 'Início', 'Término'], ...docs.map((d) => [d.code, d.name, d.type, d.status, partyName(d.partyId), d.value, fmtDate(d.startDate), fmtDate(d.endDate)])]),
                'text/csv',
              )
            }
          >
            <Download size={14} /> Exportar CSV
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Documentos</div><div className="text-3xl font-semibold">{docs.length}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Valor total</div><div className="text-3xl font-semibold">{fmtCurrency(total)}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Filtros</div><div className="text-sm mt-1 flex flex-wrap gap-1">
          {report.filters.partyId && <span className="chip">{partyName(report.filters.partyId)}</span>}
          {report.filters.status?.map((s) => <span key={s} className="chip">{s}</span>)}
          {report.filters.docType?.map((s) => <span key={s} className="chip">{s}</span>)}
          {report.filters.expiringWithinDays && <span className="chip">Expira em {report.filters.expiringWithinDays} dias</span>}
          {report.filters.minValue && <span className="chip">≥ {fmtCurrency(report.filters.minValue)}</span>}
          {!Object.values(report.filters).some(Boolean) && <span className="text-gray-500">Sem filtros</span>}
        </div></div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="th">ID</th><th className="th">Nome</th><th className="th">Tipo</th><th className="th">Status</th><th className="th">Parte</th><th className="th">Valor</th><th className="th">Início</th><th className="th">Término</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-b border-line hover:bg-gray-50">
              <td className="td">{d.code}</td>
              <td className="td"><Link className="hover:underline" to={`/clm/documentos/${d.id}`}>{d.name}</Link></td>
              <td className="td">{d.type}</td>
              <td className="td"><StatusBadge status={d.status} /></td>
              <td className="td">{partyName(d.partyId)}</td>
              <td className="td whitespace-nowrap">{fmtCurrency(d.value)}</td>
              <td className="td">{fmtDate(d.startDate)}</td>
              <td className="td">{fmtDate(d.endDate)}</td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={8} className="td text-center text-gray-500 py-12">Nenhum documento corresponde aos filtros.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
