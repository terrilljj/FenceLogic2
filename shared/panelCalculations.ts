import { PanelLayout, PanelType } from "./schema";
import { equalizePanels } from "./calc/equalize";

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
    /** When false, the hinge panel is a deliberate manual size (e.g. a narrow hinge to
     *  position the gate) and the HINGE-MATCH RULE is disabled — standard panels
     *  equalise independently. Undefined/true = rule applies (match panel sizes). */
    autoHingePanel?: boolean;
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
  const MAX_GAP = 99; // Max gap for middle gaps (between panels)
  const MAX_END_GAP = 150; // Max gap for left/right end gaps
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
  
  // If gate is required, reserve space for gate (and hinge panel if glass-to-glass) INCLUDING hardware gaps
  const hasGate = gateConfig?.required === true;
  const isWallMounted = gateConfig?.hingeFrom === "wall";
  const gateSpace = hasGate ? (
    isWallMounted 
      ? gateConfig.gateSize + (gateConfig.latchGap || 0)
      : gateConfig.gateSize + gateConfig.hingePanelSize + (gateConfig.hingeGap || 0) + (gateConfig.latchGap || 0)
  ) : 0;
  
  // If custom panel is required, reserve space for it
  const hasCustomPanel = customPanelConfig?.enabled === true;
  const customPanelSpace = hasCustomPanel ? customPanelConfig.width : 0;
  
  const totalFixedPanelSpace = rakedPanelSpace + gateSpace + customPanelSpace;

  // Single panel case (no raked panels, no gate, no custom panel — a custom/fixed
  // panel must go through the main loop so it keeps its type and width).
  if (numRakedPanels === 0 && !hasGate && !hasCustomPanel && effectiveLength >= MIN_PANEL && effectiveLength <= MAX_PANEL) {
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

  // TWO PASSES (owner bug 2026-06-03: mid gap 99 on a 5m run returned NO layout):
  // Pass 1 (strict) keeps the historical behaviour — panels must leave at least the
  // requested gap space, so any input that worked before produces the exact same
  // layout. Pass 2 (relaxed) runs ONLY when pass 1 finds nothing: panels are allowed
  // to overshoot the requested gap space (gaps land BELOW the target), growing onto
  // the 50mm grid so the per-gap cap (99mm) is still respected.
  for (const relaxed of [false, true]) {
  if (relaxed && bestLayout) break;

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

    // HINGE-MATCH RULE (owner, 2026-06-02): with a glass-to-glass gate, the hinge
    // panel and the standard panels must read as ONE family of glass — at most 2
    // distinct widths across {hinge, standards}, exactly 50mm apart (e.g. hinge
    // 1600 with standards 1600/1650, never a third size). Matched layouts are
    // strongly preferred in scoring; when the geometry makes a match impossible
    // (the hinge size is user-fixed), the equalized fallback below still runs so
    // a layout is always produced.
    let hingeMatched = false;

    // The rule is OFF when the hinge size is a deliberate manual choice (autoHingePanel
    // === false) — e.g. a narrow hinge panel used to position the gate. Standards then
    // equalise independently instead of shrinking to match the hinge.
    const hingeMatchApplies = hasGate && !isWallMounted && gateConfig !== undefined && gateConfig.autoHingePanel !== false;

    if (numVariablePanels > 0 && hingeMatchApplies && gateConfig) {
      const h = gateConfig.hingePanelSize;
      let best: number[] | null = null;
      let bestDiff = Infinity;
      // Candidate second size: same as hinge, one 50mm step up, one step down.
      for (const alt of [h, h + PANEL_INCREMENT, h - PANEL_INCREMENT]) {
        if (h < MIN_PANEL || h > MAX_PANEL || alt < MIN_PANEL || alt > MAX_PANEL) continue;
        const kMax = alt === h ? 0 : numVariablePanels;
        for (let k = 0; k <= kMax; k++) {
          const total = (numVariablePanels - k) * h + k * alt;
          // Panels may undershoot the target (gaps absorb up to ~100mm across the
          // run, validated later) but never overshoot past the 2mm rounding allowance.
          const diff = totalVariablePanelWidth - total;
          if (diff < -2 || diff > 100) continue;
          if (Math.abs(diff) < bestDiff) {
            bestDiff = Math.abs(diff);
            best = [...Array(numVariablePanels - k).fill(h), ...Array(k).fill(alt)];
          }
        }
      }
      if (best) {
        variablePanels = best;
        hingeMatched = true;
      }
    }

    if (numVariablePanels > 0 && !hingeMatched) {
      // Use equalizePanels to distribute panels on 50mm grid
      const equalizeResult = equalizePanels({
        targetMm: totalVariablePanelWidth,
        stepMm: PANEL_INCREMENT,
        maxPanelMm: MAX_PANEL,
        minPanelMm: MIN_PANEL,
      });
      
      // If equalizePanels found a solution with the desired panel count, use it
      if (equalizeResult.widthsMm && equalizeResult.widthsMm.length === numVariablePanels) {
        variablePanels = equalizeResult.widthsMm;
        
        // CRITICAL: Verify all panels are within valid range (especially MAX_PANEL constraint)
        if (variablePanels.some(p => p < MIN_PANEL || p > MAX_PANEL)) {
          continue; // Skip this configuration if any panel exceeds max panel width
        }
      } else {
        // Fallback to original algorithm if equalizePanels can't produce exact count
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
        
        // Distribute remainder evenly across panels if possible
        if (Math.abs(remainder) > 0.001) { // Use tolerance for floating point comparison
          const absRemainder = Math.abs(remainder);
          
          // For negative remainder (panels too large), reduce panel size to avoid variance
          if (remainder < 0) {
            // Always try to reduce at least one panel to eliminate negative variance
            let remainingToSubtract = Math.ceil(absRemainder / PANEL_INCREMENT) * PANEL_INCREMENT;
            for (let i = 0; i < numVariablePanels && remainingToSubtract > 0; i++) {
              const canSubtract = Math.min(variablePanels[i] - MIN_PANEL, remainingToSubtract);
              if (canSubtract >= PANEL_INCREMENT) {
                variablePanels[i] -= PANEL_INCREMENT;
                remainingToSubtract -= PANEL_INCREMENT;
              }
            }
          } else if (remainder > 0) {
            // For positive remainder, only add if it's a full increment
            if (absRemainder >= PANEL_INCREMENT) {
              let remainingToAdd = Math.floor(absRemainder / PANEL_INCREMENT) * PANEL_INCREMENT;
              for (let i = 0; i < numVariablePanels && remainingToAdd > 0; i++) {
                const canAdd = Math.min(MAX_PANEL - variablePanels[i], remainingToAdd);
                if (canAdd >= PANEL_INCREMENT) {
                  variablePanels[i] += PANEL_INCREMENT;
                  remainingToAdd -= PANEL_INCREMENT;
                }
              }
            }
            // Small positive remainders (< PANEL_INCREMENT) will be absorbed by gaps
          }
        }
        
        // Verify all variable panels are within valid range
        if (variablePanels.some(p => p < MIN_PANEL || p > MAX_PANEL)) {
          continue;
        }
      }
    }
    
    // RELAXED pass only: the equalized/matched panels undershoot the target-gap space.
    // If that leaves more gap space than the gaps can legally hold (numGaps × 99mm),
    // grow panels by 50mm increments until the gaps come back inside the cap.
    if (relaxed && numVariablePanels > 0 && variablePanels.length > 0) {
      let gapSpace = effectiveLength - totalFixedPanelSpace - variablePanels.reduce((s, p) => s + p, 0);
      let guard = 0;
      while (gapSpace > numGaps * MAX_GAP && guard < 200) {
        const growable = variablePanels.findIndex((p) => p + PANEL_INCREMENT <= MAX_PANEL);
        if (growable === -1) break;
        variablePanels[growable] += PANEL_INCREMENT;
        gapSpace -= PANEL_INCREMENT;
        guard++;
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
          // Flipped: Hinge first, then Gate (hinges on LEFT)
          finalPanels.push(gateConfig.hingePanelSize);
          panelTypes.push("hinge");
          finalPanels.push(gateConfig.gateSize);
          panelTypes.push("gate");
        } else {
          // Normal: Gate first, then Hinge (hinges on RIGHT)
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
    
    // STRICT CONSTRAINT: Total must never exceed section length
    // Also ensure we have enough space for minimum required gaps
    if (actualTotalPanelWidth > effectiveLength || actualTotalGapWidth < 0) {
      continue; // Skip configurations that are too large
    }
    
    // Additional check: ensure we meet the planned gap requirements
    // If actualTotalGapWidth < totalGapWidth, panels are too big and will create negative variance
    const gapDeficit = totalGapWidth - actualTotalGapWidth;
    
    // STRICT pass: only accept configurations with AT LEAST the required gap space
    // (max 2mm deficit for floating point rounding). The RELAXED pass allows panels
    // to eat into the requested gap space — gaps simply end up smaller than asked.
    if (!relaxed && gapDeficit > 2) {
      continue; // Panels are too large, skip this configuration
    }
    
    // Check if we achieved exact or near-exact gap spacing
    // Allow tolerance for positive variance (extra gap space to distribute)
    // Increased tolerance to account for panel equalization rounding (up to 100mm variance is acceptable)
    const tolerance = 100;
    
    const gapSpaceAcceptable = relaxed
      ? actualTotalGapWidth >= 0
      : actualTotalGapWidth >= totalGapWidth - 2 && Math.abs(actualTotalGapWidth - totalGapWidth) <= tolerance;

    if (gapSpaceAcceptable) {
      // Guard the zero-gap case (a single fixed/custom panel filling the run exactly):
      // 0/0 = NaN would wrongly fail the gap-range check below.
      const actualGap = numGaps > 0 ? actualTotalGapWidth / numGaps : 0;
      
      if (actualGap >= MIN_GAP && actualGap <= MAX_GAP) {
        // VALIDATE GATE GAPS FIRST (before scoring)
        // If gate is present, check that regular gaps don't exceed 99mm
        if (hasGate && gateConfig.hingeGap !== undefined && gateConfig.latchGap !== undefined) {
          let regularGapSize: number;
          
          if (isWallMounted) {
            // Wall-mounted: 1 hardware gap (latch), rest are regular
            const numRegularGaps = numGaps - 1;
            const remainingGapSpace = actualTotalGapWidth - gateConfig.latchGap;
            regularGapSize = numRegularGaps > 0 ? remainingGapSpace / numRegularGaps : actualGap;
          } else {
            // Glass-to-glass: hardware gaps depend on gate position
            let numHardwareGaps: number;
            let remainingGapSpace: number;
            
            // Recalculate gate position to determine if at end
            const panelPosition = Math.max(0, Math.floor(gateConfig.position));
            const beforeCount = Math.min(panelPosition, variablePanels.length);
            const gateAtEnd = beforeCount >= variablePanels.length;
            
            if (gateConfig.position === 0 && !gateConfig.flipped) {
              // Gate at start, not flipped: only hinge gap exists
              numHardwareGaps = 1;
              remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap;
            } else if (gateAtEnd && gateConfig.flipped) {
              // Gate at end, flipped: only hinge gap exists (no latch gap to wall)
              numHardwareGaps = 1;
              remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap;
            } else {
              // Gate in middle or edge with latch gap: both hinge and latch gaps
              numHardwareGaps = 2;
              remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap - gateConfig.latchGap;
            }
            
            const numRegularGaps = numGaps - numHardwareGaps;
            regularGapSize = numRegularGaps > 0 ? remainingGapSpace / numRegularGaps : actualGap;
          }
          
          // Regular gaps must not exceed 99mm
          if (regularGapSize > MAX_GAP) {
            continue; // Skip this configuration
          }
        }
        
        // Good match! Prefer configurations with gate/custom panels, then fewer panels, then larger panels
        const hasRequiredComponents = (hasGate || hasCustomPanel) ? (numGatePanels + numCustomPanels > 0 ? 0 : 1000) : 0;
        const panelSizeScore = -Math.max(...finalPanels);
        const gapDiffPenalty = Math.abs(actualGap - targetGap) * 10;
        // HINGE-MATCH RULE: a gate layout whose standard panels don't form a 2-size,
        // 50mm-apart family with the hinge panel always loses to one that does.
        // 50000 dwarfs every other score component, so matched layouts win whenever
        // one exists; if none exists, the best unmatched layout still returns.
        const hingeMatchPenalty = (hingeMatchApplies && numVariablePanels > 0 && !hingeMatched) ? 50000 : 0;
        // Increased panel count penalty from 100 to 500 to strongly prefer fewer panels
        const score = hasRequiredComponents + totalPanels * 500 + panelSizeScore + gapDiffPenalty + hingeMatchPenalty;
        
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
                // Glass-to-glass: hardware gaps depend on gate position
                let numHardwareGaps: number;
                let remainingGapSpace: number;
                
                // Recalculate gate position to determine if at end
                const panelPosition = Math.max(0, Math.floor(gateConfig.position));
                const beforeCount = Math.min(panelPosition, variablePanels.length);
                const gateAtEnd = beforeCount >= variablePanels.length;
                
                if (gateConfig.position === 0 && !gateConfig.flipped) {
                  // Gate at start, not flipped: only hinge gap exists
                  numHardwareGaps = 1;
                  remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap;
                } else if (gateAtEnd && gateConfig.flipped) {
                  // Gate at end, flipped: only hinge gap exists (no latch gap to wall)
                  numHardwareGaps = 1;
                  remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap;
                } else {
                  // Gate in middle or edge with latch gap: both hinge and latch gaps
                  numHardwareGaps = 2;
                  remainingGapSpace = actualTotalGapWidth - gateConfig.hingeGap - gateConfig.latchGap;
                }
                
                const numRegularGaps = numGaps - numHardwareGaps;
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
                    // Gate first, then hinge: [... | latch gap | Gate | hinge gap | Hinge | ...]
                    // Gap at gateIndex is BETWEEN gate and hinge (hinge gap)
                    // Gap before gate is latch gap (only if gate is not at start)
                    if (i === gateIndex) {
                      // Gap after gate = hinge gap
                      gapsArray.push(gateConfig.hingeGap);
                    } else if (i === gateIndex - 1 && gateIndex > 0) {
                      // Gap before gate = latch gap (only if not at start)
                      gapsArray.push(gateConfig.latchGap);
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
          
          // Validate total layout doesn't exceed section length
          const totalGapsWidth = gapsArray.reduce((sum, gap) => sum + gap, 0);
          const totalLayoutWidth = actualTotalPanelWidth + totalGapsWidth + endGaps;
          
          if (totalLayoutWidth > spanLength) {
            continue; // Skip configurations that exceed section length
          }
          
          // Validate that middle gaps (excluding left and right end gaps) don't exceed 99mm
          // End gaps can be up to 150mm, but gaps between panels must be <= 99mm
          let gapsValid = true;
          for (let i = 0; i < gapsArray.length; i++) {
            const isEndGap = (i === 0 || i === gapsArray.length - 1);
            const maxAllowed = isEndGap ? MAX_END_GAP : MAX_GAP;
            
            if (gapsArray[i] > maxAllowed) {
              gapsValid = false;
              break;
            }
          }
          
          if (!gapsValid) {
            continue; // Skip configurations with gaps exceeding limits
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

  } // end strict→relaxed pass loop

  return bestLayout || {
    panels: [],
    gaps: [],
    totalPanelWidth: 0,
    totalGapWidth: 0,
    averageGap: 0,
  };
}

/**
 * Stock hinge-panel widths (12NH-* / 12NPH-* glass). The hinge panel is a STOCK item:
 * 600mm smallest, 1800mm largest, in these specific widths only — never an arbitrary
 * 50mm-grid value. Shared by the UI dropdown and the centred-gate solver.
 */
export const STOCK_HINGE_PANEL_SIZES = [600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];

/**
 * GATE CENTRE OVERRIDE (owner 2026-06-03) — places a glass-to-glass gate so its
 * CENTRE line sits at (or within ~25mm of) `centreFromLeft` mm from the left end of
 * the run (e.g. centring the gate on a path to the pool). The run is SPLIT at the
 * gate and each side is solved as an independent sub-run, then stitched together:
 *
 *   [left panels (+hinge)] [hinge/latch gap] [GATE] [latch/hinge gap] [right panels]
 *
 * Hinge side follows `flipped` (true = hinge LEFT of gate). The hinge panel is
 * ALWAYS a stock width (STOCK_HINGE_PANEL_SIZES):
 *  • match ON (autoHingePanel !== false): the solver tries each stock width and keeps
 *    the one whose side solves best (fewest panels, hinge closest to its neighbours).
 *  • match OFF: the user's manual hinge width is used as-is.
 *
 * MICRO-OFFSET SEARCH: fixed end gaps + hardware gaps mean a side's glass space can
 * fall off the 50mm panel grid (flipping swaps the 8mm hinge gap for the 9mm latch
 * gap, which alone breaks clean layouts). The solver may shift the centre by up to
 * ±25mm — invisible at fence scale — to keep both sides clean, and the UI readout
 * shows the ACHIEVED centre so the display stays truthful.
 *
 * Returns null only when no placement within ±200mm of the request is buildable —
 * callers then fall back to panel-index positioning so the calculator never breaks.
 */
export function calculateCentredGateLayout(params: {
  spanLength: number;
  leftEndGap: number;
  rightEndGap: number;
  desiredGap: number;
  maxPanelWidth: number;
  hasLeftRaked?: boolean;
  hasRightRaked?: boolean;
  gateConfig: {
    gateSize: number;
    hingePanelSize: number;
    flipped: boolean;
    hingeGap: number;
    latchGap: number;
    autoHingePanel?: boolean;
    centreFromLeft: number;
  };
  customPanelConfig?: {
    enabled: boolean;
    width: number;
    height: number;
    position: number;
  };
}): PanelLayout | null {
  const {
    spanLength,
    leftEndGap,
    rightEndGap,
    desiredGap,
    maxPanelWidth,
    hasLeftRaked = false,
    hasRightRaked = false,
    gateConfig,
    customPanelConfig,
  } = params;
  const { gateSize, hingePanelSize, flipped, hingeGap, latchGap, centreFromLeft } = gateConfig;
  const MIN_PANEL = 200;

  const hingeOnLeft = flipped; // flipped=true → hinge LEFT of gate
  const matchOn = gateConfig.autoHingePanel !== false;

  // Gap between the gate and each neighbour: hinge gap on the hinge side, latch gap
  // on the other.
  const leftInnerGap = hingeOnLeft ? hingeGap : latchGap;
  const rightInnerGap = hingeOnLeft ? latchGap : hingeGap;

  // ── Core solver for one (centre, hinge width) combination ──────────────────────
  const solveAt = (centre: number, hingeWidth: number): PanelLayout | null => {
    const gateLeftEdge = centre - gateSize / 2;
    const gateRightEdge = centre + gateSize / 2;

    if (gateLeftEdge < leftEndGap + MIN_PANEL || gateRightEdge > spanLength - rightEndGap - MIN_PANEL) {
      return null;
    }

    const solveSide = (side: "left" | "right"): { layout: PanelLayout; hingeIndex: number | null } | null => {
      const isHingeSide = (side === "left") === hingeOnLeft;
      const subSpan = side === "left" ? gateLeftEdge : spanLength - gateRightEdge;
      const subEndGaps = side === "left" ? leftEndGap + leftInnerGap : rightInnerGap + rightEndGap;
      const rakedLeft = side === "left" ? hasLeftRaked : false;
      const rakedRight = side === "right" ? hasRightRaked : false;
      // V1: a user custom panel joins the RIGHT sub-run (and never the hinge side —
      // the hinge itself occupies the fixed-panel slot there).
      const userCustom = side === "right" && customPanelConfig?.enabled ? customPanelConfig : undefined;

      if (isHingeSide) {
        // The hinge is ALWAYS a stock-width fixed panel at the gate-adjacent edge
        // (re-using the custom-panel mechanism, relabelled to "hinge" after solving).
        if (userCustom) return null;
        const hingeAsFixed = {
          enabled: true,
          width: hingeWidth,
          height: 1200,
          position: side === "left" ? 9999 : 0,
        };
        const layout = calculatePanelLayout(subSpan, subEndGaps, desiredGap, maxPanelWidth, rakedLeft, rakedRight, undefined, hingeAsFixed);
        if (!layout.panels.length) return null;
        const types = layout.panelTypes ?? [];
        const hingeIndex = types.findIndex((t, i) => t === "custom" && layout.panels[i] === hingeWidth);
        if (hingeIndex === -1) return null;
        return { layout, hingeIndex };
      }

      const layout = calculatePanelLayout(subSpan, subEndGaps, desiredGap, maxPanelWidth, rakedLeft, rakedRight, undefined, userCustom);
      if (!layout.panels.length) return null;
      return { layout, hingeIndex: null };
    };

    const left = solveSide("left");
    const right = solveSide("right");
    if (!left || !right) return null;

    // Relabel hinge panels and stitch the two sides around the gate.
    const leftTypes: PanelType[] = [...(left.layout.panelTypes ?? left.layout.panels.map(() => "standard" as PanelType))];
    const rightTypes: PanelType[] = [...(right.layout.panelTypes ?? right.layout.panels.map(() => "standard" as PanelType))];
    if (left.hingeIndex !== null) leftTypes[left.hingeIndex] = "hinge";
    if (right.hingeIndex !== null) rightTypes[right.hingeIndex] = "hinge";

    const panels = [...left.layout.panels, gateSize, ...right.layout.panels];
    const panelTypes: PanelType[] = [...leftTypes, "gate", ...rightTypes];
    const gaps = [...left.layout.gaps, leftInnerGap, rightInnerGap, ...right.layout.gaps];

    const totalPanelWidth = panels.reduce((s, p) => s + p, 0);
    const totalGapWidth = gaps.reduce((s, g) => s + g, 0);

    return {
      panels,
      gaps,
      totalPanelWidth,
      totalGapWidth,
      averageGap: gaps.length ? totalGapWidth / gaps.length : 0,
      panelTypes,
    };
  };

  // ── Candidates ──────────────────────────────────────────────────────────────────
  // Hinge widths: stock list (match ON, solver picks the best) or the manual width.
  const minStock = STOCK_HINGE_PANEL_SIZES[0];
  const maxStock = STOCK_HINGE_PANEL_SIZES[STOCK_HINGE_PANEL_SIZES.length - 1];
  const hingeCandidates = matchOn
    ? STOCK_HINGE_PANEL_SIZES
    : [Math.max(minStock, Math.min(maxStock, hingePanelSize))];

  // Clamp the requested centre into the physically viable range FIRST, so actions
  // like flipping near an end shift the gate the minimum necessary distance (to fit
  // the hinge panel) instead of failing and teleporting back to panel positioning.
  const hingeSideMin = matchOn ? minStock : Math.max(minStock, Math.min(maxStock, hingePanelSize));
  const latchSideMin = 450; // plain sub-run: two minimum panels + a gap (or one panel when grid-exact)
  const minViableCentre =
    leftEndGap + (hingeOnLeft ? hingeSideMin : latchSideMin) + leftInnerGap + gateSize / 2;
  const maxViableCentre =
    spanLength - rightEndGap - (hingeOnLeft ? latchSideMin : hingeSideMin) - rightInnerGap - gateSize / 2;
  if (minViableCentre > maxViableCentre) return null; // run too short for a centred gate at all
  const targetCentre = Math.max(minViableCentre, Math.min(maxViableCentre, centreFromLeft));

  // Centre offset candidates (the solver may shift the centre slightly; the scoring
  // prefers FEWER PANELS first, then the smallest shift, and the UI readout always
  // shows the achieved centre):
  //  1. 0 and the shifts that put each side's glass space onto the 50mm grid.
  //  2. The shifts (≤100mm) that let the hinge side be a SINGLE stock hinge panel —
  //     flipping a gate must never fragment one clean panel into two (owner, ss21-23).
  //     ±100mm is the worst-case distance to a stock hinge width (stock sizes are up
  //     to 200mm apart: 600 → 800 → 1000); clean glass beats exact position.
  const leftFixed = leftEndGap + leftInnerGap;
  const rightFixed = rightInnerGap + rightEndGap;
  const rL = (((targetCentre - gateSize / 2 - leftFixed) % 50) + 50) % 50;
  const rR = (((spanLength - (targetCentre + gateSize / 2) - rightFixed) % 50) + 50) % 50;
  const candidateOffsets: number[] = [0, -rL, 50 - rL, rR, rR - 50];

  const hingeSideSpace = hingeOnLeft
    ? targetCentre - gateSize / 2 - leftFixed
    : spanLength - (targetCentre + gateSize / 2) - rightFixed;
  for (const stockWidth of hingeCandidates) {
    const delta = stockWidth - hingeSideSpace;
    // Growing the hinge side moves the centre right when the hinge is on the left,
    // and left when the hinge is on the right.
    candidateOffsets.push(hingeOnLeft ? delta : -delta);
  }

  const rawOffsets = candidateOffsets.map((d) => Math.round(d));
  const microOffsets = rawOffsets.filter((d, i) => Math.abs(d) <= 100 && rawOffsets.indexOf(d) === i);

  // ── Search: best (offset, hinge width), scored by panel count → hinge match → offset ──
  let best: PanelLayout | null = null;
  let bestScore = Infinity;
  const consider = (offset: number) => {
    for (const hingeWidth of hingeCandidates) {
      const layout = solveAt(targetCentre + offset, hingeWidth);
      if (!layout || !layout.panelTypes) continue;
      // Score, in priority order (smaller = better):
      //  1. HINGE SIDE stays one piece — fragmenting it (1 panel → 2) is the cardinal
      //     sin (owner ss21-23).
      //  2. No slivers — glass under 500mm is heavily penalised (500mm is the
      //     accepted minimum; 350mm slabs are not).
      //  3. Smallest drift from the requested centre — an exact-fit 1500 hinge beats
      //     a 1600 hinge that needs 100mm of drift, and Move clicks always respond.
      //  4. Tie-breaks: fewer total pieces, then the larger hinge.
      const types = layout.panelTypes;
      const gateIdx = types.indexOf("gate");
      const hingeSidePieces = hingeOnLeft ? gateIdx : layout.panels.length - gateIdx - 1;
      const glassPanels = layout.panels.filter((_, i) => types[i] !== "gate");
      const sliverPenalty = glassPanels.reduce((s, p) => s + Math.max(0, 500 - p), 0);
      const score =
        hingeSidePieces * 1000000 +
        sliverPenalty * 1000 +
        Math.abs(offset) * 100 +
        layout.panels.length * 10 -
        hingeWidth / 100;
      if (score < bestScore) {
        bestScore = score;
        best = layout;
      }
    }
  };

  for (const offset of microOffsets) consider(offset);

  // Coarse fallback: nothing buildable within ±25mm — walk outward in 50mm steps so
  // the gate sticks near the request instead of teleporting back to panel positioning.
  if (!best) {
    for (const offset of [-50, 50, -100, 100, -150, 150, -200, 200]) {
      consider(offset);
      if (best) break;
    }
  }

  return best;
}

/**
 * Calculate BARR panel layout based on layout mode
 * BARR panels have fixed widths based on height and use posts with specific allowances
 * 
 * Structure: [POST]-[PANEL]-[POST]-[PANEL]-[POST]...
 * - Posts represent the physical post space (25mm or 50mm)
 * - For N elements (panels+gates), there are N+1 posts
 * - Total length = sum(panels) + sum(posts)
 * 
 * @param spanLength Total span length in mm
 * @param barrHeight BARR panel height (determines panel width and post allowance)
 * @param layoutMode Layout mode: full-panels-cut-end or equally-spaced
 * @param hasGate Whether gate is required
 * @param gateSize Gate panel width (975mm for BARR gates)
 * @param gatePosition Gate position (0 = start, 1 = end)
 * @returns Panel layout with BARR-specific configurations
 */
export function calculateBarrPanelLayout(
  spanLength: number,
  barrHeight: "1000mm" | "1200mm" | "1800mm",
  layoutMode: "full-panels-cut-end" | "equally-spaced",
  hasGate: boolean = false,
  gateSize: number = 1000,
  gatePosition: number = 0
): PanelLayout {
  const BARR_SPECS = {
    "1000mm": { panelWidth: 1733, postAllowance: 25 },
    "1200mm": { panelWidth: 2205, postAllowance: 25 },
    "1800mm": { panelWidth: 1969, postAllowance: 25 },
  };

  const specs = BARR_SPECS[barrHeight];
  const standardPanelWidth = specs.panelWidth;
  const post = specs.postAllowance;
  const MIN_PANEL = 200;
  const GATE_ALLOWANCE = 25; // Aluminium gate allowance
  // gateSize = clear opening (1000mm), actual gate panel = gateSize - GATE_ALLOWANCE

  // BARR structure: [POST]-[ELEMENT]-[POST]-[ELEMENT]-[POST]...
  // For N elements, need N+1 posts
  // Panels butt directly together with no gaps (post allowance = 0)
  // Gates have side stiles and butt directly against panels/posts
  
  if (layoutMode === "full-panels-cut-end") {
    // Mode 1: Full standard panels + cut end piece
    
    if (hasGate) {
      // With gate: all elements use same post allowance for gaps
      // Structure: [post]-elements...-[post] where elements = panels + gate
      const maxFullPanels = Math.floor((spanLength - gateSize - 2 * post) / (standardPanelWidth + post));
      
      if (maxFullPanels < 0) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      // Check if we can fit gate + full panels + cut panel
      // All elements (gate + panels) use same post allowance
      // Structure: [post]-[elements...]-[post], where N elements = N+1 posts
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      // Find the right number of full panels so cut panel is valid (≥ MIN_PANEL)
      while (numFullPanels >= 0) {
        // Total elements = gate + numFullPanels + cutPanel = numFullPanels + 2
        // Total posts = elements + 1 = numFullPanels + 3
        const totalPosts = numFullPanels + 3;
        const spaceUsed = gateSize + numFullPanels * standardPanelWidth + totalPosts * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build all panels first (full + cut)
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numFullPanels; i++) {
        allPanels.push({ width: standardPanelWidth, type: "standard" });
      }
      allPanels.push({ width: cutWidth, type: "standard" });
      
      // Insert gate at specified position
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      // Build final layout with posts and gaps
      // All gaps use post allowance (gate and panels treated equally)
      for (let i = 0; i < allPanels.length; i++) {
        const panel = allPanels[i];
        
        // All gaps use post allowance
        gaps.push(post);
        panels.push(panel.width);
        panelTypes.push(panel.type);
      }
      
      // End gap
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    } else {
      // Without gate: [post]-[panels...]-[post]
      // Try fitting full panels: maxFullPanels × (stdWidth + post) + post ≤ span
      const maxFullPanels = Math.floor((spanLength - post) / (standardPanelWidth + post));
      
      if (maxFullPanels === 0) {
        // Only one panel fits: [post]-[panel]-[post]
        const singlePanelWidth = spanLength - 2 * post;
        if (singlePanelWidth < MIN_PANEL) {
          return {
            panels: [],
            gaps: [],
            totalPanelWidth: 0,
            totalGapWidth: 0,
            averageGap: 0,
          };
        }
        
        return {
          panels: [singlePanelWidth],
          gaps: [post, post], // Start and end posts
          totalPanelWidth: singlePanelWidth,
          totalGapWidth: 2 * post,
          averageGap: post,
          panelTypes: ["standard"],
        };
      }
      
      // Check if we can fit full panels + cut panel
      // With cut: (maxFullPanels + 1) elements needs (maxFullPanels + 2) posts
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      // Find the right number of full panels so cut panel is valid (≥ MIN_PANEL)
      while (numFullPanels >= 0) {
        const postsWithCut = numFullPanels + 2;
        const spaceUsed = numFullPanels * standardPanelWidth + postsWithCut * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build layout: numFullPanels + cut panel
      gaps.push(post); // Start post
      for (let i = 0; i < numFullPanels; i++) {
        panels.push(standardPanelWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      panels.push(cutWidth);
      panelTypes.push("standard");
      gaps.push(post); // End post
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    }
  } else {
    // Mode 2: Equally spaced (all panels cut to same width)
    // Maximum panel width constraint (cannot exceed standard panel width)
    const MAX_PANEL_WIDTH = standardPanelWidth;
    
    let numPanels: number;
    
    if (hasGate) {
      // With gate: Calculate minimum panels accounting for gate space
      // Total = gate + N*panelWidth + (N+2)*post
      // panelWidth = (spanLength - gate - (N+2)*post) / N
      // We want: panelWidth <= MAX_PANEL_WIDTH
      // So: (spanLength - gate - (N+2)*post) / N <= MAX_PANEL_WIDTH
      // spanLength - gate - (N+2)*post <= N*MAX_PANEL_WIDTH
      // spanLength - gate - 2*post <= N*(MAX_PANEL_WIDTH + post)
      // N >= (spanLength - gate - 2*post) / (MAX_PANEL_WIDTH + post)
      const minPanels = Math.ceil((spanLength - gateSize - 2 * post) / (MAX_PANEL_WIDTH + post));
      numPanels = Math.max(1, minPanels);
      // With gate: [post]-[gate]-[post]-[panel]-[post]-[panel]-[post]...
      // Elements = gate + numPanels, Posts = elements + 1
      let numElements = 1 + numPanels;
      let numPosts = numElements + 1;
      let totalPostSpace = numPosts * post;
      let availableForPanels = spanLength - totalPostSpace - gateSize;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      // If panels would exceed max width, increase number of panels
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numElements = 1 + numPanels;
        numPosts = numElements + 1;
        totalPostSpace = numPosts * post;
        availableForPanels = spanLength - totalPostSpace - gateSize;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        // Try with fewer panels
        const reducedPanels = Math.max(1, numPanels - 1);
        const reducedElements = 1 + reducedPanels;
        const reducedPosts = reducedElements + 1;
        const reducedPostSpace = reducedPosts * post;
        const reducedAvailable = spanLength - reducedPostSpace - gateSize;
        const reducedWidth = Math.floor(reducedAvailable / reducedPanels);
        
        if (reducedWidth < MIN_PANEL) {
          return {
            panels: [],
            gaps: [],
            totalPanelWidth: 0,
            totalGapWidth: 0,
            averageGap: 0,
          };
        }
        
        // Build all equal panels first
        const allPanels: { width: number; type: PanelType }[] = [];
        for (let i = 0; i < reducedPanels; i++) {
          allPanels.push({ width: reducedWidth, type: "standard" });
        }
        
        // Insert gate at specified position
        const clampedPosition = Math.min(gatePosition, allPanels.length);
        allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
        
        const panels: number[] = [];
        const gaps: number[] = [];
        const panelTypes: PanelType[] = [];
        
        // Build final layout - all gaps use post allowance
        for (let i = 0; i < allPanels.length; i++) {
          const panel = allPanels[i];
          
          gaps.push(post);
          panels.push(panel.width);
          panelTypes.push(panel.type);
        }
        
        // End gap
        gaps.push(post);
        
        return {
          panels,
          gaps,
          totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
          totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
          averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
          panelTypes,
        };
      }
      
      // Build all equal panels first
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numPanels; i++) {
        allPanels.push({ width: equalWidth, type: "standard" });
      }
      
      // Insert gate at specified position
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build final layout - all gaps use post allowance
      for (let i = 0; i < allPanels.length; i++) {
        const panel = allPanels[i];
        
        gaps.push(post);
        panels.push(panel.width);
        panelTypes.push(panel.type);
      }
      
      // End gap
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    } else {
      // Without gate: Calculate minimum panels for no-gate scenario
      // For N panels: total = N*panelWidth + (N+1)*post
      // panelWidth = (spanLength - (N+1)*post) / N
      // We want: panelWidth <= MAX_PANEL_WIDTH
      // N >= (spanLength - post) / (MAX_PANEL_WIDTH + post)
      const minPanels = Math.ceil((spanLength - post) / (MAX_PANEL_WIDTH + post));
      numPanels = Math.max(1, minPanels);
      
      // Without gate: [post]-[panel]-[post]-[panel]-[post]...
      // Elements = numPanels, Posts = numPanels + 1
      let numPosts = numPanels + 1;
      let totalPostSpace = numPosts * post;
      let availableForPanels = spanLength - totalPostSpace;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      // If panels would exceed max width, increase number of panels
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numPosts = numPanels + 1;
        totalPostSpace = numPosts * post;
        availableForPanels = spanLength - totalPostSpace;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post]; // Start post
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numPanels; i++) {
        panels.push(equalWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    }
  }
}

/**
 * Calculate Blade panel layout based on layout mode
 * Blade panels have fixed widths based on height and use 50x50mm posts with 50mm allowance
 * 
 * Structure: [POST]-[PANEL]-[POST]-[PANEL]-[POST]...
 * - Posts represent the physical post space (50mm)
 * - For N elements (panels+gates), there are N+1 posts
 * - Total length = sum(panels) + sum(posts)
 * 
 * @param spanLength Total span length in mm
 * @param bladeHeight Blade panel height (determines panel width)
 * @param layoutMode Layout mode: full-panels-cut-end or equally-spaced
 * @param hasGate Whether gate is required
 * @param gateSize Gate panel width (975mm for Blade gates)
 * @param gatePosition Gate position (0 = start, 1 = end)
 * @returns Panel layout with Blade-specific configurations
 */
export function calculateBladePanelLayout(
  spanLength: number,
  bladeHeight: "1000mm" | "1200mm",
  layoutMode: "full-panels-cut-end" | "equally-spaced",
  hasGate: boolean = false,
  gateSize: number = 1000,
  gatePosition: number = 0
): PanelLayout {
  const BLADE_SPECS = {
    "1000mm": { panelWidth: 1700, postAllowance: 50 },
    "1200mm": { panelWidth: 2200, postAllowance: 50 },
  };

  const specs = BLADE_SPECS[bladeHeight];
  const standardPanelWidth = specs.panelWidth;
  const post = specs.postAllowance;
  const MIN_PANEL = 200;
  const GATE_ALLOWANCE = 25; // Aluminium gate allowance
  // gateSize = clear opening (1000mm), actual gate panel = gateSize - GATE_ALLOWANCE
  
  if (layoutMode === "full-panels-cut-end") {
    // Mode 1: Full standard panels + cut end piece
    
    if (hasGate) {
      // With gate: all elements use same post allowance for gaps
      // Structure: [post]-elements...-[post] where elements = panels + gate
      const maxFullPanels = Math.floor((spanLength - gateSize - 2 * post) / (standardPanelWidth + post));
      
      if (maxFullPanels < 0) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      // Check if we can fit gate + full panels + cut panel
      // All elements (gate + panels) use same post allowance
      // Structure: [post]-[elements...]-[post], where N elements = N+1 posts
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      // Find the right number of full panels so cut panel is valid (≥ MIN_PANEL)
      while (numFullPanels >= 0) {
        // Total elements = gate + numFullPanels + cutPanel = numFullPanels + 2
        // Total posts = elements + 1 = numFullPanels + 3
        const totalPosts = numFullPanels + 3;
        const spaceUsed = gateSize + numFullPanels * standardPanelWidth + totalPosts * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build all panels first (full + cut)
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numFullPanels; i++) {
        allPanels.push({ width: standardPanelWidth, type: "standard" });
      }
      allPanels.push({ width: cutWidth, type: "standard" });
      
      // Insert gate at specified position
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      // Build final layout with posts and gaps
      // All gaps use post allowance (gate and panels treated equally)
      for (let i = 0; i < allPanels.length; i++) {
        const panel = allPanels[i];
        
        // All gaps use post allowance
        gaps.push(post);
        panels.push(panel.width);
        panelTypes.push(panel.type);
      }
      
      // End gap
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    } else {
      // Without gate: [post]-[panels...]-[post]
      // Try fitting full panels: maxFullPanels × (stdWidth + post) + post ≤ span
      const maxFullPanels = Math.floor((spanLength - post) / (standardPanelWidth + post));
      
      if (maxFullPanels === 0) {
        // Only one panel fits: [post]-[panel]-[post]
        const singlePanelWidth = spanLength - 2 * post;
        if (singlePanelWidth < MIN_PANEL) {
          return {
            panels: [],
            gaps: [],
            totalPanelWidth: 0,
            totalGapWidth: 0,
            averageGap: 0,
          };
        }
        
        return {
          panels: [singlePanelWidth],
          gaps: [post, post], // Start and end posts
          totalPanelWidth: singlePanelWidth,
          totalGapWidth: 2 * post,
          averageGap: post,
          panelTypes: ["standard"],
        };
      }
      
      // Check if we can fit full panels + cut panel
      // With cut: (maxFullPanels + 1) elements needs (maxFullPanels + 2) posts
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      // Find the right number of full panels so cut panel is valid (≥ MIN_PANEL)
      while (numFullPanels >= 0) {
        const postsWithCut = numFullPanels + 2;
        const spaceUsed = numFullPanels * standardPanelWidth + postsWithCut * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build layout: numFullPanels + cut panel
      gaps.push(post); // Start post
      for (let i = 0; i < numFullPanels; i++) {
        panels.push(standardPanelWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      panels.push(cutWidth);
      panelTypes.push("standard");
      gaps.push(post); // End post
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    }
  } else {
    // Mode 2: Equally spaced (all panels cut to same width)
    // Maximum panel width constraint (cannot exceed standard panel width)
    const MAX_PANEL_WIDTH = standardPanelWidth;
    
    let numPanels: number;
    
    if (hasGate) {
      // With gate: Calculate minimum panels accounting for gate space
      // Total = gate + N*panelWidth + (N+2)*post
      // panelWidth = (spanLength - gate - (N+2)*post) / N
      // We want: panelWidth <= MAX_PANEL_WIDTH
      // So: (spanLength - gate - (N+2)*post) / N <= MAX_PANEL_WIDTH
      // spanLength - gate - (N+2)*post <= N*MAX_PANEL_WIDTH
      // spanLength - gate - 2*post <= N*(MAX_PANEL_WIDTH + post)
      // N >= (spanLength - gate - 2*post) / (MAX_PANEL_WIDTH + post)
      const minPanels = Math.ceil((spanLength - gateSize - 2 * post) / (MAX_PANEL_WIDTH + post));
      numPanels = Math.max(1, minPanels);
      // With gate: [post]-[gate]-[post]-[panel]-[post]-[panel]-[post]...
      // Elements = gate + numPanels, Posts = elements + 1
      let numElements = 1 + numPanels;
      let numPosts = numElements + 1;
      let totalPostSpace = numPosts * post;
      let availableForPanels = spanLength - totalPostSpace - gateSize;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      // If panels would exceed max width, increase number of panels
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numElements = 1 + numPanels;
        numPosts = numElements + 1;
        totalPostSpace = numPosts * post;
        availableForPanels = spanLength - totalPostSpace - gateSize;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        // Try with fewer panels
        const reducedPanels = Math.max(1, numPanels - 1);
        const reducedElements = 1 + reducedPanels;
        const reducedPosts = reducedElements + 1;
        const reducedPostSpace = reducedPosts * post;
        const reducedAvailable = spanLength - reducedPostSpace - gateSize;
        const reducedWidth = Math.floor(reducedAvailable / reducedPanels);
        
        if (reducedWidth < MIN_PANEL) {
          return {
            panels: [],
            gaps: [],
            totalPanelWidth: 0,
            totalGapWidth: 0,
            averageGap: 0,
          };
        }
        
        // Build all equal panels first
        const allPanels: { width: number; type: PanelType }[] = [];
        for (let i = 0; i < reducedPanels; i++) {
          allPanels.push({ width: reducedWidth, type: "standard" });
        }
        
        // Insert gate at specified position
        const clampedPosition = Math.min(gatePosition, allPanels.length);
        allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
        
        const panels: number[] = [];
        const gaps: number[] = [];
        const panelTypes: PanelType[] = [];
        
        // Build final layout - all gaps use post allowance
        for (let i = 0; i < allPanels.length; i++) {
          const panel = allPanels[i];
          
          gaps.push(post);
          panels.push(panel.width);
          panelTypes.push(panel.type);
        }
        
        // End gap
        gaps.push(post);
        
        return {
          panels,
          gaps,
          totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
          totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
          averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
          panelTypes,
        };
      }
      
      // Build all equal panels first
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numPanels; i++) {
        allPanels.push({ width: equalWidth, type: "standard" });
      }
      
      // Insert gate at specified position
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      // Build final layout - all gaps use post allowance
      for (let i = 0; i < allPanels.length; i++) {
        const panel = allPanels[i];
        
        gaps.push(post);
        panels.push(panel.width);
        panelTypes.push(panel.type);
      }
      
      // End gap
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    } else {
      // Without gate: Calculate minimum panels for no-gate scenario
      // For N panels: total = N*panelWidth + (N+1)*post
      // panelWidth = (spanLength - (N+1)*post) / N
      // We want: panelWidth <= MAX_PANEL_WIDTH
      // N >= (spanLength - post) / (MAX_PANEL_WIDTH + post)
      const minPanels = Math.ceil((spanLength - post) / (MAX_PANEL_WIDTH + post));
      numPanels = Math.max(1, minPanels);
      
      // Without gate: [post]-[panel]-[post]-[panel]-[post]...
      // Elements = numPanels, Posts = numPanels + 1
      let numPosts = numPanels + 1;
      let totalPostSpace = numPosts * post;
      let availableForPanels = spanLength - totalPostSpace;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      // If panels would exceed max width, increase number of panels
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numPosts = numPanels + 1;
        totalPostSpace = numPosts * post;
        availableForPanels = spanLength - totalPostSpace;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return {
          panels: [],
          gaps: [],
          totalPanelWidth: 0,
          totalGapWidth: 0,
          averageGap: 0,
        };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post]; // Start post
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numPanels; i++) {
        panels.push(equalWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0,
        panelTypes,
      };
    }
  }
}

/**
 * Calculate Tubular Flat Top panel layout based on layout mode
 * 
 * TUBULAR FLAT TOP SPECIFICATIONS:
 * - Panel widths: 2400mm, 2450mm, 3000mm (configurable)
 * - Post size: 50mm square posts
 * - Post allowance: 50mm
 * - Minimum panel width: 200mm
 * - Gate size: 975mm
 * 
 * N+1 POST STRUCTURE:
 * - N panels require N+1 posts (one post before first panel, one after each panel)
 * - Example: [post]-[panel]-[post]-[panel]-[post]
 * - All gaps use 50mm post allowance (gates and panels treated equally)
 * 
 * LAYOUT CALCULATION:
 * - Total length = sum(panels) + sum(posts)
 * 
 * @param spanLength Total span length in mm
 * @param tubularHeight Tubular panel height (1200mm or 900mm)
 * @param tubularPanelWidth Selected panel width (2400mm, 2450mm, or 3000mm)
 * @param layoutMode Layout mode: full-panels-cut-end or equally-spaced
 * @param hasGate Whether gate is required
 * @param gateSize Gate panel width (975mm for Tubular gates)
 * @param gatePosition Gate position (0 = start, 1+ = after panel N)
 * @returns Panel layout with Tubular-specific configurations
 */
export function calculateTubularPanelLayout(
  spanLength: number,
  tubularHeight: "1200mm" | "900mm",
  tubularPanelWidth: "2450mm" | "3000mm",
  layoutMode: "full-panels-cut-end" | "equally-spaced",
  hasGate: boolean = false,
  gateSize: number = 1000,
  gatePosition: number = 0
): PanelLayout {
  const TUBULAR_WIDTHS = {
    "2450mm": 2450,
    "3000mm": 3000,
  };
  
  const standardPanelWidth = TUBULAR_WIDTHS[tubularPanelWidth];
  const post = 50; // 50mm square posts reduce span
  const MIN_PANEL = 200;
  const GATE_ALLOWANCE = 25; // Aluminium gate allowance
  // gateSize = clear opening (1000mm), actual gate panel = gateSize - GATE_ALLOWANCE
  
  if (layoutMode === "full-panels-cut-end") {
    // Mode 1: Full panels + cut end
    if (hasGate) {
      // With gate: [post]-[gate]-[post]-[panels...]-[post]
      const maxFullPanels = Math.floor((spanLength - gateSize - 2 * post) / (standardPanelWidth + post));
      
      if (maxFullPanels === 0) {
        const singlePanelWidth = spanLength - gateSize - 3 * post;
        if (singlePanelWidth < MIN_PANEL) {
          return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
        }
        
        return {
          panels: [gateSize, singlePanelWidth],
          gaps: [post, post, post],
          totalPanelWidth: gateSize + singlePanelWidth,
          totalGapWidth: 3 * post,
          averageGap: post,
          panelTypes: ["gate", "standard"],
        };
      }
      
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      while (numFullPanels >= 0) {
        const postsWithCut = numFullPanels + 3;
        const spaceUsed = gateSize + numFullPanels * standardPanelWidth + postsWithCut * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numFullPanels; i++) {
        allPanels.push({ width: standardPanelWidth, type: "standard" });
      }
      allPanels.push({ width: cutWidth, type: "standard" });
      
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      const panels: number[] = [];
      const gaps: number[] = [];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < allPanels.length; i++) {
        gaps.push(post);
        panels.push(allPanels[i].width);
        panelTypes.push(allPanels[i].type);
      }
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    } else {
      // Without gate
      const maxFullPanels = Math.floor((spanLength - post) / (standardPanelWidth + post));
      
      if (maxFullPanels === 0) {
        const singlePanelWidth = spanLength - 2 * post;
        if (singlePanelWidth < MIN_PANEL) {
          return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
        }
        return {
          panels: [singlePanelWidth],
          gaps: [post, post],
          totalPanelWidth: singlePanelWidth,
          totalGapWidth: 2 * post,
          averageGap: post,
          panelTypes: ["standard"],
        };
      }
      
      let numFullPanels = maxFullPanels;
      let cutWidth = 0;
      
      while (numFullPanels >= 0) {
        const postsWithCut = numFullPanels + 2;
        const spaceUsed = numFullPanels * standardPanelWidth + postsWithCut * post;
        cutWidth = spanLength - spaceUsed;
        
        if (cutWidth >= MIN_PANEL) break;
        numFullPanels--;
      }
      
      if (numFullPanels < 0 || cutWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numFullPanels; i++) {
        panels.push(standardPanelWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      panels.push(cutWidth);
      panelTypes.push("standard");
      gaps.push(post);
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    }
  } else {
    // Mode 2: Equally spaced
    const MAX_PANEL_WIDTH = standardPanelWidth;
    
    if (hasGate) {
      const minPanels = Math.ceil((spanLength - gateSize - 2 * post) / (MAX_PANEL_WIDTH + post));
      let numPanels = Math.max(1, minPanels);
      
      let numElements = 1 + numPanels;
      let numPosts = numElements + 1;
      let availableForPanels = spanLength - numPosts * post - gateSize;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numElements = 1 + numPanels;
        numPosts = numElements + 1;
        availableForPanels = spanLength - numPosts * post - gateSize;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numPanels; i++) {
        allPanels.push({ width: equalWidth, type: "standard" });
      }
      
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < allPanels.length; i++) {
        panels.push(allPanels[i].width);
        panelTypes.push(allPanels[i].type);
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    } else {
      const minPanels = Math.ceil((spanLength - post) / (MAX_PANEL_WIDTH + post));
      let numPanels = Math.max(1, minPanels);
      
      let numPosts = numPanels + 1;
      let availableForPanels = spanLength - numPosts * post;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numPosts = numPanels + 1;
        availableForPanels = spanLength - numPosts * post;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numPanels; i++) {
        panels.push(equalWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    }
  }
}

/**
 * Calculate panel layout for Hamptons PVC fencing
 * Supports multiple styles with 2388mm standard panels and 127mm square posts
 * 
 * @param spanLength Total span length in mm
 * @param hamptonsStyle Style variant (full-privacy, combo, vertical-paling, semi-privacy, 3rail)
 * @param layoutMode Panel layout mode (full-panels-cut-end or equally-spaced)
 * @param hasGate Whether a gate is required
 * @param gateSize Gate panel width (default 1000mm)
 * @param gatePosition Gate position (0 = start, 1+ = after panel N)
 * @returns Panel layout with Hamptons PVC-specific configurations
 */
export function calculateHamptonsPanelLayout(
  spanLength: number,
  hamptonsStyle: "full-privacy" | "combo" | "vertical-paling" | "semi-privacy" | "3rail",
  layoutMode: "full-panels-cut-end" | "equally-spaced",
  hasGate: boolean = false,
  gateSize: number = 1000,
  gatePosition: number = 0
): PanelLayout {
  const HAMPTONS_SPECS = {
    "full-privacy": { panelWidth: 2388, postAllowance: 127 },
    "combo": { panelWidth: 2388, postAllowance: 127 },
    "vertical-paling": { panelWidth: 2388, postAllowance: 127 },
    "semi-privacy": { panelWidth: 2388, postAllowance: 127 },
    "3rail": { panelWidth: 2388, postAllowance: 127 },
  };

  const specs = HAMPTONS_SPECS[hamptonsStyle];
  const standardPanelWidth = specs.panelWidth;
  const post = specs.postAllowance;
  const MIN_PANEL = 200;
  const MAX_PANEL_WIDTH = 2388;

  if (layoutMode === "full-panels-cut-end") {
    // Mode 1: Full standard panels + cut end piece
    
    if (hasGate) {
      // With gate: Reserve space for gate first, then fill with panels
      const availableForPanels = spanLength - gateSize - (2 * post); // Start + end posts
      const numFullPanels = Math.floor(availableForPanels / (standardPanelWidth + post));
      
      if (numFullPanels < 0) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const usedByFullPanels = numFullPanels * standardPanelWidth + (numFullPanels > 0 ? numFullPanels * post : 0);
      const remaining = availableForPanels - usedByFullPanels;
      const cutWidth = remaining;
      
      if (cutWidth > 0 && cutWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      // Build panel array
      const allPanels: { width: number; type: PanelType }[] = [];
      
      for (let i = 0; i < numFullPanels; i++) {
        allPanels.push({ width: standardPanelWidth, type: "standard" });
      }
      
      if (cutWidth >= MIN_PANEL) {
        allPanels.push({ width: cutWidth, type: "standard" });
      }
      
      // Insert gate at specified position
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      // Build final layout with posts and gaps
      const panels: number[] = [];
      const gaps: number[] = [post]; // Leading post
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < allPanels.length; i++) {
        panels.push(allPanels[i].width);
        panelTypes.push(allPanels[i].type);
        gaps.push(post); // Post after each panel
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    } else {
      // No gate: Full panels + cut end
      const numFullPanels = Math.floor((spanLength - post) / (standardPanelWidth + post));
      
      if (numFullPanels < 0) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const usedByFullPanels = numFullPanels * standardPanelWidth + numFullPanels * post;
      const remaining = spanLength - post - usedByFullPanels;
      const cutWidth = remaining;
      
      if (cutWidth > 0 && cutWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numFullPanels; i++) {
        panels.push(standardPanelWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      if (cutWidth >= MIN_PANEL) {
        panels.push(cutWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    }
  } else {
    // Mode 2: Equally spaced panels (all cut to same size)
    
    if (hasGate) {
      // With gate: equal panels + gate
      const minPanels = Math.ceil((spanLength - gateSize - post) / (MAX_PANEL_WIDTH + post));
      let numPanels = Math.max(1, minPanels);
      
      let numElements = 1 + numPanels;
      let numPosts = numElements + 1;
      let availableForPanels = spanLength - numPosts * post - gateSize;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numElements = 1 + numPanels;
        numPosts = numElements + 1;
        availableForPanels = spanLength - numPosts * post - gateSize;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const allPanels: { width: number; type: PanelType }[] = [];
      for (let i = 0; i < numPanels; i++) {
        allPanels.push({ width: equalWidth, type: "standard" });
      }
      
      const clampedPosition = Math.min(gatePosition, allPanels.length);
      allPanels.splice(clampedPosition, 0, { width: gateSize, type: "gate" });
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < allPanels.length; i++) {
        panels.push(allPanels[i].width);
        panelTypes.push(allPanels[i].type);
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    } else {
      const minPanels = Math.ceil((spanLength - post) / (MAX_PANEL_WIDTH + post));
      let numPanels = Math.max(1, minPanels);
      
      let numPosts = numPanels + 1;
      let availableForPanels = spanLength - numPosts * post;
      let equalWidth = Math.floor(availableForPanels / numPanels);
      
      while (equalWidth > MAX_PANEL_WIDTH && numPanels < 20) {
        numPanels++;
        numPosts = numPanels + 1;
        availableForPanels = spanLength - numPosts * post;
        equalWidth = Math.floor(availableForPanels / numPanels);
      }
      
      if (equalWidth < MIN_PANEL) {
        return { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 };
      }
      
      const panels: number[] = [];
      const gaps: number[] = [post];
      const panelTypes: PanelType[] = [];
      
      for (let i = 0; i < numPanels; i++) {
        panels.push(equalWidth);
        panelTypes.push("standard");
        gaps.push(post);
      }
      
      return {
        panels,
        gaps,
        totalPanelWidth: panels.reduce((sum, p) => sum + p, 0),
        totalGapWidth: gaps.reduce((sum, g) => sum + g, 0),
        averageGap: post,
        panelTypes,
      };
    }
  }
}
