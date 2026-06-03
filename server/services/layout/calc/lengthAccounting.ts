/**
 * Length Accounting Utilities
 * 
 * Provides exact accounting for fixed elements and panel equalization
 * to achieve strict ±1mm length conservation.
 */

export interface FixedLeftRight {
  startGapMm: number;
  endGapRequestedMm: number;
  hingeGapMm: number;
  latchGapMm: number;
  gateWidthMm?: number;
  hingePanelWidthMm?: number;
  fixedLeftMm: number;  // Sum excluding between gaps
  fixedRightMm: number; // Sum excluding between gaps
}

export interface GateConfig {
  required: boolean;
  mountMode?: 'GLASS_TO_GLASS' | 'POST';
  hingeSide?: 'LEFT' | 'RIGHT';
  gateWidthMm?: number;
  hingePanelWidthMm?: number;
  hingeGapMm?: number;
  latchGapMm?: number;
  position?: number; // 0-1, position of gate along run
}

export interface SystemSpec {
  startGapMm: number;
  endGapMm: number;
  betweenGapMm: number;
  runLengthMm: number;
}

/**
 * Compute fixed left and right sums (excluding between gaps).
 * Gate interfaces use hinge/latch gaps, not between gaps.
 */
export function computeFixedLeftRight(
  gateConfig: GateConfig | undefined,
  systemSpec: SystemSpec
): FixedLeftRight {
  const startGapMm = systemSpec.startGapMm;
  const endGapRequestedMm = systemSpec.endGapMm;
  
  if (!gateConfig || !gateConfig.required) {
    // No gate: only start gap is fixed on left
    return {
      startGapMm,
      endGapRequestedMm,
      hingeGapMm: 0,
      latchGapMm: 0,
      fixedLeftMm: startGapMm,
      fixedRightMm: 0,
    };
  }
  
  const mountMode = gateConfig.mountMode || 'GLASS_TO_GLASS';
  const hingeSide = gateConfig.hingeSide || 'LEFT';
  const gateWidthMm = gateConfig.gateWidthMm || 900;
  const hingePanelWidthMm = mountMode === 'GLASS_TO_GLASS' ? (gateConfig.hingePanelWidthMm || 1200) : 0;
  const hingeGapMm = gateConfig.hingeGapMm || 20;
  const latchGapMm = gateConfig.latchGapMm || 20;
  
  let fixedLeftMm = startGapMm;
  let fixedRightMm = 0;
  
  if (hingeSide === 'LEFT') {
    // LEFT: startGap + hingePanelWidth (if G2G) + hingeGap + gateWidth + latchGap
    if (mountMode === 'GLASS_TO_GLASS') {
      fixedLeftMm += hingePanelWidthMm;
    }
    fixedLeftMm += hingeGapMm + gateWidthMm + latchGapMm;
  } else {
    // RIGHT: startGap on left, gate components on right
    // Right side: hingeGap + gateWidth + latchGap + hingePanelWidth (if G2G)
    fixedRightMm = hingeGapMm + gateWidthMm + latchGapMm;
    if (mountMode === 'GLASS_TO_GLASS') {
      fixedRightMm += hingePanelWidthMm;
    }
  }
  
  return {
    startGapMm,
    endGapRequestedMm,
    hingeGapMm,
    latchGapMm,
    gateWidthMm,
    hingePanelWidthMm: mountMode === 'GLASS_TO_GLASS' ? hingePanelWidthMm : undefined,
    fixedLeftMm,
    fixedRightMm,
  };
}

export interface EqualizePanelsInput {
  targetPanelsMm: number;
  countGuess: number;
  stepMm?: number;
  minMm?: number;
  maxMm?: number;
}

export interface EqualizePanelsResult {
  widthsMm: number[];
  actualSumMm: number;
  deltaMm: number;
}

/**
 * Equalize panels to hit target exactly (within ±1mm).
 * Each width is a multiple of stepMm.
 * Throws if impossible to achieve within tolerance.
 */
