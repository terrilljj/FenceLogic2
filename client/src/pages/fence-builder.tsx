import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SpanConfigPanel } from "@/components/span-config-panel";
import { FenceVisualization } from "@/components/fence-visualization";
import { ComponentList } from "@/components/component-list";
import { AppHeader } from "@/components/app-header";
import { ProductSelector } from "@/components/product-selector";
import { SectionSwitcher } from "@/components/configure-blocks/section-switcher";
import { WizardStepper, type WizardStep } from "@/components/configure-blocks/wizard/wizard-stepper";
import { TipsPanel } from "@/components/configure-blocks/wizard/tips-panel";
import { STEP1_MEASURE_TIPS, STEP1_FOOTNOTE, STEP3_REVIEW_TIPS, step2Tips } from "@/components/configure-blocks/wizard/joe-tips";
import { StepStyleMeasure } from "@/components/configure-blocks/wizard/step-style-measure";
import { StepReview } from "@/components/configure-blocks/wizard/step-review";
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

const PRODUCT_VARIANT_LABELS: Record<string, string> = {
  "glass-pool-spigots": "Glass Pool Fencing — Frameless with Spigots",
  "glass-pool-channel": "Glass Pool Fencing — Channel",
  "glass-bal-spigots": "Glass Balustrade — Frameless with Spigots",
  "glass-bal-spigots-12mm": "Glass Balustrade — Spigots (12mm)",
  "glass-bal-spigots-15mm": "Glass Balustrade — Spigots (15mm)",
  "glass-bal-channel": "Glass Balustrade — Channel",
  "glass-bal-standoffs": "Glass Balustrade — Standoffs",
  "alu-pool-tubular": "Aluminium Pool Fencing — Tubular Flat Top",
  "alu-pool-barr": "Aluminium Pool Fencing — BARR",
  "alu-pool-blade": "Aluminium Pool Fencing — Blade",
  "alu-pool-pik": "Aluminium Pool Fencing — PIK",
  "alu-bal-barr": "Aluminium Balustrade — Barr",
  "alu-bal-blade": "Aluminium Balustrade — Blade",
  "alu-bal-visor": "Aluminium Balustrade — Visor",
  "pvc-privacy": "PVC Fencing",
  "general-zeus": "General Fencing — Zeus",
  "general-blade": "General Fencing — Blade",
  "general-barr": "General Fencing — Barr",
};

function productVariantLabel(variant: string): string {
  return PRODUCT_VARIANT_LABELS[variant] || variant.replace(/-/g, " ");
}

// Page-level fence shapes — compact selector options (mirrors FenceShapeSelector labels)
const SHAPE_OPTIONS: { id: FenceShape; label: string }[] = [
  { id: "inline", label: "1 Section (Straight)" },
  { id: "l-shape", label: "2 Sections (L-Shape)" },
  { id: "u-shape", label: "3 Sections (U-Shape)" },
  { id: "enclosed", label: "4 Sections (Enclosed)" },
  { id: "custom", label: "5+ Sections (Custom)" },
];

// Oxworks-style 4-step wizard (glass-pool-spigots).
const WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: "Style & Measure", subtitle: "Shape, finish & lengths" },
  { id: 2, title: "Configure", subtitle: "Each section" },
  { id: 3, title: "Review", subtitle: "Component list" },
];

