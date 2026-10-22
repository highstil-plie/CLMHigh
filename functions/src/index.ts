/**
 * Funções do CLM. Ficam num codebase próprio ("clm") e todas têm o prefixo clm,
 * para que um deploy deste projeto nunca alcance as demais funções do Firebase,
 * que pertencem a outros aplicativos da mesma conta.
 *
 * Publique sempre com escopo:
 *   firebase deploy --only functions:clm
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret, defineString } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { verifyStandardWebhook } from './standardWebhooks.js'
import { ARTIFACTS, AssinafyError, createAssignment, downloadArtifact, getDocument, uploadDocument, type ArtifactName } from './assinafy.js'

initializeApp()

const ASSINAFY_API_KEY = defineSecret('ASSINAFY_API_KEY')
const ASSINAFY_ACCOUNT_ID = defineSecret('ASSINAFY_ACCOUNT_ID')
const ASSINAFY_WEBHOOK_SECRET = defineSecret('ASSINAFY_WEBHOOK_SECRET')
const CLM_WORKSPACE = defineString('CLM_WORKSPACE', { default: 'default' })
/** Banco dedicado ao CLM. Os demais bancos do projeto são de outros sistemas. */
const CLM_DATABASE = defineString('CLM_DATABASE', { default: 'clm-contratos' })

/** Firestore do CLM, nunca o banco (default) do projeto. */
function clmDb() {
  return getFirestore(CLM_DATABASE.value())
}

const REGION = 'southamerica-east1'
const base = { region: REGION, cors: true } as const

/** 20 MB: acima disso o upload direto por função deixa de ser adequado. */
const MAX_UPLOAD = 20 * 1024 * 1024

interface Caller {
  uid: string
  email: string
}

/** Confere que quem chamou está autenticado E é membro do espaço de trabalho. */
async function requireMember(email: string | undefined, uid: string | undefined): Promise<Caller> {
  if (!uid || !email) throw new HttpsError('unauthenticated', 'Faça login para continuar.')
  const ws = CLM_WORKSPACE.value()
  const snap = await clmDb().doc(`clm/${ws}`).get()
  const members: string[] = (snap.data()?.members as string[]) ?? []
  if (!members.map((m) => m.toLowerCase()).includes(email.toLowerCase())) {
    throw new HttpsError('permission-denied', 'Seu e-mail não está na lista de membros do espaço de trabalho.')
  }
  return { uid, email }
}

/**
 * Checagem para as funções HTTP.
 *
 * O token vem preferencialmente em `X-Clm-Token`, não em `Authorization`.
 * Um Bearer com JWT assinado pelo Google faz a infraestrutura de borda tentar
 * validá-lo como credencial de IAM, e em algumas redes a requisição é
 * respondida com 404 antes de chegar aqui. Um cabeçalho próprio passa intacto.
 * O `Authorization` continua aceito para não quebrar clientes antigos.
 */
async function requireMemberFromHeader(authorization: string | undefined, clmToken?: string | undefined): Promise<Caller> {
  const token = clmToken?.trim() || (authorization?.startsWith('Bearer ') ? authorization.slice(7) : null)
  if (!token) throw new HttpsError('unauthenticated', 'Token ausente.')
  let decoded
  try {
    decoded = await getAuth().verifyIdToken(token)
  } catch {
    // Token expirado ou malformado é falha de autenticação, não erro do servidor.
    throw new HttpsError('unauthenticated', 'Sessão expirada. Entre novamente.')
  }
  return requireMember(decoded.email, decoded.uid)
}

interface ErrorSink {
  status: (code: number) => { json: (body: unknown) => void }
}

function sendError(res: ErrorSink, e: unknown) {
  if (e instanceof HttpsError) {
    res.status(e.httpErrorCode.status).json({ error: e.message })
    return
  }
  if (e instanceof AssinafyError) {
    res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({ error: e.message })
    return
  }
  logger.error('Falha inesperada', e)
  res.status(500).json({ error: 'Falha inesperada.' })
}

/**
 * Envia um arquivo para o Assinafy.
 * Corpo: bytes crus do arquivo. Cabeçalhos: Authorization (token do Firebase),
 * X-File-Name e Content-Type.
 */
export const clmAssinafyUpload = onRequest(
  { ...base, secrets: [ASSINAFY_API_KEY, ASSINAFY_ACCOUNT_ID], memory: '512MiB', timeoutSeconds: 120 },
  async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST.' })
        return
      }
      const caller = await requireMemberFromHeader(req.headers.authorization, req.headers['x-clm-token'] as string | undefined)
      const bytes = req.rawBody
      if (!bytes?.length) {
        res.status(400).json({ error: 'Corpo vazio: envie os bytes do arquivo.' })
        return
      }
      if (bytes.length > MAX_UPLOAD) {
        res.status(413).json({ error: 'Arquivo acima de 20 MB.' })
        return
      }
      const name = String(req.headers['x-file-name'] || 'documento.pdf')
      const contentType = String(req.headers['content-type'] || 'application/pdf')

      const doc = await uploadDocument(ASSINAFY_API_KEY.value(), ASSINAFY_ACCOUNT_ID.value(), { name, bytes, contentType })
      logger.info('Documento enviado ao Assinafy', { documentId: doc.id, by: caller.email })
      res.json({ documentId: doc.id, status: doc.status ?? null, name: doc.name ?? name })
    } catch (e) {
      sendError(res, e)
    }
  },
)

