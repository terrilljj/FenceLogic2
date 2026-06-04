import { describe, it, expect } from "vitest";
import { calculateComponents, type SlotMapping } from "../services/bom-calculator";
import type { FenceDesign } from "@shared/schema";

// Minimal design factory
function makeDesign(productVariant: string, panelWidths: number[]): FenceDesign {
  return {
    name: "Test Design",
    productType: "glass-pool",
    productVariant: productVariant as any,
    shape: "inline",
    spans: [
      {
        spanId: "s1",
        length: 5000,
        maxPanelWidth: 1500,
        desiredGap: 50,
        spigotMounting: "base-plate",
        spigotColor: "polished",
        layoutMode: "auto-equalize",
        panelLayout: {
          panels: panelWidths,
          gaps: panelWidths.map(() => 50),
          totalPanelWidth: panelWidths.reduce((a, b) => a + b, 0),
          totalGapWidth: panelWidths.length * 50,
          averageGap: 50,
          panelTypes: panelWidths.map(() => "standard" as const),
        },
      },
    ],
  } as unknown as FenceDesign;
}

const products = [
  { id: "p1200", code: "12N-1200", description: "Glass Panel 1200mm x 1200mm", price: "300" },
  { id: "p1000", code: "12N-1000", description: "Glass Panel 1000mm x 1200mm", price: "250" },
  { id: "pMAD", code: "MAD-S-P",  description: "Madrid Base Plate Spigot Polished", price: "52" },
  { id: "pINS", code: "INS-S-SG", description: "Inspire Spigot Satin Grey",         price: "48" },
];

describe("lookupSlot — discriminatorAttributes path", () => {
  it("resolves glass panel by size_mm discriminator", () => {
    const slots: SlotMapping[] = [
      { internalId: "GP-1200", fieldName: "glass-panels", productId: "p1200", label: null,
        discriminatorAttributes: { size_mm: "1200" } },
      { internalId: "GP-1000", fieldName: "glass-panels", productId: "p1000", label: null,
        discriminatorAttributes: { size_mm: "1000" } },
    ];
    const design = makeDesign("glass-pool-spigots", [1200, 1200, 1000]);
    const components = calculateComponents(design, slots, products);
    const descriptions = components.map(c => c.description);
    expect(descriptions).toContain("Glass Panel 1200mm x 1200mm");
    expect(descriptions).toContain("Glass Panel 1000mm x 1200mm");
  });

  it("falls back to hardcoded description when no matching slot", () => {
    const slots: SlotMapping[] = [
      { internalId: "GP-1400", fieldName: "glass-panels", productId: "p1200", label: null,
        discriminatorAttributes: { size_mm: "1400" } },
    ];
    const design = makeDesign("glass-pool-spigots", [1200]);
    const components = calculateComponents(design, slots, products);
    const panels = components.filter(c => (c.sku ?? "").startsWith("12N-"));
    // No slot for 1200mm → real 12N pool-glass family fallback (zero-padded width)
    expect(panels[0].description).toBe("12mm Clear Toughened Frameless Glass 1200W × 1200H");
    expect(panels[0].sku).toBe("12N-1200");
  });

  it("legacy path — resolves by regex when discriminatorAttributes is null", () => {
    const slots: SlotMapping[] = [
      { internalId: "GP-1200", fieldName: "glass-panels", productId: "p1200", label: null,
        discriminatorAttributes: null },
    ];
    const design = makeDesign("glass-pool-spigots", [1200]);
    const components = calculateComponents(design, slots, products);
    const panels = components.filter(c => c.description === "Glass Panel 1200mm x 1200mm");
    expect(panels.length).toBe(1);
  });

  it("resolves spigot-hardware by family + mounting + finish discriminators", () => {
    const slots: SlotMapping[] = [
      {
        internalId: "SP-MAD-BP-P",
        fieldName: "spigot-hardware",
        productId: "pMAD",
        label: null,
        discriminatorAttributes: { family: "madrid", mounting: "base-plate", finish: "polished" },
      },
      {
        internalId: "SP-INS-BP-SG",
        fieldName: "spigot-hardware",
        productId: "pINS",
        label: null,
        discriminatorAttributes: { family: "inspire", mounting: "base-plate", finish: "satin" },
      },
    ];

    const madridDesign = makeDesign("glass-pool-spigots", [1200]);
    // Inject spigotFamily via fieldValues
    (madridDesign.spans[0] as any).fieldValues = {
      "spigot-family": "madrid",
      "spigot-mounting": "base-plate",
      "spigot-color": "polished",
    };

    const components = calculateComponents(madridDesign, slots, products);
    const spigots = components.filter(c => c.description === "Madrid Base Plate Spigot Polished");
    expect(spigots.length).toBeGreaterThan(0);
    expect(spigots[0].qty).toBe(2);
  });

  it("falls back to getSpigotDetails when no spigot-hardware slot matches", () => {
    const slots: SlotMapping[] = []; // No spigot slots at all
    const design = makeDesign("glass-pool-spigots", [1200]);
    const components = calculateComponents(design, slots, products);
    const spigots = components.filter(c => c.description.includes("Spigot"));
    expect(spigots.length).toBeGreaterThan(0);
    // Fallback to legacy generic description
    expect(spigots[0].description).toContain("Spigot");
  });

  it("does not match spigot slot when discriminators differ", () => {
    const slots: SlotMapping[] = [
      {
        internalId: "SP-MAD-CD-P",
        fieldName: "spigot-hardware",
        productId: "pMAD",
        label: null,
        discriminatorAttributes: { family: "madrid", mounting: "core-drilled", finish: "polished" },
      },
    ];
    const design = makeDesign("glass-pool-spigots", [1200]);
    // Span has base-plate, slot requires core-drilled — should not match
    (design.spans[0] as any).fieldValues = {
      "spigot-family": "madrid",
      "spigot-mounting": "base-plate",
      "spigot-color": "polished",
    };
    const components = calculateComponents(design, slots, products);
    const madrids = components.filter(c => c.description === "Madrid Base Plate Spigot Polished");
    // No match for core-drilled slot when base-plate requested → fallback generic
    expect(madrids.length).toBe(0);
  });

  it("preserves existing 35 mapped glass panels — all resolve correctly", () => {
    // Simulate 3 glass panel slots (representative subset of the 35)
    const panelWidths = [1000, 1200, 1500];
    const slotProducts = [
      { id: "pp1000", code: "12N-1000", description: "Glass Panel 1000mm x 1200mm (12mm)", price: "250" },
      { id: "pp1200", code: "12N-1200", description: "Glass Panel 1200mm x 1200mm (12mm)", price: "300" },
      { id: "pp1500", code: "12N-1500", description: "Glass Panel 1500mm x 1200mm (12mm)", price: "370" },
    ];
    const slots: SlotMapping[] = panelWidths.map((w, i) => ({
      internalId: `GP-${String(w).padStart(4, "0")}`,
      fieldName: "glass-panels",
      productId: slotProducts[i].id,
      label: null,
      discriminatorAttributes: { size_mm: String(w) },
    }));

    const design = makeDesign("glass-pool-spigots", panelWidths);
    const components = calculateComponents(design, slots, slotProducts);
    const panelComponents = components.filter(c => c.description.includes("Glass Panel"));
    expect(panelComponents).toHaveLength(3);
    expect(panelComponents.map(c => c.description)).toContain("Glass Panel 1000mm x 1200mm (12mm)");
    expect(panelComponents.map(c => c.description)).toContain("Glass Panel 1200mm x 1200mm (12mm)");
    expect(panelComponents.map(c => c.description)).toContain("Glass Panel 1500mm x 1200mm (12mm)");
  });
});

