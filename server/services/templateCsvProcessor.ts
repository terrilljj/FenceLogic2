import { parse } from 'csv-parse/sync';
import { z } from 'zod';

// CSV Row Schema - matches simplified flat structure
const CsvRowSchema = z.object({
  variable_type: z.string().min(1, "variable_type is required"),
  label: z.string().min(1, "label is required"),
  field_type: z.enum(['number', 'select', 'boolean', 'product']),
  min: z.string().optional(),
  max: z.string().optional(),
  step: z.string().optional(),
  default_value: z.string().optional(),
  options: z.string().optional(),
  enabled: z.string().optional(),
  slot_prefix: z.string().optional(),
  size_mm: z.string().optional(),
  product_sku: z.string().optional(),
  product_description: z.string().optional(),
  product_price: z.string().optional(),
  notes: z.string().optional(),
  // Layout metadata columns (optional — existing CSVs without them still import correctly)
  display_column: z.string().optional(),       // Column number for DynamicFieldColumns (e.g. "1")
  display_position: z.string().optional(),     // Sort order within column (e.g. "2")
  display_column_name: z.string().optional(),  // Column header label (e.g. "Dimensions & Gaps")
  visibility_condition: z.string().optional(), // JSON string: {"fieldKey":"gate-config","value":true}
  // Discriminator attributes for product slots (JSON string)
  discriminator_attributes: z.string().optional(), // e.g. '{"family":"madrid","mounting":"core-drilled"}'
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

// Categorized template data
export interface ProcessedTemplate {
  templateId: string;
  filename: string;
  calculatorInputs: CalculatorInput[];
  selectInputs: SelectInput[];
  productMappings: ProductMapping[];
  featureToggles: FeatureToggle[];
  gateConfigs: GateConfig[];
  validationErrors: string[];
}

export interface CalculatorInput {
  variableType: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  options?: string;
  section?: string;
  displayColumn?: number;
  displayPosition?: number;
  displayColumnName?: string;
  visibilityCondition?: Record<string, unknown> | null;
}

export interface SelectInput {
  variableType: string;
  label: string;
  options: string;
  defaultValue?: string;
  displayColumn?: number;
  displayPosition?: number;
  displayColumnName?: string;
  visibilityCondition?: Record<string, unknown> | null;
}

export interface ProductMapping {
  variableType: string;
  label: string;
  slotPrefix: string;
  sizeMm: number;
  productSku: string;
  productDescription: string;
  productPrice: number;
  // Discriminator attributes parsed from the CSV `discriminator_attributes` JSON column.
  // Forwarded to product_slots.discriminator_attributes for the runtime slot resolver.
  discriminatorAttributes: Record<string, string> | null;
}

export interface FeatureToggle {
  variableType: string;
  label: string;
  defaultValue: boolean;
}

export interface GateConfig {
  variableType: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

/**
 * Parses and validates CSV template data
 * Returns both validated rows and any validation errors (doesn't throw)
 */
export async function parseTemplateCSV(csvData: string): Promise<{
  rows: CsvRow[];
  parseErrors: string[];
}> {
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true, // Allow variable column counts
    });

    // Validate each row
    const validatedRows: CsvRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;
      // Skip duplicate header rows
      if (record.variable_type === 'variable_type' && record.label === 'label') {
        console.log(`[CSV Parser] Skipping duplicate header row at line ${i + 2}`);
        continue;
      }

      try {
        const validated = CsvRowSchema.parse(record);
        validatedRows.push(validated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Row ${i + 2}: ${error.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    return { rows: validatedRows, parseErrors: errors };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Processes CSV rows into categorized template configuration
 */
export function processTemplateRows(
  templateId: string,
  filename: string,
  rows: CsvRow[]
): ProcessedTemplate {
  const calculatorInputs: CalculatorInput[] = [];
  const selectInputs: SelectInput[] = [];
  const productMappings: ProductMapping[] = [];
  const featureToggles: FeatureToggle[] = [];
  const gateConfigs: GateConfig[] = [];
  const validationErrors: string[] = [];

  const parseDisplayCol = (s?: string): number | undefined => s ? (parseInt(s) || undefined) : undefined;
  const parseVisibility = (s?: string): Record<string, unknown> | null => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  };
  const parseDiscriminators = (s?: string): Record<string, string> | null => {
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const coerced: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) coerced[k] = String(v);
        return Object.keys(coerced).length > 0 ? coerced : null;
      }
      return null;
    } catch { return null; }
  };

  for (const row of rows) {
    try {
      // Calculator inputs (number fields without products)
      if (row.field_type === 'number' && !row.product_sku) {
        calculatorInputs.push({
          variableType: row.variable_type,
          label: row.label,
          min: row.min ? parseFloat(row.min) : undefined,
          max: row.max ? parseFloat(row.max) : undefined,
          step: row.step ? parseFloat(row.step) : undefined,
          defaultValue: row.default_value ? parseFloat(row.default_value) : undefined,
          displayColumn: parseDisplayCol(row.display_column),
          displayPosition: parseDisplayCol(row.display_position),
          displayColumnName: row.display_column_name || undefined,
          visibilityCondition: parseVisibility(row.visibility_condition),
        });
      }

      // Select fields (dropdown without product SKU)
      if (row.field_type === 'select' && !row.product_sku && row.options) {
        selectInputs.push({
          variableType: row.variable_type,
          label: row.label,
          options: row.options,
          defaultValue: row.default_value,
          displayColumn: parseDisplayCol(row.display_column),
          displayPosition: parseDisplayCol(row.display_position),
          displayColumnName: row.display_column_name || undefined,
          visibilityCondition: parseVisibility(row.visibility_condition),
        });
      }

      // Product mappings (product type with SKU)
      if (row.field_type === 'product' && row.product_sku && row.slot_prefix) {
        const sizeMm = row.size_mm ? parseInt(row.size_mm) : 0;
        // Strip currency symbols and whitespace before parsing price
        const cleanPrice = row.product_price ? row.product_price.replace(/[$,\s]/g, '') : '0';
        const price = parseFloat(cleanPrice);

        // Validate numeric fields
        if (isNaN(sizeMm)) {
          validationErrors.push(`Invalid size_mm for ${row.product_sku}: "${row.size_mm}"`);
        }
        if (isNaN(price)) {
          validationErrors.push(`Invalid product_price for ${row.product_sku}: "${row.product_price}"`);
        }

        productMappings.push({
          variableType: row.variable_type,
          label: row.label,
          slotPrefix: row.slot_prefix,
          sizeMm: isNaN(sizeMm) ? 0 : sizeMm,
          productSku: row.product_sku,
          productDescription: row.product_description || '',
          productPrice: isNaN(price) ? 0 : price,
          discriminatorAttributes: parseDiscriminators(row.discriminator_attributes),
        });
      }

      // Feature toggles (boolean fields)
      if (row.field_type === 'boolean') {
        const defaultValue = row.default_value?.toLowerCase() === 'true' ||
                            row.default_value?.toUpperCase() === 'ON';

        featureToggles.push({
          variableType: row.variable_type,
          label: row.label,
          defaultValue,
        });
      }

      // Gate-related number fields
      if (row.field_type === 'number' && 
          (row.variable_type.includes('Gate') || row.variable_type.includes('Hinge'))) {
        gateConfigs.push({
          variableType: row.variable_type,
          label: row.label,
          min: row.min ? parseFloat(row.min) : undefined,
          max: row.max ? parseFloat(row.max) : undefined,
          step: row.step ? parseFloat(row.step) : undefined,
          defaultValue: row.default_value ? parseFloat(row.default_value) : undefined,
        });
      }

      // Select fields (spigot colors, etc.)
      if (row.field_type === 'select' && row.product_sku) {
        // Strip currency symbols and whitespace before parsing price
        const cleanPrice = row.product_price ? row.product_price.replace(/[$,\s]/g, '') : '0';
        const price = parseFloat(cleanPrice);
        
        if (isNaN(price) && row.product_price) {
          validationErrors.push(`Invalid product_price for ${row.product_sku}: "${row.product_price}"`);
        }

        productMappings.push({
          variableType: row.variable_type,
          label: row.label,
          slotPrefix: row.slot_prefix || '',
          sizeMm: 0, // Select fields don't have size
          productSku: row.product_sku,
          productDescription: row.product_description || '',
          productPrice: isNaN(price) ? 0 : price,
          discriminatorAttributes: parseDiscriminators(row.discriminator_attributes),
        });
      }

    } catch (error) {
      validationErrors.push(`Error processing row ${row.label}: ${error}`);
    }
  }

  return {
    templateId,
    filename,
    calculatorInputs,
    selectInputs,
    productMappings,
    featureToggles,
    gateConfigs,
    validationErrors,
  };
}

/**
 * Main entry point: parse and process template CSV
 */
export async function importTemplateCSV(
  templateId: string,
  filename: string,
  csvData: string
): Promise<ProcessedTemplate> {
  // Step 1: Parse and validate CSV structure
  const { rows, parseErrors } = await parseTemplateCSV(csvData);

  // Step 2: Categorize rows into template configuration
  const processed = processTemplateRows(templateId, filename, rows);
  
  // Add parse errors to validation errors
  processed.validationErrors.push(...parseErrors);

  return processed;
}
