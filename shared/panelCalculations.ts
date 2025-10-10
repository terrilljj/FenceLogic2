import { PanelLayout } from "./schema";

/**
 * Calculate panel layout based on desired gap size
 * Uses mixed panel widths to achieve exact gap spacing
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

  // Single panel case
  if (effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
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

  let bestLayout: PanelLayout | null = null;
  let bestScore = Infinity;

  // Try different numbers of panels
  const maxPossiblePanels = Math.floor(effectiveLength / MIN_PANEL);
  
  for (let numPanels = 2; numPanels <= maxPossiblePanels; numPanels++) {
    const numGaps = numPanels - 1;
    
    // Try to achieve exact gap spacing using mixed panel widths
    const totalGapWidth = numGaps * targetGap;
    const totalPanelWidth = effectiveLength - totalGapWidth;
    
    if (totalPanelWidth < numPanels * MIN_PANEL || totalPanelWidth > numPanels * MAX_PANEL) {
      continue;
    }
    
    // Use largest panels possible, then adjust one to make exact fit
    const idealPanelWidth = Math.floor(totalPanelWidth / numPanels / PANEL_INCREMENT) * PANEL_INCREMENT;
    
    if (idealPanelWidth < MIN_PANEL || idealPanelWidth > MAX_PANEL) {
      continue;
    }
    
    // Start with all panels at ideal width
    const panels: number[] = Array(numPanels).fill(idealPanelWidth);
    let currentTotal = numPanels * idealPanelWidth;
    const remainder = totalPanelWidth - currentTotal;
    
    // Distribute remainder to first panel(s) to achieve exact fit
    if (remainder > 0 && remainder % PANEL_INCREMENT === 0) {
      // Add remainder to first panel if it stays within limits
      if (idealPanelWidth + remainder <= MAX_PANEL) {
        panels[0] += remainder;
      } else {
        // Distribute across multiple panels
        let remainingToAdd = remainder;
        for (let i = 0; i < numPanels && remainingToAdd > 0; i++) {
          const canAdd = Math.min(MAX_PANEL - panels[i], remainingToAdd);
          const roundedAdd = Math.floor(canAdd / PANEL_INCREMENT) * PANEL_INCREMENT;
          panels[i] += roundedAdd;
          remainingToAdd -= roundedAdd;
        }
        if (remainingToAdd > 0) {
          continue; // Couldn't distribute remainder
        }
      }
    } else if (remainder !== 0) {
      continue; // Remainder not a multiple of increment
    }
    
    // Verify all panels are within valid range
    if (panels.some(p => p < MIN_PANEL || p > MAX_PANEL)) {
      continue;
    }
    
    const actualTotalPanelWidth = panels.reduce((sum, p) => sum + p, 0);
    const actualTotalGapWidth = effectiveLength - actualTotalPanelWidth;
    
    // Check if we achieved exact gap spacing
    if (Math.abs(actualTotalGapWidth - totalGapWidth) < 0.01) {
      const actualGap = actualTotalGapWidth / numGaps;
      
      if (actualGap >= MIN_GAP && actualGap <= MAX_GAP) {
        // Exact match! Prefer fewer panels, then larger panels
        const panelSizeScore = -Math.max(...panels); // Negative so larger is better
        const score = numPanels * 100 + panelSizeScore;
        
        if (score < bestScore) {
          bestScore = score;
          bestLayout = {
            panels: panels,
            gaps: Array(numGaps).fill(actualGap),
            totalPanelWidth: actualTotalPanelWidth,
            totalGapWidth: actualTotalGapWidth,
            averageGap: actualGap,
          };
        }
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
