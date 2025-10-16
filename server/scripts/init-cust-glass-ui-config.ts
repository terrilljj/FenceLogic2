/**
 * Initialize UI configuration for custom-glass variant
 */

import { db } from "../db";
import { productUIConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { UIFieldConfig } from "@shared/schema";

const VARIANT = "custom-glass";

async function initCustomGlassUIConfig() {
  console.log("\n🔧 Initializing UI Config for Custom Glass\n");

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
        field: "glass-thickness",
        enabled: true,
        position: 4,
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
    console.log("  Note: Fully custom panel layout is controlled via toggle in span config");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing UI config:", error);
    process.exit(1);
  }
}

initCustomGlassUIConfig();
