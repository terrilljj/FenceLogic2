import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FenceShapeSelector } from "@/components/fence-shape-selector";
import { SpanConfigPanel } from "@/components/span-config-panel";
import { FenceVisualization } from "@/components/fence-visualization";
import { ComponentList } from "@/components/component-list";
import { AppHeader } from "@/components/app-header";
import { ProductSelector } from "@/components/product-selector";
import { useToast } from "@/hooks/use-toast";
import { FenceDesign, FenceShape, SpanConfig, SavedFenceDesign, ProductType, ProductVariant } from "@shared/schema";
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
  const [downloadPDFHandler, setDownloadPDFHandler] = useState<(() => void) | null>(null);

  // Get URL params for pre-selecting product
  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type") as ProductType | null;
  const urlVariant = urlParams.get("variant") as ProductVariant | null;

  // Initialize design with defaults (will be updated when calculatorConfig loads)
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
        maxPanelWidth: 1200, // Will be updated from calculator config
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

  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const hasRestoredRef = useRef(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem("bhub-draft-v1");
      if (!raw) return;
      const { design: saved, savedAt } = JSON.parse(raw);
      if (!saved || !savedAt) return;
      const age = Date.now() - savedAt;
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem("bhub-draft-v1");
        return;
      }
      setDesign(saved);
      setShowRestoredBanner(true);
    } catch {
      localStorage.removeItem("bhub-draft-v1");
    }
  }, []);

  // Auto-save draft to localStorage, debounced 800ms
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "bhub-draft-v1",
          JSON.stringify({ design, savedAt: Date.now() })
        );
      } catch { /* quota exceeded — ignore */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [design]);

  // Fetch all saved designs
  const { data: savedDesigns, isLoading: isLoadingDesigns } = useQuery<SavedFenceDesign[]>({
    queryKey: ["/api/designs"],
  });

  // Fetch BOM components from server-side quote endpoint
  const { data: quoteData } = useQuery<{ components: Array<{ qty: number; description: string }> }>({
    queryKey: ["/api/quote", design],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/quote", { design });
      return response.json();
    },
    enabled: design.spans.length > 0 && design.spans.some(s => s.length > 0),
  });

  // Fetch calculator config for current product variant (from fence styles)
  const { data: calculatorConfig } = useQuery({
    queryKey: ["/api/styles", design.productVariant, "calculator-config"],
    queryFn: async () => {
      const response = await fetch(`/api/styles/${design.productVariant}/calculator-config`);
      if (!response.ok) {
        // If config doesn't exist, return null (fallback to defaults)
        if (response.status === 404) return null;
        throw new Error("Failed to fetch calculator config");
      }
      return response.json();
    },
  });

  // Update maxPanelWidth and initialize autoCalcConfig when calculator config loads
  useEffect(() => {
    if (calculatorConfig?.fields?.maxPanelMm?.defaultValue) {
      const defaultMaxPanel = calculatorConfig.fields.maxPanelMm.defaultValue;
      const isSemiFrameless = design.productVariant === "semi-frameless-1000" || design.productVariant === "semi-frameless-1800";
      const isCustomFrameless = design.productVariant === "custom-frameless";
      
      setDesign(prev => ({
        ...prev,
        spans: prev.spans.map(span => ({
          ...span,
          // Only update if still at initial hardcoded value
          maxPanelWidth: span.maxPanelWidth === 1200 ? defaultMaxPanel : span.maxPanelWidth,
          // Initialize autoCalcConfig for semi-frameless and custom-frameless if not already set
          ...(((isSemiFrameless || isCustomFrameless) && !span.autoCalcConfig) ? {
            layoutMode: "auto-calc" as const,
            autoCalcConfig: {
              layoutMode: "auto" as const,
              maxPanelWidth: defaultMaxPanel,
              panelHeight: calculatorConfig.fields?.glassHeight?.defaultValue || 1500,
              glassType: (calculatorConfig.fields?.glassType?.defaultValue || "10mm-clear") as GlassThickness,
              gapMode: "auto" as const,
              interPanelGaps: [calculatorConfig.fields?.betweenGapMm?.defaultValue || 50],
              panelTypes: ["standard", "standard"] as const,
              panelWidthOverrides: undefined,
            }
          } : {}),
        })),
      }));
    }
  }, [calculatorConfig, design.productVariant]);

  // Helper function to get default max panel width from calculator config
  const getDefaultMaxPanelWidth = () => {
    // Get from calculator config field default if available
    if (calculatorConfig?.fields?.maxPanelMm?.defaultValue) {
      return calculatorConfig.fields.maxPanelMm.defaultValue;
    }
    
    // Fallback to 1800 (database default)
    return 1800;
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

  // Email quote mutation — server computes BOM from design
  const emailQuoteMutation = useMutation({
    mutationFn: async ({ email, design }: { email: string; design: FenceDesign }) => {
      const response = await apiRequest("POST", "/api/email-quote", {
        email,
        design,
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
      const defaultMaxPanel = calculatorConfig?.fields?.maxPanelMm?.defaultValue || 1800;
      const newSpans = getSpansForShape(shape, prev.customSides, defaultMaxPanel);
      return { ...prev, shape, spans: newSpans };
    });
  }, [calculatorConfig]);

  const handleCustomSidesChange = useCallback((customSides: number) => {
    setDesign((prev) => {
      const defaultMaxPanel = calculatorConfig?.fields?.maxPanelMm?.defaultValue || 1800;
      const newSpans = getSpansForShape(prev.shape, customSides, defaultMaxPanel);
      return { ...prev, customSides, spans: newSpans };
    });
  }, [calculatorConfig]);

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
        layoutMode: lastSpan?.layoutMode || (
          design.productVariant === "custom-frameless" || 
          design.productVariant === "semi-frameless-1000" || 
          design.productVariant === "semi-frameless-1800" 
            ? "auto-calc" 
            : "auto-equalize"
        ),
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
    localStorage.removeItem("bhub-draft-v1");
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
    const defaultMaxPanel = calculatorConfig?.fields?.maxPanelMm?.defaultValue || 1800;
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
          maxPanelWidth: defaultMaxPanel,
          desiredGap: 50,
          spigotMounting: "base-plate",
          spigotColor: "polished",
          layoutMode: "auto-equalize",
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
    localStorage.removeItem("bhub-draft-v1");
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
    });
  };

  const handleDownloadList = () => {
    const lines: string[] = [];

    // Panel layout section
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

    lines.push("");
    lines.push("COMPONENT LIST");
    lines.push("QTY,Description");
    components.forEach((comp) => {
      lines.push(`${comp.qty},"${comp.description}"`);
    });

    const csvContent = lines.join("\n");
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
    return quoteData?.components ?? [];
  }, [quoteData]);

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
        onDownloadPDF={downloadPDFHandler || undefined}
        isSaving={saveDesignMutation.isPending}
        productVariant={design.productVariant}
      />

      {showRestoredBanner && (
        <div className="flex items-center justify-between bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
          <span>Design restored from your last session.</span>
          <button
            onClick={() => setShowRestoredBanner(false)}
            className="ml-4 text-blue-600 hover:text-blue-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden">
        {/* 3D Visualization */}
        <div className="relative h-full min-h-[400px] lg:min-h-0">
          <FenceVisualization 
            design={design} 
            activeSpanId={activeSpanId} 
            onDownloadPDFReady={setDownloadPDFHandler}
          />
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
                    calculatorConfig={calculatorConfig}
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
              setDesign((prev) => ({
                ...prev,
                productType: type,
                productVariant: variant,
              }));
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

function getSpansForShape(shape: FenceShape, customSides?: number, defaultMaxPanel = 1800): SpanConfig[] {
  const defaultSpan: Omit<SpanConfig, "spanId"> = {
    length: 5000,
    maxPanelWidth: defaultMaxPanel,
    desiredGap: 50,
    spigotMounting: "base-plate",
    spigotColor: "polished",
    layoutMode: "auto-equalize",
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

