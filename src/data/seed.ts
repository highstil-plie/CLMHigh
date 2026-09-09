import type { Company, Contact, Dashboard, DocType, Document, FormData, Party, Report, StepName, Task, User, WorkflowStep } from '../types'
import { STEP_ORDER } from '../types'
import { CLAUSES, TEMPLATES, TEMPLATE_MSA, TEMPLATE_NDA, TEMPLATE_UPLOAD, USERS } from './templates'
import { addDays, addMonths, pick, rng, weighted } from '../lib/utils'
import { effectiveTerms, estimatePages, renderDocument } from '../lib/engine'

export const COMPANY: Company = {
  name: 'Tally',
  legalName: 'Tally Inc. Tecnologia Ltda.',
  cnpj: '12.345.678/0001-99',
  address: 'Rua das Palmeiras, Nº 123, Edifício Lusitano, 10º andar, Jardim Paulistano',
  city: 'São Paulo',
  state: 'SP',
  zip: '01452-001',
}

export const SEED_USERS: User[] = [
  { id: USERS.douglas, name: 'Douglas Silva', email: 'douglas.silva@tallyinc.com.br', initials: 'DS', role: 'Gerente Comercial' },
  { id: USERS.alice, name: 'Alice Gomes', email: 'alice.gomes@tallyinc.com.br', initials: 'AG', role: 'Advogada Sênior - Jurídico' },
  { id: USERS.gabriela, name: 'Gabriela Gomes', email: 'gabriela.gomes@tallyinc.com.br', initials: 'GG', role: 'Analista Financeiro' },
  { id: USERS.andre, name: 'André Santos', email: 'andre.santos@tallyinc.com.br', initials: 'AS', role: 'Diretor de Operações' },
  { id: USERS.dora, name: 'Dora Santos', email: 'dora.santos@tallyinc.com.br', initials: 'DS', role: 'Compradora Sênior' },
  { id: USERS.donizete, name: 'Donizete Silveira', email: 'donizete.silveira@tallyinc.com.br', initials: 'DS', role: 'Executivo de Contas' },
]

const PARTY_SEED: [string, Party['type'], string, string, string][] = [
  ['Alfa Inc', 'Cliente', USERS.douglas, 'São Paulo', 'SP'],
  ['Beta Corp', 'Fornecedor', USERS.dora, 'Curitiba', 'PR'],
  ['Delta S/A', 'Cliente', USERS.douglas, 'Rio de Janeiro', 'RJ'],
  ['Epsilon LTDA', 'Cliente', USERS.donizete, 'Belo Horizonte', 'MG'],
  ['Gama Inc', 'Fornecedor', USERS.dora, 'Porto Alegre', 'RS'],
  ['Omega Inc', 'Cliente', USERS.donizete, 'Campinas', 'SP'],
  ['Rubi Corp', 'Parceiro', USERS.dora, 'Florianópolis', 'SC'],
  ['Safira S/A', 'Cliente', USERS.douglas, 'Salvador', 'BA'],
  ['Turquesa LTDA', 'Cliente', USERS.donizete, 'Recife', 'PE'],
  ['Acme Corp', 'Cliente', USERS.douglas, 'São Paulo', 'SP'],
  ['Casa Confortável', 'Cliente', USERS.donizete, 'Goiânia', 'GO'],
  ['Água Pura', 'Cliente', USERS.douglas, 'Manaus', 'AM'],
  ['Alimentos Frescos', 'Cliente', USERS.donizete, 'Fortaleza', 'CE'],
  ['Beleza Natural', 'Cliente', USERS.douglas, 'Brasília', 'DF'],
]

const REGION: Record<string, string> = {
  SP: 'Sudeste', RJ: 'Sudeste', MG: 'Sudeste', PR: 'Sul', RS: 'Sul', SC: 'Sul', BA: 'Nordeste', PE: 'Nordeste', CE: 'Nordeste', GO: 'Centro-Oeste', DF: 'Centro-Oeste', AM: 'Norte',
}

