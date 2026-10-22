export type ID = string

export type PartyType = 'Cliente' | 'Fornecedor' | 'Parceiro'

export type DocType =
  | 'Acordo Principal de Serviço'
  | 'Acordo de Confidencialidade'
  | 'Acordo de Serviços'
  | 'Ordem de Compra'
  | 'Declaração de Trabalho'
  | 'Emenda'
  | 'Contrato de Locação'
  | 'Adendo'
  | 'Formulário de Pedido'

export const STEP_ORDER = [
  'Rascunho',
  'Revisão Jurídica',
  'Revisão Financeira',
  'Revisão Externa',
  'Aprovação Executiva',
  'Assinatura em Andamento',
  'Assinado',
] as const

export type StepName = (typeof STEP_ORDER)[number]
export type DocStatus = StepName | 'Expirado' | 'Cancelado' | 'Rejeitado'

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'rejected'

export interface WorkflowStep {
  id: ID
  name: StepName
  status: StepStatus
  assigneeId?: ID
  startedAt?: string
  completedAt?: string
  durationHours?: number
  note?: string
}

export interface User {
  id: ID
  name: string
  email: string
  initials: string
  role: string
}

export interface Party {
  id: ID
  name: string
  type: PartyType
  cnpj: string
  address: string
  city: string
  state: string
  zip: string
  contactId: ID
  createdAt: string
}

export interface Contact {
  id: ID
  name: string
  email: string
  phone: string
  role: string
  partyId?: ID
  internal: boolean
}

export interface Comment {
  id: ID
  authorId: ID
  text: string
  createdAt: string
  mentions: ID[]
  resolved?: boolean
}

export interface Task {
  id: ID
  documentId: ID
  title: string
  assigneeId: ID
  createdById: ID
  status: 'open' | 'done'
  dueDate: string
  createdAt: string
  completedAt?: string
}

export interface Version {
  id: ID
  number: number
  createdAt: string
  createdById: ID
  note: string
}

export type ArtifactName = 'original' | 'certificated' | 'certificate-page' | 'pades' | 'bundle'

/** Vínculo do contrato com o documento correspondente no Assinafy. */
export interface AssinafyLink {
  documentId: string
  /** Status devolvido pelo Assinafy, ex.: uploaded, pending_signature, certificated. */
  status: string | null
  /** Último tipo de evento recebido por webhook. */
  event?: string | null
  sentAt?: string
  sentById?: ID
  signers?: { name: string; email: string }[]
  updatedAt?: string
  /** Preenchido quando o signatário recusa ou o documento é cancelado. */
  rejectedReason?: string | null
}

export interface Attachment {
  id: ID
  name: string
  size: number
}

export type FormValue = string | number | boolean | string[] | null

export type FormData = Record<string, FormValue>

export interface Condition {
  field: string
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'truthy' | 'falsy'
  value?: FormValue
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox-group'
  | 'party'
  | 'clauses'
  | 'file'

export interface FormField {
  id: string
  sectionId: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  hint?: string
  helpText?: string
  showIf?: Condition
  warnIf?: { when: Condition; text: string }
  default?: FormValue
}

export interface FormSection {
  id: string
  title: string
  description?: string
  showIf?: Condition
  indent?: boolean
}

export interface ContentBlock {
  kind: 'title' | 'h2' | 'p' | 'clause' | 'clauses' | 'signature'
  text?: string
  clauseId?: string
  showIf?: Condition
}

export interface WorkflowRule {
  id: ID
  name: string
  description: string
  when: Condition
  addStep: StepName
  approverId: ID
  enabled: boolean
}

export interface Template {
  id: ID
  name: string
  abbr: string
  type: DocType
  description: string
  sections: FormSection[]
  fields: FormField[]
  content: ContentBlock[]
  rules: WorkflowRule[]
  isUpload?: boolean
  createdAt: string
  updatedAt: string
  ownerId: ID
}

export interface Clause {
  id: ID
  title: string
  category: string
  body: string
  approved: boolean
  updatedAt: string
}

export interface Document {
  id: ID
  code: string
  name: string
  type: DocType
  status: DocStatus
  templateId?: ID
  partyId: ID
  ownerId: ID
  value: number
  startDate: string
  endDate: string
  termMonths: number
  description: string
  location: string
  region: string
  tags: string[]
  formData: FormData
  workflow: WorkflowStep[]
  comments: Comment[]
  versions: Version[]
  attachments: Attachment[]
  createdAt: string
  modifiedAt: string
  modifiedById: ID | 'workflow'
  pages: number
  /** Presente depois que o contrato é enviado para assinatura. */
  assinafy?: AssinafyLink
}

export interface Report {
  id: ID
  name: string
  description: string
  type: 'Documento' | 'Tarefa' | 'Parte'
  createdAt: string
  modifiedAt: string
  createdById: ID
  filters: {
    partyId?: ID
    status?: DocStatus[]
    docType?: DocType[]
    expiringWithinDays?: number
    minValue?: number
  }
}

export type WidgetId =
  | 'avg_step_time'
  | 'by_type'
  | 'by_status'
  | 'expiring_soon'
  | 'expiring_by_month'
  | 'my_tasks'
  | 'value_by_month'
  | 'recent_docs'
  | 'by_party_type'
  | 'cycle_time'

export interface Dashboard {
  id: ID
  name: string
  widgets: WidgetId[]
}

export interface Company {
  name: string
  legalName: string
  cnpj: string
  address: string
  city: string
  state: string
  zip: string
}

export interface GenerationDraft {
  templateId: ID
  data: FormData
  savedAt: string
  step: 1 | 2 | 3
}
