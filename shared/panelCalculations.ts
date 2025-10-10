import { PanelLayout } from "./schema";

/**
 * Calculate panel layout based on desired gap size
 * As gap increases, panel widths decrease (and vice versa)
 * Panels are custom cut in 50mm increments from 200-2000mm
 * 
 * @param spanLength Total span length in mm
 * @param endGaps Total end gaps to subtract from span length
 * @param desiredGap Target gap size between panels in mm
 * @param maxPanelWidth Maximum panel width constraint (200-2000mm)
 * @returns Panel layout where panels + gaps exactly equals effective length
 */
export function calculatePanelLayout(
  spanLength: number,
  endGaps: number = 0,
  desiredGap: number = 50,
  maxPanelWidth: number = 2000
): PanelLayout {
  const effectiveLength = spanLength - endGaps;
  const MIN_PANEL = 200;
  const MAX_PANEL = Math.min(maxPanelWidth, 2000);
  const PANEL_INCREMENT = 50;
  const MAX_GAP = 99;
  const MIN_GAP = 0;
  
  // Clamp desired gap to valid range
  const targetGap = Math.max(MIN_GAP, Math.min(MAX_GAP, desiredGap));
  
  if (effectiveLength <= 0 || effectiveLength < MIN_PANEL) {
    return {
      panels: [],
      gaps: [],
      totalPanelWidth: 0,
      totalGapWidth: 0,
      averageGap: 0,
    };
  }

  let bestLayout: PanelLayout | null = null;
  let bestScore = Infinity;

  // Try different numbers of panels
  const maxPossiblePanels = Math.floor(effectiveLength / MIN_PANEL);
  
  for (let numPanels = 1; numPanels <= maxPossiblePanels; numPanels++) {
    const numGaps = numPanels - 1;
    
    if (numPanels === 1) {
      // Single panel - no gaps, must match effective length exactly
      if (effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
        const roundedPanel = Math.round(effectiveLength / PANEL_INCREMENT) * PANEL_INCREMENT;
        if (roundedPanel === effectiveLength) {
          const gapDeviation = Math.abs(0 - targetGap);
          if (gapDeviation < bestScore) {
            bestScore = gapDeviation;
            bestLayout = {
              panels: [effectiveLength],
              gaps: [],
              totalPanelWidth: effectiveLength,
              totalGapWidth: 0,
              averageGap: 0,
            };
          }
        }
      }
      continue;
    }
    
    // Calculate panel width based on desired gap
    // Formula: N * panelWidth + (N-1) * gap = effectiveLength
    // Therefore: panelWidth = (effectiveLength - (N-1) * gap) / N
    const totalGapWidth = numGaps * targetGap;
    const totalPanelWidth = effectiveLength - totalGapWidth;
    const calculatedPanelWidth = totalPanelWidth / numPanels;
    
    // Round to nearest 50mm increment
    const roundedPanelWidth = Math.round(calculatedPanelWidth / PANEL_INCREMENT) * PANEL_INCREMENT;
    
    // Check if panel width is valid
    if (roundedPanelWidth < MIN_PANEL || roundedPanelWidth > MAX_PANEL) {
      continue;
    }
    
    // Recalculate actual gap with rounded panel width
    const actualTotalPanelWidth = numPanels * roundedPanelWidth;
    const actualTotalGapWidth = effectiveLength - actualTotalPanelWidth;
    const actualGap = actualTotalGapWidth / numGaps;
    
    // Check if actual gap is within valid range
    if (actualGap < MIN_GAP || actualGap > MAX_GAP) {
      continue;
    }
    
    // Verify the math
    if (Math.abs((actualTotalPanelWidth + actualTotalGapWidth) - effectiveLength) > 0.01) {
      continue;
    }
    
    // Score this layout - prefer layouts with gap closer to target
    const gapDeviation = Math.abs(actualGap - targetGap);
    const panelCountPenalty = numPanels * 2; // Slight preference for fewer panels
    const score = gapDeviation + panelCountPenalty;
    
    if (score < bestScore) {
      bestScore = score;
      bestLayout = {
        panels: Array(numPanels).fill(roundedPanelWidth),
        gaps: Array(numGaps).fill(actualGap),
        totalPanelWidth: actualTotalPanelWidth,
        totalGapWidth: actualTotalGapWidth,
        averageGap: actualGap,
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
