import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { ProductVariant, UIFieldConfig, UIInputField } from "@shared/schema";

const PRODUCT_VARIANTS: { variant: ProductVariant; label: string; group: string }[] = [
  { variant: "glass-pool-spigots", label: "Glass Pool - Spigots", group: "Glass Pool Fencing" },
  { variant: "glass-pool-channel", label: "Glass Pool - Channel", group: "Glass Pool Fencing" },
  { variant: "glass-bal-spigots", label: "Glass Balustrade - Spigots", group: "Glass Balustrade" },
  { variant: "glass-bal-channel", label: "Glass Balustrade - Channel", group: "Glass Balustrade" },
  { variant: "glass-bal-standoffs", label: "Glass Balustrade - Standoffs", group: "Glass Balustrade" },
  { variant: "alu-pool-barr", label: "Aluminium Pool - BARR", group: "Aluminium Pool Fencing" },
  { variant: "alu-pool-blade", label: "Aluminium Pool - Blade", group: "Aluminium Pool Fencing" },
  { variant: "alu-pool-tubular", label: "Aluminium Pool - Tubular Flat Top", group: "Aluminium Pool Fencing" },
  { variant: "pvc-hamptons-full-privacy", label: "Hamptons PVC - Full Privacy", group: "Hamptons PVC" },
  { variant: "pvc-hamptons-combo", label: "Hamptons PVC - Combo", group: "Hamptons PVC" },
  { variant: "pvc-hamptons-vertical-paling", label: "Hamptons PVC - Vertical Paling", group: "Hamptons PVC" },
  { variant: "pvc-hamptons-semi-privacy", label: "Hamptons PVC - Semi Privacy", group: "Hamptons PVC" },
  { variant: "pvc-hamptons-3rail", label: "Hamptons PVC - 3 Rail", group: "Hamptons PVC" },
];

const AVAILABLE_FIELDS: { field: UIInputField; label: string; defaultTooltip: string }[] = [
  { field: "section-length", label: "Section Length", defaultTooltip: "Enter the total length of this fence section" },
  { field: "left-gap", label: "Left Gap", defaultTooltip: "Configure the gap on the left side of the section" },
  { field: "right-gap", label: "Right Gap", defaultTooltip: "Configure the gap on the right side of the section" },
  { field: "max-panel-width", label: "Max Panel Width", defaultTooltip: "Set the maximum width for panels" },
  { field: "desired-gap", label: "Desired Gap Between Panels", defaultTooltip: "Set the target gap spacing between panels" },
  { field: "gate-config", label: "Gate Configuration", defaultTooltip: "Add and configure gate panels" },
  { field: "raked-panels", label: "Raked Panels", defaultTooltip: "Configure raked panels for step ups and height changes" },
  { field: "custom-panel", label: "Custom Panel", defaultTooltip: "Add a custom-sized panel with specific dimensions" },
  { field: "glass-thickness", label: "Glass Thickness", defaultTooltip: "Select glass thickness (12mm or 15mm)" },
  { field: "top-rail", label: "Top Mounted Rail", defaultTooltip: "Add a top-mounted handrail to balustrade" },
  { field: "spigot-hardware", label: "Spigot Hardware", defaultTooltip: "Configure spigot mounting and finish" },
  { field: "channel-hardware", label: "Channel Hardware", defaultTooltip: "Configure channel mounting system" },
  { field: "panel-height", label: "Panel Height", defaultTooltip: "Select panel height option" },
  { field: "finish", label: "Finish", defaultTooltip: "Select color/finish option" },
  { field: "layout-mode", label: "Layout Mode", defaultTooltip: "Choose panel layout mode (Full Panels + Cut End or Equally Spaced)" },
  { field: "post-type", label: "Post Type", defaultTooltip: "Select post type (Welded Base Plate or Standard)" },
];

