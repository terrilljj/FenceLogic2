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
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

// Categorized template data
export interface ProcessedTemplate {
  templateId: string;
  filename: string;
  calculatorInputs: CalculatorInput[];
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
}

export interface ProductMapping {
  variableType: string;
  label: string;
  slotPrefix: string;
  sizeMm: number;
  productSku: string;
  productDescription: string;
  productPrice: number;
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
 */
export async function parseTemplateCSV(csvData: string): Promise<CsvRow[]> {
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
      try {
        const validated = CsvRowSchema.parse(records[i]);
        validatedRows.push(validated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Row ${i + 2}: ${error.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`CSV validation errors:\n${errors.join('\n')}`);
    }

    return validatedRows;
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
  const productMappings: ProductMapping[] = [];
  const featureToggles: FeatureToggle[] = [];
  const gateConfigs: GateConfig[] = [];
  const validationErrors: string[] = [];

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
        });
      }

      // Product mappings (product type with SKU)
      if (row.field_type === 'product' && row.product_sku && row.slot_prefix) {
        const sizeMm = row.size_mm ? parseInt(row.size_mm) : 0;
        const price = row.product_price ? parseFloat(row.product_price) : 0;

        productMappings.push({
          variableType: row.variable_type,
          label: row.label,
          slotPrefix: row.slot_prefix,
          sizeMm,
          productSku: row.product_sku,
          productDescription: row.product_description || '',
          productPrice: price,
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
        productMappings.push({
          variableType: row.variable_type,
          label: row.label,
          slotPrefix: row.slot_prefix || '',
          sizeMm: 0, // Select fields don't have size
          productSku: row.product_sku,
          productDescription: row.product_description || '',
          productPrice: row.product_price ? parseFloat(row.product_price) : 0,
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
  const rows = await parseTemplateCSV(csvData);

  // Step 2: Categorize rows into template configuration
  const processed = processTemplateRows(templateId, filename, rows);

  return processed;
}
