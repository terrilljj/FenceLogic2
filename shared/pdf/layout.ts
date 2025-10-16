export type PdfLayoutOptions = {
  pageSize?: 'A4';
  orientation?: 'landscape';
  marginPt?: number;              // default 18
  gutterPt?: number;              // default 12 between sections
  headerPt?: number;              // default 22 (vertical space)
  footerPt?: number;              // default 14 (vertical space)
  minScale?: number;              // default 0.6
  maxScale?: number;              // default 1.2
  targetDpi?: number;             // default 144 when rasterizing canvas
  drawWatermark?: boolean;        // default false
};

export type SectionBox = {
  id: string;
  intrinsicW: number;  // in points
  intrinsicH: number;  // in points
};

export type PagePlacement = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PackResult = {
  pages: Array<{
    scale: number;                 // per-section scale chosen
    placements: PagePlacement[];
  }>;
  pageSize: { w: number; h: number };
  contentRect: { x: number; y: number; w: number; h: number };
  usedStrategy: 'single-column' | 'two-column' | 'row-wrap';
};

const A4_LANDSCAPE = { w: 842, h: 595 };

export function packSectionsA4Landscape(
  sections: SectionBox[],
  opts?: PdfLayoutOptions
): PackResult {
  const {
    marginPt = 18,
    gutterPt = 12,
    headerPt = 22,
    footerPt = 14,
    minScale = 0.6,
    maxScale = 1.2,
  } = opts || {};

  const pageSize = A4_LANDSCAPE;
  
  // Content rectangle (inside margins, header, footer)
  const contentRect = {
    x: marginPt,
    y: marginPt + headerPt,
    w: pageSize.w - 2 * marginPt,
    h: pageSize.h - 2 * marginPt - headerPt - footerPt,
  };

  // Try different strategies and pick the best
  const strategies = [
    () => packSingleColumn(sections, contentRect, gutterPt, minScale, maxScale),
    () => packTwoColumn(sections, contentRect, gutterPt, minScale, maxScale),
    () => packRowWrap(sections, contentRect, gutterPt, minScale, maxScale),
  ];

  let bestResult: PackResult | null = null;
  let bestAvgScale = 0;

  for (const strategy of strategies) {
    const result = strategy();
    const avgScale = calculateAverageScale(result);
    
    if (avgScale > bestAvgScale) {
      bestAvgScale = avgScale;
      bestResult = result;
    }
  }

  return bestResult || {
    pages: [],
    pageSize,
    contentRect,
    usedStrategy: 'single-column',
  };
}

function calculateAverageScale(result: PackResult): number {
  const allScales = result.pages.map(p => p.scale);
  if (allScales.length === 0) return 0;
  return allScales.reduce((sum, s) => sum + s, 0) / allScales.length;
}

function packSingleColumn(
  sections: SectionBox[],
  contentRect: { x: number; y: number; w: number; h: number },
  gutterPt: number,
  minScale: number,
  maxScale: number
): PackResult {
  const pages: PackResult['pages'] = [];
  let currentPage: PackResult['pages'][0] | null = null;
  let currentY = 0;

  for (const section of sections) {
    // Calculate scale to fit width and height
    const scaleToFitWidth = contentRect.w / section.intrinsicW;
    const scaleToFitHeight = contentRect.h / section.intrinsicH;
    
    // Use the smaller of the two scales to ensure it fits both dimensions
    const scaleToFit = Math.min(scaleToFitWidth, scaleToFitHeight);
    const scale = Math.min(Math.max(scaleToFit, minScale), maxScale);
    
    const scaledW = section.intrinsicW * scale;
    const scaledH = section.intrinsicH * scale;

    // Check if it fits on current page
    if (!currentPage || currentY + scaledH > contentRect.h) {
      // Start new page
      currentPage = { scale, placements: [] };
      pages.push(currentPage);
      currentY = 0;
    }

    // Place section
    currentPage.placements.push({
      id: section.id,
      x: contentRect.x,
      y: contentRect.y + currentY,
      w: scaledW,
      h: scaledH,
    });

    currentY += scaledH + gutterPt;
  }

  return {
    pages,
    pageSize: A4_LANDSCAPE,
    contentRect,
    usedStrategy: 'single-column',
  };
}

