import { ChevronDown, Grid3x3, Headset, Rocket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AppSwitcher, Logo } from '../components/Layout'
import { Avatar, Dropdown, MenuItem } from '../components/ui'
import { useCurrentUser, useStore } from '../store'
import { daysUntil } from '../lib/utils'
import { cx } from '../lib/utils'

export default function Home() {
  const [switcher, setSwitcher] = useState(false)
  const [drag, setDrag] = useState(false)
  const navigate = useNavigate()
  const user = useCurrentUser()
  const documents = useStore((s) => s.documents)
  const tasks = useStore((s) => s.tasks)

  const stats = useMemo(() => {
    const cutoff = Date.now() - 180 * 86400000
    const recent = documents.filter((d) => new Date(d.modifiedAt).getTime() >= cutoff)
    const mine = (d: (typeof documents)[number]) => d.workflow.find((w) => w.status === 'in_progress')?.assigneeId === user.id
    const myTasks = tasks.filter((t) => t.assigneeId === user.id && t.status === 'open').length
    return {
      action: recent.filter((d) => d.status !== 'Assinado' && d.status !== 'Expirado' && mine(d)).length + myTasks,
      waiting: recent.filter((d) => d.ownerId === user.id && d.status !== 'Assinado' && d.status !== 'Expirado' && !mine(d)).length,
      expiring: recent.filter((d) => d.status === 'Assinado' && daysUntil(d.endDate) >= 0 && daysUntil(d.endDate) <= 60).length,
      done: recent.filter((d) => d.status === 'Assinado').length,
    }
  }, [documents, tasks, user.id])

  const tabs = [
    { label: 'Início', to: '/' },
    { label: 'Acordos', to: '/clm/documentos' },
    { label: 'Modelos', to: '/clm/admin' },
    { label: 'Relatórios', to: '/clm/relatorios' },
    { label: 'Admin', to: '/clm/admin' },
  ]

  return (
    <div className="min-h-full flex flex-col">
      <header className="relative border-b border-line bg-white">
        <div className="flex items-center h-14 px-4 gap-4">
          <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => setSwitcher(true)} aria-label="Aplicativos">
            <Grid3x3 size={20} />
          </button>
          <Logo />
          <nav className="flex items-center h-full ml-6">
            {tabs.map((t) => (
              <NavLink key={t.label} to={t.to} end className={({ isActive }) => cx('relative h-14 flex items-center px-4 text-sm text-gray-700 hover:text-ink', isActive && t.to === '/' && 'text-ink font-medium after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[3px] after:bg-ink')}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <Avatar name={user.name} initials={user.initials} size={34} color="bg-brand" />
          </div>
        </div>
        <AppSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      </header>

      <section className="bg-hero text-white">
        <div className="max-w-5xl mx-auto px-6 pt-10 pb-24 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 items-start">
          <div>
            <h1 className="text-3xl font-semibold">Bem-vindo de volta</h1>
            <div className="mt-6 flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-white text-brand font-black flex items-center justify-center text-lg">{user.initials}</span>
              <div className="text-xs leading-tight">
                <div className="opacity-80 text-[10px] font-semibold">Assinado por:</div>
                <div className="font-[cursive] text-lg -my-0.5">{user.name}</div>
                <div className="text-[9px] opacity-80 tracking-wider">3E8C4D834A1947L...</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm">Últimos 6 meses</div>
            <div className="grid grid-cols-4 gap-4 mt-3">
              {[
                ['Ação necessária', stats.action, '/clm/tarefas'],
                ['Aguardando outros', stats.waiting, '/clm/documentos?status=andamento'],
                ['Expirando em breve', stats.expiring, '/clm/documentos?expirando=60'],
                ['Concluído', stats.done, '/clm/documentos?status=Assinado'],
              ].map(([label, n, to]) => (
                <Link key={String(label)} to={String(to)} className="block hover:opacity-90">
                  <div className="text-5xl font-semibold">{n}</div>
                  <div className="text-sm mt-1">{label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 w-full -mt-16">
        <div
          className={cx('bg-white border-2 border-dashed rounded p-10 text-center shadow-sm transition-colors', drag ? 'border-primary bg-blue-50' : 'border-gray-400')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; navigate(`/clm/gerar?template=tpl_upload${f ? `&file=${encodeURIComponent(f.name)}` : ''}`) }}
        >
          <p className="text-lg font-medium">Solte os documentos para começar ou clique no botão "Iniciar".</p>
          <div className="mt-4 inline-block">
            <Dropdown
              trigger={
                <button className="btn-primary">
                  Iniciar <ChevronDown size={16} />
                </button>
              }
            >
              {(close) => (
                <>
                  <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_msa') }}>Criar Minuta Comercial (MSA)</MenuItem>
                  <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_nda') }}>Criar NDA</MenuItem>
                  <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_upload') }}>Upload de Contrato de Terceiros</MenuItem>
                  <MenuItem onClick={() => { close(); navigate('/clm/gerar') }}>Escolher um modelo...</MenuItem>
                </>
              )}
            </Dropdown>
          </div>
        </div>

        <h2 className="text-xl font-medium mt-12 pb-3 border-b border-line">Quer fazer mais?</h2>
        <div className="grid md:grid-cols-2 gap-6 mt-6 mb-16">
          <Link to="/clm" className="card flex overflow-hidden hover:shadow-md transition-shadow">
            <div className="w-28 bg-[#f6867a] flex items-center justify-center shrink-0">
              <Rocket size={40} className="text-primary" />
            </div>
            <div className="p-5">
              <div className="font-medium text-lg">Iniciar</div>
              <p className="text-sm text-gray-700 mt-1">Acesse o painel do CLM com indicadores de tempo por etapa, contratos por tipo e status e renovações próximas.</p>
            </div>
          </Link>
          <Link to="/clm/admin" className="card flex overflow-hidden hover:shadow-md transition-shadow">
            <div className="w-28 bg-[#ffd54a] flex items-center justify-center shrink-0">
              <Headset size={40} className="text-primary" />
            </div>
            <div className="p-5">
              <div className="font-medium text-lg">Dúvidas?</div>
              <p className="text-sm text-gray-700 mt-1">Configure modelos, biblioteca de cláusulas pré-aprovadas e regras condicionais de encaminhamento no módulo Administrador.</p>
            </div>
          </Link>
        </div>
      </section>

      <footer className="bg-black text-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="font-semibold mb-2">Você está nos ajudando a economizar</div>
            <p className="text-gray-300">Cada contrato gerado a partir de um modelo economiza em média 2 horas de trabalho jurídico.</p>
          </div>
          <div>
            <div className="font-semibold mb-2">Queremos seu feedback</div>
            <p className="text-gray-300">Ajude-nos a melhorar o CLM enviando sugestões pela central de ajuda.</p>
          </div>
          <div>
            <div className="font-semibold mb-2">Ajuda e suporte</div>
            <p className="text-gray-300">Suporte · Comunidade · Documentação da API</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
