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
  maxPanelWidth?: number;
  minGapMm?: number;
  maxGapMm?: number;
  postWidthMm?: number;
  shufflePerSideMm?: number;
  lengthToleranceMm?: number; // Allow section length adjustment within this tolerance (default ±50mm)
}

interface BestStockPanelResult {
  stockPanelWidth: number;
  canFit: boolean;
  panelCount?: number;
  averageGap?: number;
  adjustedSectionLength?: number; // If section length was adjusted within tolerance
  lengthAdjustment?: number; // How much the section was adjusted (+/- mm)
}

/**
 * Find the best stock panel width that fits the section length
 * Returns the stock panel width that provides the best fit with FIXED 30mm gaps
 */
export function findBestStockPanelWidth(
  options: FindBestStockPanelWidthOptions
): BestStockPanelResult {
  const {
    sectionLengthMm,
    panelHeight,
    glassType,
    maxPanelWidth,
    minGapMm = 6,
    maxGapMm = 100,
    postWidthMm = 50,
    shufflePerSideMm = 10,
    lengthToleranceMm = 50, // Default ±50mm tolerance
  } = options;

  const FIXED_GAP_MM = 30; // Semi-frameless systems use fixed 30mm gaps

  let availableStockWidths = getStockPanelWidthsForConfig(panelHeight, glassType);
  
  // Filter by maxPanelWidth constraint if provided
  if (maxPanelWidth) {
    availableStockWidths = availableStockWidths.filter(width => width <= maxPanelWidth);
  }

  // Default to middle value for better initial fit (966mm is a good default)
  const defaultWidth = availableStockWidths.find(w => w >= 900 && w <= 1000) || 
                       availableStockWidths[Math.floor(availableStockWidths.length / 2)] || 
                       966;

  let bestResult: BestStockPanelResult = {
    stockPanelWidth: defaultWidth,
    canFit: false,
  };

  let bestScore = Infinity;
  const wallPostVisible = postWidthMm - shufflePerSideMm;

  // Try each section length within tolerance range
  for (let lengthOffset = -lengthToleranceMm; lengthOffset <= lengthToleranceMm; lengthOffset++) {
    const testLength = sectionLengthMm + lengthOffset;
    const availableSpace = testLength - 2 * wallPostVisible;

    // Try each stock panel width
    for (const stockPanelWidth of availableStockWidths) {
      const stockOpeningWidth = stockPanelWidth - 2 * shufflePerSideMm;

      // Find panel count that fits with FIXED 30mm gaps
      for (let panelCount = 1; panelCount <= 20; panelCount++) {
        const gapCount = panelCount + 1; // Start + between + end
        const totalGaps = gapCount * FIXED_GAP_MM;
        const corePostCount = panelCount - 1;
        const totalCorePostSpace = corePostCount * postWidthMm;
        const totalPanelOpenings = stockOpeningWidth * panelCount;
        
        // Calculate total used space
        const totalUsed = totalPanelOpenings + totalCorePostSpace + totalGaps;
        const variance = availableSpace - totalUsed;

        // Stock panels fit if variance is within ±2mm (rounding tolerance)
        if (Math.abs(variance) <= 2) {
          // Score based on:
          // 1. Prefer no length adjustment (weight: 1000)
          // 2. Prefer smaller variance (weight: 1)
          const lengthAdjustmentPenalty = Math.abs(lengthOffset) * 1000;
          const variancePenalty = Math.abs(variance);
          const score = lengthAdjustmentPenalty + variancePenalty;

          if (score < bestScore) {
            bestScore = score;
            bestResult = {
              stockPanelWidth,
              canFit: true,
              panelCount,
              averageGap: FIXED_GAP_MM,
              adjustedSectionLength: lengthOffset !== 0 ? testLength : undefined,
              lengthAdjustment: lengthOffset !== 0 ? lengthOffset : undefined,
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
 * Optionally filtered by maxPanelWidth constraint
 */
export function getAvailableStockPanelWidths(panelHeight: number, glassType: string, maxPanelWidth?: number): number[] {
  let widths = getStockPanelWidthsForConfig(panelHeight, glassType);
  
  // Filter by maxPanelWidth constraint if provided
  if (maxPanelWidth) {
    widths = widths.filter(width => width <= maxPanelWidth);
  }
  
  return widths;
}
