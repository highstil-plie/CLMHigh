import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, firebaseEnabled } from './firebase'
import type { ArtifactName } from '../types'

/**
 * Acesso ao Assinafy sempre através das Cloud Functions.
 *
 * O app nunca fala direto com o Assinafy: as duas formas de autenticação deles
 * (X-Api-Key e bearer) valem para o workspace inteiro, e qualquer visitante
 * leria a credencial no bundle. O proxy guarda a chave e confere, a cada
 * chamada, se quem pede está logado e é membro do espaço de trabalho.
 */

const REGION = 'southamerica-east1'

function projectId(): string {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ''
}

function endpoint(name: string): string {
  return `https://${REGION}-${projectId()}.cloudfunctions.net/${name}`
}

async function idToken(): Promise<string> {
  const u = auth?.currentUser
  if (!u) throw new Error('Faça login para continuar.')
  return u.getIdToken()
}

function assertEnabled() {
  if (!firebaseEnabled) throw new Error('O Assinafy exige o modo Firebase. Configure o .env.')
}

async function readError(res: Response, fallback: string): Promise<never> {
  let msg = fallback
  try {
    const j = (await res.json()) as { error?: string }
    if (j?.error) msg = j.error
  } catch {
    /* resposta sem JSON */
  }
  throw new Error(msg)
}

/** Envia o PDF e devolve o id do documento no Assinafy. */
export async function uploadToAssinafy(file: Blob, fileName: string): Promise<{ documentId: string; status: string | null }> {
  assertEnabled()
  const res = await fetch(endpoint('clmAssinafyUpload'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await idToken()}`,
      'Content-Type': file.type || 'application/pdf',
      'X-File-Name': fileName,
    },
    body: file,
  })
  if (!res.ok) await readError(res, 'Falha ao enviar o documento ao Assinafy.')
  return res.json()
}

/** Baixa um artefato e devolve como Blob, para abrir ou salvar. */
export async function downloadFromAssinafy(documentId: string, artifact: ArtifactName = 'original'): Promise<Blob> {
  assertEnabled()
  const url = `${endpoint('clmAssinafyDownload')}?documentId=${encodeURIComponent(documentId)}&artifact=${artifact}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await idToken()}` } })
  if (!res.ok) await readError(res, 'Falha ao baixar o documento.')
  return res.blob()
}

export interface AssinafySigner {
  full_name: string
  email: string
}

/** Dispara o pedido de assinatura para os signatários informados. */
export async function requestSignature(input: {
  documentId: string
  signers: AssinafySigner[]
  message?: string
  expires_at?: string
}): Promise<unknown> {
  assertEnabled()
  const fn = httpsCallable(getFunctions(undefined, REGION), 'clmAssinafyRequestSignature')
  const out = await fn(input)
  return out.data
}

/** Situação atual do documento no Assinafy. */
export async function assinafyStatus(documentId: string): Promise<Record<string, unknown>> {
  assertEnabled()
  const fn = httpsCallable(getFunctions(undefined, REGION), 'clmAssinafyStatus')
  const out = await fn({ documentId })
  return out.data as Record<string, unknown>
}
