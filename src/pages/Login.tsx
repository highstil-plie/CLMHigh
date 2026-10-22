import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { auth, authErrorMessage } from '../lib/firebase'

/**
 * Tela de entrada no padrão dos portais da Highstil.
 *
 * O Google é o caminho principal. A entrada por e-mail e senha fica recolhida,
 * porque contas criadas antes deste padrão ainda dependem dela.
 */

/** Dica de domínio na tela de contas do Google. Não controla acesso: quem controla é a lista de membros. */
const HOSTED_DOMAIN = import.meta.env.VITE_GOOGLE_HOSTED_DOMAIN || ''

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

export default function Login() {
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const fail = (err: unknown) => setError(authErrorMessage((err as { code?: string }).code ?? ''))

  const google = async () => {
    if (!auth) return
    setBusy('google')
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account', ...(HOSTED_DOMAIN ? { hd: HOSTED_DOMAIN } : {}) })
      await signInWithPopup(auth, provider)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setBusy('email')
    setError(null)
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 animate-fade-in-up">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_60%)] pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <span className="font-black text-2xl tracking-[0.2em] text-white uppercase mb-2">Highstil</span>
            <div className="h-0.5 w-12 bg-blue-600 mb-3" />
            <h1 className="text-slate-300 font-medium text-xs tracking-wider uppercase">Gestão de Contratos</h1>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="font-medium leading-tight">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-slate-800 font-bold text-lg mb-1">Bem-vindo</h2>
              <p className="text-slate-500 text-sm">Faça login para acessar os contratos.</p>
            </div>

            <button
              onClick={google}
              disabled={busy !== null}
              className="w-full relative flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy === 'google' ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Autenticando...</span>
                </div>
              ) : (
                <>
                  <GoogleMark />
                  <span className="text-sm">Entrar com Google</span>
                </>
              )}
            </button>

            {showEmail && (
              <form onSubmit={submit} className="space-y-3 pt-1">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  type="email"
                  placeholder="E-mail"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  type="password"
                  placeholder="Senha"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 cursor-pointer"
                  disabled={busy !== null}
                >
                  {busy === 'email' ? 'Aguarde...' : mode === 'in' ? 'Entrar' : 'Criar conta'}
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-800 w-full text-center cursor-pointer"
                  onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null) }}
                >
                  {mode === 'in' ? 'Não tenho conta ainda' : 'Já tenho conta'}
                </button>
              </form>
            )}

            <div className="pt-6 mt-2 border-t border-slate-100 flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <ShieldCheck size={12} />
                <span>Ambiente Seguro</span>
              </div>
              <button
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => { setShowEmail((v) => !v); setError(null) }}
              >
                {showEmail ? 'Usar apenas o Google' : 'Entrar com e-mail e senha'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
