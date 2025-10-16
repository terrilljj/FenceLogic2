import { type IStorage } from "../storage";
import { type ProductUIConfig, type Product } from "@shared/schema";
import { mapGateModeToCatalog, normalizeGateMode, normalizeGateSystem, type GateMode, type GateSystem } from "./gate-mode-shim";

export interface ResolveTraceEntry {
  source: "categoryPath" | "subcategory" | "direct" | "gate-mode-shim";
  key: string;
  codes: string[];
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
      
      // Add trace entry for gate mode shim
      const shimProducts = activeProducts.filter(p => 
        p.subcategory && gateModeIncludeSubcats.includes(p.subcategory)
      );
      
      if (shimProducts.length > 0) {
        trace.push({
          source: "gate-mode-shim",
          key: `${gateMode}:${gateSystem} → include:[${gateModeIncludeSubcats.join(", ")}] exclude:[${gateModeExcludeSubcats.join(", ")}]`,
          codes: shimProducts.map(p => p.code),
        });
        
        shimProducts.forEach(p => productCodesSet.add(p.code));
      }
    }
  }

  // Process each field in the selection
  for (const fieldConfig of uiConfig.fieldConfigs) {
    const fieldValue = selection[fieldConfig.field];
    
    // Skip if this field is not in the selection or is disabled
    if (fieldValue === undefined || !fieldConfig.enabled) {
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
  }

  // Also check for subcategory-based resolution from allowedSubcategories
  // BUT if gate mode shim is active, filter out excluded subcategories
  if (uiConfig.allowedSubcategories && uiConfig.allowedSubcategories.length > 0) {
    // Filter allowedSubcategories to exclude any that are in the gate mode exclusion list
    const effectiveAllowedSubcategories = gateModeExcludeSubcats.length > 0
      ? uiConfig.allowedSubcategories.filter(sub => !gateModeExcludeSubcats.includes(sub))
      : uiConfig.allowedSubcategories;
    
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
