import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from './ui'
import { downloadFromAssinafy, requestSignature, uploadToAssinafy, type AssinafySigner } from '../lib/assinafyClient'
import { renderDocument } from '../lib/engine'
import { buildContractPdf } from '../lib/pdf'
import { cx } from '../lib/utils'
import { useCurrentUser, useStore } from '../store'
import type { Document } from '../types'

type Phase = 'form' | 'sending' | 'done'

export function SignatureDialog({ doc, open, onClose, onSent }: { doc: Document; open: boolean; onClose: () => void; onSent: (msg: string) => void }) {
  const templates = useStore((s) => s.templates)
  const parties = useStore((s) => s.parties)
  const contacts = useStore((s) => s.contacts)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const users = useStore((s) => s.users)
  const updateDocument = useStore((s) => s.updateDocument)
  const me = useCurrentUser()

  const party = parties.find((p) => p.id === doc.partyId)

  /** Sugere quem assina: o contato da parte e quem está operando. */
  const suggested = useMemo<AssinafySigner[]>(() => {
    const out: AssinafySigner[] = []
    for (const c of contacts.filter((c) => c.partyId === doc.partyId && c.email)) {
      out.push({ full_name: c.name, email: c.email })
    }
    if (me.email) out.push({ full_name: me.name, email: me.email })
    return out
  }, [contacts, doc.partyId, me])

  const [signers, setSigners] = useState<AssinafySigner[]>(suggested)
  const [message, setMessage] = useState(`Segue para assinatura o contrato ${doc.code} entre ${company.name || 'nós'} e ${party?.name ?? 'a contraparte'}.`)
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState('')

  const valid = signers.length > 0 && signers.every((s) => s.full_name.trim() && /\S+@\S+\.\S+/.test(s.email))

  const send = async () => {
    setPhase('sending')
    setError(null)
    try {
      setStep('Gerando o PDF do contrato...')
      const tpl = templates.find((t) => t.id === doc.templateId)
      if (!tpl) throw new Error('Modelo não encontrado: não há como gerar o PDF.')
      const blocks = renderDocument({ template: tpl, data: doc.formData, party, company, clauses, owner: users.find((u) => u.id === doc.ownerId), createdAt: doc.createdAt })
      const pdf = buildContractPdf(blocks, { companyName: company.name, code: doc.code })

      setStep('Enviando ao Assinafy...')
      const fileName = doc.name.replace(/\.(docx|pdf|txt)$/i, '') + '.pdf'
      const { documentId, status } = await uploadToAssinafy(pdf, fileName)

      setStep('Solicitando as assinaturas...')
      await requestSignature({ documentId, signers, message: message.trim() || undefined })

      updateDocument(doc.id, {
        assinafy: {
          documentId,
          status: status ?? 'pending_signature',
          sentAt: new Date().toISOString(),
          sentById: me.id,
          signers: signers.map((s) => ({ name: s.full_name, email: s.email })),
          updatedAt: new Date().toISOString(),
        },
      })
      setPhase('done')
      onSent(`Enviado para assinatura de ${signers.length} signatário(s).`)
    } catch (e) {
      setPhase('form')
      setError(e instanceof Error ? e.message : 'Falha ao enviar para assinatura.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={phase === 'sending' ? () => {} : onClose}
      title="Enviar para assinatura"
      footer={
        phase === 'done' ? (
          <button className="btn-primary" onClick={onClose}>Concluir</button>
        ) : (
          <>
            <button className="btn-secondary" disabled={phase === 'sending'} onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!valid || phase === 'sending'} onClick={send}>
              {phase === 'sending' ? 'Enviando...' : 'Enviar'}
            </button>
          </>
        )
      }
    >
      {phase === 'done' ? (
        <p className="text-sm">
          O contrato foi enviado. Cada signatário recebe um e-mail do Assinafy. Quando o último assinar, o status aqui muda sozinho, pelo webhook.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-700 mb-5">
            O PDF é gerado agora a partir do modelo e enviado ao Assinafy, que passa a guardar o documento. Aqui fica apenas a referência.
          </p>

          <div className="label">Signatários</div>
          <ul className="space-y-2 mb-3">
            {signers.map((s, i) => (
              <li key={i} className="flex gap-2">
                <input
                  className="input"
                  placeholder="Nome completo"
                  value={s.full_name}
                  onChange={(e) => setSigners((l) => l.map((x, j) => (j === i ? { ...x, full_name: e.target.value } : x)))}
                />
                <input
                  className="input"
                  placeholder="email@empresa.com.br"
                  value={s.email}
                  onChange={(e) => setSigners((l) => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                />
                <button className="p-2 text-gray-500 hover:text-red-600" onClick={() => setSigners((l) => l.filter((_, j) => j !== i))} aria-label="Remover">
                  <X size={16} />
                </button>
              </li>
            ))}
            {signers.length === 0 && <li className="text-sm text-gray-500">Nenhum signatário. Adicione ao menos um.</li>}
          </ul>
          <button className="btn-secondary mb-5" onClick={() => setSigners((l) => [...l, { full_name: '', email: '' }])}>
            <Plus size={14} /> Adicionar signatário
          </button>

          <div className="label">Mensagem do convite</div>
          <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />

          {phase === 'sending' && <div className="text-sm text-gray-700 mt-4">{step}</div>}
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mt-4">{error}</div>}
        </>
      )}
    </Modal>
  )
}

/** Painel do documento já enviado, com situação e download dos artefatos. */
export function AssinafyPanel({ doc }: { doc: Document }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const link = doc.assinafy
  if (!link) return null

  const open = async (artifact: 'original' | 'certificated' | 'pades') => {
    setBusy(artifact)
    setError(null)
    try {
      const blob = await downloadFromAssinafy(link.documentId, artifact)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao baixar.')
    } finally {
      setBusy(null)
    }
  }

  const signed = link.status === 'certificated' || link.event === 'document_ready'
  const rejected = link.event === 'signer_rejected_document' || link.event === 'user_rejected_document'

  return (
    <div className="border border-line rounded p-3 text-sm">
      <div className="font-medium mb-1">Assinatura eletrônica</div>
      <div className={cx('text-xs mb-2', rejected ? 'text-red-700' : signed ? 'text-teal-700' : 'text-gray-600')}>
        {rejected ? 'Recusado' : signed ? 'Assinado por todos' : 'Aguardando assinaturas'}
        {link.status ? ` · ${link.status}` : ''}
      </div>
      {link.signers?.length ? (
        <ul className="text-xs text-gray-600 mb-2">
          {link.signers.map((s) => (
            <li key={s.email}>{s.name} · {s.email}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary py-1 text-xs" disabled={busy !== null} onClick={() => open('original')}>
          {busy === 'original' ? 'Abrindo...' : 'Ver enviado'}
        </button>
        {signed && (
          <>
            <button className="btn-secondary py-1 text-xs" disabled={busy !== null} onClick={() => open('certificated')}>
              {busy === 'certificated' ? 'Abrindo...' : 'Ver assinado'}
            </button>
            <button className="btn-secondary py-1 text-xs" disabled={busy !== null} onClick={() => open('pades')}>
              PAdES
            </button>
          </>
        )}
      </div>
      {error && <div className="text-xs text-red-700 mt-2">{error}</div>}
      <div className="text-[11px] text-gray-500 mt-2">Documento guardado no Assinafy · {link.documentId}</div>
    </div>
  )
}
