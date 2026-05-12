import { describe, it, expect } from "vitest";
import { calculateComponents, type SlotMapping } from "../services/bom-calculator";
import type { FenceDesign } from "@shared/schema";

// Minimal design factory for balustrade variants. The strict SpanConfig type doesn't
// surface every dynamic field, so we cast at the end. spanOverrides lets each test
// supply variant-specific fields (balBarrPanelHeight, glassThickness, etc.).
function makeBalustradeDesign(
  productVariant: string,
  panelWidths: number[],
  spanOverrides: Record<string, unknown> = {},
  productType: string = "glass-balustrade",
): FenceDesign {
  return {
    name: "Test Balustrade Design",
    productType: productType as any,
    productVariant: productVariant as any,
    shape: "inline",
    spans: [
      {
        spanId: "s1",
        length: 5000,
        maxPanelWidth: 1200,
        desiredGap: 20,
        layoutMode: "auto-equalize",
        panelLayout: {
          panels: panelWidths,
          gaps: panelWidths.map(() => 20),
          totalPanelWidth: panelWidths.reduce((a, b) => a + b, 0),
          totalGapWidth: panelWidths.length * 20,
          averageGap: 20,
          panelTypes: panelWidths.map(() => "standard" as const),
        },
        ...spanOverrides,
      },
    ],
  } as unknown as FenceDesign;
}

describe("balustrade branches — slot resolution with template-literal fallback", () => {
  describe("glass-bal-spigots-12mm", () => {
    it("matches isGlassBalustrade and runs balustrade rail logic when handrail is configured", () => {
      const design = makeBalustradeDesign("glass-bal-spigots-12mm", [1200, 1200], {
        glassThickness: "12mm",
        handrail: {
          enabled: true,
          type: "nonorail-25x21",
          material: "stainless-steel",
          finish: "polished",
          startTermination: "end-cap",
          endTermination: "wall-tie",
        },
      });

      const components = calculateComponents(design, [], []);
      // Rail termination SKUs come from the isGlassBalustrade rail-optimisation block
      // and only appear when the suffixed variant is matched via startsWith.
      const railTerminations = components.filter(c => (c.sku ?? "").startsWith("RAIL-NONORAIL-25X21-"));
      expect(railTerminations.length).toBeGreaterThan(0);
    });
  });

  describe("glass-bal-standoffs", () => {
    it("emits no spigot SKUs and emits standoff-hardware at 4 per panel", () => {
      const design = makeBalustradeDesign("glass-bal-standoffs", [1200, 1200, 1000], {
        spigotColor: "polished",
        spigotMounting: "core-drilled",
      });

      const components = calculateComponents(design, [], []);
      // No spigot SKUs should appear (default fallback prefix is "SP-")
      const spigotSkus = components.filter(c => /^SP-/.test(c.sku ?? ""));
      expect(spigotSkus).toHaveLength(0);

      // Standoff hardware fallback: 3 panels × 4 = 12 units
      const standoff = components.find(c => c.sku === "STANDOFF-50-POLISHED");
      expect(standoff).toBeDefined();
      expect(standoff?.qty).toBe(12);
    });
  });

  describe("alu-bal-barr", () => {
    it("emits real slot SKU when 'panel' slot matches discriminators", () => {
      const products = [
        {
          id: "p-bbarr-1000",
          code: "BR-PANEL-1733-1000-B-REAL",
          description: "Real BARR Bal Panel 1733×1000 Black",
          price: "240",
        },
      ];
      const slots: SlotMapping[] = [
        {
          internalId: "BR-PANEL-1733-1000-B",
          fieldName: "panel",
          productId: "p-bbarr-1000",
          label: "BARR Bal panel 1000H",
          discriminatorAttributes: {
            width: "1733",
            height: "1000",
            finish: "black",
          },
        },
      ];

      const design = makeBalustradeDesign("alu-bal-barr", [1733], {
        balBarrPanelHeight: "1000mm",
        balBarrFinish: "black",
        balBarrPostMounting: "face-mount",
      }, "aluminium-balustrade");

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BR-PANEL-1733-1000-B-REAL");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Real BARR Bal Panel 1733×1000 Black");
    });

    it("falls back to template-literal panel SKU when no slot exists", () => {
      const design = makeBalustradeDesign("alu-bal-barr", [1733], {
        balBarrPanelHeight: "1000mm",
        balBarrFinish: "black",
        balBarrPostMounting: "face-mount",
      }, "aluminium-balustrade");

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BR-PANEL-1733-1000-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("Bal BARR Panel 1733×1000");
    });
  });

  describe("alu-bal-blade", () => {
    it("emits real slot SKU when 'panel' slot matches discriminators", () => {
      const products = [
        {
          id: "p-bblade-1000",
          code: "BLA-PNL-1700-1000-B-REAL",
          description: "Real Blade Bal Panel 1700×1000 Black",
          price: "220",
        },
      ];
      const slots: SlotMapping[] = [
        {
          internalId: "BLA-PNL-1700-1000-B",
          fieldName: "panel",
          productId: "p-bblade-1000",
          label: "Blade Bal panel",
          discriminatorAttributes: {
            width: "1700",
            height: "1000",
          },
        },
      ];

      const design = makeBalustradeDesign("alu-bal-blade", [1700], {
        balBladePostMounting: "face-mount",
      }, "aluminium-balustrade");

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BLA-PNL-1700-1000-B-REAL");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Real Blade Bal Panel 1700×1000 Black");
    });

    it("falls back to template-literal panel SKU when no slot exists", () => {
      const design = makeBalustradeDesign("alu-bal-blade", [1700], {
        balBladePostMounting: "face-mount",
      }, "aluminium-balustrade");

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BLA-PNL-1700-1000-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("Bal Blade Panel 1700×1000");
    });
  });
});
