/**
 * Patch script to add numeric field configurations for gate and hinge panel widths
 * to the frameless glass pool fence variant
 */

import { db } from "../db";
import { productUIConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { UIFieldConfig } from "@shared/schema";

const FRAMELESS_VARIANT = "glass-pool-spigots";

async function patchUIConfigGateSizes() {
  console.log("\n🔧 Patching UI Config: Adding numeric fields for gate/hinge widths\n");

  try {
    // Fetch the current UI config for the frameless variant
    const existing = await db
      .select()
      .from(productUIConfigs)
      .where(eq(productUIConfigs.productVariant, FRAMELESS_VARIANT))
      .limit(1);

    if (!existing || existing.length === 0) {
      console.error(`❌ No UI config found for variant: ${FRAMELESS_VARIANT}`);
      console.log("   Please create a UI config for this variant first.");
      process.exit(1);
    }

    const currentConfig = existing[0];
    const currentFields = currentConfig.fieldConfigs || [];

    console.log(`✓ Found existing config for ${FRAMELESS_VARIANT}`);
    console.log(`  Current field count: ${currentFields.length}`);

    // Check if numeric fields already exist
    const hasGateWidth = currentFields.some(
      (f: UIFieldConfig) => f.field === "gate-width-mm"
    );
    const hasHingeWidth = currentFields.some(
      (f: UIFieldConfig) => f.field === "hinge-panel-width-mm"
    );

    console.log(`  Has gate-width-mm: ${hasGateWidth}`);
    console.log(`  Has hinge-panel-width-mm: ${hasHingeWidth}`);

    // Prepare new numeric fields
    const gateWidthField: UIFieldConfig = {
      type: "number",
      field: "gate-width-mm",
      enabled: true,
      position: currentFields.length + 1,
      label: "Gate Width",
      tooltip: "Specify the gate width in millimeters",
      unit: "mm",
      default: 850,
      min: 700,
      max: 1200,
      step: 50,
      tolerance: 50,
      context: "gate",
      subcategory: "Gate Master",
    };

    const hingeWidthField: UIFieldConfig = {
      type: "number",
      field: "hinge-panel-width-mm",
      enabled: true,
      position: currentFields.length + 2,
      label: "Hinge Panel Width",
      tooltip: "Specify the hinge panel width in millimeters (for glass-to-glass gates)",
      unit: "mm",
      default: 1100,
      min: 300,
      max: 1800,
      step: 100,
      tolerance: 50,
      context: "hinge",
      subcategory: "Hinge Panels Master",
    };

    // Build the updated field configs array
    const updatedFields = [...currentFields];
    let addedCount = 0;

    if (!hasGateWidth) {
      updatedFields.push(gateWidthField);
      addedCount++;
      console.log("  ✓ Adding gate-width-mm field");
    } else {
      // Update existing field
      const index = updatedFields.findIndex(
        (f: UIFieldConfig) => f.field === "gate-width-mm"
      );
      if (index >= 0) {
        updatedFields[index] = {
          ...updatedFields[index],
          ...gateWidthField,
          position: updatedFields[index].position, // Keep existing position
        };
        console.log("  ✓ Updating existing gate-width-mm field");
      }
    }

    if (!hasHingeWidth) {
      updatedFields.push(hingeWidthField);
      addedCount++;
      console.log("  ✓ Adding hinge-panel-width-mm field");
    } else {
      // Update existing field
      const index = updatedFields.findIndex(
        (f: UIFieldConfig) => f.field === "hinge-panel-width-mm"
      );
      if (index >= 0) {
        updatedFields[index] = {
          ...updatedFields[index],
          ...hingeWidthField,
          position: updatedFields[index].position, // Keep existing position
        };
        console.log("  ✓ Updating existing hinge-panel-width-mm field");
      }
    }

    // Update the database
    await db
      .update(productUIConfigs)
      .set({
        fieldConfigs: updatedFields,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(productUIConfigs.productVariant, FRAMELESS_VARIANT));

    console.log("\n✅ UI Config patched successfully");
    console.log(`   Total field count: ${currentFields.length} → ${updatedFields.length}`);
    console.log(`   Fields added: ${addedCount}`);
    console.log(`   Fields updated: ${hasGateWidth || hasHingeWidth ? (hasGateWidth ? 1 : 0) + (hasHingeWidth ? 1 : 0) : 0}`);

    // Summary
    console.log("\n📋 Summary of Changes:");
    console.log("   Variant: glass-pool-spigots");
    console.log("   Gate Width Field:");
    console.log("     - Default: 850mm");
    console.log("     - Range: 700-1200mm");
    console.log("     - Step: 50mm");
    console.log("     - Tolerance: ±50mm");
    console.log("     - Subcategory: Gate Master");
    console.log("   Hinge Panel Width Field:");
    console.log("     - Default: 1100mm");
    console.log("     - Range: 300-1800mm");
    console.log("     - Step: 100mm");
    console.log("     - Tolerance: ±50mm");
    console.log("     - Subcategory: Hinge Panels Master");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error patching UI config:", error);
    process.exit(1);
  }
}

// Run the patch
patchUIConfigGateSizes();
