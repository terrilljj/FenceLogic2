/**
 * SKU Selection utilities for numeric field configurations
 * Handles gate width and hinge panel width with tolerance-based snapping
 */

import type { Product } from "@shared/schema";

export interface SkuSelectionResult {
  sku?: string;
  snappedWidthMm?: number;
  warning?: string;
  note?: string;
}

/**
 * Extract width from product code (assumes format like "GATE-1000" or "HINGE-PANEL-1200")
 * Returns null if no width found in code
 */
export function extractWidthFromCode(code: string): number | null {
  // Try to find a 3-4 digit number in the code (common width range: 700-1800mm)
  const match = code.match(/(\d{3,4})/);
  if (match) {
    const width = parseInt(match[1], 10);
    // Sanity check: typical gate/panel widths are 700-1800mm
    if (width >= 700 && width <= 1800) {
      return width;
    }
  }
  return null;
}

/**
 * Choose the best gate SKU based on target width and tolerance
 * 
 * @param targetMm - Target width in millimeters
 * @param gateSkus - Array of available gate product SKUs
 * @param toleranceMm - Maximum allowed deviation from target (default: 50mm)
 * @returns SkuSelectionResult with chosen SKU or warning
 */
export function chooseGateSkuByNearest(
  targetMm: number,
  gateSkus: Product[],
  toleranceMm: number = 50
): SkuSelectionResult {
  if (gateSkus.length === 0) {
    return {
      warning: "no_gate_skus_available",
    };
  }

  // Extract widths from SKUs
  const skusWithWidth = gateSkus.map(sku => ({
    sku,
    width: extractWidthFromCode(sku.code),
  })).filter(item => item.width !== null) as Array<{
    sku: Product;
    width: number;
  }>;

  if (skusWithWidth.length === 0) {
    return {
      warning: "no_gate_sku_widths_parseable",
    };
  }

  // Find closest match within tolerance
  let closest: { sku: Product; width: number; deviation: number } | null = null;

  for (const item of skusWithWidth) {
    const deviation = Math.abs(item.width - targetMm);
    
    if (deviation <= toleranceMm) {
      if (!closest || deviation < closest.deviation) {
        closest = { ...item, deviation };
      }
    }
  }

  if (!closest) {
    return {
      warning: "no_gate_sku_within_tolerance",
      note: `No gate SKU found within ±${toleranceMm}mm of ${targetMm}mm`,
    };
  }

  // If we snapped to a different width, include a note
  const wasSnapped = closest.width !== targetMm;
  
  return {
    sku: closest.sku.code,
    snappedWidthMm: closest.width,
    note: wasSnapped ? `snapped_from=${targetMm}_to=${closest.width}` : undefined,
  };
}

/**
 * Choose the best hinge panel SKU based on target width and tolerance
 * Similar to gate SKU selection but for hinge panels
 * 
 * @param targetMm - Target width in millimeters
 * @param hingeSkus - Array of available hinge panel product SKUs
 * @param toleranceMm - Maximum allowed deviation from target (default: 50mm)
 * @returns SkuSelectionResult with chosen SKU or warning
 */
export function chooseHingePanelWidth(
  targetMm: number,
  hingeSkus: Product[],
  toleranceMm: number = 50
): SkuSelectionResult {
  if (hingeSkus.length === 0) {
    return {
      warning: "no_hinge_skus_available",
    };
  }

  // Extract widths from SKUs
  const skusWithWidth = hingeSkus.map(sku => ({
    sku,
    width: extractWidthFromCode(sku.code),
  })).filter(item => item.width !== null) as Array<{
    sku: Product;
    width: number;
  }>;

  if (skusWithWidth.length === 0) {
    return {
      warning: "no_hinge_sku_widths_parseable",
    };
  }

  // Find closest match within tolerance
  let closest: { sku: Product; width: number; deviation: number } | null = null;

  for (const item of skusWithWidth) {
    const deviation = Math.abs(item.width - targetMm);
    
    if (deviation <= toleranceMm) {
      if (!closest || deviation < closest.deviation) {
        closest = { ...item, deviation };
      }
    }
  }

  if (!closest) {
    return {
      warning: "no_hinge_sku_within_tolerance",
      note: `No hinge panel SKU found within ±${toleranceMm}mm of ${targetMm}mm`,
    };
  }

  // If we snapped to a different width, include a note
  const wasSnapped = closest.width !== targetMm;
  
  return {
    sku: closest.sku.code,
    snappedWidthMm: closest.width,
    note: wasSnapped ? `snapped_from=${targetMm}_to=${closest.width}` : undefined,
  };
}
