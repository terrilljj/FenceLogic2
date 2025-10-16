import { type IStorage } from "../storage";
import { type ProductUIConfig, type Product } from "@shared/schema";
import { mapGateModeToCatalog, normalizeGateMode, normalizeGateSystem, type GateMode, type GateSystem } from "./gate-mode-shim";
import { chooseGateSkuByNearest, chooseHingePanelWidth } from "./sku-selector";

export interface ResolveTraceEntry {
  source: "categoryPath" | "subcategory" | "direct" | "gate-mode-shim" | "ui-config:number";
  key: string;
  codes: string[];
  note?: string; // For snapping or custom warnings
}

export interface ResolveResult {
  trace: ResolveTraceEntry[];
  finalCodes: string[];
}

/**
 * Pure core resolver function that operates on in-memory data
 * 
 * @param uiConfig - UI configuration for the variant
 * @param products - Array of products to match against
 * @param selection - The user's selection object
 * @returns ResolveResult with trace and final product codes
 */
export function resolveSelectionToProductsCore(
  uiConfig: ProductUIConfig | null,
  products: Product[],
  selection: Record<string, any>,
  variantKey?: string
): ResolveResult {
  const trace: ResolveTraceEntry[] = [];
  const productCodesSet = new Set<string>();

  if (!uiConfig) {
    return { trace: [], finalCodes: [] };
  }

  // Filter to active products only
  const activeProducts = products.filter(p => p.active === 1);

  // Track which subcategories are handled by numeric fields (to prevent duplicate addition via allowedSubcategories)
  const numericFieldHandledSubcats = new Set<string>();
  
  // Apply gate mode shim if mount_mode is present
  let gateModeIncludeSubcats: string[] = [];
  let gateModeExcludeSubcats: string[] = [];
  
  if (selection.mount_mode && variantKey) {
    const gateMode = normalizeGateMode(selection.mount_mode);
    const gateSystem = normalizeGateSystem(selection.gate_system);
    
    if (gateMode) {
      const mapping = mapGateModeToCatalog(variantKey, gateMode, gateSystem);
      gateModeIncludeSubcats = mapping.includeSubcats;
      gateModeExcludeSubcats = mapping.excludeSubcats;
      
      // Add informational trace entry (products will be added later via numeric fields or allowedSubcategories)
      trace.push({
        source: "gate-mode-shim",
        key: `${gateMode}:${gateSystem} → include:[${gateModeIncludeSubcats.join(", ")}] exclude:[${gateModeExcludeSubcats.join(", ")}]`,
        codes: [], // No products added directly by shim
        note: "Filter applied - products added by numeric fields or subcategory fallback",
      });
    }
  }

  // Process each field in the selection
  for (const fieldConfig of uiConfig.fieldConfigs) {
    const fieldValue = selection[fieldConfig.field];
    
    // Skip if field is disabled
    if (!fieldConfig.enabled) {
      continue;
    }
    
    // Skip non-numeric fields if no value provided (numeric fields can use defaults)
    if (fieldValue === undefined && fieldConfig.type !== "number") {
      continue;
    }

    // Handle dropdown fields with option paths
    if (fieldConfig.optionPaths && typeof fieldValue === "string") {
      const paths = fieldConfig.optionPaths[fieldValue];
      
      if (paths && paths.length > 0) {
        // Find products matching these category paths
        const matchingProducts = activeProducts.filter(p =>
          p.categoryPaths?.some(cp => paths.includes(cp))
        );
        
        const codes = matchingProducts.map(p => p.code);
        
        if (codes.length > 0) {
          trace.push({
            source: "categoryPath",
            key: `${fieldConfig.field}=${fieldValue} → ${paths.join(", ")}`,
            codes,
          });
          
          codes.forEach(code => productCodesSet.add(code));
        }
      }
    }

    // Handle toggle fields with category paths
    if (fieldConfig.categoryPaths && (fieldValue === true || (typeof fieldValue === "object" && fieldValue.required === true))) {
      const paths = fieldConfig.categoryPaths;
      
      if (paths.length > 0) {
        // Find products matching these category paths
        const matchingProducts = activeProducts.filter(p =>
          p.categoryPaths?.some(cp => paths.includes(cp))
        );
        
        const codes = matchingProducts.map(p => p.code);
        
        if (codes.length > 0) {
          trace.push({
            source: "categoryPath",
            key: `${fieldConfig.field} → ${paths.join(", ")}`,
            codes,
          });
          
          codes.forEach(code => productCodesSet.add(code));
        }
      }
    }

    // Legacy: Handle deprecated optionProducts field
    if (fieldConfig.optionProducts && typeof fieldValue === "string") {
      const productCodes = fieldConfig.optionProducts[fieldValue];
      
      if (productCodes && productCodes.length > 0) {
        trace.push({
          source: "direct",
          key: `${fieldConfig.field}=${fieldValue} (legacy)`,
          codes: productCodes,
        });
        
        productCodes.forEach(code => productCodesSet.add(code));
      }
    }

    // Legacy: Handle deprecated products field for toggles
    if (fieldConfig.products && (fieldValue === true || (typeof fieldValue === "object" && fieldValue.required === true))) {
      const productCodes = fieldConfig.products;
      
      if (productCodes.length > 0) {
        trace.push({
          source: "direct",
          key: `${fieldConfig.field} (legacy)`,
          codes: productCodes,
        });
        
        productCodes.forEach(code => productCodesSet.add(code));
      }
    }

    // Handle numeric fields (gate-width-mm, hinge-panel-width-mm)
    if (fieldConfig.type === "number") {
      // Check feature flag for hinge auto-sizing
      const isHingeField = fieldConfig.context === "hinge";
      const hingeAutoEnabled = process.env.HINGE_AUTO_ENABLED === "1";
      
      // If this is a hinge field and auto-sizing is disabled, require explicit width
      if (isHingeField && !hingeAutoEnabled) {
        // Only process if shopper explicitly provided a width
        if (typeof fieldValue !== "number" || fieldValue === null) {
          // Skip hinge field when auto-sizing is disabled and no explicit width provided
          continue;
        }
      }
      
      // Use shopper selection value or fall back to UI config default
      // Treat null the same as undefined (common when clearing form inputs)
      const targetWidth = (typeof fieldValue === "number" && fieldValue !== null) 
        ? fieldValue 
        : fieldConfig.default;
      
      // Skip if no value available (neither from selection nor default)
      if (targetWidth === undefined || targetWidth === null) {
        continue;
      }
      
      const tolerance = fieldConfig.tolerance || 50; // Default 50mm tolerance
      const context = fieldConfig.context;
      const subcategory = fieldConfig.subcategory;
      
      // Determine which subcategory to use for SKU selection
      let targetSubcategory: string | null = null;
      
      if (subcategory) {
        // Explicit subcategory provided
        targetSubcategory = subcategory;
      } else if (context === "gate" && selection.gate_system) {
        // Infer from gate_system
        const system = normalizeGateSystem(selection.gate_system);
        targetSubcategory = system === "MASTER" ? "Gate Master" : "Gate Polaris/Atlantic";
      } else if (context === "hinge" && selection.gate_system) {
        // Infer from gate_system for hinge panels
        const system = normalizeGateSystem(selection.gate_system);
        targetSubcategory = system === "MASTER" ? "Hinge Panels Master" : "Hinge Panels Polaris/Atlantic";
      }
      
      // For hinge panels, only apply if mount_mode is GLASS_TO_GLASS
      if (context === "hinge" && selection.mount_mode) {
        const mode = normalizeGateMode(selection.mount_mode);
        if (mode !== "GLASS_TO_GLASS") {
          // Skip hinge panel selection for POST/WALL mounts
          continue;
        }
      }
      
      // Filter products by subcategory
      const candidateProducts = targetSubcategory
        ? activeProducts.filter(p => p.subcategory === targetSubcategory)
        : activeProducts;
      
      // Choose the best SKU
      const result = context === "gate"
        ? chooseGateSkuByNearest(targetWidth, candidateProducts, tolerance)
        : chooseHingePanelWidth(targetWidth, candidateProducts, tolerance);
      
      // Mark this subcategory as handled by numeric field
      if (targetSubcategory) {
        numericFieldHandledSubcats.add(targetSubcategory);
      }
      
      if (result.sku) {
        trace.push({
          source: "ui-config:number",
          key: fieldConfig.field,
          codes: [result.sku],
          note: result.note,
        });
        
        productCodesSet.add(result.sku);
      } else if (result.warning) {
        // Add custom/warning entry to trace
        trace.push({
          source: "ui-config:number",
          key: fieldConfig.field,
          codes: [`CUSTOM-${context?.toUpperCase() || "UNKNOWN"}`],
          note: result.warning + (result.note ? `: ${result.note}` : ""),
        });
      }
    }
  }

  // Also check for subcategory-based resolution from allowedSubcategories
  // BUT if gate mode shim is active, filter out excluded subcategories
  // ALSO exclude subcategories that were already handled by numeric fields
  if (uiConfig.allowedSubcategories && uiConfig.allowedSubcategories.length > 0) {
    // Filter allowedSubcategories to exclude:
    // 1. Any that are in the gate mode exclusion list
    // 2. Any that were handled by numeric fields
    const effectiveAllowedSubcategories = uiConfig.allowedSubcategories.filter(sub => {
      if (gateModeExcludeSubcats.includes(sub)) return false;
      if (numericFieldHandledSubcats.has(sub)) return false;
      return true;
    });
    
    const subcategoryProducts = activeProducts.filter(p =>
      p.subcategory && effectiveAllowedSubcategories.includes(p.subcategory)
    );
    
    if (subcategoryProducts.length > 0) {
      const codes = subcategoryProducts.map(p => p.code);
      
      trace.push({
        source: "subcategory",
        key: `allowedSubcategories: ${effectiveAllowedSubcategories.join(", ")}`,
        codes,
      });
      
      codes.forEach(code => productCodesSet.add(code));
    }
  }

  return {
    trace,
    finalCodes: Array.from(productCodesSet),
  };
}

/**
 * Async wrapper that loads data from storage and calls the pure core resolver
 * 
 * @param variant - The product variant (e.g., "glass-pool-spigots")
 * @param selection - The user's selection object (e.g., { "glass-thickness": "12mm", "gate-config": { required: true } })
 * @param storage - Storage instance for querying UI config and products
 * @returns ResolveResult with trace and final product codes
 */
export async function resolveSelectionToProducts(
  variant: string,
  selection: Record<string, any>,
  storage: IStorage
): Promise<ResolveResult> {
  // Load UI config for this variant
  const uiConfig = await storage.getUIConfig(variant);
  
  // Load all products
  const allProducts = await storage.getAllProducts();
  
  // Call pure core resolver (convert undefined to null), pass variant key for gate mode shim
  return resolveSelectionToProductsCore(uiConfig || null, allProducts, selection, variant);
}
