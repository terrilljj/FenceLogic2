import { Router, type Request, type Response } from 'express';
import type { FenceDesign } from '../../shared/schema.js';
import { packSectionsA4Landscape, type SectionBox } from '../../shared/pdf/layout.js';
import { renderA4LandscapePdf, createPdfDocument, type SectionData } from '../pdf/render.js';

export const pdfRouter = Router();

// Generate PDF for a fence design
pdfRouter.post('/designs/pdf', async (req: Request, res: Response) => {
  try {
    console.log('[PDF] Received PDF generation request');
    const { design, sections } = req.body as { design: FenceDesign; sections: SectionData[] };

    if (!design || !sections || sections.length === 0) {
      console.log('[PDF] Missing design or sections data');
      return res.status(400).json({ error: 'Missing design or sections data' });
    }
    
    console.log('[PDF] Design:', design.name, 'Sections:', sections.length);

    // Convert sections to SectionBox format (assume images are ~800x400px at 96dpi)
    const sectionBoxes: SectionBox[] = sections.map((section, index) => ({
      id: section.id || `section-${index}`,
      intrinsicW: 600,  // points (800px * 72/96)
      intrinsicH: 300,  // points (400px * 72/96)
    }));

    // Pack sections using layout algorithm
    const packResult = packSectionsA4Landscape(sectionBoxes, {
      marginPt: 18,
      gutterPt: 12,
      headerPt: 22,
      footerPt: 14,
      minScale: 0.6,
      maxScale: 1.2,
    });

    // Create PDF document
    const doc = createPdfDocument();

    // Set up response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${design.name || 'fence-design'}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Render PDF
    renderA4LandscapePdf(doc, {
      documentTitle: design.name || 'Fence Design',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      jobRef: design.id?.substring(0, 8).toUpperCase(),
      sections,
      packResult,
      opts: {
        drawWatermark: false,
      },
    });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Debug route for testing PDF layout
pdfRouter.get('/debug/pdf/a4-landscape', async (req: Request, res: Response) => {
  try {
    const strategyParam = req.query.strategy as string || 'auto';
    const debug = req.query.debug === '1';
    const minColumn = parseInt(req.query.minColumn as string) || 1;
    const maxColumn = parseInt(req.query.maxColumn as string) || 2;

    // Create sample sections for testing
    const sampleSections: SectionData[] = [
      {
        id: 'section-1',
        title: 'Section A',
        subtitle: 'Glass Pool Fencing',
        imageDataUrl: undefined,  // Would need actual image data
      },
      {
        id: 'section-2',
        title: 'Section B',
        subtitle: 'Glass Pool Fencing',
        imageDataUrl: undefined,
      },
    ];

    const sectionBoxes: SectionBox[] = sampleSections.map(section => ({
      id: section.id,
      intrinsicW: 2200,
      intrinsicH: 900,
    }));

    // Pack sections
    const packResult = packSectionsA4Landscape(sectionBoxes, {
      marginPt: strategyParam === 'two-row-max' ? 16 : 18,
      gutterPt: 12,
      headerPt: strategyParam === 'two-row-max' ? 16 : 22,
      footerPt: strategyParam === 'two-row-max' ? 12 : 14,
      minScale: 0.6,
      maxScale: 1.2,
      strategy: strategyParam === 'auto' ? undefined : strategyParam,
    });

    // Create PDF
    const doc = createPdfDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="debug-fence-layout.pdf"');
    res.setHeader('X-PDF-Strategy', packResult.usedStrategy);

    // Set debug mode if requested
    if (debug) {
      process.env.PDF_LAYOUT_DEBUG = '1';
    }

    doc.pipe(res);

    renderA4LandscapePdf(doc, {
      documentTitle: 'Debug Fence Layout',
      date: new Date().toLocaleDateString(),
      jobRef: 'DEBUG',
      sections: sampleSections,
      packResult,
      opts: {
        drawWatermark: true,
      },
    });

    doc.end();

    // Reset debug mode
    if (debug) {
      delete process.env.PDF_LAYOUT_DEBUG;
    }
  } catch (error) {
    console.error('Debug PDF error:', error);
    res.status(500).json({ error: 'Failed to generate debug PDF' });
  }
});