/** Baixa um artefato do documento e devolve ao navegador, sem expor a chave. */
export const clmAssinafyDownload = onRequest(
  { ...base, secrets: [ASSINAFY_API_KEY], memory: '512MiB', timeoutSeconds: 120 },
  async (req, res) => {
    try {
      await requireMemberFromHeader(req.headers.authorization, req.headers['x-clm-token'] as string | undefined)
      const documentId = String(req.query.documentId || '')
      const artifact = String(req.query.artifact || 'original') as ArtifactName
      if (!documentId) {
        res.status(400).json({ error: 'Informe documentId.' })
        return
      }
      if (!ARTIFACTS.includes(artifact)) {
        res.status(400).json({ error: `Artefato inválido. Use um de: ${ARTIFACTS.join(', ')}.` })
        return
      }
      const { bytes, contentType } = await downloadArtifact(ASSINAFY_API_KEY.value(), documentId, artifact)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `inline; filename="${documentId}-${artifact}.pdf"`)
      res.send(bytes)
    } catch (e) {
      sendError(res, e)
    }
  },
)

/**
 * Mesma função de upload, porém como callable.
 *
 * O callable usa o transporte do SDK do Firebase, que resolve a URL sozinho e
 * manda o token no corpo, não no cabeçalho Authorization. Serve de alternativa
 * quando a chamada HTTP direta é barrada por proxy, extensão ou pela
 * interceptação do cabeçalho pela infraestrutura do Google.
 *
 * O arquivo vai em base64, o que infla cerca de 33%: o teto fica em 6 MB de
 * PDF, abaixo do limite de 10 MB do callable.
 */
export const clmAssinafyUploadCallable = onCall(
  { ...base, secrets: [ASSINAFY_API_KEY, ASSINAFY_ACCOUNT_ID], memory: '512MiB', timeoutSeconds: 120 },
  async (req: CallableRequest<{ fileBase64: string; fileName?: string; contentType?: string }>) => {
    const caller = await requireMember(req.auth?.token.email, req.auth?.uid)
    const b64 = req.data?.fileBase64
    if (!b64) throw new HttpsError('invalid-argument', 'Envie fileBase64.')
    const bytes = Buffer.from(b64, 'base64')
    if (bytes.length === 0) throw new HttpsError('invalid-argument', 'Arquivo vazio.')
    if (bytes.length > MAX_UPLOAD) throw new HttpsError('invalid-argument', 'Arquivo acima de 20 MB.')

    const doc = await uploadDocument(ASSINAFY_API_KEY.value(), ASSINAFY_ACCOUNT_ID.value(), {
      name: req.data?.fileName || 'documento.pdf',
      bytes,
      contentType: req.data?.contentType || 'application/pdf',
    })
    logger.info('Documento enviado ao Assinafy (callable)', { documentId: doc.id, by: caller.email })
    return { documentId: doc.id, status: doc.status ?? null, name: doc.name ?? req.data?.fileName ?? null }
  },
)

/** Situação do documento no Assinafy, para refletir o andamento da assinatura. */
export const clmAssinafyStatus = onCall(
  { ...base, secrets: [ASSINAFY_API_KEY] },
  async (req: CallableRequest<{ documentId: string }>) => {
    await requireMember(req.auth?.token.email, req.auth?.uid)
    const documentId = req.data?.documentId
    if (!documentId) throw new HttpsError('invalid-argument', 'Informe documentId.')
    return getDocument(ASSINAFY_API_KEY.value(), documentId)
  },
)

/** Dispara o pedido de assinatura para os signatários informados. */
export const clmAssinafyRequestSignature = onCall(
  { ...base, secrets: [ASSINAFY_API_KEY] },
  async (req: CallableRequest<{ documentId: string; signers: { full_name: string; email: string }[]; message?: string; expires_at?: string }>) => {
    const caller = await requireMember(req.auth?.token.email, req.auth?.uid)
    const { documentId, signers, message, expires_at } = req.data ?? {}
    if (!documentId) throw new HttpsError('invalid-argument', 'Informe documentId.')
    if (!Array.isArray(signers) || signers.length === 0) throw new HttpsError('invalid-argument', 'Informe ao menos um signatário.')
    for (const s of signers) {
      if (!s?.email || !s?.full_name) throw new HttpsError('invalid-argument', 'Cada signatário precisa de nome e e-mail.')
    }
    const out = await createAssignment(ASSINAFY_API_KEY.value(), documentId, { signers, message, expires_at })
    logger.info('Assinatura solicitada', { documentId, signers: signers.length, by: caller.email })
    return out
  },
)

