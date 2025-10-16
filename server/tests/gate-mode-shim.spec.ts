import { describe, it, expect } from "vitest";
import { resolveSelectionToProductsCore } from "../services/resolve";
import type { ProductUIConfig, Product, UIFieldConfig } from "@shared/schema";

// Test fixtures for gate mode shim testing
const createUIConfig = (): ProductUIConfig => ({
  id: "test-gate-config",
  productVariant: "glass-pool-spigots",
  fieldConfigs: [],
  allowedCategories: [],
  allowedSubcategories: [
    "Gate Master",
    "Gate Polaris/Atlantic",
    "Hinge Panels Master",
    "Hinge Panels Polaris/Atlantic",
    "Posts",
  ],
  updatedAt: new Date().toISOString(),
});

// Mock products representing different gate mounting options
const products: Product[] = [
  // Gate Master hardware
  {
    id: "1",
    code: "GATE-MASTER-001",
    description: "Master Gate Latch",
    category: "Gates",
    subcategory: "Gate Master",
    categoryPaths: [],
    price: "150",
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
    code: "GATE-MASTER-002",
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
  // Gate Polaris/Atlantic hardware
  {
    id: "3",
    code: "GATE-POLARIS-001",
    description: "Polaris Soft Close Gate Latch",
    category: "Gates",
    subcategory: "Gate Polaris/Atlantic",
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
  {
    id: "4",
    code: "GATE-POLARIS-002",
    description: "Polaris Soft Close Hinge",
    category: "Gates",
    subcategory: "Gate Polaris/Atlantic",
    categoryPaths: [],
    price: "150",
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
  // Hinge Panels Master (for glass-to-glass gates)
  {
    id: "5",
    code: "HINGE-PANEL-MASTER-1200",
    description: "Master Hinge Panel 1200mm",
    category: "Gates",
    subcategory: "Hinge Panels Master",
    categoryPaths: [],
    price: "200",
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
    id: "6",
    code: "HINGE-PANEL-MASTER-1400",
    description: "Master Hinge Panel 1400mm",
    category: "Gates",
    subcategory: "Hinge Panels Master",
    categoryPaths: [],
    price: "220",
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
  // Hinge Panels Polaris/Atlantic (for glass-to-glass gates)
  {
    id: "7",
    code: "HINGE-PANEL-POLARIS-1200",
    description: "Polaris Hinge Panel 1200mm",
    category: "Gates",
    subcategory: "Hinge Panels Polaris/Atlantic",
    categoryPaths: [],
    price: "230",
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
    id: "8",
    code: "HINGE-PANEL-POLARIS-1400",
    description: "Polaris Hinge Panel 1400mm",
    category: "Gates",
    subcategory: "Hinge Panels Polaris/Atlantic",
    categoryPaths: [],
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
  // Posts (for wall/post-mounted gates)
  {
    id: "9",
    code: "POST-STANDARD-001",
    description: "Standard Gate Post",
    category: "Posts",
    subcategory: "Posts",
    categoryPaths: [],
    price: "80",
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
    id: "10",
    code: "POST-ANCHOR-001",
    description: "Post Anchor Plate",
    category: "Posts",
    subcategory: "Posts",
    categoryPaths: [],
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
];

describe("Gate Mode Shim - resolveSelectionToProductsCore", () => {
  it("Case A: GLASS_TO_GLASS + MASTER → includes hinge-panel, excludes Posts", () => {
    const uiConfig = createUIConfig();
    const selection = {
      mount_mode: "GLASS_TO_GLASS",
      gate_system: "Master Range",
      glass_thickness: "12mm",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should include Gate Master hardware
    expect(result.finalCodes).toContain("GATE-MASTER-001");
    expect(result.finalCodes).toContain("GATE-MASTER-002");

    // Should include Hinge Panels Master (for glass-to-glass)
    expect(result.finalCodes).toContain("HINGE-PANEL-MASTER-1200");
    expect(result.finalCodes).toContain("HINGE-PANEL-MASTER-1400");

    // Should NOT include Posts (excluded for glass-to-glass)
    expect(result.finalCodes).not.toContain("POST-STANDARD-001");
    expect(result.finalCodes).not.toContain("POST-ANCHOR-001");

    // Should NOT include Polaris hardware (Master selected)
    expect(result.finalCodes).not.toContain("GATE-POLARIS-001");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-POLARIS-1200");

    // Check trace has gate-mode-shim entry
    const shimTrace = result.trace.find(t => t.source === "gate-mode-shim");
    expect(shimTrace).toBeDefined();
    expect(shimTrace?.key).toContain("GLASS_TO_GLASS:MASTER");
    expect(shimTrace?.key).toContain("Hinge Panels Master");
  });

  it("Case B: POST + MASTER → includes Posts, excludes hinge-panel", () => {
    const uiConfig = createUIConfig();
    const selection = {
      mount_mode: "POST",
      gate_system: "Master Range",
      hinge_side: "RIGHT",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should include Gate Master hardware
    expect(result.finalCodes).toContain("GATE-MASTER-001");
    expect(result.finalCodes).toContain("GATE-MASTER-002");

    // Should include Posts (for post-mounted)
    expect(result.finalCodes).toContain("POST-STANDARD-001");
    expect(result.finalCodes).toContain("POST-ANCHOR-001");

    // Should NOT include Hinge Panels (excluded for post-mounted)
    expect(result.finalCodes).not.toContain("HINGE-PANEL-MASTER-1200");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-MASTER-1400");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-POLARIS-1200");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-POLARIS-1400");

    // Should NOT include Polaris hardware (Master selected)
    expect(result.finalCodes).not.toContain("GATE-POLARIS-001");

    // Check trace has gate-mode-shim entry
    const shimTrace = result.trace.find(t => t.source === "gate-mode-shim");
    expect(shimTrace).toBeDefined();
    expect(shimTrace?.key).toContain("POST:MASTER");
    expect(shimTrace?.key).toContain("Posts");
  });

  it("Case C: WALL + POLARIS → includes Posts, excludes hinge-panel, includes Polaris gate", () => {
    const uiConfig = createUIConfig();
    const selection = {
      mount_mode: "WALL",
      gate_system: "Polaris Soft Close",
      hinge_side: "LEFT",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should include Gate Polaris hardware
    expect(result.finalCodes).toContain("GATE-POLARIS-001");
    expect(result.finalCodes).toContain("GATE-POLARIS-002");

    // Should include Posts (for wall-mounted)
    expect(result.finalCodes).toContain("POST-STANDARD-001");
    expect(result.finalCodes).toContain("POST-ANCHOR-001");

    // Should NOT include Hinge Panels (excluded for wall-mounted)
    expect(result.finalCodes).not.toContain("HINGE-PANEL-MASTER-1200");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-POLARIS-1200");

    // Should NOT include Master hardware (Polaris selected)
    expect(result.finalCodes).not.toContain("GATE-MASTER-001");

    // Check trace has gate-mode-shim entry
    const shimTrace = result.trace.find(t => t.source === "gate-mode-shim");
    expect(shimTrace).toBeDefined();
    expect(shimTrace?.key).toContain("WALL:POLARIS");
    expect(shimTrace?.key).toContain("Posts");
  });

  it("Case D: GLASS_TO_GLASS + POLARIS → selects hinge panels Polaris, NOT Master", () => {
    const uiConfig = createUIConfig();
    const selection = {
      mount_mode: "GLASS_TO_GLASS",
      gate_system: "Polaris Soft Close",
      hinge_side: "LEFT",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should include Gate Polaris hardware
    expect(result.finalCodes).toContain("GATE-POLARIS-001");
    expect(result.finalCodes).toContain("GATE-POLARIS-002");

    // Should include Hinge Panels Polaris (not Master)
    expect(result.finalCodes).toContain("HINGE-PANEL-POLARIS-1200");
    expect(result.finalCodes).toContain("HINGE-PANEL-POLARIS-1400");

    // Should NOT include Hinge Panels Master
    expect(result.finalCodes).not.toContain("HINGE-PANEL-MASTER-1200");
    expect(result.finalCodes).not.toContain("HINGE-PANEL-MASTER-1400");

    // Should NOT include Posts
    expect(result.finalCodes).not.toContain("POST-STANDARD-001");
    expect(result.finalCodes).not.toContain("POST-ANCHOR-001");

    // Should NOT include Master hardware
    expect(result.finalCodes).not.toContain("GATE-MASTER-001");

    // Check trace has gate-mode-shim entry
    const shimTrace = result.trace.find(t => t.source === "gate-mode-shim");
    expect(shimTrace).toBeDefined();
    expect(shimTrace?.key).toContain("GLASS_TO_GLASS:POLARIS");
    expect(shimTrace?.key).toContain("Hinge Panels Polaris/Atlantic");
  });

  it("Ensures GLASS_TO_GLASS ≠ POST for same selection", () => {
    const uiConfig = createUIConfig();
    
    const g2gSelection = {
      mount_mode: "GLASS_TO_GLASS",
      gate_system: "Master Range",
      hinge_side: "LEFT",
    };

    const postSelection = {
      mount_mode: "POST",
      gate_system: "Master Range",
      hinge_side: "LEFT",
    };

    const g2gResult = resolveSelectionToProductsCore(uiConfig, products, g2gSelection, "glass-pool-spigots");
    const postResult = resolveSelectionToProductsCore(uiConfig, products, postSelection, "glass-pool-spigots");

    // Results should be different
    expect(g2gResult.finalCodes).not.toEqual(postResult.finalCodes);

    // G2G should have hinge panels, POST should have posts
    const g2gHasHingePanel = g2gResult.finalCodes.some(code => code.includes("HINGE-PANEL"));
    const postHasPosts = postResult.finalCodes.some(code => code.includes("POST"));
    
    expect(g2gHasHingePanel).toBe(true);
    expect(postHasPosts).toBe(true);

    // POST should NOT have hinge panels
    const postHasHingePanel = postResult.finalCodes.some(code => code.includes("HINGE-PANEL"));
    expect(postHasHingePanel).toBe(false);

    // G2G should NOT have posts
    const g2gHasPosts = g2gResult.finalCodes.some(code => code.includes("POST"));
    expect(g2gHasPosts).toBe(false);
  });

  it("Handles missing mount_mode gracefully (no shim applied)", () => {
    const uiConfig = createUIConfig();
    const selection = {
      gate_system: "Master Range",
      glass_thickness: "12mm",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Without mount_mode, shim is not applied
    // All subcategory products should be included
    expect(result.finalCodes.length).toBeGreaterThan(0);

    // Should not have gate-mode-shim trace entry
    const shimTrace = result.trace.find(t => t.source === "gate-mode-shim");
    expect(shimTrace).toBeUndefined();

    // Should have subcategory trace entry instead
    const subcategoryTrace = result.trace.find(t => t.source === "subcategory");
    expect(subcategoryTrace).toBeDefined();
  });

  it("Normalizes gate_system variations correctly", () => {
    const uiConfig = createUIConfig();
    
    // Test various input formats for Master
    const masterVariations = ["Master Range", "MASTER", "master", "Master"];
    for (const system of masterVariations) {
      const selection = {
        mount_mode: "GLASS_TO_GLASS",
        gate_system: system,
      };

      const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");
      
      // Should always select Master products
      expect(result.finalCodes).toContain("GATE-MASTER-001");
      expect(result.finalCodes).not.toContain("GATE-POLARIS-001");
    }

    // Test various input formats for Polaris
    const polarisVariations = ["Polaris Soft Close", "POLARIS", "polaris", "Polaris/Atlantic"];
    for (const system of polarisVariations) {
      const selection = {
        mount_mode: "GLASS_TO_GLASS",
        gate_system: system,
      };

      const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");
      
      // Should always select Polaris products
      expect(result.finalCodes).toContain("GATE-POLARIS-001");
      expect(result.finalCodes).not.toContain("GATE-MASTER-001");
    }
  });
});
