/**
 * Fence segment composition with strict invariants
 * Ensures gates are present when required and length conservation holds
 */

import { calculatePanelLayout } from '../panelCalculations';
import { PanelLayout } from '../schema';
import { buildSegmentSequence, validateSegmentComposition, Segment } from './gaps';
import { equalizePanels, findFeasibleN, equalizePanelsExact } from './equalize';
import {
  computeFixedLeftRight,
  type GateConfig as AccountingGateConfig,
} from './lengthAccounting';

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
  residualEndGapMm?: number;  // Computed end gap to close the section exactly
  varianceEndGapMm?: number;  // Variance from requested end gap
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
  
  let leftPanels: number[] = [];
  let rightPanels: number[] = [];
  let panelLayout: PanelLayout;
  let actualEndGapMm = endGapMm; // Use requested end gap (NOT residual)
  
  if (gateConfig?.required) {
    // GATE REQUIRED PATH - STRICT LENGTH CONSERVATION
    trace.push({
      step: 'gate-required',
      data: {
        mountMode: gateConfig.mountMode,
        hingeSide: gateConfig.hingeSide,
        gateWidthMm: gateConfig.gateWidthMm,
        hingePanelWidthMm: gateConfig.hingePanelWidthMm,
      },
    });
    
    // Step 1: Compute fixed left/right sums (excluding between gaps)
    const accountingGateConfig: AccountingGateConfig = {
      required: true,
      mountMode: gateConfig.mountMode === 'WALL' ? 'POST' : gateConfig.mountMode, // Treat WALL same as POST
      hingeSide: gateConfig.hingeSide,
      gateWidthMm: gateConfig.gateWidthMm,
      hingePanelWidthMm: gateConfig.hingePanelWidthMm,
      hingeGapMm: gateConfig.hingeGapMm,
      latchGapMm: gateConfig.latchGapMm,
      position: gateConfig.position,
    };
    
    const fixedLR = computeFixedLeftRight(accountingGateConfig, {
      startGapMm,
      endGapMm,
      betweenGapMm,
      runLengthMm,
    });
    
    const F = fixedLR.fixedLeftMm + fixedLR.fixedRightMm;
    const R = runLengthMm;
    
    trace.push({
      step: 'fixed-left-right',
      data: { fixedLR, F, R },
    });
    
    // Step 2: Try different end gaps (requested ± 15mm) to find a solution
    // With 50mm grid steps, exact requested end gap might not allow ±1mm precision
    const endGapAttempts = [
      endGapMm,           // Requested
      endGapMm - 5,
      endGapMm + 5,
      endGapMm - 10,
      endGapMm + 10,
      endGapMm - 15,
      endGapMm + 15,
    ];
    
    let bestSolution: {
      panelWidths: number[];
      N: number;
      actualEndGap: number;
      delta: number;
    } | null = null;
    
    for (const tryEndGap of endGapAttempts) {
      if (tryEndGap < 0) continue; // Skip negative end gaps
      
      // Calculate target space for panels + between gaps
      // Total = fixedLeftMm + panels + (N-1)*betweenGaps + fixedRightMm + tryEndGap
      const panelsAndGapsTarget = R - fixedLR.fixedLeftMm - fixedLR.fixedRightMm - tryEndGap;
      
      if (panelsAndGapsTarget < 0) continue;
      
      trace.push({
        step: `try-endgap-${tryEndGap}`,
        data: { R, F, tryEndGap, requestedEndGap: endGapMm, panelsAndGapsTarget },
      });
    
    // Step 3: Find N by trying different panel counts
    // For each N: panelsTarget = panelsAndGapsTarget - (N-1)*betweenGap
    let panelWidths: number[] | null = null;
    let N: number = 0;
    let lastError: string | null = null;
    
    const N_min = Math.ceil(panelsAndGapsTarget / maxPanelMm);
    const N_max = Math.floor(panelsAndGapsTarget / minPanelMm);
    
    if (N_min > N_max) {
      return {
        success: false,
        segments: [],
        panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
        validation: {
          sumMm: 0,
          expectedMm: runLengthMm,
          deltaMm: runLengthMm,
          gatePresent: true,
          lengthConserved: false,
        },
        errors: [{
          code: 'UNREACHABLE',
          message: `Cannot fit panels in ${panelsAndGapsTarget}mm with constraints [${minPanelMm}-${maxPanelMm}]mm`,
          details: { panelsAndGapsTarget, minPanelMm, maxPanelMm, N_min, N_max },
        }],
        trace,
      };
    }
    
    // Try different N values, and for each N try micro-adjusting the panels target
    // to find a solution that uses the requested end gap
    for (let tryN = N_min; tryN <= N_max; tryN++) {
      const betweenGapsTotal = (tryN - 1) * betweenGapMm;
      const basePanelsTarget = panelsAndGapsTarget - betweenGapsTotal;
      
      if (basePanelsTarget < tryN * minPanelMm || basePanelsTarget > tryN * maxPanelMm) {
        continue;
      }
      
      // Try adjusting panels target to find solution within ±1mm of runLength
      // Start with exact target, then try ±50mm, ±100mm, etc.
      const adjustments = [0, -50, 50, -100, 100, -150, 150, -200, 200];
      
      for (const adj of adjustments) {
        const panelsTarget = basePanelsTarget + adj;
        
        if (panelsTarget < tryN * minPanelMm || panelsTarget > tryN * maxPanelMm) {
          continue;
        }
        
        const result = equalizePanelsExact(panelsTarget, tryN, 50, minPanelMm, maxPanelMm);
        
        if ('widthsMm' in result) {
          // Verify total length with REQUESTED end gap
          // Note: fixedLR.fixedLeftMm already includes startGap
          // Total = fixedLeftMm + panels + betweenGaps + fixedRightMm + endGap
          const panelSum = result.widthsMm.reduce((a, b) => a + b, 0);
          const totalWithRequestedGap = fixedLR.fixedLeftMm + panelSum + betweenGapsTotal + fixedLR.fixedRightMm + endGapMm;
          const deltaFromRun = totalWithRequestedGap - R;
          
          trace.push({
            step: `try-N-${tryN}-adj-${adj}`,
            data: {
              N: tryN,
              betweenGapsTotal,
              basePanelsTarget,
              adjustment: adj,
              panelsTarget,
              panelSum,
              totalWithRequestedGap,
              requestedEndGap: endGapMm,
              deltaFromRun,
              accepted: Math.abs(deltaFromRun) <= 1,
            },
          });
          
          if (Math.abs(deltaFromRun) <= 1) {
            panelWidths = result.widthsMm;
            N = tryN;
            actualEndGapMm = endGapMm; // Use requested end gap
            break;
          }
        } else {
          lastError = result.error;
        }
      }
      
      if (panelWidths) break; // Found solution, exit N loop
    }
    
    if (!panelWidths) {
      return {
        success: false,
        segments: [],
        panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
        validation: {
          sumMm: F,
          expectedMm: runLengthMm,
          deltaMm: runLengthMm - F,
          gatePresent: true,
          lengthConserved: false,
        },
        errors: [{
          code: 'UNREACHABLE',
          message: `No panel count in range [${N_min}-${N_max}] can hit target on 50mm grid`,
          details: { panelsAndGapsTarget, lastError },
        }],
        trace,
      };
    }
    
    trace.push({
      step: 'panel-count-solution',
      data: { N, panelWidths },
    });
    
    // Step 3: Split panels into left/right based on gate position
    const gatePosition = gateConfig.position !== undefined ? gateConfig.position : 0.5;
    const leftPanelCount = Math.floor(N * gatePosition);
    const rightPanelCount = N - leftPanelCount;
    
    leftPanels = panelWidths.slice(0, leftPanelCount);
    rightPanels = panelWidths.slice(leftPanelCount);
    
    trace.push({
      step: 'panel-split',
      data: { gatePosition, leftPanelCount, rightPanelCount, leftPanels, rightPanels },
    });
    
    // Step 4: Use requested end gap (panels were sized to compensate)
    const panelSum = panelWidths.reduce((sum, w) => sum + w, 0);
    const betweenGapSum = (N - 1) * betweenGapMm;
    const hingePanelSum = fixedLR.hingePanelWidthMm || 0;
    const gateElementSum = fixedLR.gateWidthMm! + fixedLR.hingeGapMm + fixedLR.latchGapMm;
    
    // actualEndGapMm is set to requested endGapMm
    // No residual or variance - panels were forced to make requested gap work
    
    trace.push({
      step: 'requested-end-gap',
      data: {
        R,
        startGapMm,
        panelSum,
        betweenGapSum,
        hingePanelSum,
        gateElementSum,
        endGapMm,
        note: 'Using requested end gap - panels forced to compensate',
      },
    });
    
    // Create mock panel layout for compatibility
    const allPanels = [...leftPanels, ...(hingePanelSum > 0 ? [hingePanelSum] : []), ...rightPanels];
    const totalGapWidth = betweenGapSum + fixedLR.hingeGapMm + fixedLR.latchGapMm;
    
    panelLayout = {
      panels: allPanels,
      gaps: Array(N - 1).fill(betweenGapMm),
      totalPanelWidth: panelSum + hingePanelSum,
      totalGapWidth,
      averageGap: betweenGapMm,
    };
    
  } else {
    // NO GATE PATH - use existing panel calculation
    const effectiveLengthMm = runLengthMm - startGapMm - endGapMm;
    
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
  
  // Build segment sequence (use actualEndGapMm which is the requested end gap)
  const segments = buildSegmentSequence({
    startGapMm,
    endGapMm: actualEndGapMm,
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
  
  // 3. STRICT Length conservation check (±1mm for gates, ±2mm for no-gate)
  let sumMm = 0;
  for (const segment of segments) {
    if (segment.widthMm) {
      sumMm += segment.widthMm;
    }
  }
  
  const deltaMm = sumMm - runLengthMm; // Signed delta
  const absDeltaMm = Math.abs(deltaMm);
  
  // Stricter tolerance for gate scenarios (±1mm)
  const tolerance = gateConfig?.required ? 1 : 2;
  const lengthConserved = absDeltaMm <= tolerance;
  
  if (!lengthConserved) {
    // HARD FAIL for length invariant violation
    errors.push({
      code: 'LENGTH_INVARIANT',
      message: `Length not conserved: expected ${runLengthMm}mm, got ${sumMm}mm (Δ${deltaMm}mm > ±${tolerance}mm)`,
      details: {
        expected: runLengthMm,
        got: sumMm,
        delta: deltaMm,
        absDelta: absDeltaMm,
        tolerance,
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
      absDeltaMm,
      tolerance,
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
      deltaMm: absDeltaMm, // Return absolute delta
      gatePresent: gateConfig?.required ? gatePresent : true, // N/A if gate not required
      lengthConserved,
    },
    actualEndGapMm: gateConfig?.required ? actualEndGapMm : undefined,
    errors: errors.length > 0 ? errors : undefined,
    trace,
  };
}
