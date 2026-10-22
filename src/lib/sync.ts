import type { User as FirebaseUser } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { WORKSPACE, db } from './firebase'
import { useStore, type AppState } from '../store'
import { createEmptyState, retargetRules } from '../data/empty'
import type { Clause, Company, Dashboard, Document, Party, Contact, Report, Task, Template, User } from '../types'
import { initials } from './utils'

/** Coleções sincronizadas, cada uma uma lista de entidades com `id`. */
export const SYNCED = ['documents', 'parties', 'contacts', 'tasks', 'reports', 'clauses', 'templates', 'dashboards', 'users'] as const
export type SyncedKey = (typeof SYNCED)[number]

type Entity = { id: string }

/** Campos do espaço de trabalho que vivem no próprio documento, não em subcoleção. */
interface WorkspaceDoc {
  members: string[]
  company: Company
  activeDashboardId: string
  favoriteFilters: string[]
  appliedFilters: string[]
}

const WS_KEYS = ['company', 'activeDashboardId', 'favoriteFilters', 'appliedFilters', 'members'] as const

function wsRef(database: Firestore) {
  return doc(database, 'clm', WORKSPACE)
}

function colRef(database: Firestore, name: SyncedKey) {
  return collection(wsRef(database), name)
}

/** Enquanto > 0, as mudanças aplicadas no store vieram do Firestore e não devem voltar para lá. */
let applyingRemote = 0

function applyRemote(fn: () => void) {
  applyingRemote++
  try {
    fn()
  } finally {
    applyingRemote--
  }
}

let detachers: (() => void)[] = []
let connected = false

export interface SyncStatus {
  state: 'off' | 'connecting' | 'online' | 'denied' | 'error'
  message?: string
}

type StatusListener = (s: SyncStatus) => void
const statusListeners = new Set<StatusListener>()
let status: SyncStatus = { state: 'off' }

export function onSyncStatus(fn: StatusListener) {
  statusListeners.add(fn)
  fn(status)
  return () => statusListeners.delete(fn)
}

function setStatus(s: SyncStatus) {
  status = s
  statusListeners.forEach((l) => l(s))
}

function isPermissionError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'permission-denied'
}

const DENIED_MESSAGE =
  'O Firestore recusou o acesso. Publique as regras do arquivo firestore.rules e confirme que o seu e-mail está na lista de membros do espaço de trabalho.'

/** Perfil do app a partir da conta do Firebase. */
function profileFrom(u: FirebaseUser): User {
  const name = u.displayName?.trim() || (u.email ? u.email.split('@')[0].replace(/[._-]+/g, ' ') : 'Usuário')
  return {
    id: u.uid,
    name,
    email: (u.email ?? '').toLowerCase(),
    initials: initials(name) || 'U',
    role: 'Membro',
  }
}

/**
 * Liga o store ao Firestore: carrega o estado remoto, cria o espaço de trabalho na
 * primeira vez, e passa a propagar mudanças nos dois sentidos.
 */
export async function connect(user: FirebaseUser): Promise<void> {
  if (!db) return
  const database = db
  if (connected) disconnect()
  setStatus({ state: 'connecting' })

  try {
    const ws = wsRef(database)
    const snap = await getDoc(ws)
    const profile = profileFrom(user)

    if (!snap.exists()) {
      // Primeiro acesso: quem entra cria o espaço e vira o único membro.
      const base = createEmptyState()
      const seedWs: WorkspaceDoc = {
        members: [profile.email],
        company: base.company,
        activeDashboardId: base.activeDashboardId,
        favoriteFilters: [],
        appliedFilters: ['createdAt'],
      }
      await setDoc(ws, seedWs)
    }

    const remote = await loadAll(database)
    const wsData = (snap.exists() ? snap.data() : await getDoc(ws).then((s) => s.data())) as WorkspaceDoc | undefined

    // Configuração inicial (modelos, cláusulas, painéis) na primeira conexão.
    const bootstrap: Partial<Record<SyncedKey, Entity[]>> = {}
    if (remote.templates.length === 0) bootstrap.templates = retargetRules(createEmptyState().templates, user.uid)
    if (remote.clauses.length === 0) bootstrap.clauses = createEmptyState().clauses
    if (remote.dashboards.length === 0) bootstrap.dashboards = createEmptyState().dashboards
    if (!remote.users.some((u) => u.id === user.uid)) bootstrap.users = [...(remote.users as Entity[]), profile]

    if (Object.keys(bootstrap).length) {
      const batch = writeBatch(database)
      for (const [key, items] of Object.entries(bootstrap)) {
        for (const item of items as Entity[]) batch.set(doc(colRef(database, key as SyncedKey), item.id), item)
      }
      await batch.commit()
      Object.assign(remote, bootstrap)
    }

    applyRemote(() =>
      useStore.setState({
        ...(remote as unknown as Partial<AppState>),
        company: wsData?.company ?? createEmptyState().company,
        activeDashboardId: wsData?.activeDashboardId ?? 'dash_me',
        favoriteFilters: wsData?.favoriteFilters ?? [],
        appliedFilters: wsData?.appliedFilters ?? ['createdAt'],
        members: wsData?.members ?? [profile.email],
        currentUserId: user.uid,
      }),
    )

    attachListeners(database)
    attachWriter(database)
    connected = true
    setStatus({ state: 'online' })
  } catch (e) {
    if (isPermissionError(e)) setStatus({ state: 'denied', message: DENIED_MESSAGE })
    else setStatus({ state: 'error', message: e instanceof Error ? e.message : 'Falha ao conectar ao Firestore.' })
    throw e
  }
}

