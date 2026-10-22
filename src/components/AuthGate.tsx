import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, firebaseEnabled, startAnalytics } from '../lib/firebase'
import { connect, disconnect, onSyncStatus, type SyncStatus } from '../lib/sync'
import Login from '../pages/Login'

interface AuthValue {
  user: FirebaseUser | null
  sync: SyncStatus
  logout: () => Promise<void>
}

const Ctx = createContext<AuthValue>({ user: null, sync: { state: 'off' }, logout: async () => {} })

export const useAuth = () => useContext(Ctx)

function Splash({ text }: { text: string }) {
  return (
    <div className="min-h-full flex items-center justify-center text-sm text-gray-600">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-brand rounded-full animate-spin mx-auto mb-3" />
        {text}
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [sync, setSync] = useState<SyncStatus>({ state: 'off' })

  useEffect(() => {
    const un = onSyncStatus(setSync)
    return () => {
      un()
    }
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setChecking(false)
      return
    }
    void startAnalytics()
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setChecking(false)
      if (u) void connect(u).catch(() => {})
      else disconnect()
    })
  }, [])

  // Sem configuração do Firebase o app segue funcionando no modo local (localStorage).
  if (!firebaseEnabled) return <>{children}</>

  if (checking) return <Splash text="Verificando acesso..." />
  if (!user) return <Login />
  if (sync.state === 'connecting') return <Splash text="Carregando seus dados..." />

  if (sync.state === 'denied' || sync.state === 'error') {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-lg">
          <h1 className="text-2xl font-semibold">{sync.state === 'denied' ? 'Acesso negado pelo Firestore' : 'Falha ao carregar'}</h1>
          <p className="text-sm text-gray-700 mt-3">{sync.message}</p>
          <p className="text-sm text-gray-600 mt-3">Você está autenticado como {user.email}.</p>
          <div className="flex gap-3 mt-6">
            <button className="btn-primary" onClick={() => void connect(user).catch(() => {})}>Tentar de novo</button>
            <button className="btn-secondary" onClick={() => void signOut(auth!)}>Sair</button>
          </div>
        </div>
      </div>
    )
  }

  return <Ctx.Provider value={{ user, sync, logout: async () => { disconnect(); await signOut(auth!) } }}>{children}</Ctx.Provider>
}