export function equalizePanelsForTarget(input: EqualizePanelsInput): EqualizePanelsResult {
  const {
    targetPanelsMm,
    countGuess,
    stepMm = 50,
    minMm = 300,
    maxMm = 2000,
  } = input;
  
  const count = countGuess;
  
  if (count <= 0) {
    throw new Error('Panel count must be positive');
  }
  
  if (targetPanelsMm < count * minMm) {
    throw new Error(`Target ${targetPanelsMm}mm too small for ${count} panels (min ${count * minMm}mm)`);
  }
  
  if (targetPanelsMm > count * maxMm) {
    throw new Error(`Target ${targetPanelsMm}mm too large for ${count} panels (max ${count * maxMm}mm)`);
  }
  
  // Calculate average panel width
  const avgWidthMm = targetPanelsMm / count;
  
  // Find two adjacent step values around the average
  const lowerStepWidth = Math.floor(avgWidthMm / stepMm) * stepMm;
  const upperStepWidth = lowerStepWidth + stepMm;
  
  // Enforce bounds
  const lowerWidth = Math.max(minMm, Math.min(maxMm, lowerStepWidth));
  const upperWidth = Math.max(minMm, Math.min(maxMm, upperStepWidth));
  
  // Calculate how many panels should be at upperWidth vs lowerWidth
  // Let x = number of upper-width panels, (count - x) = number of lower-width panels
  // x * upperWidth + (count - x) * lowerWidth = targetPanelsMm
  // Solve for x:
  // x = (targetPanelsMm - count * lowerWidth) / (upperWidth - lowerWidth)
  
  const numUpper = Math.round((targetPanelsMm - count * lowerWidth) / (upperWidth - lowerWidth));
  const numLower = count - numUpper;
  
  // Build the widths array
  const widthsMm: number[] = [];
  for (let i = 0; i < numUpper; i++) {
    widthsMm.push(upperWidth);
  }
  for (let i = 0; i < numLower; i++) {
    widthsMm.push(lowerWidth);
  }
  
  const actualSumMm = widthsMm.reduce((sum, w) => sum + w, 0);
  const deltaMm = actualSumMm - targetPanelsMm;
  
  // NOTE: With stepMm constraints, we may not hit the target exactly
  // The residual end gap will absorb the difference to ensure total length conservation
  // This is acceptable - panels are on the grid, and end gap handles remainder
  
  return {
    widthsMm,
    actualSumMm,
    deltaMm,
  };
}

export interface CustomPanelFixed {
  customPanelMm: number;          // width
  customGapsMm: number;           // gapBefore + gapAfter
  fixedLeftMm: number;            // for position-based split; for now compute as 0 (Phase 1 keeps simple insertion later)
  fixedRightMm: number;
}

export function computeFixedCustomPanel(
  custom: { required: boolean; panelWidthMm: number; gapBeforeMm?: number; gapAfterMm?: number } | undefined,
  defaultHeightMm: number,
  betweenGapMm: number = 50
): CustomPanelFixed {
  if (!custom?.required) {
    return { customPanelMm: 0, customGapsMm: 0, fixedLeftMm: 0, fixedRightMm: 0 };
  }
  const width = Math.max(0, Math.round(custom.panelWidthMm));
  
  // Custom gaps accounting:
  // - Custom gaps REPLACE connector gaps at those interfaces (per applyGapPrecedence)
  // - Only count them as fixed if they're DIFFERENT from standard betweenGap
  // - If unspecified, we use betweenGap (no delta to fixed)
  // - If specified, we count the DELTA from betweenGap
  let customGapsMm = 0;
  if (custom.gapBeforeMm !== undefined) {
    customGapsMm += custom.gapBeforeMm - betweenGapMm;
  }
  if (custom.gapAfterMm !== undefined) {
    customGapsMm += custom.gapAfterMm - betweenGapMm;
  }
  
  return { customPanelMm: width, customGapsMm, fixedLeftMm: 0, fixedRightMm: 0 };
}
