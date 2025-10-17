import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import type { ProductVariant, UIFieldConfig, UIInputField, ProductCategory, ProductSubcategory, Category, Subcategory } from "@shared/schema";
import { fetchCoverage, type CoverageResponse } from "@/lib/adminCoverage";
import { PathMultiSelect } from "@/components/PathMultiSelect";

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
  { variant: "custom-panel-designer", label: "Custom Panel Designer (BETA)", group: "Advanced Options" },
  { variant: "custom-glass", label: "Custom Glass", group: "Glass Pool Fencing" },
  { variant: "custom-frameless", label: "Custom Frameless", group: "Custom" },
];

type FieldType = "numeric" | "slider" | "dropdown" | "toggle";

const AVAILABLE_FIELDS: { 
  field: UIInputField; 
  label: string; 
  defaultTooltip: string;
  type: FieldType;
  defaultConfig?: {
    defaultValue?: any;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}[] = [
  { field: "section-length", label: "Section Length", defaultTooltip: "Enter the total length of this fence section", type: "numeric", defaultConfig: { defaultValue: 3000, min: 0, max: 50000, step: 100 } },
  { field: "left-gap", label: "Left Gap", defaultTooltip: "Configure the gap on the left side of the section", type: "slider", defaultConfig: { defaultValue: 25, min: 0, max: 150 } },
  { field: "right-gap", label: "Right Gap", defaultTooltip: "Configure the gap on the right side of the section", type: "slider", defaultConfig: { defaultValue: 25, min: 0, max: 150 } },
  { field: "max-panel-width", label: "Max Panel Width", defaultTooltip: "Set the maximum width for panels", type: "dropdown", defaultConfig: { defaultValue: "1200", options: Array.from({ length: 37 }, (_, i) => (200 + i * 50).toString()) } },
  { field: "desired-gap", label: "Desired Gap Between Panels", defaultTooltip: "Set the target gap spacing between panels", type: "slider", defaultConfig: { defaultValue: 10, min: 6, max: 30 } },
  { field: "gate-config", label: "Gate Configuration", defaultTooltip: "Add and configure gate panels", type: "toggle" },
  { field: "raked-panels", label: "Raked Panels", defaultTooltip: "Configure raked panels for step ups and height changes", type: "toggle" },
  { field: "custom-panel", label: "Custom Panel", defaultTooltip: "Add a custom-sized panel with specific dimensions", type: "toggle" },
  { field: "glass-thickness", label: "Glass Thickness", defaultTooltip: "Select glass thickness (12mm or 15mm)", type: "dropdown", defaultConfig: { defaultValue: "12mm", options: ["12mm", "15mm"] } },
  { field: "top-rail", label: "Top Mounted Rail", defaultTooltip: "Add a top-mounted handrail to balustrade", type: "toggle" },
  { field: "spigot-hardware", label: "Spigot Hardware", defaultTooltip: "Configure spigot mounting and finish", type: "toggle" },
  { field: "channel-hardware", label: "Channel Hardware", defaultTooltip: "Configure channel mounting system", type: "toggle" },
  { field: "panel-height", label: "Panel Height", defaultTooltip: "Select panel height option", type: "dropdown", defaultConfig: { defaultValue: "1200mm", options: ["900mm", "1000mm", "1200mm", "1800mm"] } },
  { field: "finish", label: "Finish", defaultTooltip: "Select color/finish option", type: "dropdown", defaultConfig: { defaultValue: "satin-black", options: ["satin-black", "pearl-white", "black", "white", "monument-grey"] } },
  { field: "layout-mode", label: "Layout Mode", defaultTooltip: "Choose panel layout mode (Full Panels + Cut End or Equally Spaced)", type: "dropdown", defaultConfig: { defaultValue: "full-panels-cut-end", options: ["full-panels-cut-end", "equally-spaced"] } },
  { field: "post-type", label: "Post Type", defaultTooltip: "Select post type (Welded Base Plate or Standard)", type: "dropdown", defaultConfig: { defaultValue: "welded-base-plate", options: ["welded-base-plate", "standard"] } },
];

// Field mapping per product variant (using actual ProductVariant keys)
const VARIANT_FIELDS: Record<ProductVariant, UIInputField[]> = {
  // Glass Pool Fencing
  "glass-pool-spigots": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "gate-config", "raked-panels", "custom-panel", "glass-thickness", "spigot-hardware"],
  "glass-pool-channel": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "gate-config", "raked-panels", "custom-panel", "glass-thickness", "channel-hardware"],
  
  // Glass Balustrade
  "glass-bal-spigots": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "gate-config", "custom-panel", "glass-thickness", "top-rail", "spigot-hardware"],
  "glass-bal-channel": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "gate-config", "custom-panel", "glass-thickness", "top-rail", "channel-hardware"],
  "glass-bal-standoffs": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "gate-config", "custom-panel", "glass-thickness"],
  
  // Aluminium Pool Fencing
  "alu-pool-tubular": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "alu-pool-barr": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "alu-pool-blade": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "alu-pool-pik": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  
  // Aluminium Balustrade
  "alu-bal-barr": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "alu-bal-blade": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "alu-bal-visor": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  
  // Hamptons PVC Fencing
  "pvc-hamptons-full-privacy": ["section-length", "left-gap", "right-gap", "finish", "gate-config"],
  "pvc-hamptons-combo": ["section-length", "left-gap", "right-gap", "finish", "gate-config"],
  "pvc-hamptons-vertical-paling": ["section-length", "left-gap", "right-gap", "finish", "gate-config"],
  "pvc-hamptons-semi-privacy": ["section-length", "left-gap", "right-gap", "finish", "gate-config"],
  "pvc-hamptons-3rail": ["section-length", "left-gap", "right-gap", "finish", "gate-config"],
  
  // General Fencing
  "general-zeus": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "general-blade": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  "general-barr": ["section-length", "left-gap", "right-gap", "panel-height", "finish", "layout-mode", "post-type", "gate-config"],
  
  // Custom Panel Designer (Advanced)
  "custom-panel-designer": ["section-length", "left-gap", "right-gap", "max-panel-width", "desired-gap", "custom-panel", "glass-thickness"],
  
  // Custom Glass (All panels individually sized)
  "custom-glass": ["section-length", "left-gap", "right-gap", "glass-thickness"],
  
  // Custom Frameless (Auto-calc panels with exact gaps)
  "custom-frameless": ["section-length", "left-gap", "right-gap", "max-panel-width", "glass-thickness"],
};

