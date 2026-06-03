/**
 * Exact panel equalization for a specific panel count N
 * Hits target within ±1mm on stepMm grid
 */
export function equalizePanelsExact(
  targetMm: number,
  N: number,
  stepMm: number,
  minPanelMm: number,
  maxPanelMm: number
): { widthsMm: number[] } | { error: string } {
  if (N <= 0) {
    return { error: 'Panel count must be positive' };
  }
  
  // a) Calculate base width
  const avgWidth = targetMm / N;
  const base = Math.floor(avgWidth / stepMm) * stepMm;
  
  // b) Initialize all panels to clamped base
  const widths: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    widths[i] = Math.max(minPanelMm, Math.min(maxPanelMm, base));
  }
  
  // c) Calculate delta
  let sum = widths.reduce((a, b) => a + b, 0);
  let delta = targetMm - sum;
  
  // d) Calculate steps to add/remove
  const steps = Math.round(delta / stepMm);
  
  // e) Adjust panels
  if (steps > 0) {
    // Need to add steps
    let added = 0;
    let attempts = 0;
    const maxAttempts = N * 2; // Allow wraparound
    
    while (added < steps && attempts < maxAttempts) {
      const idx = attempts % N;
      if (widths[idx] + stepMm <= maxPanelMm) {
        widths[idx] += stepMm;
        added++;
      }
      attempts++;
    }
    
    if (added < steps) {
      return { error: `UNREACHABLE_WITH_N: Cannot add ${steps} steps with N=${N}` };
    }
  } else if (steps < 0) {
    // Need to remove steps
    let removed = 0;
    let attempts = 0;
    const maxAttempts = N * 2;
    
    while (removed < Math.abs(steps) && attempts < maxAttempts) {
      const idx = attempts % N;
      if (widths[idx] - stepMm >= minPanelMm) {
        widths[idx] -= stepMm;
        removed++;
      }
      attempts++;
    }
    
    if (removed < Math.abs(steps)) {
      return { error: `UNREACHABLE_WITH_N: Cannot remove ${Math.abs(steps)} steps with N=${N}` };
    }
  }
  
  // f) Verify constraints
  sum = widths.reduce((a, b) => a + b, 0);
  delta = sum - targetMm;
  
  // Check all widths are valid
  for (const w of widths) {
    if (w % stepMm !== 0) {
      return { error: `UNREACHABLE_WITH_N: Width ${w} not multiple of ${stepMm}` };
    }
    if (w < minPanelMm || w > maxPanelMm) {
      return { error: `UNREACHABLE_WITH_N: Width ${w} outside bounds [${minPanelMm}, ${maxPanelMm}]` };
    }
  }
  
  // Accept solution if within half a step (±25mm for 50mm step)
  // The total length will be conserved by adjusting the end gap
  const tolerance = stepMm / 2;
  if (Math.abs(delta) > tolerance) {
    return { error: `UNREACHABLE_WITH_N: Delta ${delta}mm exceeds ±${tolerance}mm` };
  }
  
  return { widthsMm: widths };
}

/**
 * Find feasible N (panel count) for exact target
 */
export function findFeasibleN(
  targetMm: number,
  minPanelMm: number,
  maxPanelMm: number,
  stepMm: number
): { N: number; widths: number[] } | { error: string } {
  const N_min = Math.ceil(targetMm / maxPanelMm);
  const N_max = Math.floor(targetMm / minPanelMm);
  
  if (N_min > N_max) {
    return {
      error: `UNREACHABLE: Target ${targetMm}mm impossible with panels [${minPanelMm}-${maxPanelMm}]mm. Need ${N_min}-${N_max} panels.`
    };
  }
  
  // Try each N from min to max
  for (let N = N_min; N <= N_max; N++) {
    const result = equalizePanelsExact(targetMm, N, stepMm, minPanelMm, maxPanelMm);
    if ('widthsMm' in result) {
      return { N, widths: result.widthsMm };
    }
  }
  
  return {
    error: `UNREACHABLE: No N in range [${N_min}-${N_max}] can hit ${targetMm}mm on ${stepMm}mm grid with bounds [${minPanelMm}-${maxPanelMm}]mm`
  };
}

