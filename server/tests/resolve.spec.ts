import { describe, it, expect } from "vitest";
import { resolveSelectionToProductsCore } from "../services/resolve";
import type { ProductUIConfig, Product, UIFieldConfig } from "@shared/schema";

// Test fixtures
const createUIConfig = (fieldConfigs: UIFieldConfig[]): ProductUIConfig => ({
  id: "test-config-1",
  productVariant: "pool_fence/frameless",
  fieldConfigs,
  allowedCategories: [],
  allowedSubcategories: ["Gate Master", "Hinge Panels Master"],
  updatedAt: new Date().toISOString(),
});

const products: Product[] = [
  // Glass 12mm panels
  {
    id: "1",
    code: "GLASS-12-1000",
    description: "12mm Glass Panel 1000mm",
    category: "Pool Fence",
    subcategory: "Glass Panels",
    categoryPaths: ["pool_fence/frameless/glass_panels/12mm"],
    price: "250",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    code: "GLASS-12-1200",
    description: "12mm Glass Panel 1200mm",
    category: "Pool Fence",
    subcategory: "Glass Panels",
    categoryPaths: ["pool_fence/frameless/glass_panels/12mm"],
    price: "300",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  // Glass 15mm panels
  {
    id: "3",
    code: "GLASS-15-1000",
    description: "15mm Glass Panel 1000mm",
    category: "Pool Fence",
    subcategory: "Glass Panels",
    categoryPaths: ["pool_fence/frameless/glass_panels/15mm"],
    price: "350",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  // Gate Master products (matched by subcategory)
  {
    id: "4",
    code: "GATE-MASTER-HINGE",
    description: "Master Gate Hinge",
    category: "Gates",
    subcategory: "Gate Master",
    categoryPaths: [],
    price: "120",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "5",
    code: "HINGE-PANEL-MASTER",
    description: "Master Hinge Panel",
    category: "Gates",
    subcategory: "Hinge Panels Master",
    categoryPaths: [],
    price: "180",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  // Top rail products
  {
    id: "6",
    code: "RAIL-TOP-2000",
    description: "Top Mounted Rail 2000mm",
    category: "Balustrade",
    subcategory: "Top Rail",
    categoryPaths: ["balustrade/top_rail"],
    price: "90",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  // Unrelated product (should not be included)
  {
    id: "7",
    code: "POST-STANDARD",
    description: "Standard Post",
    category: "Posts",
    subcategory: "Standard Posts",
    categoryPaths: ["posts/standard"],
    price: "45",
    active: 1,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  // Inactive product (should not be included)
  {
    id: "8",
    code: "GLASS-12-INACTIVE",
    description: "Inactive 12mm Glass Panel",
    category: "Pool Fence",
    subcategory: "Glass Panels",
    categoryPaths: ["pool_fence/frameless/glass_panels/12mm"],
    price: "250",
    active: 0,
    weight: null,
    dimensions: null,
    units: null,
    tags: null,
    notes: null,
    imageUrl: null,
    selectionId: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

describe("resolveSelectionToProductsCore", () => {
  it("Case A: resolves glass_thickness=12mm and gate_system=Master Range", () => {
    const uiConfig = createUIConfig([
      {
        field: "glass-thickness",
        enabled: true,
        position: 0,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        optionPaths: {
          "12mm": ["pool_fence/frameless/glass_panels/12mm"],
          "15mm": ["pool_fence/frameless/glass_panels/15mm"],
        },
      },
      {
        field: "gate-config",
        enabled: true,
        position: 1,
        label: "Gate System",
        tooltip: "Select gate system",
        optionPaths: {
          "Master Range": [], // This will rely on subcategory matching
        },
      },
    ]);

    const selection = {
      "glass-thickness": "12mm",
      "gate-config": "Master Range",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection);

    // Should include glass 12mm panels
    expect(result.finalCodes).toContain("GLASS-12-1000");
    expect(result.finalCodes).toContain("GLASS-12-1200");

    // Should include gate master and hinge panels (from subcategory)
    expect(result.finalCodes).toContain("GATE-MASTER-HINGE");
    expect(result.finalCodes).toContain("HINGE-PANEL-MASTER");

    // Should NOT include 15mm glass, unrelated products, or inactive products
    expect(result.finalCodes).not.toContain("GLASS-15-1000");
    expect(result.finalCodes).not.toContain("POST-STANDARD");
    expect(result.finalCodes).not.toContain("GLASS-12-INACTIVE");

    // Check trace
    expect(result.trace).toHaveLength(2); // One for categoryPath, one for subcategory
    
    const categoryPathTrace = result.trace.find(t => t.source === "categoryPath");
    expect(categoryPathTrace).toBeDefined();
    expect(categoryPathTrace?.key).toContain("glass-thickness=12mm");
    expect(categoryPathTrace?.codes).toContain("GLASS-12-1000");
    expect(categoryPathTrace?.codes).toContain("GLASS-12-1200");

    const subcategoryTrace = result.trace.find(t => t.source === "subcategory");
    expect(subcategoryTrace).toBeDefined();
    expect(subcategoryTrace?.codes).toContain("GATE-MASTER-HINGE");
    expect(subcategoryTrace?.codes).toContain("HINGE-PANEL-MASTER");
  });

  it("Case B: adds top-rail=true to previous selection", () => {
    const uiConfig = createUIConfig([
      {
        field: "glass-thickness",
        enabled: true,
        position: 0,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        optionPaths: {
          "12mm": ["pool_fence/frameless/glass_panels/12mm"],
        },
      },
      {
        field: "top-rail",
        enabled: true,
        position: 2,
        label: "Top Rail",
        tooltip: "Enable top rail",
        categoryPaths: ["balustrade/top_rail"],
      },
    ]);

    const selection = {
      "glass-thickness": "12mm",
      "top-rail": true,
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection);

    // Should include glass 12mm panels
    expect(result.finalCodes).toContain("GLASS-12-1000");
    expect(result.finalCodes).toContain("GLASS-12-1200");

    // Should include top rail
    expect(result.finalCodes).toContain("RAIL-TOP-2000");

    // Should include gate master and hinge panels (from allowedSubcategories)
    expect(result.finalCodes).toContain("GATE-MASTER-HINGE");
    expect(result.finalCodes).toContain("HINGE-PANEL-MASTER");

    // Check trace has entry for top-rail
    const topRailTrace = result.trace.find(t => t.key.includes("top-rail"));
    expect(topRailTrace).toBeDefined();
    expect(topRailTrace?.source).toBe("categoryPath");
    expect(topRailTrace?.codes).toContain("RAIL-TOP-2000");
  });

  it("Case C: empty selection returns empty results", () => {
    const uiConfig = createUIConfig([
      {
        field: "glass-thickness",
        enabled: true,
        position: 0,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        optionPaths: {
          "12mm": ["pool_fence/frameless/glass_panels/12mm"],
        },
      },
    ]);

    const selection = {};

    const result = resolveSelectionToProductsCore(uiConfig, products, selection);

    // Should only include products from allowedSubcategories
    expect(result.finalCodes).toContain("GATE-MASTER-HINGE");
    expect(result.finalCodes).toContain("HINGE-PANEL-MASTER");
    expect(result.finalCodes).not.toContain("GLASS-12-1000");
    expect(result.finalCodes).not.toContain("RAIL-TOP-2000");

    // Trace should only have subcategory entry
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0].source).toBe("subcategory");
  });

  it("Case D: unknown option values return only subcategory matches, no throw", () => {
    const uiConfig = createUIConfig([
      {
        field: "glass-thickness",
        enabled: true,
        position: 0,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        optionPaths: {
          "12mm": ["pool_fence/frameless/glass_panels/12mm"],
        },
      },
    ]);

    const selection = {
      "glass-thickness": "20mm", // Unknown value
      "unknown-field": "some_value",
    };

    // Should not throw
    expect(() => {
      const result = resolveSelectionToProductsCore(uiConfig, products, selection);

      // Should only include subcategory matches (Gate Master, Hinge Panels Master)
      expect(result.finalCodes).toContain("GATE-MASTER-HINGE");
      expect(result.finalCodes).toContain("HINGE-PANEL-MASTER");
      expect(result.finalCodes).not.toContain("GLASS-12-1000");

      // Trace should only have subcategory entry
      expect(result.trace).toHaveLength(1);
      expect(result.trace[0].source).toBe("subcategory");
    }).not.toThrow();
  });

  it("handles null uiConfig gracefully", () => {
    const result = resolveSelectionToProductsCore(null, products, { some: "selection" });

    expect(result.finalCodes).toEqual([]);
    expect(result.trace).toEqual([]);
  });

  it("filters out inactive products", () => {
    const uiConfig = createUIConfig([
      {
        field: "glass-thickness",
        enabled: true,
        position: 0,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        optionPaths: {
          "12mm": ["pool_fence/frameless/glass_panels/12mm"],
        },
      },
    ]);

    const selection = {
      "glass-thickness": "12mm",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection);

    // Should include active 12mm products
    expect(result.finalCodes).toContain("GLASS-12-1000");
    expect(result.finalCodes).toContain("GLASS-12-1200");

    // Should NOT include inactive product
    expect(result.finalCodes).not.toContain("GLASS-12-INACTIVE");
  });
});