/**
 * Recebe os eventos do Assinafy e atualiza o documento no Firestore.
 * A assinatura HMAC do corpo é conferida antes de qualquer gravação, porque
 * este endereço é público.
 */
export const clmAssinafyWebhook = onRequest(
  { region: REGION, secrets: [ASSINAFY_WEBHOOK_SECRET], memory: '256MiB' },
  async (req, res) => {
    try {
      // Assinafy assina no padrão Standard Webhooks quando signing_enabled está ligado.
      const check = verifyStandardWebhook({
        secret: ASSINAFY_WEBHOOK_SECRET.value(),
        id: req.headers['webhook-id'] as string | undefined,
        timestamp: req.headers['webhook-timestamp'] as string | undefined,
        signature: req.headers['webhook-signature'] as string | undefined,
        body: req.rawBody ?? Buffer.alloc(0),
      })
      if (!check.ok) {
        logger.warn('Webhook recusado', { motivo: check.reason })
        res.status(401).json({ error: check.reason })
        return
      }

      const event = req.body as { event?: string; data?: { id?: string; status?: string; reason?: string } }
      const documentId = event?.data?.id
      if (!documentId) {
        res.json({ ok: true, ignored: true })
        return
      }

      const ws = CLM_WORKSPACE.value()
      const col = clmDb().collection(`clm/${ws}/documents`)
      const hits = await col.where('assinafy.documentId', '==', documentId).limit(5).get()
      const now = new Date().toISOString()

      await Promise.all(
        hits.docs.map(async (snap) => {
          const doc = snap.data() as FirestoreDocument
          const patch: Record<string, unknown> = {
            assinafy: {
              documentId,
              status: event?.data?.status ?? null,
              event: event?.event ?? null,
              updatedAt: now,
              ...(event?.data?.reason ? { rejectedReason: event.data.reason } : {}),
            },
            modifiedAt: now,
            modifiedById: 'workflow',
          }
          const moved = applyEventToWorkflow(doc, event?.event, now)
          if (moved) Object.assign(patch, moved)
          await snap.ref.set(patch, { merge: true })
        }),
      )
      logger.info('Webhook aplicado', { documentId, event: event?.event, atualizados: hits.size })
      res.json({ ok: true, updated: hits.size })
    } catch (e) {
      logger.error('Falha no webhook', e)
      res.status(500).json({ error: 'Falha ao processar o evento.' })
    }
  },
)


interface WorkflowStep {
  name: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped' | 'rejected'
  startedAt?: string
  completedAt?: string
  durationHours?: number
  note?: string
}

interface FirestoreDocument {
  workflow?: WorkflowStep[]
  status?: string
}

/**
 * Converte o evento do Assinafy em avanço do fluxo.
 *
 * Só três eventos movem o contrato. Os demais servem para acompanhamento e
 * ficam apenas no campo `assinafy`, sem mexer nas etapas.
 */
function applyEventToWorkflow(doc: FirestoreDocument, event: string | undefined, now: string): Record<string, unknown> | null {
  const workflow = doc.workflow
  if (!Array.isArray(workflow) || workflow.length === 0) return null

  const idx = workflow.findIndex((w) => w.status === 'in_progress')
  if (idx < 0) return null
  const next = workflow.map((w) => ({ ...w }))
  const cur = next[idx]

  const close = () => {
    cur.completedAt = now
    if (cur.startedAt) {
      cur.durationHours = Math.round(((Date.parse(now) - Date.parse(cur.startedAt)) / 3600_000) * 10) / 10
    }
  }

  if (event === 'document_ready') {
    // Último signatário assinou: encerra a etapa e conclui o contrato.
    close()
    cur.status = 'done'
    for (let i = idx + 1; i < next.length; i++) {
      next[i].status = 'done'
      next[i].startedAt = next[i].startedAt ?? now
      next[i].completedAt = now
      next[i].durationHours = next[i].durationHours ?? 0
    }
    return { workflow: next, status: 'Assinado' }
  }

  if (event === 'signer_rejected_document' || event === 'user_rejected_document') {
    close()
    cur.status = 'rejected'
    cur.note = `${cur.note ? cur.note + ' | ' : ''}${event === 'signer_rejected_document' ? 'Signatário recusou a assinatura' : 'Documento cancelado'}`
    return { workflow: next, status: 'Rejeitado' }
  }

  if (event === 'document_processing_failed') {
    close()
    cur.status = 'rejected'
    cur.note = `${cur.note ? cur.note + ' | ' : ''}Assinafy não conseguiu processar o arquivo`
    return { workflow: next, status: 'Rejeitado' }
  }

  return null
}