export default function FenceLogic() {
  const { toast } = useToast();
  const [activeSpanId, setActiveSpanId] = useState<string | undefined>();
  // Oxworks-style side switcher: which section's accordion is shown (glass-pool-spigots).
  const [selectedSpanId, setSelectedSpanId] = useState<string>("A");
  const prevSpanCount = useRef(1);
  // Set true right before an explicit "Add Section" so the new one is auto-selected.
  const pendingSelectLast = useRef(false);
  // Oxworks-style 4-step wizard: current step (glass-pool-spigots only).
  const [currentStep, setCurrentStep] = useState<number>(1);
  // Desktop (lg+) config scroller — the ONE scrolling region in the locked app shell.
  // Mobile has no inner scroller (the document scrolls), so this ref is inert there.
  const configScrollRef = useRef<HTMLDivElement>(null);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showProductMockup, setShowProductMockup] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [downloadPDFHandler, setDownloadPDFHandler] = useState<(() => void) | null>(null);
  // MUST be a stable identity. An inline arrow here re-triggers FenceVisualization's
  // registration effect every render, whose setState re-renders this page, looping
  // forever (~85 full canvas redraws/sec) and killing scroll performance.
  const handleDownloadPDFReady = useCallback((handler: () => void) => {
    setDownloadPDFHandler(() => handler);
  }, []);

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
        maxPanelWidth: 1800, // Default max panel (matches added sections); config may override
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
    if (urlVariant) return;
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

  // Debounce the design used for the server quote. Without this, /api/quote fires on
  // every keystroke / slider drag / layout recompute and quickly trips the server
  // rate limiter (max 30/hr), which blanks the BOM. Settle for 500ms before quoting.
  const [debouncedDesign, setDebouncedDesign] = useState(design);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDesign(design), 500);
    return () => clearTimeout(t);
  }, [design]);

  // Fetch BOM components from server-side quote endpoint
  const { data: quoteData } = useQuery<{ components: Array<{ qty: number; description: string }> }>({
    queryKey: ["/api/quote", debouncedDesign],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/quote", { design: debouncedDesign });
      return response.json();
    },
    enabled: debouncedDesign.spans.length > 0 && debouncedDesign.spans.some(s => s.length > 0),
    // Keep the last good BOM visible during refetches / transient errors instead of blanking.
    placeholderData: (prev) => prev,
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
      // PRESERVE existing sections; only add/trim to match the new shape's count.
      const newSpans = resizeSpans(prev.spans, shapeToCount(shape, prev.customSides), defaultMaxPanel);
      return { ...prev, shape, spans: newSpans };
    });
  }, [calculatorConfig]);

  const handleCustomSidesChange = useCallback((customSides: number) => {
    setDesign((prev) => {
      const defaultMaxPanel = calculatorConfig?.fields?.maxPanelMm?.defaultValue || 1800;
      const newSpans = resizeSpans(prev.spans, shapeToCount("custom", customSides), defaultMaxPanel);
      return { ...prev, customSides, spans: newSpans };
    });
  }, [calculatorConfig]);

  // Step 1 "Add section": append one section, PRESERVING the rest, and keep the
  // shape/customSides in sync so the shape selector reflects the new count.
  const handleAddSectionStep1 = useCallback(() => {
    setDesign((prev) => {
      if (prev.spans.length >= 10) return prev;
      const defaultMaxPanel = calculatorConfig?.fields?.maxPanelMm?.defaultValue || 1800;
      const targetCount = prev.spans.length + 1;
      const spans = resizeSpans(prev.spans, targetCount, defaultMaxPanel);
      return { ...prev, spans, shape: countToShape(targetCount), customSides: Math.max(prev.customSides ?? 0, targetCount) };
    });
  }, [calculatorConfig]);

  // Delete a section (keeps at least one). Re-letters the remaining sections so
  // their ids stay contiguous A, B, C…; section names/config travel with them.
  const handleDeleteSection = useCallback((spanId: string) => {
    setDesign((prev) => {
      if (prev.spans.length <= 1) return prev;
      const relettered = prev.spans
        .filter((s) => s.spanId !== spanId)
        .map((s, i) => ({ ...s, spanId: String.fromCharCode(65 + i) }));
      const count = relettered.length;
      return { ...prev, spans: relettered, shape: countToShape(count), customSides: Math.min(10, Math.max(3, count)) };
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

  // Keep the side-switcher selection valid. We do NOT auto-jump to the last
  // section when the count grows (that made Configure open on the last section
  // after a shape change) — only when the user explicitly adds one via the
  // switcher's "Add Section" (pendingSelectLast). Otherwise an invalid selection
  // falls back to the FIRST section.
  useEffect(() => {
    const ids = design.spans.map((s) => s.spanId);
    if (pendingSelectLast.current && ids.length > prevSpanCount.current) {
      setSelectedSpanId(ids[ids.length - 1]);
      pendingSelectLast.current = false;
    } else if (!ids.includes(selectedSpanId)) {
      setSelectedSpanId(ids[0] ?? "A");
    }
    prevSpanCount.current = ids.length;
  }, [design.spans, selectedSpanId]);

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
    setSelectedSpanId("A");
    setCurrentStep(1);
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

  // Landing mid-scroll on a step change reads as "the layout is broken" — always
  // start a step (or a newly selected section) from the top. Desktop scrolls the
  // config panel; mobile scrolls the document — resetting both covers both modes.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    configScrollRef.current?.scrollTo({ top: 0 });
  }, [currentStep, selectedSpanId]);

  const isGlassSpigots = design.productVariant === "glass-pool-spigots";
  // Styles that run inside the Oxworks wizard (same format across them). Adding a
  // style here routes it through the 4-step wizard; its Step-2 config comes from
  // SpanConfigPanel (per-variant accordion).
  const isWizardVariant =
    isGlassSpigots ||
    design.productVariant === "glass-pool-channel" ||
    design.productVariant === "glass-bal-channel" ||
    design.productVariant === "glass-bal-standoffs" ||
    design.productVariant === "alu-pool-blade" ||
    design.productVariant === "alu-pool-barr" ||
    design.productVariant === "alu-pool-tubular" ||
    design.productVariant === "alu-bal-barr" ||
    design.productVariant === "alu-bal-blade" ||
    design.productVariant.startsWith("glass-bal-spigots");
  // Wizard elevation rules (Oxworks): Step 2 (Configure) shows the ACTIVE section
  // only; Step 4 (Review) shows ALL sections (height grows to fit). Steps 1 & 3
  // (Style, Finishing) have no elevation. Other variants are unchanged (300px).
  const activeVizSpan = design.spans.find((s) => s.spanId === selectedSpanId) ?? design.spans[0];
  const showActiveOnly = isWizardVariant && currentStep === 2;
  // Top FIXED elevation strip: other variants always; wizard only on Configure (2).
  // Finishing (3) and Review (4) render their elevation INSIDE the scroll area so a
  // tall, all-sections render scrolls with the page instead of being clipped.
  const showTopElevation = !isWizardVariant || currentStep === 2;
  const reviewVizHeight = Math.max(320, design.spans.length * 360);

  return (
    // HYBRID SCROLL MODEL (operator-approved 2026-06-02, research-backed):
    //  • Desktop (lg+): Tesla-style app shell. The page is LOCKED (h-screen +
    //    overflow-hidden); header/stepper/elevation are fixed; the config region
    //    below the elevation is the single scroller with an always-visible
    //    scrollbar. Exactly one scroll context — not nested scrolling.
    //  • Mobile (<lg): the DOCUMENT scrolls naturally and the elevation is sticky
    //    against the viewport top. Internal scroll boxes are a documented touch
    //    anti-pattern (Baymard "inline scroll areas"), so none exist on mobile.
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background">
      <AppHeader
        progress={progress}
        onSave={handleSave}
        onLoad={handleLoad}
        onReset={handleReset}
        onDownloadPDF={downloadPDFHandler || undefined}
        isSaving={saveDesignMutation.isPending}
        productVariant={design.productVariant}
        showProgress={!isWizardVariant}
        sticky={false}
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

      {/* Wizard step bar — wizard variants (Oxworks model). Scrolls away with the
          header so the pinned elevation + config get the full viewport. */}
      {isWizardVariant && (
        <div className="border-b border-card-border bg-card px-4 py-3">
          <div className="mx-auto w-full max-w-[1600px]">
            <WizardStepper
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              onStepClick={(n) => setCurrentStep(n)}
            />
          </div>
        </div>
      )}

      {/* Frozen elevation.
          Desktop: a fixed flex row in the locked shell (cannot move, ever).
          Mobile: sticky against the viewport top while the document scrolls. */}
      {showTopElevation && (
        <div className="sticky top-0 z-20 lg:static shrink-0 border-b border-card-border bg-background h-[180px] lg:h-[300px] xl:h-[380px]">
          <FenceVisualization
            design={design}
            activeSpanId={isWizardVariant ? (activeSpanId ?? selectedSpanId) : activeSpanId}
            visibleSpanIds={showActiveOnly && activeVizSpan ? [activeVizSpan.spanId] : undefined}
            // Let the drawing fill the strip (width/height bounds still apply) instead
            // of the artificial 0.15 "mini render" cap — kills the dead space around
            // the elevation on wide screens.
            maxScale={0.25}
            onDownloadPDFReady={handleDownloadPDFReady}
          />
        </div>
      )}

      {/* Config region.
          Desktop: THE scroller (always-visible scrollbar; page itself is locked).
          Mobile: flows in the document; the document scrolls. */}
      <div
        ref={configScrollRef}
        className="flex-1 bg-card lg:min-h-0 lg:overflow-y-auto scrollbar-always"
      >
          <div className="mx-auto w-full max-w-[1600px] p-4 space-y-5">
            {isWizardVariant ? (
              <>
                {/* ── Step 1 — Style & Measure ─────────────────────────────── */}
                {currentStep === 1 && (
                  <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
                    <StepStyleMeasure
                      design={design}
                      productLabel={productVariantLabel(design.productVariant)}
                      onChangeProduct={() => setShowProductMockup(true)}
                      onDesignNameChange={(name) => setDesign((prev) => ({ ...prev, name }))}
                      onShapeChange={(shape) => handleShapeChange(shape)}
                      onCustomSidesChange={(sides) => handleCustomSidesChange(sides)}
                      onSpanLengthChange={(spanId, length) => {
                        const s = design.spans.find((x) => x.spanId === spanId);
                        if (s) handleSpanUpdate(spanId, { ...s, length });
                      }}
                      onSpanNameChange={(spanId, name) => {
                        const s = design.spans.find((x) => x.spanId === spanId);
                        if (s) handleSpanUpdate(spanId, { ...s, name });
                      }}
                      onAddSection={handleAddSectionStep1}
                      onDeleteSection={handleDeleteSection}
                    />
                    <TipsPanel tips={STEP1_MEASURE_TIPS} footnote={STEP1_FOOTNOTE} />
                  </div>
                )}

                {/* ── Step 2 — Configure each side ─────────────────────────── */}
                {currentStep === 2 && (() => {
                  const activeSpan = design.spans.find((s) => s.spanId === selectedSpanId) ?? design.spans[0];
                  return (
                    <div className="grid gap-4 lg:grid-cols-[170px_1fr_300px] xl:grid-cols-[200px_1fr_340px] items-start">
                      <SectionSwitcher
                        spans={design.spans.map((s) => ({ spanId: s.spanId, length: s.length, name: s.name }))}
                        activeId={activeSpan.spanId}
                        onSelect={setSelectedSpanId}
                        onAdd={design.spans.length < 10 ? () => { pendingSelectLast.current = true; handleAddSection(); } : undefined}
                        onDelete={handleDeleteSection}
                      />
                      <div
                        onMouseEnter={() => setActiveSpanId(activeSpan.spanId)}
                        onMouseLeave={() => setActiveSpanId(undefined)}
                      >
                        <SpanConfigPanel
                          span={activeSpan}
                          allSpans={design.spans}
                          onUpdate={(updatedSpan) => handleSpanUpdate(activeSpan.spanId, updatedSpan)}
                          productVariant={design.productVariant}
                          calculatorConfig={calculatorConfig}
                          showLeftGap={true}
                          showRightGap={true}
                          showSectionLength={false}
                        />
                      </div>
                      <TipsPanel tips={step2Tips(design.productVariant, activeSpan)} />
                    </div>
                  );
                })()}

                {/* ── Step 3 — Review & Checkout ───────────────────────────── */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    {/* Full all-sections elevation, in-scroll so tall designs scroll */}
                    <div className="relative overflow-hidden rounded-md border border-card-border" style={{ height: reviewVizHeight }}>
                      <FenceVisualization
                        design={design}
                        activeSpanId={activeSpanId ?? selectedSpanId}
                        onDownloadPDFReady={handleDownloadPDFReady}
                      />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
                      <StepReview
                        components={components}
                        onEmail={handleEmailQuote}
                        onDownload={handleDownloadList}
                      />
                      <TipsPanel title="Before you order" tips={STEP3_REVIEW_TIPS} />
                    </div>
                  </div>
                )}

                {/* Wizard footer — Back / Next */}
                <div className="flex items-center justify-between gap-3 border-t border-card-border pt-4">
                  <Button
                    variant="outline"
                    disabled={currentStep === 1}
                    onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                    data-testid="wizard-back"
                  >
                    Back
                  </Button>
                  {currentStep < 3 ? (
                    <Button onClick={() => setCurrentStep((s) => Math.min(3, s + 1))} data-testid="wizard-next">
                      Next: {WIZARD_STEPS[currentStep]?.title}
                    </Button>
                  ) : (
                    <Button onClick={handleEmailQuote} data-testid="wizard-finish">
                      Email my plan
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* ===== Other variants: existing single-page UI (unchanged behaviour) ===== */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${design.spans.length === 1 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
                  {/* Design Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="design-name" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Design Name</Label>
                    <Input
                      id="design-name"
                      value={design.name}
                      onChange={(e) => setDesign(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter design name"
                      className="h-9 font-semibold"
                      data-testid="input-design-name"
                    />
                  </div>

                  {/* Section Length — single-section designs only */}
                  {design.spans.length === 1 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="section-length" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Section Length</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          id="section-length"
                          type="number"
                          value={design.spans[0].length}
                          onChange={(e) => {
                            const length = parseInt(e.target.value) || 0;
                            const s = design.spans[0];
                            handleSpanUpdate(s.spanId, { ...s, length });
                          }}
                          min={0}
                          max={30000}
                          step={100}
                          className="h-9"
                          data-testid="meta-section-length"
                        />
                        <span className="text-xs text-muted-foreground">mm</span>
                      </div>
                    </div>
                  )}

                  {/* Product Type — compact, opens selector dialog */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Product Type</Label>
                    <button
                      type="button"
                      onClick={() => setShowProductMockup(true)}
                      className="w-full h-9 flex items-center justify-between gap-2 px-3 rounded-md border border-primary/20 bg-primary/10 text-sm font-medium hover-elevate active-elevate-2"
                      data-testid="button-change-product"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="truncate">{productVariantLabel(design.productVariant)}</span>
                      </span>
                      <span className="text-xs text-primary flex-shrink-0">Change</span>
                    </button>
                  </div>

                  {/* Fence Shape — compact selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fence Shape</Label>
                    <Select value={design.shape} onValueChange={(v) => handleShapeChange(v as FenceShape)}>
                      <SelectTrigger className="h-9 text-sm" data-testid="select-fence-shape">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHAPE_OPTIONS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {design.shape === "custom" && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label htmlFor="custom-sides" className="text-xs text-muted-foreground whitespace-nowrap">Sides (3–10)</Label>
                        <Input
                          id="custom-sides"
                          type="number"
                          min={3}
                          max={10}
                          value={design.customSides}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value >= 3 && value <= 10) handleCustomSidesChange(value);
                          }}
                          className="h-8 w-20 font-mono"
                          data-testid="input-custom-sides"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Section Configuration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Section Configuration</h2>
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
                        allSpans={design.spans}
                        onUpdate={(updatedSpan) => handleSpanUpdate(span.spanId, updatedSpan)}
                        productVariant={design.productVariant}
                        calculatorConfig={calculatorConfig}
                        showLeftGap={true}
                        showRightGap={true}
                        showSectionLength={design.spans.length > 1}
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
              </>
            )}
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
              const ptsMax = ptsMaxPanelFor(variant);
              setDesign((prev) => ({
                ...prev,
                productType: type,
                productVariant: variant,
                // Default max panel to the style's PTS spec (not the generic 1800).
                spans: ptsMax ? prev.spans.map((s) => ({ ...s, maxPanelWidth: ptsMax })) : prev.spans,
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

// PTS-derived max panel width per style (overrides the generic 1800 default).
// glass-bal-spigots: 12mm → 1500mm, 15mm → 1400mm (PTS-002/PTS-007 max span).
// glass-bal-channel: 15mm → 1400mm (PTS-003 VersaTilt max span).
// glass-bal-standoffs: 15mm → 1200mm (PTS-006 point-fix glass range 400–1200mm).
function ptsMaxPanelFor(variant: string): number | undefined {
  if (variant === "glass-bal-spigots-15mm") return 1400;
  if (variant === "glass-bal-spigots-12mm" || variant === "glass-bal-spigots") return 1500;
  if (variant === "glass-bal-channel") return 1400;
  if (variant === "glass-bal-standoffs") return 1200;
  return undefined;
}

function createDefaultSpan(spanId: string, defaultMaxPanel = 1800): SpanConfig {
  return {
    spanId,
    length: 5000,
    maxPanelWidth: defaultMaxPanel,
    desiredGap: 50,
    spigotMounting: "base-plate",
    spigotColor: "polished",
    layoutMode: "auto-equalize",
    leftGap: { enabled: true, position: "inside", size: 25 },
    rightGap: { enabled: true, position: "inside", size: 25 },
  };
}

// How many sections a shape implies.
function shapeToCount(shape: FenceShape, customSides?: number): number {
  switch (shape) {
    case "inline": return 1;
    case "l-shape": return 2;
    case "u-shape": return 3;
    case "enclosed": return 4;
    case "custom": return Math.max(1, customSides || 3);
    default: return 1;
  }
}

// The shape that matches a given section count (≤4 named; otherwise custom).
function countToShape(count: number): FenceShape {
  if (count <= 1) return "inline";
  if (count === 2) return "l-shape";
  if (count === 3) return "u-shape";
  if (count === 4) return "enclosed";
  return "custom";
}

// Resize a span list to targetCount, PRESERVING existing sections (only append
// new defaults or trim the tail). This is what stops a shape/sides change from
// wiping sections the user already configured.
function resizeSpans(existing: SpanConfig[], targetCount: number, defaultMaxPanel = 1800): SpanConfig[] {
  if (targetCount <= existing.length) return existing.slice(0, Math.max(1, targetCount));
  const result = [...existing];
  for (let i = existing.length; i < targetCount; i++) {
    result.push(createDefaultSpan(String.fromCharCode(65 + i), defaultMaxPanel));
  }
  return result;
}

function getSpansForShape(shape: FenceShape, customSides?: number, defaultMaxPanel = 1800): SpanConfig[] {
  return resizeSpans([], shapeToCount(shape, customSides), defaultMaxPanel);
}

