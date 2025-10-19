import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FenceShapeSelector } from "@/components/fence-shape-selector";
import { SpanConfigPanel } from "@/components/span-config-panel";
import { FenceVisualization } from "@/components/fence-visualization";
import { ComponentList } from "@/components/component-list";
import { AppHeader } from "@/components/app-header";
import { ProductSelector } from "@/components/product-selector";
import { useToast } from "@/hooks/use-toast";
import { FenceDesign, FenceShape, SpanConfig, Component, SavedFenceDesign, SpigotMounting, SpigotColor, ProductType, ProductVariant, getSpigotDetails, getHingeDetails, getLatchDetails, optimizeRailLengths, HandrailType, HandrailMaterial, HandrailFinish, RailTerminationType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, Plus } from "lucide-react";

export default function FenceLogic() {
  const { toast } = useToast();
  const [activeSpanId, setActiveSpanId] = useState<string | undefined>();
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showProductMockup, setShowProductMockup] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  // Get URL params for pre-selecting product
  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type") as ProductType | null;
  const urlVariant = urlParams.get("variant") as ProductVariant | null;

  const [design, setDesign] = useState<FenceDesign>({
    name: "Untitled Design",
    productType: urlType || "glass-pool",
    productVariant: urlVariant || "glass-pool-spigots",
    shape: "inline",
    customSides: 3,
    spans: [
      {
        spanId: "A",
        length: 5000,
        maxPanelWidth: (urlVariant === "custom-frameless") ? 1500 : 1200,
        desiredGap: 50,
        spigotMounting: "base-plate",
        spigotColor: "polished",
        leftGap: {
          enabled: true,
          position: "inside",
          size: 25,
        },
        rightGap: {
          enabled: true,
          position: "inside",
          size: 25,
        },
      },
    ],
  });

  // Fetch all saved designs
  const { data: savedDesigns, isLoading: isLoadingDesigns } = useQuery<SavedFenceDesign[]>({
    queryKey: ["/api/designs"],
  });

  // Fetch slot mappings for current product variant
  const { data: slotMappings = [] } = useQuery<Array<{
    id: string;
    internalId: string;
    productVariant: string;
    fieldName: string;
    productId: string | null;
    label: string | null;
    product?: { code: string; description: string; price: string };
  }>>({
    queryKey: ["/api/admin/product-slots", design.productVariant],
    enabled: !!design.productVariant,
  });

  // Fetch all products for slot lookups
  const { data: products = [] } = useQuery<Array<{
    id: string;
    code: string;
    description: string;
    price: string;
    subcategory: string;
  }>>({
    queryKey: ["/api/admin/products"],
  });

  // Fetch UI config for current product variant
  const { data: uiConfig } = useQuery({
    queryKey: ["/api/ui-configs", design.productVariant],
    queryFn: async () => {
      const response = await fetch(`/api/ui-configs/${design.productVariant}`);
      if (!response.ok) {
        // If config doesn't exist, return null (fallback to all fields enabled)
        if (response.status === 404) return null;
        throw new Error("Failed to fetch UI config");
      }
      return response.json();
    },
  });

  // Helper function to get default max panel width from UI config
  const getDefaultMaxPanelWidth = () => {
    if (design.productVariant === "custom-frameless") return 1500;
    
    // Get from UI config if available
    const maxPanelField = uiConfig?.fieldConfigs?.find((f: any) => f.field === "max-panel-width");
    if (maxPanelField?.defaultConfig?.defaultValue) {
      return parseInt(maxPanelField.defaultConfig.defaultValue);
    }
    
    // Fallback to 1200 (UI config default)
    return 1200;
  };

  // Save design mutation
  const saveDesignMutation = useMutation({
    mutationFn: async (designToSave: FenceDesign) => {
      const response = await apiRequest("POST", "/api/designs", {
        name: designToSave.name,
        productType: designToSave.productType,
        productVariant: designToSave.productVariant,
        shape: designToSave.shape,
        customSides: designToSave.customSides,
        spans: designToSave.spans,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({
        title: "Design Saved",
        description: "Your fence design has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save design. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Email quote mutation
  const emailQuoteMutation = useMutation({
    mutationFn: async ({ email, design, components }: { email: string; design: FenceDesign; components: Component[] }) => {
      const response = await apiRequest("POST", "/api/email-quote", {
        email,
        design,
        components,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Quote Sent",
        description: `Quote has been sent to ${emailAddress}`,
      });
      setShowEmailDialog(false);
      setEmailAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShapeChange = useCallback((shape: FenceShape) => {
    setDesign((prev) => {
      const newSpans = getSpansForShape(shape, prev.customSides);
      return { ...prev, shape, spans: newSpans };
    });
  }, []);

  const handleCustomSidesChange = useCallback((customSides: number) => {
    setDesign((prev) => {
      const newSpans = getSpansForShape(prev.shape, customSides);
      return { ...prev, customSides, spans: newSpans };
    });
  }, []);

  const handleSpanUpdate = useCallback((spanId: string, updatedSpan: SpanConfig) => {
    setDesign((prev) => ({
      ...prev,
      spans: prev.spans.map((span) =>
        span.spanId === spanId ? updatedSpan : span
      ),
    }));
  }, []);

  const handleAddSection = useCallback(() => {
    setDesign((prev) => {
      // Generate next span ID (A, B, C... Z, AA, AB, etc.)
      const existingIds = prev.spans.map(s => s.spanId);
      let nextId = String.fromCharCode(65); // Start with 'A'
      let counter = 0;
      
      while (existingIds.includes(nextId)) {
        counter++;
        if (counter < 26) {
          nextId = String.fromCharCode(65 + counter);
        } else {
          // After Z, use AA, AB, AC, etc.
          const firstChar = String.fromCharCode(65 + Math.floor((counter - 26) / 26));
          const secondChar = String.fromCharCode(65 + ((counter - 26) % 26));
          nextId = firstChar + secondChar;
        }
      }

      // Create new span based on last span or default
      const lastSpan = prev.spans[prev.spans.length - 1];
      const newSpan: SpanConfig = {
        spanId: nextId,
        length: lastSpan?.length || 5000,
        maxPanelWidth: lastSpan?.maxPanelWidth || getDefaultMaxPanelWidth(),
        desiredGap: lastSpan?.desiredGap || 50,
        spigotMounting: lastSpan?.spigotMounting || "base-plate",
        spigotColor: lastSpan?.spigotColor || "polished",
        layoutMode: lastSpan?.layoutMode || (design.productVariant === "custom-frameless" ? "auto-calc" : "auto-equalize"),
        leftGap: lastSpan?.leftGap || {
          enabled: true,
          position: "inside",
          size: 25,
        },
        rightGap: lastSpan?.rightGap || {
          enabled: true,
          position: "inside",
          size: 25,
        },
        // Copy autoCalcConfig if present in last span
        ...(lastSpan?.autoCalcConfig && {
          autoCalcConfig: { ...lastSpan.autoCalcConfig }
        }),
      };

      return {
        ...prev,
        spans: [...prev.spans, newSpan],
      };
    });

    toast({
      title: "Section Added",
      description: "A new section has been added to your fence design.",
    });
  }, [design.productVariant, toast]);

  const handleSave = () => {
    saveDesignMutation.mutate(design);
  };

  const handleLoad = () => {
    setShowLoadDialog(true);
  };

  const handleLoadDesign = (savedDesign: SavedFenceDesign) => {
    const loadedSpans = savedDesign.spans as any;
    // Normalize spans to have default values for new fields
    const normalizedSpans = Array.isArray(loadedSpans) ? loadedSpans.map((span: any) => ({
      ...span,
      spigotMounting: span.spigotMounting || "base-plate",
      spigotColor: span.spigotColor || "polished",
      gateConfig: span.gateConfig ? {
        ...span.gateConfig,
        hingeType: span.gateConfig.hingeType || "standard",
        latchType: span.gateConfig.latchType || "key-lock",
      } : undefined,
    })) : [];
    
    setDesign({
      name: savedDesign.name,
      productType: (savedDesign.productType as any) || "glass-pool",
      productVariant: (savedDesign.productVariant as any) || "glass-pool-spigots",
      shape: savedDesign.shape as FenceShape,
      customSides: savedDesign.customSides || 3,
      spans: normalizedSpans,
    });
    setShowLoadDialog(false);
    toast({
      title: "Design Loaded",
      description: "Your fence design has been loaded successfully.",
    });
  };

  const handleReset = () => {
    setDesign({
      name: "Untitled Design",
      productType: "glass-pool",
      productVariant: "glass-pool-spigots",
      shape: "inline",
      customSides: 3,
      spans: [
        {
          spanId: "A",
          length: 5000,
          maxPanelWidth: 1200,
          desiredGap: 50,
          spigotMounting: "base-plate",
          spigotColor: "polished",
          leftGap: {
            enabled: true,
            position: "inside",
            size: 25,
          },
          rightGap: {
            enabled: true,
            position: "inside",
            size: 25,
          },
        },
      ],
    });
    setActiveSpanId(undefined);
    toast({
      title: "Design Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  const handleEmailQuote = () => {
    setShowEmailDialog(true);
  };

  const handleSendEmail = () => {
    if (!emailAddress || !emailAddress.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    emailQuoteMutation.mutate({
      email: emailAddress,
      design,
      components,
    });
  };

  const handleDownloadList = () => {
    const csvContent = generateComponentCSV(components, design);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "component-list.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "List Downloaded",
      description: "Component list with panel layout has been downloaded as CSV.",
    });
  };

  const components = useMemo(() => {
    return calculateComponents(design, slotMappings, products);
  }, [design, slotMappings, products]);

  const progress = useMemo(() => {
    let completed = 0;
    let total = 0;

    // Shape selected
    total += 1;
    if (design.shape) completed += 1;

    // Each span configured
    design.spans.forEach((span) => {
      total += 3; // length, panel config, gate (if needed)
      if (span.length > 0) completed += 1;
      if (span.maxPanelWidth && span.desiredGap !== undefined) completed += 1;
      if (!span.gateConfig?.required || span.gateConfig) completed += 1;
    });

    return Math.round((completed / total) * 100);
  }, [design]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader
        progress={progress}
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={handleReset}
        isSaving={saveDesignMutation.isPending}
        productVariant={design.productVariant}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden">
        {/* 3D Visualization */}
        <div className="relative h-full min-h-[400px] lg:min-h-0">
          <FenceVisualization design={design} activeSpanId={activeSpanId} />
        </div>

        {/* Controls Panel */}
        <div className="h-full overflow-y-auto bg-card border-l border-card-border">
          <div className="p-6 space-y-6">
            {/* Design Name */}
            <div className="space-y-2">
              <Label htmlFor="design-name" className="text-sm font-medium">Design Name</Label>
              <Input
                id="design-name"
                value={design.name}
                onChange={(e) => setDesign(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter design name"
                className="text-lg font-semibold"
                data-testid="input-design-name"
              />
            </div>

            {/* Product Type Selector Banner */}
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    {design.productVariant === "glass-pool-spigots" && "Glass Pool Fencing - Frameless with Spigots"}
                    {design.productVariant === "glass-pool-channel" && "Glass Pool Fencing - Channel"}
                    {design.productVariant === "glass-bal-spigots" && "Glass Balustrade - Frameless with Spigots"}
                    {design.productVariant === "glass-bal-channel" && "Glass Balustrade - Channel"}
                    {design.productVariant === "glass-bal-standoffs" && "Glass Balustrade - Standoffs"}
                    {design.productVariant === "alu-pool-tubular" && "Aluminium Pool Fencing - Tubular Flat Top"}
                    {design.productVariant === "alu-pool-barr" && "Aluminium Pool Fencing - BARR"}
                    {design.productVariant === "alu-pool-blade" && "Aluminium Pool Fencing - Blade"}
                    {design.productVariant === "alu-pool-pik" && "Aluminium Pool Fencing - PIK"}
                    {design.productVariant === "alu-bal-barr" && "Aluminium Balustrade - Barr"}
                    {design.productVariant === "alu-bal-blade" && "Aluminium Balustrade - Blade"}
                    {design.productVariant === "alu-bal-visor" && "Aluminium Balustrade - Visor"}
                    {design.productVariant === "pvc-privacy" && "PVC Fencing"}
                    {design.productVariant === "general-zeus" && "General Fencing - Zeus"}
                    {design.productVariant === "general-blade" && "General Fencing - Blade"}
                    {design.productVariant === "general-barr" && "General Fencing - Barr"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click to switch between Glass Balustrade, Aluminium, and General Fencing options
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowProductMockup(true)}
                    data-testid="button-change-product"
                  >
                    Change Product Type
                  </Button>
                </div>
              </div>
            </div>

            {/* Shape Selector */}
            <FenceShapeSelector
              selected={design.shape}
              customSides={design.customSides}
              onShapeChange={handleShapeChange}
              onCustomSidesChange={handleCustomSidesChange}
            />

            {/* Section Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Section Configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure each section of your fence
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddSection}
                  data-testid="button-add-section"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Section
                </Button>
              </div>

              {design.spans.map((span, index) => (
                <div
                  key={span.spanId}
                  onMouseEnter={() => setActiveSpanId(span.spanId)}
                  onMouseLeave={() => setActiveSpanId(undefined)}
                >
                  <SpanConfigPanel
                    span={span}
                    onUpdate={(updatedSpan) => handleSpanUpdate(span.spanId, updatedSpan)}
                    productVariant={design.productVariant}
                    uiConfig={uiConfig}
                    showLeftGap={true}
                    showRightGap={true}
                  />
                </div>
              ))}
            </div>

            {/* Component List */}
            <ComponentList
              components={components}
              onEmail={handleEmailQuote}
              onDownload={handleDownloadList}
            />
          </div>
        </div>
      </div>

      {/* Load Design Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Load Saved Design</DialogTitle>
            <DialogDescription>
              Select a previously saved design to load
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDesigns ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : savedDesigns && savedDesigns.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2">
              {savedDesigns.map((savedDesign) => (
                <button
                  key={savedDesign.id}
                  onClick={() => handleLoadDesign(savedDesign)}
                  className="w-full text-left p-4 border border-border rounded-md hover-elevate active-elevate-2"
                  data-testid={`load-design-${savedDesign.id}`}
                >
                  <h4 className="font-semibold">{savedDesign.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {savedDesign.shape} • {Array.isArray(savedDesign.spans) ? savedDesign.spans.length : 0} spans
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saved: {new Date(savedDesign.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No saved designs found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create and save a design to see it here
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Quote Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Quote</DialogTitle>
            <DialogDescription>
              Enter your email address to receive the quote
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                data-testid="input-email-address"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEmailDialog(false);
                  setEmailAddress("");
                }}
                data-testid="button-cancel-email"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={emailQuoteMutation.isPending}
                data-testid="button-send-email"
              >
                {emailQuoteMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Send Quote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Selector Dialog */}
      <Dialog open={showProductMockup} onOpenChange={setShowProductMockup}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Product Type</DialogTitle>
            <DialogDescription>
              Choose the type of fencing or balustrade you want to configure
            </DialogDescription>
          </DialogHeader>
          
          <ProductSelector 
            currentVariant={design.productVariant}
            onSelectVariant={(type, variant) => {
              setDesign((prev) => {
                // Update maxPanelWidth for custom-frameless variant
                const updatedSpans = variant === "custom-frameless"
                  ? prev.spans.map(span => ({
                      ...span,
                      maxPanelWidth: 1500,
                    }))
                  : prev.spans;

                return {
                  ...prev,
                  productType: type,
                  productVariant: variant,
                  spans: updatedSpans,
                };
              });
              setShowProductMockup(false);
              
              // Inform user if switching to balustrade (gates will be hidden but preserved)
              const isBalustrade = variant.includes("bal-");
              toast({
                title: "Product Changed",
                description: isBalustrade 
                  ? `Switched to ${variant.replace(/-/g, ' ')} - Gate controls hidden for balustrade products`
                  : `Switched to ${variant.replace(/-/g, ' ')}`,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getSpansForShape(shape: FenceShape, customSides?: number): SpanConfig[] {
  const defaultSpan: Omit<SpanConfig, "spanId"> = {
    length: 5000,
    maxPanelWidth: 1200,
    desiredGap: 50,
    spigotMounting: "base-plate",
    spigotColor: "polished",
    leftGap: {
      enabled: true,
      position: "inside",
      size: 25,
    },
    rightGap: {
      enabled: true,
      position: "inside",
      size: 25,
    },
  };

  switch (shape) {
    case "inline":
      return [{ ...defaultSpan, spanId: "A" }];
    case "l-shape":
      return [
        { ...defaultSpan, spanId: "A" },
        { ...defaultSpan, spanId: "B" },
      ];
    case "u-shape":
      return [
        { ...defaultSpan, spanId: "A" },
        { ...defaultSpan, spanId: "B" },
        { ...defaultSpan, spanId: "C" },
      ];
    case "enclosed":
      return [
        { ...defaultSpan, spanId: "A" },
        { ...defaultSpan, spanId: "B" },
        { ...defaultSpan, spanId: "C" },
        { ...defaultSpan, spanId: "D" },
      ];
    case "custom":
      const sides = customSides || 3;
      return Array.from({ length: sides }, (_, i) => ({
        ...defaultSpan,
        spanId: String.fromCharCode(65 + i), // A, B, C, ...
      }));
    default:
      return [{ ...defaultSpan, spanId: "A" }];
  }
}

function calculateComponents(
  design: FenceDesign, 
  slotMappings: Array<{ internalId: string; fieldName: string; productId: string | null; label: string | null }> = [],
  products: Array<{ id: string; code: string; description: string; price: string }> = []
): Component[] {
  // Helper function to lookup product from slot mappings
  const lookupProductFromSlot = (panelWidth: number, fieldName: string = "glass-panels"): { sku: string; description: string } | null => {
    // Find slot that matches this panel width (internalId is formatted as width, e.g., "1400" for 1400mm)
    const slot = slotMappings.find(s => 
      s.fieldName === fieldName && 
      s.internalId === String(panelWidth).padStart(4, '0')
    );
    
    if (slot && slot.productId) {
      const product = products.find(p => p.id === slot.productId);
      if (product) {
        return {
          sku: product.code,
          description: product.description
        };
      }
    }
    
    return null; // No mapping found - will use fallback
  };

  const components: Component[] = [];
  const isChannelSystem = design.productVariant === "glass-pool-channel";
  const isBladeFencing = design.productVariant === "alu-pool-blade";
  const isBarrFencing = design.productVariant === "alu-pool-barr";
  const isTubularFencing = design.productVariant === "alu-pool-tubular";
  const gatesAllowed = !design.productVariant.includes("bal-");

  design.spans.forEach((span) => {
    // Blade Fencing has its own component generation logic
    if (isBladeFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const bladeHeight = span.bladeHeight || "1200mm";
      const bladeFinish = span.bladeFinish || "satin-black";
      const bladePostType = span.bladePostType || "welded-base-plate";
      
      // Blade Panel specifications
      const panelSpecs = {
        "1000mm": { width: 1700, height: 1000, sku: "BLADE-1000" },
        "1200mm": { width: 2200, height: 1200, sku: "BLADE-1200" },
      };
      const spec = panelSpecs[bladeHeight];
      
      // Finish details
      const finishName = bladeFinish === "satin-black" ? "Satin Black (CN150A)" : "Pearl White (GA078A)";
      const finishSku = bladeFinish === "satin-black" ? "CN150A" : "GA078A";
      
      // Add panels from layout
      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth, index) => {
        const panelType = panelTypes[index] || "standard";
        
        if (panelType === "gate") {
          // Blade gate panel
          components.push({
            qty: 1,
            description: `Blade Gate Panel ${bladeHeight} x ${panelWidth}mm (${finishName})`,
            sku: `${spec.sku}-GATE-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === spec.width) {
          // Full standard Blade panel
          components.push({
            qty: 1,
            description: `Blade Panel ${bladeHeight} x ${spec.width}mm (${finishName})`,
            sku: `${spec.sku}-${spec.width}-${finishSku}`,
          });
        } else {
          // Cut Blade panel
          components.push({
            qty: 1,
            description: `Blade Panel ${bladeHeight} x ${panelWidth}mm (Cut from ${spec.width}mm, ${finishName})`,
            sku: `${spec.sku}-CUT-${panelWidth}-${finishSku}`,
          });
        }
      });
      
      // Add posts from gaps array (each gap represents a 50x50mm post)
      const numPosts = span.panelLayout.gaps.length;
      if (bladePostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `Blade 50x50mm Welded Base Plate Post 1300mm (${finishName})`,
          sku: `BLADE-POST-WBP-1300-${finishSku}`,
        });
      } else {
        // Standard posts - assume 1800mm or 2400mm
        const postLength = bladeHeight === "1200mm" ? 2400 : 1800;
        components.push({
          qty: numPosts,
          description: `Blade 50x50mm Standard Post ${postLength}mm (${finishName})`,
          sku: `BLADE-POST-STD-${postLength}-${finishSku}`,
        });
      }
      
      // Gate hardware for Blade
      if (gatesAllowed && span.gateConfig?.required) {
        // Blade gates use D&D hardware
        const gateHeight = spec.height;
        const gateWidth = span.gateConfig.gateSize || 975;
        
        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm Blade Gate`,
          sku: `DD-HINGE-BLADE-${gateHeight}-${gateWidth}`,
        });
        
        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm Blade Gate`,
          sku: `DD-LATCH-BLADE-${gateHeight}-${gateWidth}`,
        });
      }
      
      return; // Skip glass/channel logic for Blade
    }
    // BARR Fencing has its own component generation logic
    else if (isBarrFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const barrHeight = span.barrHeight || "1200mm";
      const barrFinish = span.barrFinish || "satin-black";
      const barrPostType = span.barrPostType || "welded-base-plate";
      
      // BARR Panel specifications
      const panelSpecs = {
        "1000mm": { width: 1733, height: 1000, sku: "BARR-1000" },
        "1200mm": { width: 2205, height: 1200, sku: "BARR-1200" },
        "1800mm": { width: 1969, height: 1800, sku: "BARR-1800" },
      };
      const spec = panelSpecs[barrHeight];
      
      // Finish details
      const finishName = barrFinish === "satin-black" ? "Satin Black (CN150A)" : "Pearl White (GA078A)";
      const finishSku = barrFinish === "satin-black" ? "CN150A" : "GA078A";
      
      // Add panels from layout
      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth, index) => {
        const panelType = panelTypes[index] || "standard";
        
        if (panelType === "gate") {
          // BARR gate panel
          components.push({
            qty: 1,
            description: `BARR Gate Panel ${barrHeight} x ${panelWidth}mm (${finishName})`,
            sku: `${spec.sku}-GATE-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === spec.width) {
          // Full standard BARR panel
          components.push({
            qty: 1,
            description: `BARR Panel ${barrHeight} x ${spec.width}mm (${finishName})`,
            sku: `${spec.sku}-${spec.width}-${finishSku}`,
          });
        } else {
          // Cut BARR panel
          components.push({
            qty: 1,
            description: `BARR Panel ${barrHeight} x ${panelWidth}mm (Cut from ${spec.width}mm, ${finishName})`,
            sku: `${spec.sku}-CUT-${panelWidth}-${finishSku}`,
          });
        }
      });
      
      // Add posts from gaps array (each gap represents a post)
      const numPosts = span.panelLayout.gaps.length;
      if (barrPostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `BARR Welded Base Plate Post 1280mm (${finishName})`,
          sku: `BARR-POST-WBP-1280-${finishSku}`,
        });
      } else {
        // Standard posts - assume 1800mm for 1000mm and 1200mm heights, 2500mm for 1800mm
        const postLength = barrHeight === "1800mm" ? 2500 : 1800;
        components.push({
          qty: numPosts,
          description: `BARR Standard Post ${postLength}mm (${finishName})`,
          sku: `BARR-POST-STD-${postLength}-${finishSku}`,
        });
      }
      
      // Gate hardware for BARR
      if (gatesAllowed && span.gateConfig?.required) {
        // BARR gates use D&D hardware
        const gateHeight = spec.height;
        const gateWidth = span.gateConfig.gateSize || 975;
        
        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm BARR Gate`,
          sku: `DD-HINGE-BARR-${gateHeight}-${gateWidth}`,
        });
        
        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm BARR Gate`,
          sku: `DD-LATCH-BARR-${gateHeight}-${gateWidth}`,
        });
      }
      
      return; // Skip glass/channel logic for BARR
    }
    // Tubular Flat Top has its own component generation logic
    else if (isTubularFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const tubularHeight = span.tubularHeight || "1200mm";
      const tubularFinish = span.tubularFinish || "black";
      const tubularPanelWidth = span.tubularPanelWidth || "2400mm";
      const tubularPostType = span.tubularPostType || "welded-base-plate";
      
      // Tubular Panel specifications
      const panelWidths = {
        "2400mm": 2400,
        "2450mm": 2450,
        "3000mm": 3000,
      };
      const standardWidth = panelWidths[tubularPanelWidth];
      
      // Finish details
      const finishNames = {
        "black": "Black",
        "white": "White",
        "monument": "Monument Grey",
      };
      const finishName = finishNames[tubularFinish];
      const finishSku = tubularFinish.toUpperCase();
      
      // Add panels from layout
      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth, index) => {
        const panelType = panelTypes[index] || "standard";
        
        if (panelType === "gate") {
          // Tubular gate panel
          components.push({
            qty: 1,
            description: `Tubular Flat Top Gate Panel ${tubularHeight} x ${panelWidth}mm (${finishName})`,
            sku: `TUBULAR-GATE-${tubularHeight}-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === standardWidth) {
          // Full standard Tubular panel
          components.push({
            qty: 1,
            description: `Tubular Flat Top Panel ${tubularHeight} x ${standardWidth}mm (${finishName})`,
            sku: `TUBULAR-${tubularHeight}-${standardWidth}-${finishSku}`,
          });
        } else {
          // Cut Tubular panel
          components.push({
            qty: 1,
            description: `Tubular Flat Top Panel ${tubularHeight} x ${panelWidth}mm (Cut from ${standardWidth}mm, ${finishName})`,
            sku: `TUBULAR-CUT-${tubularHeight}-${panelWidth}-${finishSku}`,
          });
        }
      });
      
      // Add posts from gaps array (each gap represents a post)
      const numPosts = span.panelLayout.gaps.length;
      if (tubularPostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `Tubular Welded Base Plate Post 1280mm (${finishName})`,
          sku: `TUBULAR-POST-WBP-1280-${finishSku}`,
        });
      } else {
        // Standard posts - assume 1800mm for 900mm height, 1800mm for 1200mm height
        const postLength = tubularHeight === "900mm" ? 1800 : 1800;
        components.push({
          qty: numPosts,
          description: `Tubular Standard Post ${postLength}mm (${finishName})`,
          sku: `TUBULAR-POST-STD-${postLength}-${finishSku}`,
        });
      }
      
      // Gate hardware for Tubular
      if (gatesAllowed && span.gateConfig?.required) {
        // Tubular gates use D&D hardware
        const gateHeight = tubularHeight === "1200mm" ? 1200 : 900;
        const gateWidth = span.gateConfig.gateSize || 975;
        
        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm Tubular Gate`,
          sku: `DD-HINGE-TUBULAR-${gateHeight}-${gateWidth}`,
        });
        
        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm Tubular Gate`,
          sku: `DD-LATCH-TUBULAR-${gateHeight}-${gateWidth}`,
        });
      }
      
      return; // Skip glass/channel logic for Tubular
    }
    
    // Glass and other fencing types
    // Use calculated panel layout with fallback
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      const panels = span.panelLayout.panels;
      const panelTypes = span.panelLayout.panelTypes || [];
      
      // Process each panel individually
      panels.forEach((panelWidth, index) => {
        const panelType = panelTypes[index] || "standard";
        
        if (panelType === "standard") {
          // Try to lookup product from slot mappings first
          const mappedProduct = lookupProductFromSlot(panelWidth, "glass-panels");
          
          if (mappedProduct) {
            // Use actual product from slot mapping
            components.push({
              qty: 1,
              description: mappedProduct.description,
              sku: mappedProduct.sku,
            });
          } else {
            // Fallback to generated SKU
            components.push({
              qty: 1,
              description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
              sku: `GP-${panelWidth}-1200-12`,
            });
          }
        } else if (panelType === "raked") {
          // Determine if left or right raked
          const isLeftRaked = index === 0 && span.leftRakedPanel?.enabled;
          const height = isLeftRaked ? span.leftRakedPanel?.height : span.rightRakedPanel?.height;
          
          if (isLeftRaked) {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (400mm horizontal at ${height}mm, steps down to 1200mm) 12mm thick`,
              sku: `RP-L-1200-${height}-12`,
            });
          } else {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (steps down from 1200mm to ${height}mm over 800mm, horizontal 400mm) 12mm thick`,
              sku: `RP-R-1200-${height}-12`,
            });
          }
        } else if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Gate Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-GATE-${panelWidth}-1200-12`,
          });
        } else if (panelType === "custom") {
          // Custom panel with user-specified dimensions
          const customHeight = span.customPanel?.height || 1200;
          components.push({
            qty: 1,
            description: `Custom Glass Panel ${panelWidth}mm x ${customHeight}mm (12mm thick)`,
            sku: `GP-CUSTOM-${panelWidth}-${customHeight}-12`,
          });
        } else if (panelType === "hinge") {
          components.push({
            qty: 1,
            description: `Hinge Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-HINGE-${panelWidth}-1200-12`,
          });
        }
        
        // Add hardware per panel - either spigots OR channel clamps
        if (!isChannelSystem) {
          // Spigot system: Add 2 spigots per panel
          const spigotDetails = getSpigotDetails(
            span.spigotMounting || "base-plate",
            span.spigotColor || "polished"
          );
          components.push({
            qty: 2,
            description: spigotDetails.description,
            sku: spigotDetails.sku,
          });
        }
      });

      // Channel system hardware (per span)
      if (isChannelSystem) {
        const spanLength = span.length;
        const channelLength = 4200; // Versatilt channel is 4200mm
        
        // Calculate number of channels needed
        const numChannels = Math.ceil(spanLength / channelLength);
        const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";
        
        components.push({
          qty: numChannels,
          description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
          sku: `VC-4200-${span.channelMounting || "ground"}`,
        });
        
        // Calculate friction clamps (one every 300mm + extras for ends)
        const numClamps = Math.ceil(spanLength / 300) + 2;
        components.push({
          qty: numClamps,
          description: `Channel Friction Clamp (300mm spacing)`,
          sku: `CFC-300`,
        });
        
        // End caps (2 per span)
        components.push({
          qty: 2,
          description: `Channel End Cap`,
          sku: `CEC-STD`,
        });
      }

      // Gate hardware components (hinge set and latch) - only for gate-capable products
      if (gatesAllowed && span.gateConfig?.required) {
        const hingeType = span.gateConfig.hingeType || "glass-to-glass";
        const latchType = span.gateConfig.latchType || "glass-to-glass";
        const hardware = span.gateConfig.hardware || "polaris";
        const hingeDetails = getHingeDetails(hingeType, hardware);
        const latchDetails = getLatchDetails(latchType);
        
        // Hinge set
        components.push({
          qty: 1,
          description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
        });
        
        // Latch
        components.push({
          qty: 1,
          description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
        });
        
        // Post adapter plate (Polaris/Atlantic only)
        if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
          components.push({
            qty: 1,
            description: `Polaris/Atlantic Post Adapter Plate`,
            sku: `PAP-POLARIS`,
          });
        }
      }
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const effectiveLength = span.length;
      const fallbackPanelWidth = span.maxPanelWidth;
      const fallbackGapSize = span.desiredGap;
      const numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));
      
      if (numPanels > 0) {
        // Add fallback panels
        components.push({
          qty: numPanels,
          description: `Glass Panel ${fallbackPanelWidth}mm x 1200mm (12mm thick) [provisional]`,
          sku: `GP-${fallbackPanelWidth}-1200-12`,
        });
        
        // Add hardware - either spigots OR channel system
        if (!isChannelSystem) {
          // Add 2 spigots per panel
          const spigotDetails = getSpigotDetails(
            span.spigotMounting || "base-plate",
            span.spigotColor || "polished"
          );
          components.push({
            qty: numPanels * 2,
            description: spigotDetails.description,
            sku: spigotDetails.sku,
          });
        } else {
          // Channel system hardware
          const spanLength = span.length;
          const channelLength = 4200;
          const numChannels = Math.ceil(spanLength / channelLength);
          const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";
          
          components.push({
            qty: numChannels,
            description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
            sku: `VC-4200-${span.channelMounting || "ground"}`,
          });
          
          const numClamps = Math.ceil(spanLength / 300) + 2;
          components.push({
            qty: numClamps,
            description: `Channel Friction Clamp (300mm spacing)`,
            sku: `CFC-300`,
          });
          
          components.push({
            qty: 2,
            description: `Channel End Cap`,
            sku: `CEC-STD`,
          });
        }
        
        // Gate hardware if configured - only for gate-capable products
        if (gatesAllowed && span.gateConfig?.required) {
          const hingeType = span.gateConfig.hingeType || "glass-to-glass";
          const latchType = span.gateConfig.latchType || "glass-to-glass";
          const hardware = span.gateConfig.hardware || "polaris";
          const hingeDetails = getHingeDetails(hingeType, hardware);
          const latchDetails = getLatchDetails(latchType);
          
          components.push({
            qty: 1,
            description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
          });
          
          components.push({
            qty: 1,
            description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
          });
          
          // Post adapter plate (Polaris/Atlantic only)
          if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
            components.push({
              qty: 1,
              description: `Polaris/Atlantic Post Adapter Plate`,
              sku: `PAP-POLARIS`,
            });
          }
        }
      }
    }
  });

  // Top-mounted rail optimization for glass balustrade variants
  const isGlassBalustrade = design.productVariant === "glass-bal-spigots" || 
                           design.productVariant === "glass-bal-channel" || 
                           design.productVariant === "glass-bal-standoffs";
  
  if (isGlassBalustrade) {
    // Group spans by rail configuration (type, material, finish)
    const railGroups = new Map<string, {
      config: { type: HandrailType; material: HandrailMaterial; finish: HandrailFinish };
      spans: { length: number; startTermination: RailTerminationType; endTermination: RailTerminationType }[];
    }>();
    
    design.spans.forEach((span) => {
      if (span.handrail?.enabled) {
        const configKey = `${span.handrail.type}-${span.handrail.material}-${span.handrail.finish}`;
        
        if (!railGroups.has(configKey)) {
          railGroups.set(configKey, {
            config: {
              type: span.handrail.type,
              material: span.handrail.material,
              finish: span.handrail.finish,
            },
            spans: [],
          });
        }
        
        // Calculate actual rail length from panel layout (most accurate)
        let actualRailLength: number;
        
        if (span.panelLayout && span.panelLayout.panels.length > 0) {
          // Use sum of panel widths from layout (includes internal gaps in total span)
          actualRailLength = span.panelLayout.totalPanelWidth;
        } else {
          // Fallback: span length minus end gaps
          const leftGapSize = span.leftGap?.enabled ? span.leftGap.size : 0;
          const rightGapSize = span.rightGap?.enabled ? span.rightGap.size : 0;
          actualRailLength = span.length - leftGapSize - rightGapSize;
        }
        
        // Guard against invalid lengths
        if (actualRailLength <= 0) {
          console.warn(`Invalid rail length calculated for span ${span.spanId}: ${actualRailLength}mm`);
          return; // Skip this span
        }
        
        railGroups.get(configKey)!.spans.push({
          length: actualRailLength,
          startTermination: span.handrail.startTermination || "end-cap",
          endTermination: span.handrail.endTermination || "end-cap",
        });
      }
    });
    
    // For each rail configuration, optimize and add components
    railGroups.forEach((group) => {
      const spanLengths = group.spans.map(s => s.length);
      const optimization = optimizeRailLengths(spanLengths);
      
      // Rail type names
      const railTypeNames = {
        "nonorail-25x21": "25×21mm NonoRail",
        "nanorail-30x21": "30×21mm NanoRail",
        "series-35x35": "35×35mm Series 35",
      };
      
      const materialNames = {
        "stainless-steel": "Stainless Steel",
        "anodised-aluminium": "Anodised Aluminium",
      };
      
      const finishNames = {
        "polished": "Polished",
        "satin": "Satin",
        "black": "Black",
        "white": "White",
      };
      
      const railTypeName = railTypeNames[group.config.type];
      const materialName = materialNames[group.config.material];
      const finishName = finishNames[group.config.finish];
      
      // Add optimized rail lengths
      if (optimization.standardLengths > 0) {
        components.push({
          qty: optimization.standardLengths,
          description: `Top Rail ${railTypeName} 5800mm (${materialName}, ${finishName})`,
          sku: `RAIL-${group.config.type.toUpperCase()}-5800-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
        });
        
        // Add optimization details as a note
        if (optimization.wastage > 0) {
          components.push({
            qty: 1,
            description: `Rail Optimization: ${optimization.totalLength}mm total required, ${optimization.wastage}mm wastage from ${optimization.standardLengths} × 5800mm lengths`,
            sku: `RAIL-OPT-NOTE`,
          });
        }
      }
      
      // Add terminations (count all start and end terminations)
      const terminationCounts = new Map<string, number>();
      
      group.spans.forEach((span) => {
        terminationCounts.set(span.startTermination, (terminationCounts.get(span.startTermination) || 0) + 1);
        terminationCounts.set(span.endTermination, (terminationCounts.get(span.endTermination) || 0) + 1);
      });
      
      const terminationNames = {
        "end-cap": "End Cap",
        "wall-tie": "Wall Tie",
        "90-degree": "90° Corner",
        "adjustable-corner": "Adjustable Corner",
      };
      
      terminationCounts.forEach((count, termination) => {
        if (count > 0) {
          const terminationName = terminationNames[termination as RailTerminationType];
          components.push({
            qty: count,
            description: `${railTypeName} ${terminationName} (${materialName}, ${finishName})`,
            sku: `RAIL-${group.config.type.toUpperCase()}-${termination.toUpperCase()}-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
          });
        }
      });
    });
  }

  // Consolidate duplicate components
  const consolidated: Component[] = [];
  components.forEach((comp) => {
    const existing = consolidated.find((c) => c.description === comp.description);
    if (existing) {
      existing.qty += comp.qty;
    } else {
      consolidated.push({ ...comp });
    }
  });

  // Sort components: glass panels (largest to smallest), then spigots, posts, hinges, latches, other hardware
  const sorted = consolidated.sort((a, b) => {
    // Helper function to extract panel width from description
    const extractPanelWidth = (desc: string): number => {
      const match = desc.match(/(\d+)mm/);
      return match ? parseInt(match[1]) : 0;
    };

    // Helper function to determine component category
    const getCategory = (desc: string): number => {
      if (desc.includes('Glass Panel') || desc.includes('Raked Glass Panel') || 
          desc.includes('Gate Panel') || desc.includes('Hinge Panel') || desc.includes('Custom Glass Panel')) {
        return 1; // Glass panels
      }
      if (desc.includes('BARR Panel') || desc.includes('BARR Gate Panel')) {
        return 1; // BARR panels (treated like glass panels for sorting)
      }
      if (desc.includes('Spigot')) return 2;
      if (desc.includes('Channel')) return 3; // Channel system components
      if (desc.includes('Post')) return 4;
      if (desc.includes('Hinge Set') || desc.includes('D&D Hinge')) return 5;
      if (desc.includes('Latch') || desc.includes('D&D Latch')) return 6;
      return 7; // Other hardware/accessories
    };

    const categoryA = getCategory(a.description);
    const categoryB = getCategory(b.description);

    // Sort by category first
    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }

    // Within glass panels category, sort by width (largest to smallest)
    if (categoryA === 1) {
      const widthA = extractPanelWidth(a.description);
      const widthB = extractPanelWidth(b.description);
      return widthB - widthA; // Descending order (largest first)
    }

    // For other categories, maintain order
    return 0;
  });

  return sorted;
}

function generateComponentCSV(components: Component[], design: FenceDesign): string {
  const lines: string[] = [];
  
  // Add panel layout section for each span
  lines.push("PANEL LAYOUT");
  lines.push("Section,Panel #,Width (mm),Type,Gap After (mm)");
  
  design.spans.forEach((span, spanIndex) => {
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      span.panelLayout.panels.forEach((panelWidth, panelIndex) => {
        const panelType = span.panelLayout?.panelTypes?.[panelIndex] || "standard";
        const gapAfter = span.panelLayout?.gaps[panelIndex] || 0;
        const sectionName = span.spanId || `${spanIndex + 1}`;
        lines.push(`"${sectionName}",${panelIndex + 1},${panelWidth},"${panelType}",${gapAfter}`);
      });
    }
  });
  
  // Add blank line separator
  lines.push("");
  
  // Add component list section
  lines.push("COMPONENT LIST");
  lines.push("QTY,Description,SKU");
  components.forEach((comp) => {
    lines.push(`${comp.qty},"${comp.description}","${comp.sku || ""}"`);
  });
  
  return lines.join("\n");
}
