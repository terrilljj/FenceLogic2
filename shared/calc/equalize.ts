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
