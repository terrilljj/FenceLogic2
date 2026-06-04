import { describe, it, expect } from "vitest";
import { computeSpanLayout } from "../services/layout/layout-service";

// VersaTilt HD glass is the 1100SGP laminated family — fixed-stock only (no made-to-order).
// The solver must snap every HD panel onto a stock size so the BOM emits an exact SKU.
const STOCK = [600, 700, 800, 900, 1000, 1050, 1100, 1150, 1200, 1250, 1300];

function hdLayout(length: number) {
  return computeSpanLayout({
    productVariant: "glass-bal-channel-hd",
    gatesAllowed: false,
    span: {
      length, maxPanelWidth: 1300, desiredGap: 20, layoutMode: "auto-equalize",
      leftGap: { enabled: true, size: 20 }, rightGap: { enabled: true, size: 20 },
    } as any,
  }).panelLayout;
}

describe("glass-bal-channel-hd — SGP stock-size snap", () => {
  it("every HD panel lands on a 1100SGP stock size, with valid gaps, across run lengths", () => {
    for (let L = 1500; L <= 9000; L += 50) {
      const lay = hdLayout(L);
      if (!lay?.panels?.length) continue;
      for (const w of lay.panels) expect(STOCK).toContain(w);
      for (const g of lay.gaps ?? []) { expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(125); }
    }
  });

  it("a 2-panel short run snaps to an UNEQUAL stock split (e.g. 900 + 1000), not an off-stock 950/950", () => {
    const lay = hdLayout(2000);
    expect(lay?.panels?.every((w) => STOCK.includes(w))).toBe(true);
    expect(lay?.panels).not.toContain(950);
  });

  it("standard 15mm channel is NOT snapped (keeps the 1000FBG 50mm grid)", () => {
    const lay = computeSpanLayout({
      productVariant: "glass-bal-channel", gatesAllowed: false,
      span: { length: 2000, maxPanelWidth: 1400, desiredGap: 20, layoutMode: "auto-equalize",
        leftGap: { enabled: true, size: 20 }, rightGap: { enabled: true, size: 20 } } as any,
    }).panelLayout;
    // 50mm-grid widths like 950 are valid for 1000FBG and must be left alone.
    expect(lay?.panels?.every((w) => w % 50 === 0)).toBe(true);
  });
});
