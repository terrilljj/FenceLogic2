#!/usr/bin/env tsx
/**
 * Product Data Hygiene Linter
 * 
 * Detects:
 * - Dead categoryPaths: paths referenced by UI configs with zero matching products
 * - Dead subcategories: subcategories referenced by UI configs that don't exist or have zero active products
 * - Orphan SKUs: active products not referenced by any UI config
 * 
 * Usage:
 *   npm run lint:data              # Print summary and exit 0
 *   npm run lint:data:strict       # Exit 1 if issues found
 *   npm run lint:data -- --json    # Output JSON
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import ws from 'ws';
import * as schema from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

interface LintResult {
  neededPaths: string[];
  neededSubcategories: string[];
  deadPaths: string[];
  deadSubcategories: string[];
  orphanCount: number;
  orphans: Array<{ code: string; subcategory: string | null; categoryPaths: string[] | null }>;
}

async function lintProducts(): Promise<LintResult> {
  // Load all UI configs
  const uiConfigs = await db.select().from(schema.productUIConfigs);
  
  // Aggregate all referenced categoryPaths and subcategories
  const neededPathsSet = new Set<string>();
  const neededSubcategoriesSet = new Set<string>();
  
  for (const config of uiConfigs) {
    const fieldConfigs = config.fieldConfigs as schema.UIFieldConfig[];
    
    // Extract paths from dropdown optionPaths (values of the record)
    for (const fieldConfig of fieldConfigs) {
      if (fieldConfig.optionPaths) {
        for (const paths of Object.values(fieldConfig.optionPaths)) {
          for (const path of paths) {
            neededPathsSet.add(path);
          }
        }
      }
      
      // Extract paths from toggle categoryPaths
      if (fieldConfig.categoryPaths) {
        for (const path of fieldConfig.categoryPaths) {
          neededPathsSet.add(path);
        }
      }
    }
    
    // Extract subcategories from allowedSubcategories
    const allowedSubcategories = config.allowedSubcategories as string[] || [];
    for (const subcategory of allowedSubcategories) {
      neededSubcategoriesSet.add(subcategory);
    }
  }
  
  const neededPaths = Array.from(neededPathsSet).sort();
  const neededSubcategories = Array.from(neededSubcategoriesSet).sort();
  
  // Load all active products
  const allProducts = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.active, 1));
  
  // Compute dead paths: paths with zero matching products
  const deadPaths: string[] = [];
  for (const path of neededPaths) {
    const matchingProducts = allProducts.filter(p => {
      const categoryPaths = p.categoryPaths || [];
      return categoryPaths.includes(path);
    });
    
    if (matchingProducts.length === 0) {
      deadPaths.push(path);
    }
  }
  
  // Compute dead subcategories: subcategories with zero active products
  const deadSubcategories: string[] = [];
  for (const subcategory of neededSubcategories) {
    const matchingProducts = allProducts.filter(p => p.subcategory === subcategory);
    
    if (matchingProducts.length === 0) {
      deadSubcategories.push(subcategory);
    }
  }
  
  // Compute orphans: active products not referenced by any UI config
  const orphans: Array<{ code: string; subcategory: string | null; categoryPaths: string[] | null }> = [];
  for (const product of allProducts) {
    const productPaths = product.categoryPaths || [];
    const productSubcategory = product.subcategory;
    
    // Check if any of the product's paths are in the needed set
    const hasPathMatch = productPaths.some(path => neededPathsSet.has(path));
    
    // Check if the product's subcategory is in the needed set
    const hasSubcategoryMatch = productSubcategory && neededSubcategoriesSet.has(productSubcategory);
    
    // If neither path nor subcategory matches, it's an orphan
    if (!hasPathMatch && !hasSubcategoryMatch) {
      orphans.push({
        code: product.code,
        subcategory: productSubcategory,
        categoryPaths: productPaths.length > 0 ? productPaths : null,
      });
    }
  }
  
  return {
    neededPaths,
    neededSubcategories,
    deadPaths,
    deadSubcategories,
    orphanCount: orphans.length,
    orphans,
  };
}

function printColorizedReport(result: LintResult) {
  console.log(`${colors.cyan}${colors.bright}─ Lint Summary${colors.reset}`);
  console.log();
  
  console.log(`${colors.blue}Needed categoryPaths:${colors.reset} ${result.neededPaths.length}`);
  console.log(`${colors.blue}Needed subcategories:${colors.reset} ${result.neededSubcategories.length}`);
  console.log();
  
  // Dead paths
  if (result.deadPaths.length > 0) {
    console.log(`${colors.red}${colors.bright}Dead categoryPaths: ${result.deadPaths.length}${colors.reset}`);
    const displayPaths = result.deadPaths.slice(0, 10);
    for (const path of displayPaths) {
      console.log(`  ${colors.red}✗${colors.reset} ${colors.dim}${path}${colors.reset}`);
    }
    if (result.deadPaths.length > 10) {
      console.log(`  ${colors.dim}... and ${result.deadPaths.length - 10} more${colors.reset}`);
    }
    console.log();
  } else {
    console.log(`${colors.green}Dead categoryPaths: 0${colors.reset}`);
    console.log();
  }
  
  // Dead subcategories
  if (result.deadSubcategories.length > 0) {
    console.log(`${colors.red}${colors.bright}Dead subcategories: ${result.deadSubcategories.length}${colors.reset}`);
    for (const subcategory of result.deadSubcategories) {
      console.log(`  ${colors.red}✗${colors.reset} ${colors.dim}${subcategory}${colors.reset}`);
    }
    console.log();
  } else {
    console.log(`${colors.green}Dead subcategories: 0${colors.reset}`);
    console.log();
  }
  
  // Orphan SKUs
  if (result.orphanCount > 0) {
    console.log(`${colors.yellow}${colors.bright}Orphan SKUs: ${result.orphanCount}${colors.reset}`);
    const displayOrphans = result.orphans.slice(0, 20);
    for (const orphan of displayOrphans) {
      const subcategoryDisplay = orphan.subcategory || '(no subcategory)';
      const pathsDisplay = orphan.categoryPaths 
        ? `[${orphan.categoryPaths.join(', ')}]`
        : '(no paths)';
      console.log(`  ${colors.yellow}⚠${colors.reset} ${colors.dim}${orphan.code}${colors.reset} → ${subcategoryDisplay} ${colors.dim}${pathsDisplay}${colors.reset}`);
    }
    if (result.orphanCount > 20) {
      console.log(`  ${colors.dim}... and ${result.orphanCount - 20} more${colors.reset}`);
    }
    console.log();
  } else {
    console.log(`${colors.green}Orphan SKUs: 0${colors.reset}`);
    console.log();
  }
  
  // Summary
  const hasIssues = result.deadPaths.length > 0 || result.deadSubcategories.length > 0 || result.orphanCount > 0;
  if (hasIssues) {
    console.log(`${colors.red}${colors.bright}Issues found!${colors.reset}`);
    console.log();
    console.log(`${colors.dim}Typical fixes:${colors.reset}`);
    console.log(`  • Map missing paths in UI Config editor`);
    console.log(`  • Add subcategories in Category Manager`);
    console.log(`  • Deactivate orphan SKUs or add proper category paths`);
  } else {
    console.log(`${colors.green}${colors.bright}✓ All clear!${colors.reset}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isStrict = args.includes('--strict');
  const isJson = args.includes('--json');
  
  try {
    const result = await lintProducts();
    
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printColorizedReport(result);
    }
    
    // Exit with code 1 in strict mode if issues found
    if (isStrict) {
      const hasIssues = result.deadPaths.length > 0 || result.deadSubcategories.length > 0 || result.orphanCount > 0;
      if (hasIssues) {
        process.exit(1);
      }
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}Error running lint:${colors.reset}`, error);
    await pool.end();
    process.exit(1);
  }
}

main();
