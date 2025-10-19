import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminNav } from "@/components/admin-nav";
import { FieldConfigEditor } from "@/components/field-config-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Fence, ChevronDown, ChevronRight, Plus, Save, Trash2, Settings, X } from "lucide-react";
import type { FenceUIConfig, FenceComponentSection, FenceVariantGroup, FenceVariantSpec, UIFieldConfigWithRules } from "@shared/schema";

export default function FenceStylesConfig() {
  const { toast } = useToast();
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  const [selectedVariant, setSelectedVariant] = useState<{
    styleId: string;
    sectionId: string;
    groupId: string;
    variantId: string;
  } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [localConfigs, setLocalConfigs] = useState<FenceUIConfig[]>([]);

  const { data: fenceConfigs, isLoading } = useQuery<FenceUIConfig[]>({
    queryKey: ["/api/admin/fence-ui-configs"],
  });

  useEffect(() => {
    if (fenceConfigs) {
      setLocalConfigs(JSON.parse(JSON.stringify(fenceConfigs))); // Deep clone for local editing
    }
  }, [fenceConfigs]);

  const saveMutation = useMutation({
    mutationFn: async (config: FenceUIConfig) => {
      return apiRequest("PUT", `/api/admin/fence-ui-configs/${config.fenceStyleId}`, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fence-ui-configs"] });
      toast({
        title: "Saved",
        description: "Fence style configuration saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "Failed to save configuration",
      });
    },
  });

  const handleFieldsChange = (fields: UIFieldConfigWithRules[]) => {
    if (!selectedVariant) return;

    const newConfigs = localConfigs.map((config) => {
      if (config.fenceStyleId !== selectedVariant.styleId) return config;

      return {
        ...config,
        config: {
          ...config.config,
          sections: config.config.sections.map((section) => {
            if (section.id !== selectedVariant.sectionId) return section;

            return {
              ...section,
              variants: section.variants.map((group) => {
                if (group.id !== selectedVariant.groupId) return group;

                return {
                  ...group,
                  variants: group.variants.map((variant) => {
                    if (variant.id !== selectedVariant.variantId) return variant;

                    return {
                      ...variant,
                      fieldConfigs: fields,
                    };
                  }),
                };
              }),
            };
          }),
        },
      };
    });

    setLocalConfigs(newConfigs);
  };

  const getCurrentVariant = () => {
    if (!selectedVariant) return null;

    const config = localConfigs.find((c) => c.fenceStyleId === selectedVariant.styleId);
    if (!config) return null;

    const section = config.config.sections.find((s) => s.id === selectedVariant.sectionId);
    if (!section) return null;

    const group = section.variants.find((g) => g.id === selectedVariant.groupId);
    if (!group) return null;

    return group.variants.find((v) => v.id === selectedVariant.variantId);
  };

  const openFieldEditor = (styleId: string, sectionId: string, groupId: string, variantId: string) => {
    setSelectedVariant({ styleId, sectionId, groupId, variantId });
    setEditDialogOpen(true);
  };

  const closeFieldEditor = () => {
    setEditDialogOpen(false);
    setSelectedVariant(null);
  };

  const toggleStyle = (styleId: string) => {
    const newExpanded = new Set(expandedStyles);
    if (newExpanded.has(styleId)) {
      newExpanded.delete(styleId);
    } else {
      newExpanded.add(styleId);
    }
    setExpandedStyles(newExpanded);
  };

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSections(newExpanded);
  };

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleVariant = (key: string) => {
    const newExpanded = new Set(expandedVariants);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedVariants(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading fence configurations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Fence className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold">Fence Style Configuration</h1>
          </div>
          <p className="text-muted-foreground mb-4">
            Configure UI fields for each fence style, component section, and variant
          </p>
          <AdminNav currentPage="fence-styles" />
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl">
        {!localConfigs || localConfigs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No fence styles configured. Create your first fence style configuration.
              </p>
              <div className="flex justify-center mt-4">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fence Style
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {localConfigs.map((fenceConfig: FenceUIConfig) => (
              <Card key={fenceConfig.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStyle(fenceConfig.fenceStyleId)}
                        data-testid={`toggle-style-${fenceConfig.fenceStyleId}`}
                      >
                        {expandedStyles.has(fenceConfig.fenceStyleId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div>
                        <CardTitle>{fenceConfig.displayName}</CardTitle>
                        <CardDescription className="mt-1">
                          {fenceConfig.fenceStyleId} • {fenceConfig.config.sections.length} sections
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={fenceConfig.status === "active" ? "default" : "secondary"}>
                        {fenceConfig.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                        const configToSave = localConfigs.find(c => c.id === fenceConfig.id);
                        if (configToSave) saveMutation.mutate(configToSave);
                      }}
                        disabled={saveMutation.isPending}
                        data-testid={`save-style-${fenceConfig.fenceStyleId}`}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saveMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedStyles.has(fenceConfig.fenceStyleId) && (
                  <CardContent>
                    <div className="space-y-3">
                      {fenceConfig.config.sections
                        .sort((a: FenceComponentSection, b: FenceComponentSection) => a.order - b.order)
                        .map((section: FenceComponentSection) => {
                          const sectionKey = `${fenceConfig.fenceStyleId}-${section.id}`;
                          return (
                            <Card key={sectionKey} className="border-l-4 border-l-primary/50">
                              <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleSection(sectionKey)}
                                    data-testid={`toggle-section-${sectionKey}`}
                                  >
                                    {expandedSections.has(sectionKey) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{section.label}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {section.variants.length} variant group(s)
                                    </p>
                                  </div>
                                </div>
                              </CardHeader>

                              {expandedSections.has(sectionKey) && (
                                <CardContent className="pt-0">
                                  <div className="space-y-3 pl-10">
                                    {section.variants
                                      .sort((a: FenceVariantGroup, b: FenceVariantGroup) => a.order - b.order)
                                      .map((group: FenceVariantGroup) => {
                                        const groupKey = `${sectionKey}-${group.id}`;
                                        return (
                                          <Card key={groupKey} className="border-l-2 border-l-muted">
                                            <CardHeader className="pb-3">
                                              <div className="flex items-center gap-3">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => toggleGroup(groupKey)}
                                                  data-testid={`toggle-group-${groupKey}`}
                                                >
                                                  {expandedGroups.has(groupKey) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                  ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                  )}
                                                </Button>
                                                <div className="flex-1">
                                                  <h4 className="font-medium">
                                                    {group.brand || group.subcategory || "Default"}
                                                  </h4>
                                                  <p className="text-sm text-muted-foreground">
                                                    {group.variants.length} variant(s)
                                                  </p>
                                                </div>
                                              </div>
                                            </CardHeader>

                                            {expandedGroups.has(groupKey) && (
                                              <CardContent className="pt-0">
                                                <div className="space-y-2 pl-10">
                                                  {group.variants.map((variant: FenceVariantSpec) => {
                                                    const variantKey = `${groupKey}-${variant.id}`;
                                                    return (
                                                      <Card key={variantKey} className="bg-muted/30">
                                                        <CardHeader className="pb-2">
                                                          <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                              <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => toggleVariant(variantKey)}
                                                                data-testid={`toggle-variant-${variantKey}`}
                                                              >
                                                                {expandedVariants.has(variantKey) ? (
                                                                  <ChevronDown className="h-4 w-4" />
                                                                ) : (
                                                                  <ChevronRight className="h-4 w-4" />
                                                                )}
                                                              </Button>
                                                              <div>
                                                                <h5 className="font-medium">{variant.label}</h5>
                                                                {variant.description && (
                                                                  <p className="text-xs text-muted-foreground">
                                                                    {variant.description}
                                                                  </p>
                                                                )}
                                                                <div className="flex gap-2 mt-1">
                                                                  {variant.skuPrefix && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                      SKU: {variant.skuPrefix}
                                                                    </Badge>
                                                                  )}
                                                                  <Badge variant="secondary" className="text-xs">
                                                                    {variant.fieldConfigs.length} field(s)
                                                                  </Badge>
                                                                </div>
                                                              </div>
                                                            </div>
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              onClick={() =>
                                                                openFieldEditor(
                                                                  fenceConfig.fenceStyleId,
                                                                  section.id,
                                                                  group.id,
                                                                  variant.id
                                                                )
                                                              }
                                                              data-testid={`configure-${variantKey}`}
                                                            >
                                                              <Settings className="h-4 w-4 mr-2" />
                                                              Configure Fields
                                                            </Button>
                                                          </div>
                                                        </CardHeader>

                                                        {expandedVariants.has(variantKey) && (
                                                          <CardContent className="pt-2">
                                                            <div className="space-y-2 text-sm">
                                                              {variant.fieldConfigs.length === 0 ? (
                                                                <p className="text-muted-foreground italic">
                                                                  No fields configured yet
                                                                </p>
                                                              ) : (
                                                                <div className="space-y-1">
                                                                  {variant.fieldConfigs
                                                                    .sort((a: UIFieldConfigWithRules, b: UIFieldConfigWithRules) => a.position - b.position)
                                                                    .map((field: UIFieldConfigWithRules, idx: number) => (
                                                                      <div
                                                                        key={idx}
                                                                        className="flex items-center justify-between p-2 bg-background rounded"
                                                                      >
                                                                        <div className="flex items-center gap-2">
                                                                          <Badge
                                                                            variant={field.enabled ? "default" : "secondary"}
                                                                            className="text-xs"
                                                                          >
                                                                            {field.enabled ? "ON" : "OFF"}
                                                                          </Badge>
                                                                          <span>{field.label || field.field}</span>
                                                                        </div>
                                                                        <Badge variant="outline" className="text-xs">
                                                                          {field.type || "standard"}
                                                                        </Badge>
                                                                      </div>
                                                                    ))}
                                                                </div>
                                                              )}
                                                            </div>
                                                          </CardContent>
                                                        )}
                                                      </Card>
                                                    );
                                                  })}
                                                </div>
                                              </CardContent>
                                            )}
                                          </Card>
                                        );
                                      })}
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Field Configuration Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Fields</DialogTitle>
            <DialogDescription>
              {selectedVariant && getCurrentVariant() && (
                <>
                  Edit field configuration for <strong>{getCurrentVariant()?.label}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedVariant && getCurrentVariant() && (
            <div className="py-4">
              <FieldConfigEditor
                fields={getCurrentVariant()!.fieldConfigs}
                onChange={handleFieldsChange}
                variantLabel={getCurrentVariant()!.label}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={closeFieldEditor} data-testid="close-field-editor">
              Close
            </Button>
            <Button 
              onClick={() => {
                closeFieldEditor();
                toast({
                  title: "Changes saved locally",
                  description: "Click the Save button on the fence style to persist changes",
                });
              }}
              data-testid="done-field-editor"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
