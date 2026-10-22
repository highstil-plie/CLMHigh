import { Filter, RefreshCw } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import type { Document, WidgetId } from '../types'
import { STEP_ORDER } from '../types'
import { daysUntil, fmtCurrency, fmtDate, fmtNumber, monthKey, monthLabel, relativeTime } from '../lib/utils'
import { STATUS_CHART_COLORS, StatusBadge } from './ui'

const TYPE_COLORS = ['#a020c0', '#0f8a86', '#5b8def', '#ef4d8a', '#f47b1f', '#f9a7a7', '#f2c94c', '#6b7280', '#8b5cf6']

export const WIDGET_META: Record<WidgetId, { title: string; description: string; wide?: boolean }> = {
  avg_step_time: { title: 'Tempo Médio por Etapa', description: 'Duração média (horas) de cada etapa do fluxo nos últimos 90 dias' },
  by_type: { title: 'Contratos por Tipo', description: 'Distribuição de documentos por tipo de acordo' },
  by_status: { title: 'Contratos por Status', description: 'Distribuição de documentos por etapa atual' },
  expiring_soon: { title: 'Próximos da Expiração', description: 'Contratos assinados que expiram nos próximos 90 dias', wide: true },
  expiring_by_month: { title: 'Contratos Expirando por Mês', description: 'Quantidade de contratos por mês de término' },
  my_tasks: { title: 'Minhas Tarefas', description: 'Tarefas abertas atribuídas a você' },
  value_by_month: { title: 'Valor Contratado por Mês', description: 'Soma do valor dos contratos criados por mês', wide: true },
  recent_docs: { title: 'Documentos Recentes', description: 'Últimos documentos modificados' },
  by_party_type: { title: 'Contratos por Tipo de Parte', description: 'Clientes, fornecedores e parceiros' },
  cycle_time: { title: 'Tempo de Ciclo até Assinatura', description: 'Horas médias entre criação e assinatura, por mês' },
}

function NoData({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-sm text-gray-500">
      <span className="text-2xl mb-2">—</span>
      <p className="max-w-xs">{hint}</p>
      <Link to="/clm/gerar" className="text-primary hover:underline mt-2">Gerar um documento</Link>
    </div>
  )
}

