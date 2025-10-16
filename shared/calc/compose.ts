/**
 * Fence segment composition with strict invariants
 * Ensures gates are present when required and length conservation holds
 */

import { calculatePanelLayout } from '../panelCalculations';
import { PanelLayout } from '../schema';
import { buildSegmentSequence, validateSegmentComposition, Segment } from './gaps';
import { equalizePanels } from './equalize';

export interface CompositionInput {
  runLengthMm: number;
  startGapMm: number;
  endGapMm: number;
  betweenGapMm: number;
  maxPanelMm: number;
  minPanelMm: number;
  gateConfig?: {
    required: boolean;
    gateWidthMm: number;
    hingePanelWidthMm?: number;
    hingeGapMm: number;
    latchGapMm: number;
    mountMode: 'GLASS_TO_GLASS' | 'POST' | 'WALL';
    hingeSide: 'LEFT' | 'RIGHT';
    position?: number; // 0-1, where to place gate (0 = left, 1 = right)
  };
}

export interface CompositionResult {
  success: boolean;
  segments: Segment[];
  panelLayout: PanelLayout;
  validation: {
    sumMm: number;
    expectedMm: number;
    deltaMm: number;
    gatePresent: boolean;
    lengthConserved: boolean;
  };
  errors?: Array<{
    code: string;
    message: string;
    details?: any;
  }>;
  trace?: Array<{
    step: string;
    data: any;
  }>;
}

/**
 * Compose fence segments with strict invariant checking
 * Order: startGap → left panels → hinge/post → gate → latch → right panels (equalized) → endGap
 */
