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
  computeFixedCustomPanel,
  type GateConfig as AccountingGateConfig,
} from './lengthAccounting';

export type EndGapPolicy = 'LOCKED_STRICT' | 'LOCKED_OR_RESIDUAL';

export interface CustomPanelConfig {
  required: boolean;
  panelWidthMm: number;
  panelHeightMm?: number;          // defaults to defaultHeight
  position?: number;               // 0..1 fraction along the run; if omitted, place centrally in remainder
  gapBeforeMm?: number;            // optional additional gap before this custom panel
  gapAfterMm?: number;             // optional additional gap after this custom panel
}

export interface CompositionInput {
  runLengthMm: number;
  startGapMm: number;
  endGapMm: number;
  betweenGapMm: number;
  maxPanelMm: number;
  minPanelMm: number;
  endGapPolicy?: EndGapPolicy; // Default: LOCKED_OR_RESIDUAL
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
  customPanelConfig?: CustomPanelConfig;
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
  actualEndGapMm?: number;    // Actual end gap used (may differ from requested)
  residualEndGapMm?: number;  // Computed end gap to close the section exactly
  varianceEndGapMm?: number;  // Variance from requested end gap  
  endGapPolicy?: EndGapPolicy; // Policy used
  lockedTried?: boolean;      // Whether locked approach was attempted
  residualUsed?: boolean;     // Whether residual fallback was used
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
    customPanelConfig,
  } = input;
  
  trace.push({
    step: 'input-validation',
    data: { runLengthMm, startGapMm, endGapMm, betweenGapMm, gateRequired: gateConfig?.required },
  });
  
  let leftPanels: number[] = [];
  let rightPanels: number[] = [];
  let panelLayout: PanelLayout;
  let actualEndGapMm = endGapMm; // Use requested end gap (NOT residual)
  
  // Policy tracking variables (for gate path)
  let policy: EndGapPolicy = 'LOCKED_OR_RESIDUAL';
  let lockedTried = false;
  let residualUsed = false;
  let varianceEndGapMm = 0;
  
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
    
    // Step 2: Determine end gap policy
    policy = process.env.STRICT_END_GAP === '1' 
      ? 'LOCKED_STRICT' 
      : (input.endGapPolicy ?? 'LOCKED_OR_RESIDUAL');
    
    let panelWidths: number[] | null = null;
    let N: number = 0;
    
    trace.push({
      step: 'end-gap-policy',
      data: { policy, requestedEndGap: endGapMm, strictEnvFlag: process.env.STRICT_END_GAP },
    });
    
    // Step 3: Try LOCKED mode (use requested end gap)
    const targetPanelsLocked = R - F - endGapMm;
    
    if (targetPanelsLocked < 0) {
      return {
        success: false,
        segments: [],
        panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
        validation: {
          sumMm: F + endGapMm,
          expectedMm: runLengthMm,
          deltaMm: runLengthMm - (F + endGapMm),
          gatePresent: true,
          lengthConserved: false,
        },
        errors: [{
          code: 'UNREACHABLE',
          message: `Fixed components exceed section length`,
          details: { reason: 'fixed_exceeds_section', F, endGapMm, R, targetPanelsLocked },
        }],
        trace,
      };
    }
    
    lockedTried = true;
    
    // Find feasible N for locked mode - account for between gaps
    const N_min_locked = Math.ceil(targetPanelsLocked / maxPanelMm);
    const N_max_locked = Math.floor(targetPanelsLocked / minPanelMm);
    
    trace.push({
      step: 'locked-attempt',
      data: { targetPanelsLocked, N_min_locked, N_max_locked },
    });
    
    // Try each N to find one that works
    for (let N_try = N_min_locked; N_try <= N_max_locked; N_try++) {
      const panelsTarget = targetPanelsLocked - (N_try - 1) * betweenGapMm;
      
      if (panelsTarget < N_try * minPanelMm || panelsTarget > N_try * maxPanelMm) {
        continue;
      }
      
      const result = equalizePanelsExact(panelsTarget, N_try, 50, minPanelMm, maxPanelMm);
      
      if ('widthsMm' in result) {
        // Verify total with requested end gap
        const panelSum = result.widthsMm.reduce((a, b) => a + b, 0);
        const betweenGapsTotal = (N_try - 1) * betweenGapMm;
        const total = startGapMm + panelSum + betweenGapsTotal + 
                     fixedLR.hingeGapMm + (fixedLR.gateWidthMm || 0) + fixedLR.latchGapMm + 
                     (fixedLR.hingePanelWidthMm || 0) + endGapMm;
        
        if (Math.abs(total - R) <= 1) {
          panelWidths = result.widthsMm;
          N = N_try;
          actualEndGapMm = endGapMm;
          varianceEndGapMm = 0;
          residualUsed = false;
          
          trace.push({
            step: 'locked-success',
            data: { N, panelSum, total, delta: total - R },
          });
          break;
        }
      }
    }
    
    // Step 4: If LOCKED failed, try RESIDUAL mode (if policy allows)
    if (!panelWidths) {
      if (policy === 'LOCKED_STRICT') {
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
            message: `No 50mm grid solution exists for locked end gap ${endGapMm}mm`,
            details: { reason: 'no_50mm_solution_for_locked_end_gap', endGapMm, targetPanelsLocked },
          }],
          trace,
        };
      }
      
      // RESIDUAL fallback: ignore end gap, fit panels, compute residual
      trace.push({
        step: 'residual-fallback',
        data: { reason: 'locked_failed', policy },
      });
      
      // Round DOWN to nearest 50mm to ensure panels on grid don't exceed space
      const provisionalRaw = Math.max(0, R - F);
      const provisionalTarget = Math.floor(provisionalRaw / 50) * 50;
      
      trace.push({
        step: 'residual-provisional-target',
        data: { provisionalRaw, provisionalTarget, roundedDown: provisionalRaw - provisionalTarget },
      });
      
      const N_min_residual = Math.ceil(provisionalTarget / maxPanelMm);
      const N_max_residual = Math.floor(provisionalTarget / minPanelMm);
      
      let residualSolution: { N: number; panelWidths: number[]; residualEndGap: number } | null = null;
      
      // Try each N to find one that gives non-negative residual end gap
      for (let N_try = N_min_residual; N_try <= N_max_residual; N_try++) {
        const panelsTargetResidual = provisionalTarget - (N_try - 1) * betweenGapMm;
        
        if (panelsTargetResidual < N_try * minPanelMm || panelsTargetResidual > N_try * maxPanelMm) {
          continue;
        }
        
        const resultResidual = equalizePanelsExact(panelsTargetResidual, N_try, 50, minPanelMm, maxPanelMm);
        
        if ('widthsMm' in resultResidual) {
          // Compute residual end gap
          // F already includes all fixed components (start, hinge panel, hinge gap, gate, latch gap)
          const panelSum = resultResidual.widthsMm.reduce((a, b) => a + b, 0);
          const betweenGapsTotal = (N_try - 1) * betweenGapMm;
          const residualEndGap = R - F - panelSum - betweenGapsTotal;
          
          trace.push({
            step: `residual-try-N-${N_try}`,
            data: { N_try, panelsTargetResidual, panelSum, betweenGapsTotal, residualEndGap, R, F },
          });
          
          if (residualEndGap >= 0) {
            residualSolution = { N: N_try, panelWidths: resultResidual.widthsMm, residualEndGap };
            break;
          }
        }
      }
      
      if (!residualSolution) {
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
            message: `Cannot achieve non-negative residual end gap`,
            details: { reason: 'residual_negative', provisionalTarget },
          }],
          trace,
        };
      }
      
      panelWidths = residualSolution.panelWidths;
      N = residualSolution.N;
      actualEndGapMm = residualSolution.residualEndGap;
      varianceEndGapMm = residualSolution.residualEndGap - endGapMm;
      residualUsed = true;
      
      trace.push({
        step: 'residual-success',
        data: { N, panelSum: panelWidths.reduce((a,b) => a+b, 0), residualEndGap: residualSolution.residualEndGap, varianceEndGapMm },
      });
    }
    
    // Step 5: Split panels into left/right based on gate position
    const gatePositionRaw = gateConfig.position !== undefined ? gateConfig.position : 0.5;
    
    // Normalize position if it's an integer (0-N range) to 0-1 range
    // If position > 1, assume it's an index and normalize by N
    const gatePosition = gatePositionRaw > 1 ? gatePositionRaw / N : gatePositionRaw;
    
    // Calculate panel split, ensuring at least 1 panel on right if gate not at very end
    let leftPanelCount = Math.floor(N * gatePosition);
    
    // Clamp to ensure gate is always surrounded by panels (at least 1 on each side when possible)
    // Exception: allow all panels on one side only if N=1 or position is exactly 0 or 1
    if (N > 1 && gatePosition > 0 && gatePosition < 1) {
      leftPanelCount = Math.max(0, Math.min(leftPanelCount, N - 1));
    } else if (gatePosition >= 1) {
      leftPanelCount = N; // All panels on left, gate at end
    }
    
    const rightPanelCount = N - leftPanelCount;
    
    leftPanels = panelWidths.slice(0, leftPanelCount);
    rightPanels = panelWidths.slice(leftPanelCount);
    
    trace.push({
      step: 'panel-split',
      data: { gatePositionRaw, gatePosition, leftPanelCount, rightPanelCount, leftPanels, rightPanels },
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
    // NO GATE PATH - with optional custom panel support
    const defaultHeightMm = 1200; // Default height for custom panels
    const customPanel = computeFixedCustomPanel(customPanelConfig, defaultHeightMm, betweenGapMm);
    
    const policy: EndGapPolicy = process.env.STRICT_END_GAP === '1' 
      ? 'LOCKED_STRICT' 
      : (input.endGapPolicy ?? 'LOCKED_OR_RESIDUAL');
    
    let lockedTried = false;
    let residualUsed = false;
    let varianceEndGapMm = 0;
    
    trace.push({
      step: 'no-gate-path',
      data: { 
        customPanelRequired: customPanelConfig?.required ?? false,
        customPanelMm: customPanel.customPanelMm,
        customGapsMm: customPanel.customGapsMm,
        policy,
      },
    });
    
    // Compute fixed components: start + end + custom panel + custom gaps
    const F = startGapMm + endGapMm + customPanel.customPanelMm + customPanel.customGapsMm;
    
    // Try LOCKED mode first
    const targetPanels = runLengthMm - F;
    
    if (targetPanels < 0) {
      return {
        success: false,
        segments: [],
        panelLayout: { panels: [], gaps: [], totalPanelWidth: 0, totalGapWidth: 0, averageGap: 0 },
        validation: {
          sumMm: F,
          expectedMm: runLengthMm,
          deltaMm: runLengthMm - F,
          gatePresent: false,
          lengthConserved: false,
        },
        errors: [{
          code: 'UNREACHABLE',
          message: `Fixed components exceed section length`,
          details: { reason: 'fixed_exceeds_section', F, runLengthMm, targetPanels },
        }],
        trace,
      };
    }
    
    lockedTried = true;
    
    const feasibleResult = findFeasibleN(targetPanels, minPanelMm, maxPanelMm, 50);
    
    let panelWidths: number[] | null = null;
    let N = 0;
    
    trace.push({
      step: 'locked-attempt',
      data: { targetPanels, feasibleResult },
    });
    
    if ('N' in feasibleResult && feasibleResult.N) {
      // Try equalization with between gaps
      const N_try = feasibleResult.N;
      const panelsTarget = targetPanels - (N_try - 1) * betweenGapMm;
      
      const result = equalizePanelsExact(panelsTarget, N_try, 50, minPanelMm, maxPanelMm);
      
      if ('widthsMm' in result) {
        panelWidths = result.widthsMm;
        N = N_try;
        actualEndGapMm = endGapMm;
        varianceEndGapMm = 0;
        
        trace.push({
          step: 'locked-success',
          data: { N, panelSum: panelWidths.reduce((a,b) => a+b, 0) },
        });
      }
    }
    
    // If LOCKED failed, try RESIDUAL mode (if policy allows)
    if (!panelWidths && policy === 'LOCKED_OR_RESIDUAL') {
      residualUsed = true;
      
      // Use provisional target (round down to 50mm grid)
      const provisionalTarget = Math.floor(targetPanels / 50) * 50;
      
      const N_min_residual = Math.ceil(provisionalTarget / maxPanelMm);
      const N_max_residual = Math.floor(provisionalTarget / minPanelMm);
      
      trace.push({
        step: 'residual-attempt',
        data: { provisionalTarget, N_min_residual, N_max_residual },
      });
      
      let residualSolution: { N: number; panelWidths: number[]; residualEndGap: number } | null = null;
      
      for (let N_try = N_min_residual; N_try <= N_max_residual; N_try++) {
        const panelsTargetResidual = provisionalTarget - (N_try - 1) * betweenGapMm;
        
        if (panelsTargetResidual < N_try * minPanelMm) continue;
        
        const resultResidual = equalizePanelsExact(panelsTargetResidual, N_try, 50, minPanelMm, maxPanelMm);
        
        if ('widthsMm' in resultResidual) {
          const panelSum = resultResidual.widthsMm.reduce((a, b) => a + b, 0);
          const betweenGapsTotal = (N_try - 1) * betweenGapMm;
          const residualEndGap = runLengthMm - startGapMm - customPanel.customPanelMm - customPanel.customGapsMm - panelSum - betweenGapsTotal;
          
          trace.push({
            step: `residual-try-N-${N_try}`,
            data: { N_try, panelsTargetResidual, panelSum, betweenGapsTotal, residualEndGap },
          });
          
          if (residualEndGap >= 0) {
            residualSolution = { N: N_try, panelWidths: resultResidual.widthsMm, residualEndGap };
            break;
          }
        }
      }
      
      if (!residualSolution) {
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
          errors: [{
            code: 'UNREACHABLE',
            message: `Cannot achieve non-negative residual end gap`,
            details: { reason: 'residual_negative', provisionalTarget },
          }],
          trace,
        };
      }
      
      panelWidths = residualSolution.panelWidths;
      N = residualSolution.N;
      actualEndGapMm = residualSolution.residualEndGap;
      varianceEndGapMm = residualSolution.residualEndGap - endGapMm;
      
      trace.push({
        step: 'residual-success',
        data: { N, panelSum: panelWidths.reduce((a,b) => a+b, 0), residualEndGap: residualSolution.residualEndGap, varianceEndGapMm },
      });
    }
    
    // If still no solution and STRICT mode, fail
    if (!panelWidths) {
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
        errors: [{
          code: 'UNREACHABLE',
          message: `No 50mm grid solution exists for locked end gap ${endGapMm}mm`,
          details: { reason: 'locked_strict_failed', policy },
        }],
        trace,
      };
    }
    
    // Insert custom panel if required
    if (customPanelConfig?.required) {
      const position = customPanelConfig.position ?? 0.5;
      const panelSum = panelWidths.reduce((a, b) => a + b, 0);
      const betweenGapsTotal = (N - 1) * betweenGapMm;
      const totalVariableSpace = panelSum + betweenGapsTotal;
      
      // Calculate split point
      const leftShare = Math.round(position * totalVariableSpace);
      
      // Find split index by accumulating panels + gaps
      let accumulated = 0;
      let splitIndex = panelWidths.length; // Default: all panels go to left (for position=1.0)
      
      for (let i = 0; i < panelWidths.length; i++) {
        if (accumulated + panelWidths[i] / 2 >= leftShare) {
          splitIndex = i;
          break;
        }
        accumulated += panelWidths[i];
        if (i < panelWidths.length - 1) {
          accumulated += betweenGapMm;
        }
      }
      
      leftPanels = panelWidths.slice(0, splitIndex);
      rightPanels = panelWidths.slice(splitIndex);
      
      trace.push({
        step: 'custom-panel-insertion',
        data: { 
          position, 
          leftShare, 
          splitIndex, 
          leftPanelCount: leftPanels.length, 
          rightPanelCount: rightPanels.length,
          customPanelMm: customPanel.customPanelMm,
          customGapsMm: customPanel.customGapsMm,
        },
      });
    } else {
      // No custom panel, all panels go to right
      rightPanels = panelWidths;
    }
    
    // Create panel layout for compatibility
    const panelSum = panelWidths.reduce((sum, w) => sum + w, 0);
    const totalGapWidth = (N - 1) * betweenGapMm;
    
    panelLayout = {
      panels: panelWidths,
      gaps: Array(N - 1).fill(betweenGapMm),
      totalPanelWidth: panelSum,
      totalGapWidth,
      averageGap: betweenGapMm,
    };
    
    trace.push({
      step: 'end-gap-policy',
      data: { policy, lockedTried, residualUsed, actualEndGapMm, varianceEndGapMm },
    });
  }
  
  // Build segment sequence (use actualEndGapMm which is the requested end gap)
  const segments = buildSegmentSequence({
    startGapMm,
    endGapMm: actualEndGapMm,
    betweenGapMm,
    leftPanels,
    rightPanels,
    gateConfig,
    customPanelConfig,
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
    residualEndGapMm: gateConfig?.required && residualUsed ? actualEndGapMm : undefined,
    varianceEndGapMm: gateConfig?.required ? varianceEndGapMm : undefined,
    endGapPolicy: gateConfig?.required ? policy : undefined,
    lockedTried: gateConfig?.required ? lockedTried : undefined,
    residualUsed: gateConfig?.required ? residualUsed : undefined,
    errors: errors.length > 0 ? errors : undefined,
    trace,
  };
}
