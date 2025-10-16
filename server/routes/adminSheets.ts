import { Router } from 'express';
import { getSheetValues } from '../utils/googleSheets';
import { rowsToObjects, parseBool, parseBoolOrUndefined, parseNumber, parseJSONorSplit, parsePrice, toStringArray } from '../utils/rows';
import { ProductRowSchema, UIConfigRowSchema, type ProductRow, type UIConfigRow } from '../validation/sheets';
import { diffProducts, diffUIConfig } from '../services/sheetsDiff';
import { storage } from '../storage';
import { db } from '../db';
import { products, productUIConfigs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';

const router = Router();

type ValidationError = {
  row: number;
  field?: string;
  message: string;
};

type SyncResult = {
  summary: {
    products: {
      added: number;
      updated: number;
      deactivated: number;
    };
    uiConfigs: {
      variantsUpdated: number;
    };
  };
  errors: ValidationError[];
  samples?: {
    addedProducts?: ProductRow[];
    updatedProducts?: Array<{ code: string; changes: any }>;
    deactivatedProducts?: string[];
  };
};

/**
 * Writes sync log files
 */
async function writeSyncLogs(result: SyncResult, dryRun: boolean): Promise<{ jsonPath: string; mdPath: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logsDir = './logs';
  
  // Ensure logs directory exists
  await fs.mkdir(logsDir, { recursive: true });
  
  const jsonPath = `${logsDir}/sync-${timestamp}.json`;
  const mdPath = `${logsDir}/sync-${timestamp}.md`;
  
  // Write JSON log
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
  
  // Write markdown log
  const mdContent = `# Google Sheets Sync ${dryRun ? '(Dry Run)' : ''}
**Timestamp:** ${new Date().toISOString()}

## Summary

### Products
- Added: ${result.summary.products.added}
- Updated: ${result.summary.products.updated}
- Deactivated: ${result.summary.products.deactivated}

### UI Configs
- Variants Updated: ${result.summary.uiConfigs.variantsUpdated}

## Errors
${result.errors.length > 0 ? result.errors.map(e => `- Row ${e.row}: ${e.message}`).join('\n') : 'None'}

## Status
${dryRun ? '**DRY RUN** - No changes were applied' : '**APPLIED** - Changes have been written to database'}
`;
  
  await fs.writeFile(mdPath, mdContent);
  
  return { jsonPath, mdPath };
}

/**
 * POST /api/admin/sheets/pull?dryRun=1|0
 * Pulls data from Google Sheets and syncs to database
 */
router.post('/pull', async (req, res) => {
  const dryRun = req.query.dryRun === '1';
  
  try {
    const errors: ValidationError[] = [];
    
    // Read Products sheet
    console.log('[Sheets Pull] Reading Products sheet...');
    const productsValues = await getSheetValues('Products!A1:Z');
    const productObjects = rowsToObjects(productsValues);
    
    // Parse and validate products
    const validatedProducts: ProductRow[] = [];
    productObjects.forEach((obj, index) => {
      try {
        const parsed = {
          code: obj.code || '',
          description: obj.description || undefined,
          price: parsePrice(obj.price) || 0,
          active: parseBoolOrUndefined(obj.active),
          weight: parseNumber(obj.weight),
          imageUrl: obj.imageUrl || undefined,
          subcategory: obj.subcategory || undefined,
          categoryPaths: parseJSONorSplit(obj.categoryPaths),
          tags: toStringArray(obj.tags),
          notes: obj.notes || undefined,
        };
        
        const validated = ProductRowSchema.parse(parsed);
        validatedProducts.push(validated);
      } catch (err: any) {
        errors.push({
          row: index + 2, // +2 for header and 0-indexing
          field: err.errors?.[0]?.path?.[0],
          message: err.message || 'Validation failed',
        });
      }
    });
    
    // Read UI Config sheet
    console.log('[Sheets Pull] Reading UI_Config sheet...');
    const uiConfigValues = await getSheetValues('UI_Config!A1:Z');
    const uiConfigObjects = rowsToObjects(uiConfigValues);
    
    // Parse and validate UI configs
    const validatedUIConfigs: UIConfigRow[] = [];
    uiConfigObjects.forEach((obj, index) => {
      try {
        const parsed: UIConfigRow = {
          variantKey: obj.variantKey || '',
          allowedCategories: parseJSONorSplit(obj.allowedCategories),
          allowedSubcategories: parseJSONorSplit(obj.allowedSubcategories),
          field: obj.field || undefined,
          type: (obj.type as any) || undefined,
          default: obj.default ? (isNaN(Number(obj.default)) ? obj.default : Number(obj.default)) : undefined,
          min: parseNumber(obj.min),
          max: parseNumber(obj.max),
          step: parseNumber(obj.step),
          tolerance: parseNumber(obj.tolerance),
          categoryPaths: parseJSONorSplit(obj.categoryPaths),
        };
        
        const validated = UIConfigRowSchema.parse(parsed);
        validatedUIConfigs.push(validated);
      } catch (err: any) {
        errors.push({
          row: index + 2,
          field: err.errors?.[0]?.path?.[0],
          message: err.message || 'Validation failed',
        });
      }
    });
    
    // Load current database data
    const dbProducts = await storage.getAllProducts();
    const dbUIConfigs = await storage.getAllUIConfigs();
    
    // Compute diffs
    const productDiff = diffProducts(dbProducts, validatedProducts);
    const uiConfigDiff = diffUIConfig(dbUIConfigs, validatedUIConfigs);
    
    const result: SyncResult = {
      summary: {
        products: {
          added: productDiff.added.length,
          updated: productDiff.updated.length,
          deactivated: productDiff.deactivated.length,
        },
        uiConfigs: {
          variantsUpdated: uiConfigDiff.updated.length + uiConfigDiff.added.length,
        },
      },
      errors,
    };
    
    // Add samples for dry run
    if (dryRun) {
      result.samples = {
        addedProducts: productDiff.added.slice(0, 5),
        updatedProducts: productDiff.updated.slice(0, 5),
        deactivatedProducts: productDiff.deactivated.slice(0, 5),
      };
    }
    
    // Apply changes if not dry run
    if (!dryRun && errors.length === 0) {
      console.log('[Sheets Pull] Applying changes...');
      
      await db.transaction(async (tx) => {
        // Upsert products
        for (const product of productDiff.added) {
          await tx.insert(products).values({
            code: product.code,
            description: product.description || '',
            price: product.price,
            active: product.active,
            weight: product.weight,
            imageUrl: product.imageUrl,
            subcategory: product.subcategory,
            categoryPaths: product.categoryPaths,
            tags: product.tags,
            notes: product.notes,
          });
        }
        
        for (const { code, changes } of productDiff.updated) {
          await tx.update(products)
            .set(changes)
            .where(eq(products.code, code));
        }
        
        // Deactivate missing products
        for (const code of productDiff.deactivated) {
          await tx.update(products)
            .set({ active: false })
            .where(eq(products.code, code));
        }
        
        // Upsert UI configs
        for (const variantKey of [...uiConfigDiff.added, ...uiConfigDiff.updated]) {
          const config = uiConfigDiff.configs[variantKey];
          
          await tx.insert(productUIConfigs)
            .values({
              variantKey,
              config,
            })
            .onConflictDoUpdate({
              target: productUIConfigs.variantKey,
              set: { config, updatedAt: new Date().toISOString() },
            });
        }
      });
      
      console.log('[Sheets Pull] Changes applied successfully');
    }
    
    // Write logs
    const { jsonPath, mdPath } = await writeSyncLogs(result, dryRun);
    console.log('[Sheets Pull] Logs written:', { jsonPath, mdPath });
    
    res.json({
      ...result,
      logs: { jsonPath, mdPath },
    });
    
  } catch (error: any) {
    console.error('[Sheets Pull] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to sync from Google Sheets',
    });
  }
});

export default router;
