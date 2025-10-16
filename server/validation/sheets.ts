import { z } from 'zod';

/**
 * Schema for Product row from Google Sheets
 */
export const ProductRowSchema = z.object({
  code: z.string().min(1, 'Product code is required'),
  description: z.string().optional(),
  price: z.number({ invalid_type_error: 'Price must be a number' }),
  active: z.boolean().default(true),
  weight: z.number().optional(),
  imageUrl: z.string().optional(),
  subcategory: z.string().optional(),
  categoryPaths: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type ProductRow = z.infer<typeof ProductRowSchema>;

/**
 * Schema for UI Config row from Google Sheets
 */
export const UIConfigRowSchema = z.object({
  variantKey: z.string().min(1, 'Variant key is required'),
  allowedCategories: z.array(z.string()).optional(),
  allowedSubcategories: z.array(z.string()).optional(),
  field: z.string().optional(),
  type: z.enum(['number', 'standard', 'toggle']).optional(),
  default: z.union([z.string(), z.number()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  tolerance: z.number().optional(),
  categoryPaths: z.array(z.string()).optional(),
});

export type UIConfigRow = z.infer<typeof UIConfigRowSchema>;

/**
 * Schema for Category row from Google Sheets
 */
export const CategoryRowSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  displayOrder: z.number().optional(),
});

export type CategoryRow = z.infer<typeof CategoryRowSchema>;
