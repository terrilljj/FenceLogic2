/**
 * Gap calculation utilities for fence segment composition
 */

export type SegmentKind = 'panel' | 'hinge-panel' | 'gate' | 'post-anchor' | 'gap';

export interface Segment {
  kind: SegmentKind;
  widthMm?: number;
  gapType?: 'start' | 'end' | 'between' | 'hinge' | 'latch';
}

/**
 * Computes the number of between-gaps needed for a sequence of segments.
 * Between gaps appear between adjacent glass elements (panel or hinge panel),
 * NOT between:
 *  - start/end gaps
 *  - hingeGap/latchGap around the gate
 *  - posts
 * 
 * @param sequence Array of segment kinds in layout order
 * @returns Number of between gaps needed
 */
export function computeBetweenGapCount(sequence: SegmentKind[]): number {
  let betweenGapCount = 0;
  let lastWasGlass = false;
  
  for (const kind of sequence) {
    const isGlass = (kind === 'panel' || kind === 'hinge-panel');
    
    if (isGlass && lastWasGlass) {
      betweenGapCount++;
    }
    
    lastWasGlass = isGlass;
  }
  
  return betweenGapCount;
}

/**
 * Validates segment composition and computes total length
 * 
 * @param segments Array of segments including gaps
 * @param expectedRunLength Expected total run length in mm
 * @returns Validation result with computed sum and any errors
 */
export function validateSegmentComposition(
  segments: Segment[],
  expectedRunLength: number
): {
  valid: boolean;
  sumMm: number;
  delta: number;
  errors: string[];
  segments: Segment[];
} {
  const errors: string[] = [];
  
  // Check for gate presence when required
  const gateSegments = segments.filter(s => s.kind === 'gate');
  
  // Compute total length
  let sumMm = 0;
  for (const segment of segments) {
    if (segment.widthMm) {
      sumMm += segment.widthMm;
    }
  }
  
  const delta = Math.abs(sumMm - expectedRunLength);
  const valid = errors.length === 0 && delta <= 2;
  
  return {
    valid,
    sumMm,
    delta,
    errors,
    segments,
  };
}

/**
 * Builds segment sequence from panel layout and gate configuration
 * Order: startGap → left panels → hinge/post → gate → latch → right panels → endGap
 */
export function buildSegmentSequence(config: {
  startGapMm: number;
  endGapMm: number;
  betweenGapMm: number;
  leftPanels: number[];  // panel widths on left side
  rightPanels: number[]; // panel widths on right side
  gateConfig?: {
    required: boolean;
    gateWidthMm: number;
    hingePanelWidthMm?: number; // Only for G2G
    hingeGapMm: number;
    latchGapMm: number;
    mountMode: 'GLASS_TO_GLASS' | 'POST' | 'WALL';
    hingeSide: 'LEFT' | 'RIGHT';
  };
}): Segment[] {
  const segments: Segment[] = [];
  
  // 1. Start gap
  if (config.startGapMm > 0) {
    segments.push({ kind: 'gap', widthMm: config.startGapMm, gapType: 'start' });
  }
  
  // Helper to add panels with between gaps
  const addPanelsWithGaps = (panels: number[]) => {
    for (let i = 0; i < panels.length; i++) {
      if (i > 0) {
        // Add between gap before this panel
        segments.push({ kind: 'gap', widthMm: config.betweenGapMm, gapType: 'between' });
      }
      segments.push({ kind: 'panel', widthMm: panels[i] });
    }
  };
  
  if (config.gateConfig?.required) {
    const { mountMode, hingeSide, gateWidthMm, hingePanelWidthMm, hingeGapMm, latchGapMm } = config.gateConfig;
    
    // 2. Left side panels (if any)
    if (config.leftPanels.length > 0) {
      addPanelsWithGaps(config.leftPanels);
    }
    
    // Add between gap before gate components if there were left panels
    if (config.leftPanels.length > 0) {
      segments.push({ kind: 'gap', widthMm: config.betweenGapMm, gapType: 'between' });
    }
    
    // 3. Hinge side component + hinge gap
    if (mountMode === 'GLASS_TO_GLASS') {
      segments.push({ kind: 'hinge-panel', widthMm: hingePanelWidthMm });
      segments.push({ kind: 'gap', widthMm: hingeGapMm, gapType: 'hinge' });
    } else {
      // POST or WALL mount - add post anchor
      segments.push({ kind: 'post-anchor', widthMm: 0 }); // Posts have no width in calculations
      segments.push({ kind: 'gap', widthMm: hingeGapMm, gapType: 'hinge' });
    }
    
    // 4. Gate
    segments.push({ kind: 'gate', widthMm: gateWidthMm });
    
    // 5. Latch gap
    segments.push({ kind: 'gap', widthMm: latchGapMm, gapType: 'latch' });
    
    // 6. Right side panels (if any)
    if (config.rightPanels.length > 0) {
      addPanelsWithGaps(config.rightPanels);
    }
  } else {
    // No gate - just panels
    addPanelsWithGaps([...config.leftPanels, ...config.rightPanels]);
  }
  
  // 7. End gap
  if (config.endGapMm > 0) {
    segments.push({ kind: 'gap', widthMm: config.endGapMm, gapType: 'end' });
  }
  
  return segments;
}
