#!/usr/bin/env tsx
/**
 * Seed script to fix orphan SKUs with proper subcategory and category_paths
 * 
 * Updates:
 * - TEST-POOL-001 → subcategory: "Spigots", category_paths: ["pool_fence/frameless/spigots"]
 * - GP-1200-1000-12 → subcategory: "Raked", category_paths: ["pool_fence/frameless/glass_panels/12mm","pool_fence/frameless/raked"]
 * - TEST-BALUSTRADE-001 → subcategory: "Standoffs", category_paths: ["balustrade/frameless/standoffs"]
 * - TEST-HAMPTONS-001 → subcategory: "Hamptons Full Privacy", category_paths: ["pvc/hamptons/panels"]
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

interface ProductUpdate {
  code: string;
  subcategory: string;
  categoryPaths: string[];
}

const updates: ProductUpdate[] = [
  {
    code: 'TEST-POOL-001',
    subcategory: 'Spigots',
    categoryPaths: ['pool_fence/frameless/spigots'],
  },
  {
    code: 'GP-1200-1000-12',
    subcategory: 'Raked',
    categoryPaths: ['pool_fence/frameless/glass_panels/12mm', 'pool_fence/frameless/raked'],
  },
  {
    code: 'TEST-BALUSTRADE-001',
    subcategory: 'Standoffs',
    categoryPaths: ['balustrade/frameless/standoffs'],
  },
  {
    code: 'TEST-HAMPTONS-001',
    subcategory: 'Raked',
    categoryPaths: ['pvc/hamptons/panels'],
  },
];

async function seedFixes() {
  console.log('🔧 Starting product fixes...\n');
  
  let updatedCount = 0;
  
  for (const update of updates) {
    try {
      const result = await db
        .update(schema.products)
        .set({
          subcategory: update.subcategory,
          categoryPaths: update.categoryPaths,
        })
        .where(eq(schema.products.code, update.code))
        .returning({ code: schema.products.code });
      
      if (result.length > 0) {
        console.log(`✓ Updated ${update.code}:`);
        console.log(`  - subcategory: ${update.subcategory}`);
        console.log(`  - categoryPaths: [${update.categoryPaths.join(', ')}]`);
        updatedCount++;
      } else {
        console.log(`⚠ Product not found: ${update.code}`);
      }
    } catch (error) {
      console.error(`✗ Error updating ${update.code}:`, error);
    }
  }
  
  console.log(`\n✅ Complete! Updated ${updatedCount} out of ${updates.length} products.`);
  
  await pool.end();
}

seedFixes().catch((error) => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
