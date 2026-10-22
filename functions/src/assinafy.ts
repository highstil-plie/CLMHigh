/**
 * Cliente mínimo da API do Assinafy.
 *
 * A chave vive apenas aqui, no servidor. Ela nunca é enviada ao navegador:
 * ambos os esquemas de autenticação do Assinafy (X-Api-Key e bearer) dão acesso
 * ao workspace inteiro, então expor a chave num app de front-end permitiria a
 * qualquer visitante ler, assinar e apagar documentos.
 */

const BASE = process.env.ASSINAFY_BASE_URL || 'https://api.assinafy.com.br/v1'

export type ArtifactName = 'original' | 'certificated' | 'certificate-page' | 'pades' | 'bundle'

export const ARTIFACTS: ArtifactName[] = ['original', 'certificated', 'certificate-page', 'pades', 'bundle']

export class AssinafyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function headers(apiKey: string): Record<string, string> {
  return { 'X-Api-Key': apiKey, Accept: 'application/json' }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    /* resposta não-JSON: mantém o texto */
  }
  if (!res.ok) {
    const fromBody =
      body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : ''
    throw new AssinafyError(res.status, fromBody || `Assinafy respondeu ${res.status}`)
  }
  return body
}

/** Envia o PDF e cria o documento no workspace. Devolve o documento criado. */
export async function uploadDocument(
  apiKey: string,
  accountId: string,
  file: { name: string; bytes: Buffer; contentType: string },
): Promise<{ id: string; status?: string; name?: string }> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.contentType }), file.name)

  const res = await fetch(`${BASE}/accounts/${encodeURIComponent(accountId)}/documents`, {
    method: 'POST',
    headers: headers(apiKey),
    body: form,
  })
  const body = (await parse(res)) as { data?: { id?: string; status?: string; name?: string } } | null
  const data = body?.data ?? (body as { id?: string } | null)
  if (!data?.id) throw new AssinafyError(502, 'Assinafy não devolveu o id do documento.')
  return data as { id: string; status?: string; name?: string }
}

/** Metadados do documento, incluindo o status de assinatura. */
export async function getDocument(apiKey: string, documentId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(documentId)}`, { headers: headers(apiKey) })
  const body = (await parse(res)) as { data?: Record<string, unknown> }
  return body?.data ?? (body as Record<string, unknown>)
}

/** Baixa um artefato (original, assinado, página de certificado, PAdES ou pacote). */
export async function downloadArtifact(
  apiKey: string,
  documentId: string,
  artifact: ArtifactName,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(documentId)}/download/${artifact}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) throw new AssinafyError(res.status, `Falha ao baixar o artefato ${artifact}.`)
  const buf = Buffer.from(await res.arrayBuffer())
  return { bytes: buf, contentType: res.headers.get('content-type') || 'application/pdf' }
}

export interface SignerInput {
  full_name: string
  email: string
}

/**
 * Pede assinatura. O método `virtual` coleta a assinatura sem posicionar campos
 * página a página, que é o que o CLM precisa para o fluxo padrão.
 */
export async function createAssignment(
  apiKey: string,
  documentId: string,
  input: { signers: SignerInput[]; message?: string; expires_at?: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/documents/${encodeURIComponent(documentId)}/assignments`, {
    method: 'POST',
    headers: { ...headers(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'virtual',
      signers: input.signers,
      ...(input.message ? { message: input.message } : {}),
      ...(input.expires_at ? { expires_at: input.expires_at } : {}),
    }),
  })
  const body = (await parse(res)) as { data?: Record<string, unknown> }
  return body?.data ?? (body as Record<string, unknown>)
}
