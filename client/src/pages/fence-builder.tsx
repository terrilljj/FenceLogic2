import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FenceShapeSelector } from "@/components/fence-shape-selector";
import { SpanConfigPanel } from "@/components/span-config-panel";
import { FenceVisualization } from "@/components/fence-visualization";
import { ComponentList } from "@/components/component-list";
import { AppHeader } from "@/components/app-header";
import { useToast } from "@/hooks/use-toast";
import { FenceDesign, FenceShape, SpanConfig, Component, SavedFenceDesign } from "@shared/schema";
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
import { Loader2 } from "lucide-react";

export default function FenceBuilder() {
  const { toast } = useToast();
  const [activeSpanId, setActiveSpanId] = useState<string | undefined>();
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const [design, setDesign] = useState<FenceDesign>({
    name: "Untitled Design",
    shape: "inline",
    customSides: 3,
    spans: [
      {
        spanId: "A",
        length: 5000,
        maxPanelWidth: 2000,
        desiredGap: 50,
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

  // Save design mutation
  const saveDesignMutation = useMutation({
    mutationFn: async (designToSave: FenceDesign) => {
      const response = await apiRequest("POST", "/api/designs", {
        name: designToSave.name,
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

  const handleSave = () => {
    saveDesignMutation.mutate(design);
  };

  const handleLoad = () => {
    setShowLoadDialog(true);
  };

  const handleLoadDesign = (savedDesign: SavedFenceDesign) => {
    setDesign({
      name: savedDesign.name,
      shape: savedDesign.shape as FenceShape,
      customSides: savedDesign.customSides || 3,
      spans: savedDesign.spans as SpanConfig[],
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
      shape: "inline",
      customSides: 3,
      spans: [
        {
          spanId: "A",
          length: 5000,
          maxPanelWidth: 2000,
          desiredGap: 50,
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
    const csvContent = generateComponentCSV(components);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "component-list.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "List Downloaded",
      description: "Component list has been downloaded as CSV.",
    });
  };

  const components = useMemo(() => {
    return calculateComponents(design);
  }, [design]);

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
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] overflow-hidden">
        {/* 3D Visualization */}
        <div className="relative h-full min-h-[400px] lg:min-h-0">
          <FenceVisualization design={design} activeSpanId={activeSpanId} />
        </div>

        {/* Controls Panel */}
        <div className="h-full overflow-y-auto bg-card border-l border-card-border">
          <div className="p-6 space-y-6">
            {/* Shape Selector */}
            <FenceShapeSelector
              selected={design.shape}
              customSides={design.customSides}
              onShapeChange={handleShapeChange}
              onCustomSidesChange={handleCustomSidesChange}
            />

            {/* Span Configuration */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Span Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  Configure each span of your fence
                </p>
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
                    showTopGap={design.shape === "u-shape" && index === 0}
                    showBottomGap={design.shape === "u-shape" && index === 0}
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
    </div>
  );
}

function getSpansForShape(shape: FenceShape, customSides?: number): SpanConfig[] {
  const defaultSpan: Omit<SpanConfig, "spanId"> = {
    length: 5000,
    maxPanelWidth: 2000,
    desiredGap: 50,
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

function calculateComponents(design: FenceDesign): Component[] {
  const components: Component[] = [];

  design.spans.forEach((span) => {
    // Use calculated panel layout with fallback
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      const panels = span.panelLayout.panels;
      const panelTypes = span.panelLayout.panelTypes || [];
      
      // Process each panel individually
      panels.forEach((panelWidth, index) => {
        const panelType = panelTypes[index] || "standard";
        
        if (panelType === "standard") {
          components.push({
            qty: 1,
            description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-${panelWidth}-1200-12`,
          });
        } else if (panelType === "raked") {
          // Determine if left or right raked
          const isLeftRaked = index === 0 && span.leftRakedPanel?.enabled;
          const height = isLeftRaked ? span.leftRakedPanel?.height : span.rightRakedPanel?.height;
          
          if (isLeftRaked) {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (400mm horizontal at ${height}mm, slopes to 1200mm) 12mm thick`,
              sku: `RP-L-1200-${height}-12`,
            });
          } else {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (slopes from 1200mm to ${height}mm over 800mm, horizontal 400mm) 12mm thick`,
              sku: `RP-R-1200-${height}-12`,
            });
          }
        } else if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Gate Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-GATE-${panelWidth}-1200-12`,
          });
        } else if (panelType === "hinge") {
          components.push({
            qty: 1,
            description: `Hinge Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-HINGE-${panelWidth}-1200-12`,
          });
        }
        
        // Add 2 spigots per panel
        components.push({
          qty: 2,
          description: "Spigot (stainless steel base mount)",
          sku: "SPIGOT-SS",
        });
      });

      // Gate hardware components (hinge set and latch)
      if (span.gateConfig?.required) {
        const hardware = span.gateConfig.hardware === "polaris" ? "Polaris Soft Close" : "Master Range";
        const isGlassToGlass = span.gateConfig.hingeFrom === "glass";
        
        // Hinge set
        components.push({
          qty: 1,
          description: `${hardware} Hinge Set (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `GH-HINGE-${span.gateConfig.hardware.toUpperCase()}-${span.gateConfig.gateSize}`,
        });
        
        // Latch
        components.push({
          qty: 1,
          description: `${hardware} Gate Latch (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `GH-LATCH-${span.gateConfig.hardware.toUpperCase()}-${span.gateConfig.gateSize}`,
        });
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
        
        // Add 2 spigots per panel
        components.push({
          qty: numPanels * 2,
          description: "Spigot (stainless steel base mount)",
          sku: "SPIGOT-SS",
        });
        
        // Gate hardware if configured
        if (span.gateConfig?.required) {
          const hardware = span.gateConfig.hardware === "polaris" ? "Polaris Soft Close" : "Master Range";
          
          components.push({
            qty: 1,
            description: `${hardware} Hinge Set (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `GH-HINGE-${span.gateConfig.hardware.toUpperCase()}-${span.gateConfig.gateSize}`,
          });
          
          components.push({
            qty: 1,
            description: `${hardware} Gate Latch (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `GH-LATCH-${span.gateConfig.hardware.toUpperCase()}-${span.gateConfig.gateSize}`,
          });
        }
      }
    }
  });

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

  return consolidated;
}

function generateComponentCSV(components: Component[]): string {
  const headers = ["QTY", "Description", "SKU"];
  const rows = components.map((comp) => [comp.qty, comp.description, comp.sku || ""]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
