import { z } from "zod";

// Mapping configuration for dropdown options or toggle states
const MappingValueSchema = z.object({
  categoryPaths: z.array(z.string()).optional(),
  subcategories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  codes: z.array(z.string()).optional(),
});

// Dropdown field configuration
const DropdownFieldSchema = z.object({
  type: z.literal("dropdown"),
  label: z.string(),
  options: z.array(z.string()),
  mapping: z.record(z.string(), MappingValueSchema),
});

// Toggle field configuration
const ToggleFieldSchema = z.object({
  type: z.literal("toggle"),
  label: z.string(),
  mapping: z.object({
    on: MappingValueSchema.optional(),
  }),
});

// Slot-based field configuration (new approach)
const SlotBasedFieldSchema = z.object({
  type: z.literal("slot-based"),
  label: z.string(),
  fieldName: z.string(), // Field identifier for slot generation (e.g., "glass-panels", "spigots")
  slotCount: z.number().int().min(1), // Number of slots to generate
  idPrefix: z.string().optional(), // Optional prefix for internal IDs (defaults to numeric)
});

// Number field configuration
const NumberFieldSchema = z.object({
  type: z.literal("number"),
  label: z.string(),
  tooltip: z.string().optional(),
  defaultValue: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});

// Slider field configuration
const SliderFieldSchema = z.object({
  type: z.literal("slider"),
  label: z.string(),
  tooltip: z.string().optional(),
  defaultValue: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});

// Field configuration (union of all field types)
const FieldConfigSchema = z.union([
  DropdownFieldSchema, 
  ToggleFieldSchema, 
  SlotBasedFieldSchema,
  NumberFieldSchema,
  SliderFieldSchema,
]);

// Root UI Config schema
export const UiConfigSchema = z.object({
  productVariant: z.string().optional(), // Optional for flexibility
  allowedCategories: z.array(z.string()),
  allowedSubcategories: z.array(z.string()),
  fieldConfigs: z.record(z.string(), FieldConfigSchema),
});

// Export types
export type UiConfigPayload = z.infer<typeof UiConfigSchema>;
export type MappingValue = z.infer<typeof MappingValueSchema>;
export type DropdownField = z.infer<typeof DropdownFieldSchema>;
export type ToggleField = z.infer<typeof ToggleFieldSchema>;
export type SlotBasedField = z.infer<typeof SlotBasedFieldSchema>;
export type NumberField = z.infer<typeof NumberFieldSchema>;
export type SliderField = z.infer<typeof SliderFieldSchema>;
export type FieldConfig = z.infer<typeof FieldConfigSchema>;
