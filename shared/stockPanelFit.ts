/**
 * Stock Panel Fit Calculator
 * Detects when stock panels can't fit a section length and provides solution options
 */

export interface StockPanelFitResult {
  canFitStock: boolean; // Can the section fit using only stock panels?
  suggestedLengthAdjustments?: {
    shorter: number; // Suggested shorter length that fits stock panels
    longer: number; // Suggested longer length that fits stock panels
  };
  customPanelSolution?: {
    customPanelWidth: number; // Width of the custom panel needed
    suggestedPosition: number; // Index position for the custom panel
    stockPanelWidth: number; // Width of stock panels used
    stockPanelCount: number; // Number of stock panels
  };
}

interface StockPanelFitOptions {
  sectionLengthMm: number;
  stockPanelWidthMm: number; // Desired stock panel width (e.g., 966mm, 986mm, etc.)
  minGapMm: number; // Minimum gap between panels
  maxGapMm: number; // Maximum gap between panels
  postWidthMm: number; // Width of posts (for semi-frameless)
  shufflePerSideMm: number; // Shuffle amount per side (10mm for semi-frameless)
}

/**
 * Calculate if stock panels can fit, and provide solution options
 */
export function calculateStockPanelFit(options: StockPanelFitOptions): StockPanelFitResult {
  const {
    sectionLengthMm,
    stockPanelWidthMm,
    minGapMm,
    maxGapMm,
    postWidthMm,
    shufflePerSideMm,
  } = options;

  // For semi-frameless: opening = panel - 2*shuffle
  // Wall posts: 50mm at wall, glass shuffles in 10mm → 40mm wall-to-glass
  // Available space = section length - 2 * (post width - shuffle)
  const wallPostVisible = postWidthMm - shufflePerSideMm; // 50mm - 10mm = 40mm
  const availableSpace = sectionLengthMm - 2 * wallPostVisible;

  // Try to fit stock panels only
  const stockOpeningWidth = stockPanelWidthMm - 2 * shufflePerSideMm;
  
  // Try different panel counts
  for (let panelCount = 1; panelCount <= 20; panelCount++) {
    const totalPanelOpenings = stockOpeningWidth * panelCount;
    const corePostCount = panelCount - 1; // Core posts between panels
    const totalCorePostSpace = corePostCount * postWidthMm; // Core posts are full width
    const totalUsedSpace = totalPanelOpenings + totalCorePostSpace;
    const remainingForGaps = availableSpace - totalUsedSpace;
    const gapCount = panelCount + 1; // Start gap + end gap + (panelCount - 1) between
    const averageGap = remainingForGaps / gapCount;

    if (averageGap >= minGapMm && averageGap <= maxGapMm) {
      // Stock panels fit!
      return {
        canFitStock: true,
      };
    }
  }

  // Stock panels can't fit - calculate solution options
  
  // Option 1: Suggest section length adjustments
  const suggestedLengthAdjustments = calculateLengthAdjustments(options);

  // Option 2: Calculate stock + 1 custom solution
  const customPanelSolution = calculateStockPlusCustomSolution(options, availableSpace);

  return {
    canFitStock: false,
    suggestedLengthAdjustments,
    customPanelSolution,
  };
}

/**
 * Calculate suggested section lengths that would allow all stock panels to fit
 */
function calculateLengthAdjustments(options: StockPanelFitOptions) {
  const {
    stockPanelWidthMm,
    minGapMm,
    maxGapMm,
    postWidthMm,
    shufflePerSideMm,
  } = options;

  const wallPostVisible = postWidthMm - shufflePerSideMm;
  const stockOpeningWidth = stockPanelWidthMm - 2 * shufflePerSideMm;

  let shorterLength = 0;
  let longerLength = 0;

  // Find the closest shorter and longer lengths that work
  for (let panelCount = 1; panelCount <= 20; panelCount++) {
    const totalPanelOpenings = stockOpeningWidth * panelCount;
    const corePostCount = panelCount - 1;
    const totalCorePostSpace = corePostCount * postWidthMm;
    const gapCount = panelCount + 1;

    // Calculate with minimum gaps
    const minTotalGaps = gapCount * minGapMm;
    const minSectionLength = totalPanelOpenings + totalCorePostSpace + minTotalGaps + 2 * wallPostVisible;

    // Calculate with maximum gaps
    const maxTotalGaps = gapCount * maxGapMm;
    const maxSectionLength = totalPanelOpenings + totalCorePostSpace + maxTotalGaps + 2 * wallPostVisible;

    if (maxSectionLength < options.sectionLengthMm && maxSectionLength > shorterLength) {
      shorterLength = Math.round(maxSectionLength);
    }
    if (minSectionLength > options.sectionLengthMm && (longerLength === 0 || minSectionLength < longerLength)) {
      longerLength = Math.round(minSectionLength);
    }
  }

  return {
    shorter: shorterLength || options.sectionLengthMm - 100, // Fallback
    longer: longerLength || options.sectionLengthMm + 100, // Fallback
  };
}

/**
 * Calculate optimal stock + 1 custom panel solution
 */
function calculateStockPlusCustomSolution(
  options: StockPanelFitOptions,
  availableSpace: number
) {
  const {
    stockPanelWidthMm,
    minGapMm,
    maxGapMm,
    postWidthMm,
    shufflePerSideMm,
  } = options;

  const stockOpeningWidth = stockPanelWidthMm - 2 * shufflePerSideMm;

  let bestSolution: StockPanelFitResult['customPanelSolution'] | null = null;
  let smallestCustomWidth = Infinity;

  // Try different combinations of stock panels + 1 custom
  for (let stockCount = 1; stockCount <= 19; stockCount++) {
    const totalStockOpenings = stockOpeningWidth * stockCount;
    const totalPanelCount = stockCount + 1; // +1 for custom panel
    const corePostCount = totalPanelCount - 1;
    const totalCorePostSpace = corePostCount * postWidthMm;
    const gapCount = totalPanelCount + 1;

    // Use average gaps
    const averageGap = (minGapMm + maxGapMm) / 2;
    const totalGapSpace = gapCount * averageGap;

    const remainingForCustom = availableSpace - totalStockOpenings - totalCorePostSpace - totalGapSpace;
    const customOpeningWidth = Math.round(remainingForCustom);
    const customPanelWidth = customOpeningWidth + 2 * shufflePerSideMm;

    // Check if custom panel is reasonable (between 200mm and 2000mm)
    if (customPanelWidth >= 200 && customPanelWidth <= 2000) {
      // Prefer solutions with smallest custom panel deviation from stock
      const deviation = Math.abs(customPanelWidth - stockPanelWidthMm);
      if (deviation < smallestCustomWidth) {
        smallestCustomWidth = deviation;
        bestSolution = {
          customPanelWidth: Math.round(customPanelWidth),
          suggestedPosition: stockCount, // Place custom at end by default
          stockPanelWidth: stockPanelWidthMm,
          stockPanelCount: stockCount,
        };
      }
    }
  }

  return bestSolution || {
    customPanelWidth: 1000,
    suggestedPosition: 0,
    stockPanelWidth: stockPanelWidthMm,
    stockPanelCount: 1,
  };
}
