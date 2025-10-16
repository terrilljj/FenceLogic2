/**
 * Initialize UI configuration for custom-panel-designer variant
 */

import { db } from "../db";
import { productUIConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { UIFieldConfig } from "@shared/schema";

const VARIANT = "custom-panel-designer";

async function initCustomPanelUIConfig() {
  console.log("\n🔧 Initializing UI Config for Custom Panel Designer\n");

  try {
    // Check if config already exists
    const existing = await db
      .select()
      .from(productUIConfigs)
      .where(eq(productUIConfigs.productVariant, VARIANT))
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✓ UI config already exists for ${VARIANT}`);
      console.log(`  Skipping initialization.`);
      process.exit(0);
    }

    // Define field configurations
    const fieldConfigs: UIFieldConfig[] = [
      {
        type: "number",
        field: "section-length",
        enabled: true,
        position: 1,
        label: "Section Length",
        tooltip: "Enter the total length of this fence section",
        unit: "mm",
        default: 3000,
        min: 0,
        max: 50000,
        step: 100,
      },
      {
        type: "standard",
        field: "left-gap",
        enabled: true,
        position: 2,
        label: "Left Gap",
        tooltip: "Configure the gap on the left side of the section",
        defaultValue: 25,
      },
      {
        type: "standard",
        field: "right-gap",
        enabled: true,
        position: 3,
        label: "Right Gap",
        tooltip: "Configure the gap on the right side of the section",
        defaultValue: 25,
      },
      {
        type: "standard",
        field: "max-panel-width",
        enabled: true,
        position: 4,
        label: "Max Panel Width",
        tooltip: "Set the maximum width for variable panels",
        defaultValue: "1200",
        options: Array.from({ length: 37 }, (_, i) => (200 + i * 50).toString()),
      },
      {
        type: "standard",
        field: "desired-gap",
        enabled: true,
        position: 5,
        label: "Desired Gap Between Panels",
        tooltip: "Set the target gap spacing between panels",
        defaultValue: 10,
      },
      {
        type: "standard",
        field: "custom-panel",
        enabled: true,
        position: 6,
        label: "Custom Panel",
        tooltip: "Add a custom-sized panel with specific dimensions (any size, not restricted to stock)",
      },
      {
        type: "standard",
        field: "glass-thickness",
        enabled: true,
        position: 7,
        label: "Glass Thickness",
        tooltip: "Select glass thickness",
        defaultValue: "12mm",
        options: ["12mm", "15mm"],
      },
    ];

    // Insert the configuration
    await db.insert(productUIConfigs).values({
      productVariant: VARIANT,
      fieldConfigs: fieldConfigs as any,
      allowedCategories: [],
      allowedSubcategories: [],
    });

    console.log(`✓ Created UI config for ${VARIANT}`);
    console.log(`  Fields configured: ${fieldConfigs.length}`);
    console.log("\n  Fields:");
    fieldConfigs.forEach((f) => {
      console.log(`    - ${f.label} (${f.field})`);
    });
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing UI config:", error);
    process.exit(1);
  }
}

initCustomPanelUIConfig();
