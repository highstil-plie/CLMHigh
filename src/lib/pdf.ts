import { jsPDF } from 'jspdf'
import type { RenderedBlock } from './engine'

/**
 * Monta o PDF do contrato a partir dos blocos já renderizados pelo motor.
 *
 * O Assinafy precisa de um arquivo, e o contrato do CLM não é um: ele é
 * remontado do modelo a cada leitura. É aqui que ele vira documento.
 */

const A4 = { w: 210, h: 297 }
const MARGIN = { top: 22, bottom: 22, left: 22, right: 22 }
const WIDTH = A4.w - MARGIN.left - MARGIN.right

export interface PdfOptions {
  companyName: string
  /** Rodapé com o código do contrato, para rastreio. */
  code?: string
}

export function buildContractPdf(blocks: RenderedBlock[], opts: PdfOptions): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = MARGIN.top

  const room = (needed: number) => {
    if (y + needed <= A4.h - MARGIN.bottom) return
    doc.addPage()
    y = MARGIN.top
  }

  const paragraph = (text: string, opt: { size: number; style: 'normal' | 'bold'; align?: 'justify' | 'center'; gap?: number }) => {
    doc.setFont('helvetica', opt.style)
    doc.setFontSize(opt.size)
    const lineHeight = opt.size * 0.5
    const lines = doc.splitTextToSize(text, WIDTH) as string[]
    for (const line of lines) {
      room(lineHeight)
      if (opt.align === 'center') doc.text(line, A4.w / 2, y, { align: 'center' })
      else doc.text(line, MARGIN.left, y, { maxWidth: WIDTH })
      y += lineHeight
    }
    y += opt.gap ?? 2
  }

  // Cabeçalho com o nome da empresa, no lugar do logotipo da tela.
  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(26, 59, 143)
  doc.text(opts.companyName || ' ', MARGIN.left, y)
  doc.setTextColor(17, 17, 17)
  y += 12

  for (const b of blocks) {
    if (b.kind === 'title') {
      y += 4
      paragraph(b.text.toUpperCase(), { size: 11, style: 'bold', align: 'center', gap: 6 })
      continue
    }
    if (b.kind === 'h2') {
      room(8)
      y += 3
      paragraph(b.text.toUpperCase(), { size: 10, style: 'bold', gap: 2 })
      continue
    }
    if (b.kind === 'clause') {
      paragraph(`${b.title ?? ''} ${b.text}`.trim(), { size: 10, style: 'normal', gap: 3 })
      continue
    }
    if (b.kind === 'signature') {
      const [left, right] = b.text.split('||')
      room(34)
      y += 16
      const colW = (WIDTH - 10) / 2
      doc.setDrawColor(17, 17, 17)
      doc.line(MARGIN.left, y, MARGIN.left + colW, y)
      doc.line(MARGIN.left + colW + 10, y, MARGIN.left + WIDTH, y)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(doc.splitTextToSize(left ?? '', colW) as string[], MARGIN.left, y)
      doc.text(doc.splitTextToSize(right ?? '', colW) as string[], MARGIN.left + colW + 10, y)
      y += 8
      doc.setFont('helvetica', 'normal')
      doc.text('Representante legal', MARGIN.left, y)
      doc.text('Representante legal', MARGIN.left + colW + 10, y)
      y += 6
      continue
    }
    paragraph(b.text, { size: 10, style: 'normal', gap: 3 })
  }

  // Numeração e código em todas as páginas.
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    if (opts.code) doc.text(opts.code, MARGIN.left, A4.h - 12)
    doc.text(`${i} / ${total}`, A4.w - MARGIN.right, A4.h - 12, { align: 'right' })
  }

  return doc.output('blob')
}