// Type guard for numeric fields
function isNumericField(config: UIFieldConfig): boolean {
  return config.type === "number";
}

export default function UIConfigPage() {
  const { toast } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>("glass-pool-spigots");
  const [fieldConfigs, setFieldConfigs] = useState<UIFieldConfig[]>([]);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [allowedSubcategories, setAllowedSubcategories] = useState<string[]>([]);
  
  // Coverage state
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [pathCountByPath, setPathCountByPath] = useState<Record<string, number>>({});
  const [subCountByName, setSubCountByName] = useState<Record<string, number>>({});
  
  // Available categoryPaths from catalog
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);

  const { data: configs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/ui-configs"],
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/admin/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/admin/subcategories"],
  });

  // Fetch available category paths from catalog
  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const response = await fetch("/api/meta/category-paths");
        const data = await response.json();
        setAvailablePaths(data.paths || []);
      } catch (error) {
        console.error("Failed to fetch category paths:", error);
      }
    };
    fetchPaths();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: { productVariant: string; fieldConfigs: UIFieldConfig[]; allowedCategories: string[]; allowedSubcategories: string[] }) => {
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
      const relevantFields = VARIANT_FIELDS[selectedVariant];
      
      // Load allowed categories and subcategories
      setAllowedCategories(config?.allowedCategories || []);
      setAllowedSubcategories(config?.allowedSubcategories || []);
      
      // Safety fallback: if no mapping exists, use all available fields
      if (!relevantFields || relevantFields.length === 0) {
        console.warn(`No field mapping found for variant: ${selectedVariant}`);
        setFieldConfigs(AVAILABLE_FIELDS.map((field, index) => ({
          field: field.field,
          enabled: field.field === "section-length",
          position: index,
          label: field.label,
          tooltip: field.defaultTooltip,
          ...field.defaultConfig,
        })));
        return;
      }
      
      // Always initialize with ALL relevant fields for this variant
      const relevantFieldConfigs = AVAILABLE_FIELDS
        .filter(field => relevantFields.includes(field.field))
        .map((field, index) => {
          // Check if this field exists in saved config
          // Backend sends fieldConfigs as object, need to look it up by key
          const savedBackendConfig = config?.fieldConfigs?.[field.field];
          
          if (savedBackendConfig) {
            // Transform from backend format to frontend format
            const transformedConfig: any = {
              field: field.field,
              enabled: true,
              position: index,
              label: savedBackendConfig.label || field.label,
              tooltip: savedBackendConfig.tooltip || field.defaultTooltip,
            };
            
            // Handle dropdown fields with mapping
            if (savedBackendConfig.type === "dropdown" && savedBackendConfig.mapping) {
              transformedConfig.options = savedBackendConfig.options || [];
              transformedConfig.optionPaths = {};
              transformedConfig.optionSubcategories = {};
              transformedConfig.optionCodes = {};
              
              // Transform mapping structure to separated fields
              Object.keys(savedBackendConfig.mapping).forEach(option => {
                const mapping = savedBackendConfig.mapping[option];
                transformedConfig.optionPaths[option] = mapping.categoryPaths || [];
                transformedConfig.optionSubcategories[option] = mapping.subcategories || [];
                transformedConfig.optionCodes[option] = mapping.codes || [];
              });
            }
            
            // Handle toggle fields with mapping
            if (savedBackendConfig.type === "toggle" && savedBackendConfig.mapping?.on) {
              transformedConfig.categoryPaths = savedBackendConfig.mapping.on.categoryPaths || [];
              transformedConfig.subcategories = savedBackendConfig.mapping.on.subcategories || [];
              transformedConfig.codes = savedBackendConfig.mapping.on.codes || [];
            }
            
            return transformedConfig;
          } else {
            // Use default configuration
            return {
              field: field.field,
              enabled: field.field === "section-length", // Section length enabled by default
              position: index,
              label: field.label,
              tooltip: field.defaultTooltip,
              ...field.defaultConfig, // Include default value, min, max, step, options
            };
          }
        });
      
      setFieldConfigs(relevantFieldConfigs);
    }
  }, [selectedVariant, configs]);

  // Fetch coverage when variant or fieldConfigs change (debounced ~300ms)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const coverageData = await fetchCoverage(selectedVariant);
        setCoverage(coverageData);
      } catch (error) {
        console.error("Failed to fetch coverage:", error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedVariant, fieldConfigs, allowedSubcategories]);

  // Update lookup maps when coverage data arrives
  useEffect(() => {
    if (coverage) {
      // Build path count lookup
      const pathMap: Record<string, number> = {};
      coverage.pathCounts.forEach(({ path, count }) => {
        pathMap[path] = count;
      });
      setPathCountByPath(pathMap);

      // Build subcategory count lookup
      const subMap: Record<string, number> = {};
      coverage.subcategoryCounts.forEach(({ subcategory, count }) => {
        subMap[subcategory] = count;
      });
      setSubCountByName(subMap);

      // Show toast if any zero-count exists
      const hasZeroCounts = coverage.deadPaths.length > 0 || coverage.deadSubcategories.length > 0;
      if (hasZeroCounts) {
        toast({
          title: "Warning",
          description: "Some mappings have zero matching products. Consider fixing them.",
          variant: "destructive",
        });
      }
    }
  }, [coverage, toast]);

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

  const handleDefaultValueChange = (field: UIInputField, defaultValue: any) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, defaultValue } : fc)
    );
  };

  const handleMinChange = (field: UIInputField, min: number) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, min } : fc)
    );
  };

  const handleMaxChange = (field: UIInputField, max: number) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, max } : fc)
    );
  };

  const handleStepChange = (field: UIInputField, step: number) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, step } : fc)
    );
  };

  const handleOptionsChange = (field: UIInputField, options: string[]) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, options } : fc)
    );
  };

  const handleOptionPathsChange = (field: UIInputField, option: string, paths: string[]) => {
    setFieldConfigs(prev => 
      prev.map(fc => {
        if (fc.field === field) {
          const optionPaths = { ...(fc.optionPaths || {}), [option]: paths };
          return { ...fc, optionPaths };
        }
        return fc;
      })
    );
  };

  const handleProductsChange = (field: UIInputField, productCodes: string[]) => {
    setFieldConfigs(prev => 
      prev.map(fc => fc.field === field ? { ...fc, products: productCodes } : fc)
    );
  };

  const handleSave = () => {
    // Transform field configs to match backend schema (mapping structure)
    const transformedFieldConfigs: Record<string, any> = {};
    
    fieldConfigs.forEach(fc => {
      const fieldMeta = AVAILABLE_FIELDS.find(f => f.field === fc.field);
      if (!fieldMeta) return;
      
      if (fieldMeta.type === "dropdown" && fc.options) {
        // Build mapping object for dropdown fields
        const mapping: Record<string, any> = {};
        fc.options.forEach(option => {
          mapping[option] = {
            categoryPaths: fc.optionPaths?.[option] || [],
            subcategories: (fc as any).optionSubcategories?.[option] || [],
            codes: (fc as any).optionCodes?.[option] || [],
          };
        });
        
        transformedFieldConfigs[fc.field] = {
          type: "dropdown",
          label: fc.label || fieldMeta.label,
          options: fc.options,
          mapping,
        };
      } else if (fieldMeta.type === "toggle") {
        // Build mapping object for toggle fields
        transformedFieldConfigs[fc.field] = {
          type: "toggle",
          label: fc.label || fieldMeta.label,
          mapping: {
            on: {
              categoryPaths: fc.categoryPaths || [],
              subcategories: (fc as any).subcategories || [],
              codes: (fc as any).codes || [],
            },
          },
        };
      }
    });
    
    saveMutation.mutate({
      productVariant: selectedVariant,
      fieldConfigs: transformedFieldConfigs,
      allowedCategories,
      allowedSubcategories,
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
                <CardContent className="space-y-6">
                  {/* Product Categories and Subcategories Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Product Groups</Label>
                      <p className="text-sm text-muted-foreground">Select which product categories and subcategories apply to this variant</p>
                    </div>
                    
                    {/* Categories Table */}
                    <div className="border rounded-md">
                      <div className="p-3 bg-muted border-b">
                        <h3 className="font-medium text-sm">Categories</h3>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {categories.map((category) => (
                            <div key={category.id} className="flex items-center space-x-2">
                              <Checkbox
                                checked={allowedCategories.includes(category.name)}
                                onCheckedChange={(checked) => {
                                  setAllowedCategories(prev => 
                                    checked 
                                      ? [...prev, category.name]
                                      : prev.filter(c => c !== category.name)
                                  );
                                }}
                                data-testid={`checkbox-category-${category.name}`}
                              />
                              <label className="text-sm cursor-pointer">
                                {category.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Subcategories Table */}
                    <div className="border rounded-md">
                      <div className="p-3 bg-muted border-b">
                        <h3 className="font-medium text-sm">Subcategories</h3>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {subcategories.map((subcategory) => {
                            const count = subCountByName[subcategory.name] ?? 0;
                            return (
                              <div key={subcategory.id} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={allowedSubcategories.includes(subcategory.name)}
                                  onCheckedChange={(checked) => {
                                    setAllowedSubcategories(prev => 
                                      checked 
                                        ? [...prev, subcategory.name]
                                        : prev.filter(s => s !== subcategory.name)
                                    );
                                  }}
                                  data-testid={`checkbox-subcategory-${subcategory.name}`}
                                />
                                <label className="text-sm cursor-pointer flex-1">
                                  {subcategory.name}
                                </label>
                                <Badge
                                  variant={count > 0 ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {count}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className="pt-4 border-t">
                    <Label className="text-base font-semibold mb-4 block">Input Field Configuration</Label>
                    <div className="grid grid-cols-12 gap-3 px-3 pb-2 border-b text-xs font-medium text-muted-foreground">
                      <div className="col-span-2">Field</div>
                      <div className="col-span-1">Pos</div>
                      <div className="col-span-2">Label</div>
                      <div className="col-span-7">Value Configuration</div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {sortedFields.map((fc) => {
                      const fieldMeta = AVAILABLE_FIELDS.find(f => f.field === fc.field);
                      if (!fieldMeta) return null;

                      return (
                        <div key={fc.field} className="border rounded-md p-3 bg-card">
                          <div className="grid grid-cols-12 gap-3 items-center">
                            {/* Field name and toggle */}
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={fc.enabled}
                                  onCheckedChange={(enabled) => handleToggleField(fc.field, enabled)}
                                  data-testid={`switch-${fc.field}`}
                                />
                                <div>
                                  <div className="text-sm font-medium">{fieldMeta.label}</div>
                                  <div className="text-xs text-muted-foreground">{fieldMeta.type}</div>
                                </div>
                              </div>
                            </div>

                            {/* Position */}
                            <div className="col-span-1">
                              <Select
                                value={fc.position.toString()}
                                onValueChange={(v) => handlePositionChange(fc.field, parseInt(v))}
                                disabled={!fc.enabled}
                              >
                                <SelectTrigger className="h-8" data-testid={`select-position-${fc.field}`}>
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

                            {/* Label */}
                            <div className="col-span-2">
                              <Input
                                className="h-8"
                                value={fc.label || fieldMeta.label}
                                onChange={(e) => handleLabelChange(fc.field, e.target.value)}
                                disabled={!fc.enabled}
                                placeholder={fieldMeta.label}
                                data-testid={`input-label-${fc.field}`}
                              />
                            </div>

                            {/* Value configuration based on type */}
                            {fieldMeta.type === "numeric" && (
                              <>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.defaultValue ?? ""}
                                    onChange={(e) => handleDefaultValueChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Default"
                                    data-testid={`input-default-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-1">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.min ?? ""}
                                    onChange={(e) => handleMinChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Min"
                                    data-testid={`input-min-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-1">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.max ?? ""}
                                    onChange={(e) => handleMaxChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Max"
                                    data-testid={`input-max-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-1">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.step ?? ""}
                                    onChange={(e) => handleStepChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Step"
                                    data-testid={`input-step-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    value={fc.tooltip || fieldMeta.defaultTooltip}
                                    onChange={(e) => handleTooltipChange(fc.field, e.target.value)}
                                    disabled={!fc.enabled}
                                    placeholder="Tooltip"
                                    data-testid={`input-tooltip-${fc.field}`}
                                  />
                                </div>
                              </>
                            )}

                            {fieldMeta.type === "slider" && (
                              <>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.defaultValue ?? ""}
                                    onChange={(e) => handleDefaultValueChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Default"
                                    data-testid={`input-default-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.min ?? ""}
                                    onChange={(e) => handleMinChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Min"
                                    data-testid={`input-min-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    type="number"
                                    value={fc.max ?? ""}
                                    onChange={(e) => handleMaxChange(fc.field, parseFloat(e.target.value))}
                                    disabled={!fc.enabled}
                                    placeholder="Max"
                                    data-testid={`input-max-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-3">
                                  <Input
                                    className="h-8"
                                    value={fc.tooltip || fieldMeta.defaultTooltip}
                                    onChange={(e) => handleTooltipChange(fc.field, e.target.value)}
                                    disabled={!fc.enabled}
                                    placeholder="Tooltip"
                                    data-testid={`input-tooltip-${fc.field}`}
                                  />
                                </div>
                              </>
                            )}

                            {fieldMeta.type === "dropdown" && (
                              <>
                                <div className="col-span-2">
                                  <Input
                                    className="h-8"
                                    value={fc.defaultValue ?? ""}
                                    onChange={(e) => handleDefaultValueChange(fc.field, e.target.value)}
                                    disabled={!fc.enabled}
                                    placeholder="Default"
                                    data-testid={`input-default-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-4">
                                  <Input
                                    className="h-8"
                                    value={fc.options?.join(", ") ?? ""}
                                    onChange={(e) => handleOptionsChange(fc.field, e.target.value.split(",").map(o => o.trim()).filter(o => o))}
                                    disabled={!fc.enabled}
                                    placeholder="Options (comma-separated)"
                                    data-testid={`input-options-${fc.field}`}
                                  />
                                </div>
                                <div className="col-span-3">
                                  <Input
                                    className="h-8"
                                    value={fc.tooltip || fieldMeta.defaultTooltip}
                                    onChange={(e) => handleTooltipChange(fc.field, e.target.value)}
                                    disabled={!fc.enabled}
                                    placeholder="Tooltip"
                                    data-testid={`input-tooltip-${fc.field}`}
                                  />
                                </div>
                                
                                {/* Product mapping for dropdown options */}
                                {fc.enabled && fc.options && fc.options.length > 0 && (
                                  <div className="col-span-12 mt-2 pt-2 border-t">
                                    <Label className="text-xs font-medium mb-2 block">Product Mappings</Label>
                                    <div className="text-xs text-muted-foreground mb-2">
                                      Map each option to categories, subcategories, or specific products
                                    </div>
                                    <div className="space-y-4">
                                      {fc.options.map((option) => {
                                        const paths = fc.optionPaths?.[option] || [];
                                        const optionSubcats = (fc as any).optionSubcategories?.[option] || [];
                                        const optionCodes = (fc as any).optionCodes?.[option] || [];
                                        
                                        return (
                                          <div key={option} className="space-y-2 p-3 border rounded-md bg-muted/30">
                                            <div className="text-sm font-semibold">{option}</div>
                                            
                                            {/* Category Paths */}
                                            <div className="space-y-1">
                                              <Label className="text-xs">Category Paths</Label>
                                              <div className="flex items-start gap-2">
                                                <div className="flex-1">
                                                  <PathMultiSelect
                                                    value={paths}
                                                    onChange={(newPaths) => handleOptionPathsChange(fc.field, option, newPaths)}
                                                    availablePaths={availablePaths}
                                                    placeholder="Select category paths..."
                                                    disabled={!fc.enabled}
                                                  />
                                                </div>
                                                <div className="flex gap-1 pt-1">
                                                  {paths.map(path => {
                                                    const count = pathCountByPath[path] ?? 0;
                                                    return (
                                                      <Badge
                                                        key={path}
                                                        variant={count > 0 ? "default" : "destructive"}
                                                        className="text-xs"
                                                      >
                                                        {count}
                                                      </Badge>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Subcategories */}
                                            <div className="space-y-1">
                                              <Label className="text-xs">Subcategories</Label>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-left font-normal"
                                                    disabled={!fc.enabled}
                                                  >
                                                    {optionSubcats.length > 0 
                                                      ? `${optionSubcats.length} selected`
                                                      : "Select subcategories..."}
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-2" align="start">
                                                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                    {subcategories.map(subcat => (
                                                      <div key={subcat.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded">
                                                        <Checkbox
                                                          checked={optionSubcats.includes(subcat.name)}
                                                          onCheckedChange={(checked) => {
                                                            const newSubcats = checked
                                                              ? [...optionSubcats, subcat.name]
                                                              : optionSubcats.filter(s => s !== subcat.name);
                                                            setFieldConfigs(prev => 
                                                              prev.map(field => {
                                                                if (field.field === fc.field) {
                                                                  const optionSubcategories = (field as any).optionSubcategories || {};
                                                                  return {
                                                                    ...field,
                                                                    optionSubcategories: {
                                                                      ...optionSubcategories,
                                                                      [option]: newSubcats
                                                                    }
                                                                  };
                                                                }
                                                                return field;
                                                              })
                                                            );
                                                          }}
                                                        />
                                                        <label className="text-sm flex-1 cursor-pointer">
                                                          {subcat.name}
                                                        </label>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                              {optionSubcats.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {optionSubcats.map(subcat => (
                                                    <Badge key={subcat} variant="secondary" className="text-xs">
                                                      {subcat}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {/* Product Codes */}
                                            <div className="space-y-1">
                                              <Label className="text-xs">Specific Products (SKU)</Label>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 w-full justify-start text-left font-normal"
                                                    disabled={!fc.enabled}
                                                  >
                                                    {optionCodes.length > 0 
                                                      ? `${optionCodes.length} selected`
                                                      : "Select product codes..."}
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-2" align="start">
                                                  <div className="max-h-[250px] overflow-y-auto space-y-1">
                                                    {(() => {
                                                      // Filter products based on selected category paths and subcategories
                                                      const filteredProducts = (products || []).filter((prod: any) => {
                                                        // If no filters selected, show all products
                                                        if (paths.length === 0 && optionSubcats.length === 0) {
                                                          return true;
                                                        }
                                                        
                                                        // Check category paths - must match if any paths are selected
                                                        const matchesPath = paths.length === 0 || 
                                                          paths.some(path => prod.categoryPaths?.includes(path));
                                                        
                                                        // Check subcategories - must match if any subcategories are selected
                                                        const matchesSubcat = optionSubcats.length === 0 || 
                                                          optionSubcats.includes(prod.subcategory);
                                                        
                                                        // Product must match ALL active filters (AND logic)
                                                        return matchesPath && matchesSubcat;
                                                      });
                                                      
                                                      if (filteredProducts.length === 0) {
                                                        return (
                                                          <div className="text-xs text-muted-foreground p-2 text-center">
                                                            No products match selected category paths or subcategories
                                                          </div>
                                                        );
                                                      }
                                                      
                                                      return filteredProducts.map((prod: any) => (
                                                        <div key={prod.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded">
                                                          <Checkbox
                                                            checked={optionCodes.includes(prod.code)}
                                                            onCheckedChange={(checked) => {
                                                              const newCodes = checked
                                                                ? [...optionCodes, prod.code]
                                                                : optionCodes.filter(c => c !== prod.code);
                                                              setFieldConfigs(prev => 
                                                                prev.map(field => {
                                                                  if (field.field === fc.field) {
                                                                    const optionCodes = (field as any).optionCodes || {};
                                                                    return {
                                                                      ...field,
                                                                      optionCodes: {
                                                                        ...optionCodes,
                                                                        [option]: newCodes
                                                                      }
                                                                    };
                                                                  }
                                                                  return field;
                                                                })
                                                              );
                                                            }}
                                                          />
                                                          <label className="text-xs flex-1 cursor-pointer">
                                                            <span className="font-medium">{prod.code}</span> - {prod.description}
                                                          </label>
                                                        </div>
                                                      ));
                                                    })()}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                              {optionCodes.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {optionCodes.map(code => (
                                                    <Badge key={code} variant="secondary" className="text-xs">
                                                      {code}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {fieldMeta.type === "toggle" && (
                              <>
                                <div className="col-span-7">
                                  <Input
                                    className="h-8"
                                    value={fc.tooltip || fieldMeta.defaultTooltip}
                                    onChange={(e) => handleTooltipChange(fc.field, e.target.value)}
                                    disabled={!fc.enabled}
                                    placeholder="Tooltip"
                                    data-testid={`input-tooltip-${fc.field}`}
                                  />
                                </div>
                                
                                {/* Category paths for toggle fields */}
                                {fc.enabled && (
                                  <div className="col-span-12 mt-2 pt-2 border-t">
                                    <Label className="text-xs font-medium mb-2 block">Associated Category Paths</Label>
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1">
                                        <PathMultiSelect
                                          value={fc.categoryPaths || []}
                                          onChange={(paths) => {
                                            setFieldConfigs(prev => 
                                              prev.map(field => 
                                                field.field === fc.field ? { ...field, categoryPaths: paths } : field
                                              )
                                            );
                                          }}
                                          availablePaths={availablePaths}
                                          placeholder="Select category paths..."
                                          disabled={!fc.enabled}
                                        />
                                      </div>
                                      <div className="flex gap-1 pt-1">
                                        {(fc.categoryPaths || []).map(path => {
                                          const count = pathCountByPath[path] ?? 0;
                                          return (
                                            <Badge
                                              key={path}
                                              variant={count > 0 ? "default" : "destructive"}
                                              className="text-xs"
                                            >
                                              {count}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
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
