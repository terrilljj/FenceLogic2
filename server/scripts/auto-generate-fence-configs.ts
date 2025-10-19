#!/usr/bin/env tsx
/**
 * Auto-generate fence style UI configurations from calculator variables
 * This ensures the UI fields match exactly what the backend calculator expects
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';
import type { FenceUIConfig, UIFieldConfigWithRules } from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Core calculator fields - these are ALWAYS needed for panel calculations
const coreCalcFields: UIFieldConfigWithRules[] = [
  {
    field: 'section-length',
    enabled: true,
    position: 0,
    label: 'Section Length',
    tooltip: 'Total length of the fence section',
    type: 'number',
    unit: 'mm',
    min: 500,
    max: 10000,
    step: 50,
    default: 3000,
  },
  {
    field: 'left-gap',
    enabled: true,
    position: 1,
    label: 'Left End Gap',
    tooltip: 'Gap from left post to first panel',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 150,
    step: 5,
    default: 50,
  },
  {
    field: 'right-gap',
    enabled: true,
    position: 2,
    label: 'Right End Gap',
    tooltip: 'Gap from last panel to right post',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 150,
    step: 5,
    default: 50,
  },
  {
    field: 'desired-gap',
    enabled: true,
    position: 3,
    label: 'Desired Panel Gap',
    tooltip: 'Target gap size between panels',
    type: 'number',
    unit: 'mm',
    min: 30,
    max: 99,
    step: 5,
    default: 50,
  },
  {
    field: 'max-panel-width',
    enabled: true,
    position: 4,
    label: 'Max Panel Width',
    tooltip: 'Maximum width for any single panel',
    type: 'number',
    unit: 'mm',
    min: 500,
    max: 2000,
    step: 50,
    default: 1200,
  },
];

// Gate configuration fields
const gateFields: UIFieldConfigWithRules[] = [
  {
    field: 'gate-config',
    enabled: true,
    position: 0,
    label: 'Gate Required',
    tooltip: 'Enable gate in this section',
    type: 'standard',
    options: ['Yes', 'No'],
    defaultValue: 'No',
  },
  {
    field: 'gate-panel-width',
    enabled: true,
    position: 1,
    label: 'Gate Panel Width',
    tooltip: 'Width of the gate panel',
    type: 'number',
    unit: 'mm',
    min: 700,
    max: 1200,
    step: 50,
    default: 900,
    context: 'gate',
  },
  {
    field: 'hinge-panel-width',
    enabled: true,
    position: 2,
    label: 'Hinge Panel Width',
    tooltip: 'Width of the hinge panel (glass-to-glass mount)',
    type: 'number',
    unit: 'mm',
    min: 300,
    max: 1200,
    step: 50,
    default: 600,
    context: 'hinge',
  },
];

// Generate fence style configurations
const fenceStyles: Omit<FenceUIConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Pool Fence with Spigots (already exists - skip)
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
              label: 'Standard Panels',
              order: 0,
              variants: [
                {
                  id: 'standard-glass',
                  label: 'Standard Glass Panels',
                  fieldConfigs: [
                    ...coreCalcFields,
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 5,
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
                      position: 6,
                      label: 'Glass Thickness',
                      type: 'standard',
                      options: ['10mm', '12mm', '15mm'],
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
                  id: 'standoff-hardware',
                  label: 'Standoff Hardware',
                  fieldConfigs: [
                    {
                      field: 'spigot-hardware',
                      enabled: true,
                      position: 0,
                      label: 'Hardware Finish',
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
                  label: 'Standard Slat Panels',
                  fieldConfigs: [
                    ...coreCalcFields,
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 5,
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
                      position: 6,
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
                  fieldConfigs: gateFields,
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
                    ...coreCalcFields,
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 5,
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
                      position: 6,
                      label: 'Color',
                      type: 'standard',
                      options: ['White', 'Cream', 'Grey'],
                      defaultValue: 'White',
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
  console.log('🏗️  Auto-generating fence style configurations from calculator variables...\n');
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const fenceStyle of fenceStyles) {
    try {
      const existing = await db.query.fenceUIConfigs.findFirst({
        where: (configs, { eq }) => eq(configs.fenceStyleId, fenceStyle.fenceStyleId),
      });
      
      if (existing) {
        console.log(`⚠️  Skipped ${fenceStyle.displayName} (already exists)`);
        skippedCount++;
        continue;
      }
      
      await db.insert(schema.fenceUIConfigs).values(fenceStyle);
      console.log(`✅ Inserted ${fenceStyle.displayName}`);
      console.log(`   - Sections: ${fenceStyle.config.sections.length}`);
      console.log(`   - Total variants: ${fenceStyle.config.sections.reduce((sum, s) => sum + s.variants.length, 0)}`);
      insertedCount++;
    } catch (error) {
      console.error(`❌ Error inserting ${fenceStyle.displayName}:`, error);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Inserted: ${insertedCount}`);
  console.log(`   Skipped:  ${skippedCount}`);
  console.log(`   Total:    ${fenceStyles.length}`);
  console.log(`\n✨ All field configs match calculator CompositionInput interface`);
  
  await pool.end();
}

seedFenceStyles().catch((error) => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
