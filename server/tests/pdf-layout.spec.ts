import { describe, it, expect } from 'vitest';
import { packSectionsA4Landscape, type SectionBox } from '../../shared/pdf/layout';

describe('PDF Layout - Pack Sections A4 Landscape', () => {
  const A4_LANDSCAPE = { w: 842, h: 595 };
  
  it('should pack single column with sections fitting content width', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-2', intrinsicW: 2200, intrinsicH: 900 },
    ];

    const result = packSectionsA4Landscape(sections, {
      marginPt: 18,
      gutterPt: 12,
      headerPt: 22,
      footerPt: 14,
      minScale: 0.6,
      maxScale: 1.2,
    });

    const contentRect = {
      x: 18,
      y: 18 + 22,
      w: 842 - 2 * 18,
      h: 595 - 2 * 18 - 22 - 14,
    };

    expect(result.contentRect).toEqual(contentRect);
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    
    // Check that placements don't exceed content rect
    result.pages.forEach(page => {
      page.placements.forEach(placement => {
        expect(placement.x).toBeGreaterThanOrEqual(contentRect.x);
        expect(placement.y).toBeGreaterThanOrEqual(contentRect.y);
        expect(placement.x + placement.w).toBeLessThanOrEqual(contentRect.x + contentRect.w + 1); // +1 for rounding
        expect(placement.y + placement.h).toBeLessThanOrEqual(contentRect.y + contentRect.h + 1);
      });
    });
  });

  it('should choose two-column when sections fit better', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 400, intrinsicH: 200 },
      { id: 'section-2', intrinsicW: 400, intrinsicH: 200 },
      { id: 'section-3', intrinsicW: 400, intrinsicH: 200 },
      { id: 'section-4', intrinsicW: 400, intrinsicH: 200 },
    ];

    const result = packSectionsA4Landscape(sections);

    // With small sections, should be able to fit on one page
    expect(result.pages.length).toBe(1);
    expect(result.usedStrategy).toBeTruthy();
  });

  it('should paginate when sections exceed page height', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-2', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-3', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-4', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-5', intrinsicW: 2200, intrinsicH: 900 },
    ];

    const result = packSectionsA4Landscape(sections, {
      marginPt: 18,
      gutterPt: 12,
      headerPt: 22,
      footerPt: 14,
      minScale: 0.6,
      maxScale: 1.2,
    });

    // With 5 tall sections, should need multiple pages
    expect(result.pages.length).toBeGreaterThan(1);
    
    // All sections should be placed
    const totalPlacements = result.pages.reduce((sum, page) => sum + page.placements.length, 0);
    expect(totalPlacements).toBe(sections.length);
  });

  it('should respect minScale when sections are too large', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 5000, intrinsicH: 3000 },
    ];

    const minScale = 0.6;
    const result = packSectionsA4Landscape(sections, {
      marginPt: 18,
      gutterPt: 12,
      headerPt: 22,
      footerPt: 14,
      minScale,
      maxScale: 1.2,
    });

    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    expect(result.pages[0].scale).toBeGreaterThanOrEqual(minScale - 0.01); // Allow small floating point error
  });

  it('should respect maxScale when sections are small', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 100, intrinsicH: 50 },
    ];

    const maxScale = 1.2;
    const result = packSectionsA4Landscape(sections, {
      marginPt: 18,
      gutterPt: 12,
      headerPt: 22,
      footerPt: 14,
      minScale: 0.6,
      maxScale,
    });

    expect(result.pages.length).toBe(1);
    expect(result.pages[0].scale).toBeLessThanOrEqual(maxScale + 0.01); // Allow small floating point error
  });

  it('should handle mixed tall and wide sections', () => {
    const sections: SectionBox[] = [
      { id: 'tall', intrinsicW: 500, intrinsicH: 1000 },
      { id: 'wide', intrinsicW: 2000, intrinsicH: 300 },
      { id: 'square', intrinsicW: 800, intrinsicH: 800 },
    ];

    const result = packSectionsA4Landscape(sections);

    // Should successfully place all sections
    const totalPlacements = result.pages.reduce((sum, page) => sum + page.placements.length, 0);
    expect(totalPlacements).toBe(sections.length);

    // Check all placements are within bounds
    const contentRect = result.contentRect;
    result.pages.forEach(page => {
      page.placements.forEach(placement => {
        expect(placement.x).toBeGreaterThanOrEqual(contentRect.x);
        expect(placement.y).toBeGreaterThanOrEqual(contentRect.y);
        expect(placement.x + placement.w).toBeLessThanOrEqual(contentRect.x + contentRect.w + 1);
        expect(placement.y + placement.h).toBeLessThanOrEqual(contentRect.y + contentRect.h + 1);
      });
    });
  });

  it('should produce consistent results for the same input', () => {
    const sections: SectionBox[] = [
      { id: 'section-1', intrinsicW: 2200, intrinsicH: 900 },
      { id: 'section-2', intrinsicW: 2200, intrinsicH: 900 },
    ];

    const result1 = packSectionsA4Landscape(sections);
    const result2 = packSectionsA4Landscape(sections);

    expect(result1.usedStrategy).toBe(result2.usedStrategy);
    expect(result1.pages.length).toBe(result2.pages.length);
    expect(result1.pages[0].placements).toEqual(result2.pages[0].placements);
  });
});
