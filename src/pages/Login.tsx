import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { useState } from 'react'
import { Logo } from '../components/Layout'
import { auth, authErrorMessage } from '../lib/firebase'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(authErrorMessage((err as { code?: string }).code ?? ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="h-14 border-b border-line flex items-center px-4">
        <Logo />
      </header>
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight">{mode === 'in' ? 'Entrar' : 'Criar conta'}</h1>
          <p className="text-sm text-gray-600 mt-2">
            {mode === 'in'
              ? 'Use o e-mail cadastrado no Firebase deste projeto.'
              : 'A conta é criada no Firebase, mas o acesso aos contratos depende de o seu e-mail estar na lista de membros do espaço de trabalho.'}
          </p>

          <form className="mt-8" onSubmit={submit}>
            <label className="label req" htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input mb-4"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="label req" htmlFor="password">Senha</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'up' && <div className="text-xs text-gray-600 mt-1.5">Mínimo de 6 caracteres.</div>}

            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mt-4">{error}</div>}

            <button className="btn-primary w-full mt-6" disabled={busy}>
              {busy ? 'Aguarde...' : mode === 'in' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <button
            className="text-sm text-brand hover:underline mt-5"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in')
              setError(null)
            }}
          >
            {mode === 'in' ? 'Não tenho conta ainda' : 'Já tenho conta'}
          </button>
        </div>
      </div>
    </div>
  )
}
