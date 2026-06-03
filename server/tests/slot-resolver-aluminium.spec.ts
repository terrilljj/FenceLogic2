import { describe, it, expect } from "vitest";
import { calculateComponents, type SlotMapping } from "../services/bom-calculator";
import type { FenceDesign } from "@shared/schema";

// Minimal design factory for aluminium variants. Extra span fields (tubularHeight,
// barrHeight, etc.) are set via overrides since the strict SpanConfig type doesn't
// surface them.
function makeAluminiumDesign(
  productVariant: string,
  panelWidths: number[],
  spanOverrides: Record<string, unknown> = {},
): FenceDesign {
  return {
    name: "Test Aluminium Design",
    productType: "aluminium-pool",
    productVariant: productVariant as any,
    shape: "inline",
    spans: [
      {
        spanId: "s1",
        length: 5000,
        maxPanelWidth: 2400,
        desiredGap: 50,
        layoutMode: "auto-equalize",
        panelLayout: {
          panels: panelWidths,
          gaps: panelWidths.map(() => 50),
          totalPanelWidth: panelWidths.reduce((a, b) => a + b, 0),
          totalGapWidth: panelWidths.length * 50,
          averageGap: 50,
          panelTypes: panelWidths.map(() => "standard" as const),
        },
        ...spanOverrides,
      },
    ],
  } as unknown as FenceDesign;
}

