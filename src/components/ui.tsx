import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DocStatus } from '../types'
import { cx } from '../lib/utils'

export function Modal({ open, onClose, title, children, footer, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('w-full bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh]', width)} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-1 rounded hover:bg-gray-100" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Avatar({ name, initials, size = 32, color = 'bg-teal' }: { name: string; initials: string; size?: number; color?: string }) {
  return (
    <span title={name} className={cx('inline-flex items-center justify-center rounded-full text-white font-semibold select-none shrink-0', color)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  Rascunho: 'bg-blue-100 text-blue-800',
  'Revisão Jurídica': 'bg-pink-100 text-pink-800',
  'Revisão Financeira': 'bg-orange-100 text-orange-800',
  'Revisão Externa': 'bg-rose-100 text-rose-800',
  'Aprovação Executiva': 'bg-amber-100 text-amber-800',
  'Assinatura em Andamento': 'bg-purple-100 text-purple-800',
  Assinado: 'bg-teal-100 text-teal-800',
  Expirado: 'bg-gray-200 text-gray-700',
  Cancelado: 'bg-gray-200 text-gray-700',
  Rejeitado: 'bg-red-100 text-red-800',
}

export const STATUS_CHART_COLORS: Record<string, string> = {
  'Assinatura em Andamento': '#a020c0',
  Assinado: '#0f8a86',
  Rascunho: '#5b8def',
  'Revisão Externa': '#ef4d8a',
  'Revisão Financeira': '#f47b1f',
  'Revisão Jurídica': '#f9a7a7',
  'Aprovação Executiva': '#f2c94c',
  Expirado: '#9ca3af',
  Rejeitado: '#dc2626',
}

export function StatusBadge({ status }: { status: DocStatus }) {
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>{status}</span>
}

export function Dropdown({ trigger, children, align = 'left' }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className={cx('absolute z-40 mt-1 min-w-[220px] rounded-md border border-line bg-white shadow-lg py-1', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
      {children}
    </button>
  )
}

export function PageHeader({ title, actions, subtitle }: { title: ReactNode; actions?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-gray-300 rounded-lg">
      <div className="text-lg font-medium">{title}</div>
      {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
      <input ref={ref} type="checkbox" className="h-4 w-4 rounded border-gray-400 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Field({ label, required, hint, children, help }: { label: ReactNode; required?: boolean; hint?: ReactNode; help?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <label className={cx('label', required && 'req')}>
        {label}
        {help && (
          <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] cursor-help align-middle" title={help}>
            i
          </span>
        )}
      </label>
      {children}
      {hint && <div className="text-xs text-gray-600 mt-1.5">{hint}</div>}
    </div>
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white px-4 py-2.5 rounded shadow-lg text-sm">{message}</div>
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const node = msg ? <Toast message={msg} onDone={() => setMsg(null)} /> : null
  return { toast: setMsg, node }
}

export function SortHeader<T extends string>({ label, field, sort, onSort, className }: { label: string; field: T; sort: { field: T; dir: 'asc' | 'desc' }; onSort: (f: T) => void; className?: string }) {
  const active = sort.field === field
  return (
    <th className={cx('th cursor-pointer select-none hover:text-ink', className)} onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cx('text-[10px]', active ? 'text-ink' : 'text-gray-400')}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  )
}
