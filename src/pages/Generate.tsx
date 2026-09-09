import { ChevronDown, FileText, Search, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { Checkbox, Field, useToast } from '../components/ui'
import { buildContext, computeWorkflow, effectiveTerms, renderDocument } from '../lib/engine'
import { addMonths, cx, evalCondition, fmtCurrency, fmtDate, fmtDateTime, fromInputDate, normalize, toInputDate } from '../lib/utils'
import { useStore } from '../store'
import type { FormData, FormField, FormValue, Template } from '../types'

function defaults(t: Template): FormData {
  const d: FormData = {}
  for (const f of t.fields) if (f.default !== undefined) d[f.id] = f.default
  d.startDate = new Date(Date.now() + 7 * 86400000).toISOString()
  return d
}

export default function Generate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const templates = useStore((s) => s.templates)
  const parties = useStore((s) => s.parties)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const users = useStore((s) => s.users)
  const currentUserId = useStore((s) => s.currentUserId)
  const createDocument = useStore((s) => s.createDocument)
  const draft = useStore((s) => s.draft)
  const setDraft = useStore((s) => s.setDraft)
  const { toast, node } = useToast()

  const urlTemplate = params.get('template')
  const urlFile = params.get('file')

  const [step, setStep] = useState<1 | 2 | 3>(urlTemplate ? 2 : 1)
  const [templateId, setTemplateId] = useState<string>(urlTemplate ?? '')
  const [data, setData] = useState<FormData>(() => {
    const t = templates.find((x) => x.id === urlTemplate)
    const base = t ? defaults(t) : {}
    return urlFile ? { ...base, attachments: [urlFile] } : base
  })
  const [q, setQ] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [restoreOffer, setRestoreOffer] = useState(Boolean(draft && draft.templateId === (urlTemplate ?? draft?.templateId)))

  const template = templates.find((t) => t.id === templateId)

  useEffect(() => {
    if (!template || step !== 2 || !touched) return
    const id = setTimeout(() => {
      setDraft({ templateId: template.id, data, savedAt: new Date().toISOString(), step })
      setSavedAt(new Date().toISOString())
    }, 900)
    return () => clearTimeout(id)
  }, [data, template, step, touched, setDraft])

  const set = (id: string, v: FormValue) => {
    setTouched(true)
    setData((d) => ({ ...d, [id]: v }))
  }

  const visibleFields = useMemo(() => {
    if (!template) return []
    return template.fields.filter((f) => {
      const sec = template.sections.find((s) => s.id === f.sectionId)
      return evalCondition(sec?.showIf, data) && evalCondition(f.showIf, data)
    })
  }, [template, data])

  const missing = visibleFields.filter((f) => f.required && (data[f.id] === undefined || data[f.id] === null || data[f.id] === '' || (Array.isArray(data[f.id]) && (data[f.id] as string[]).length === 0)))

  const party = useMemo(() => {
    if (!template) return undefined
    if (String(data.clientType ?? '').includes('Existente')) return parties.find((p) => p.id === data.existingParty)
    if (!data.name) return undefined
    return { id: 'new', name: String(data.name), type: 'Cliente' as const, cnpj: String(data.cnpj ?? ''), address: String(data.address ?? ''), city: String(data.city ?? ''), state: String(data.state ?? ''), zip: String(data.zip ?? ''), contactId: '', createdAt: '' }
  }, [template, data, parties])

  const workflowPreview = useMemo(() => (template ? computeWorkflow(template, data, currentUserId) : []), [template, data, currentUserId])
  const blocks = useMemo(
    () => (template ? renderDocument({ template, data, party, company, clauses, owner: users.find((u) => u.id === currentUserId), createdAt: new Date().toISOString() }) : []),
    [template, data, party, company, clauses, users, currentUserId],
  )

  const filteredTemplates = templates.filter((t) => normalize(t.name).includes(normalize(q)))
  const terms = template ? effectiveTerms(template, data) : { termMonths: 0, paymentNet: 0, terminationNotice: 0 }

  const save = () => {
    if (!template) return
    try {
      const id = createDocument({ templateId: template.id, data })
      navigate(`/clm/documentos/${id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  const headerTitle = step === 1 ? 'Gerando documento: Contrato Comercial' : step === 2 ? `Construindo: ${template?.name ?? ''}` : `Visualização: ${template?.name ?? ''}`

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      {node}
      <header className="h-14 border-b border-line flex items-center px-4 gap-4 shrink-0">
        <Logo />
        <span className="text-sm text-gray-700">{headerTitle}</span>
        {step === 2 && savedAt && <span className="text-sm text-gray-500">Salvo automaticamente em {fmtDateTime(savedAt).replace(' ', ' às ')}</span>}
        <button className="ml-auto p-2 rounded hover:bg-gray-100" onClick={() => navigate('/clm')} aria-label="Sair">
          <X size={20} />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-[300px] border-r border-line bg-surface flex flex-col shrink-0">
          <div className="p-6 flex-1 overflow-y-auto">
            <h1 className="text-3xl font-medium leading-tight">
              {step === 1 && '1. Escolher um modelo'}
              {step === 2 && '2. Preencher formulário'}
              {step === 3 && '3. Visualizar e salvar'}
            </h1>
            <p className="text-sm text-gray-700 mt-4 leading-relaxed">
              {step === 1 && 'Selecione um modelo de documento a ser usado. Você usará o documento para preencher algumas informações e gerar seu documento.'}
              {step === 2 && 'Leia o formulário nesta página e preencha todos os campos obrigatórios para preparar o seu documento. Salvaremos suas alterações à medida que você as preencher.'}
              {step === 3 && 'Analise o seu formulário. Se precisar ajustar alguma coisa, clique em "Voltar" abaixo para retornar ao formulário. Se estiver tudo pronto, clique em "Salvar".'}
            </p>
            {step === 2 && <p className="text-sm text-gray-700 mt-4">Ao concluir, selecione Avançar para visualizar o documento.</p>}

            {step === 1 && (
              <div className="mt-8">
                <h2 className="text-xl font-medium mb-3">Pesquisar e filtrar</h2>
                <label className="label">Pesquisar</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="input pl-9" placeholder="Pesquisar modelos..." value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
            )}

            {step >= 2 && workflowPreview.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">Fluxo previsto</h2>
                <ol className="space-y-2 text-sm">
                  {workflowPreview.map((w, i) => (
                    <li key={w.id} className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-white border border-gray-400 text-[11px] flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div>
                        <div className={cx(w.note && 'font-medium')}>{w.name}</div>
                        {w.note && <div className="text-xs text-gray-600">{w.note}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-line bg-surface flex gap-3">
            {step === 1 && (
              <button className="btn-primary w-full" disabled={!templateId} onClick={() => { setStep(2); setData(defaults(template!)) }}>Aplicar</button>
            )}
            {step === 2 && (
              <>
                <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Voltar</button>
                <button className="btn-primary flex-1" disabled={missing.length > 0} title={missing.length ? `Preencha: ${missing.map((m) => m.label).join(', ')}` : ''} onClick={() => setStep(3)}>Próximo</button>
              </>
            )}
            {step === 3 && (
              <>
                <button className="btn-secondary flex-1" onClick={() => setStep(2)}>Voltar</button>
                <button className="btn-primary flex-1" onClick={save}>Salvar</button>
              </>
            )}
          </div>
        </aside>

        <div className={cx('flex-1 overflow-y-auto', step === 3 && 'bg-gray-600')}>
          {restoreOffer && draft && step === 2 && (
            <div className="m-6 mb-0 border border-amber-300 bg-amber-50 rounded p-3 text-sm flex items-center gap-3">
              <span>Encontramos um rascunho salvo em {fmtDateTime(draft.savedAt)}.</span>
              <button className="btn-secondary py-1" onClick={() => { setTemplateId(draft.templateId); setData(draft.data); setRestoreOffer(false) }}>Restaurar</button>
              <button className="btn-ghost py-1" onClick={() => { setDraft(null); setRestoreOffer(false) }}>Descartar</button>
            </div>
          )}

          {step === 1 && (
            <div className="p-8">
              <h2 className="text-2xl font-medium">Modelos <span className="text-sm text-gray-500 font-normal ml-2">{filteredTemplates.length} itens</span></h2>
              <table className="w-full mt-6">
                <thead><tr className="border-b border-line"><th className="th">Nome</th><th className="th">Tipo</th><th className="th">Campos</th></tr></thead>
                <tbody>
                  {filteredTemplates.map((t) => (
                    <tr
                      key={t.id}
                      className={cx('border-b border-line cursor-pointer hover:bg-gray-50', templateId === t.id && 'ring-2 ring-inset ring-primary bg-white')}
                      onClick={() => setTemplateId(t.id)}
                      onDoubleClick={() => { setTemplateId(t.id); setData(defaults(t)); setStep(2) }}
                    >
                      <td className="td text-brand underline decoration-transparent hover:decoration-brand">{t.isUpload ? <span className="inline-flex items-center gap-2"><Upload size={16} />{t.name}</span> : <span className="inline-flex items-center gap-2"><FileText size={16} />{t.name}</span>}</td>
                      <td className="td text-gray-700">{t.type}</td>
                      <td className="td text-gray-700">{t.fields.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step === 2 && template && (
            <div className="p-8 max-w-4xl">
              {template.sections.map((sec) => {
                if (!evalCondition(sec.showIf, data)) return null
                const fields = template.fields.filter((f) => f.sectionId === sec.id && evalCondition(f.showIf, data))
                if (fields.length === 0) return null
                return (
                  <section key={sec.id} className={cx('mb-8', sec.indent && 'ml-6')}>
                    <h2 className={cx('font-medium border-b border-line pb-2 mb-4', sec.indent ? 'text-lg' : 'text-xl')}>{sec.title}</h2>
                    {sec.description && <p className="text-sm text-gray-700 mb-4">{sec.description}</p>}
                    {fields.map((f) => (
                      <FieldControl key={f.id} field={f} value={data[f.id]} onChange={(v) => set(f.id, v)} data={data} />
                    ))}
                  </section>
                )
              })}
              {missing.length > 0 && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-6">
                  Campos obrigatórios pendentes: {missing.map((m) => m.label).join(', ')}
                </div>
              )}
            </div>
          )}

          {step === 3 && template && (
            <div className="py-8 px-6">
              <div className="doc-paper bg-white shadow-2xl mx-auto max-w-[860px] px-16 py-14 min-h-[1000px]">
                <div className="logo">{company.name}</div>
                {blocks.map((b, i) => {
                  if (b.kind === 'title') return <h1 key={i}>{b.text}</h1>
                  if (b.kind === 'h2') return <h2 key={i}>{b.text}</h2>
                  if (b.kind === 'clause') return <p key={i}><b>{b.title}</b> {b.text}</p>
                  if (b.kind === 'signature') {
                    const [a, c] = b.text.split('||')
                    return (
                      <div key={i} className="sig">
                        <div><b>{a}</b><br />Representante legal</div>
                        <div><b>{c}</b><br />Representante legal</div>
                      </div>
                    )
                  }
                  return <p key={i}>{b.text}</p>
                })}
              </div>
              <div className="max-w-[860px] mx-auto mt-6 bg-white rounded p-5 text-sm">
                <h3 className="font-medium mb-3">Resumo do que será criado</h3>
                <dl className="grid grid-cols-2 gap-y-2">
                  <dt className="text-gray-500">Parte</dt><dd>{party?.name ?? '—'}</dd>
                  <dt className="text-gray-500">Valor</dt><dd>{fmtCurrency(Number(data.value ?? 0))}</dd>
                  <dt className="text-gray-500">Vigência</dt><dd>{fmtDate(String(data.startDate ?? ''))} a {data.startDate ? fmtDate(addMonths(String(data.startDate), terms.termMonths)) : '—'} ({terms.termMonths} meses)</dd>
                  <dt className="text-gray-500">Etapas do fluxo</dt><dd>{workflowPreview.map((w) => w.name).join(' → ')}</dd>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldControl({ field, value, onChange, data }: { field: FormField; value: FormValue | undefined; onChange: (v: FormValue) => void; data: FormData }) {
  const parties = useStore((s) => s.parties)
  const clauses = useStore((s) => s.clauses)
  const company = useStore((s) => s.company)
  const warn = field.warnIf && evalCondition(field.warnIf.when, data) ? field.warnIf.text : null
  const hint = (
    <>
      {field.hint && <div>{field.hint}</div>}
      {warn && <div className="text-amber-700 font-medium mt-1">⚠ {warn}</div>}
    </>
  )

  switch (field.type) {
    case 'radio':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <div className="flex gap-16 mt-1">
            {field.options?.map((o) => (
              <label key={o} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={field.id} className="h-4 w-4 accent-primary" checked={value === o} onChange={() => onChange(o)} />
                {o}
              </label>
            ))}
          </div>
        </Field>
      )
    case 'select':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <div className="relative max-w-xs">
            <select className="input appearance-none pr-8" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
              <option value="" disabled>Selecione</option>
              {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" />
          </div>
        </Field>
      )
    case 'party':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <div className="relative max-w-md">
            <select className="input appearance-none pr-8" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
              <option value="">Selecione uma parte</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.type} ({p.city}/{p.state})</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" />
          </div>
          {value && (() => {
            const p = parties.find((x) => x.id === value)
            return p ? <div className="text-xs text-gray-600 mt-2">CNPJ {p.cnpj} · {p.address}, {p.city}/{p.state}, {p.zip}</div> : null
          })()}
        </Field>
      )
    case 'checkbox':
      return (
        <div className="mb-5">
          <Checkbox checked={Boolean(value)} onChange={onChange} label={field.label} />
          {(field.hint || warn) && <div className="text-xs text-gray-600 mt-1.5 ml-6">{hint}</div>}
        </div>
      )
    case 'checkbox-group': {
      const arr = Array.isArray(value) ? value : []
      return (
        <div className="mb-5">
          <div className="label">{field.label}</div>
          <div className="space-y-2">
            {field.options?.map((o) => (
              <div key={o}>
                <Checkbox checked={arr.includes(o)} onChange={(v) => onChange(v ? [...arr, o] : arr.filter((x) => x !== o))} label={o} />
              </div>
            ))}
          </div>
          {(field.hint || warn) && <div className="text-xs text-gray-600 mt-1.5">{hint}</div>}
        </div>
      )
    }
    case 'clauses': {
      const arr = Array.isArray(value) ? value : []
      const available = clauses.filter((c) => c.approved)
      return (
        <div className="mb-5 ml-6 border-l-2 border-line pl-4">
          <div className="label">{field.label}</div>
          <p className="text-xs text-gray-600 mb-2">Somente cláusulas pré-aprovadas pelo Jurídico. Incluir cláusulas adicionais aciona a revisão jurídica.</p>
          <div className="space-y-2">
            {available.map((c) => (
              <div key={c.id} className="border border-line rounded p-2.5">
                <Checkbox checked={arr.includes(c.id)} onChange={(v) => onChange(v ? [...arr, c.id] : arr.filter((x) => x !== c.id))} label={<span className="font-medium">{c.title}</span>} />
                <p className="text-xs text-gray-600 mt-1 ml-6 line-clamp-2">{c.body.replace(/\{\{company\.name\}\}/g, company.name)}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'file': {
      const files = Array.isArray(value) ? value : []
      return (
        <div className="mb-5">
          <div className="label">{field.label}{field.required && <span className="text-red-600 ml-0.5">*</span>}</div>
          <label className="border border-dashed border-gray-400 rounded flex items-center justify-center gap-3 py-8 text-sm cursor-pointer hover:bg-gray-50">
            <span className="text-gray-700">Arraste e solte aqui</span>
            <span className="btn-secondary py-1.5">Selecionar arquivo <ChevronDown size={14} /></span>
            <input type="file" multiple className="hidden" onChange={(e) => onChange([...files, ...Array.from(e.target.files ?? []).map((f) => f.name)])} />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2">
                  <FileText size={14} className="text-primary" /> {f}
                  <button className="text-gray-500 hover:text-red-600" onClick={() => onChange(files.filter((x) => x !== f))} aria-label="Remover"><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    case 'date':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <input type="date" className="input max-w-xs" value={toInputDate(value ? String(value) : '')} onChange={(e) => onChange(fromInputDate(e.target.value))} />
        </Field>
      )
    case 'currency':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <input className="input max-w-xs" type="number" step="0.01" placeholder={field.placeholder ?? '0.00'} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
      )
    case 'number':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <input className="input max-w-xs" type="number" value={String(value ?? '')} onChange={(e) => onChange(Number(e.target.value))} />
        </Field>
      )
    case 'textarea':
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <textarea className="input max-w-2xl" rows={3} placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </Field>
      )
    default:
      return (
        <Field label={field.label} required={field.required} hint={field.hint || warn ? hint : undefined} help={field.helpText}>
          <input className="input max-w-sm" placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </Field>
      )
  }
}

export { buildContext }
