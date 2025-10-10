import { PanelLayout } from "./schema";

/**
 * Calculate optimal panel layout for a given span length
 * Panels are custom cut in 50mm increments from 200-2000mm
 * Gaps are calculated to fill remaining space (max 99mm each)
 * 
 * @param spanLength Total span length in mm
 * @param endGaps Total end gaps to subtract from span length
 * @param maxPanelWidth Maximum panel width constraint (200-2000mm)
 * @returns Optimal panel layout where panels + gaps exactly equals effective length
 */
export function calculatePanelLayout(
  spanLength: number,
  endGaps: number = 0,
  maxPanelWidth: number = 2000
): PanelLayout {
  const effectiveLength = spanLength - endGaps;
  const MIN_PANEL = 200;
  const MAX_PANEL = Math.min(maxPanelWidth, 2000);
  const PANEL_INCREMENT = 50;
  const MAX_GAP = 99;
  const MIN_GAP = 0;
  
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

  // Try different numbers of panels (starting with fewer panels - more efficient)
  const maxPossiblePanels = Math.floor(effectiveLength / MIN_PANEL);
  
  for (let numPanels = 1; numPanels <= maxPossiblePanels; numPanels++) {
    // For N panels, we have N-1 gaps
    const numGaps = numPanels - 1;
    
    if (numPanels === 1) {
      // Single panel - must exactly match effective length
      if (effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
        // Round to nearest 50mm increment
        const roundedPanel = Math.round(effectiveLength / PANEL_INCREMENT) * PANEL_INCREMENT;
        if (roundedPanel === effectiveLength) {
          return {
            panels: [effectiveLength],
            gaps: [],
            totalPanelWidth: effectiveLength,
            totalGapWidth: 0,
            averageGap: 0,
          };
        }
      }
      continue;
    }
    
    // Try different panel widths (in 50mm increments)
    for (let panelWidth = MIN_PANEL; panelWidth <= MAX_PANEL; panelWidth += PANEL_INCREMENT) {
      const totalPanelWidth = numPanels * panelWidth;
      
      // Calculate required gap size
      const totalGapWidth = effectiveLength - totalPanelWidth;
      const averageGap = totalGapWidth / numGaps;
      
      // Check if gap is within valid range
      if (averageGap < MIN_GAP || averageGap > MAX_GAP) {
        continue;
      }
      
      // Verify the math: panels + gaps should equal effective length
      if (Math.abs((totalPanelWidth + totalGapWidth) - effectiveLength) > 0.01) {
        continue;
      }
      
      // Score this layout
      // Prefer: fewer panels, gaps closer to 50mm, panels closer to max width
      const gapDeviation = Math.abs(averageGap - 50);
      const panelCountPenalty = numPanels * 5;
      const panelSizePenalty = (MAX_PANEL - panelWidth) / 100;
      const score = gapDeviation + panelCountPenalty + panelSizePenalty;
      
      if (score < bestScore) {
        bestScore = score;
        bestLayout = {
          panels: Array(numPanels).fill(panelWidth),
          gaps: Array(numGaps).fill(averageGap),
          totalPanelWidth,
          totalGapWidth,
          averageGap,
        };
      }
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
