import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Clause, Company, Contact, Dashboard, Document, FormData, GenerationDraft, Party, Report, Task, Template, User, WidgetId } from './types'
import { createSeed } from './data/seed'
import { createEmptyState, retargetRules } from './data/empty'
import { firebaseEnabled } from './lib/firebase'
import { computeWorkflow, effectiveTerms, estimatePages, renderDocument, resolveParty, statusFromWorkflow } from './lib/engine'
import { addDays, addMonths, initials, uid } from './lib/utils'

const STATE_VERSION = 5

/** Com o Firebase ligado o estado vive no Firestore, não no navegador. */
const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
}

export interface AppState {
  users: User[]
  currentUserId: string
  company: Company
  parties: Party[]
  contacts: Contact[]
  clauses: Clause[]
  templates: Template[]
  documents: Document[]
  tasks: Task[]
  reports: Report[]
  dashboards: Dashboard[]
  activeDashboardId: string
  draft: GenerationDraft | null
  favoriteFilters: string[]
  appliedFilters: string[]
  /** E-mails com acesso ao espaço de trabalho no Firestore. Vazio no modo local. */
  members: string[]

  setCurrentUser: (id: string) => void
  createDocument: (input: { templateId: string; data: FormData }) => string
  updateDocument: (id: string, patch: Partial<Document>) => void
  deleteDocuments: (ids: string[]) => void
  addComment: (docId: string, text: string) => void
  resolveComment: (docId: string, commentId: string) => void
  addTask: (docId: string, title: string, assigneeId: string, dueDate: string) => void
  toggleTask: (id: string) => void
  completeStep: (docId: string, action: 'approve' | 'reject', note?: string) => void
  reopenDocument: (docId: string) => void
  addReport: (r: Omit<Report, 'id' | 'createdAt' | 'modifiedAt' | 'createdById'>) => string
  updateReport: (id: string, patch: Partial<Report>) => void
  deleteReports: (ids: string[]) => void
  setDashboardWidgets: (dashId: string, widgets: WidgetId[]) => void
  addDashboard: (name: string) => string
  setActiveDashboard: (id: string) => void
  setDraft: (d: GenerationDraft | null) => void
  toggleClauseApproved: (id: string) => void
  toggleRule: (templateId: string, ruleId: string) => void
  addClause: (c: Omit<Clause, 'id' | 'updatedAt'>) => void
  addParty: (p: Omit<Party, 'id' | 'createdAt'>) => string
  addContact: (c: Omit<Contact, 'id'>) => void
  toggleFavoriteFilter: (id: string) => void
  setAppliedFilters: (ids: string[]) => void
  updateCompany: (patch: Partial<Company>) => void
  updateUser: (id: string, patch: Partial<User>) => void
  setMembers: (emails: string[]) => void
  setRuleApprover: (templateId: string, ruleId: string, approverId: string) => void
  loadDemoData: () => void
  clearAll: () => void
}

function nextCode(docs: Document[]): string {
  const max = docs.reduce((m, d) => Math.max(m, Number(d.code.replace(/\D/g, '')) || 0), 0)
  return `ID-${String(max + 1).padStart(4, '0')}`
}