describe("gate hardware → real catalogue SKUs (Master Range / Polaris+Atlantic)", () => {
  function gateDesign(hardware: string, hingeType: string, latchType: string, finish: string, gateSize: number) {
    return {
      name: "Gate", productType: "glass-pool", productVariant: "glass-pool-spigots", shape: "inline",
      spans: [{
        spanId: "s1", length: 5000, maxPanelWidth: 1500, desiredGap: 50, spigotColor: finish, layoutMode: "auto-equalize",
        gateConfig: { required: true, gateSize, hingePanelSize: 1200, position: 0, flipped: false, hingeFrom: "glass", hardware, hingeType, latchType },
        panelLayout: { panels: [1000, gateSize, 1000], gaps: [50, 50, 50], totalPanelWidth: 2000 + gateSize, totalGapWidth: 150, averageGap: 50, panelTypes: ["standard", "gate", "standard"] },
      }],
    } as unknown as FenceDesign;
  }

  it("master g2g polished → MR-GGH-P hinge, MR-FLGG-P latch, 08SLG gate glass", () => {
    const c = calculateComponents(gateDesign("master", "glass-to-glass", "glass-to-glass", "polished", 890), [], []);
    expect(c.some(x => x.sku === "MR-GGH-P")).toBe(true);
    expect(c.some(x => x.sku === "MR-FLGG-P")).toBe(true);
    expect(c.some(x => x.sku === "08SLG-0890")).toBe(true);
    expect(c.some(x => /^(HINGE-|LATCH-|GP-GATE)/.test(x.sku ?? ""))).toBe(false);
  });

  it("master black hinge uses BLK; wall hinge → MR-SPH; corner-in latch → MR-FL90I", () => {
    const c = calculateComponents(gateDesign("master", "glass-to-wall", "corner-in", "black", 1000), [], []);
    expect(c.some(x => x.sku === "MR-SPH-BLK")).toBe(true);  // hinge black = BLK
    expect(c.some(x => x.sku === "MR-FL90I-B")).toBe(true);  // latch black = B
  });

  it("polaris g2g satin → PSC-125GG-S hinge + Atlantic LAT180-S latch + 12PGG glass", () => {
    const c = calculateComponents(gateDesign("polaris", "glass-to-glass", "glass-to-glass", "satin", 900), [], []);
    expect(c.some(x => x.sku === "PSC-125GG-S")).toBe(true);
    expect(c.some(x => x.sku === "LAT180-S")).toBe(true);
    expect(c.some(x => x.sku === "12PGG-0900")).toBe(true);
  });

  it("polaris wall white → PSC-125W-MW hinge, Atlantic LATWALL-W latch, 12PWG glass", () => {
    const c = calculateComponents(gateDesign("polaris", "glass-to-wall", "glass-to-wall", "white", 800), [], []);
    expect(c.some(x => x.sku === "PSC-125W-MW")).toBe(true);  // Polaris white = MW
    expect(c.some(x => x.sku === "LATWALL-W")).toBe(true);     // Atlantic white = W
    expect(c.some(x => x.sku === "12PWG-0800")).toBe(true);
  });
});
