import { ChevronDown, Grid3x3, HelpCircle, LogOut, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser, useStore } from '../store'
import { Avatar, Dropdown, MenuItem } from './ui'
import { cx } from '../lib/utils'
import { firebaseEnabled } from '../lib/firebase'
import { useAuth } from './AuthGate'

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center select-none" aria-label="Highstil Plié, início">
      <img
        src="/logo-highstil-plie.png"
        alt="Highstil Plié"
        width={1644}
        height={610}
        // O arquivo é preto sobre transparente: em fundo escuro é invertido para branco.
        className={cx('h-9 w-auto', dark && 'invert')}
      />
    </Link>
  )
}

export function AppSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  const items = [
    { label: 'eSignature', to: '/', hint: 'Início e envelopes' },
    { label: 'CLM', to: '/clm', hint: 'Gestão do ciclo de vida de contratos' },
    { label: 'Admin', to: '/clm/admin', hint: 'Modelos, cláusulas e regras' },
  ]
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-0 z-50 w-56 bg-white shadow-xl border border-line rounded-br-lg">
        <button className="p-3 hover:bg-gray-100" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
        <ul className="pb-2">
          {items.map((it) => (
            <li key={it.label}>
              <NavLink to={it.to} end={it.to === '/'} onClick={onClose} className={({ isActive }) => cx('block px-4 py-2.5 text-sm hover:bg-gray-100', isActive && 'bg-gray-200')} title={it.hint}>
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

const NAV = [
  { to: '/clm', label: 'Painel', end: true },
  { to: '/clm/documentos', label: 'Documentos' },
  { to: '/clm/tarefas', label: 'Tarefas' },
  { to: '/clm/relatorios', label: 'Relatórios' },
  { to: '/clm/contatos', label: 'Contatos' },
  { to: '/clm/partes', label: 'Partes' },
  { to: '/clm/admin', label: 'Administrador' },
]

export function TopNav() {
  const [switcher, setSwitcher] = useState(false)
  const [search, setSearch] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const tasks = useStore((s) => s.tasks)
  const openTasks = tasks.filter((t) => t.assigneeId === user.id && t.status === 'open').length
  const { logout, sync } = useAuth()

  return (
    <header className="relative border-b border-line bg-white">
      <div className="flex items-center h-14 px-4 gap-4">
        <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => setSwitcher(true)} aria-label="Aplicativos">
          <Grid3x3 size={20} />
        </button>
        <Logo />
        <nav className="flex items-center h-full ml-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('relative h-14 flex items-center px-4 text-sm text-gray-700 hover:text-ink', isActive && 'text-ink font-medium after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[3px] after:bg-ink')}>
              {n.label}
              {n.label === 'Tarefas' && openTasks > 0 && <span className="ml-1.5 rounded-full bg-red-600 text-white text-[10px] px-1.5 py-0.5 leading-none">{openTasks}</span>}
            </NavLink>
          ))}
          <span className="h-6 w-px bg-line mx-2" />
          <Dropdown
            trigger={
              <button className="h-14 flex items-center gap-1 px-4 text-sm text-gray-700 hover:text-ink">
                Ações <ChevronDown size={16} />
              </button>
            }
          >
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_msa') }}>Criar Minuta Comercial</MenuItem>
                <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_nda') }}>Criar NDA</MenuItem>
                <MenuItem onClick={() => { close(); navigate('/clm/gerar?template=tpl_upload') }}>Upload de Contrato de Terceiros</MenuItem>
                <div className="my-1 border-t border-line" />
                <MenuItem onClick={() => { close(); navigate('/clm/relatorios?novo=1') }}>Novo relatório</MenuItem>
              </>
            )}
          </Dropdown>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {firebaseEnabled && sync.state !== 'online' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1" title={sync.message}>
              {sync.state === 'connecting' ? 'Sincronizando...' : 'Sem sincronizar'}
            </span>
          )}
          {search ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                navigate(`/clm/documentos?q=${encodeURIComponent(q)}`)
                setSearch(false)
              }}
            >
              <input autoFocus className="input w-72" placeholder="Pesquisar documentos..." value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setSearch(false)} />
            </form>
          ) : (
            <button className="p-2 rounded hover:bg-gray-100" onClick={() => setSearch(true)} aria-label="Pesquisar">
              <Search size={20} />
            </button>
          )}
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Ajuda" title="Ajuda e suporte">
            <HelpCircle size={20} />
          </button>
          <Dropdown align="right" trigger={<button className="ml-1 rounded-full" aria-label="Perfil"><Avatar name={user.name} initials={user.initials} size={34} color="bg-brand" /></button>}>
            {(close) => (
              <>
                <div className="px-4 py-2 text-sm">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-gray-600 text-xs">{user.email}</div>
                  <div className="text-gray-600 text-xs">{user.role}</div>
                </div>
                <div className="my-1 border-t border-line" />
                {firebaseEnabled ? (
                  <MenuItem onClick={() => { close(); void logout() }}>
                    <LogOut size={16} /> Sair
                  </MenuItem>
                ) : (
                  <>
                    <div className="px-4 pt-1 pb-1 text-[11px] uppercase tracking-wide text-gray-500">Entrar como</div>
                    {users.map((u) => (
                      <MenuItem key={u.id} onClick={() => { setCurrentUser(u.id); close() }}>
                        <Avatar name={u.name} initials={u.initials} size={22} color={u.id === user.id ? 'bg-brand' : 'bg-gray-400'} />
                        <span className={cx(u.id === user.id && 'font-medium')}>{u.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{u.role.split(' - ')[0]}</span>
                      </MenuItem>
                    ))}
                  </>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </div>
      <AppSwitcher open={switcher} onClose={() => setSwitcher(false)} />
    </header>
  )
}

export function Layout() {
  return (
    <div className="min-h-full flex flex-col bg-white">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