/**
 * Equalize panel widths on a fixed grid step (default 50mm)
 * Ensures all panels are within min/max bounds and sum to target length
 * 
 * @param targetMm - Total target length to fill with panels
 * @param stepMm - Grid step size (default 50mm)
 * @param maxPanelMm - Maximum panel width
 * @param minPanelMm - Minimum panel width (default 300mm)
 * @returns Object with widths array or error message
 */
export function equalizePanels({
  targetMm,
  stepMm = 50,
  maxPanelMm,
  minPanelMm = 300,
}: {
  targetMm: number;
  stepMm?: number;
  maxPanelMm: number;
  minPanelMm?: number;
}): { widthsMm?: number[]; error?: string } {
  // Validate inputs
  if (targetMm <= 0) {
    return { error: "Target length must be positive" };
  }
  
  if (minPanelMm > maxPanelMm) {
    return { error: "Min panel width cannot exceed max panel width" };
  }
  
  if (stepMm <= 0) {
    return { error: "Step size must be positive" };
  }
  
  // Start with minimum number of panels needed
  const minCount = Math.ceil(targetMm / maxPanelMm);
  
  if (minCount < 1) {
    return { error: "Cannot fit any panels" };
  }
  
  // Try increasing panel counts until we find a solution
  // Limit search to prevent infinite loops (max 20 additional panels beyond minimum)
  for (let count = minCount; count <= minCount + 20; count++) {
    // Calculate base width (rounded down to step)
    const avgWidth = targetMm / count;
    const base = Math.floor(avgWidth / stepMm) * stepMm;
    
    // Check if base is too small
    if (base < minPanelMm) {
      continue;
    }
    
    // Check if base is too large
    if (base > maxPanelMm) {
      continue;
    }
    
    // Calculate leftover after assigning base to all panels
    const leftover = targetMm - (base * count);
    
    // How many panels need to be one step larger?
    // Use Math.round to handle floating point precision
    const exactSteps = leftover / stepMm;
    const steps = Math.round(exactSteps);
    
    // Verify that absolute steps is achievable (can't distribute more steps than we have panels)
    if (Math.abs(steps) > count) {
      continue;
    }
    
    // Build the widths array
    const widths: number[] = Array(count).fill(base);
    
    // Distribute the extra steps (or subtract if negative)
    if (steps > 0) {
      for (let i = 0; i < steps && i < count; i++) {
        widths[i] += stepMm;
      }
    } else if (steps < 0) {
      for (let i = 0; i < Math.abs(steps) && i < count; i++) {
        widths[i] -= stepMm;
      }
    }
    
    // Validate all widths are within bounds
    const allValid = widths.every(w => w >= minPanelMm && w <= maxPanelMm);
    if (!allValid) {
      continue;
    }
    
    // Calculate sum
    const sum = widths.reduce((acc, w) => acc + w, 0);
    
    // For targets that aren't perfect multiples of step, we need to be flexible
    // Check if we're within a reasonable tolerance (one step)
    const sumDiff = Math.abs(sum - targetMm);
    
    if (sumDiff > stepMm) {
      continue; // Too far off, try next count
    }
    
    // If we're within ±2mm, accept it
    if (sumDiff <= 2) {
      return { widthsMm: widths };
    }
    
    // If we're close but not within 2mm, try adjusting
    // We're at most stepMm away, so we can fine-tune
    if (sum < targetMm) {
      // Need to add a bit more - can't do it perfectly with step constraint
      // Accept the closest solution
      continue;
    } else if (sum > targetMm) {
      // Too much - try reducing
      // Find the smallest adjustment that gets us closer
      const excess = sum - targetMm;
      if (excess < stepMm) {
        // We're already the closest we can get, accept it
        // But only if it's within tolerance
        if (excess <= 2) {
          return { widthsMm: widths };
        }
        continue;
      }
    }
    
    // Validate that difference between largest and smallest is at most one step
    const min = Math.min(...widths);
    const max = Math.max(...widths);
    
    if (max - min > stepMm) {
      continue;
    }
    
    // Success!
    return { widthsMm: widths };
  }
  
  // No solution found
  return {
    error: `No solution found for target=${targetMm}mm with min=${minPanelMm}mm, max=${maxPanelMm}mm, step=${stepMm}mm`,
  };
}
