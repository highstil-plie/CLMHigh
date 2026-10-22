import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Checkbox, Modal, PageHeader, useToast } from '../components/ui'
import { cx, fmtDate } from '../lib/utils'
import { useCurrentUser, useStore } from '../store'
import type { Company } from '../types'

type Tab = 'templates' | 'clauses' | 'rules' | 'users' | 'company'

const COMPANY_FIELDS: [keyof Company, string, boolean][] = [
  ['name', 'Nome curto', false],
  ['cnpj', 'CNPJ', false],
  ['legalName', 'Razão social', true],
  ['address', 'Endereço', true],
  ['city', 'Cidade', false],
  ['state', 'Estado', false],
  ['zip', 'CEP', false],
]

const COMPANY_PLACEHOLDERS: Record<keyof Company, string> = {
  name: 'Como a empresa é chamada no contrato',
  cnpj: '00.000.000/0000-00',
  legalName: 'Razão social completa',
  address: 'Rua, número, complemento, bairro',
  city: 'Cidade',
  state: 'UF',
  zip: '00000-000',
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('templates')
  const templates = useStore((s) => s.templates)
  const clauses = useStore((s) => s.clauses)
  const users = useStore((s) => s.users)
  const company = useStore((s) => s.company)
  const documents = useStore((s) => s.documents)
  const parties = useStore((s) => s.parties)
  const reports = useStore((s) => s.reports)
  const toggleClauseApproved = useStore((s) => s.toggleClauseApproved)
  const toggleRule = useStore((s) => s.toggleRule)
  const addClause = useStore((s) => s.addClause)
  const updateCompany = useStore((s) => s.updateCompany)
  const updateUser = useStore((s) => s.updateUser)
  const loadDemoData = useStore((s) => s.loadDemoData)
  const clearAll = useStore((s) => s.clearAll)
  const me = useCurrentUser()
  const isEmptyNow = documents.length === 0 && parties.length === 0 && reports.length === 0
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
        <div className="max-w-2xl space-y-5">
          <div className="card p-5">
            <div className="font-medium">Empresa (parte contratante)</div>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Estes dados entram no cabeçalho e na qualificação das partes de todo contrato gerado. Enquanto estiverem em branco, o contrato mostra o campo entre colchetes.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {COMPANY_FIELDS.map(([key, label, span]) => (
                <div key={key} className={span ? 'col-span-2' : ''}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    value={company[key]}
                    placeholder={COMPANY_PLACEHOLDERS[key]}
                    onChange={(e) => updateCompany({ [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {!company.name && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mt-4">Informe ao menos o nome para que os contratos saiam identificados.</div>}
          </div>

          <div className="card p-5">
            <div className="font-medium">Seu usuário</div>
            <p className="text-sm text-gray-600 mt-1 mb-4">Aparece como proprietário dos documentos, autor dos comentários e responsável pelas aprovações.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome</label>
                <input className="input" value={me.name} onChange={(e) => updateUser(me.id, { name: e.target.value })} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input className="input" value={me.email} placeholder="voce@suaempresa.com.br" onChange={(e) => updateUser(me.id, { email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Cargo</label>
                <input className="input" value={me.role} onChange={(e) => updateUser(me.id, { role: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-medium">Dados</div>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Tudo fica salvo no navegador (localStorage) deste computador. Hoje há {documents.length} documento(s), {parties.length} parte(s) e {reports.length} relatório(s).
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  if (confirm('Carregar dados de demonstração? Isso substitui tudo que existe hoje por 113 documentos de exemplo, 14 partes e 6 usuários fictícios.')) {
                    loadDemoData()
                    toast('Dados de demonstração carregados')
                  }
                }}
              >
                Carregar dados de demonstração
              </button>
              <button
                className="btn-danger"
                disabled={isEmptyNow && !company.name}
                title={isEmptyNow && !company.name ? 'O aplicativo já está no estado inicial' : undefined}
                onClick={() => {
                  if (confirm('Voltar ao estado inicial? Documentos, partes, contatos, tarefas e relatórios serão apagados, e os dados da empresa e do seu usuário voltarão a ficar em branco. Modelos, cláusulas e regras permanecem.')) {
                    clearAll()
                    toast('Aplicativo voltou ao estado inicial')
                  }
                }}
              >
                Voltar ao estado inicial
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Os dados de demonstração servem só para ver os painéis e relatórios povoados, e substituem inclusive a empresa e os usuários. Voltar ao estado inicial apaga tudo que foi cadastrado, inclusive os dados da empresa, e preserva apenas modelos, cláusulas e regras.
            </p>
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
