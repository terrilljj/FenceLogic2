import { PanelLayout, PanelType } from "./schema";

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
 * @param gateConfig Gate configuration if gate is required
 * @returns Panel layout where panels + gaps exactly equals effective length
 */
export function calculatePanelLayout(
  spanLength: number,
  endGaps: number = 0,
  desiredGap: number = 50,
  maxPanelWidth: number = 2000,
  hasLeftRaked: boolean = false,
  hasRightRaked: boolean = false,
  gateConfig?: {
    required: boolean;
    gateSize: number;
    hingePanelSize: number;
    position: number;
    flipped: boolean;
    hingeFrom?: "glass" | "wall";
  }
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

  // Calculate space reserved for fixed panels (raked + gate)
  const numRakedPanels = (hasLeftRaked ? 1 : 0) + (hasRightRaked ? 1 : 0);
  const rakedPanelSpace = numRakedPanels * RAKED_PANEL_WIDTH;
  
  // If gate is required, reserve space for gate (and hinge panel if glass-to-glass)
  const hasGate = gateConfig?.required === true;
  const isWallMounted = gateConfig?.hingeFrom === "wall";
  const gateSpace = hasGate ? (isWallMounted ? gateConfig.gateSize : gateConfig.gateSize + gateConfig.hingePanelSize) : 0;
  const totalFixedPanelSpace = rakedPanelSpace + gateSpace;

  // Single panel case (no raked panels, no gate)
  if (numRakedPanels === 0 && !hasGate && effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
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
  const minVariablePanels = (numRakedPanels === 0 && !hasGate) ? 2 : 0;
  const maxSpaceForVariables = effectiveLength - totalFixedPanelSpace;
  const maxPossibleVariablePanels = Math.floor(maxSpaceForVariables / MIN_PANEL);
  
  // Try different numbers of variable panels
  for (let numVariablePanels = minVariablePanels; numVariablePanels <= maxPossibleVariablePanels; numVariablePanels++) {
    const numGatePanels = hasGate ? (isWallMounted ? 1 : 2) : 0; // Wall-mounted: 1 panel, Glass-to-glass: 2 panels
    const numFixedPanels = numRakedPanels + numGatePanels; // Raked + gate + (optional hinge)
    const totalPanels = numVariablePanels + numFixedPanels;
    
    // Need at least 1 total panel
    if (totalPanels < 1) continue;
    
    const numGaps = totalPanels - 1;
    const totalGapWidth = numGaps * targetGap;
    const totalVariablePanelWidth = effectiveLength - totalFixedPanelSpace - totalGapWidth;
    
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
    
    // Assemble final panel array with raked panels and gate in correct positions
    let finalPanels: number[] = [];
    let panelTypes: PanelType[] = [];
    
    // Add left raked panel if enabled
    if (hasLeftRaked) {
      finalPanels.push(RAKED_PANEL_WIDTH);
      panelTypes.push("raked");
    }
    
    // Add variable panels and insert gate if required
    if (hasGate && gateConfig) {
      if (isWallMounted) {
        // Wall-mounted gate: position is normalized to 0 (start) or 1 (end)
        const atEnd = gateConfig.position >= 1;
        
        if (atEnd) {
          // All panels first, then gate at end
          finalPanels.push(...variablePanels);
          panelTypes.push(...Array(variablePanels.length).fill("standard"));
          finalPanels.push(gateConfig.gateSize);
          panelTypes.push("gate");
        } else {
          // Gate at start, then all panels
          finalPanels.push(gateConfig.gateSize);
          panelTypes.push("gate");
          finalPanels.push(...variablePanels);
          panelTypes.push(...Array(variablePanels.length).fill("standard"));
        }
      } else {
        // Glass-to-glass gate: position is panel index (0-based)
        // Position 0 = gate at start, Position 1 = after first panel, etc.
        const panelPosition = Math.max(0, Math.floor(gateConfig.position));
        const beforeCount = Math.min(panelPosition, variablePanels.length);
        
        // Panels before gate
        finalPanels.push(...variablePanels.slice(0, beforeCount));
        panelTypes.push(...Array(beforeCount).fill("standard"));
        
        // Gate assembly (order depends on flipped)
        if (gateConfig.flipped) {
          finalPanels.push(gateConfig.hingePanelSize);
          panelTypes.push("hinge");
          finalPanels.push(gateConfig.gateSize);
          panelTypes.push("gate");
        } else {
          finalPanels.push(gateConfig.gateSize);
          panelTypes.push("gate");
          finalPanels.push(gateConfig.hingePanelSize);
          panelTypes.push("hinge");
        }
        
        // Panels after gate
        const afterCount = variablePanels.length - beforeCount;
        finalPanels.push(...variablePanels.slice(beforeCount));
        panelTypes.push(...Array(afterCount).fill("standard"));
      }
    } else {
      // No gate, just add all variable panels
      finalPanels.push(...variablePanels);
      panelTypes.push(...Array(variablePanels.length).fill("standard"));
    }
    
    // Add right raked panel if enabled
    if (hasRightRaked) {
      finalPanels.push(RAKED_PANEL_WIDTH);
      panelTypes.push("raked");
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
            panelTypes: panelTypes,
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
