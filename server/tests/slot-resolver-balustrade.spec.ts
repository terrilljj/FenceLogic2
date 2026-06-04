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
      // NonoRail 25×21 maps to the real Summit catalogue family (STG-…-2521), not a
      // made-up RAIL-* placeholder. Rail length SKU + the wall-tie terminator.
      const rail = components.find(c => (c.sku ?? "").startsWith("STG-R5800-2521-"));
      expect(rail).toBeDefined();
      // wall-tie termination → STG-2521-WP-{finish}; end-cap is factory-fitted (no SKU).
      expect(components.some(c => (c.sku ?? "").startsWith("STG-2521-WP-"))).toBe(true);
      expect(components.some(c => /^RAIL-(NONORAIL|SERIES)/.test(c.sku ?? ""))).toBe(false);
    });
  });

  describe("glass-bal-standoffs", () => {
    it("emits real GSA/GS50 standoff SKUs at 4 (≤750) / 6 (≥800) per panel", () => {
      // adjustable (default) polished, 3 panels all >750 → 6 each = 18 → GSA-5030-P
      const adj = calculateComponents(
        makeBalustradeDesign("glass-bal-standoffs", [1200, 1200, 1000], { spigotColor: "polished" }), [], [],
      );
      const standoff = adj.find(c => c.sku === "GSA-5030-P");
      expect(standoff).toBeDefined();
      expect(standoff?.qty).toBe(18);
      expect(adj.some(c => /^STANDOFF-50/.test(c.sku ?? ""))).toBe(false);

      // fixed black 50mm → GS5050B; mixed widths 700 (4) + 900 (6) = 10
      const fixed = calculateComponents(
        makeBalustradeDesign("glass-bal-standoffs", [700, 900], {
          spigotColor: "black", fieldValues: { "standoff-body": "fixed", "standoff-depth": "50" },
        }), [], [],
      );
      const gs = fixed.find(c => c.sku === "GS5050B");
      expect(gs).toBeDefined();
      expect(gs?.qty).toBe(10);

      // fixed white uses the dashed -MW form
      const white = calculateComponents(
        makeBalustradeDesign("glass-bal-standoffs", [600], {
          spigotColor: "white", fieldValues: { "standoff-body": "fixed", "standoff-depth": "30" },
        }), [], [],
      );
      expect(white.some(c => c.sku === "GS5030-MW")).toBe(true);
    });
  });

  describe("35-Series rail → real SER35 catalogue SKUs", () => {
    it("emits SER35-R5800-{finish} + real terminators, no RAIL-* placeholder", () => {
      const design = makeBalustradeDesign("glass-bal-spigots-15mm", [1400, 1400], {
        handrail: { enabled: true, type: "series-35x35", material: "anodised-aluminium", finish: "satin", startTermination: "wall-tie", endTermination: "90-degree" },
      });
      const comps = calculateComponents(design, [], []);
      expect(comps.some(c => c.sku === "SER35-R5800-SA")).toBe(true);     // satin rail
      expect(comps.some(c => c.sku === "SER35-WB-S")).toBe(true);          // wall-tie (wall-plate finish = S)
      expect(comps.some(c => c.sku === "SER35-J90-SA")).toBe(true);        // 90° corner (joiners always SA)
      expect(comps.some(c => /^RAIL-(SERIES|NONORAIL)/.test(c.sku ?? ""))).toBe(false);
    });

    it("black 35-Series rail uses -B; end-cap termination emits no separate SKU", () => {
      const design = makeBalustradeDesign("glass-bal-channel", [1200, 1200], {
        fieldValues: { "channel-finish": "black" },
        handrail: { enabled: true, type: "series-35x35", material: "anodised-aluminium", finish: "black", startTermination: "end-cap", endTermination: "end-cap" },
      });
      const comps = calculateComponents(design, [], []);
      expect(comps.some(c => c.sku === "SER35-R5800-B")).toBe(true);
      // end-cap is factory-fitted to the rail → no SER35-EC line emitted.
      expect(comps.some(c => /^SER35-EC/.test(c.sku ?? ""))).toBe(false);
    });
  });

  describe("glass-bal-channel-hd (VersaTilt Heavy Duty 17.52 SGP)", () => {
    it("emits 17.52 SGP laminated glass + HD channel hardware", () => {
      const comps = calculateComponents(
        makeBalustradeDesign("glass-bal-channel-hd", [1150, 1150], {
          fieldValues: { "channel-finish": "satin-anodised" },
          handrail: { enabled: true, type: "series-35x35", material: "anodised-aluminium", finish: "satin", startTermination: "end-cap", endTermination: "end-cap" },
        }),
        [], [],
      );
      const glass = comps.find(c => /Bal Glass/.test(c.description ?? ""));
      expect(glass?.description).toContain("17.52mm Toughened SGP Laminated HD Channel Bal Glass");
      expect(glass?.sku).toBe("1000SGP1752-1150");
      expect(comps.some(c => /^VER-HD-3600-DMK-/.test(c.sku ?? ""))).toBe(true);
      expect(comps.some(c => c.sku === "VER-HD-PPKIT-17-4PK")).toBe(true);
      expect(comps.some(c => c.sku === "VER-HD-WASHER-18PK")).toBe(true);
      expect(comps.some(c => c.sku === "SER35-17KIT-RUB")).toBe(true);
      // Must NOT emit the standard 15mm channel SKUs.
      expect(comps.some(c => /^VER-4200-DMK/.test(c.sku ?? ""))).toBe(false);
    });

    it("standard glass-bal-channel emits VersaTilt 4200 channel hardware (was missing)", () => {
      const comps = calculateComponents(
        makeBalustradeDesign("glass-bal-channel", [1150, 1150], {
          fieldValues: { "channel-finish": "black" },
        }),
        [], [],
      );
      expect(comps.some(c => c.sku === "VER-4200-DMK-B")).toBe(true);
      expect(comps.some(c => c.sku === "VER-PPKIT-15MM")).toBe(true);
      expect(comps.some(c => c.sku === "VER-WASHER-14PK")).toBe(true);
      // 15mm glass, not 17.52.
      expect(comps.some(c => /17\.52/.test(c.description ?? ""))).toBe(false);
    });
  });

  describe("glass-bal AS1288 fall-height glass line", () => {
    it("spigots-15mm: toughened monolithic <5m, laminated 16mm at >=5m", () => {
      const mono = calculateComponents(
        makeBalustradeDesign("glass-bal-spigots-15mm", [1150, 1150], { fieldValues: { "glass-bal-fall-height": "1m-5m" } }),
        [], [],
      );
      const monoGlass = mono.find(c => /Frameless Bal Glass/.test(c.description ?? ""));
      expect(monoGlass).toBeDefined();
      expect(monoGlass?.description).toContain("15mm Toughened Frameless Bal Glass");
      expect(monoGlass?.sku).toBe("1000FBG-1150");

      const lam = calculateComponents(
        makeBalustradeDesign("glass-bal-spigots-15mm", [1150, 1150], { fieldValues: { "glass-bal-fall-height": "over-5m" } }),
        [], [],
      );
      const lamGlass = lam.find(c => /Bal Glass/.test(c.description ?? ""));
      expect(lamGlass?.description).toContain("16mm Toughened Laminated");
      expect(lamGlass?.sku).toBe("1000FBG-1150-LAM");
    });

    it("spigots-12mm: 11.52mm laminated at >=5m (970H)", () => {
      const lam = calculateComponents(
        makeBalustradeDesign("glass-bal-spigots-12mm", [1450], { fieldValues: { "glass-bal-fall-height": "over-5m" } }),
        [], [],
      );
      const g = lam.find(c => /Bal Glass/.test(c.description ?? ""));
      expect(g?.description).toContain("11.52mm Toughened Laminated Frameless Bal Glass 1450W × 970H");
      expect(g?.sku).toBe("970NTG-1450-LAM");
    });

    it("standoffs: 15mm 1280H pre-drilled; no stale pool GP- line", () => {
      const comps = calculateComponents(
        makeBalustradeDesign("glass-bal-standoffs", [1000], { spigotColor: "polished", spigotMounting: "core-drilled" }),
        [], [],
      );
      const g = comps.find(c => /Bal Glass/.test(c.description ?? ""));
      expect(g?.description).toContain("15mm Toughened Standoff Bal Glass 1000W × 1280H, pre-drilled");
      expect(g?.sku).toBe("1280S-1000");
      expect(comps.some(c => /^GP-\d+-1200-12$/.test(c.sku ?? ""))).toBe(false);
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
      // BOM now emits real SKUs + finish code B/W + a type discriminator.
      const slots: SlotMapping[] = [
        {
          internalId: "BR-PANEL-1733-1000-B",
          fieldName: "panel",
          productId: "p-bbarr-1000",
          label: "BARR Bal panel 1000H",
          discriminatorAttributes: {
            type: "standard",
            width: "1733",
            height: "1000",
            finish: "B",
          },
        },
      ];

      const design = makeBalustradeDesign("alu-bal-barr", [1733], {
        balBarrPanelHeight: "1000mm",
        balBarrFinish: "black",
        fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" },
      }, "aluminium-balustrade");

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BR-PANEL-1733-1000-B-REAL");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Real BARR Bal Panel 1733×1000 Black");
    });

    it("falls back to the real storefront panel SKU when no slot exists", () => {
      const design = makeBalustradeDesign("alu-bal-barr", [1733], {
        balBarrPanelHeight: "1000mm",
        balBarrFinish: "black",
        fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" },
      }, "aluminium-balustrade");

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BR-PANEL-1733-1000-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("BARR Balustrade Panel 1733");
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
            type: "standard",
            width: "1700",
            height: "1000",
            finish: "B",
          },
        },
      ];

      const design = makeBalustradeDesign("alu-bal-blade", [1700], {
        fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" },
      }, "aluminium-balustrade");

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "BLA-PNL-1700-1000-B-REAL");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Real Blade Bal Panel 1700×1000 Black");
    });

    it("falls back to the real storefront panel SKU when no slot exists", () => {
      const design = makeBalustradeDesign("alu-bal-blade", [1700], {
        fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" },
      }, "aluminium-balustrade");

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "BLA-PNL-1700-1000-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("Blade Balustrade Panel 1700");
    });
  });
});
