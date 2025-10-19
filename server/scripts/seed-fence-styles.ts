#!/usr/bin/env tsx
/**
 * Seed script to prepopulate fence style configurations
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';
import type { FenceUIConfig, FenceStyleConfig } from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

const fenceStyles: Omit<FenceUIConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    fenceStyleId: 'glass-balustrade',
    displayName: 'Glass Balustrade',
    productVariantRefs: ['glass-balustrade-standoffs'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Panels',
          order: 0,
          variants: [
            {
              id: 'standard',
              label: 'Standard',
              variants: [
                {
                  id: 'standard-12mm',
                  label: 'Standard 12mm',
                  fieldConfigs: [
                    {
                      field: 'section-length',
                      enabled: true,
                      position: 0,
                      label: 'Section Length',
                      type: 'number',
                      unit: 'mm',
                      min: 500,
                      max: 6000,
                      step: 50,
                      default: 3000,
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 1,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 900,
                      max: 1200,
                      step: 50,
                      default: 1000,
                    },
                    {
                      field: 'glass-thickness',
                      enabled: true,
                      position: 2,
                      label: 'Glass Thickness',
                      type: 'standard',
                      options: ['12mm', '15mm'],
                      defaultValue: '12mm',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'hardware',
          label: 'Hardware',
          order: 1,
          variants: [
            {
              id: 'standoffs',
              label: 'Standoffs',
              order: 0,
              variants: [
                {
                  id: 'polished',
                  label: 'Polished Standoffs',
                  fieldConfigs: [
                    {
                      field: 'finish',
                      enabled: true,
                      position: 0,
                      label: 'Finish',
                      type: 'standard',
                      options: ['Polished', 'Satin', 'Black'],
                      defaultValue: 'Polished',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    fenceStyleId: 'aluminium-slat',
    displayName: 'Aluminium Slat Fence',
    productVariantRefs: ['aluminium-slat-panels'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Panels',
          order: 0,
          variants: [
            {
              id: 'horizontal',
              label: 'Horizontal Slats',
              order: 0,
              variants: [
                {
                  id: 'standard',
                  label: 'Standard Spacing',
                  fieldConfigs: [
                    {
                      field: 'section-length',
                      enabled: true,
                      position: 0,
                      label: 'Section Length',
                      type: 'number',
                      unit: 'mm',
                      min: 1000,
                      max: 8000,
                      step: 100,
                      default: 2400,
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 1,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 1200,
                      max: 2400,
                      step: 100,
                      default: 1800,
                    },
                    {
                      field: 'finish',
                      enabled: true,
                      position: 2,
                      label: 'Powder Coat Color',
                      type: 'standard',
                      options: ['Monument', 'Surfmist', 'Woodland Grey', 'Black'],
                      defaultValue: 'Monument',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'gates',
          label: 'Gates',
          order: 1,
          variants: [
            {
              id: 'single-gate',
              label: 'Single Gate',
              order: 0,
              variants: [
                {
                  id: 'hinged',
                  label: 'Hinged Gate',
                  fieldConfigs: [
                    {
                      field: 'gate-width-mm',
                      enabled: true,
                      position: 0,
                      label: 'Gate Width',
                      type: 'number',
                      unit: 'mm',
                      min: 800,
                      max: 1200,
                      step: 50,
                      default: 900,
                      context: 'gate',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    fenceStyleId: 'pvc-hamptons',
    displayName: 'PVC Hamptons Fence',
    productVariantRefs: ['pvc-hamptons-panels'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Panels',
          order: 0,
          variants: [
            {
              id: 'full-privacy',
              label: 'Full Privacy',
              order: 0,
              variants: [
                {
                  id: 'standard',
                  label: 'Standard Panel',
                  fieldConfigs: [
                    {
                      field: 'section-length',
                      enabled: true,
                      position: 0,
                      label: 'Section Length',
                      type: 'number',
                      unit: 'mm',
                      min: 1000,
                      max: 6000,
                      step: 100,
                      default: 2400,
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 1,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 1500,
                      max: 2100,
                      step: 100,
                      default: 1800,
                    },
                    {
                      field: 'finish',
                      enabled: true,
                      position: 2,
                      label: 'Color',
                      type: 'standard',
                      options: ['White', 'Cream', 'Grey'],
                      defaultValue: 'White',
                    },
                  ],
                },
              ],
            },
            {
              id: 'semi-privacy',
              label: 'Semi Privacy',
              order: 1,
              variants: [
                {
                  id: 'lattice-top',
                  label: 'Lattice Top',
                  fieldConfigs: [
                    {
                      field: 'section-length',
                      enabled: true,
                      position: 0,
                      label: 'Section Length',
                      type: 'number',
                      unit: 'mm',
                      min: 1000,
                      max: 6000,
                      step: 100,
                      default: 2400,
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 1,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 1500,
                      max: 2100,
                      step: 100,
                      default: 1800,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
];

async function seedFenceStyles() {
  console.log('🏗️  Seeding fence style configurations...\n');
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const fenceStyle of fenceStyles) {
    try {
      // Check if already exists
      const existing = await db.query.fenceUIConfigs.findFirst({
        where: (configs, { eq }) => eq(configs.fenceStyleId, fenceStyle.fenceStyleId),
      });
      
      if (existing) {
        console.log(`⚠️  Skipped ${fenceStyle.displayName} (already exists)`);
        skippedCount++;
        continue;
      }
      
      // Insert new fence style config
      await db.insert(schema.fenceUIConfigs).values(fenceStyle);
      console.log(`✅ Inserted ${fenceStyle.displayName}`);
      insertedCount++;
    } catch (error) {
      console.error(`❌ Error inserting ${fenceStyle.displayName}:`, error);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Inserted: ${insertedCount}`);
  console.log(`   Skipped:  ${skippedCount}`);
  console.log(`   Total:    ${fenceStyles.length}`);
  
  await pool.end();
}

seedFenceStyles().catch((error) => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
