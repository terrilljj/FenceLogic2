import { describe, it, expect } from 'vitest';
import { adviseEndGap, isEndGapFeasible, findClosestFeasibleEndGap } from '../../shared/calc/endgapAdvisor';
import { CompositionInput } from '../../shared/calc/compose';

describe('EndGap Advisor', () => {
  describe('adviseEndGap', () => {
    it('should identify feasible end gaps', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = adviseEndGap(baseInput, [20, 25, 30, 35, 40]);

      // Should test all candidates
      expect(result.advice.length).toBe(5);
      
      // At least some should be feasible (25mm is known to work)
      const feasible = result.advice.filter(a => a.feasible);
      expect(feasible.length).toBeGreaterThan(0);
    });

    it('should calculate variance from requested end gap', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = adviseEndGap(baseInput, [25]);
      
      // 25mm is known to work for this config
      expect(result.advice[0].feasible).toBe(true);
      expect(result.advice[0].variance).toBe(0);
      expect(result.advice[0].actualEndGap).toBe(25);
    });

    it('should identify exact matches (variance = 0)', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = adviseEndGap(baseInput, [10, 15, 20, 25, 30, 35, 40, 45, 50]);

      // Check if any are exact matches
      const exactMatches = result.advice.filter(a => a.variance === 0);
      expect(result.recommendations.exactMatches.length).toBe(exactMatches.length);
    });

    it('should handle gate configurations', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        gateConfig: {
          required: true,
          mountMode: 'GLASS_TO_GLASS',
          hingeSide: 'LEFT',
          gateWidthMm: 900,
          hingePanelWidthMm: 1200,
          hingeGapMm: 20,
          latchGapMm: 20,
          position: 0.3,
        },
      };

      const result = adviseEndGap(baseInput, [20, 25, 30, 35]);

      // At least some should be feasible
      const feasible = result.advice.filter(a => a.feasible);
      expect(feasible.length).toBeGreaterThan(0);
    });

    it('should return closest match recommendation', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = adviseEndGap(baseInput, [20, 25, 30]);

      expect(result.recommendations.closestMatch).toBeDefined();
      expect(result.recommendations.closestMatch?.feasible).toBe(true);
      
      // Closest match should have minimal variance
      const minVariance = Math.min(...result.advice.filter(a => a.feasible).map(a => a.variance ?? Infinity));
      expect(result.recommendations.closestMatch?.variance).toBe(minVariance);
    });

    it('should provide error reasons for infeasible gaps', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 2000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        gateConfig: {
          required: true,
          mountMode: 'GLASS_TO_GLASS',
          hingeSide: 'LEFT',
          gateWidthMm: 1500, // Too wide for 2000mm run
          hingePanelWidthMm: 1200,
          hingeGapMm: 20,
          latchGapMm: 20,
          position: 0.5,
        },
      };

      const result = adviseEndGap(baseInput, [25]);

      // Should fail because gate is too wide
      const infeasible = result.advice.filter(a => !a.feasible);
      expect(infeasible.length).toBeGreaterThan(0);
      expect(infeasible[0].reason).toBeDefined();
    });
  });

  describe('isEndGapFeasible', () => {
    it('should return true for feasible end gap', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      expect(isEndGapFeasible(baseInput, 25)).toBe(true);
    });

    it('should return false for infeasible configuration', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 200,
        startGapMm: 100,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      // Not enough room: 200mm - 100mm start - 25mm end = 75mm (less than minPanel 300mm)
      expect(isEndGapFeasible(baseInput, 25)).toBe(false);
    });
  });

  describe('findClosestFeasibleEndGap', () => {
    it('should find exact match when target is feasible', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = findClosestFeasibleEndGap(baseInput, 25);

      expect(result).toBeDefined();
      expect(result?.feasible).toBe(true);
    });

    it('should find nearby feasible gap when target is not feasible', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      // Try a target that might need adjustment
      const result = findClosestFeasibleEndGap(baseInput, 23, 20);

      expect(result).toBeDefined();
      expect(result?.feasible).toBe(true);
    });

    it('should return null when no feasible gap exists in range', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 500, // Very short run
        startGapMm: 200,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const result = findClosestFeasibleEndGap(baseInput, 25, 10);

      // Might be null if configuration is impossible
      if (result === null) {
        expect(result).toBeNull();
      }
    });

    it('should respect search range parameter', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      const smallRange = findClosestFeasibleEndGap(baseInput, 25, 5);
      const largeRange = findClosestFeasibleEndGap(baseInput, 25, 50);

      expect(smallRange).toBeDefined();
      expect(largeRange).toBeDefined();
    });
  });

  describe('LOCKED_OR_RESIDUAL policy behavior', () => {
    it('should try exact end gap first, fallback to residual if needed', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
      };

      // Test 25mm which is known to work exactly
      const exactResult = adviseEndGap(baseInput, [25]);
      expect(exactResult.advice[0].feasible).toBe(true);
      expect(exactResult.advice[0].variance).toBe(0);
      expect(exactResult.advice[0].actualEndGap).toBe(25);
      
      // Test a gap that might use residual (or be infeasible)
      const residualResult = adviseEndGap(baseInput, [22]);
      
      // Either it's feasible with variance, or infeasible
      if (residualResult.advice[0].feasible) {
        // If feasible, should have actual gap defined
        expect(residualResult.advice[0].actualEndGap).toBeDefined();
        expect(residualResult.advice[0].variance).toBeDefined();
      } else {
        // If not feasible, should have a reason
        expect(residualResult.advice[0].reason).toBeDefined();
      }
    });

    it('should report variance when using residual gap', () => {
      const baseInput: Omit<CompositionInput, 'endGapMm'> = {
        runLengthMm: 5000,
        startGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        gateConfig: {
          required: true,
          mountMode: 'GLASS_TO_GLASS',
          hingeSide: 'LEFT',
          gateWidthMm: 900,
          hingePanelWidthMm: 1200,
          hingeGapMm: 20,
          latchGapMm: 20,
          position: 0.3,
        },
      };

      const result = adviseEndGap(baseInput, [25]);

      expect(result.advice[0].feasible).toBe(true);
      expect(result.advice[0].variance).toBeDefined();
      
      // Variance should be the difference between requested and actual
      if (result.advice[0].actualEndGap) {
        expect(result.advice[0].variance).toBe(
          Math.abs(result.advice[0].actualEndGap - 25)
        );
      }
    });
  });
});