function packTwoColumn(
  sections: SectionBox[],
  contentRect: { x: number; y: number; w: number; h: number },
  gutterPt: number,
  minScale: number,
  maxScale: number
): PackResult {
  if (sections.length < 2) {
    return packSingleColumn(sections, contentRect, gutterPt, minScale, maxScale);
  }

  const columnWidth = (contentRect.w - gutterPt) / 2;
  const pages: PackResult['pages'] = [];
  let currentPage: PackResult['pages'][0] | null = null;
  let leftY = 0;
  let rightY = 0;
  let useLeftColumn = true;

  for (const section of sections) {
    // Calculate scale to fit column width and height
    const scaleToFitWidth = columnWidth / section.intrinsicW;
    const scaleToFitHeight = contentRect.h / section.intrinsicH;
    const scaleToFit = Math.min(scaleToFitWidth, scaleToFitHeight);
    const scale = Math.min(Math.max(scaleToFit, minScale), maxScale);
    
    const scaledW = section.intrinsicW * scale;
    const scaledH = section.intrinsicH * scale;

    // Determine which column to use (pick shorter one)
    const targetY = useLeftColumn ? leftY : rightY;
    const targetX = useLeftColumn ? contentRect.x : contentRect.x + columnWidth + gutterPt;

    // Check if we need a new page
    if (!currentPage || targetY + scaledH > contentRect.h) {
      if (!currentPage) {
        currentPage = { scale, placements: [] };
        pages.push(currentPage);
      } else {
        // Try other column first
        if (useLeftColumn && rightY + scaledH <= contentRect.h) {
          useLeftColumn = false;
          continue;
        } else if (!useLeftColumn && leftY + scaledH <= contentRect.h) {
          useLeftColumn = true;
          continue;
        } else {
          // Need new page
          currentPage = { scale, placements: [] };
          pages.push(currentPage);
          leftY = 0;
          rightY = 0;
          useLeftColumn = true;
        }
      }
    }

    // Place section
    const finalY = useLeftColumn ? leftY : rightY;
    const finalX = useLeftColumn ? contentRect.x : contentRect.x + columnWidth + gutterPt;

    currentPage!.placements.push({
      id: section.id,
      x: finalX,
      y: contentRect.y + finalY,
      w: scaledW,
      h: scaledH,
    });

    // Update column heights
    if (useLeftColumn) {
      leftY += scaledH + gutterPt;
    } else {
      rightY += scaledH + gutterPt;
    }

    // Alternate columns
    useLeftColumn = leftY <= rightY;
  }

  return {
    pages,
    pageSize: A4_LANDSCAPE,
    contentRect,
    usedStrategy: 'two-column',
  };
}

function packRowWrap(
  sections: SectionBox[],
  contentRect: { x: number; y: number; w: number; h: number },
  gutterPt: number,
  minScale: number,
  maxScale: number
): PackResult {
  const pages: PackResult['pages'] = [];
  let currentPage: PackResult['pages'][0] | null = null;
  let currentY = 0;
  let currentRowMaxHeight = 0;
  let currentX = 0;

  for (const section of sections) {
    // Calculate scale to fit remaining width and height
    const remainingWidth = contentRect.w - currentX;
    const scaleToFitWidth = remainingWidth / section.intrinsicW;
    const scaleToFitHeight = contentRect.h / section.intrinsicH;
    const scaleToFit = Math.min(scaleToFitWidth, scaleToFitHeight);
    const scale = Math.min(Math.max(scaleToFit, minScale), maxScale);
    
    const scaledW = section.intrinsicW * scale;
    const scaledH = section.intrinsicH * scale;

    // Check if we need to wrap to next row
    if (currentX + scaledW > contentRect.w && currentX > 0) {
      // Move to next row
      currentY += currentRowMaxHeight + gutterPt;
      currentX = 0;
      currentRowMaxHeight = 0;
    }

    // Check if we need a new page
    if (!currentPage || currentY + scaledH > contentRect.h) {
      currentPage = { scale, placements: [] };
      pages.push(currentPage);
      currentY = 0;
      currentX = 0;
      currentRowMaxHeight = 0;
    }

    // Place section
    currentPage!.placements.push({
      id: section.id,
      x: contentRect.x + currentX,
      y: contentRect.y + currentY,
      w: scaledW,
      h: scaledH,
    });

    currentX += scaledW + gutterPt;
    currentRowMaxHeight = Math.max(currentRowMaxHeight, scaledH);
  }

  return {
    pages,
    pageSize: A4_LANDSCAPE,
    contentRect,
    usedStrategy: 'row-wrap',
  };
}
