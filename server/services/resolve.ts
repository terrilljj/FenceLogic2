import { type IStorage } from "../storage";
import { type ProductUIConfig, type Product } from "@shared/schema";

export interface ResolveTraceEntry {
  source: "categoryPath" | "subcategory" | "direct";
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
  selection: Record<string, any>
): ResolveResult {
  const trace: ResolveTraceEntry[] = [];
  const productCodesSet = new Set<string>();

  if (!uiConfig) {
    return { trace: [], finalCodes: [] };
  }

  // Filter to active products only
  const activeProducts = products.filter(p => p.active === 1);

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
  if (uiConfig.allowedSubcategories && uiConfig.allowedSubcategories.length > 0) {
    const subcategoryProducts = activeProducts.filter(p =>
      p.subcategory && uiConfig.allowedSubcategories.includes(p.subcategory)
    );
    
    if (subcategoryProducts.length > 0) {
      const codes = subcategoryProducts.map(p => p.code);
      
      trace.push({
        source: "subcategory",
        key: `allowedSubcategories: ${uiConfig.allowedSubcategories.join(", ")}`,
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
  
  // Call pure core resolver (convert undefined to null)
  return resolveSelectionToProductsCore(uiConfig || null, allProducts, selection);
}
