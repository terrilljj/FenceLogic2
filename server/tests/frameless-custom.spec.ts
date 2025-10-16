import { describe, it, expect } from 'vitest';
import { composeFenceSegments } from '../../shared/calc/compose';
import type { CompositionInput } from '../../shared/calc/compose';

describe('Frameless Custom Panel Feature', () => {
  const baseInput: CompositionInput = {
    runLengthMm: 3000,
    startGapMm: 50,
    endGapMm: 50,
    betweenGapMm: 50,
    minPanelMm: 600,
    maxPanelMm: 1200,
  };

  describe('Gap Precedence', () => {
    it('should use custom gaps when specified and replace connector gaps', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
          gapBeforeMm: 30,
          gapAfterMm: 40,
        },
      });

      expect(result.success).toBe(true);
      
      // Verify custom gaps are in the segments
      const gaps = result.segments.filter(s => s.kind === 'gap' && s.gapType === 'between');
      const gapWidths = gaps.map(g => g.widthMm);
      
      // Should have custom gaps of 30 and 40
      expect(gapWidths).toContain(30);
      expect(gapWidths).toContain(40);
      
      // Length should be conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });

    it('should use connector gaps when custom gaps not specified', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
          // No custom gaps specified
        },
      });

      expect(result.success).toBe(true);
      
      // All between gaps should be the standard betweenGapMm
      const gaps = result.segments.filter(s => s.kind === 'gap' && s.gapType === 'between');
      gaps.forEach(gap => {
        expect(gap.widthMm).toBe(50);
      });
      
      // Length should be conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });

    it('should insert connector gaps only between variable panels', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 4000,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 600,
        },
      });

      expect(result.success).toBe(true);
      
      // Count panel segments
      const panels = result.segments.filter(s => s.kind === 'panel');
      const variablePanels = panels.length - 1; // Subtract custom panel
      
      // Count connector gaps (between gaps)
      const connectorGaps = result.segments.filter(s => s.kind === 'gap' && s.gapType === 'between');
      
      // Should have gaps between: left panels, before custom, after custom, right panels
      // Total should account for proper gap placement
      expect(connectorGaps.length).toBeGreaterThan(0);
    });
  });

  describe('Position Accuracy', () => {
    it('should place custom panel at LEFT position (0.0)', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.0,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // Find custom panel position in segments
      const panels = result.segments.filter(s => s.kind === 'panel');
      const startGapIndex = result.segments.findIndex(s => s.kind === 'gap' && s.gapType === 'start');
      const customPanelIndex = startGapIndex + 1;
      
      // Custom panel should be first panel after start gap
      expect(result.segments[customPanelIndex]?.kind).toBe('panel');
      expect(result.segments[customPanelIndex]?.widthMm).toBe(800);
      
      // Position-split trace should show chosenBoundaryIndex=0
      const positionTrace = result.trace.find(t => t.step === 'position-split');
      expect(positionTrace?.data?.chosenBoundaryIndex).toBe(0);
    });

    it('should place custom panel at MIDDLE position (0.5)', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // Position-split trace should show middle position
      const positionTrace = result.trace.find(t => t.step === 'position-split');
      expect(positionTrace?.data?.position).toBe(0.5);
      
      // Boundary offset should be ≤ 200mm
      const boundaryOffsetMm = positionTrace?.data?.boundaryOffsetMm;
      expect(boundaryOffsetMm).toBeLessThanOrEqual(200);
      
      // Length conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });

    it('should place custom panel at RIGHT position (1.0) with N>1', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 4000,
        customPanelConfig: {
          required: true,
          position: 1.0,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // Position-split trace should show position=1.0
      const positionTrace = result.trace.find(t => t.step === 'position-split');
      expect(positionTrace?.data?.position).toBe(1.0);
      
      // Should clamp to last boundary
      const chosenBoundaryIndex = positionTrace?.data?.chosenBoundaryIndex;
      const boundaries = positionTrace?.data?.boundaries || [];
      expect(chosenBoundaryIndex).toBe(boundaries.length - 1);
      
      // Boundary offset should be ≤ 200mm
      const boundaryOffsetMm = positionTrace?.data?.boundaryOffsetMm;
      expect(boundaryOffsetMm).toBeLessThanOrEqual(200);
      
      // Length conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });

    it('should handle RIGHT position (1.0) with N=1', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 2000,
        minPanelMm: 800,
        maxPanelMm: 1200,
        customPanelConfig: {
          required: true,
          position: 1.0,
          panelWidthMm: 600,
        },
      });

      expect(result.success).toBe(true);
      
      // Position-split trace
      const positionTrace = result.trace.find(t => t.step === 'position-split');
      expect(positionTrace?.data?.position).toBe(1.0);
      expect(positionTrace?.data?.leftPanelCount).toBe(0);
      expect(positionTrace?.data?.rightPanelCount).toBe(1);
      
      // No connector gaps between variable panels (only 1 panel)
      const connectorGaps = result.segments.filter(s => 
        s.kind === 'gap' && s.gapType === 'between'
      );
      // Should have gaps around custom panel only
      expect(connectorGaps.length).toBeLessThanOrEqual(2);
      
      // Length conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle N=0 (no variable panels, custom panel only)', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 1000,
        minPanelMm: 2000, // Force N=0 by making min too large
        maxPanelMm: 3000,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
          gapBeforeMm: 25,
          gapAfterMm: 25,
        },
      });

      expect(result.success).toBe(true);
      
      // Should have: start gap + custom gaps + custom panel + end gap
      const panels = result.segments.filter(s => s.kind === 'panel');
      expect(panels.length).toBe(1);
      expect(panels[0].widthMm).toBe(800);
      
      // Should have custom gaps
      const customGaps = result.segments.filter(s => s.kind === 'gap' && s.gapType === 'between');
      expect(customGaps.some(g => g.widthMm === 25)).toBe(true);
      
      // Length conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - 1000)).toBeLessThanOrEqual(2);
    });

    it('should handle large custom panel', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 5000,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 1500,
        },
      });

      expect(result.success).toBe(true);
      
      // Should still conserve length
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - 5000)).toBeLessThanOrEqual(2);
    });

    it('should handle small custom panel', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 300,
        },
      });

      expect(result.success).toBe(true);
      
      // Should still conserve length
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - baseInput.runLengthMm)).toBeLessThanOrEqual(2);
    });
  });

  describe('Length Conservation', () => {
    it('should conserve length within ±2mm tolerance (non-gate)', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 850,
          gapBeforeMm: 75,
          gapAfterMm: 75,
        },
      });

      expect(result.success).toBe(true);
      expect(result.validation.lengthConserved).toBe(true);
      expect(Math.abs(result.validation.deltaMm)).toBeLessThanOrEqual(2);
    });

    it('should account for custom panel in total length', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.3,
          panelWidthMm: 700,
        },
      });

      expect(result.success).toBe(true);
      
      // Sum all segments
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(sum).toBe(baseInput.runLengthMm);
    });
  });

  describe('Panel Equalization', () => {
    it('should equalize variable panels on 50mm grid', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // All panels should be multiples of 50mm
      const panels = result.segments.filter(s => s.kind === 'panel');
      panels.forEach(panel => {
        expect(panel.widthMm! % 50).toBe(0);
      });
    });

    it('should respect min/max panel bounds', () => {
      const result = composeFenceSegments({
        ...baseInput,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // All variable panels should be within bounds
      const panels = result.segments.filter(s => s.kind === 'panel');
      panels.forEach(panel => {
        if (panel.widthMm !== 800) { // Not the custom panel
          expect(panel.widthMm!).toBeGreaterThanOrEqual(baseInput.minPanelMm);
          expect(panel.widthMm!).toBeLessThanOrEqual(baseInput.maxPanelMm);
        }
      });
    });
  });

  describe('End Gap Variance', () => {
    it('should report variance when using residual end gap', () => {
      const result = composeFenceSegments({
        ...baseInput,
        runLengthMm: 3017, // Odd length that may force residual
        endGapMm: 50,
        customPanelConfig: {
          required: true,
          position: 0.5,
          panelWidthMm: 800,
        },
      });

      expect(result.success).toBe(true);
      
      // Check if variance is reported in trace
      const endGapTrace = result.trace.find(t => t.step === 'end-gap-policy');
      expect(endGapTrace).toBeDefined();
      
      // Length still conserved
      const sum = result.segments.reduce((acc, s) => acc + (s.widthMm || 0), 0);
      expect(Math.abs(sum - 3017)).toBeLessThanOrEqual(2);
    });
  });
});
