import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verificação de assinatura no padrão Standard Webhooks (standardwebhooks.com),
 * que é o adotado pelo Assinafy quando `signing_enabled` está ligado.
 *
 * A entrega traz três cabeçalhos:
 *   webhook-id         identificador único da mensagem
 *   webhook-timestamp  época em segundos
 *   webhook-signature   uma ou mais assinaturas, no formato "v1,<base64>"
 *
 * O conteúdo assinado é `{id}.{timestamp}.{corpo cru}`, com HMAC-SHA256 e a
 * chave do segredo decodificada de base64. O corpo precisa ser o texto exato
 * recebido: serializar de novo o JSON quebraria a comparação.
 */

/** Janela aceita entre o carimbo da entrega e o relógio local. */
const TOLERANCE_SECONDS = 5 * 60

export type VerifyResult = { ok: true } | { ok: false; reason: string }

export function verifyStandardWebhook(input: {
  secret: string
  id: string | undefined
  timestamp: string | undefined
  signature: string | undefined
  body: Buffer
  now?: number
}): VerifyResult {
  const { secret, id, timestamp, signature, body } = input
  if (!id || !timestamp || !signature) return { ok: false, reason: 'Cabeçalhos de assinatura ausentes.' }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Carimbo de tempo inválido.' }
  const now = input.now ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return { ok: false, reason: 'Entrega fora da janela de tempo aceita.' }

  // O segredo chega como `whsec_<base64>`; o prefixo não faz parte da chave.
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  let key: Buffer
  try {
    key = Buffer.from(raw, 'base64')
  } catch {
    return { ok: false, reason: 'Segredo mal formado.' }
  }
  if (key.length === 0) return { ok: false, reason: 'Segredo vazio.' }

  const signed = Buffer.concat([Buffer.from(`${id}.${ts}.`, 'utf8'), body])
  const expected = createHmac('sha256', key).update(signed).digest('base64')

  // O cabeçalho pode trazer várias assinaturas separadas por espaço, para
  // permitir rotação de segredo. Basta uma conferir.
  for (const part of signature.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    const a = Buffer.from(value, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true }
  }
  return { ok: false, reason: 'Assinatura não confere.' }
}
