import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { UIFieldConfigWithRules, UIInputField } from "@shared/schema";

// Valid field names from schema
const VALID_FIELD_NAMES: UIInputField[] = [
  "section-length",
  "left-gap",
  "right-gap",
  "max-panel-width",
  "desired-gap",
  "gate-config",
  "raked-panels",
  "custom-panel",
  "glass-thickness",
  "top-rail",
  "spigot-hardware",
  "channel-hardware",
  "panel-height",
  "finish",
  "layout-mode",
  "hinge-panel-width",
  "gate-panel-width",
  "post-type",
  "gate-width-mm",
  "hinge-panel-width-mm",
];

interface FieldConfigEditorProps {
  fields: UIFieldConfigWithRules[];
  onChange: (fields: UIFieldConfigWithRules[]) => void;
  variantLabel: string;
}

export function FieldConfigEditor({ fields, onChange, variantLabel }: FieldConfigEditorProps) {
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set([0]));
  const [editingField, setEditingField] = useState<number | null>(null);

  const toggleField = (index: number) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFields(newExpanded);
  };

  const addField = () => {
    const newField: UIFieldConfigWithRules = {
      field: "section-length", // Default to first valid field
      enabled: true,
      position: fields.length,
      label: "Section Length",
      type: "number",
    };
    onChange([...fields, newField]);
    setExpandedFields(new Set([...Array.from(expandedFields), fields.length]));
    setEditingField(fields.length);
  };

  const updateField = (index: number, updates: Partial<UIFieldConfigWithRules>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const deleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    // Reorder positions
    newFields.forEach((field, i) => {
      field.position = i;
    });
    onChange(newFields);
    setExpandedFields(new Set(Array.from(expandedFields).filter(i => i < index)));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;
    
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    
    // Update positions
    newFields.forEach((field, i) => {
      field.position = i;
    });
    
    onChange(newFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Field Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure UI fields for {variantLabel}
          </p>
        </div>
        <Button onClick={addField} size="sm" data-testid="add-field">
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No fields configured. Click "Add Field" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...fields]
            .sort((a, b) => a.position - b.position)
            .map((field, index) => (
              <Card key={`${field.field}-${field.position}`} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveField(index, "up")}
                        disabled={index === 0}
                        data-testid={`move-up-${index}`}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveField(index, "down")}
                        disabled={index === fields.length - 1}
                        data-testid={`move-down-${index}`}
                      >
                        ↓
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleField(index)}
                      data-testid={`toggle-field-${index}`}
                    >
                      {expandedFields.has(index) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{field.label || field.field}</CardTitle>
                        <Badge variant={field.enabled ? "default" : "secondary"} className="text-xs">
                          {field.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {field.type || "standard"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Field: {field.field} • Position: {field.position}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteField(index)}
                      data-testid={`delete-field-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>

                {expandedFields.has(index) && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`field-name-${index}`}>Field Name *</Label>
                        <Select
                          value={field.field}
                          onValueChange={(value: UIInputField) => updateField(index, { field: value })}
                        >
                          <SelectTrigger id={`field-name-${index}`} data-testid={`select-field-name-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALID_FIELD_NAMES.map((fieldName) => (
                              <SelectItem key={fieldName} value={fieldName}>
                                {fieldName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`field-label-${index}`}>Display Label</Label>
                        <Input
                          id={`field-label-${index}`}
                          value={field.label || ""}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="e.g., Glass Thickness"
                          data-testid={`input-field-label-${index}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`field-type-${index}`}>Field Type</Label>
                        <Select
                          value={field.type || "standard"}
                          onValueChange={(value: "standard" | "number") => updateField(index, { type: value })}
                        >
                          <SelectTrigger id={`field-type-${index}`} data-testid={`select-field-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard (dropdown/toggle)</SelectItem>
                            <SelectItem value="number">Numeric (with min/max)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-8">
                        <Switch
                          id={`field-enabled-${index}`}
                          checked={field.enabled}
                          onCheckedChange={(checked) => updateField(index, { enabled: checked })}
                          data-testid={`switch-enabled-${index}`}
                        />
                        <Label htmlFor={`field-enabled-${index}`}>Enabled</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`field-tooltip-${index}`}>Tooltip / Help Text</Label>
                      <Textarea
                        id={`field-tooltip-${index}`}
                        value={field.tooltip || ""}
                        onChange={(e) => updateField(index, { tooltip: e.target.value })}
                        placeholder="Helpful information for users"
                        rows={2}
                        data-testid={`input-tooltip-${index}`}
                      />
                    </div>

                    <Separator />

                    {field.type === "number" ? (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Numeric Field Settings</h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`field-min-${index}`}>Min</Label>
                            <Input
                              id={`field-min-${index}`}
                              type="number"
                              value={field.min ?? ""}
                              onChange={(e) => updateField(index, { min: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="250"
                              data-testid={`input-min-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`field-max-${index}`}>Max</Label>
                            <Input
                              id={`field-max-${index}`}
                              type="number"
                              value={field.max ?? ""}
                              onChange={(e) => updateField(index, { max: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="2000"
                              data-testid={`input-max-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`field-step-${index}`}>Step</Label>
                            <Input
                              id={`field-step-${index}`}
                              type="number"
                              value={field.step ?? ""}
                              onChange={(e) => updateField(index, { step: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="50"
                              data-testid={`input-step-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`field-default-${index}`}>Default</Label>
                            <Input
                              id={`field-default-${index}`}
                              type="number"
                              value={field.default ?? ""}
                              onChange={(e) => updateField(index, { default: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="1200"
                              data-testid={`input-default-${index}`}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`field-unit-${index}`}>Unit</Label>
                            <Input
                              id={`field-unit-${index}`}
                              value={field.unit || "mm"}
                              onChange={(e) => updateField(index, { unit: e.target.value as "mm" })}
                              placeholder="mm"
                              data-testid={`input-unit-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`field-tolerance-${index}`}>Tolerance</Label>
                            <Input
                              id={`field-tolerance-${index}`}
                              type="number"
                              value={field.tolerance ?? ""}
                              onChange={(e) => updateField(index, { tolerance: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="10"
                              data-testid={`input-tolerance-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`field-context-${index}`}>Context</Label>
                            <Select
                              value={field.context || ""}
                              onValueChange={(value: "gate" | "hinge" | "") => updateField(index, { context: value || undefined })}
                            >
                              <SelectTrigger id={`field-context-${index}`} data-testid={`select-context-${index}`}>
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                <SelectItem value="gate">Gate</SelectItem>
                                <SelectItem value="hinge">Hinge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Standard Field Settings</h4>
                        <div className="space-y-2">
                          <Label htmlFor={`field-options-${index}`}>Options (comma-separated)</Label>
                          <Input
                            id={`field-options-${index}`}
                            value={field.options?.join(", ") || ""}
                            onChange={(e) => 
                              updateField(index, { 
                                options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) 
                              })
                            }
                            placeholder="e.g., 12mm, 15mm"
                            data-testid={`input-options-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`field-default-value-${index}`}>Default Value</Label>
                          <Input
                            id={`field-default-value-${index}`}
                            value={field.defaultValue || ""}
                            onChange={(e) => updateField(index, { defaultValue: e.target.value })}
                            placeholder="e.g., 12mm"
                            data-testid={`input-default-value-${index}`}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
