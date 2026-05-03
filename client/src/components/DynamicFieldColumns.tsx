import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { SpanConfig } from "@shared/schema";

export interface FieldConfig {
  type: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number | string;
  unit?: string;
  options?: string[] | Array<{ value: string; label: string }>;
  tooltip?: string;
  section?: string;
  displayColumn?: number;
  displayPosition?: number;
  displayColumnName?: string;
  visibilityCondition?: { fieldKey: string; value: any } | null;
}

interface Props {
  fields: Record<string, FieldConfig>;
  span: SpanConfig;
  updateSpan: (changes: Partial<SpanConfig>) => void;
}

// Resolve current value for a field: check fieldValues first, then legacy specific span keys.
const LEGACY_MAP: Record<string, keyof SpanConfig> = {
  "max-panel-width": "maxPanelWidth",
  "spigot-mounting": "spigotMounting",
  "spigot-color": "spigotColor",
  "desired-gap": "desiredGap",
};

function getFieldValue(fieldKey: string, span: SpanConfig): any {
  const fv = (span.fieldValues as Record<string, any> | undefined);
  if (fv && fv[fieldKey] !== undefined) return fv[fieldKey];
  const legacyKey = LEGACY_MAP[fieldKey];
  if (legacyKey) return span[legacyKey];
  return undefined;
}

function setFieldValue(fieldKey: string, value: any, span: SpanConfig, updateSpan: (c: Partial<SpanConfig>) => void) {
  const updates: Partial<SpanConfig> = {
    fieldValues: { ...(span.fieldValues || {}), [fieldKey]: value },
  };
  // Mirror into legacy field if applicable — keeps BOM calculator working
  const legacyKey = LEGACY_MAP[fieldKey];
  if (legacyKey) (updates as any)[legacyKey] = value;
  updateSpan(updates);
}

function isVisible(field: FieldConfig, span: SpanConfig): boolean {
  if (!field.visibilityCondition) return true;
  const { fieldKey, value } = field.visibilityCondition;
  const current = getFieldValue(fieldKey, span);
  // Truthy check when value is true/false; strict equality otherwise
  if (value === true || value === "true") return !!current;
  if (value === false || value === "false") return !current;
  return current === value;
}

function parseOptions(options: FieldConfig["options"]): Array<{ value: string; label: string }> {
  if (!options || options.length === 0) return [];
  if (typeof options[0] === "string") {
    return (options as string[]).map(o => {
      // Handle "value | label" format from template CSV
      const parts = o.split("|").map(p => p.trim());
      return { value: parts[0], label: parts[1] || parts[0] };
    });
  }
  return options as Array<{ value: string; label: string }>;
}

function FieldRenderer({ fieldKey, field, span, updateSpan }: {
  fieldKey: string;
  field: FieldConfig;
  span: SpanConfig;
  updateSpan: (c: Partial<SpanConfig>) => void;
}) {
  const value = getFieldValue(fieldKey, span);
  const set = (v: any) => setFieldValue(fieldKey, v, span, updateSpan);
  const defaultVal = field.defaultValue;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={value ?? defaultVal === "true"}
          onCheckedChange={set}
          id={`field-${fieldKey}`}
        />
        <Label htmlFor={`field-${fieldKey}`} className="text-xs text-muted-foreground cursor-pointer">
          {field.label}
        </Label>
      </div>
    );
  }

  if (field.type === "select" || (field.type === "number" && field.options && field.options.length > 0)) {
    const opts = parseOptions(field.options);
    const currentValue = value !== undefined ? String(value) : (defaultVal !== undefined ? String(defaultVal) : "");
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Select value={currentValue} onValueChange={set}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const step = field.step ?? 1;
    const current = value !== undefined ? Number(value) : (defaultVal !== undefined ? Number(defaultVal) : min);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
          <span className="text-xs font-mono">{current}{field.unit ? ` ${field.unit}` : ""}</span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[current]}
          onValueChange={([v]) => set(v)}
          className="h-6"
        />
      </div>
    );
  }

  return null;
}

export default function DynamicFieldColumns({ fields, span, updateSpan }: Props) {
  // Collect only fields that have displayColumn set
  const columnedFields = Object.entries(fields)
    .filter(([, f]) => f.displayColumn != null)
    .sort(([, a], [, b]) => {
      const colDiff = (a.displayColumn ?? 0) - (b.displayColumn ?? 0);
      if (colDiff !== 0) return colDiff;
      return (a.displayPosition ?? 0) - (b.displayPosition ?? 0);
    });

  if (columnedFields.length === 0) return null;

  // Group by column
  const columns = new Map<number, Array<[string, FieldConfig]>>();
  for (const entry of columnedFields) {
    const col = entry[1].displayColumn!;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(entry);
  }

  const sortedColumns = Array.from(columns.entries()).sort(([a], [b]) => a - b);

  const colCount = sortedColumns.length;

  return (
    <div
      className={`hidden lg:grid divide-x divide-card-border border border-card-border rounded-md`}
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {sortedColumns.map(([colNum, colFields]) => {
        const colName = colFields.find(([, f]) => f.displayColumnName)?.[1]?.displayColumnName
          ?? `Column ${colNum}`;
        return (
          <div key={colNum} className="p-3 space-y-3">
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {colName}
            </h5>
            {colFields.map(([key, field]) =>
              isVisible(field, span) ? (
                <FieldRenderer
                  key={key}
                  fieldKey={key}
                  field={field}
                  span={span}
                  updateSpan={updateSpan}
                />
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}
