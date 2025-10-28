/**
 * Find Best Stock Panel Width
 * Determines which stock panel size best fits a given section length
 */

import { calculateStockPanelFit } from './stockPanelFit';

/**
 * Get available stock panel widths based on panel height and glass type
 * For semi-frameless: opening = panel width - 20mm (panel shuffles 10mm into each post)
 * Example: 800mm panel → 780mm opening between posts (800 - 10 - 10)
 */
function getStockPanelWidthsForConfig(panelHeight: number, glassType: string): number[] {
  // 1800mm high stock panels in obscure glass: 500-1150mm panels in 50mm increments
  if (panelHeight === 1800) {
    const widths: number[] = [];
    for (let panelWidth = 500; panelWidth <= 1150; panelWidth += 50) {
      widths.push(panelWidth); // Stock panel widths
    }
    return widths;
  }
  
  // 1000mm high: 300-1400mm panels in 50mm increments
  if (panelHeight === 1000) {
    const widths: number[] = [];
    for (let panelWidth = 300; panelWidth <= 1400; panelWidth += 50) {
      widths.push(panelWidth); // Stock panel widths
    }
    return widths;
  }
  
  // Default fallback: 500-1500mm panels in 50mm increments
  const widths: number[] = [];
  for (let panelWidth = 500; panelWidth <= 1500; panelWidth += 50) {
    widths.push(panelWidth);
  }
  return widths;
}

interface FindBestStockPanelWidthOptions {
  sectionLengthMm: number;
  panelHeight: number;
  glassType: string;
  minGapMm?: number;
  maxGapMm?: number;
  postWidthMm?: number;
  shufflePerSideMm?: number;
}

interface BestStockPanelResult {
  stockPanelWidth: number;
  canFit: boolean;
  panelCount?: number;
  averageGap?: number;
}

/**
 * Find the best stock panel width that fits the section length
 * Returns the stock panel width that provides the best fit with acceptable gaps
 */
export function findBestStockPanelWidth(
  options: FindBestStockPanelWidthOptions
): BestStockPanelResult {
  const {
    sectionLengthMm,
    panelHeight,
    glassType,
    minGapMm = 6,
    maxGapMm = 100,
    postWidthMm = 50,
    shufflePerSideMm = 10,
  } = options;

  const availableStockWidths = getStockPanelWidthsForConfig(panelHeight, glassType);

  let bestResult: BestStockPanelResult = {
    stockPanelWidth: availableStockWidths[0] || 520, // Default to first available
    canFit: false,
  };

  let bestScore = Infinity;

  // Try each stock panel width
  for (const stockPanelWidth of availableStockWidths) {
    const fitResult = calculateStockPanelFit({
      sectionLengthMm,
      stockPanelWidthMm: stockPanelWidth,
      minGapMm,
      maxGapMm,
      postWidthMm,
      shufflePerSideMm,
    });

    if (fitResult.canFitStock) {
      // Calculate a score (prefer gaps closer to ideal 50mm)
      const wallPostVisible = postWidthMm - shufflePerSideMm;
      const availableSpace = sectionLengthMm - 2 * wallPostVisible;
      const stockOpeningWidth = stockPanelWidth - 2 * shufflePerSideMm;

      // Find panel count that fits
      for (let panelCount = 1; panelCount <= 20; panelCount++) {
        const totalPanelOpenings = stockOpeningWidth * panelCount;
        const corePostCount = panelCount - 1;
        const totalCorePostSpace = corePostCount * postWidthMm;
        const totalUsedSpace = totalPanelOpenings + totalCorePostSpace;
        const remainingForGaps = availableSpace - totalUsedSpace;
        const gapCount = panelCount + 1;
        const averageGap = remainingForGaps / gapCount;

        if (averageGap >= minGapMm && averageGap <= maxGapMm) {
          // Score based on deviation from ideal 50mm gap
          const idealGap = 50;
          const score = Math.abs(averageGap - idealGap);

          if (score < bestScore) {
            bestScore = score;
            bestResult = {
              stockPanelWidth,
              canFit: true,
              panelCount,
              averageGap,
            };
          }
        }
      }
    }
  }

  return bestResult;
}

/**
 * Get all available stock panel widths for a given configuration
 */
export function getAvailableStockPanelWidths(panelHeight: number, glassType: string): number[] {
  return getStockPanelWidthsForConfig(panelHeight, glassType);
}