describe("aluminium branches — slot resolution with template-literal fallback", () => {
  describe("alu-pool-blade", () => {
    it("emits the full hardware set on a timber deck (FastFit brackets, covers, fixings)", () => {
      const design = makeAluminiumDesign("alu-pool-blade", [2200, 2200], {
        bladeHeight: "1200mm",
        fieldValues: { "blade-substrate": "decking" },
      });
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("BLA-PNL-2200-1200-B");       // panels
      expect(skus).toContain("SS-1300-BP-B");               // base-plate posts
      expect(skus).toContain("SS-DC-B");                    // domical covers
      expect(skus).toContain("FF-BH-OPEN-4PK-B");           // FastFit brackets
      expect(skus).toContain("CSK-100-4PK");                // countersunk decking screws
    });

    it("emits the D&D bundled kit (one SKU) and grout on a core-drilled gate run", () => {
      const design = makeAluminiumDesign("alu-pool-blade", [2200, 975, 2200], {
        bladeHeight: "1200mm",
        fieldValues: { "blade-substrate": "core-drilled" },
        gateConfig: { required: true, gateSize: 975, position: 1, flipped: false,
          hardware: "polaris", hingeFrom: "glass", latchTo: "glass", hingeGap: 20, latchGap: 20 },
      });
      (design.spans[0] as any).panelLayout.panelTypes = ["standard", "gate", "standard"];
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("BLA-GATE-0975-1200-B");       // gate panel
      expect(skus).toContain("ML-TL-TC-H-AT");              // D&D bundled kit (Black, 1 SKU)
      expect(skus).toContain("XP-DR-B");                    // core-drilled dress rings
      expect(skus).toContain("GROUT-SETFAST-10KG");         // grout
    });
  });

  describe("alu-pool-tubular", () => {
    it("emits real slot SKU when 'panel' slot matches discriminators", () => {
      const products = [
        {
          id: "p-tub-2400",
          code: "TUB-FT-2400-BLK",
          description: "Tubular Flat Top 1200H × 2400W, Black",
          price: "250",
        },
      ];
      const slots: SlotMapping[] = [
        {
          internalId: "TUB-FT-2400-BLK",
          fieldName: "panel",
          productId: "p-tub-2400",
          label: "Tubular 1200 stock",
          discriminatorAttributes: {
            type: "standard",
            stock_width: "2400",
            height: "1200mm",
            cut_width: "2400",
            finish: "BLACK",
          },
        },
      ];

      const design = makeAluminiumDesign("alu-pool-tubular", [2400], {
        tubularHeight: "1200mm",
        tubularFinish: "black",
        tubularPanelWidth: "2400mm",
        tubularPostType: "welded-base-plate",
      });

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "TUB-FT-2400-BLK");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Tubular Flat Top 1200H × 2400W, Black");
    });

    it("falls back to template-literal SKU when no slot exists", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2400], {
        tubularHeight: "1200mm",
        tubularFinish: "black",
        tubularPanelWidth: "2400mm",
        tubularPostType: "welded-base-plate",
      });

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "TUBULAR-1200mm-2400-BLACK");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("Tubular Flat Top Panel 1200mm x 2400mm");
    });
  });

  describe("alu-pool-barr", () => {
    it("emits real slot SKU when 'panel' slot matches discriminators", () => {
      const products = [
        {
          id: "p-barr-1200",
          code: "BR-PANEL-2205-1200-B",
          description: "BARR Panel 1200H × 2205W Satin Black",
          price: "295",
        },
      ];
      // BOM now emits real storefront SKUs + finish code B/W (the wizard's data model).
      const slots: SlotMapping[] = [
        {
          internalId: "BR-PANEL-2205-1200-B",
          fieldName: "panel",
          productId: "p-barr-1200",
          label: "BARR 1200 stock",
          discriminatorAttributes: {
            type: "standard",
            stock_width: "2205",
            height: "1200mm",
            cut_width: "2205",
            finish: "B",
          },
        },
      ];

      const design = makeAluminiumDesign("alu-pool-barr", [2205], {
        barrHeight: "1200mm",
        barrFinish: "satin-black",
        fieldValues: { "barr-substrate": "decking" },
      });

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BR-PANEL-2205-1200-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("BARR Panel 1200H × 2205W Satin Black");
    });

    it("falls back to the real storefront SKU when no slot exists", () => {
      const design = makeAluminiumDesign("alu-pool-barr", [2205], {
        barrHeight: "1200mm",
        barrFinish: "satin-black",
        fieldValues: { "barr-substrate": "decking" },
      });

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BR-PANEL-2205-1200-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("BARR Panel 2205 x 1200mm");
    });

    it("emits the full hardware set on a timber deck (brackets, caps, covers, fixings)", () => {
      const design = makeAluminiumDesign("alu-pool-barr", [2205, 2205], {
        barrHeight: "1200mm",
        barrFinish: "satin-black",
        fieldValues: { "barr-substrate": "decking" },
      });
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      // 2 panels → 3 posts on a single run.
      expect(skus).toContain("BR-PANEL-2205-1200-B");      // panels
      expect(skus).toContain("BR-1280-BP-B");               // base-plate posts
      expect(skus).toContain("BR-DC-2P-B");                 // domical covers
      expect(skus).toContain("BR-BR25-B-4PK");              // C-brackets
      expect(skus).toContain("BR-BRCAP-B-4PK");             // bracket caps
      expect(skus).toContain("CSK-100-4PK");                // countersunk decking screws
    });

    it("emits finish-asymmetric White gate hardware as two SKUs", () => {
      const design = makeAluminiumDesign("alu-pool-barr", [2205, 975, 2205], {
        barrHeight: "1200mm",
        barrFinish: "pearl-white",
        fieldValues: { "barr-substrate": "decking" },
        gateConfig: { required: true, gateSize: 975, position: 1, flipped: false,
          hardware: "polaris", hingeFrom: "glass", latchTo: "glass", hingeGap: 20, latchGap: 20 },
      });
      // Mark the middle panel as the gate.
      (design.spans[0] as any).panelLayout.panelTypes = ["standard", "gate", "standard"];
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("BR-GATE-0975-1200-W");        // white gate panel
      expect(skus).toContain("ML-TL-W");                    // white latch (separate)
      expect(skus).toContain("TC-H-AT-2L-W");               // white hinge pair (separate)
      expect(skus).not.toContain("ML-TL-TC-H-AT");          // NO bundled kit in white
      expect(skus).toContain("XP-1300-BP-W");               // cross-range 50×50 gate posts
    });
  });
});
