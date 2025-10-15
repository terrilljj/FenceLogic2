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

// Field configuration (union of dropdown and toggle)
const FieldConfigSchema = z.union([DropdownFieldSchema, ToggleFieldSchema]);

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
export type FieldConfig = z.infer<typeof FieldConfigSchema>;