async function loadAll(database: Firestore) {
  const out = {} as Record<SyncedKey, Entity[]>
  await Promise.all(
    SYNCED.map(async (name) => {
      const s = await getDocs(colRef(database, name))
      out[name] = s.docs.map((d) => ({ ...(d.data() as Entity), id: d.id }))
    }),
  )
  return out as {
    documents: Document[]
    parties: Party[]
    contacts: Contact[]
    tasks: Task[]
    reports: Report[]
    clauses: Clause[]
    templates: Template[]
    dashboards: Dashboard[]
    users: User[]
  }
}

function attachListeners(database: Firestore) {
  for (const name of SYNCED) {
    const un = onSnapshot(
      colRef(database, name),
      (s) => {
        if (s.metadata.hasPendingWrites) return // eco da nossa própria escrita
        const items = s.docs.map((d) => ({ ...(d.data() as Entity), id: d.id }))
        applyRemote(() => useStore.setState({ [name]: items } as unknown as Partial<AppState>))
      },
      (e) => setStatus(isPermissionError(e) ? { state: 'denied', message: DENIED_MESSAGE } : { state: 'error', message: e.message }),
    )
    detachers.push(un)
  }

  const un = onSnapshot(
    wsRef(database),
    (s) => {
      if (s.metadata.hasPendingWrites || !s.exists()) return
      const d = s.data() as WorkspaceDoc
      applyRemote(() =>
        useStore.setState({
          company: d.company,
          activeDashboardId: d.activeDashboardId,
          favoriteFilters: d.favoriteFilters ?? [],
          appliedFilters: d.appliedFilters ?? [],
          members: d.members ?? [],
        }),
      )
    },
    (e) => setStatus(isPermissionError(e) ? { state: 'denied', message: DENIED_MESSAGE } : { state: 'error', message: e.message }),
  )
  detachers.push(un)
}

/** Escritas pendentes, agrupadas para não gerar uma ida ao servidor por tecla digitada. */
const pending = new Map<string, { ref: ReturnType<typeof doc>; data: Entity | null }>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let wsDirty = false

function queue(key: string, ref: ReturnType<typeof doc>, data: Entity | null, database: Firestore) {
  pending.set(key, { ref, data })
  schedule(database)
}

function schedule(database: Firestore) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(database), 400)
}

async function flush(database: Firestore) {
  flushTimer = null
  const items = [...pending.values()]
  pending.clear()
  const dirty = wsDirty
  wsDirty = false
  if (!items.length && !dirty) return

  try {
    // writeBatch aceita até 500 operações por envio.
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(database)
      for (const { ref, data } of items.slice(i, i + 450)) {
        if (data) batch.set(ref, data)
        else batch.delete(ref)
      }
      await batch.commit()
    }
    if (dirty) {
      const s = useStore.getState()
      const patch: Partial<WorkspaceDoc> = {
        company: s.company,
        activeDashboardId: s.activeDashboardId,
        favoriteFilters: s.favoriteFilters,
        appliedFilters: s.appliedFilters,
        members: s.members,
      }
      await setDoc(wsRef(database), patch, { merge: true })
    }
    if (status.state !== 'online') setStatus({ state: 'online' })
  } catch (e) {
    if (isPermissionError(e)) setStatus({ state: 'denied', message: DENIED_MESSAGE })
    else setStatus({ state: 'error', message: e instanceof Error ? e.message : 'Falha ao gravar no Firestore.' })
  }
}

function attachWriter(database: Firestore) {
  const un = useStore.subscribe((state: AppState, prev: AppState) => {
    if (applyingRemote > 0) return

    for (const name of SYNCED) {
      const next = state[name] as unknown as Entity[]
      const before = prev[name] as unknown as Entity[]
      if (next === before) continue
      const beforeMap = new Map(before.map((x) => [x.id, x]))
      const afterMap = new Map(next.map((x) => [x.id, x]))
      for (const [id, item] of afterMap) {
        if (beforeMap.get(id) !== item) queue(`${name}/${id}`, doc(colRef(database, name), id), item, database)
      }
      for (const id of beforeMap.keys()) {
        if (!afterMap.has(id)) queue(`${name}/${id}`, doc(colRef(database, name), id), null, database)
      }
    }

    if (WS_KEYS.some((k) => state[k] !== prev[k])) {
      wsDirty = true
      schedule(database)
    }
  })
  detachers.push(un)
}

export function disconnect() {
  detachers.forEach((d) => d())
  detachers = []
  pending.clear()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  wsDirty = false
  connected = false
  setStatus({ state: 'off' })
}