function WidgetCard({ id, count, subtitle, children, wide, empty }: { id: WidgetId; count: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean; empty?: string }) {
  const [tick, setTick] = useState(() => Date.now() - Math.floor(3 + Math.random() * 9) * 60000)
  const meta = WIDGET_META[id]
  return (
    <div className={wide ? 'card p-5 lg:col-span-2' : 'card p-5'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-medium">{meta.title}</h3>
          <div className="text-xs text-gray-500 mt-0.5">{count}</div>
        </div>
        <div className="flex items-center gap-3 text-gray-500 text-xs whitespace-nowrap">
          <span>Atualizado {relativeTime(new Date(tick).toISOString())}</span>
          <button className="hover:text-ink" title="Atualizar" onClick={() => setTick(Date.now())}>
            <RefreshCw size={16} />
          </button>
          <button className="hover:text-ink" title={meta.description}>
            <Filter size={16} />
          </button>
        </div>
      </div>
      {empty ? (
        <NoData hint={empty} />
      ) : (
        <>
          {subtitle && <div className="text-sm mt-3 mb-1">{subtitle}</div>}
          <div className="mt-2">{children}</div>
        </>
      )}
    </div>
  )
}

function Sub({ metric, by, range }: { metric: string; by: string; range: string }) {
  return (
    <span>
      <b className="font-semibold">{metric}</b> <span className="text-gray-500">▾</span> <span className="text-gray-600">por</span> <b className="font-semibold">{by}</b> <span className="text-gray-600">para</span> <b className="font-semibold">{range}</b>
    </span>
  )
}

function Donut({ data, colors }: { data: { name: string; value: number }[]; colors: (name: string, i: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-4">
      <ul className="text-xs space-y-1.5 min-w-0 flex-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors(d.name, i) }} />
            <span className="truncate">
              <b className="font-semibold">{d.name}:</b> {total ? ((d.value / total) * 100).toFixed(1).replace('.', ',') : 0}%
            </span>
          </li>
        ))}
      </ul>
      <div className="w-[190px] h-[190px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} startAngle={90} endAngle={-270} strokeWidth={1}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors(d.name, i)} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [fmtNumber(Number(v)), 'Documentos']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function Widget({ id }: { id: WidgetId }) {
  const documents = useStore((s) => s.documents)
  const tasks = useStore((s) => s.tasks)
  const parties = useStore((s) => s.parties)
  const currentUserId = useStore((s) => s.currentUserId)
  const toggleTask = useStore((s) => s.toggleTask)
  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? '—'
  const meta = WIDGET_META[id]

  const data = useMemo(() => {
    switch (id) {
      case 'avg_step_time': {
        const cutoff = Date.now() - 90 * 86400000
        const acc: Record<string, { total: number; n: number }> = {}
        let n = 0
        for (const d of documents)
          for (const s of d.workflow) {
            if (s.status !== 'done' || !s.completedAt || s.durationHours === undefined || s.durationHours <= 0) continue
            if (new Date(s.completedAt).getTime() < cutoff) continue
            acc[s.name] = acc[s.name] ?? { total: 0, n: 0 }
            acc[s.name].total += s.durationHours
            acc[s.name].n++
            n++
          }
        return { n, rows: STEP_ORDER.filter((s) => acc[s]).map((s) => ({ name: s, value: Math.round((acc[s].total / acc[s].n) * 10) / 10 })) }
      }
      case 'by_type': {
        const cutoff = Date.now() - 365 * 86400000
        const docs = documents.filter((d) => new Date(d.createdAt).getTime() >= cutoff)
        const m = new Map<string, number>()
        docs.forEach((d) => m.set(d.type, (m.get(d.type) ?? 0) + 1))
        return { n: docs.length, rows: [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) }
      }
      case 'by_status': {
        const m = new Map<string, number>()
        documents.forEach((d) => m.set(d.status, (m.get(d.status) ?? 0) + 1))
        return { n: documents.length, rows: [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) }
      }
      case 'by_party_type': {
        const m = new Map<string, number>()
        documents.forEach((d) => {
          const t = parties.find((p) => p.id === d.partyId)?.type ?? 'Outro'
          m.set(t, (m.get(t) ?? 0) + 1)
        })
        return { n: documents.length, rows: [...m.entries()].map(([name, value]) => ({ name, value })) }
      }
      case 'expiring_soon': {
        const rows = documents.filter((d) => d.status === 'Assinado' && daysUntil(d.endDate) >= 0 && daysUntil(d.endDate) <= 90).sort((a, b) => a.endDate.localeCompare(b.endDate))
        return { n: rows.length, docs: rows }
      }
      case 'expiring_by_month': {
        const m = new Map<string, number>()
        const rows = documents.filter((d) => (d.status === 'Assinado' || d.status === 'Assinatura em Andamento') && daysUntil(d.endDate) >= 0 && daysUntil(d.endDate) <= 365)
        rows.forEach((d) => m.set(monthKey(d.endDate), (m.get(monthKey(d.endDate)) ?? 0) + 1))
        return { n: rows.length, rows: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ name: monthLabel(k), value: v })) }
      }
      case 'value_by_month': {
        const m = new Map<string, number>()
        const cutoff = Date.now() - 365 * 86400000
        const rows = documents.filter((d) => new Date(d.createdAt).getTime() >= cutoff)
        rows.forEach((d) => m.set(monthKey(d.createdAt), (m.get(monthKey(d.createdAt)) ?? 0) + d.value))
        return { n: rows.length, rows: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ name: monthLabel(k), value: Math.round(v) })) }
      }
      case 'cycle_time': {
        const m = new Map<string, { t: number; n: number }>()
        const rows = documents.filter((d) => d.status === 'Assinado')
        rows.forEach((d) => {
          const signed = d.workflow.find((w) => w.name === 'Assinado')?.completedAt ?? d.modifiedAt
          const hours = (new Date(signed).getTime() - new Date(d.createdAt).getTime()) / 3600000
          const k = monthKey(signed)
          const cur = m.get(k) ?? { t: 0, n: 0 }
          m.set(k, { t: cur.t + hours, n: cur.n + 1 })
        })
        return { n: rows.length, rows: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ name: monthLabel(k), value: Math.round(v.t / v.n) })) }
      }
      case 'my_tasks': {
        const rows = tasks.filter((t) => t.assigneeId === currentUserId && t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        return { n: rows.length, tasks: rows }
      }
      case 'recent_docs': {
        const rows = [...documents].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 6)
        return { n: rows.length, docs: rows }
      }
    }
  }, [id, documents, tasks, parties, currentUserId])

  switch (id) {
    case 'avg_step_time':
      return (
        <WidgetCard id={id} count={`${fmtNumber(data.n)} Etapas`} empty={data.rows!.length === 0 ? 'Nenhuma etapa concluída nos últimos 90 dias.' : undefined} subtitle={<Sub metric="Duração Média por Etapa" by="Etapa" range="Últimos 90 Dias" />}>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={data.rows} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} tickFormatter={(v: string) => v.replace(' em Andamento', '')} label={{ value: 'Etapa', position: 'insideBottom', offset: -12, fontSize: 11, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Duração Média da Etapa (Horas)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 600, dy: 80 }} />
                <Tooltip formatter={(v) => [`${v} h`, 'Duração média']} />
                <Bar dataKey="value" fill="#0e9aa7" radius={[2, 2, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>
      )
    case 'by_type':
      return (
        <WidgetCard id={id} count={`${fmtNumber(data.n)} Documentos`} empty={data.rows!.length === 0 ? 'Nenhum documento criado nos últimos 365 dias.' : undefined} subtitle={<Sub metric="Documento Contagem" by="Tipo de Documento" range="Últimos 365 Dias" />}>
          <Donut data={data.rows!} colors={(_, i) => TYPE_COLORS[i % TYPE_COLORS.length]} />
        </WidgetCard>
      )
    case 'by_status':
      return (
        <WidgetCard id={id} count={`${fmtNumber(data.n)} Documentos`} empty={data.rows!.length === 0 ? 'Nenhum documento no repositório ainda.' : undefined} subtitle={<Sub metric="Documento Contagem" by="Status" range="Todos" />}>
          <Donut data={data.rows!} colors={(name, i) => STATUS_CHART_COLORS[name] ?? TYPE_COLORS[i % TYPE_COLORS.length]} />
        </WidgetCard>
      )
    case 'by_party_type':
      return (
        <WidgetCard id={id} count={`${fmtNumber(data.n)} Documentos`} empty={data.rows!.length === 0 ? 'Nenhuma parte com documentos ainda.' : undefined} subtitle={<Sub metric="Documento Contagem" by="Tipo de Parte" range="Todos" />}>
          <Donut data={data.rows!} colors={(_, i) => ['#0f8a86', '#f47b1f', '#5b8def'][i % 3]} />
        </WidgetCard>
      )
    case 'expiring_soon':
      return (
        <WidgetCard id={id} count={`${data.n} Registros`} wide={meta.wide} empty={documents.length === 0 ? 'Nenhum contrato no repositório ainda.' : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-gray-600">
                  <th className="th font-medium normal-case text-sm tracking-normal">Nome do Documento</th>
                  <th className="th font-medium normal-case text-sm tracking-normal">Valor Contratual</th>
                  <th className="th font-medium normal-case text-sm tracking-normal">Tipo de Acordo</th>
                  <th className="th font-medium normal-case text-sm tracking-normal">Parte</th>
                  <th className="th font-medium normal-case text-sm tracking-normal">Geografia</th>
                  <th className="th font-medium normal-case text-sm tracking-normal">Expira em</th>
                </tr>
              </thead>
              <tbody>
                {data.docs!.slice(0, 8).map((d: Document) => (
                  <tr key={d.id} className="border-b border-line hover:bg-gray-50">
                    <td className="td">
                      <Link className="hover:underline" to={`/clm/documentos/${d.id}`}>{d.name.replace(/^\[[^\]]+\]\s*/, '')}</Link>
                    </td>
                    <td className="td">{fmtNumber(d.value)}</td>
                    <td className="td">{d.type}</td>
                    <td className="td">{partyName(d.partyId)}</td>
                    <td className="td">{d.region}</td>
                    <td className="td whitespace-nowrap">{fmtDate(d.endDate)} <span className="text-gray-500 text-xs">({daysUntil(d.endDate)} d)</span></td>
                  </tr>
                ))}
                {data.docs!.length === 0 && (
                  <tr>
                    <td className="td text-gray-500" colSpan={6}>Nenhum contrato expira nos próximos 90 dias.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      )
    case 'expiring_by_month':
      return (
        <WidgetCard id={id} count={`${data.n} Documentos`} empty={data.rows!.length === 0 ? 'Nenhum contrato vigente expira nos próximos 12 meses.' : undefined} subtitle={<Sub metric="Documento Contagem" by="Data (Mensal)" range="Próximos 12 Meses" />}>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={data.rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Contratos" fill="#0e9aa7" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>
      )
    case 'value_by_month':
      return (
        <WidgetCard id={id} count={`${data.n} Documentos`} wide={meta.wide} empty={data.rows!.length === 0 ? 'Nenhum documento criado nos últimos 12 meses.' : undefined} subtitle={<Sub metric="Soma do Valor" by="Mês de Criação" range="Últimos 12 Meses" />}>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={data.rows} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Valor']} />
                <Bar dataKey="value" fill="#a020c0" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>
      )
    case 'cycle_time':
      return (
        <WidgetCard id={id} count={`${data.n} Documentos`} empty={data.rows!.length === 0 ? 'Nenhum contrato assinado ainda.' : undefined} subtitle={<Sub metric="Horas até Assinatura" by="Mês" range="Últimos 12 Meses" />}>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <LineChart data={data.rows} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v} h`, 'Tempo de ciclo']} />
                <Legend />
                <Line type="monotone" dataKey="value" name="Horas" stroke="#1f6feb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>
      )
    case 'my_tasks':
      return (
        <WidgetCard id={id} count={`${data.n} Tarefas abertas`}>
          <ul className="divide-y divide-line">
            {data.tasks!.slice(0, 7).map((t) => {
              const d = documents.find((x) => x.id === t.documentId)
              const late = daysUntil(t.dueDate) < 0
              return (
                <li key={t.id} className="py-2.5 flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={false} onChange={() => toggleTask(t.id)} title="Concluir" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{t.title}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      {d && <Link to={`/clm/documentos/${d.id}`} className="hover:underline truncate">{d.code}</Link>}
                      <span className={late ? 'text-red-600 font-medium' : ''}>Prazo: {fmtDate(t.dueDate)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
            {data.tasks!.length === 0 && <li className="py-6 text-sm text-gray-500 text-center">Você não tem tarefas abertas. 🎉</li>}
          </ul>
          <Link to="/clm/tarefas" className="text-sm text-primary hover:underline mt-2 inline-block">Ver todas as tarefas</Link>
        </WidgetCard>
      )
    case 'recent_docs':
      return (
        <WidgetCard id={id} count={`${data.n} Documentos`} empty={data.docs!.length === 0 ? 'Nenhum documento no repositório ainda.' : undefined}>
          <ul className="divide-y divide-line">
            {data.docs!.map((d: Document) => (
              <li key={d.id} className="py-2.5 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link to={`/clm/documentos/${d.id}`} className="hover:underline truncate block">{d.name}</Link>
                  <div className="text-xs text-gray-500">{partyName(d.partyId)} · {relativeTime(d.modifiedAt)}</div>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        </WidgetCard>
      )
  }
}
