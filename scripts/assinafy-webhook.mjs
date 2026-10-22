#!/usr/bin/env node
/**
 * Cadastra (ou revisa) o endpoint de webhook do CLM no Assinafy.
 *
 * A chave do Assinafy não fica em arquivo: passe pelo ambiente, só nesta
 * execução. Ela dá acesso ao workspace inteiro.
 *
 *   ASSINAFY_API_KEY=xxx ASSINAFY_ACCOUNT_ID=yyy node scripts/assinafy-webhook.mjs <comando>
 *
 * Comandos:
 *   events            lista os tipos de evento disponíveis
 *   list              lista os endpoints já cadastrados
 *   create <url>      cria o endpoint com assinatura ligada e mostra o segredo
 *   secret <id>       mostra o segredo de assinatura de um endpoint
 */

const BASE = process.env.ASSINAFY_BASE_URL || 'https://api.assinafy.com.br/v1'
const KEY = process.env.ASSINAFY_API_KEY
const ACCOUNT = process.env.ASSINAFY_ACCOUNT_ID
const CONTACT = process.env.ASSINAFY_CONTACT_EMAIL || ''

/** Eventos que interessam ao CLM. Ajuste após ver `events`. */
const DEFAULT_EVENTS = ['document_ready']

if (!KEY || !ACCOUNT) {
  console.error('Defina ASSINAFY_API_KEY e ASSINAFY_ACCOUNT_ID no ambiente.')
  process.exit(1)
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-Api-Key': KEY,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status}`, typeof data === 'string' ? data.slice(0, 400) : JSON.stringify(data, null, 2))
    process.exit(1)
  }
  return data?.data ?? data
}

const [cmd, arg] = process.argv.slice(2)

switch (cmd) {
  case 'events': {
    const out = await call('GET', '/webhooks/event-types')
    for (const e of out ?? []) console.log(`${String(e.id).padEnd(28)} ${e.description ?? ''}`)
    break
  }

  case 'list': {
    const out = await call('GET', `/accounts/${ACCOUNT}/webhooks/endpoints`)
    if (!out?.length) {
      console.log('Nenhum endpoint cadastrado.')
      break
    }
    for (const e of out) {
      console.log(`${e.id}  ${e.is_active === false ? '[inativo]' : '[ativo]  '}  ${e.url}`)
      console.log(`   eventos: ${(e.events ?? []).join(', ')}`)
      console.log(`   assinatura: ${e.signing_enabled ? 'ligada' : 'DESLIGADA'}`)
    }
    break
  }

  case 'create': {
    if (!arg) {
      console.error('Informe a URL. Ela sai do deploy das funções.')
      process.exit(1)
    }
    if (!CONTACT) {
      console.error('Defina ASSINAFY_CONTACT_EMAIL: o Assinafy exige um e-mail para avisar de falhas de entrega.')
      process.exit(1)
    }
    const out = await call('POST', `/accounts/${ACCOUNT}/webhooks/endpoints`, {
      url: arg,
      email: CONTACT,
      events: DEFAULT_EVENTS,
      name: 'CLM',
      is_active: true,
      // Sem isto o Assinafy não assina as entregas e a função recusa tudo.
      signing_enabled: true,
    })
    console.log('Endpoint criado.')
    console.log('id    :', out?.id)
    console.log('url   :', out?.url)
    if (out?.secret) {
      console.log('\nSegredo de assinatura (guarde agora, pode não aparecer de novo):')
      console.log(out.secret)
      console.log('\nCadastre no Firebase com:')
      console.log('  firebase functions:secrets:set ASSINAFY_WEBHOOK_SECRET')
    } else {
      console.log('\nO segredo não veio na resposta. Busque com:')
      console.log(`  node scripts/assinafy-webhook.mjs secret ${out?.id}`)
    }
    break
  }

  case 'secret': {
    if (!arg) {
      console.error('Informe o id do endpoint (veja em `list`).')
      process.exit(1)
    }
    const out = await call('GET', `/accounts/${ACCOUNT}/webhooks/endpoints/${arg}/secret`)
    console.log(out?.secret ?? JSON.stringify(out))
    break
  }

  default:
    console.log('Comandos: events | list | create <url> | secret <id>')
}