const STREETS = ['Av. Paulista', 'Rua XV de Novembro', 'Av. Atlântica', 'Rua da Bahia', 'Av. Ipiranga', 'Rua Barão de Jaguara', 'Av. Beira-Mar', 'Av. Sete de Setembro', 'Rua da Aurora', 'Av. Principal', 'Av. T-63', 'Av. Djalma Batista', 'Av. Santos Dumont', 'SCS Quadra 2']
const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Giovana', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nelson']
const LAST = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Guimarães', 'Henriques', 'Lima', 'Moreira', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz']

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function createSeed() {
  const r = rng(20241204)
  const now = new Date()
  const parties: Party[] = []
  const contacts: Contact[] = []

  PARTY_SEED.forEach(([name, type, contactId, city, state], i) => {
    const id = `p_${slug(name)}`
    parties.push({
      id,
      name,
      type,
      cnpj: `${String(10 + i).padStart(2, '0')}.${String(100 + i * 37).padStart(3, '0')}.${String(200 + i * 13).padStart(3, '0')}/0001-${String(10 + i * 3).padStart(2, '0')}`,
      address: `${STREETS[i]}, ${100 + i * 111}`,
      city,
      state,
      zip: `${String(10000 + i * 731).padStart(5, '0')}-${String(100 + i * 7).slice(0, 3)}`,
      contactId,
      createdAt: addDays(now, -420 + i * 20),
    })
    const cname = `${FIRST[i]} ${LAST[(i * 5) % LAST.length]}`
    contacts.push({
      id: `c_${slug(name)}`,
      name: cname,
      email: `${slug(FIRST[i])}.${slug(LAST[(i * 5) % LAST.length])}@${slug(name)}.com.br`,
      phone: `+55 11 9${String(1000 + i * 137).padStart(4, '0')}-${String(2000 + i * 91).padStart(4, '0')}`,
      role: pick(r, ['Diretor Comercial', 'Gerente de Compras', 'Jurídico', 'CFO', 'Gerente de TI', 'CEO']),
      partyId: id,
      internal: false,
    })
  })
  for (const u of SEED_USERS) {
    contacts.push({ id: `c_${u.id}`, name: u.name, email: u.email, phone: '+55 11 3000-0000', role: u.role, internal: true })
  }

  const clauses = CLAUSES.map((c) => ({ ...c }))
  const templates = TEMPLATES.map((t) => ({ ...t }))

  const TYPE_WEIGHTS: [DocType, number][] = [
    ['Acordo Principal de Serviço', 62],
    ['Acordo de Confidencialidade', 14],
    ['Acordo de Serviços', 8],
    ['Ordem de Compra', 5],
    ['Declaração de Trabalho', 4],
    ['Emenda', 2],
    ['Contrato de Locação', 2],
    ['Adendo', 2],
    ['Formulário de Pedido', 1],
  ]
  const STATUS_WEIGHTS: [StepName | 'Expirado', number][] = [
    ['Assinatura em Andamento', 20],
    ['Assinado', 19],
    ['Rascunho', 14],
    ['Revisão Externa', 16],
    ['Revisão Financeira', 13],
    ['Revisão Jurídica', 12],
    ['Aprovação Executiva', 5],
    ['Expirado', 4],
  ]
  const DURATION: Record<StepName, [number, number]> = {
    Rascunho: [0, 0],
    'Revisão Jurídica': [3, 8],
    'Revisão Financeira': [2, 6],
    'Revisão Externa': [10, 20],
    'Aprovação Executiva': [1, 3],
    'Assinatura em Andamento': [8, 18],
    Assinado: [0, 0],
  }
  const ABBR: Record<DocType, string> = {
    'Acordo Principal de Serviço': 'MSA',
    'Acordo de Confidencialidade': 'NDA',
    'Acordo de Serviços': 'SLA',
    'Ordem de Compra': 'PO',
    'Declaração de Trabalho': 'SOW',
    Emenda: 'Emenda',
    'Contrato de Locação': 'Locação',
    Adendo: 'Adendo',
    'Formulário de Pedido': 'Pedido',
  }

  const documents: Document[] = []
  const tasks: Task[] = []
  const TOTAL = 113

  for (let i = 1; i <= TOTAL; i++) {
    const code = `ID-${String(i).padStart(4, '0')}`
    const isSpecial = i === TOTAL
    const type: DocType = isSpecial ? 'Acordo Principal de Serviço' : weighted(r, TYPE_WEIGHTS)
    const party = isSpecial ? parties.find((p) => p.name === 'Acme Corp')! : pick(r, parties)
    const owner = party.contactId
    const createdAt = isSpecial ? addDays(now, -2) : addDays(now, -Math.floor(2 + ((TOTAL - i) / TOTAL) * 400 + r() * 12))
    const template = type === 'Acordo Principal de Serviço' ? TEMPLATE_MSA : type === 'Acordo de Confidencialidade' ? TEMPLATE_NDA : TEMPLATE_UPLOAD
    const startDate = addDays(createdAt, Math.floor(3 + r() * 20))

    let value = 0
    let data: FormData
    if (template.id === 'tpl_msa') {
      const config = isSpecial ? 'Customizado' : pick(r, ['Pré-aprovado', 'Customizado', 'Customizado'])
      value = isSpecial ? 150000 : Math.round((20 + r() * 580) * 1000)
      const services = ['Serviços de TI Gerenciados', 'Serviços em Nuvem', 'Cibersegurança'].filter(() => r() > 0.5)
      const custom = !isSpecial && r() > 0.7
      data = {
        clientType: 'Cliente Existente',
        existingParty: party.id,
        startDate,
        config,
        termMonths: isSpecial ? '36' : pick(r, ['12', '24', '36', '48', '60']),
        paymentNet: isSpecial ? '30' : pick(r, ['30', '45', '60']),
        terminationNotice: isSpecial ? '60' : pick(r, ['30', '60', '90']),
        customizeClauses: custom,
        clauses: custom ? clauses.filter((c) => c.approved && r() > 0.6).map((c) => c.id) : [],
        value,
        services: isSpecial ? ['Serviços em Nuvem', 'Cibersegurança'] : services,
        includeNDA: isSpecial ? true : r() > 0.6,
        attachments: [],
      }
    } else if (template.id === 'tpl_nda') {
      value = Math.round((20 + r() * 280) * 1000)
      data = {
        clientType: 'Parte Existente',
        existingParty: party.id,
        startDate,
        ndaType: r() > 0.3 ? 'Mútuo' : 'Unilateral',
        purpose: pick(r, ['avaliação de parceria comercial', 'due diligence para aquisição de serviços em nuvem', 'troca de informações técnicas para integração de sistemas', 'proposta comercial de serviços gerenciados']),
        termMonths: pick(r, ['12', '24', '36']),
        value,
      }
    } else {
      value = Math.round((5 + r() * 145) * 1000)
      data = {
        docName: `${type} - ${party.name}`,
        docType: type,
        attachments: [`${ABBR[type]}_${slug(party.name)}.pdf`],
        clientType: 'Parte Existente',
        existingParty: party.id,
        startDate,
        termMonths: pick(r, ['6', '12', '24', '36']),
        value,
        notes: r() > 0.5 ? 'Minuta enviada pela contraparte. Verificar cláusula de reajuste.' : '',
      }
    }

    const terms = effectiveTerms(template, data)
    let endDate = addMonths(startDate, terms.termMonths)
    let status: StepName | 'Expirado' = isSpecial ? 'Revisão Jurídica' : weighted(r, STATUS_WEIGHTS)
    if (status === 'Expirado') {
      endDate = addDays(now, -Math.floor(5 + r() * 120))
    } else if (!isSpecial && i % 9 === 0) {
      // ensure a healthy number of contracts expiring soon
      endDate = addDays(now, Math.floor(7 + r() * 80))
      status = 'Assinado'
    }

    // workflow
    const stepNames = new Set<StepName>(['Rascunho', 'Revisão Externa', 'Assinatura em Andamento', 'Assinado'])
    for (const rule of template.rules) {
      const v = data[rule.when.field]
      const ok =
        rule.when.op === 'eq' ? String(v) === String(rule.when.value)
        : rule.when.op === 'gt' ? Number(v) > Number(rule.when.value)
        : rule.when.op === 'gte' ? Number(v) >= Number(rule.when.value)
        : rule.when.op === 'truthy' ? (Array.isArray(v) ? v.length > 0 : Boolean(v))
        : false
      if (ok) stepNames.add(rule.addStep)
    }
    const effectiveStatus: StepName = status === 'Expirado' ? 'Assinado' : status
    if (!stepNames.has(effectiveStatus)) stepNames.add(effectiveStatus)
    const ordered = STEP_ORDER.filter((s) => stepNames.has(s))
    const currentIdx = ordered.indexOf(effectiveStatus)
    let cursor = new Date(createdAt).getTime()
    const workflow: WorkflowStep[] = ordered.map((name, idx) => {
      const rule = template.rules.find((rl) => rl.addStep === name)
      const assigneeId = name === 'Assinado' ? undefined : rule?.approverId ?? owner
      const [lo, hi] = DURATION[name]
      const hours = Math.round((lo + r() * (hi - lo)) * 10) / 10
      const step: WorkflowStep = { id: `ws_${code}_${idx}`, name, status: 'pending', assigneeId }
      if (idx < currentIdx || (name === 'Assinado' && effectiveStatus === 'Assinado')) {
        step.status = 'done'
        step.startedAt = new Date(cursor).toISOString()
        cursor += hours * 3600_000
        step.completedAt = new Date(cursor).toISOString()
        step.durationHours = hours
      } else if (idx === currentIdx && effectiveStatus !== 'Assinado') {
        step.status = 'in_progress'
        step.startedAt = new Date(cursor).toISOString()
      }
      return step
    })
    const modifiedAt = new Date(Math.min(cursor + 3600_000, now.getTime() - 60_000)).toISOString()

    const rendered = renderDocument({ template, data, party, company: COMPANY, clauses, createdAt })
    const name = template.isUpload ? `[${code}] ${party.name} - ${ABBR[type]}.pdf` : `[${code}] ${party.name} - ${ABBR[type]}.docx`

    const doc: Document = {
      id: `d_${code}`,
      code,
      name,
      type,
      status,
      templateId: template.id,
      partyId: party.id,
      ownerId: owner,
      value,
      startDate,
      endDate,
      termMonths: terms.termMonths,
      description: isSpecial ? 'MSA para expansão de serviços em nuvem e cibersegurança' : r() > 0.6 ? template.description : '',
      location: isSpecial ? code : r() > 0.85 ? 'POCs' : party.type === 'Cliente' ? 'Comercial' : 'Compras',
      region: REGION[party.state] ?? 'Sudeste',
      tags: [ABBR[type], party.type].concat(value > 100000 ? ['Alto valor'] : []),
      formData: data,
      workflow,
      comments: [],
      versions: [{ id: `v_${code}_1`, number: 1, createdAt, createdById: owner, note: 'Documento gerado a partir do modelo' }],
      attachments: Array.isArray(data.attachments) ? (data.attachments as string[]).map((n, k) => ({ id: `att_${code}_${k}`, name: n, size: 120_000 + Math.floor(r() * 900_000) })) : [],
      createdAt,
      modifiedAt,
      modifiedById: currentIdx > 1 || status === 'Assinado' || status === 'Expirado' ? 'workflow' : owner,
      pages: estimatePages(rendered),
    }

    if (isSpecial) {
      doc.comments.push({
        id: 'cm_0113_1',
        authorId: USERS.douglas,
        text: '@Alice Gomes Poderia revisar esse trecho, por favor?',
        createdAt: addDays(now, -1),
        mentions: [USERS.alice],
      })
      tasks.push({
        id: 't_0113_1',
        documentId: doc.id,
        title: 'Revisar trecho 1.5 (Aviso de Rescisão) - [ID-0113] Acme Corp - MSA',
        assigneeId: USERS.alice,
        createdById: USERS.douglas,
        status: 'open',
        dueDate: addDays(now, 2),
        createdAt: addDays(now, -1),
      })
      tasks.push({
        id: 't_0113_2',
        documentId: doc.id,
        title: 'Confirmar valores de SLA com o cliente Acme Corp',
        assigneeId: USERS.douglas,
        createdById: USERS.alice,
        status: 'open',
        dueDate: addDays(now, 3),
        createdAt: addDays(now, -0.5),
      })
    } else if (workflow.some((s) => s.status === 'in_progress') && r() > 0.72) {
      const step = workflow.find((s) => s.status === 'in_progress')!
      tasks.push({
        id: `t_${code}`,
        documentId: doc.id,
        title: `${step.name}: ${name}`,
        assigneeId: step.assigneeId ?? owner,
        createdById: 'workflow',
        status: 'open',
        dueDate: addDays(now, Math.floor(-3 + r() * 14)),
        createdAt: step.startedAt ?? createdAt,
      })
    } else if (status === 'Assinado' && r() > 0.8) {
      tasks.push({
        id: `t_${code}`,
        documentId: doc.id,
        title: `Arquivar contrato assinado: ${name}`,
        assigneeId: owner,
        createdById: 'workflow',
        status: 'done',
        dueDate: addDays(modifiedAt, 5),
        createdAt: modifiedAt,
        completedAt: addDays(modifiedAt, 2),
      })
    }

    documents.push(doc)
  }

  documents.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  const byName = (n: string) => parties.find((p) => p.name === n)!.id
  const REPORT_SEED: [string, string, string, Report['filters'], string][] = [
    ['Alfa Inc - SLA', 'Acordos de nível de serviço com Alfa Inc', USERS.douglas, { partyId: byName('Alfa Inc'), docType: ['Acordo de Serviços'] }, '2024-09-23'],
    ['Alfa Inc - MSA', 'Contratos principais com Alfa Inc', USERS.douglas, { partyId: byName('Alfa Inc'), docType: ['Acordo Principal de Serviço'] }, '2024-09-23'],
    ['Alfa Inc Aditivo', 'Adendos e emendas com Alfa Inc', USERS.douglas, { partyId: byName('Alfa Inc'), docType: ['Adendo', 'Emenda'] }, '2024-08-15'],
    ['Alfa Inc - Categoria processo (Concluído)', 'Documentos concluídos', USERS.douglas, { partyId: byName('Alfa Inc'), status: ['Assinado'] }, '2024-08-13'],
    ['Alfa Inc – Em aberto (prioridade)', 'Documentos em andamento', USERS.douglas, { partyId: byName('Alfa Inc'), status: ['Revisão Jurídica', 'Revisão Financeira', 'Revisão Externa', 'Aprovação Executiva', 'Assinatura em Andamento'] }, '2024-08-13'],
    ['Beta Corp – Classificação SLA (Concluído)', 'SLAs assinados com Beta Corp', USERS.dora, { partyId: byName('Beta Corp'), status: ['Assinado'] }, '2024-08-13'],
    ['Beta Corp – Jurídico (Em andamento)', 'Documentos em revisão jurídica', USERS.dora, { partyId: byName('Beta Corp'), status: ['Revisão Jurídica'] }, '2024-08-08'],
    ['Delta S/A - Status', 'Visão geral de status', USERS.douglas, { partyId: byName('Delta S/A') }, '2024-08-08'],
    ['Delta S/A - Andamento', 'Documentos em andamento', USERS.douglas, { partyId: byName('Delta S/A'), status: ['Revisão Externa', 'Assinatura em Andamento'] }, '2024-08-08'],
    ['Delta S/A - Concluídos', 'Documentos assinados', USERS.douglas, { partyId: byName('Delta S/A'), status: ['Assinado'] }, '2024-08-08'],
    ['Epsilon LTDA - Todos', 'Todos os documentos', USERS.donizete, { partyId: byName('Epsilon LTDA') }, '2024-08-08'],
    ['Gama Inc - NDA', 'Acordos de confidencialidade', USERS.dora, { partyId: byName('Gama Inc'), docType: ['Acordo de Confidencialidade'] }, '2024-08-08'],
    ['Omega Inc - Renovações 90 dias', 'Contratos expirando em 90 dias', USERS.donizete, { partyId: byName('Omega Inc'), expiringWithinDays: 90 }, '2024-08-05'],
    ['Rubi Corp - Parceria', 'Documentos da parceria', USERS.dora, { partyId: byName('Rubi Corp') }, '2024-08-01'],
    ['Safira S/A - Alto valor', 'Contratos acima de R$ 100.000', USERS.douglas, { partyId: byName('Safira S/A'), minValue: 100000 }, '2024-07-30'],
    ['Turquesa LTDA - Todos', 'Todos os documentos', USERS.donizete, { partyId: byName('Turquesa LTDA') }, '2024-07-28'],
    ['Renovações próximas (60 dias)', 'Todos os contratos expirando nos próximos 60 dias', USERS.andre, { expiringWithinDays: 60 }, '2024-07-20'],
    ['Aprovação Executiva pendente', 'Documentos aguardando a Diretoria', USERS.andre, { status: ['Aprovação Executiva'] }, '2024-07-15'],
    ['Revisão Jurídica pendente', 'Documentos na fila do Jurídico', USERS.alice, { status: ['Revisão Jurídica'] }, '2024-07-10'],
    ['Revisão Financeira pendente', 'Documentos na fila do Financeiro', USERS.gabriela, { status: ['Revisão Financeira'] }, '2024-07-10'],
    ['Contratos de alto valor', 'Todos acima de R$ 250.000', USERS.andre, { minValue: 250000 }, '2024-07-01'],
    ['NDAs vigentes', 'Acordos de confidencialidade assinados', USERS.alice, { docType: ['Acordo de Confidencialidade'], status: ['Assinado'] }, '2024-06-20'],
    ['Contratos expirados', 'Documentos com vigência encerrada', USERS.douglas, { status: ['Expirado'] }, '2024-06-11'],
  ]
  const reports: Report[] = REPORT_SEED.map(([name, description, createdById, filters, date], i) => ({
    id: `r_${i + 1}`,
    name,
    description,
    type: 'Documento',
    createdAt: `${date}T12:00:00.000Z`,
    modifiedAt: `${date}T12:00:00.000Z`,
    createdById,
    filters,
  }))

  const dashboards: Dashboard[] = [
    { id: 'dash_me', name: 'Meu painel', widgets: ['my_tasks', 'recent_docs', 'by_status', 'expiring_soon'] },
    { id: 'dash_prod', name: 'Análise de Produtividade', widgets: ['avg_step_time', 'cycle_time', 'value_by_month', 'by_party_type'] },
    { id: 'dash_contracts', name: 'Departamento de Contratos', widgets: ['avg_step_time', 'by_type', 'by_status', 'expiring_soon', 'expiring_by_month', 'value_by_month'] },
    { id: 'dash_legal', name: 'Departamento Jurídico', widgets: ['by_status', 'avg_step_time', 'my_tasks', 'recent_docs'] },
  ]

  return { users: SEED_USERS, company: COMPANY, parties, contacts, clauses, templates, documents, tasks, reports, dashboards }
}
