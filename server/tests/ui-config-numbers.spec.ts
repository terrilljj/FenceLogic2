import { describe, it, expect } from "vitest";
import { resolveSelectionToProductsCore } from "../services/resolve";
import type { ProductUIConfig, Product, UIFieldConfig } from "@shared/schema";

// Test fixtures for numeric field testing
const createNumericUIConfig = (): ProductUIConfig => ({
  id: "test-numeric-config",
  productVariant: "glass-pool-spigots",
  fieldConfigs: [
    // Gate width numeric field
    {
      type: "number",
      field: "gate-width-mm",
      enabled: true,
      position: 1,
      label: "Gate Width",
      unit: "mm",
      default: 850,
      min: 700,
      max: 1200,
      step: 50,
      tolerance: 50,
      context: "gate",
      subcategory: "Gate Master",
    } as UIFieldConfig,
    // Hinge panel width numeric field
    {
      type: "number",
      field: "hinge-panel-width-mm",
      enabled: true,
      position: 2,
      label: "Hinge Panel Width",
      unit: "mm",
      default: 1100,
      min: 300,
      max: 1800,
      step: 100,
      tolerance: 50,
      context: "hinge",
      subcategory: "Hinge Panels Master",
    } as UIFieldConfig,
  ],
  allowedCategories: [],
  allowedSubcategories: ["Gate Master", "Hinge Panels Master", "Posts"],
  updatedAt: new Date().toISOString(),
});

