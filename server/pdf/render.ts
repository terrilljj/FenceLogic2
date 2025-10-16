import PDFDocument from 'pdfkit';
import type { PdfLayoutOptions, PackResult } from '../../shared/pdf/layout.js';

export type SectionData = {
  id: string;
  title: string;
  imageDataUrl?: string;  // base64 encoded image
  subtitle?: string;
};

export type RenderOptions = {
  documentTitle: string;
  date: string;
  jobRef?: string;
  sections: SectionData[];
  packResult: PackResult;
  opts?: PdfLayoutOptions;
};

export function renderA4LandscapePdf(
  doc: PDFKit.PDFDocument,
  options: RenderOptions
): void {
  const { documentTitle, date, jobRef, sections, packResult, opts } = options;
  const { pages, contentRect, usedStrategy } = packResult;

  const sectionMap = new Map(sections.map(s => [s.id, s]));

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    }

    // Draw header
    drawHeader(doc, documentTitle, date, jobRef, pageIndex, pages.length);

    // Draw footer
    drawFooter(doc, pageIndex, pages.length, opts?.drawWatermark);

    // Draw debug guides if enabled
    if (process.env.PDF_LAYOUT_DEBUG === '1') {
      drawDebugGuides(doc, contentRect, page.placements);
    }

    // Draw each section
    page.placements.forEach(placement => {
      const section = sectionMap.get(placement.id);
      if (!section) return;

      // Draw section title
      if (section.title) {
        doc.fontSize(10)
          .fillColor('#000')
          .text(section.title, placement.x, placement.y - 14, {
            width: placement.w,
            align: 'left',
          });
      }

      // Draw section content
      if (section.imageDataUrl) {
        try {
          // Remove data URL prefix if present
          const base64Data = section.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
          const imgBuffer = Buffer.from(base64Data, 'base64');
          
          doc.image(imgBuffer, placement.x, placement.y, {
            width: placement.w,
            height: placement.h,
            fit: [placement.w, placement.h],
          });
        } catch (error) {
          console.error('Error rendering image:', error);
          // Draw placeholder rectangle
          doc.rect(placement.x, placement.y, placement.w, placement.h)
            .stroke('#ddd');
        }
      }

      // Draw scale percentage if debug mode
      if (process.env.PDF_LAYOUT_DEBUG === '1') {
        const scalePercent = Math.round(page.scale * 100);
        doc.fontSize(8)
          .fillColor('#999')
          .text(`${scalePercent}%`, placement.x + 4, placement.y + 4);
      }
    });
  });
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  date: string,
  jobRef: string | undefined,
  pageIndex: number,
  totalPages: number
): void {
  const y = 18;
  
  // Left: document title
  doc.fontSize(10)
    .fillColor('#000')
    .text(title, 18, y, { width: 400, align: 'left' });

  // Right: date and job ref
  const rightText = jobRef ? `${date} • ${jobRef}` : date;
  doc.fontSize(9)
    .fillColor('#666')
    .text(rightText, 18, y, { width: 806, align: 'right' });
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  pageIndex: number,
  totalPages: number,
  drawWatermark?: boolean
): void {
  const y = 595 - 14 - 4;  // page height - footer height - padding

  // Page number (center)
  doc.fontSize(9)
    .fillColor('#999')
    .text(`Page ${pageIndex + 1} of ${totalPages}`, 18, y, {
      width: 806,
      align: 'center',
    });

  // Watermark on right edge if enabled
  if (drawWatermark) {
    doc.save();
    doc.translate(842 - 12, 595 / 2);
    doc.rotate(-90);
    doc.fontSize(10)
      .fillColor('#000', 1)
      .text('FenceLogic By Barrier Dynamics', 0, 0, {
        align: 'center',
      });
    doc.restore();
  } else {
    // Regular footer text
    doc.fontSize(9)
      .fillColor('#000')
      .text('FenceLogic By Barrier Dynamics', 18, y, {
        width: 806,
        align: 'right',
      });
  }
}

function drawDebugGuides(
  doc: PDFKit.PDFDocument,
  contentRect: { x: number; y: number; w: number; h: number },
  placements: Array<{ x: number; y: number; w: number; h: number }>
): void {
  // Draw content rect guide
  doc.save();
  doc.strokeColor('#0000ff', 0.3)
    .lineWidth(0.5)
    .rect(contentRect.x, contentRect.y, contentRect.w, contentRect.h)
    .stroke();

  // Draw placement guides
  placements.forEach(p => {
    doc.strokeColor('#ff0000', 0.3)
      .lineWidth(0.5)
      .rect(p.x, p.y, p.w, p.h)
      .stroke();
  });
  doc.restore();
}

export function createPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: true,
  });
}
