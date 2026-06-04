import { Router, type Request, type Response } from 'express';
import type { FenceDesign } from '../../shared/schema.js';
import { createPdfDocument, renderQuotePdf } from '../pdf/render.js';
import { calculateComponents, stripSkus } from '../services/bom-calculator.js';
import { loadDesignSlots } from '../services/slot-loader.js';
import { storage } from '../storage.js';

export const pdfRouter = Router();

// Generate server-side PDF quote for a fence design
pdfRouter.post('/designs/pdf', async (req: Request, res: Response) => {
  try {
    const { design } = req.body as { design: FenceDesign };

    if (!design || !design.spans || design.spans.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid design data' });
    }

    // Compute BOM server-side — load slot mappings + products exactly as
    // POST /api/quote does, so the PDF BOM matches the on-screen BOM.
    // Without these, every slot lookup misses and the PDF falls back to
    // generic descriptions that diverge from the quote.
    const [{ slotData, slotsByVariant }, products] = await Promise.all([
      loadDesignSlots(design),
      storage.getAllProducts(),
    ]);

    const productData = products.map(p => ({
      id: p.id,
      code: p.code,
      description: p.description,
      price: p.price,
    }));

    const components = calculateComponents(design, slotData, productData, slotsByVariant);
    const bom = stripSkus(components);

    // Build PDF
    const doc = createPdfDocument();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(design.name || 'fence-design').replace(/[^a-zA-Z0-9 _-]/g, '')}.pdf"`
    );

    doc.pipe(res);
    renderQuotePdf(doc, design, bom);
    doc.end();
  } catch (error) {
    console.error('[PDF] generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});
