import type { Clause, Company, ContentBlock, Document, FormData, Party, Template, WorkflowStep, StepName, DocStatus, User } from '../types'
import { STEP_ORDER } from '../types'
import { addMonths, evalCondition, fmtCurrency, fmtDate, uid, valueToString } from './utils'

const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function below1000(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (rest < 20 && rest > 0) parts.push(UNITS[rest])
  else if (rest >= 20) {
    const t = Math.floor(rest / 10)
    const u = rest % 10
    parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t])
  }
  return parts.join(' e ')
}

/** number to Portuguese words (integers up to billions) */
export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'zero'
  const scales: [number, string, string][] = [
    [1_000_000_000, 'bilhão', 'bilhões'],
    [1_000_000, 'milhão', 'milhões'],
    [1_000, 'mil', 'mil'],
  ]
  const parts: string[] = []
  for (const [value, sing, plur] of scales) {
    const q = Math.floor(n / value)
    if (q) {
      if (value === 1000) parts.push(q === 1 ? 'mil' : `${below1000(q)} mil`)
      else parts.push(`${q === 1 ? 'um' : below1000(q)} ${q === 1 ? sing : plur}`)
      n %= value
    }
  }
  if (n) parts.push(below1000(n))
  return parts.join(n && n < 100 ? ' e ' : ' ')
}

export function currencyWords(v: number): string {
  const reais = Math.floor(v)
  const cents = Math.round((v - reais) * 100)
  let s = `${numberToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`
  if (cents) s += ` e ${numberToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`
  return s
}

export interface RenderContext {
  template: Template
  data: FormData
  party: Party | undefined
  company: Company
  owner?: User
  clauses: Clause[]
  createdAt?: string
}

export function resolveParty(data: FormData, parties: Party[]): Party | undefined {
  const type = String(data.clientType ?? '')
  if (type.includes('Existente')) return parties.find((p) => p.id === data.existingParty)
  if (!data.name) return undefined
  return {
    id: 'new',
    name: String(data.name ?? ''),
    type: 'Cliente',
    cnpj: String(data.cnpj ?? ''),
    address: String(data.address ?? ''),
    city: String(data.city ?? ''),
    state: String(data.state ?? ''),
    zip: String(data.zip ?? ''),
    contactId: '',
    createdAt: new Date().toISOString(),
  }
}

export function effectiveTerms(template: Template, data: FormData) {
  const preApproved = data.config === 'Pré-aprovado'
  const def = (id: string) => template.fields.find((f) => f.id === id)?.default
  const termMonths = Number(preApproved ? 12 : (data.termMonths ?? def('termMonths') ?? 12))
  const paymentNet = Number(preApproved ? 30 : (data.paymentNet ?? def('paymentNet') ?? 30))
  const terminationNotice = Number(preApproved ? 30 : (data.terminationNotice ?? def('terminationNotice') ?? 30))
  return { termMonths, paymentNet, terminationNotice }
}

export function buildContext(ctx: RenderContext): Record<string, string> {
  const { template, data, party, company, owner } = ctx
  const terms = effectiveTerms(template, data)
  const value = Number(data.value ?? 0)
  const startDate = data.startDate ? String(data.startDate) : ''
  const endDate = startDate ? addMonths(startDate, terms.termMonths) : ''
  const ndaType = String(data.ndaType ?? 'Mútuo')
  const map: Record<string, string> = {
    'company.name': company.name,
    'company.legalName': company.legalName,
    'company.cnpj': company.cnpj,
    'company.address': company.address,
    'company.city': company.city,
    'company.state': company.state,
    'company.zip': company.zip,
    'party.name': party?.name ?? '[Cliente]',
    'party.cnpj': party?.cnpj ?? '[CNPJ]',
    'party.address': party?.address ?? '[Endereço]',
    'party.city': party?.city ?? '[Cidade]',
    'party.state': party?.state ?? '[UF]',
    'party.zip': party?.zip ?? '[CEP]',
    startDate: startDate ? fmtDate(startDate) : '[Data de Início]',
    endDate: endDate ? fmtDate(endDate) : '[Data de Término]',
    termMonths: String(terms.termMonths),
    termMonthsWords: numberToWords(terms.termMonths),
    paymentNet: String(terms.paymentNet),
    terminationNotice: String(terms.terminationNotice),
    terminationNoticeWords: numberToWords(terms.terminationNotice),
    value: value ? fmtCurrency(value) : '[Valor]',
    valueWords: value ? currencyWords(value) : '[valor por extenso]',
    services: Array.isArray(data.services) && data.services.length ? joinList(data.services) : '',
    ndaTypeLower: ndaType.toLowerCase(),
    ndaScope: ndaType === 'Mútuo' ? 'ambas as Partes reciprocamente' : 'exclusivamente a Parte Receptora',
    today: fmtDate(ctx.createdAt ?? new Date().toISOString()),
    owner: owner?.name ?? '',
    attachments: Array.isArray(data.attachments) && data.attachments.length ? data.attachments.join(', ') : 'nenhum',
  }
  for (const [k, v] of Object.entries(data)) {
    if (!(k in map)) map[k] = valueToString(v)
  }
  return map
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

export function fillText(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => (key in map ? map[key] : `[${key}]`))
}

