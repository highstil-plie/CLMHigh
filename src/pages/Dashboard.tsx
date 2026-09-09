import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Widget, WIDGET_META } from '../components/Widgets'
import { Checkbox, Modal } from '../components/ui'
import { useStore } from '../store'
import type { WidgetId } from '../types'
import { cx } from '../lib/utils'

export default function Dashboard() {
  const dashboards = useStore((s) => s.dashboards)
  const activeId = useStore((s) => s.activeDashboardId)
  const setActive = useStore((s) => s.setActiveDashboard)
  const setWidgets = useStore((s) => s.setDashboardWidgets)
  const addDashboard = useStore((s) => s.addDashboard)
  const [customize, setCustomize] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const dash = dashboards.find((d) => d.id === activeId) ?? dashboards[0]

  const toggle = (id: WidgetId, on: boolean) => {
    const next = on ? [...dash.widgets, id] : dash.widgets.filter((w) => w !== id)
    setWidgets(dash.id, next)
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="bg-white border-b border-line">
        <div className="flex items-center px-4">
          <div className="flex items-center overflow-x-auto">
            {dashboards.map((d) => (
              <button key={d.id} className={cx('tab', d.id === dash.id && 'tab-active')} onClick={() => setActive(d.id)}>
                {d.name}
              </button>
            ))}
            <button className="tab text-gray-500 flex items-center gap-1" onClick={() => setAdding(true)} title="Novo painel">
              <Plus size={14} /> Novo painel
            </button>
          </div>
          <button className="ml-auto btn-ghost text-sm" onClick={() => setCustomize(true)}>
            <Settings2 size={16} /> Personalizar
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {dash.widgets.map((w) => (
          <Widget key={w} id={w} />
        ))}
        {dash.widgets.length === 0 && (
          <div className="card p-10 text-center text-gray-600 lg:col-span-3">
            Este painel está vazio. Clique em <b>Personalizar</b> para adicionar visualizações.
          </div>
        )}
      </div>

      <Modal
        open={customize}
        onClose={() => setCustomize(false)}
        title={`Personalizar: ${dash.name}`}
        footer={<button className="btn-primary" onClick={() => setCustomize(false)}>Concluído</button>}
      >
        <p className="text-sm text-gray-600 mb-4">Escolha as visualizações exibidas neste painel. As alterações são salvas automaticamente para todos os usuários do painel.</p>
        <ul className="divide-y divide-line">
          {(Object.keys(WIDGET_META) as WidgetId[]).map((id) => (
            <li key={id} className="py-3 flex items-start gap-3">
              <Checkbox checked={dash.widgets.includes(id)} onChange={(v) => toggle(id, v)} />
              <div>
                <div className="text-sm font-medium">{WIDGET_META[id].title}</div>
                <div className="text-xs text-gray-600">{WIDGET_META[id].description}</div>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Novo painel"
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!newName.trim()} onClick={() => { addDashboard(newName.trim()); setNewName(''); setAdding(false); setCustomize(true) }}>Criar</button>
          </>
        }
      >
        <label className="label req">Nome do painel</label>
        <input className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Departamento Financeiro" />
      </Modal>
    </div>
  )
}
