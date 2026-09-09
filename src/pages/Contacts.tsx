import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Modal, PageHeader } from '../components/ui'
import { cx, initials, normalize } from '../lib/utils'
import { useStore } from '../store'

export default function Contacts() {
  const contacts = useStore((s) => s.contacts)
  const parties = useStore((s) => s.parties)
  const addContact = useStore((s) => s.addContact)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'all' | 'internal' | 'external'>('all')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', partyId: '' })

  const list = useMemo(
    () =>
      contacts
        .filter((c) => (scope === 'all' ? true : scope === 'internal' ? c.internal : !c.internal))
        .filter((c) => normalize(`${c.name} ${c.email} ${c.role} ${parties.find((p) => p.id === c.partyId)?.name ?? ''}`).includes(normalize(q)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contacts, scope, q, parties],
  )

  return (
    <div>
      <div className="bg-surface px-6 py-10">
        <h1 className="text-5xl font-medium">Contatos</h1>
      </div>
      <div className="px-6 py-6 max-w-[1500px]">
        <div className="flex items-center gap-3">
          <div className="flex">
            {(['all', 'external', 'internal'] as const).map((s) => (
              <button key={s} className={cx('tab', scope === s && 'tab-active')} onClick={() => setScope(s)}>{s === 'all' ? 'Todos' : s === 'internal' ? 'Internos' : 'Externos'}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9 w-64" placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={() => setModal(true)}>Novo contato</button>
          </div>
        </div>
        <PageHeader title={<span className="text-xl font-medium">{list.length} Contatos</span>} />
        <table className="w-full -mt-4 border-t-2 border-ink">
          <thead>
            <tr>
              <th className="th">Nome</th><th className="th">Cargo</th><th className="th">E-mail</th><th className="th">Telefone</th><th className="th">Parte</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const p = parties.find((x) => x.id === c.partyId)
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="td"><span className="inline-flex items-center gap-2"><Avatar name={c.name} initials={initials(c.name)} size={26} color={c.internal ? 'bg-brand' : 'bg-teal'} />{c.name}</span></td>
                  <td className="td">{c.role}</td>
                  <td className="td"><a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></td>
                  <td className="td">{c.phone}</td>
                  <td className="td">{p ? <Link className="hover:underline" to={`/clm/partes/${p.id}`}>{p.name}</Link> : <span className="text-gray-500">Interno</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Novo contato"
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!form.name.trim()} onClick={() => { addContact({ ...form, partyId: form.partyId || undefined, internal: !form.partyId }); setModal(false); setForm({ name: '', email: '', phone: '', role: '', partyId: '' }) }}>Salvar</button>
          </>
        }
      >
        {(['name', 'role', 'email', 'phone'] as const).map((k) => (
          <div key={k} className="mb-3">
            <label className={cx('label', k === 'name' && 'req')}>{{ name: 'Nome', role: 'Cargo', email: 'E-mail', phone: 'Telefone' }[k]}</label>
            <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <label className="label">Parte (vazio = contato interno)</label>
        <select className="input" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
          <option value="">Interno</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Modal>
    </div>
  )
}
