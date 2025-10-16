import type { Product, ProductUIConfig } from '@shared/schema';
import type { ProductRow, UIConfigRow } from '../validation/sheets';

export type ProductDiff = {
  added: ProductRow[];
  updated: Array<{ code: string; changes: Partial<ProductRow> }>;
  deactivated: string[]; // codes of products to deactivate
};

export type UIConfigDiff = {
  added: string[]; // variant keys
  updated: string[]; // variant keys
  configs: Record<string, any>; // normalized JSONB per variant
};

/**
 * Compares database products with sheet products
 */
export function diffProducts(dbProducts: Product[], sheetProducts: ProductRow[]): ProductDiff {
  const result: ProductDiff = {
    added: [],
    updated: [],
    deactivated: [],
  };
  
  const dbMap = new Map(dbProducts.map(p => [p.code, p]));
  const sheetMap = new Map(sheetProducts.map(p => [p.code, p]));
  
  // Find added and updated products
  for (const sheetProduct of sheetProducts) {
    const dbProduct = dbMap.get(sheetProduct.code);
    
    if (!dbProduct) {
      // New product
      result.added.push(sheetProduct);
    } else {
      // Check for changes
      const changes: Partial<ProductRow> = {};
      
      if (sheetProduct.description !== (dbProduct.description || '')) {
        changes.description = sheetProduct.description;
      }
      if (sheetProduct.price !== dbProduct.price) {
        changes.price = sheetProduct.price;
      }
      if (sheetProduct.active !== (dbProduct.active ?? true)) {
        changes.active = sheetProduct.active;
      }
      if (sheetProduct.weight !== dbProduct.weight) {
        changes.weight = sheetProduct.weight;
      }
      if (sheetProduct.imageUrl !== dbProduct.imageUrl) {
        changes.imageUrl = sheetProduct.imageUrl;
      }
      if (sheetProduct.subcategory !== dbProduct.subcategory) {
        changes.subcategory = sheetProduct.subcategory;
      }
      if (JSON.stringify(sheetProduct.categoryPaths) !== JSON.stringify(dbProduct.categoryPaths)) {
        changes.categoryPaths = sheetProduct.categoryPaths;
      }
      if (JSON.stringify(sheetProduct.tags) !== JSON.stringify(dbProduct.tags)) {
        changes.tags = sheetProduct.tags;
      }
      if (sheetProduct.notes !== dbProduct.notes) {
        changes.notes = sheetProduct.notes;
      }
      
      if (Object.keys(changes).length > 0) {
        result.updated.push({
          code: sheetProduct.code,
          changes,
        });
      }
    }
  }
  
  // Find products to deactivate (in DB but not in sheet, or marked inactive in sheet)
  for (const dbProduct of dbProducts) {
    const sheetProduct = sheetMap.get(dbProduct.code);
    
    if (!sheetProduct && dbProduct.active) {
      // Product missing from sheet, deactivate it
      result.deactivated.push(dbProduct.code);
    }
  }
  
  return result;
}

/**
 * Compares current UI configs with sheet rows
 */
export function diffUIConfig(currentConfigs: ProductUIConfig[], sheetRows: UIConfigRow[]): UIConfigDiff {
  const result: UIConfigDiff = {
    added: [],
    updated: [],
    configs: {},
  };
  
  // Group sheet rows by variant key
  const variantGroups = new Map<string, UIConfigRow[]>();
  for (const row of sheetRows) {
    if (!variantGroups.has(row.variantKey)) {
      variantGroups.set(row.variantKey, []);
    }
    variantGroups.get(row.variantKey)!.push(row);
  }
  
  // Build normalized config for each variant
  for (const [variantKey, rows] of variantGroups.entries()) {
    const config: any = {
      allowedCategories: rows[0].allowedCategories,
      allowedSubcategories: rows[0].allowedSubcategories,
      fieldConfigs: {},
    };
    
    // Build field configs
    for (const row of rows) {
      if (row.field) {
        config.fieldConfigs[row.field] = {
          type: row.type,
          default: row.default,
          min: row.min,
          max: row.max,
          step: row.step,
          tolerance: row.tolerance,
          categoryPaths: row.categoryPaths,
        };
      }
    }
    
    result.configs[variantKey] = config;
    
    // Check if variant exists in current configs
    const existing = currentConfigs.find(c => c.variantKey === variantKey);
    
    if (!existing) {
      result.added.push(variantKey);
    } else {
      // Deep compare config
      if (JSON.stringify(existing.config) !== JSON.stringify(config)) {
        result.updated.push(variantKey);
      }
    }
  }
  
  return result;
}
