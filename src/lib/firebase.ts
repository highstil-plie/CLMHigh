import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { initializeFirestore, type Firestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

/**
 * Banco Firestore dedicado ao CLM. O projeto tem outros bancos, de outros
 * sistemas, e manter o CLM no seu próprio isola dados e regras.
 * Vazio recai no banco (default).
 */
export const DATABASE_ID: string = import.meta.env.VITE_FIREBASE_DATABASE_ID || ''

/**
 * Bucket dedicado do CLM, para anexos que não vão para assinatura.
 * O documento assinado vive no Assinafy, não aqui.
 */
export const CLM_BUCKET: string = import.meta.env.VITE_FIREBASE_CLM_BUCKET || ''

/** Espaço de trabalho do CLM dentro do projeto, que pode ser compartilhado com outros apps. */
export const WORKSPACE: string = import.meta.env.VITE_CLM_WORKSPACE || 'default'

/** false quando o .env não foi preenchido: o app cai no modo local (localStorage). */
export const firebaseEnabled = Boolean(cfg.apiKey && cfg.projectId && cfg.appId)

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

if (firebaseEnabled) {
  app = initializeApp(cfg)
  authInstance = getAuth(app)
  // ignoreUndefinedProperties evita erro ao gravar entidades com campos opcionais ausentes
  // (etapas sem responsável, regras sem valor de comparação, etc.).
  dbInstance = DATABASE_ID
    ? initializeFirestore(app, { ignoreUndefinedProperties: true }, DATABASE_ID)
    : initializeFirestore(app, { ignoreUndefinedProperties: true })
}

export const auth = authInstance
export const db = dbInstance

/** Analytics é opcional e não deve derrubar o app onde não houver suporte. */
export async function startAnalytics() {
  if (!app || !cfg.measurementId) return
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(app)
  } catch {
    /* ambiente sem suporte a Analytics: segue sem ele */
  }
}

/** Mensagens de erro do Firebase Auth em português. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/missing-password':
      return 'Informe a senha.'
    case 'auth/weak-password':
      return 'A senha precisa ter ao menos 6 caracteres.'
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail. Use "Entrar".'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
    case 'auth/network-request-failed':
      return 'Sem conexão com o Firebase. Verifique a internet.'
    case 'auth/operation-not-allowed':
      return 'Login por e-mail e senha está desativado no console do Firebase.'
    default:
      return 'Não foi possível concluir. Tente novamente.'
  }
}
