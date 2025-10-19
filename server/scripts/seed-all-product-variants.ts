#!/usr/bin/env tsx
/**
 * Seed fence UI configs for ALL product variants from home page
 * Ensures fence-styles admin page matches home page navigation
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

// Core calculator fields
const coreFields: UIFieldConfigWithRules[] = [
  {
    field: 'section-length',
    enabled: true,
    position: 0,
    label: 'Section Length',
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
    type: 'number',
    unit: 'mm',
    min: 500,
    max: 2000,
    step: 50,
    default: 1200,
  },
];

// All product variants matching home page
const fenceConfigs: Omit<FenceUIConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // GLASS POOL FENCE - Frameless with Spigots
  {
    fenceStyleId: 'glass-pool-spigots',
    displayName: 'Frameless Pool Fence (Spigots)',
    productVariantRefs: ['glass-pool-spigots'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Glass Panels',
          order: 0,
          variants: [
            {
              id: 'standard',
              label: 'Standard Panels',
              order: 0,
              variants: [
                {
                  id: 'glass-panels',
                  label: 'Glass Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
                    {
                      field: 'glass-thickness',
                      enabled: true,
                      position: 5,
                      label: 'Glass Thickness',
                      type: 'standard',
                      options: ['12mm', '15mm'],
                      defaultValue: '12mm',
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 6,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 1200,
                      max: 1500,
                      step: 50,
                      default: 1200,
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
              id: 'spigots',
              label: 'Spigots',
              order: 0,
              variants: [
                {
                  id: 'spigot-config',
                  label: 'Spigot Hardware',
                  fieldConfigs: [
                    {
                      field: 'spigot-hardware',
                      enabled: true,
                      position: 0,
                      label: 'Finish',
                      type: 'standard',
                      options: ['Polished', 'Satin', 'Black'],
                      defaultValue: 'Satin',
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
  
  // GLASS POOL FENCE - Channel
  {
    fenceStyleId: 'glass-pool-channel',
    displayName: 'Channel Pool Fence',
    productVariantRefs: ['glass-pool-channel'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Glass Panels',
          order: 0,
          variants: [
            {
              id: 'standard',
              label: 'Standard Panels',
              order: 0,
              variants: [
                {
                  id: 'glass-panels',
                  label: 'Glass Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
                    {
                      field: 'glass-thickness',
                      enabled: true,
                      position: 5,
                      label: 'Glass Thickness',
                      type: 'standard',
                      options: ['10mm', '12mm'],
                      defaultValue: '10mm',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'hardware',
          label: 'Channel Hardware',
          order: 1,
          variants: [
            {
              id: 'channel',
              label: 'Aluminium Channel',
              order: 0,
              variants: [
                {
                  id: 'channel-config',
                  label: 'Channel Hardware',
                  fieldConfigs: [
                    {
                      field: 'channel-hardware',
                      enabled: true,
                      position: 0,
                      label: 'Finish',
                      type: 'standard',
                      options: ['Mill Finish', 'Powder Coat Black', 'Powder Coat White'],
                      defaultValue: 'Mill Finish',
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

  // GLASS BALUSTRADE - Spigots
  {
    fenceStyleId: 'glass-bal-spigots',
    displayName: 'Frameless Balustrade (Spigots)',
    productVariantRefs: ['glass-bal-spigots'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Glass Panels',
          order: 0,
          variants: [
            {
              id: 'standard',
              label: 'Standard Panels',
              order: 0,
              variants: [
                {
                  id: 'glass-panels',
                  label: 'Glass Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
                    {
                      field: 'glass-thickness',
                      enabled: true,
                      position: 5,
                      label: 'Glass Thickness',
                      type: 'standard',
                      options: ['12mm', '15mm'],
                      defaultValue: '12mm',
                    },
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 6,
                      label: 'Panel Height',
                      type: 'number',
                      unit: 'mm',
                      min: 900,
                      max: 1200,
                      step: 50,
                      default: 1000,
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

  // GLASS BALUSTRADE - Standoffs
  {
    fenceStyleId: 'glass-bal-standoffs',
    displayName: 'Standoff Balustrade',
    productVariantRefs: ['glass-bal-standoffs'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Glass Panels',
          order: 0,
          variants: [
            {
              id: 'standard',
              label: 'Standard Panels',
              order: 0,
              variants: [
                {
                  id: 'glass-panels',
                  label: 'Glass Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
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
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // PVC HAMPTONS - Full Privacy
  {
    fenceStyleId: 'pvc-hamptons-full-privacy',
    displayName: 'Hamptons Full Privacy',
    productVariantRefs: ['pvc-hamptons-full-privacy'],
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
              label: 'Full Privacy Panels',
              order: 0,
              variants: [
                {
                  id: 'panel-config',
                  label: 'Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
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

  // ALUMINIUM POOL - BARR
  {
    fenceStyleId: 'alu-pool-barr',
    displayName: 'BARR Pool Fence',
    productVariantRefs: ['alu-pool-barr'],
    status: 'active',
    config: {
      sections: [
        {
          id: 'panels',
          label: 'Panels',
          order: 0,
          variants: [
            {
              id: 'barr-panels',
              label: 'BARR Panels',
              order: 0,
              variants: [
                {
                  id: 'panel-config',
                  label: 'Panel Configuration',
                  fieldConfigs: [
                    ...coreFields,
                    {
                      field: 'panel-height',
                      enabled: true,
                      position: 5,
                      label: 'Panel Height',
                      type: 'standard',
                      options: ['1000mm', '1200mm', '1800mm'],
                      defaultValue: '1200mm',
                    },
                    {
                      field: 'finish',
                      enabled: true,
                      position: 6,
                      label: 'Finish',
                      type: 'standard',
                      options: ['Satin Black', 'Pearl White'],
                      defaultValue: 'Satin Black',
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

async function seedAllVariants() {
  console.log('🏗️  Seeding fence configs for all product variants...\n');
  
  let insertedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  
  for (const config of fenceConfigs) {
    try {
      const existing = await db.query.fenceUIConfigs.findFirst({
        where: (configs, { eq }) => eq(configs.fenceStyleId, config.fenceStyleId),
      });
      
      if (existing) {
        console.log(`⚠️  Skipped ${config.displayName} (already exists)`);
        skippedCount++;
        continue;
      }
      
      await db.insert(schema.fenceUIConfigs).values(config);
      console.log(`✅ Inserted ${config.displayName}`);
      insertedCount++;
    } catch (error) {
      console.error(`❌ Error with ${config.displayName}:`, error);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Inserted: ${insertedCount}`);
  console.log(`   Skipped:  ${skippedCount}`);
  console.log(`   Total:    ${fenceConfigs.length}`);
  console.log(`\n✨ Fence style IDs now match ProductVariant enum`);
  
  await pool.end();
}

seedAllVariants().catch((error) => {
  console.error('Fatal error:', error);
  pool.end();
  process.exit(1);
});