// Mock products with different gate widths
const products: Product[] = [
  {
    id: "1",
    code: "GM-GATE-850",
    description: "Master Gate 850mm",
    category: "Gates",
    subcategory: "Gate Master",
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
    id: "2",
    code: "GM-GATE-1000",
    description: "Master Gate 1000mm",
    category: "Gates",
    subcategory: "Gate Master",
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
  {
    id: "3",
    code: "GM-GATE-1100",
    description: "Master Gate 1100mm",
    category: "Gates",
    subcategory: "Gate Master",
    categoryPaths: [],
    price: "240",
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
    code: "HINGE-PANEL-1000",
    description: "Master Hinge Panel 1000mm",
    category: "Gates",
    subcategory: "Hinge Panels Master",
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
  {
    id: "5",
    code: "HINGE-PANEL-1100",
    description: "Master Hinge Panel 1100mm",
    category: "Gates",
    subcategory: "Hinge Panels Master",
    categoryPaths: [],
    price: "270",
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
    code: "HINGE-PANEL-1200",
    description: "Master Hinge Panel 1200mm",
    category: "Gates",
    subcategory: "Hinge Panels Master",
    categoryPaths: [],
    price: "290",
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
    id: "7",
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
];

describe("UI Config Numeric Fields", () => {
  it("A) Gate width default from UI-config chooses exact SKU", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "gate-width-mm": 850, // Exact match
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should select the exact 850mm gate
    expect(result.finalCodes).toContain("GM-GATE-850");
    
    // Check trace
    const numericTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(numericTrace).toBeDefined();
    expect(numericTrace?.codes).toContain("GM-GATE-850");
    expect(numericTrace?.note).toBeUndefined(); // No snapping needed
  });

  it("B) Shopper selection overrides default", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "gate-width-mm": 1000, // Override default 850
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should select the 1000mm gate (not the default 850)
    expect(result.finalCodes).toContain("GM-GATE-1000");
    expect(result.finalCodes).not.toContain("GM-GATE-850");
    
    // Check trace
    const numericTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(numericTrace).toBeDefined();
    expect(numericTrace?.codes).toContain("GM-GATE-1000");
  });

  it("C) Snap within tolerance", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "gate-width-mm": 975, // Between 1000 and 1100, closer to 1000
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should snap to the nearest SKU within tolerance (1000mm)
    expect(result.finalCodes).toContain("GM-GATE-1000");
    
    // Check trace includes snapped note
    const numericTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(numericTrace).toBeDefined();
    expect(numericTrace?.codes).toContain("GM-GATE-1000");
    expect(numericTrace?.note).toContain("snapped_from=975_to=1000");
  });

  it("D) Hinge width default applied only for GLASS_TO_GLASS", () => {
    const uiConfig = createNumericUIConfig();
    
    // Test 1: GLASS_TO_GLASS mode should include hinge panel
    const g2gSelection = {
      "hinge-panel-width-mm": 1100,
      mount_mode: "GLASS_TO_GLASS",
    };

    const g2gResult = resolveSelectionToProductsCore(uiConfig, products, g2gSelection, "glass-pool-spigots");
    expect(g2gResult.finalCodes).toContain("HINGE-PANEL-1100");
    
    const g2gTrace = g2gResult.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(g2gTrace).toBeDefined();

    // Test 2: POST mode should NOT include hinge panel
    const postSelection = {
      "hinge-panel-width-mm": 1100,
      mount_mode: "POST",
    };

    const postResult = resolveSelectionToProductsCore(uiConfig, products, postSelection, "glass-pool-spigots");
    expect(postResult.finalCodes).not.toContain("HINGE-PANEL-1100");
    expect(postResult.finalCodes).not.toContain("HINGE-PANEL-1000");
    expect(postResult.finalCodes).not.toContain("HINGE-PANEL-1200");
    
    // Should have no hinge panel trace entry for POST mode
    const postTrace = postResult.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(postTrace).toBeUndefined();
  });

  it("E) Out of tolerance → custom + warning", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "gate-width-mm": 700, // No SKU within 50mm tolerance (closest is 850)
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should NOT include any real gate SKUs
    expect(result.finalCodes).not.toContain("GM-GATE-850");
    expect(result.finalCodes).not.toContain("GM-GATE-1000");
    expect(result.finalCodes).not.toContain("GM-GATE-1100");
    
    // Check trace includes warning and CUSTOM marker
    const numericTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(numericTrace).toBeDefined();
    expect(numericTrace?.codes).toContain("CUSTOM-GATE");
    expect(numericTrace?.note).toContain("no_gate_sku_within_tolerance");
  });

  it("F) Multiple numeric fields work together", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "gate-width-mm": 1000,
      "hinge-panel-width-mm": 1200,
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should include both gate and hinge panel
    expect(result.finalCodes).toContain("GM-GATE-1000");
    expect(result.finalCodes).toContain("HINGE-PANEL-1200");
    
    // Check both traces exist
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    const hingeTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    
    expect(gateTrace).toBeDefined();
    expect(hingeTrace).toBeDefined();
  });

  it("G) Disabled numeric field is ignored - no numeric field trace", () => {
    const uiConfig = createNumericUIConfig();
    // Disable the gate width field
    uiConfig.fieldConfigs[0].enabled = false;
    
    // Remove Gate Master from allowedSubcategories so we can verify numeric field doesn't run
    uiConfig.allowedSubcategories = ["Hinge Panels Master", "Posts"];
    
    const selection = {
      "gate-width-mm": 850,
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should NOT include gate because field is disabled AND Gate Master not in allowedSubcategories
    expect(result.finalCodes).not.toContain("GM-GATE-850");
    expect(result.finalCodes).not.toContain("GM-GATE-1000");
    expect(result.finalCodes).not.toContain("GM-GATE-1100");
    
    // No numeric field trace entry for disabled field
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(gateTrace).toBeUndefined();
  });

  it("H) Missing selection value uses field default", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      // No gate-width-mm in selection, should use default from config (850)
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should select the default 850mm gate from UI config
    expect(result.finalCodes).toContain("GM-GATE-850");
    
    // Check trace shows the default was used
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(gateTrace).toBeDefined();
    expect(gateTrace?.codes).toContain("GM-GATE-850");
  });

  it("I) Field default snaps to nearest SKU within tolerance", () => {
    const uiConfig = createNumericUIConfig();
    // Change default to 875 (should snap to 850)
    uiConfig.fieldConfigs[0].default = 875;
    
    const selection = {
      // No gate-width-mm in selection, will use default 875
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should snap to 850mm (closest within 50mm tolerance)
    expect(result.finalCodes).toContain("GM-GATE-850");
    
    // Check trace shows snapping occurred
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(gateTrace).toBeDefined();
    expect(gateTrace?.codes).toContain("GM-GATE-850");
    expect(gateTrace?.note).toContain("snapped_from=875_to=850");
  });

  it("J) Null selection value uses field default (same as undefined)", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      // Explicit null value (common when clearing form inputs)
      "gate-width-mm": null,
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should use the default 850mm from UI config
    expect(result.finalCodes).toContain("GM-GATE-850");
    
    // Check trace shows the default was used
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(gateTrace).toBeDefined();
    expect(gateTrace?.codes).toContain("GM-GATE-850");
  });
});

