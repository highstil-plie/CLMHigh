import type { Condition, FormData, FormValue } from '../types'

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10)
}

export function fmtCurrency(v: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
}

export function fmtNumber(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(v)
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} minuto${m > 1 ? 's' : ''}`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} hora${h > 1 ? 's' : ''}`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`
  const mo = Math.round(d / 30)
  return `há ${mo} m${mo > 1 ? 'eses' : 'ês'}`
}

export function addDays(iso: string | Date, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function addMonths(iso: string | Date, months: number): string {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${names[Number(m) - 1]}/${y.slice(2)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function toInputDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

export function fromInputDate(v: string): string {
  return v ? new Date(v + 'T12:00:00').toISOString() : ''
}

export function evalCondition(c: Condition | undefined, data: FormData): boolean {
  if (!c) return true
  const v = data[c.field]
  switch (c.op) {
    case 'truthy':
      return Array.isArray(v) ? v.length > 0 : Boolean(v)
    case 'falsy':
      return Array.isArray(v) ? v.length === 0 : !v
    case 'eq':
      return v === c.value || String(v ?? '') === String(c.value ?? '')
    case 'neq':
      return v !== c.value && String(v ?? '') !== String(c.value ?? '')
    case 'gt':
      return Number(v ?? 0) > Number(c.value ?? 0)
    case 'gte':
      return Number(v ?? 0) >= Number(c.value ?? 0)
    case 'lt':
      return Number(v ?? 0) < Number(c.value ?? 0)
    case 'lte':
      return Number(v ?? 0) <= Number(c.value ?? 0)
    case 'includes':
      return Array.isArray(v) ? v.includes(String(c.value)) : String(v ?? '').includes(String(c.value ?? ''))
    default:
      return true
  }
}

export function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return s.replace(/[&<>"']/g, (ch) => map[ch])
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlight(text: string, q: string): string {
  const safe = escapeHtml(text)
  if (!q.trim()) return safe
  const re = new RegExp(`(${escapeRegExp(q.trim())})`, 'ig')
  return safe.replace(re, '<mark>$1</mark>')
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function valueToString(v: FormValue | undefined): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

/** deterministic pseudo random generator (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)]
}

export function weighted<T>(r: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [item, w] of items) {
    x -= w
    if (x <= 0) return item
  }
  return items[items.length - 1][0]
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
