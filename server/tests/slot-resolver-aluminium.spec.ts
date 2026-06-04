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
  describe("aluminium balustrade — BARR + Blade (AIRE engine)", () => {
    const balDesign = (variant: string, fieldValues: Record<string, string>, extra: Record<string, unknown> = {}) =>
      ({
        name: "Bal", productType: "aluminium-balustrade", productVariant: variant as any, shape: "inline",
        spans: [{
          spanId: "s1", length: 8000, maxPanelWidth: 1733, desiredGap: 50, layoutMode: "auto-equalize",
          panelLayout: { panels: [1365, 1365, 1365], gaps: [50, 50, 50, 50], totalPanelWidth: 4095, totalGapWidth: 200, averageGap: 50, panelTypes: ["standard", "standard", "standard"] },
          fieldValues, ...extra,
        }],
      } as unknown as import("@shared/schema").FenceDesign);

    it("BARR Bal base-plated timber: panels, C-brackets + caps, AIRE base-plate posts, domical covers, M10 LAG", () => {
      const skus = calculateComponents(balDesign("alu-bal-barr", { "bal-substrate": "base-plated", "bal-material": "timber" }, { balBarrFinish: "black" }), [], []).map(c => c.sku);
      expect(skus).toContain("BR-PANEL-1733-1000-B");   // panels
      expect(skus).toContain("BR-BR60-B-4PK");          // extended C-brackets
      expect(skus).toContain("BR-BRCAP-B-4PK");         // bracket caps
      expect(skus).toContain("AR-1050-FPBP-B");         // AIRE base-plate posts
      expect(skus).toContain("XP-DC-2P-B");             // domical covers
      expect(skus).toContain("S-110LAG-4PK");           // M10 LAG fixings
    });

    it("BARR Bal White core-drilled: XP white covers, AIRE 5800 posts, top plate, grout", () => {
      const skus = calculateComponents(balDesign("alu-bal-barr", { "bal-substrate": "core-drilled" }, { balBarrFinish: "white" }), [], []).map(c => c.sku);
      expect(skus).toContain("BR-PANEL-1733-1000-W");
      expect(skus).toContain("AR-5800-FP-W");
      expect(skus).toContain("XP-TP-W");                // top plate
      expect(skus).toContain("XP-DR-W");                // dress ring
      expect(skus).toContain("GROUT-SETFAST-10KG");
    });

    it("BARR Bal face-mount concrete: AIRE mid + L+R pack, dome nuts, M12 rod + chem anchor", () => {
      const skus = calculateComponents(balDesign("alu-bal-barr", { "bal-substrate": "face-mounted", "bal-material": "concrete" }, { balBarrFinish: "black" }), [], []).map(c => c.sku);
      expect(skus).toContain("AR-1500-FMID-B");         // mid posts
      expect(skus).toContain("AR-1500-FMLR-B-2PK");     // L+R end pack
      expect(skus).toContain("GS-DN-4PK-B");            // dome nuts (Black)
      expect(skus).toContain("GS150ROD");               // M12 rod
      expect(skus).toContain("SOUD-CA1400");            // chem anchor
    });

    it("Blade Bal base-plated timber: BLA panel, FastFit brackets (no cap), AIRE posts", () => {
      const comps = calculateComponents(
        { name: "B", productType: "aluminium-balustrade", productVariant: "alu-bal-blade" as any, shape: "inline",
          spans: [{ spanId: "s1", length: 8000, maxPanelWidth: 1700, desiredGap: 50, layoutMode: "auto-equalize",
            panelLayout: { panels: [1700, 1700], gaps: [50, 50, 50], totalPanelWidth: 3400, totalGapWidth: 150, averageGap: 50, panelTypes: ["standard", "standard"] },
            fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" } }] } as unknown as import("@shared/schema").FenceDesign,
        [], []);
      const skus = comps.map(c => c.sku);
      expect(skus).toContain("BLA-PNL-1700-1000-B");
      expect(skus).toContain("FF-BH-OPEN-4PK-B");
      expect(skus).toContain("AR-1050-FPBP-B");
      expect(skus).toContain("XP-DC-2P-B");
      expect(skus).not.toContain("BR-BRCAP-B-4PK");     // no bracket cap for FastFit
    });

    it("White face-mount uses Silver dome nuts (GS-DN-4PK), not Black", () => {
      const skus = calculateComponents(balDesign("alu-bal-barr", { "bal-substrate": "face-mounted", "bal-material": "steel" }, { balBarrFinish: "white" }), [], []).map(c => c.sku);
      expect(skus).toContain("GS-DN-4PK");              // Silver for White
      expect(skus).not.toContain("GS-DN-4PK-B");
      expect(skus).not.toContain("GS150ROD");           // steel = customer-supplied
    });
  });

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

  describe("alu-pool-tubular — full BOM", () => {
    it("Black timber deck: panels, shroud kits, posts, domical covers, tek screws", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2450, 2450], {
        tubularHeight: "1200mm", tubularFinish: "black", tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking" },
      });
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("SS-FTP-2450-B");     // panels
      expect(skus).toContain("SS-BH4-B");          // shroud kits (bracket-equivalent)
      expect(skus).toContain("SS-1300-BP-B");      // base-plate posts
      expect(skus).toContain("SS-DC-B");           // domical covers
      expect(skus).toContain("CSK-100-4PK");       // countersunk decking screws
    });

    it("Black 3000mm wide panel is emitted when chosen", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [3000, 3000], {
        tubularHeight: "1200mm", tubularFinish: "black", tubularPanelWidth: "3000mm",
        fieldValues: { "tubular-substrate": "decking" },
      });
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("SS-FTP-3000-B");
    });

    it("White uses cross-range XP- posts/covers and 2-SKU gate hardware", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2450, 975, 2450], {
        tubularHeight: "1200mm", tubularFinish: "white", tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking" },
        gateConfig: { required: true, gateSize: 975, position: 1, flipped: false,
          hardware: "polaris", hingeFrom: "glass", latchTo: "glass", hingeGap: 20, latchGap: 20 },
      });
      (design.spans[0] as any).panelLayout.panelTypes = ["standard", "gate", "standard"];
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("SS-FTP-2450-W");     // white panels
      expect(skus).toContain("XP-1300-BP-W");      // cross-range white posts
      expect(skus).toContain("XP-DC-2P-W");        // cross-range white domical cover
      expect(skus).toContain("SS-FTG-0975-W");     // white gate panel
      expect(skus).toContain("ML-TL-W");           // white latch (separate)
      expect(skus).toContain("TC-H-AT-2L-W");      // white hinge pair (separate)
      expect(skus).not.toContain("ML-TL-TC-H-AT"); // no bundled kit in white
    });

    it("Monument uses SS- posts and the Black bundled gate kit", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2450, 975, 2450], {
        tubularHeight: "1200mm", tubularFinish: "monument", tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking" },
        gateConfig: { required: true, gateSize: 975, position: 1, flipped: false,
          hardware: "polaris", hingeFrom: "glass", latchTo: "glass", hingeGap: 20, latchGap: 20 },
      });
      (design.spans[0] as any).panelLayout.panelTypes = ["standard", "gate", "standard"];
      const skus = calculateComponents(design, [], []).map(c => c.sku);
      expect(skus).toContain("SS-FTP-2450-MN");    // monument panels
      expect(skus).toContain("SS-1300-BP-MN");     // monument SS posts
      expect(skus).toContain("SS-DC-MN");          // monument cover
      expect(skus).toContain("ML-TL-TC-H-AT");     // bundled kit (B/MN)
    });

    it("emits horizontal swivel shrouds at angled corners", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2450, 2450], {
        tubularHeight: "1200mm", tubularFinish: "black", tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking", "tubular-angled-corners": "2" },
      });
      const swivel = calculateComponents(design, [], []).find(c => c.sku === "SS-BSWIV-HORIZ-B");
      expect(swivel).toBeDefined();
      expect(swivel?.qty).toBe(8);                 // 4 per angled corner × 2
    });
  });

  describe("alu-pool-tubular — slot resolution", () => {
    it("emits real slot SKU when 'panel' slot matches discriminators", () => {
      const products = [
        {
          id: "p-tub-2450",
          code: "SS-FTP-2450-B",
          description: "Flat Top Panel 2450 × 1200, Black",
          price: "250",
        },
      ];
      // BOM now sends real SKUs + finish code B/W/MN + 2450 stock (the wizard's model).
      const slots: SlotMapping[] = [
        {
          internalId: "SS-FTP-2450-B",
          fieldName: "panel",
          productId: "p-tub-2450",
          label: "Flat Top 2450 stock",
          discriminatorAttributes: {
            type: "standard",
            stock_width: "2450",
            height: "1200mm",
            cut_width: "2450",
            finish: "B",
          },
        },
      ];

      const design = makeAluminiumDesign("alu-pool-tubular", [2450], {
        tubularHeight: "1200mm",
        tubularFinish: "black",
        tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking" },
      });

      const components = calculateComponents(design, slots, products);
      const panelComp = components.find(c => c.sku === "SS-FTP-2450-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toBe("Flat Top Panel 2450 × 1200, Black");
    });

    it("falls back to the real storefront SKU when no slot exists", () => {
      const design = makeAluminiumDesign("alu-pool-tubular", [2450], {
        tubularHeight: "1200mm",
        tubularFinish: "black",
        tubularPanelWidth: "2450mm",
        fieldValues: { "tubular-substrate": "decking" },
      });

      const components = calculateComponents(design, [], []);
      const panelComp = components.find(c => c.sku === "SS-FTP-2450-B");
      expect(panelComp).toBeDefined();
      expect(panelComp?.description).toContain("Flat Top Panel 2450 x 1200mm");
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
