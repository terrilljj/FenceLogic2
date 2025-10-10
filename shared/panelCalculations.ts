import { STOCK_PANEL_WIDTHS, PanelLayout } from "./schema";

/**
 * Calculate optimal panel layout for a given span length
 * @param spanLength Total span length in mm
 * @param endGaps Total end gaps to subtract from span length
 * @param allowMixedPanels Whether to allow different panel sizes
 * @param maxPanelWidth Optional maximum panel width constraint
 * @returns Optimal panel layout with calculated gaps
 */
export function calculatePanelLayout(
  spanLength: number,
  endGaps: number = 0,
  allowMixedPanels: boolean = false,
  maxPanelWidth: number = 1800
): PanelLayout {
  const effectiveLength = spanLength - endGaps;
  
  if (effectiveLength <= 0) {
    return {
      panels: [],
      gaps: [],
      totalPanelWidth: 0,
      totalGapWidth: 0,
      averageGap: 0,
    };
  }

  // Filter stock widths by max panel width constraint
  const availableWidths = STOCK_PANEL_WIDTHS.filter(w => w <= maxPanelWidth);
  
  if (availableWidths.length === 0) {
    return {
      panels: [],
      gaps: [],
      totalPanelWidth: 0,
      totalGapWidth: 0,
      averageGap: 0,
    };
  }

  // Try to find optimal layout
  let bestLayout: PanelLayout | null = null;
  let bestScore = Infinity;

  // Try different panel widths (starting from largest for efficiency)
  for (let i = availableWidths.length - 1; i >= 0; i--) {
    const panelWidth = availableWidths[i];
    
    // Calculate how many panels of this size fit
    // Using corrected formula: numPanels = floor((length + gap) / (panelWidth + gap))
    // But we don't know gap yet, so we estimate with minimum reasonable gap
    const minGap = 10; // minimum 10mm gap
    const maxGap = 99; // maximum 99mm gap
    
    // Try different panel counts
    for (let numPanels = 1; numPanels <= Math.floor(effectiveLength / panelWidth) + 1; numPanels++) {
      const totalPanelWidth = numPanels * panelWidth;
      const totalGapWidth = effectiveLength - totalPanelWidth;
      
      // Check if gaps are reasonable
      if (numPanels === 1) {
        // Single panel - no gaps
        if (totalPanelWidth === effectiveLength) {
          const layout: PanelLayout = {
            panels: [panelWidth],
            gaps: [],
            totalPanelWidth,
            totalGapWidth: 0,
            averageGap: 0,
          };
          return layout; // Perfect fit with single panel
        }
        continue; // Single panel doesn't fit
      }
      
      const numGaps = numPanels - 1;
      const averageGap = totalGapWidth / numGaps;
      
      // Check if gaps are within acceptable range
      if (averageGap < minGap || averageGap > maxGap) {
        continue;
      }
      
      // Check if we have enough length
      if (totalPanelWidth > effectiveLength) {
        continue;
      }
      
      // Calculate score (prefer fewer panels, uniform gaps close to 50mm)
      const gapDeviation = Math.abs(averageGap - 50);
      const panelCountPenalty = numPanels * 10;
      const score = gapDeviation + panelCountPenalty;
      
      if (score < bestScore) {
        bestScore = score;
        const gaps = Array(numGaps).fill(averageGap);
        bestLayout = {
          panels: Array(numPanels).fill(panelWidth),
          gaps,
          totalPanelWidth,
          totalGapWidth,
          averageGap,
        };
      }
    }
  }

  // If no good single-width solution and mixed panels allowed, try mixed approach
  if (allowMixedPanels && (bestLayout === null || bestLayout.averageGap > 75)) {
    const mixedLayout = calculateMixedPanelLayout(effectiveLength, availableWidths);
    if (mixedLayout && (bestLayout === null || mixedLayout.averageGap < bestLayout.averageGap)) {
      bestLayout = mixedLayout;
    }
  }

  // Fallback: use smallest available panel
  if (bestLayout === null) {
    const smallestPanel = availableWidths[0];
    const numPanels = Math.floor(effectiveLength / (smallestPanel + 50));
    if (numPanels > 0) {
      const totalPanelWidth = numPanels * smallestPanel;
      const totalGapWidth = effectiveLength - totalPanelWidth;
      const averageGap = numPanels > 1 ? totalGapWidth / (numPanels - 1) : 0;
      
      bestLayout = {
        panels: Array(numPanels).fill(smallestPanel),
        gaps: numPanels > 1 ? Array(numPanels - 1).fill(averageGap) : [],
        totalPanelWidth,
        totalGapWidth,
        averageGap,
      };
    }
  }

  return bestLayout || {
    panels: [],
    gaps: [],
    totalPanelWidth: 0,
    totalGapWidth: 0,
    averageGap: 0,
  };
}

/**
 * Calculate layout using mixed panel sizes for better fit
 */
function calculateMixedPanelLayout(
  effectiveLength: number,
  availableWidths: readonly number[]
): PanelLayout | null {
  // Simple greedy algorithm: use largest panels possible
  const panels: number[] = [];
  let remaining = effectiveLength;
  const minGap = 10;
  const maxGap = 99;
  
  while (remaining > 0) {
    let placed = false;
    
    // Try to place largest panel that fits
    for (let i = availableWidths.length - 1; i >= 0; i--) {
      const panelWidth = availableWidths[i];
      const estimatedGaps = panels.length; // Number of gaps after adding this panel
      const minTotalGaps = estimatedGaps * minGap;
      const maxTotalGaps = estimatedGaps * maxGap;
      
      // Check if this panel fits with reasonable gaps
      if (panelWidth + minTotalGaps <= remaining && panelWidth + maxTotalGaps >= remaining) {
        panels.push(panelWidth);
        remaining -= panelWidth;
        placed = true;
        break;
      }
    }
    
    if (!placed) break;
    
    // Safety limit
    if (panels.length > 20) break;
  }
  
  if (panels.length === 0) return null;
  
  const totalPanelWidth = panels.reduce((sum, w) => sum + w, 0);
  const totalGapWidth = effectiveLength - totalPanelWidth;
  const numGaps = panels.length - 1;
  const averageGap = numGaps > 0 ? totalGapWidth / numGaps : 0;
  
  // Check if gaps are reasonable
  if (averageGap < minGap || averageGap > maxGap) {
    return null;
  }
  
  const gaps = numGaps > 0 ? Array(numGaps).fill(averageGap) : [];
  
  return {
    panels,
    gaps,
    totalPanelWidth,
    totalGapWidth,
    averageGap,
  };
}