export function composeFenceSegments(input: CompositionInput): CompositionResult {
  const trace: Array<{ step: string; data: any }> = [];
  const errors: Array<{ code: string; message: string; details?: any }> = [];
  
  const {
    runLengthMm,
    startGapMm,
    endGapMm,
    betweenGapMm,
    maxPanelMm,
    minPanelMm,
    gateConfig,
  } = input;
  
  trace.push({
    step: 'input-validation',
    data: { runLengthMm, startGapMm, endGapMm, betweenGapMm, gateRequired: gateConfig?.required },
  });
  
  // Calculate effective length after end gaps
  const effectiveLengthMm = runLengthMm - startGapMm - endGapMm;
  
  if (effectiveLengthMm <= 0) {
    return {
      success: false,
      segments: [],
      panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
      validation: {
        sumMm: 0,
        expectedMm: runLengthMm,
        deltaMm: runLengthMm,
        gatePresent: false,
        lengthConserved: false,
      },
      errors: [{ code: 'INVALID_LENGTH', message: 'Effective length must be positive' }],
      trace,
    };
  }
  
  let leftPanels: number[] = [];
  let rightPanels: number[] = [];
  let panelLayout: PanelLayout;
  
  if (gateConfig?.required) {
    // GATE REQUIRED PATH
    trace.push({
      step: 'gate-required',
      data: {
        mountMode: gateConfig.mountMode,
        hingeSide: gateConfig.hingeSide,
        gateWidthMm: gateConfig.gateWidthMm,
        hingePanelWidthMm: gateConfig.hingePanelWidthMm,
      },
    });
    
    // Calculate fixed space taken by gate components
    const { gateWidthMm, hingePanelWidthMm, hingeGapMm, latchGapMm, mountMode } = gateConfig;
    
    // Fixed gate elements
    const gateElementSpace = gateWidthMm + hingeGapMm + latchGapMm;
    const hingePanelSpace = mountMode === 'GLASS_TO_GLASS' ? (hingePanelWidthMm || 0) : 0;
    
    // IMPORTANT: We need to reserve space for the between gap that appears between
    // left panels and hinge panel (if there are left panels)
    const gatePosition = gateConfig.position !== undefined ? gateConfig.position : 0.5;
    const hasLeftPanels = gatePosition > 0;
    const leftBetweenGapReserve = hasLeftPanels ? betweenGapMm : 0;
    
    const totalFixedSpace = gateElementSpace + hingePanelSpace + leftBetweenGapReserve;
    
    trace.push({
      step: 'fixed-space-calculation',
      data: {
        gateElementSpace,
        hingePanelSpace,
        leftBetweenGapReserve,
        totalFixedSpace,
        effectiveLengthMm,
      },
    });
    
    // Calculate remaining space for variable panels
    const remainingSpace = effectiveLengthMm - totalFixedSpace;
    
    if (remainingSpace < 0) {
      return {
        success: false,
        segments: [],
        panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
        validation: {
          sumMm: totalFixedSpace + startGapMm + endGapMm,
          expectedMm: runLengthMm,
          deltaMm: Math.abs(runLengthMm - (totalFixedSpace + startGapMm + endGapMm)),
          gatePresent: true,
          lengthConserved: false,
        },
        errors: [{
          code: 'INSUFFICIENT_SPACE',
          message: 'Not enough space for gate components',
          details: { remainingSpace, totalFixedSpace, effectiveLengthMm },
        }],
        trace,
      };
    }
    
    // Calculate space for left and right panels
    // (gatePosition already determined above in fixed space calculation)
    // IMPORTANT: To avoid rounding errors, calculate left space and then
    // make right space the exact remainder
    const leftSpaceTarget = remainingSpace * gatePosition;
    
    // Distribute left panels and get actual space used
    let leftActualSpace = 0;
    
    trace.push({
      step: 'space-distribution',
      data: {
        remainingSpace,
        gatePosition,
        leftSpaceTarget,
      },
    });
    
    // Helper function to distribute space into panels
    // IMPORTANT: spaceMm should be the TOTAL space including between gaps within this group
    const distributePanels = (spaceMm: number, label: string): number[] => {
      const panels: number[] = [];
      
      // Round to nearest 50mm
      const roundedSpace = Math.round(spaceMm / 50) * 50;
      
      if (roundedSpace < minPanelMm) {
        return panels; // Not enough space
      }
      
      // We need to account for between gaps within this panel group
      // If we have N panels, we'll have (N-1) between gaps
      // So: panelSpace + (N-1) * betweenGapMm = roundedSpace
      // We need to find N such that panels fit
      
      // Try different numbers of panels to find best fit
      let bestPanels: number[] = [];
      let bestDelta = Infinity;
      
      for (let numPanels = 1; numPanels <= Math.ceil(roundedSpace / minPanelMm); numPanels++) {
        const gapSpace = (numPanels - 1) * betweenGapMm;
        const panelSpace = roundedSpace - gapSpace;
        
        if (panelSpace < numPanels * minPanelMm) {
          break; // Not enough space for this many panels
        }
        
        // Try to equalize this panel space across numPanels
        const result = equalizePanels({
          targetMm: panelSpace,
          stepMm: 50,
          maxPanelMm,
          minPanelMm,
        });
        
        if (result.widthsMm && result.widthsMm.length === numPanels) {
          const actualTotal = result.widthsMm.reduce((s, p) => s + p, 0) + gapSpace;
          const delta = Math.abs(actualTotal - roundedSpace);
          
          if (delta < bestDelta) {
            bestDelta = delta;
            bestPanels = result.widthsMm;
          }
          
          if (delta === 0) break; // Perfect match
        }
      }
      
      // If no solution found via equalize, try simple fallback
      if (bestPanels.length === 0) {
        const numPanels = Math.ceil(roundedSpace / maxPanelMm);
        const gapSpace = (numPanels - 1) * betweenGapMm;
        const panelSpace = roundedSpace - gapSpace;
        const avgWidth = panelSpace / numPanels;
        const baseWidth = Math.round(avgWidth / 50) * 50;
        
        if (baseWidth >= minPanelMm && baseWidth <= maxPanelMm) {
          for (let i = 0; i < numPanels; i++) {
            bestPanels.push(baseWidth);
          }
        }
      }
      
      trace.push({
        step: `${label}-panel-distribution`,
        data: {
          spaceMm,
          roundedSpace,
          panels: bestPanels,
          totalWithGaps: bestPanels.reduce((s, p) => s + p, 0) + (bestPanels.length - 1) * betweenGapMm,
        },
      });
      
      return bestPanels;
    };
    
    // Distribute left panels
    if (leftSpaceTarget >= minPanelMm) {
      leftPanels = distributePanels(leftSpaceTarget, 'left');
      leftActualSpace = leftPanels.reduce((sum, p) => sum + p, 0);
    }
    
    // Right panels get the EXACT remainder to avoid rounding errors
    const rightSpaceExact = remainingSpace - leftActualSpace;
    
    if (rightSpaceExact >= minPanelMm) {
      rightPanels = distributePanels(rightSpaceExact, 'right');
    }
    
    trace.push({
      step: 'final-panel-distribution',
      data: {
        leftActualSpace,
        rightSpaceExact,
        leftPanels,
        rightPanels,
      },
    });
    
    trace.push({
      step: 'panel-equalization',
      data: {
        leftPanels,
        rightPanels,
        leftSum: leftPanels.reduce((sum, p) => sum + p, 0),
        rightSum: rightPanels.reduce((sum, p) => sum + p, 0),
      },
    });
    
    // Create mock panel layout for compatibility
    const allPanels = [...leftPanels, ...(hingePanelSpace > 0 ? [hingePanelWidthMm!] : []), ...rightPanels];
    const panelCount = allPanels.length;
    const betweenGapCount = Math.max(0, panelCount - 1);
    const totalGapWidth = betweenGapCount * betweenGapMm + hingeGapMm + latchGapMm;
    
    panelLayout = {
      panels: allPanels,
      gaps: Array(betweenGapCount).fill(betweenGapMm),
      totalPanelWidth: allPanels.reduce((sum, p) => sum + p, 0),
      totalGapWidth,
      averageGap: betweenGapCount > 0 ? betweenGapMm : 0,
    };
    
  } else {
    // NO GATE PATH - use existing panel calculation
    trace.push({
      step: 'no-gate-path',
      data: { effectiveLengthMm },
    });
    
    panelLayout = calculatePanelLayout(
      runLengthMm,
      startGapMm + endGapMm,
      betweenGapMm,
      maxPanelMm,
      false, // hasLeftRaked
      false, // hasRightRaked
      undefined, // no gate config
      undefined  // no custom panel
    );
    
    // All panels go to "right" side for consistency
    rightPanels = panelLayout.panels;
  }
  
  // Build segment sequence
  const segments = buildSegmentSequence({
    startGapMm,
    endGapMm,
    betweenGapMm,
    leftPanels,
    rightPanels,
    gateConfig,
  });
  
  trace.push({
    step: 'segments-built',
    data: {
      segmentCount: segments.length,
      kinds: segments.map(s => s.kind),
    },
  });
  
  // STRICT INVARIANT CHECKING
  
  // 1. Gate presence check
  const gateSegments = segments.filter(s => s.kind === 'gate');
  const gatePresent = gateSegments.length === 1;
  
  if (gateConfig?.required && !gatePresent) {
    errors.push({
      code: 'GATE_REQUIRED_MISSING',
      message: 'Gate is required but no gate segment found',
      details: { gateSegments: gateSegments.length, segments },
    });
  }
  
  if (gateConfig?.required && gateSegments.length > 1) {
    errors.push({
      code: 'MULTIPLE_GATES',
      message: 'Only one gate segment allowed',
      details: { gateSegments: gateSegments.length },
    });
  }
  
  // 2. Mount mode validation
  if (gateConfig?.required && gateConfig.mountMode === 'GLASS_TO_GLASS') {
    const hingePanelSegments = segments.filter(s => s.kind === 'hinge-panel');
    if (hingePanelSegments.length === 0) {
      errors.push({
        code: 'HINGE_PANEL_MISSING',
        message: 'Glass-to-glass mount requires hinge panel',
        details: { mountMode: gateConfig.mountMode },
      });
    }
  }
  
  if (gateConfig?.required && (gateConfig.mountMode === 'POST' || gateConfig.mountMode === 'WALL')) {
    const postSegments = segments.filter(s => s.kind === 'post-anchor');
    // Post anchors are allowed but not strictly required (they have 0 width)
  }
  
  // 3. Length conservation check
  let sumMm = 0;
  for (const segment of segments) {
    if (segment.widthMm) {
      sumMm += segment.widthMm;
    }
  }
  
  const deltaMm = Math.abs(sumMm - runLengthMm);
  const lengthConserved = deltaMm <= 2;
  
  if (!lengthConserved) {
    errors.push({
      code: 'LENGTH_INVARIANT',
      message: `Length not conserved: expected ${runLengthMm}mm, got ${sumMm}mm (Δ${deltaMm}mm)`,
      details: {
        expected: runLengthMm,
        got: sumMm,
        delta: deltaMm,
        segments: segments.map(s => ({ kind: s.kind, widthMm: s.widthMm })),
      },
    });
  }
  
  trace.push({
    step: 'invariant-check',
    data: {
      sumMm,
      runLengthMm,
      deltaMm,
      gatePresent,
      lengthConserved,
      ok: errors.length === 0,
    },
  });
  
  const success = errors.length === 0;
  
  return {
    success,
    segments,
    panelLayout,
    validation: {
      sumMm,
      expectedMm: runLengthMm,
      deltaMm,
      gatePresent: gateConfig?.required ? gatePresent : true, // N/A if gate not required
      lengthConserved,
    },
    errors: errors.length > 0 ? errors : undefined,
    trace,
  };
}
