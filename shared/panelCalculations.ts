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
 * @param customPanelConfig Custom panel configuration if custom panel is required
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
    hingeGap?: number;
    latchGap?: number;
  },
  customPanelConfig?: {
    enabled: boolean;
    width: number;
    height: number;
    position: number;
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

  // Calculate space reserved for fixed panels (raked + gate + custom)
  const numRakedPanels = (hasLeftRaked ? 1 : 0) + (hasRightRaked ? 1 : 0);
  const rakedPanelSpace = numRakedPanels * RAKED_PANEL_WIDTH;
  
  // If gate is required, reserve space for gate (and hinge panel if glass-to-glass)
  const hasGate = gateConfig?.required === true;
  const isWallMounted = gateConfig?.hingeFrom === "wall";
  const gateSpace = hasGate ? (isWallMounted ? gateConfig.gateSize : gateConfig.gateSize + gateConfig.hingePanelSize) : 0;
  
  // If custom panel is required, reserve space for it
  const hasCustomPanel = customPanelConfig?.enabled === true;
  const customPanelSpace = hasCustomPanel ? customPanelConfig.width : 0;
  
  const totalFixedPanelSpace = rakedPanelSpace + gateSpace + customPanelSpace;

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
  const minVariablePanels = (numRakedPanels === 0 && !hasGate && !hasCustomPanel) ? 2 : 0;
  const maxSpaceForVariables = effectiveLength - totalFixedPanelSpace;
  const maxPossibleVariablePanels = Math.floor(maxSpaceForVariables / MIN_PANEL);
  
  // Try different numbers of variable panels
  for (let numVariablePanels = minVariablePanels; numVariablePanels <= maxPossibleVariablePanels; numVariablePanels++) {
    const numGatePanels = hasGate ? (isWallMounted ? 1 : 2) : 0; // Wall-mounted: 1 panel, Glass-to-glass: 2 panels
    const numCustomPanels = hasCustomPanel ? 1 : 0; // Custom panel if enabled
    const numFixedPanels = numRakedPanels + numGatePanels + numCustomPanels; // Raked + gate + custom + (optional hinge)
    const totalPanels = numVariablePanels + numFixedPanels;
    
    // Need at least 1 total panel
    if (totalPanels < 1) continue;
    
    const numGaps = totalPanels - 1;
    
    // Calculate total gap width, accounting for specific gate gaps if present
    let totalGapWidth = 0;
    let numRegularGaps = numGaps;
    
    if (hasGate && gateConfig.hingeGap !== undefined && gateConfig.latchGap !== undefined) {
      if (isWallMounted) {
        // Wall-mounted gate: only 1 specific gap (latch side), hinge side is attached to wall
        totalGapWidth = gateConfig.latchGap + Math.max(0, numGaps - 1) * targetGap;
        numRegularGaps = Math.max(0, numGaps - 1);
      } else {
        // Glass-to-glass: 2 gate-adjacent gaps use specific values (hinge and latch)
        const gateGapTotal = gateConfig.hingeGap + gateConfig.latchGap;
        totalGapWidth = gateGapTotal + Math.max(0, numGaps - 2) * targetGap;
        numRegularGaps = Math.max(0, numGaps - 2);
      }
    } else {
      totalGapWidth = numGaps * targetGap;
    }
    
    const totalVariablePanelWidth = effectiveLength - totalFixedPanelSpace - totalGapWidth;
    
    if (hasGate && numVariablePanels === 2) {
      console.log('Gate case - effectiveLength:', effectiveLength, 'fixedSpace:', totalFixedPanelSpace, 'gapWidth:', totalGapWidth, 'variableWidth:', totalVariablePanelWidth);
    }
    
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
      // Calculate average panel width and round to nearest increment
      const averagePanelWidth = totalVariablePanelWidth / numVariablePanels;
      const idealPanelWidth = Math.round(averagePanelWidth / PANEL_INCREMENT) * PANEL_INCREMENT;
      
      if (hasGate && numVariablePanels === 2) {
        console.log('Average panel width:', averagePanelWidth, '→ rounded ideal:', idealPanelWidth, 'for', numVariablePanels, 'panels');
      }
      
      if (idealPanelWidth < MIN_PANEL || idealPanelWidth > MAX_PANEL) {
        continue;
      }
      
      // Start with all variable panels at ideal width
      variablePanels = Array(numVariablePanels).fill(idealPanelWidth);
      let currentTotal = numVariablePanels * idealPanelWidth;
      const remainder = totalVariablePanelWidth - currentTotal;
      
      // Distribute remainder to first panel(s) to achieve exact fit
      if (Math.abs(remainder) > 0.001) { // Use tolerance for floating point comparison
        // Round remainder to nearest panel increment
        const roundedRemainder = Math.round(remainder / PANEL_INCREMENT) * PANEL_INCREMENT;
        
        if (roundedRemainder > 0) {
          if (idealPanelWidth + roundedRemainder <= MAX_PANEL) {
            variablePanels[0] += roundedRemainder;
          } else {
            let remainingToAdd = roundedRemainder;
            for (let i = 0; i < numVariablePanels && remainingToAdd > 0; i++) {
              const canAdd = Math.min(MAX_PANEL - variablePanels[i], remainingToAdd);
              const roundedAdd = Math.floor(canAdd / PANEL_INCREMENT) * PANEL_INCREMENT;
              variablePanels[i] += roundedAdd;
              remainingToAdd -= roundedAdd;
            }
            if (remainingToAdd > PANEL_INCREMENT / 2) { // Allow small remainder tolerance
              continue;
            }
          }
        } else if (roundedRemainder < 0) {
          // Handle negative remainder (need to reduce panel size)
          if (idealPanelWidth + roundedRemainder >= MIN_PANEL) {
            variablePanels[0] += roundedRemainder;
          } else {
            continue; // Can't fit with negative remainder
          }
        }
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
    
    // Insert custom panel at specified position (if enabled and gate is not present, or if position is valid)
    if (hasCustomPanel && customPanelConfig) {
      const customPosition = Math.max(0, Math.min(customPanelConfig.position, finalPanels.length));
      
      // Insert custom panel at the specified position
      finalPanels.splice(customPosition, 0, customPanelConfig.width);
      panelTypes.splice(customPosition, 0, "custom");
    }
    
    // Add right raked panel if enabled
    if (hasRightRaked) {
      finalPanels.push(RAKED_PANEL_WIDTH);
      panelTypes.push("raked");
    }
    
    const actualTotalPanelWidth = finalPanels.reduce((sum, p) => sum + p, 0);
    const actualTotalGapWidth = effectiveLength - actualTotalPanelWidth;
    
    // Check if we achieved exact or near-exact gap spacing
    // Allow larger tolerance to accommodate rounding from panel increments
    const tolerance = PANEL_INCREMENT;
    
    if (Math.abs(actualTotalGapWidth - totalGapWidth) <= tolerance) {
      const actualGap = actualTotalGapWidth / numGaps;
      
      if (actualGap >= MIN_GAP && actualGap <= MAX_GAP) {
        // Good match! Prefer fewer panels, then larger panels
        const panelSizeScore = -Math.max(...finalPanels);
        const gapDiffPenalty = Math.abs(actualGap - targetGap) * 10;
        const score = totalPanels * 100 + panelSizeScore + gapDiffPenalty;
        
        if (score < bestScore) {
          bestScore = score;
          
          // Build gaps array with specific gate gaps if present
          let gapsArray: number[] = [];
          
          if (hasGate && gateConfig.hingeGap !== undefined && gateConfig.latchGap !== undefined) {
            // Find gate position in final panels array
            const gateIndex = panelTypes.findIndex(t => t === "gate");
            
            if (gateIndex !== -1) {
              // Calculate regular gap size that absorbs the difference from hardware gaps
              let regularGapSize: number;
              
              if (isWallMounted) {
                // Wall-mounted: 1 hardware gap (latch), rest are regular
                const numRegularGaps = numGaps - 1;
                const remainingGapSpace = actualTotalGapWidth - gateConfig.latchGap;
                regularGapSize = numRegularGaps > 0 ? remainingGapSpace / numRegularGaps : actualGap;
              } else {
                // Glass-to-glass: 2 hardware gaps (hinge + latch), rest are regular
                const numRegularGaps = numGaps - 2;
                const remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap - gateConfig.latchGap;
                regularGapSize = numRegularGaps > 0 ? remainingGapSpace / numRegularGaps : actualGap;
              }
              
              // Build gaps with specific values at gate positions
              for (let i = 0; i < numGaps; i++) {
                if (isWallMounted) {
                  // Wall-mounted: gate is attached to wall on one side, only latch gap on the other
                  if (gateConfig.position === 0) {
                    // Gate at start: latch gap is after gate (index 0)
                    if (i === 0) {
                      gapsArray.push(gateConfig.latchGap);
                    } else {
                      gapsArray.push(regularGapSize);
                    }
                  } else {
                    // Gate at end: latch gap is before gate (last gap)
                    if (i === numGaps - 1) {
                      gapsArray.push(gateConfig.latchGap);
                    } else {
                      gapsArray.push(regularGapSize);
                    }
                  }
                } else {
                  // Glass-to-glass: hinge panel adjacent to gate
                  const hingeIndex = panelTypes.findIndex(t => t === "hinge");
                  
                  if (!gateConfig.flipped) {
                    // Gate first, then hinge: [... | latch gap | gate | hinge gap | hinge | ...]
                    // Gap at gateIndex is BETWEEN gate and hinge (hinge gap)
                    // Gap at gateIndex-1 is BEFORE gate (latch gap, if gate not at start)
                    if (i === gateIndex - 1 && gateIndex > 0) {
                      gapsArray.push(gateConfig.latchGap);
                    } else if (i === gateIndex) {
                      gapsArray.push(gateConfig.hingeGap);
                    } else {
                      gapsArray.push(regularGapSize);
                    }
                  } else {
                    // Hinge first, then gate: [... | hinge gap | hinge | latch gap | gate | ...]
                    // Gap at hingeIndex is BETWEEN hinge and gate (hinge gap)
                    // Gap at gateIndex is AFTER gate (latch gap, if gate not at end)
                    if (i === hingeIndex) {
                      gapsArray.push(gateConfig.hingeGap);
                    } else if (i === gateIndex && gateIndex < finalPanels.length - 1) {
                      gapsArray.push(gateConfig.latchGap);
                    } else {
                      gapsArray.push(regularGapSize);
                    }
                  }
                }
              }
            } else {
              // Fallback if gate not found
              gapsArray = Array(numGaps).fill(actualGap);
            }
          } else {
            // No specific gate gaps, use uniform gaps
            gapsArray = Array(numGaps).fill(actualGap);
          }
          
          bestLayout = {
            panels: finalPanels,
            gaps: gapsArray,
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
