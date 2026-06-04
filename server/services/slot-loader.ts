import { storage } from "../storage";
import { designVariants, type FenceDesign } from "@shared/schema";
import type { SlotMapping } from "./bom-calculator";

/**
 * Loads product_slots for every distinct style in a design (mixed designs have >1).
 * Returns BOTH a flat list (the design's primary variant — back-compat for the single
 * path) and a per-variant map so calculateComponents can resolve each section's SKUs
 * against its own variant's slots (slots are variant-keyed; a naive union cross-resolves).
 */
export async function loadDesignSlots(
  design: Pick<FenceDesign, "productVariant" | "spans">
): Promise<{ slotData: SlotMapping[]; slotsByVariant: Record<string, SlotMapping[]> }> {
  if (!design?.productVariant) {
    return { slotData: [], slotsByVariant: {} };
  }
  const variants = Array.isArray(design.spans) && design.spans.length > 0
    ? designVariants(design as FenceDesign)
    : [design.productVariant];

  const slotsByVariant: Record<string, SlotMapping[]> = {};
  await Promise.all(
    variants.map(async (variant) => {
      const slots = await storage.getAllSlotsByVariant(variant);
      slotsByVariant[variant] = slots.map((s) => ({
        internalId: s.internalId,
        fieldName: s.fieldName,
        productId: s.productId,
        label: s.label,
        discriminatorAttributes: s.discriminatorAttributes as Record<string, string> | null,
      }));
    })
  );

  const slotData = slotsByVariant[design.productVariant] ?? [];
  return { slotData, slotsByVariant };
}
