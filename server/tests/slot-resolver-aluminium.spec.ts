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
          code: "BARR-1200-2205-SB",
          description: "BARR Panel 1200H × 2205W Satin Black",
          price: "295",
        },
      ];
      const slots: SlotMapping[] = [
        {
          internalId: "BARR-1200-2205-SB",
          fieldName: "panel",
          productId: "p-barr-1200",
          label: "BARR 1200 stock",
          discriminatorAttributes: {
            type: "standard",
            stock_width: "2205",
            height: "1200mm",
            cut_width: "2205",
            finish: "CN150A",
          },
        },
      ];

      const design = makeAluminiumDesign("alu-pool-barr", [2205], {
        barrHeight: "1200mm",
        barrFinish: "satin-black",
        barrPostType: "welded-base-plate",
      });

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BARR-1200-2205-SB");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("BARR Panel 1200H × 2205W Satin Black");
    });

    it("falls back to template-literal SKU when no slot exists", () => {
      const design = makeAluminiumDesign("alu-pool-barr", [2205], {
        barrHeight: "1200mm",
        barrFinish: "satin-black",
        barrPostType: "welded-base-plate",
      });

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BARR-1200-2205-CN150A");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("BARR Panel 1200mm x 2205mm");
    });
  });
});
