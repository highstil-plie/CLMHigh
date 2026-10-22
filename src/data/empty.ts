import type { Company, Dashboard, Template, User } from '../types'
import { CLAUSES, TEMPLATES } from './templates'

/** Único usuário do estado inicial. Nome e e-mail são editáveis em Administrador. */
export const SOLO_USER_ID = 'u_me'

export const EMPTY_USER: User = {
  id: SOLO_USER_ID,
  name: 'Usuário',
  email: '',
  initials: 'U',
  role: 'Administrador',
}

/** Empresa contratante em branco. Preenchida pelo usuário em Administrador. */
export const EMPTY_COMPANY: Company = {
  name: '',
  legalName: '',
  cnpj: '',
  address: '',
  city: '',
  state: '',
  zip: '',
}

export const EMPTY_DASHBOARDS: Dashboard[] = [
  { id: 'dash_me', name: 'Meu painel', widgets: ['my_tasks', 'recent_docs', 'by_status', 'expiring_soon'] },
  { id: 'dash_contracts', name: 'Departamento de Contratos', widgets: ['avg_step_time', 'by_type', 'by_status', 'expiring_soon', 'expiring_by_month', 'value_by_month'] },
]

/** Aponta todas as regras de aprovação dos modelos para um único usuário. */
export function retargetRules(templates: Template[], approverId: string): Template[] {
  return templates.map((t) => ({ ...t, rules: t.rules.map((r) => ({ ...r, approverId })) }))
}

/**
 * Estado inicial do aplicativo: sem contratos, partes, contatos, tarefas ou relatórios.
 * Mantém os modelos, a biblioteca de cláusulas e os painéis, que são configuração
 * e não dados de exemplo. Os dados de demonstração entram pelo botão em Administrador.
 */
export function createEmptyState() {
  return {
    users: [EMPTY_USER],
    currentUserId: SOLO_USER_ID,
    company: { ...EMPTY_COMPANY },
    parties: [],
    contacts: [],
    clauses: CLAUSES.map((c) => ({ ...c })),
    templates: retargetRules(TEMPLATES, SOLO_USER_ID),
    documents: [],
    tasks: [],
    reports: [],
    dashboards: EMPTY_DASHBOARDS.map((d) => ({ ...d, widgets: [...d.widgets] })),
    activeDashboardId: 'dash_me',
  }
}
