import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FenceStyle, StyleProductSlot, StyleCalculatorField } from "@shared/schema";
import { Link } from "wouter";

interface StyleConfig {
  style: FenceStyle;
  fields: StyleCalculatorField[];
  productSlots: (StyleProductSlot & { product?: any })[];
}

export default function StyleConfig() {
  const { styleCode } = useParams<{ styleCode: string }>();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("products");

  // Fetch style configuration
  const { data: config, isLoading } = useQuery<StyleConfig>({
    queryKey: ["/api/styles", styleCode, "config"],
    enabled: !!styleCode,
  });

  // Update style mutation
  const updateStyleMutation = useMutation({
    mutationFn: async (updates: Partial<FenceStyle>) => {
      if (!config?.style.id) return;
      return apiRequest("PATCH", `/api/admin/styles/${config.style.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles", styleCode, "config"] });
      toast({
        title: "Success",
        description: "Style updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update style",
      });
    },
  });

  const handleFeatureToggle = (feature: string, value: boolean) => {
    const updates: any = {};
    
    switch (feature) {
      case "gates":
        updates.enableGates = value ? 1 : 0;
        break;
      case "topRail":
        updates.enableTopRail = value ? 1 : 0;
        break;
      case "hingePanel":
        updates.enableHingePanel = value ? 1 : 0;
        break;
      case "customWidth":
        updates.enableCustomWidth = value ? 1 : 0;
        break;
    }
    
    updateStyleMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Style Not Found</CardTitle>
            <CardDescription>
              The fence style "{styleCode}" could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/styles">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Styles
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { style, productSlots, fields } = config;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/styles">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-style-name">
                  {style.label}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Code: {style.code} {style.templateId && `• Template: ${style.templateId}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={style.isActive ? "default" : "secondary"} data-testid="badge-status">
                {style.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-list">
            <TabsTrigger value="products" data-testid="tab-products">
              Products ({productSlots.length})
            </TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">
              Calculator Settings ({fields.length})
            </TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">
              Features
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Product Mappings</CardTitle>
                    <CardDescription>
                      Products linked to this fence style via CSV import
                    </CardDescription>
                  </div>
                  <Button size="sm" data-testid="button-add-product">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {productSlots.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No products linked to this style yet.</p>
                    <p className="text-sm mt-2">Import a CSV template to populate product mappings.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {productSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                        data-testid={`slot-${slot.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{slot.productCode}</span>
                            <Badge variant="outline" className="text-xs">
                              {slot.fieldKey}
                            </Badge>
                            {slot.selectorKey && (
                              <Badge variant="secondary" className="text-xs">
                                {slot.selectorKey}mm
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {slot.label || slot.product?.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {slot.product && (
                            <Badge variant="outline" className="text-xs">
                              ${slot.product.price}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-slot-${slot.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculator Settings Tab */}
          <TabsContent value="calculator" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Calculator Fields</CardTitle>
                    <CardDescription>
                      Define input fields, constraints, and defaults for the calculator
                    </CardDescription>
                  </div>
                  <Button size="sm" data-testid="button-add-field">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No calculator fields configured yet.</p>
                    <p className="text-sm mt-2">Add fields to define calculator inputs and constraints.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                        data-testid={`field-${field.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {field.fieldType}
                            </Badge>
                          </div>
                          {(field.min || field.max || field.defaultValue) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {field.min && `Min: ${field.min}${field.unit || ''}`}
                              {field.max && ` • Max: ${field.max}${field.unit || ''}`}
                              {field.defaultValue && ` • Default: ${field.defaultValue}${field.unit || ''}`}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-field-${field.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Toggles</CardTitle>
                <CardDescription>
                  Enable or disable features for this fence style
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enable-gates">Enable Gates</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow gate configuration in calculator
                      </p>
                    </div>
                    <Switch
                      id="enable-gates"
                      checked={style.enableGates === 1}
                      onCheckedChange={(checked) => handleFeatureToggle("gates", checked)}
                      data-testid="switch-gates"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enable-top-rail">Enable Top Rail</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow top rail option (typically for balustrades)
                      </p>
                    </div>
                    <Switch
                      id="enable-top-rail"
                      checked={style.enableTopRail === 1}
                      onCheckedChange={(checked) => handleFeatureToggle("topRail", checked)}
                      data-testid="switch-top-rail"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enable-hinge-panel">Enable Hinge Panel</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow hinge panel configuration
                      </p>
                    </div>
                    <Switch
                      id="enable-hinge-panel"
                      checked={style.enableHingePanel === 1}
                      onCheckedChange={(checked) => handleFeatureToggle("hingePanel", checked)}
                      data-testid="switch-hinge-panel"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enable-custom-width">Enable Custom Width</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow custom width panels
                      </p>
                    </div>
                    <Switch
                      id="enable-custom-width"
                      checked={style.enableCustomWidth === 1}
                      onCheckedChange={(checked) => handleFeatureToggle("customWidth", checked)}
                      data-testid="switch-custom-width"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
