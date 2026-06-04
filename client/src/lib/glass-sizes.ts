/**
 * Actual stocked glass panel widths per family (mirrors bh_storefront.products).
 * The Max Panel Width dropdown must offer ONLY these real sizes — several families are
 * non-uniform (1280S standoffs, 1100SGP HD), so a generated "200..cap @ 50mm" list is wrong.
 */
export const GLASS_STOCK_SIZES: Record<string, number[]> = {
  // 15mm Frameless Bal Glass — bal spigots 15mm + VersaTilt channel 15mm
  "1000FBG": [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400],
  // SUMMIT Frameless Bal Glass — bal spigots 12mm (stock to 1800; dropdown capped at the PTS span)
  "970NTG": [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800],
  // Standoff Bal Glass 1280H pre-drilled — NON-UNIFORM (100mm 400→600, then 50mm)
  "1280S": [400, 500, 600, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200],
  // VersaTilt HD 17.52 SGP laminated — NON-UNIFORM (100mm below 1000, 50mm above)
  "1100SGP": [600, 700, 800, 900, 1000, 1050, 1100, 1150, 1200, 1250, 1300],
  // 12mm Clear Toughened Frameless — pool spigots + pool channel
  "12N": [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000],
};

/** Glass family for a calculator variant. */
export function glassFamilyFor(variant: string): keyof typeof GLASS_STOCK_SIZES {
  if (variant === "glass-bal-channel-hd") return "1100SGP";
  if (variant === "glass-bal-standoffs") return "1280S";
  if (variant.includes("12mm")) return "970NTG";              // bal spigots 12mm
  if (variant === "glass-bal-spigots-15mm" || variant === "glass-bal-spigots") return "1000FBG";
  if (variant === "glass-bal-channel") return "1000FBG";
  return "12N";                                                // pool spigots / pool channel
}

/** Actual selectable Max Panel Widths for a variant — real stock sizes ≤ the PTS span cap. */
export function glassMaxPanelSizes(variant: string, capMm: number): number[] {
  return (GLASS_STOCK_SIZES[glassFamilyFor(variant)] ?? []).filter((w) => w <= capMm);
}
