import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Checkbox, Modal, PageHeader, useToast } from '../components/ui'
import { cx, fmtDate } from '../lib/utils'
import { useStore } from '../store'

type Tab = 'templates' | 'clauses' | 'rules' | 'users' | 'company'

export default function Admin() {
  const [tab, setTab] = useState<Tab>('templates')
  const templates = useStore((s) => s.templates)
  const clauses = useStore((s) => s.clauses)
  const users = useStore((s) => s.users)
  const company = useStore((s) => s.company)
  const documents = useStore((s) => s.documents)
  const toggleClauseApproved = useStore((s) => s.toggleClauseApproved)
  const toggleRule = useStore((s) => s.toggleRule)
  const addClause = useStore((s) => s.addClause)
  const resetAll = useStore((s) => s.resetAll)
  const { toast, node } = useToast()
  const [clauseModal, setClauseModal] = useState(false)
  const [clauseForm, setClauseForm] = useState({ title: '', category: 'Jurídico', body: '', approved: false })

  const TABS: [Tab, string][] = [
    ['templates', 'Modelos'],
    ['clauses', 'Biblioteca de cláusulas'],
    ['rules', 'Regras condicionais'],
    ['users', 'Usuários'],
    ['company', 'Empresa e dados'],
  ]

  return (
    <div className="px-6 py-8 max-w-[1400px]">
      {node}
      <PageHeader title="Administrador" subtitle="Configure modelos, cláusulas pré-aprovadas, regras de encaminhamento e usuários." />
      <div className="flex border-b border-line mb-6">
        {TABS.map(([id, label]) => (
          <button key={id} className={cx('tab', tab === id && 'tab-active')} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'templates' && (
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className="th">Nome</th><th className="th">Tipo gerado</th><th className="th">Campos</th><th className="th">Regras ativas</th><th className="th">Documentos gerados</th><th className="th">Atualizado</th><th className="th"></th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-line hover:bg-gray-50">
                <td className="td font-medium">{t.name}<div className="text-xs text-gray-500 font-normal">{t.description}</div></td>
                <td className="td">{t.type}</td>
                <td className="td">{t.fields.length}</td>
                <td className="td">{t.rules.filter((r) => r.enabled).length}/{t.rules.length}</td>
                <td className="td">{documents.filter((d) => d.templateId === t.id).length}</td>
                <td className="td">{fmtDate(t.updatedAt)}</td>
                <td className="td"><Link className="btn-secondary py-1" to={`/clm/gerar?template=${t.id}`}>Gerar documento</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'clauses' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">Apenas cláusulas <b>pré-aprovadas</b> pelo Jurídico ficam disponíveis para os usuários ao gerar documentos.</p>
            <button className="btn-primary" onClick={() => setClauseModal(true)}>Nova cláusula</button>
          </div>
          <ul className="space-y-3">
            {clauses.map((c) => (
              <li key={c.id} className="card p-4 flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    <span className="chip py-0.5 text-xs">{c.category}</span>
                    <span className={cx('text-xs rounded-full px-2 py-0.5', c.approved ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800')}>{c.approved ? 'Pré-aprovada' : 'Pendente de aprovação'}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{c.body}</p>
                  <div className="text-xs text-gray-500 mt-1">Atualizada em {fmtDate(c.updatedAt)}</div>
                </div>
                <div className="shrink-0"><Checkbox checked={c.approved} onChange={() => toggleClauseApproved(c.id)} label="Aprovada" /></div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'rules' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">Regras baseadas em lógica condicional adicionam etapas de aprovação ao fluxo de trabalho do documento gerado.</p>
          {templates.map((t) => (
            <div key={t.id} className="card">
              <div className="px-4 py-3 border-b border-line font-medium">{t.name}</div>
              <ul className="divide-y divide-line">
                {t.rules.map((r) => (
                  <li key={r.id} className="px-4 py-3 flex items-start gap-4">
                    <Checkbox checked={r.enabled} onChange={() => toggleRule(t.id, r.id)} />
                    <div className="flex-1">
                      <div className={cx('font-medium', !r.enabled && 'text-gray-400')}>{r.name}</div>
                      <div className="text-sm text-gray-600">{r.description}</div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">SE {r.when.field} {r.when.op} {String(r.when.value ?? '')} → adicionar etapa <b>{r.addStep}</b> · aprovador: {users.find((u) => u.id === r.approverId)?.name}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className="th">Usuário</th><th className="th">E-mail</th><th className="th">Função</th><th className="th">Tarefas abertas</th><th className="th">Documentos</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line hover:bg-gray-50">
                <td className="td"><span className="inline-flex items-center gap-2"><Avatar name={u.name} initials={u.initials} size={28} color="bg-brand" />{u.name}</span></td>
                <td className="td">{u.email}</td>
                <td className="td">{u.role}</td>
                <td className="td"><OpenTasks userId={u.id} /></td>
                <td className="td">{documents.filter((d) => d.ownerId === u.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'company' && (
        <div className="max-w-xl space-y-4">
          <div className="card p-4">
            <div className="font-medium mb-2">Empresa (parte contratante)</div>
            <dl className="text-sm grid grid-cols-[140px_1fr] gap-y-1">
              <dt className="text-gray-500">Nome</dt><dd>{company.name}</dd>
              <dt className="text-gray-500">Razão social</dt><dd>{company.legalName}</dd>
              <dt className="text-gray-500">CNPJ</dt><dd>{company.cnpj}</dd>
              <dt className="text-gray-500">Endereço</dt><dd>{company.address}, {company.city}/{company.state}, {company.zip}</dd>
            </dl>
          </div>
          <div className="card p-4">
            <div className="font-medium mb-1">Dados de demonstração</div>
            <p className="text-sm text-gray-600 mb-3">Todos os dados ficam salvos no navegador (localStorage). Restaurar recria os dados de exemplo e apaga documentos criados por você.</p>
            <button className="btn-danger" onClick={() => { if (confirm('Restaurar dados de demonstração? Documentos criados serão perdidos.')) { resetAll(); toast('Dados restaurados') } }}>Restaurar dados de demonstração</button>
          </div>
        </div>
      )}

      <Modal
        open={clauseModal}
        onClose={() => setClauseModal(false)}
        title="Nova cláusula"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setClauseModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!clauseForm.title.trim() || !clauseForm.body.trim()} onClick={() => { addClause(clauseForm); setClauseModal(false); setClauseForm({ title: '', category: 'Jurídico', body: '', approved: false }); toast('Cláusula adicionada') }}>Salvar</button>
          </>
        }
      >
        <label className="label req">Título</label>
        <input className="input mb-3" value={clauseForm.title} onChange={(e) => setClauseForm({ ...clauseForm, title: e.target.value })} />
        <label className="label">Categoria</label>
        <select className="input mb-3" value={clauseForm.category} onChange={(e) => setClauseForm({ ...clauseForm, category: e.target.value })}>
          {['Jurídico', 'Financeiro', 'Operacional', 'Comercial', 'Compliance'].map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="label req">Texto</label>
        <textarea className="input mb-3" rows={6} value={clauseForm.body} onChange={(e) => setClauseForm({ ...clauseForm, body: e.target.value })} placeholder="Use {{company.name}} e {{party.name}} para campos dinâmicos." />
        <Checkbox checked={clauseForm.approved} onChange={(v) => setClauseForm({ ...clauseForm, approved: v })} label="Pré-aprovada pelo Jurídico" />
      </Modal>
    </div>
  )
}

function OpenTasks({ userId }: { userId: string }) {
  const n = useStore((s) => s.tasks.filter((t) => t.assigneeId === userId && t.status === 'open').length)
  return <>{n}</>
}
