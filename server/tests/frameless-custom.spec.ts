import { describe, it, expect } from 'vitest';
import { composeFenceSegments } from '../../shared/calc/compose';

describe('Frameless Custom Panel Feature', () => {
  describe('Basic Custom Panel Integration', () => {
    it('should insert custom panel at LEFT position (0.0)', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          panelHeightMm: 1800,
          position: 0.0,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom panel in segments
      const customPanel = result.segments.find(s => s.kind === 'panel' && s.widthMm === 800);
      expect(customPanel).toBeDefined();
      
      // Custom panel should be first panel (after start gap)
      const panelSegments = result.segments.filter(s => s.kind === 'panel');
      expect(panelSegments[0].widthMm).toBe(800);
      
      // Verify length conservation
      expect(result.validation.lengthConserved).toBe(true);
      expect(result.validation.deltaMm).toBeLessThanOrEqual(2);
    });

    it('should insert custom panel at MIDDLE position (0.5)', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          panelHeightMm: 1800,
          position: 0.5,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom panel
      const customPanel = result.segments.find(s => s.kind === 'panel' && s.widthMm === 800);
      expect(customPanel).toBeDefined();
      
      // Should have panels on both sides
      const panelSegments = result.segments.filter(s => s.kind === 'panel');
      expect(panelSegments.length).toBeGreaterThan(1);
      
      // Custom panel should be in middle
      const customPanelIndex = panelSegments.findIndex(p => p.widthMm === 800);
      expect(customPanelIndex).toBeGreaterThan(0);
      expect(customPanelIndex).toBeLessThan(panelSegments.length - 1);
      
      // Verify length conservation
      expect(result.validation.lengthConserved).toBe(true);
      expect(result.validation.deltaMm).toBeLessThanOrEqual(2);
    });

    it('should insert custom panel at RIGHT position (1.0)', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          panelHeightMm: 1800,
          position: 1.0,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom panel
      const customPanel = result.segments.find(s => s.kind === 'panel' && s.widthMm === 800);
      expect(customPanel).toBeDefined();
      
      // Custom panel should be last panel (before end gap)
      const panelSegments = result.segments.filter(s => s.kind === 'panel');
      expect(panelSegments[panelSegments.length - 1].widthMm).toBe(800);
      
      // Verify length conservation
      expect(result.validation.lengthConserved).toBe(true);
      expect(result.validation.deltaMm).toBeLessThanOrEqual(2);
    });
  });

  describe('Panel Equalization with Custom Panel', () => {
    it('should equalize variable panels on 50mm grid', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          position: 0.5,
        },
      });

      expect(result.success).toBe(true);
      
      // All variable panels should be on 50mm grid
      const variablePanels = result.segments
        .filter(s => s.kind === 'panel' && s.widthMm !== 800)
        .map(s => s.widthMm)
        .filter((w): w is number => w !== undefined);
      
      for (const width of variablePanels) {
        expect(width % 50).toBe(0);
      }
    });

    it('should respect min/max panel bounds', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          position: 0.3,
        },
      });

      expect(result.success).toBe(true);
      
      // All variable panels should be within bounds
      const variablePanels = result.segments
        .filter(s => s.kind === 'panel' && s.widthMm !== 800)
        .map(s => s.widthMm)
        .filter((w): w is number => w !== undefined);
      
      for (const width of variablePanels) {
        expect(width).toBeGreaterThanOrEqual(300);
        expect(width).toBeLessThanOrEqual(1400);
      }
    });
  });

  describe('Length Conservation', () => {
    it('should conserve length within ±2mm tolerance', () => {
      const configs = [
        { runLength: 3000, customWidth: 600, position: 0.0 },
        { runLength: 5000, customWidth: 800, position: 0.5 },
        { runLength: 7000, customWidth: 1000, position: 1.0 },
        { runLength: 4500, customWidth: 750, position: 0.3 },
      ];

      for (const config of configs) {
        const result = composeFenceSegments({
          runLengthMm: config.runLength,
          startGapMm: 25,
          endGapMm: 25,
          betweenGapMm: 50,
          maxPanelMm: 1400,
          minPanelMm: 300,
          customPanelConfig: {
            required: true,
            panelWidthMm: config.customWidth,
            position: config.position,
          },
        });

        expect(result.success).toBe(true);
        expect(result.validation.deltaMm).toBeLessThanOrEqual(2);
        expect(result.validation.lengthConserved).toBe(true);
      }
    });

    it('should account for custom panel in total length', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          position: 0.5,
        },
      });

      // Calculate total from segments
      let totalMm = 0;
      for (const segment of result.segments) {
        if (segment.widthMm) {
          totalMm += segment.widthMm;
        }
      }

      expect(totalMm).toBeCloseTo(5000, 0);
    });
  });

  describe('Custom Gap Handling', () => {
    it('should support custom gap before panel', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          position: 0.5,
          gapBeforeMm: 100,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom gap before panel
      const customPanelIndex = result.segments.findIndex(s => s.kind === 'panel' && s.widthMm === 800);
      if (customPanelIndex > 0) {
        const gapBefore = result.segments[customPanelIndex - 1];
        if (gapBefore.kind === 'gap') {
          expect(gapBefore.widthMm).toBe(100);
        }
      }
    });

    it('should support custom gap after panel', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 800,
          position: 0.5,
          gapAfterMm: 75,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom gap after panel
      const customPanelIndex = result.segments.findIndex(s => s.kind === 'panel' && s.widthMm === 800);
      if (customPanelIndex < result.segments.length - 1) {
        const gapAfter = result.segments[customPanelIndex + 1];
        if (gapAfter.kind === 'gap') {
          expect(gapAfter.widthMm).toBe(75);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle single custom panel (no variable panels)', () => {
      const result = composeFenceSegments({
        runLengthMm: 900,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 850,
          position: 0.5,
        },
      });

      expect(result.success).toBe(true);
      
      // Should only have one panel (the custom one)
      const panelSegments = result.segments.filter(s => s.kind === 'panel');
      expect(panelSegments.length).toBe(1);
      expect(panelSegments[0].widthMm).toBe(850);
    });

    it('should handle large custom panel', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 2000,
          position: 0.5,
        },
      });

      expect(result.success).toBe(true);
      
      // Custom panel should be present
      const customPanel = result.segments.find(s => s.kind === 'panel' && s.widthMm === 2000);
      expect(customPanel).toBeDefined();
      
      // Length should still be conserved
      expect(result.validation.deltaMm).toBeLessThanOrEqual(2);
    });

    it('should handle small custom panel', () => {
      const result = composeFenceSegments({
        runLengthMm: 5000,
        startGapMm: 25,
        endGapMm: 25,
        betweenGapMm: 50,
        maxPanelMm: 1400,
        minPanelMm: 300,
        customPanelConfig: {
          required: true,
          panelWidthMm: 250,
          position: 0.5,
        },
      });

      expect(result.success).toBe(true);
      
      // Custom panel should be present
      const customPanel = result.segments.find(s => s.kind === 'panel' && s.widthMm === 250);
      expect(customPanel).toBeDefined();
    });
  });

  describe('Position Accuracy', () => {
    it('should place custom panel at precise position within tolerance', () => {
      const positions = [0.0, 0.25, 0.5, 0.75, 1.0];

      for (const position of positions) {
        const result = composeFenceSegments({
          runLengthMm: 5000,
          startGapMm: 25,
          endGapMm: 25,
          betweenGapMm: 50,
          maxPanelMm: 1400,
          minPanelMm: 300,
          customPanelConfig: {
            required: true,
            panelWidthMm: 800,
            position,
          },
        });

        expect(result.success).toBe(true);
        
        // Calculate actual position of custom panel
        let leftMm = 0;
        for (const segment of result.segments) {
          if (segment.kind === 'panel' && segment.widthMm === 800) {
            break;
          }
          if (segment.widthMm) {
            leftMm += segment.widthMm;
          }
        }

        const targetLeftMm = position * (5000 - 800); // Available space for positioning
        const varianceMm = Math.abs(leftMm - targetLeftMm);
        
        // Should be within reasonable tolerance (considering 50mm grid constraints)
        expect(varianceMm).toBeLessThan(200); // Allow some variance due to grid constraints
      }
    });
  });
});
