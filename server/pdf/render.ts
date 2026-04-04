import PDFDocument from 'pdfkit';
import type { FenceDesign, Component } from '../../shared/schema.js';

const MARGIN = 40;
const PAGE_W = 595.28; // A4 portrait width in points
const PAGE_H = 841.89; // A4 portrait height in points
const CONTENT_W = PAGE_W - 2 * MARGIN;

type BomLine = { qty: number; description: string };

export function createPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
    info: { Title: 'Barrier Hub Quote', Creator: 'Barrier Hub by Barrier Dynamics' },
  });
}

export function renderQuotePdf(
  doc: PDFKit.PDFDocument,
  design: FenceDesign,
  bom: BomLine[]
): void {
  const date = new Date().toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // --- Header / branding ---
  doc.fontSize(18).fillColor('#1a1a1a')
    .text('Barrier Hub', MARGIN, MARGIN, { width: CONTENT_W, align: 'left' });

  doc.fontSize(9).fillColor('#666')
    .text('by Barrier Dynamics', MARGIN, doc.y, { width: CONTENT_W, align: 'left' });

  doc.moveDown(0.6);

  // Thin rule
  const ruleY = doc.y;
  doc.moveTo(MARGIN, ruleY).lineTo(PAGE_W - MARGIN, ruleY).strokeColor('#ccc').lineWidth(0.5).stroke();
  doc.y = ruleY + 8;

  // --- Design info ---
  doc.fontSize(14).fillColor('#000')
    .text(design.name || 'Untitled Design', MARGIN, doc.y, { width: CONTENT_W });

  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555');

  const metaLines = [
    `Date: ${date}`,
    `Product: ${formatVariant(design.productVariant)}`,
    `Shape: ${formatShape(design.shape)}`,
    `Sections: ${design.spans.length}`,
  ];
  metaLines.forEach(line => doc.text(line, MARGIN, doc.y, { width: CONTENT_W }));

  doc.moveDown(1);

  // --- Section details ---
  doc.fontSize(11).fillColor('#000').text('Section Details', MARGIN, doc.y);
  doc.moveDown(0.4);

  (design.spans as any[]).forEach((span: any, i: number) => {
    checkPageBreak(doc, 50);
    const label = span.spanId || String.fromCharCode(65 + i);
    const lengthM = span.length ? `${(span.length / 1000).toFixed(1)}m` : '—';
    const panels = span.panelLayout?.panels?.length ?? '—';
    doc.fontSize(9).fillColor('#333')
      .text(`Section ${label}:  Length ${lengthM}  •  ${panels} panel${panels !== 1 ? 's' : ''}`, MARGIN + 8, doc.y, { width: CONTENT_W - 8 });
  });

  doc.moveDown(1.2);

  // --- BOM table ---
  doc.fontSize(11).fillColor('#000').text('Bill of Materials', MARGIN, doc.y);
  doc.moveDown(0.4);

  // Table header
  const tableX = MARGIN;
  const qtyColW = 40;
  const descColX = tableX + qtyColW + 8;
  const descColW = CONTENT_W - qtyColW - 8;

  checkPageBreak(doc, 24);
  const headerY = doc.y;
  doc.fontSize(8).fillColor('#888')
    .text('Qty', tableX, headerY, { width: qtyColW, align: 'right' })
    .text('Description', descColX, headerY, { width: descColW, align: 'left' });

  doc.y = headerY + 14;
  doc.moveTo(tableX, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor('#ddd').lineWidth(0.5).stroke();
  doc.y += 4;

  // Table rows
  bom.forEach((item, idx) => {
    checkPageBreak(doc, 18);
    const rowY = doc.y;

    // Alternate row background
    if (idx % 2 === 0) {
      doc.save().rect(tableX, rowY - 1, CONTENT_W, 16).fillColor('#f9f9f9').fill().restore();
    }

    doc.fontSize(9).fillColor('#333')
      .text(String(item.qty), tableX, rowY, { width: qtyColW, align: 'right' })
      .text(item.description, descColX, rowY, { width: descColW, align: 'left' });

    doc.y = rowY + 16;
  });

  // Bottom rule
  doc.moveTo(tableX, doc.y + 2).lineTo(PAGE_W - MARGIN, doc.y + 2).strokeColor('#ddd').lineWidth(0.5).stroke();
  doc.y += 10;

  doc.fontSize(9).fillColor('#666')
    .text(`${bom.length} line items  •  ${bom.reduce((sum, b) => sum + b.qty, 0)} total components`, tableX, doc.y, { width: CONTENT_W });

  // --- Footer on every page ---
  const pageRange = doc.bufferedPageRange();
  for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#999')
      .text(
        `FenceLogic by Barrier Dynamics  •  Page ${i + 1}`,
        MARGIN,
        PAGE_H - MARGIN + 10,
        { width: CONTENT_W, align: 'center' }
      );
  }
}

function checkPageBreak(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE_H - MARGIN - 20) {
    doc.addPage();
  }
}

function formatVariant(v: string): string {
  return v.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatShape(s: string): string {
  const map: Record<string, string> = {
    inline: 'Straight',
    'l-shape': 'L-Shape',
    'u-shape': 'U-Shape',
    enclosed: 'Enclosed',
    custom: 'Custom',
  };
  return map[s] || s;
}