describe("Feature Flag: HINGE_AUTO_ENABLED=0 (auto-sizing disabled)", () => {
  const originalEnv = process.env.HINGE_AUTO_ENABLED;
  
  beforeEach(() => {
    process.env.HINGE_AUTO_ENABLED = "0";
  });
  
  afterEach(() => {
    process.env.HINGE_AUTO_ENABLED = originalEnv;
  });

  it("K) With flag off, explicit hinge width picks exact SKU", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "hinge-panel-width-mm": 1100, // Explicit width provided
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should pick the exact 1100mm hinge panel
    expect(result.finalCodes).toContain("HINGE-PANEL-1100");
    
    const hingeTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(hingeTrace).toBeDefined();
    expect(hingeTrace?.codes).toContain("HINGE-PANEL-1100");
  });

  it("L) With flag off, explicit hinge width snaps within tolerance", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "hinge-panel-width-mm": 1120, // Within tolerance of 1100
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should snap to 1100mm (within 50mm tolerance)
    expect(result.finalCodes).toContain("HINGE-PANEL-1100");
    
    const hingeTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(hingeTrace).toBeDefined();
    expect(hingeTrace?.codes).toContain("HINGE-PANEL-1100");
    expect(hingeTrace?.note).toContain("snapped_from=1120_to=1100");
  });

  it("M) With flag off, hinge width out of tolerance returns CUSTOM", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      "hinge-panel-width-mm": 2000, // Way out of tolerance
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Should return CUSTOM-HINGE warning
    const hingeTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(hingeTrace).toBeDefined();
    expect(hingeTrace?.codes).toContain("CUSTOM-HINGE");
    expect(hingeTrace?.note).toContain("no_hinge_sku_within_tolerance");
  });

  it("N) With flag off and NO explicit hinge width, falls back to allowedSubcategories", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      // No hinge-panel-width-mm provided, and no default should be applied
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // No numeric field trace entry should exist (because no explicit width)
    const hingeTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "hinge-panel-width-mm");
    expect(hingeTrace).toBeUndefined();
    
    // Instead, hinge panels should be added via allowedSubcategories fallback
    const subcategoryTrace = result.trace.find(t => 
      t.source === "subcategory" && 
      t.key.includes("Hinge Panels Master")
    );
    expect(subcategoryTrace).toBeDefined();
    
    // Should include hinge panel products from subcategory fallback
    expect(result.finalCodes).toContain("HINGE-PANEL-1100");
  });

  it("O) With flag off, gate fields still use defaults (flag only affects hinges)", () => {
    const uiConfig = createNumericUIConfig();
    const selection = {
      // No gate-width-mm provided, should still use default
      mount_mode: "GLASS_TO_GLASS",
    };

    const result = resolveSelectionToProductsCore(uiConfig, products, selection, "glass-pool-spigots");

    // Gate should still use default 850mm (flag only affects hinges)
    expect(result.finalCodes).toContain("GM-GATE-850");
    
    const gateTrace = result.trace.find(t => t.source === "ui-config:number" && t.key === "gate-width-mm");
    expect(gateTrace).toBeDefined();
    expect(gateTrace?.codes).toContain("GM-GATE-850");
  });
});
