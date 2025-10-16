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
    const totalFixedSpace = gateElementSpace + hingePanelSpace;
    
    trace.push({
      step: 'fixed-space-calculation',
      data: {
        gateElementSpace,
        hingePanelSpace,
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
    
    // Determine gate position
    const gatePosition = gateConfig.position !== undefined ? gateConfig.position : 0.5;
    
    // Calculate space for left and right panels
    // For now, use simple split based on position
    // Left side gets panels, right side gets remainder (equalized)
    const leftSpace = remainingSpace * gatePosition;
    const rightSpace = remainingSpace * (1 - gatePosition);
    
    trace.push({
      step: 'space-distribution',
      data: {
        remainingSpace,
        gatePosition,
        leftSpace,
        rightSpace,
      },
    });
    
    // Equalize left panels (if any space)
    if (leftSpace >= minPanelMm) {
      const leftResult = equalizePanels({
        targetMm: leftSpace,
        stepMm: 50,
        maxPanelMm,
        minPanelMm,
      });
      
      if (leftResult.widthsMm) {
        leftPanels = leftResult.widthsMm;
      } else {
        // Fallback: single panel
        const rounded = Math.round(leftSpace / 50) * 50;
        if (rounded >= minPanelMm && rounded <= maxPanelMm) {
          leftPanels = [rounded];
        }
      }
    }
    
    // Equalize right panels (remainder space)
    if (rightSpace >= minPanelMm) {
      const rightResult = equalizePanels({
        targetMm: rightSpace,
        stepMm: 50,
        maxPanelMm,
        minPanelMm,
      });
      
      if (rightResult.widthsMm) {
        rightPanels = rightResult.widthsMm;
      } else {
        // Fallback: single panel
        const rounded = Math.round(rightSpace / 50) * 50;
        if (rounded >= minPanelMm && rounded <= maxPanelMm) {
          rightPanels = [rounded];
        }
      }
    }
    
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