const ABBR: Record<string, string> = {
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createEmptyState(),
      draft: null,
      favoriteFilters: [],
      appliedFilters: ['createdAt'],
      members: [],

      setCurrentUser: (id) => set({ currentUserId: id }),

      createDocument: ({ templateId, data }) => {
        const s = get()
        const template = s.templates.find((t) => t.id === templateId)
        if (!template) throw new Error('Template não encontrado')
        const now = new Date().toISOString()
        let party = resolveParty(data, s.parties)
        const parties = [...s.parties]
        const contacts = [...s.contacts]
        if (party && party.id === 'new') {
          party = { ...party, id: uid('p_'), contactId: s.currentUserId, createdAt: now }
          parties.push(party)
          contacts.push({ id: uid('c_'), name: 'Contato principal', email: '', phone: '', role: 'Representante', partyId: party.id, internal: false })
        }
        if (!party) throw new Error('Parte não informada')
        const terms = effectiveTerms(template, data)
        const code = nextCode(s.documents)
        const type = template.isUpload ? ((data.docType as Document['type']) ?? template.type) : template.type
        const startDate = String(data.startDate ?? now)
        const workflow = computeWorkflow(template, data, s.currentUserId)
        const rendered = renderDocument({ template, data, party, company: s.company, clauses: s.clauses, createdAt: now })
        const value = Number(data.value ?? 0)
        const attachments = Array.isArray(data.attachments) ? (data.attachments as string[]) : []
        const doc: Document = {
          id: uid('d_'),
          code,
          name: template.isUpload ? `[${code}] ${party.name} - ${ABBR[type] ?? 'Doc'}.pdf` : `[${code}] ${party.name} - ${template.abbr}.docx`,
          type,
          status: statusFromWorkflow(workflow),
          templateId,
          partyId: party.id,
          ownerId: s.currentUserId,
          value,
          startDate,
          endDate: addMonths(startDate, terms.termMonths),
          termMonths: terms.termMonths,
          description: template.isUpload ? String(data.docName ?? '') : template.description,
          location: code,
          region: 'Sudeste',
          tags: [template.abbr, party.type].concat(value > 100000 ? ['Alto valor'] : []),
          formData: data,
          workflow,
          comments: [],
          versions: [{ id: uid('v_'), number: 1, createdAt: now, createdById: s.currentUserId, note: 'Documento gerado a partir do modelo' }],
          attachments: attachments.map((n) => ({ id: uid('att_'), name: n, size: 250_000 })),
          createdAt: now,
          modifiedAt: now,
          modifiedById: s.currentUserId,
          pages: estimatePages(rendered),
        }
        const current = workflow.find((w) => w.status === 'in_progress')
        const tasks = [...s.tasks]
        if (current && current.assigneeId) {
          tasks.unshift({
            id: uid('t_'),
            documentId: doc.id,
            title: `${current.name}: ${doc.name}`,
            assigneeId: current.assigneeId,
            createdById: 'workflow',
            status: 'open',
            dueDate: addDays(now, 5),
            createdAt: now,
          })
        }
        set({ documents: [doc, ...s.documents], parties, contacts, tasks, draft: null })
        return doc.id
      },

      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch, modifiedAt: new Date().toISOString(), modifiedById: s.currentUserId } : d)),
        })),

      deleteDocuments: (ids) => set((s) => ({ documents: s.documents.filter((d) => !ids.includes(d.id)), tasks: s.tasks.filter((t) => !ids.includes(t.documentId)) })),

      addComment: (docId, text) => {
        const s = get()
        const now = new Date().toISOString()
        const mentions = s.users.filter((u) => text.includes(`@${u.name}`)).map((u) => u.id)
        const doc = s.documents.find((d) => d.id === docId)
        if (!doc) return
        const newTasks: Task[] = mentions
          .filter((m) => m !== s.currentUserId)
          .map((m) => ({
            id: uid('t_'),
            documentId: docId,
            title: `Responder comentário em ${doc.name}`,
            assigneeId: m,
            createdById: s.currentUserId,
            status: 'open',
            dueDate: addDays(now, 3),
            createdAt: now,
          }))
        set({
          documents: s.documents.map((d) =>
            d.id === docId
              ? { ...d, comments: [...d.comments, { id: uid('cm_'), authorId: s.currentUserId, text, createdAt: now, mentions }], modifiedAt: now, modifiedById: s.currentUserId }
              : d,
          ),
          tasks: [...newTasks, ...s.tasks],
        })
      },

      resolveComment: (docId, commentId) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === docId ? { ...d, comments: d.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)) } : d)),
        })),

      addTask: (docId, title, assigneeId, dueDate) =>
        set((s) => ({
          tasks: [{ id: uid('t_'), documentId: docId, title, assigneeId, createdById: s.currentUserId, status: 'open', dueDate, createdAt: new Date().toISOString() }, ...s.tasks],
        })),

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: t.status === 'open' ? 'done' : 'open', completedAt: t.status === 'open' ? new Date().toISOString() : undefined } : t)),
        })),

      completeStep: (docId, action, note) => {
        const s = get()
        const now = new Date().toISOString()
        const doc = s.documents.find((d) => d.id === docId)
        if (!doc) return
        const idx = doc.workflow.findIndex((w) => w.status === 'in_progress')
        if (idx < 0) return
        const workflow = doc.workflow.map((w) => ({ ...w }))
        const cur = workflow[idx]
        const started = cur.startedAt ? new Date(cur.startedAt).getTime() : Date.now()
        cur.completedAt = now
        cur.durationHours = Math.round(((Date.now() - started) / 3600_000) * 10) / 10
        cur.note = note ? `${cur.note ? cur.note + ' | ' : ''}${note}` : cur.note
        if (action === 'reject') {
          cur.status = 'rejected'
        } else {
          cur.status = 'done'
          const next = workflow[idx + 1]
          if (next) {
            if (next.name === 'Assinado') {
              next.status = 'done'
              next.startedAt = now
              next.completedAt = now
              next.durationHours = 0
            } else {
              next.status = 'in_progress'
              next.startedAt = now
            }
          }
        }
        const status = statusFromWorkflow(workflow)
        const tasks = s.tasks.map((t) => (t.documentId === docId && t.status === 'open' && t.createdById === 'workflow' ? { ...t, status: 'done' as const, completedAt: now } : t))
        const nextStep = workflow.find((w) => w.status === 'in_progress')
        if (nextStep?.assigneeId) {
          tasks.unshift({
            id: uid('t_'),
            documentId: docId,
            title: `${nextStep.name}: ${doc.name}`,
            assigneeId: nextStep.assigneeId,
            createdById: 'workflow',
            status: 'open',
            dueDate: addDays(now, 5),
            createdAt: now,
          })
        }
        const versions = [...doc.versions, { id: uid('v_'), number: doc.versions.length + 1, createdAt: now, createdById: s.currentUserId, note: action === 'approve' ? `${cur.name} concluída` : `${cur.name} rejeitada${note ? ': ' + note : ''}` }]
        set({
          documents: s.documents.map((d) => (d.id === docId ? { ...d, workflow, status, versions, modifiedAt: now, modifiedById: 'workflow' } : d)),
          tasks,
        })
      },

      reopenDocument: (docId) => {
        const s = get()
        const now = new Date().toISOString()
        set({
          documents: s.documents.map((d) => {
            if (d.id !== docId) return d
            const workflow = d.workflow.map((w) => (w.status === 'rejected' ? { ...w, status: 'in_progress' as const, startedAt: now, completedAt: undefined } : w))
            return { ...d, workflow, status: statusFromWorkflow(workflow), modifiedAt: now, modifiedById: s.currentUserId, versions: [...d.versions, { id: uid('v_'), number: d.versions.length + 1, createdAt: now, createdById: s.currentUserId, note: 'Documento reaberto após ajustes' }] }
          }),
        })
      },

      addReport: (r) => {
        const now = new Date().toISOString()
        const id = uid('r_')
        set((s) => ({ reports: [{ ...r, id, createdAt: now, modifiedAt: now, createdById: s.currentUserId }, ...s.reports] }))
        return id
      },
      updateReport: (id, patch) => set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch, modifiedAt: new Date().toISOString() } : r)) })),
      deleteReports: (ids) => set((s) => ({ reports: s.reports.filter((r) => !ids.includes(r.id)) })),

      setDashboardWidgets: (dashId, widgets) => set((s) => ({ dashboards: s.dashboards.map((d) => (d.id === dashId ? { ...d, widgets } : d)) })),
      addDashboard: (name) => {
        const id = uid('dash_')
        set((s) => ({ dashboards: [...s.dashboards, { id, name, widgets: ['by_status', 'recent_docs'] }], activeDashboardId: id }))
        return id
      },
      setActiveDashboard: (id) => set({ activeDashboardId: id }),

      setDraft: (draft) => set({ draft }),

      toggleClauseApproved: (id) => set((s) => ({ clauses: s.clauses.map((c) => (c.id === id ? { ...c, approved: !c.approved, updatedAt: new Date().toISOString() } : c)) })),
      toggleRule: (templateId, ruleId) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === templateId ? { ...t, rules: t.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)), updatedAt: new Date().toISOString() } : t)),
        })),
      addClause: (c) => set((s) => ({ clauses: [...s.clauses, { ...c, id: uid('cl_'), updatedAt: new Date().toISOString() }] })),

      addParty: (p) => {
        const id = uid('p_')
        set((s) => ({ parties: [...s.parties, { ...p, id, createdAt: new Date().toISOString() }] }))
        return id
      },
      addContact: (c) => set((s) => ({ contacts: [...s.contacts, { ...c, id: uid('c_') }] })),

      toggleFavoriteFilter: (id) => set((s) => ({ favoriteFilters: s.favoriteFilters.includes(id) ? s.favoriteFilters.filter((f) => f !== id) : [...s.favoriteFilters, id] })),
      setAppliedFilters: (ids) => set({ appliedFilters: ids }),

      updateCompany: (patch) => set((s) => ({ company: { ...s.company, ...patch } })),

      updateUser: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== id) return u
            const next = { ...u, ...patch }
            if (patch.name && !patch.initials) next.initials = initials(patch.name) || 'U'
            return next
          }),
        })),

      setMembers: (emails) => set({ members: [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))] }),

      setRuleApprover: (templateId, ruleId, approverId) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId ? { ...t, rules: t.rules.map((r) => (r.id === ruleId ? { ...r, approverId } : r)), updatedAt: new Date().toISOString() } : t,
          ),
        })),

      loadDemoData: () =>
        set((s) => {
          const seed = createSeed()
          if (!firebaseEnabled) return { ...seed, currentUserId: 'u_douglas', activeDashboardId: 'dash_contracts', draft: null, favoriteFilters: [], appliedFilters: ['createdAt'] }
          // Com Firebase, quem opera continua sendo a conta logada. Os usuários de
          // exemplo entram apenas como rótulos, para os documentos terem proprietário.
          const me = s.users.find((u) => u.id === s.currentUserId)
          return {
            ...seed,
            users: me ? [...seed.users.filter((u) => u.id !== me.id), me] : seed.users,
            currentUserId: s.currentUserId,
            activeDashboardId: 'dash_contracts',
            draft: null,
            favoriteFilters: [],
            appliedFilters: ['createdAt'],
          }
        }),

      clearAll: () =>
        set((s) => {
          const base = createEmptyState()
          if (!firebaseEnabled) return { ...base, draft: null, favoriteFilters: [], appliedFilters: ['createdAt'] }
          const me = s.users.find((u) => u.id === s.currentUserId)
          return {
            ...base,
            // Preserva só a conta logada e reaponta as regras para ela.
            users: me ? [me] : base.users,
            templates: me ? retargetRules(base.templates, me.id) : base.templates,
            currentUserId: s.currentUserId,
            draft: null,
            favoriteFilters: [],
            appliedFilters: ['createdAt'],
          }
        }),

    }),
    {
      name: 'clm-state',
      version: STATE_VERSION,
      storage: createJSONStorage(() => (firebaseEnabled ? noopStorage : localStorage)),
      migrate: () => ({ ...createEmptyState(), draft: null, favoriteFilters: [], appliedFilters: ['createdAt'] }) as unknown as AppState,
    },
  ),
)

export const useCurrentUser = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0])
