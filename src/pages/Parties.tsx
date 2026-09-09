import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Modal, PageHeader, StatusBadge } from '../components/ui'
import { cx, fmtCurrency, fmtDate, normalize } from '../lib/utils'
import { useStore } from '../store'
import type { PartyType } from '../types'

export default function Parties() {
  const parties = useStore((s) => s.parties)
  const users = useStore((s) => s.users)
  const documents = useStore((s) => s.documents)
  const addParty = useStore((s) => s.addParty)
  const currentUserId = useStore((s) => s.currentUserId)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Cliente' as PartyType, cnpj: '', address: '', city: '', state: '', zip: '', contactId: currentUserId })
  const list = useMemo(() => parties.filter((p) => normalize(`${p.name} ${p.type} ${p.city}`).includes(normalize(q))).sort((a, b) => a.name.localeCompare(b.name)), [parties, q])

  return (
    <div>
      <div className="bg-surface px-6 py-12">
        <h1 className="text-6xl font-medium">Partes</h1>
      </div>
      <div className="px-6 py-6 max-w-[1500px]">
        <div className="flex items-end justify-between gap-4 mt-6">
          <h2 className="text-xl font-medium">{list.length} Partes</h2>
          <div className="flex items-end gap-3">
            <div>
              <label className="label">Pesquisar</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="input pl-9 w-64" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <button className="btn-primary" onClick={() => setModal(true)}>Nova parte</button>
          </div>
        </div>
        <table className="w-full mt-3 border-t-2 border-ink">
          <thead>
            <tr>
              <th className="th">Nome</th><th className="th">Tipo</th><th className="th">Contato Comercial</th><th className="th">Cidade</th><th className="th">Documentos</th><th className="th">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const docs = documents.filter((d) => d.partyId === p.id)
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td font-medium"><Link className="hover:underline" to={`/clm/partes/${p.id}`}>{p.name}</Link></td>
                  <td className="td">{p.type}</td>
                  <td className="td">{users.find((u) => u.id === p.contactId)?.name ?? '—'}</td>
                  <td className="td">{p.city}/{p.state}</td>
                  <td className="td">{docs.length}</td>
                  <td className="td whitespace-nowrap">{fmtCurrency(docs.reduce((s, d) => s + d.value, 0))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nova parte"
        width="max-w-lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!form.name.trim() || !form.cnpj.trim()} onClick={() => { addParty(form); setModal(false) }}>Salvar</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {([['name', 'Nome', true], ['cnpj', 'CNPJ', true], ['address', 'Endereço', false], ['city', 'Cidade', false], ['state', 'Estado', false], ['zip', 'CEP', false]] as const).map(([k, label, req]) => (
            <div key={k} className={k === 'name' || k === 'address' ? 'col-span-2' : ''}>
              <label className={cx('label', req && 'req')}>{label}</label>
              <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartyType })}>
              {['Cliente', 'Fornecedor', 'Parceiro'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Contato comercial</label>
            <select className="input" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export function PartyDetail() {
  const { id } = useParams()
  const party = useStore((s) => s.parties.find((p) => p.id === id))
  const documents = useStore((s) => s.documents)
  const contacts = useStore((s) => s.contacts)
  const users = useStore((s) => s.users)
  if (!party) return <div className="p-10">Parte não encontrada. <Link to="/clm/partes" className="text-brand">Voltar</Link></div>
  const docs = documents.filter((d) => d.partyId === party.id).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  const externals = contacts.filter((c) => c.partyId === party.id)
  return (
    <div className="px-6 py-8 max-w-[1500px]">
      <Link to="/clm/partes" className="text-sm text-gray-600 hover:underline">← Partes</Link>
      <PageHeader title={party.name} subtitle={`${party.type} · CNPJ ${party.cnpj} · ${party.address}, ${party.city}/${party.state}, ${party.zip}`} />
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Documentos</div><div className="text-3xl font-semibold">{docs.length}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Valor total</div><div className="text-2xl font-semibold">{fmtCurrency(docs.reduce((s, d) => s + d.value, 0))}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Contato comercial</div><div className="text-lg font-medium mt-1">{users.find((u) => u.id === party.contactId)?.name}</div></div>
        <div className="card p-4"><div className="text-xs text-gray-500 uppercase">Contatos externos</div>{externals.map((c) => <div key={c.id} className="text-sm mt-1">{c.name} <span className="text-gray-500">· {c.role}</span></div>)}</div>
      </div>
      <h2 className="text-xl font-medium mb-2">Documentos</h2>
      <table className="w-full border-t-2 border-ink">
        <thead><tr><th className="th">Nome</th><th className="th">Tipo</th><th className="th">Status</th><th className="th">Valor</th><th className="th">Início</th><th className="th">Término</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="td"><Link className="hover:underline" to={`/clm/documentos/${d.id}`}>{d.name}</Link></td>
              <td className="td">{d.type}</td>
              <td className="td"><StatusBadge status={d.status} /></td>
              <td className="td whitespace-nowrap">{fmtCurrency(d.value)}</td>
              <td className="td">{fmtDate(d.startDate)}</td>
              <td className="td">{fmtDate(d.endDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