export default function UIConfigPage() {
  const { toast } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>("glass-pool-spigots");
  const [fieldConfigs, setFieldConfigs] = useState<UIFieldConfig[]>([]);

  const { data: configs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/ui-configs"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { productVariant: string; fieldConfigs: UIFieldConfig[] }) => {
      return await apiRequest("POST", "/api/admin/ui-configs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-configs"] });
      toast({
        title: "Configuration Saved",
        description: "UI configuration has been saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Load config when variant changes
  useEffect(() => {
    if (configs) {
      const config = configs.find((c: any) => c.productVariant === selectedVariant);
      if (config) {
        setFieldConfigs(config.fieldConfigs);
      } else {
        // Initialize with default fields
        setFieldConfigs(AVAILABLE_FIELDS.map((field, index) => ({
          field: field.field,
          enabled: field.field === "section-length", // Section length enabled by default
          position: index,
          label: field.label,
          tooltip: field.defaultTooltip,
        })));
      }
    }
  }, [selectedVariant, configs]);

  const handleToggleField = (field: UIInputField, enabled: boolean) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, enabled } : fc)
    );
  };

  const handlePositionChange = (field: UIInputField, position: number) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, position } : fc)
    );
  };

  const handleLabelChange = (field: UIInputField, label: string) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, label } : fc)
    );
  };

  const handleTooltipChange = (field: UIInputField, tooltip: string) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, tooltip } : fc)
    );
  };

  const handleSave = () => {
    saveMutation.mutate({
      productVariant: selectedVariant,
      fieldConfigs,
    });
  };

  const groupedVariants = PRODUCT_VARIANTS.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof PRODUCT_VARIANTS>);

  const sortedFields = [...fieldConfigs].sort((a, b) => a.position - b.position);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/products">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">UI Configuration Manager</h1>
            <p className="text-muted-foreground">Configure input fields and controls for each product variant</p>
          </div>
        </div>

        <Tabs value={selectedVariant} onValueChange={(v) => setSelectedVariant(v as ProductVariant)}>
          <TabsList className="mb-6">
            {Object.keys(groupedVariants).map(group => (
              <div key={group} className="flex flex-col">
                <div className="text-xs text-muted-foreground px-2 py-1">{group}</div>
                <div className="flex gap-1">
                  {groupedVariants[group].map(item => (
                    <TabsTrigger key={item.variant} value={item.variant} className="text-xs">
                      {item.label.split(' - ')[1] || item.label}
                    </TabsTrigger>
                  ))}
                </div>
              </div>
            ))}
          </TabsList>

          {PRODUCT_VARIANTS.map(({ variant, label }) => (
            <TabsContent key={variant} value={variant}>
              <Card>
                <CardHeader>
                  <CardTitle>{label} - Input Configuration</CardTitle>
                  <CardDescription>
                    Configure which input fields are visible and their display order
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {sortedFields.map((fc) => {
                      const fieldMeta = AVAILABLE_FIELDS.find(f => f.field === fc.field);
                      if (!fieldMeta) return null;

                      return (
                        <Card key={fc.field} className="p-4">
                          <div className="grid grid-cols-12 gap-4 items-start">
                            <div className="col-span-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">{fieldMeta.label}</Label>
                                <Switch
                                  checked={fc.enabled}
                                  onCheckedChange={(enabled) => handleToggleField(fc.field, enabled)}
                                  data-testid={`switch-${fc.field}`}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">Field: {fc.field}</p>
                            </div>

                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Position</Label>
                              <Select
                                value={fc.position.toString()}
                                onValueChange={(v) => handlePositionChange(fc.field, parseInt(v))}
                                disabled={!fc.enabled}
                              >
                                <SelectTrigger data-testid={`select-position-${fc.field}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: sortedFields.length }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Custom Label</Label>
                              <Input
                                value={fc.label || fieldMeta.label}
                                onChange={(e) => handleLabelChange(fc.field, e.target.value)}
                                disabled={!fc.enabled}
                                placeholder={fieldMeta.label}
                                data-testid={`input-label-${fc.field}`}
                              />
                            </div>

                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">Tooltip Text</Label>
                              <Input
                                value={fc.tooltip || fieldMeta.defaultTooltip}
                                onChange={(e) => handleTooltipChange(fc.field, e.target.value)}
                                disabled={!fc.enabled}
                                placeholder={fieldMeta.defaultTooltip}
                                data-testid={`input-tooltip-${fc.field}`}
                              />
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={handleSave} 
                      disabled={saveMutation.isPending}
                      data-testid="button-save-config"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveMutation.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
