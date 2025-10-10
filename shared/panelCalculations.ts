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
 * @param hasLeftRaked Whether the left panel is a raked panel (fixed 1200mm)
 * @param hasRightRaked Whether the right panel is a raked panel (fixed 1200mm)
 * @returns Panel layout where panels + gaps exactly equals effective length
 */
export function calculatePanelLayout(
  spanLength: number,
  endGaps: number = 0,
  desiredGap: number = 50,
  maxPanelWidth: number = 2000,
  hasLeftRaked: boolean = false,
  hasRightRaked: boolean = false
): PanelLayout {
  const effectiveLength = spanLength - endGaps;
  const MIN_PANEL = 200;
  const MAX_PANEL = Math.min(maxPanelWidth, 2000);
  const PANEL_INCREMENT = 50;
  const MAX_GAP = 99;
  const MIN_GAP = 0;
  const RAKED_PANEL_WIDTH = 1200;
  
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

  // Calculate space reserved for raked panels
  const numRakedPanels = (hasLeftRaked ? 1 : 0) + (hasRightRaked ? 1 : 0);
  const rakedPanelSpace = numRakedPanels * RAKED_PANEL_WIDTH;

  // Single panel case (no raked panels)
  if (numRakedPanels === 0 && effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
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
  
  // Single raked panel only (no room for variable panels)
  if (numRakedPanels === 1 && effectiveLength === RAKED_PANEL_WIDTH) {
    return {
      panels: [RAKED_PANEL_WIDTH],
      gaps: [],
      totalPanelWidth: RAKED_PANEL_WIDTH,
      totalGapWidth: 0,
      averageGap: 0,
    };
  }
  
  // Two raked panels only (with one gap between them)
  if (numRakedPanels === 2 && effectiveLength === 2 * RAKED_PANEL_WIDTH + targetGap) {
    return {
      panels: [RAKED_PANEL_WIDTH, RAKED_PANEL_WIDTH],
      gaps: [targetGap],
      totalPanelWidth: 2 * RAKED_PANEL_WIDTH,
      totalGapWidth: targetGap,
      averageGap: targetGap,
    };
  }

  let bestLayout: PanelLayout | null = null;
  let bestScore = Infinity;
  
  // Determine the range of variable panels to try
  const minVariablePanels = numRakedPanels === 0 ? 2 : 0;
  const maxSpaceForVariables = effectiveLength - rakedPanelSpace;
  const maxPossibleVariablePanels = Math.floor(maxSpaceForVariables / MIN_PANEL);
  
  // Try different numbers of variable panels
  for (let numVariablePanels = minVariablePanels; numVariablePanels <= maxPossibleVariablePanels; numVariablePanels++) {
    const totalPanels = numVariablePanels + numRakedPanels;
    
    // Need at least 1 total panel
    if (totalPanels < 1) continue;
    
    const numGaps = totalPanels - 1;
    const totalGapWidth = numGaps * targetGap;
    const totalVariablePanelWidth = effectiveLength - rakedPanelSpace - totalGapWidth;
    
    // Skip if we can't fit variable panels
    if (numVariablePanels > 0 && (totalVariablePanelWidth < numVariablePanels * MIN_PANEL || 
        totalVariablePanelWidth > numVariablePanels * MAX_PANEL)) {
      continue;
    }
    
    // Skip if no variable panels but raked panels don't fit exactly
    if (numVariablePanels === 0 && totalVariablePanelWidth !== 0) {
      continue;
    }
    
    // Build variable panel array
    let variablePanels: number[] = [];
    
    if (numVariablePanels > 0) {
      // Use largest panels possible, then adjust one to make exact fit
      const idealPanelWidth = Math.floor(totalVariablePanelWidth / numVariablePanels / PANEL_INCREMENT) * PANEL_INCREMENT;
      
      if (idealPanelWidth < MIN_PANEL || idealPanelWidth > MAX_PANEL) {
        continue;
      }
      
      // Start with all variable panels at ideal width
      variablePanels = Array(numVariablePanels).fill(idealPanelWidth);
      let currentTotal = numVariablePanels * idealPanelWidth;
      const remainder = totalVariablePanelWidth - currentTotal;
      
      // Distribute remainder to first panel(s) to achieve exact fit
      if (remainder > 0 && remainder % PANEL_INCREMENT === 0) {
        if (idealPanelWidth + remainder <= MAX_PANEL) {
          variablePanels[0] += remainder;
        } else {
          let remainingToAdd = remainder;
          for (let i = 0; i < numVariablePanels && remainingToAdd > 0; i++) {
            const canAdd = Math.min(MAX_PANEL - variablePanels[i], remainingToAdd);
            const roundedAdd = Math.floor(canAdd / PANEL_INCREMENT) * PANEL_INCREMENT;
            variablePanels[i] += roundedAdd;
            remainingToAdd -= roundedAdd;
          }
          if (remainingToAdd > 0) {
            continue;
          }
        }
      } else if (remainder !== 0) {
        continue;
      }
      
      // Verify all variable panels are within valid range
      if (variablePanels.some(p => p < MIN_PANEL || p > MAX_PANEL)) {
        continue;
      }
    }
    
    // Assemble final panel array with raked panels in correct positions
    let finalPanels: number[] = [];
    if (hasLeftRaked) {
      finalPanels.push(RAKED_PANEL_WIDTH);
    }
    finalPanels.push(...variablePanels);
    if (hasRightRaked) {
      finalPanels.push(RAKED_PANEL_WIDTH);
    }
    
    const actualTotalPanelWidth = finalPanels.reduce((sum, p) => sum + p, 0);
    const actualTotalGapWidth = effectiveLength - actualTotalPanelWidth;
    
    // Check if we achieved exact gap spacing
    if (Math.abs(actualTotalGapWidth - totalGapWidth) < 0.01) {
      const actualGap = actualTotalGapWidth / numGaps;
      
      if (actualGap >= MIN_GAP && actualGap <= MAX_GAP) {
        // Exact match! Prefer fewer panels, then larger panels
        const panelSizeScore = -Math.max(...finalPanels);
        const score = totalPanels * 100 + panelSizeScore;
        
        if (score < bestScore) {
          bestScore = score;
          bestLayout = {
            panels: finalPanels,
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
