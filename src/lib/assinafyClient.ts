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

/**
 * Base das funções HTTP. O endereço legado `cloudfunctions.net` funciona para
 * funções de 2ª geração, mas leva alguns minutos para voltar a responder depois
 * de um deploy. A variável permite apontar direto para o endereço `run.app`
 * sem mexer no código.
 */
const FUNCTIONS_BASE = (import.meta.env.VITE_CLM_FUNCTIONS_BASE || '').replace(/\/$/, '')

/** Sufixo do endereço direto no Cloud Run, visto na saída do deploy. */
const RUN_HASH = import.meta.env.VITE_CLM_FUNCTIONS_HASH || ''

function endpoint(name: string): string {
  if (FUNCTIONS_BASE) return `${FUNCTIONS_BASE}/${name}`
  return `https://${REGION}-${projectId()}.cloudfunctions.net/${name}`
}

/** Endereço direto da função, usado quando o legado não responde. */
function runEndpoint(name: string): string | null {
  if (!RUN_HASH) return null
  return `https://${name.toLowerCase()}-${RUN_HASH}.a.run.app`
}

/**
 * Chama a função pelo endereço legado e, se ele devolver 404, tenta o endereço
 * direto do Cloud Run. O legado às vezes deixa de responder por alguns minutos
 * depois de um deploy, e não vale perder o envio por causa disso.
 */
async function callFunction(name: string, init: RequestInit): Promise<Response> {
  const res = await fetch(endpoint(name), init)
  if (res.status !== 404) return res
  const alt = runEndpoint(name)
  if (!alt) return res
  return fetch(alt, init)
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
  let msg = ''
  try {
    const j = (await res.json()) as { error?: string }
    if (j?.error) msg = j.error
  } catch {
    /* resposta sem JSON */
  }
  // Uma mensagem no corpo significa que a função respondeu: mostra a causa real.
  if (msg) throw new Error(msg)
  if (res.status === 404) throw new Error('A função não foi encontrada (404). Confira se o deploy das funções foi concluído.')
  throw new Error(fallback)
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  // Em blocos, para não estourar a pilha com arquivos grandes.
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192))
  return btoa(bin)
}

/** Envio pelo transporte do SDK, imune a bloqueio do cabeçalho Authorization. */
async function uploadViaCallable(file: Blob, fileName: string): Promise<{ documentId: string; status: string | null }> {
  const fn = httpsCallable(getFunctions(undefined, REGION), 'clmAssinafyUploadCallable')
  const out = await fn({
    fileBase64: await blobToBase64(file),
    fileName,
    contentType: file.type || 'application/pdf',
  })
  return out.data as { documentId: string; status: string | null }
}

/**
 * Envia o PDF e devolve o id do documento no Assinafy.
 *
 * Tenta primeiro a função HTTP, que não precisa converter o arquivo. Se ela
 * devolver 404, o que acontece quando algo entre o navegador e o Google barra
 * a chamada direta, recorre ao callable, que usa o transporte do SDK.
 */
export async function uploadToAssinafy(file: Blob, fileName: string): Promise<{ documentId: string; status: string | null }> {
  assertEnabled()
  // Cabeçalhos só aceitam Latin-1: acentos passam, travessão e aspas curvas não.
  const safeName = fileName.replace(/[^ -ÿ]/g, '-')
  let res: Response
  try {
    res = await callFunction('clmAssinafyUpload', {
      method: 'POST',
      headers: {
        // Cabeçalho próprio em vez de Authorization: um Bearer com JWT do Google
        // é interceptado pela borda em algumas redes e vira 404.
        'X-Clm-Token': await idToken(),
        'Content-Type': file.type || 'application/pdf',
        'X-File-Name': safeName,
      },
      body: file,
    })
  } catch {
    return uploadViaCallable(file, safeName)
  }
  if (!res.ok) await readError(res, 'Falha ao enviar o documento ao Assinafy.')
  return res.json()
}

/** Baixa um artefato e devolve como Blob, para abrir ou salvar. */
export async function downloadFromAssinafy(documentId: string, artifact: ArtifactName = 'original'): Promise<Blob> {
  assertEnabled()
  const qs = `?documentId=${encodeURIComponent(documentId)}&artifact=${artifact}`
  const init = { headers: { 'X-Clm-Token': await idToken() } }
  let res = await fetch(endpoint('clmAssinafyDownload') + qs, init)
  if (res.status === 404) {
    const alt = runEndpoint('clmAssinafyDownload')
    if (alt) res = await fetch(alt + qs, init)
  }
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