export interface RenderedBlock {
  kind: ContentBlock['kind']
  text: string
  title?: string
}

export function renderDocument(ctx: RenderContext): RenderedBlock[] {
  const map = buildContext(ctx)
  const out: RenderedBlock[] = []
  const selectedClauses = Array.isArray(ctx.data.clauses) ? (ctx.data.clauses as string[]) : []
  for (const block of ctx.template.content) {
    if (!evalCondition(block.showIf, ctx.data)) continue
    if (block.kind === 'clauses') {
      selectedClauses.forEach((id, i) => {
        const cl = ctx.clauses.find((c) => c.id === id)
        if (cl) out.push({ kind: 'clause', title: `6.${i + 1} ${cl.title}.`, text: fillText(cl.body, map) })
      })
      continue
    }
    if (block.kind === 'clause' && block.clauseId) {
      const cl = ctx.clauses.find((c) => c.id === block.clauseId)
      if (cl) out.push({ kind: 'clause', title: cl.title, text: fillText(cl.body, map) })
      continue
    }
    if (block.kind === 'signature') {
      out.push({ kind: 'signature', text: `${map['company.legalName']}||${map['party.name']}` })
      continue
    }
    out.push({ kind: block.kind, text: fillText(block.text ?? '', map) })
  }
  return out
}

export function renderPlainText(ctx: RenderContext): string {
  return renderDocument(ctx)
    .map((b) => (b.kind === 'signature' ? '' : `${b.title ? b.title + ' ' : ''}${b.text}`))
    .join('\n')
}

/** Compute workflow from template rules. Base flow: Rascunho -> (rules) -> Revisão Externa -> Assinatura -> Assinado */
export function computeWorkflow(template: Template, data: FormData, ownerId: string): WorkflowStep[] {
  const steps = new Map<StepName, { assigneeId?: string; note?: string }>()
  steps.set('Rascunho', { assigneeId: ownerId })
  for (const rule of template.rules) {
    if (!rule.enabled) continue
    if (evalCondition(rule.when, data)) {
      const prev = steps.get(rule.addStep)
      steps.set(rule.addStep, { assigneeId: rule.approverId, note: prev?.note ? `${prev.note}; ${rule.name}` : rule.name })
    }
  }
  steps.set('Revisão Externa', { assigneeId: ownerId, note: 'Envio para revisão da contraparte' })
  steps.set('Assinatura em Andamento', { assigneeId: ownerId })
  steps.set('Assinado', {})
  const now = new Date().toISOString()
  return STEP_ORDER.filter((s) => steps.has(s)).map((name, i) => {
    const meta = steps.get(name)!
    const step: WorkflowStep = { id: uid('ws_'), name, status: 'pending', assigneeId: meta.assigneeId, note: meta.note }
    if (i === 0) {
      step.status = 'done'
      step.startedAt = now
      step.completedAt = now
      step.durationHours = 0
    } else if (i === 1) {
      step.status = 'in_progress'
      step.startedAt = now
    }
    return step
  })
}

export function statusFromWorkflow(workflow: WorkflowStep[]): DocStatus {
  const rejected = workflow.find((s) => s.status === 'rejected')
  if (rejected) return 'Rejeitado'
  const current = workflow.find((s) => s.status === 'in_progress')
  if (current) return current.name
  const allDone = workflow.every((s) => s.status === 'done' || s.status === 'skipped')
  if (allDone) return 'Assinado'
  return workflow[0]?.name ?? 'Rascunho'
}

export function estimatePages(blocks: RenderedBlock[]): number {
  const chars = blocks.reduce((s, b) => s + b.text.length, 0)
  return Math.max(1, Math.ceil(chars / 3200))
}

export function docSnippet(doc: Document, template: Template | undefined, rendered: RenderedBlock[]): string {
  if (!template) return doc.description
  const p = rendered.find((b) => b.kind === 'p')
  return p ? p.text.slice(0, 220) : doc.description
}
