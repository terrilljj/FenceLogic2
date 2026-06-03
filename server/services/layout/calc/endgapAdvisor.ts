import { composeFenceSegments, CompositionInput } from './compose';

/**
 * EndGap Advisor
 * 
 * Helps users understand which end gap values are feasible for their configuration.
 * Tests multiple end gap values and reports which ones succeed on the 50mm panel grid.
 */

export interface EndGapAdvice {
  requestedEndGap: number;
  feasible: boolean;
  actualEndGap?: number;
  variance?: number;
  reason?: string;
}

export interface EndGapAdvisorResult {
  config: {
    runLength: number;
    startGap: number;
    betweenGap: number;
    hasGate: boolean;
    gateWidth?: number;
  };
  advice: EndGapAdvice[];
  recommendations: {
    exactMatches: number[];  // End gaps that produce exact requested value
    closestMatch?: EndGapAdvice;  // Best fallback if no exact match
  };
}

/**
 * Analyze which end gap values are feasible for the given configuration
 */
export function adviseEndGap(
  baseInput: Omit<CompositionInput, 'endGapMm'>,
  candidateEndGaps: number[] = [10, 15, 20, 25, 30, 35, 40, 45, 50]
): EndGapAdvisorResult {
  const advice: EndGapAdvice[] = [];
  const exactMatches: number[] = [];
  let closestMatch: EndGapAdvice | undefined;
  let minVariance = Infinity;

  for (const endGap of candidateEndGaps) {
    const input: CompositionInput = {
      ...baseInput,
      endGapMm: endGap,
    };

    const result = composeFenceSegments(input);

    if (result.success) {
      const actualEndGap = result.actualEndGapMm ?? endGap;
      const variance = Math.abs(actualEndGap - endGap);

      const item: EndGapAdvice = {
        requestedEndGap: endGap,
        feasible: true,
        actualEndGap,
        variance,
      };

      advice.push(item);

      // Track exact matches (variance = 0)
      if (variance === 0) {
        exactMatches.push(endGap);
      }

      // Track closest match
      if (variance < minVariance) {
        minVariance = variance;
        closestMatch = item;
      }
    } else {
      advice.push({
        requestedEndGap: endGap,
        feasible: false,
        reason: result.errors?.map(e => e.message).join('; ') ?? 'Unknown error',
      });
    }
  }

  return {
    config: {
      runLength: baseInput.runLengthMm,
      startGap: baseInput.startGapMm,
      betweenGap: baseInput.betweenGapMm,
      hasGate: baseInput.gateConfig?.required ?? false,
      gateWidth: baseInput.gateConfig?.gateWidthMm,
    },
    advice,
    recommendations: {
      exactMatches,
      closestMatch,
    },
  };
}

/**
 * Quick check: Is a specific end gap value feasible?
 */
export function isEndGapFeasible(
  baseInput: Omit<CompositionInput, 'endGapMm'>,
  endGapMm: number
): boolean {
  const input: CompositionInput = {
    ...baseInput,
    endGapMm,
  };
  const result = composeFenceSegments(input);
  return result.success;
}

/**
 * Find the closest feasible end gap to a target value
 */
export function findClosestFeasibleEndGap(
  baseInput: Omit<CompositionInput, 'endGapMm'>,
  targetEndGap: number,
  searchRange: number = 100
): EndGapAdvice | null {
  // Generate candidates around the target
  const candidates: number[] = [];
  for (let offset = 0; offset <= searchRange; offset += 5) {
    if (offset === 0) {
      candidates.push(targetEndGap);
    } else {
      if (targetEndGap + offset <= 200) candidates.push(targetEndGap + offset);
      if (targetEndGap - offset >= 0) candidates.push(targetEndGap - offset);
    }
  }

  const result = adviseEndGap(baseInput, candidates);
  return result.recommendations.closestMatch ?? null;
}
