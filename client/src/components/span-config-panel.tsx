import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SpanConfig, getGateGaps, ProductVariant } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { GapSlider } from "./gap-slider";
import { NumericInput } from "./numeric-input";
import { GateControls } from "./gate-controls";
import { CustomPanelControls } from "./custom-panel-controls";
import { FullyCustomPanelControls } from "./fully-custom-panel-controls";
import { AutoCalcPanelControls } from "./auto-calc-panel-controls";
import { SemiFramelessPostConfig } from "./semi-frameless-post-config";
import { InfoTooltip } from "./info-tooltip";
import { GlassSpigotsConfig } from "./configure-blocks/glass-spigots-config";
import { GlassBalSpigotsConfig } from "./configure-blocks/glass-bal-spigots-config";
import { GlassBalStandoffsConfig } from "./configure-blocks/glass-bal-standoffs-config";
import { AluPoolBladeConfig } from "./configure-blocks/alu-pool-blade-config";
import { AluPoolBarrConfig } from "./configure-blocks/alu-pool-barr-config";
import { AluPoolTubularConfig } from "./configure-blocks/alu-pool-tubular-config";
import { AluBalConfig } from "./configure-blocks/alu-bal-config";

interface SpanConfigPanelProps {
  span: SpanConfig;
  /** All sections in design order — used for cross-section cut-length optimisation
   *  (channel/handrail offcut reuse chips). */
  allSpans?: SpanConfig[];
  onUpdate: (span: SpanConfig) => void;
  productVariant?: ProductVariant;
  calculatorConfig?: any;
  showLeftGap?: boolean;
  showRightGap?: boolean;
  showSectionLength?: boolean;
}

export function SpanConfigPanel({
  span,
  allSpans,
  onUpdate,
  productVariant = "glass-pool-spigots",
  calculatorConfig,
  showLeftGap,
  showRightGap,
  showSectionLength = true,
}: SpanConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine if this is a semi-frameless variant
  const isSemiFrameless = productVariant === "semi-frameless-1000" || productVariant === "semi-frameless-1800";

  const isGlassSpigots = productVariant === "glass-pool-spigots";
  // Pool channel shares the spigots accordion (hardware section swapped to Channel).
  const isGlassPoolChannel = productVariant === "glass-pool-channel";
  // Bal channel 15mm shares the same accordion in channel mode (+ Rail section, no
  // gates/raked — operator ruling 2026-06-03, _docs/channel-ui-build-spec.md).
  const isGlassBalChannel = productVariant === "glass-bal-channel";
  const isGlassBalSpigots = productVariant.startsWith("glass-bal-spigots");
  // Standoff balustrade 15mm (point-fix) — wizard accordion (Configure/Standoffs/Rail).
  const isGlassBalStandoffs = productVariant === "glass-bal-standoffs";
  // Blade Pool Fence — wizard accordion (Configure/Posts & Substrate/Gate). Black only.
  const isAluPoolBlade = productVariant === "alu-pool-blade";
  // BARR Pool Fence — wizard accordion (Configure/Posts & Substrate/Gate). B/W finishes,
  // cross-range 50×50 corner/gate posts (BARR's 25mm post face can't take the hardware).
  const isAluPoolBarr = productVariant === "alu-pool-barr";
  // Flat Top Tubular — wizard accordion. 3 finishes (3000mm Black-only), cross-range
  // White posts, shrouds, swivel shrouds at angled corners, finish-asymmetric gate.
  const isAluPoolTubular = productVariant === "alu-pool-tubular";
  // Aluminium balustrade — shared AIRE/substrate wizard (BARR 2 finishes, Blade Black-only).
  const isAluBalBarr = productVariant === "alu-bal-barr";
  const isAluBalBlade = productVariant === "alu-bal-blade";

  // Determine if gates are allowed based on calculator config features
  const gatesAllowed = calculatorConfig?.features?.enableGates ?? !productVariant.includes("bal-");

  // Initialize semiFramelessConfig if it's a semi-frameless product and config doesn't exist
  useEffect(() => {
    if (isSemiFrameless && !span.semiFramelessConfig) {
      console.log("🔧 Initializing semiFramelessConfig for span", span.spanId);
      onUpdate({
        ...span,
        semiFramelessConfig: {
          postWidth: 50,
          lhsPostType: "wall",
          rhsPostType: "wall",
          intermediatePostMountType: "base-plate",
          postColor: "satin-black",
        },
      });
    }
  }, [isSemiFrameless, span.spanId]); // Run when product changes or span ID changes

  // Helper function to check if a field is enabled in calculator config
  const isFieldEnabled = (fieldKey: string): boolean => {
    // If no config, default to enabled
    if (!calculatorConfig?.fields) return true;
    // Check if field exists in config - if it exists, it's enabled
    return fieldKey in calculatorConfig.fields;
  };
  
  // Helper to check if a section is enabled (checks if any field from that section exists)
  const isSectionEnabled = (section: string): boolean => {
    if (!calculatorConfig?.fields) return true;
    return Object.values(calculatorConfig.fields).some((field: any) => field.section === section);
  };

  // SAME-CYCLE UPDATE ACCUMULATOR: several mount-time default effects (e.g. a config
  // block's max-panel clamp + rail default + family default) each call updateSpan in
  // the same render cycle. Each call spreads the SAME stale `span`, so without
  // accumulation the last call clobbers the earlier ones (e.g. the rail default was
  // silently reverting the PTS max-panel clamp → layouts solved at 1800mm on 1400mm
  // styles). Accumulated updates reset when the span prop refreshes.
  const pendingUpdates = useRef<{ forSpan: SpanConfig; updates: Partial<SpanConfig> } | null>(null);
  if (pendingUpdates.current && pendingUpdates.current.forSpan !== span) {
    pendingUpdates.current = null;
  }

  const updateSpan = (updates: Partial<SpanConfig>) => {
    // Disable raked panels if max panel width is changed to below 1200mm
    if (updates.maxPanelWidth !== undefined && updates.maxPanelWidth < 1200) {
      updates.leftRakedPanel = undefined;
      updates.rightRakedPanel = undefined;
    }
    // Merge with any updates already issued against this same span render.
    pendingUpdates.current = {
      forSpan: span,
      updates: { ...(pendingUpdates.current?.updates ?? {}), ...updates },
    };
    updates = pendingUpdates.current.updates;
    
    // For custom-frameless and semi-frameless in auto mode, recalculate panels when length changes
    if ((productVariant === "custom-frameless" || isSemiFrameless) && 
        updates.length !== undefined && 
        span.autoCalcConfig?.layoutMode === "auto") {
      const newLength = updates.length;
      const maxPanelWidth = span.autoCalcConfig.maxPanelWidth;
      const gapSize = span.autoCalcConfig.interPanelGaps[0] || 50;
      const leftGapSize = span.leftGap?.size || 0;
      const rightGapSize = span.rightGap?.size || 0;
      const availableLength = newLength - leftGapSize - rightGapSize;
      
      // Calculate new panel count
      let numPanels = 1;
      while (numPanels <= 20) {
        const totalGaps = (numPanels - 1) * gapSize;
        const totalPanelWidth = numPanels * maxPanelWidth;
        if (totalPanelWidth + totalGaps <= availableLength) {
          numPanels++;
        } else {
          break;
        }
      }
      const autoPanelCount = Math.max(1, numPanels - 1);
      
      // Calculate panel widths
      const numGaps = Math.max(0, autoPanelCount - 1);
      const totalGaps = numGaps * gapSize;
      const availableForPanels = newLength - leftGapSize - rightGapSize - totalGaps;
      const baseWidth = autoPanelCount > 0 ? Math.floor(availableForPanels / autoPanelCount) : 0;
      const remainder = availableForPanels - (baseWidth * autoPanelCount);
      
      const panelWidths: number[] = [];
      for (let i = 0; i < autoPanelCount; i++) {
        const extraMm = i < remainder ? 1 : 0;
        panelWidths.push(baseWidth + extraMm);
      }
      
      const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
      
      // Update autoCalcConfig and panelLayout
      updates.autoCalcConfig = {
        ...span.autoCalcConfig,
        panelTypes: Array(autoPanelCount).fill("standard"),
        interPanelGaps: Array(numGaps).fill(gapSize),
      };
      updates.panelLayout = {
        panels: panelWidths,
        gaps: Array(numGaps).fill(gapSize),
        totalPanelWidth,
        totalGapWidth: totalGaps,
        averageGap: gapSize,
        panelTypes: Array(autoPanelCount).fill("standard"),
      };
    }
    
    onUpdate({ ...span, ...updates });
  };

  // Calculate panel layout whenever relevant parameters change
  // ── SERVER-SIDE LAYOUT (IP protection, owner 2026-06-03) ────────────────────────
  // The layout solver runs on the server only. The client posts this span's raw
  // configuration to POST /api/layout (debounced) and receives just the RESULT:
  // panel widths/gaps/types + the optimal hinge size. While a request is in flight,
  // `isCalculating` drives the "Calculating…" indicators.
  const [optimalHingePanelSize, setOptimalHingePanelSize] = useState<number | undefined>(undefined);
  const [isCalculating, setIsCalculating] = useState(false);
  const layoutRequestId = useRef(0);

  useEffect(() => {
    // Fully-custom layout: a pure format conversion of user-entered widths — no
    // solver involved, so it stays local for instant feedback.
    if (span.layoutMode === "fully-custom" && span.customLayout) {
      const customPanels = span.customLayout.panels.map(p => p.widthMm);
      const customGaps = span.customLayout.gaps.map(g => g.beforeMm);
      const totalPanelWidth = customPanels.reduce((sum, w) => sum + w, 0);
      const totalGapWidth = customGaps.reduce((sum, g) => sum + g, 0);
      const averageGap = customGaps.length > 0 ? totalGapWidth / customGaps.length : 0;

      const customPanelLayout = {
        panels: customPanels,
        gaps: customGaps,
        totalPanelWidth,
        totalGapWidth,
        averageGap,
        panelTypes: customPanels.map(() => "custom" as const),
      };

      if (JSON.stringify(span.panelLayout) !== JSON.stringify(customPanelLayout)) {
        updateSpan({ panelLayout: customPanelLayout });
      }
      return;
    }

    // auto-calc layout: panelLayout is managed by AutoCalcPanelControls.
    if (span.layoutMode === "auto-calc") {
      return;
    }

    // Everything else: ask the server. Debounce so dragging/typing doesn't flood it;
    // stale responses are discarded via the request id.
    const requestId = ++layoutRequestId.current;
    setIsCalculating(true);
    const timer = setTimeout(async () => {
      try {
        const response = await apiRequest("POST", "/api/layout", {
          productVariant,
          gatesAllowed,
          span: {
            length: span.length,
            maxPanelWidth: span.maxPanelWidth,
            desiredGap: span.desiredGap,
            layoutMode: span.layoutMode,
            leftGap: span.leftGap,
            rightGap: span.rightGap,
            leftRakedPanel: span.leftRakedPanel,
            rightRakedPanel: span.rightRakedPanel,
            customPanel: span.customPanel,
            gateConfig: span.gateConfig,
            bladeHeight: span.bladeHeight,
            bladeLayoutMode: span.bladeLayoutMode,
            barrHeight: span.barrHeight,
            barrLayoutMode: span.barrLayoutMode,
            tubularHeight: span.tubularHeight,
            tubularPanelWidth: span.tubularPanelWidth,
            tubularLayoutMode: span.tubularLayoutMode,
            balBarrPanelHeight: span.balBarrPanelHeight,
            // BARR Bal: <1m → full 1733mm panels; ≥1m → 1365mm c-to-c cap.
            balFallHeight: span.fieldValues?.["bal-fall-height"] as string | undefined,
            hamptonsLayoutMode: span.hamptonsLayoutMode,
          },
        });
        const data = await response.json();
        if (requestId !== layoutRequestId.current) return; // superseded by a newer request

        setOptimalHingePanelSize(data.optimalHingePanelSize);

        if (data.panelLayout) {
          const layoutChanged =
            !span.panelLayout ||
            JSON.stringify(span.panelLayout) !== JSON.stringify(data.panelLayout);
          if (layoutChanged) {
            onUpdate({ ...span, panelLayout: data.panelLayout });
          }
        }
      } catch (error) {
        console.error("Layout request failed:", error);
      } finally {
        if (requestId === layoutRequestId.current) setIsCalculating(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [span.length, span.desiredGap, span.maxPanelWidth, 
      span.leftGap, span.rightGap, 
      span.leftRakedPanel, span.rightRakedPanel, 
      span.gateConfig?.required, span.gateConfig?.gateSize, span.gateConfig?.hingePanelSize,
      span.gateConfig?.autoHingePanel, span.gateConfig?.centreFromLeft,
      span.gateConfig?.position, span.gateConfig?.flipped, span.gateConfig?.hingeFrom, span.gateConfig?.latchTo,
      span.gateConfig?.hingeGap, span.gateConfig?.latchGap,
      span.gateConfig?.savedGlassPosition,
      span.customPanel?.enabled, span.customPanel?.width, span.customPanel?.height, span.customPanel?.position,
      span.layoutMode, span.customLayout, // Add fully-custom layout dependencies
      span.autoCalcConfig, // Add auto-calc configuration dependencies
      span.bladeHeight, span.bladeLayoutMode, // Add Blade-specific dependencies
      span.barrHeight, span.barrLayoutMode, // Add BARR-specific dependencies
      span.tubularHeight, span.tubularPanelWidth, span.tubularLayoutMode, // Add Tubular-specific dependencies
      span.hamptonsStyle, span.hamptonsLayoutMode, // Add Hamptons PVC-specific dependencies
      span.balBarrPanelHeight, // Add Aluminium Balustrade dependencies
      span.fieldValues?.["bal-fall-height"], // BARR Bal fall band → full vs capped panels
      productVariant, gatesAllowed, onUpdate]);

  // Validate panel layout
  const validatePanelLayout = () => {
    if (!span.panelLayout) {
      return {
        valid: false,
        message: "Calculating panel layout..."
      };
    }

    if (span.panelLayout.panels.length === 0) {
      return {
        valid: false,
        message: "Unable to fit panels with current configuration. Try reducing max panel width or desired gap."
      };
    }

    const numPanels = span.panelLayout.panels.length;
    const totalUsed = span.panelLayout.totalPanelWidth + span.panelLayout.totalGapWidth;
    
    // Calculate end gaps with gate override
    let leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
    let rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;
    
    // Override end gaps based on gate configuration
    if (span.gateConfig?.required) {
      const latchGap = span.gateConfig.latchGap || 9;
      const hingeGap = span.gateConfig.hingeGap || 9;
      
      if (span.gateConfig.hingeFrom === "wall") {
        // Wall-mounted gate
        if (span.gateConfig.position === 0) {
          leftEndGap = 0; // Hinge at left wall (no gap)
          if (span.gateConfig.latchTo === "wall") {
            rightEndGap = latchGap; // Latch at right wall
          }
        } else if (span.gateConfig.position >= 1) {
          rightEndGap = 0; // Hinge at right wall (no gap)
          if (span.gateConfig.latchTo === "wall") {
            leftEndGap = latchGap; // Latch at left wall
          }
        }
      } else {
        // Glass-to-glass gate: check which end the latch/hinge is at based on position and flip
        const isAtLeftEnd = span.gateConfig.position === 0;
        const isAtRightEnd = numPanels > 0 && span.gateConfig.position >= numPanels - 2;
        
        if (isAtLeftEnd && !span.gateConfig.flipped) {
          // Gate at left, latch on left side
          leftEndGap = latchGap;
        } else if (isAtLeftEnd && span.gateConfig.flipped) {
          // Hinge panel at left, hinge on left side
          leftEndGap = hingeGap;
        } else if (isAtRightEnd && !span.gateConfig.flipped) {
          // Gate at right, hinge on right side
          rightEndGap = hingeGap;
        } else if (isAtRightEnd && span.gateConfig.flipped) {
          // Gate at right, latch on right side
          rightEndGap = latchGap;
        }
      }
    }
    
    let endGaps = leftEndGap + rightEndGap;
    
    const effectiveLength = span.length - endGaps;

    // Format panel width display - show individual widths if they vary
    const panelWidths = span.panelLayout.panels;
    const allSameWidth = panelWidths.every(w => w === panelWidths[0]);
    let panelWidthText: string;
    
    if (allSameWidth) {
      panelWidthText = `${numPanels} panel${numPanels > 1 ? 's' : ''} @ ${panelWidths[0]}mm each`;
    } else {
      // Count occurrences of each width
      const widthCounts = new Map<number, number>();
      panelWidths.forEach(w => widthCounts.set(w, (widthCounts.get(w) || 0) + 1));
      
      // Format as "1x1650mm + 2x1600mm"
      const parts = Array.from(widthCounts.entries())
        .sort((a, b) => b[0] - a[0]) // Sort by width descending
        .map(([width, count]) => count > 1 ? `${count}x${width}mm` : `${width}mm`);
      
      panelWidthText = parts.join(' + ');
    }

    return {
      valid: true,
      message: `${panelWidthText} • Actual gap: ${span.panelLayout.averageGap.toFixed(1)}mm`
    };
  };

  const layoutValidation = validatePanelLayout();

  // optimalHingePanelSize now comes from the server layout response (state above) —
  // the hinge-sizing logic is solver IP and never runs in the browser.

  // Calculate total measurements and variance for elevation view
  const calculateTotalAndVariance = () => {
    if (!span.panelLayout || span.panelLayout.panels.length === 0) {
      return { total: 0, variance: 0 };
    }

    // Sum individual panels (as shown on elevation)
    const panelsTotal = span.panelLayout.panels.reduce((sum, panel) => sum + panel, 0);
    
    // Sum individual gaps (as shown on elevation - these are the actual gap values displayed)
    const internalGapsTotal = span.panelLayout.gaps.reduce((sum, gap) => sum + gap, 0);
    
    // Add end gaps
    const leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
    const rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;
    
    const total = panelsTotal + internalGapsTotal + leftEndGap + rightEndGap;
    const variance = span.length - total;
    
    return { total, variance };
  };

  const { total: calculatedTotal, variance } = calculateTotalAndVariance();

  return (
    <Card className="overflow-hidden" data-testid={`span-${span.spanId}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-semibold whitespace-nowrap">{span.name?.trim() || `Section ${span.spanId}`}</h3>
          <InfoTooltip content="Configure this section's length, panel layout, gaps, gates, and special features. Each section can have custom panels, raked panels for slopes, and independently positioned gates." />
          {/* Calculating indicator — the layout solver runs server-side; this shows
              the round-trip so the calculator visibly "works" rather than lags. */}
          {isCalculating && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary" data-testid={`span-${span.spanId}-calculating`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Calculating…
            </span>
          )}
          {(isGlassSpigots || isGlassPoolChannel || isGlassBalChannel) && span.panelLayout && (
            <span className="hidden md:flex items-center gap-1.5 ml-2 text-xs text-muted-foreground font-mono truncate">
              <span>{span.length.toLocaleString()} mm</span>
              <span>·</span>
              <span>{span.panelLayout?.panels.length ?? 0} panels</span>
              {span.gateConfig?.required && <><span>·</span><span>1 gate</span></>}
              <span>·</span>
              <span>{(span.panelLayout?.panels.length ?? 0) + 1} spigots</span>
              <span>·</span>
              <span className={cn(
                "font-semibold",
                Math.abs(variance) < 0.1 ? "text-green-600 dark:text-green-400" :
                Math.abs(variance) <= 50 ? "text-amber-600 dark:text-amber-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {variance >= 0 ? "+" : ""}{variance.toFixed(1)} mm
              </span>
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-md hover-elevate active-elevate-2"
          data-testid={`span-${span.spanId}-toggle`}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 space-y-2">
          {/* Panel Layout Info - Hidden */}
          {!layoutValidation.valid && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 hidden" data-testid={`span-${span.spanId}-validation-error`}>
              <p className="text-sm text-destructive font-medium">{layoutValidation.message}</p>
            </div>
          )}

          {/* Section Length — inline label + input.
              Hidden when shown in the page-level meta row (single-section designs). */}
          {showSectionLength && (
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Section Length</Label>
              <InfoTooltip content="Enter the total length of this fence section. The default end gap is 25mm for corner junctions. Maximum end gap is 150mm to allow for adding a post or other non-fence item into the section." />
              <div className="flex items-center gap-1 w-40 ml-1">
                <Input
                  type="number"
                  value={span.length}
                  onChange={(e) => updateSpan({ length: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={30000}
                  step={100}
                  className="h-8"
                  data-testid={`span-${span.spanId}-length`}
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            </div>
          )}

          {/* ── Glass Pool Spigots + Glass Pool Channel: Oxworks-style numbered configure
              accordion. Channel reuses the same block with the hardware section swapped
              (owner ruling: "change spigots to channel" — all glass logic shared). */}
          {(isGlassSpigots || isGlassPoolChannel || isGlassBalChannel) && (
            <GlassSpigotsConfig
              span={span}
              allSpans={allSpans}
              updateSpan={updateSpan}
              gatesAllowed={gatesAllowed}
              optimalHingePanelSize={optimalHingePanelSize}
              showLeftGap={showLeftGap}
              showRightGap={showRightGap}
              isFieldEnabled={isFieldEnabled}
              isSectionEnabled={isSectionEnabled}
              productVariant={productVariant}
            />
          )}

          {/* ── Glass Balustrade Spigots: same Oxworks accordion format (Configure/Spigot/Rail) ── */}
          {isGlassBalSpigots && (
            <GlassBalSpigotsConfig
              span={span}
              updateSpan={updateSpan}
              productVariant={productVariant}
              showLeftGap={showLeftGap}
              showRightGap={showRightGap}
            />
          )}

          {/* ── Standoff Balustrade 15mm: Oxworks accordion (Configure/Standoffs/Rail) ── */}
          {isGlassBalStandoffs && (
            <GlassBalStandoffsConfig
              span={span}
              updateSpan={updateSpan}
              allSpans={allSpans}
              showLeftGap={showLeftGap}
              showRightGap={showRightGap}
            />
          )}

          {/* ── Blade Pool Fence: Oxworks accordion (Configure/Posts & Substrate/Gate) ── */}
          {isAluPoolBlade && (
            <AluPoolBladeConfig
              span={span}
              updateSpan={updateSpan}
              allSpans={allSpans}
            />
          )}

          {/* ── BARR Pool Fence: Oxworks accordion (Configure/Posts & Substrate/Gate) ── */}
          {isAluPoolBarr && (
            <AluPoolBarrConfig
              span={span}
              updateSpan={updateSpan}
              allSpans={allSpans}
            />
          )}

          {/* ── Flat Top Tubular: Oxworks accordion (Configure/Posts & Substrate/Gate) ── */}
          {isAluPoolTubular && (
            <AluPoolTubularConfig
              span={span}
              updateSpan={updateSpan}
              allSpans={allSpans}
            />
          )}

          {/* ── Aluminium Balustrade BARR / Blade: shared accordion (Configure/Posts) ── */}
          {(isAluBalBarr || isAluBalBlade) && (
            <AluBalConfig
              span={span}
              updateSpan={updateSpan}
              allSpans={allSpans}
              style={isAluBalBarr ? "barr" : "blade"}
            />
          )}

          {/* Hamptons PVC Configuration - appears right after section length */}
          {productVariant.startsWith("pvc-hamptons-") && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Hamptons PVC Configuration</h4>
                <InfoTooltip content="Hamptons PVC fencing features 127mm square posts with 2388mm wide panels. All styles use the same panel width. Choose layout mode for your installation." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Layout Mode</Label>
                    <InfoTooltip content="Full Panels + Cut End: Uses full 2388mm panels with one cut panel at the end. Equally Spaced: All panels cut to the same custom size to fit the span exactly." />
                  </div>
                  <Select
                    value={span.hamptonsLayoutMode || "full-panels-cut-end"}
                    onValueChange={(value) => updateSpan({ hamptonsLayoutMode: value as "full-panels-cut-end" | "equally-spaced" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-hamptons-layout-mode`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-panels-cut-end">Full Panels + Cut End</SelectItem>
                      <SelectItem value="equally-spaced">Equally Spaced (All Cut)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Finish</Label>
                  <Select
                    value={span.hamptonsFinish || "white"}
                    onValueChange={(value) => updateSpan({ hamptonsFinish: value as "white" | "almond" | "clay" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-hamptons-finish`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="almond">Almond</SelectItem>
                      <SelectItem value="clay">Clay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {gatesAllowed && (
                <div className="space-y-3 pt-4 border-t border-card-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Gate Required</Label>
                    <Switch
                      checked={span.gateConfig?.required || false}
                      onCheckedChange={(required) => {
                        if (required) {
                          updateSpan({
                            gateConfig: {
                              required: true,
                              hardware: "master",
                              hingeFrom: "wall",
                              latchTo: "wall",
                              hingeType: "wall-to-glass",
                              latchType: "glass-to-wall",
                              gateSize: 1000,
                              hingePanelSize: 0,
                              autoHingePanel: false,
                              position: 0,
                              flipped: false,
                              postAdapterPlate: false,
                              hingeGap: 0,
                              latchGap: 0,
                            },
                          });
                        } else {
                          updateSpan({ gateConfig: undefined });
                        }
                      }}
                      data-testid={`span-${span.spanId}-gate-toggle`}
                    />
                  </div>

                  {span.gateConfig?.required && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Gate Position</Label>
                        <Select
                          value={(span.gateConfig.position || 0).toString()}
                          onValueChange={(value) => updateSpan({ 
                            gateConfig: {
                              ...span.gateConfig!,
                              position: parseInt(value)
                            }
                          })}
                        >
                          <SelectTrigger data-testid={`span-${span.spanId}-gate-position`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const numPanels = span.panelLayout?.panels.filter(p => span.panelLayout?.panelTypes?.[span.panelLayout.panels.indexOf(p)] !== "gate").length || 3;
                              const positions = [];
                              for (let i = 0; i <= numPanels; i++) {
                                if (i === 0) {
                                  positions.push(<SelectItem key={i} value={i.toString()}>Start (before panel 1)</SelectItem>);
                                } else if (i === numPanels) {
                                  positions.push(<SelectItem key={i} value={i.toString()}>End (after panel {numPanels})</SelectItem>);
                                } else {
                                  positions.push(<SelectItem key={i} value={i.toString()}>Between panel {i} and {i + 1}</SelectItem>);
                                }
                              }
                              return positions;
                            })()}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose where to position the gate within this section
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* alu-bal-barr / alu-bal-blade: configured entirely by <AluBalConfig> (finish picker +
              substrate-driven post mounting). The old per-span Panel Height / Finish / Post Mounting
              dropdowns were removed — "Post Mounting" duplicated the Substrate picker and could drift
              out of sync with it. Panel height is pinned 1000mm for V1 (see alu-bal-config.tsx). */}

          {/* Gap Configurations - Hide for BARR, Blade, Tubular, Hamptons PVC, alu-bal-*, and glass-pool-spigots (uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && !isGlassBalSpigots && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && !productVariant.startsWith("pvc-hamptons-") && (showLeftGap || showRightGap) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {showLeftGap && isFieldEnabled("startGapMm") && (
                  <div className="space-y-1">
                    <GapSlider
                      label="Left Gap"
                      value={span.leftGap?.enabled ? span.leftGap.size : 0}
                      onChange={(size) =>
                        updateSpan({
                          leftGap: size > 0 ? { enabled: true, position: "inside", size } : undefined,
                        })
                      }
                      min={0}
                      max={150}
                      testId={`span-${span.spanId}-left-gap`}
                    />
                  </div>
                )}

                {showRightGap && isFieldEnabled("endGapMm") && (
                  <div className="space-y-1">
                    <GapSlider
                      label="Right Gap"
                      value={span.rightGap?.enabled ? span.rightGap.size : 0}
                      onChange={(size) =>
                        updateSpan({
                          rightGap: size > 0 ? { enabled: true, position: "inside", size } : undefined,
                        })
                      }
                      min={0}
                      max={150}
                      testId={`span-${span.spanId}-right-gap`}
                    />
                  </div>
                )}
              </div>

              {/* Between Panel Gap - For custom-frameless and semi-frameless */}
              {(productVariant === "custom-frameless" || isSemiFrameless) && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Between Panel Gap</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {span.autoCalcConfig?.gapMode === "auto" ? "Toggle" : "Manual"}
                      </span>
                      <Switch
                        checked={span.autoCalcConfig?.gapMode === "auto"}
                        onCheckedChange={(checked) => 
                          updateSpan({
                            autoCalcConfig: {
                              ...(span.autoCalcConfig || {
                                maxPanelWidth: span.maxPanelWidth || 1500,
                                panelHeight: 1500,
                                glassType: "12mm",
                                interPanelGaps: [50],
                                panelTypes: ["standard", "standard"],
                              }),
                              gapMode: checked ? "auto" : "manual",
                            }
                          })
                        }
                        data-testid={`span-${span.spanId}-gap-mode-toggle`}
                      />
                    </div>
                  </div>
                  <GapSlider
                    label=""
                    value={span.autoCalcConfig?.interPanelGaps?.[0] || 50}
                    onChange={(value) => {
                      const newGaps = (span.autoCalcConfig?.interPanelGaps || [50]).map(() => value);
                      updateSpan({
                        autoCalcConfig: {
                          ...(span.autoCalcConfig || {
                            maxPanelWidth: span.maxPanelWidth || 1100, // Default 1100mm
                            panelHeight: 1500,
                            glassType: "12mm",
                            gapMode: "auto",
                            panelTypes: ["standard", "standard"],
                          }),
                          interPanelGaps: newGaps,
                        }
                      });
                    }}
                    min={6}
                    max={100}
                    testId={`span-${span.spanId}-between-gap`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {span.autoCalcConfig?.gapMode === "auto" 
                      ? "Use slider to adjust - panels auto-resize to fit" 
                      : "Set fixed gap value - panels auto-resize to fit"}
                  </p>
                </div>
              )}

              {/* Semi-Frameless Post Hardware Configuration */}
              {isSemiFrameless && (
                <div className="space-y-4 pt-4">
                  <SemiFramelessPostConfig
                    config={span.semiFramelessConfig}
                    onUpdate={(semiFramelessConfig) => {
                      updateSpan({ semiFramelessConfig });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Panel Layout Mode - For custom-frameless and semi-frameless */}
          {(productVariant === "custom-frameless" || isSemiFrameless) && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <AutoCalcPanelControls
                autoCalcConfig={span.autoCalcConfig || {
                  layoutMode: "auto" as const,
                  maxPanelWidth: span.maxPanelWidth || 1100, // Default 1100mm for semi-frameless
                  panelHeight: 1500,
                  glassType: "12mm" as const,
                  gapMode: "auto" as const,
                  interPanelGaps: [30], // Fixed 30mm gaps
                  panelTypes: ["standard" as const, "standard" as const],
                  panelSelectionMode: "stock-plus-custom" as const, // Include default mode
                  stockPanelWidth: 950,
                }}
                spanLength={span.length}
                leftGapSize={
                  span.semiFramelessConfig?.lhsPostType === "wall" ? 40 :
                  span.semiFramelessConfig?.lhsPostType === "end" ? 90 :
                  span.leftGap?.size || 0
                }
                rightGapSize={
                  span.semiFramelessConfig?.rhsPostType === "wall" ? 40 :
                  span.semiFramelessConfig?.rhsPostType === "end" ? 90 :
                  span.rightGap?.size || 0
                }
                spanId={span.spanId}
                postConfig={span.semiFramelessConfig}
                onUpdate={(autoCalcConfig) => {
                  // For semi-frameless in all-stock mode, enforce stock panel width
                  let finalConfig = autoCalcConfig;
                  if (isSemiFrameless && autoCalcConfig.panelSelectionMode === "all-stock") {
                    // Ensure stockPanelWidth is valid and within constraints
                    const panelHeight = autoCalcConfig.panelHeight || 1800;
                    const maxPanelWidth = autoCalcConfig.maxPanelWidth || 1100; // Default 1100mm
                    
                    // Get valid stock widths for this configuration
                    const validStockWidths: number[] = [];
                    if (panelHeight === 1800) {
                      for (let w = 500; w <= Math.min(1150, maxPanelWidth); w += 50) {
                        validStockWidths.push(w);
                      }
                    } else if (panelHeight === 1000) {
                      for (let w = 300; w <= Math.min(1400, maxPanelWidth); w += 50) {
                        validStockWidths.push(w);
                      }
                    }
                    
                    // If stockPanelWidth is invalid or missing, use a sensible default
                    if (!autoCalcConfig.stockPanelWidth || 
                        !validStockWidths.includes(autoCalcConfig.stockPanelWidth)) {
                      const defaultStock = validStockWidths.find(w => w >= 900 && w <= 1000) || 
                                          validStockWidths[Math.floor(validStockWidths.length / 2)] || 
                                          950;
                      finalConfig = { ...autoCalcConfig, stockPanelWidth: defaultStock };
                    }
                  }
                  
                  // Build panel widths array - USE panelWidthOverrides if they exist (mixed stock sizes!)
                  const numPanels = finalConfig.panelTypes.length;
                  const totalGaps = finalConfig.interPanelGaps.reduce((sum, gap) => sum + gap, 0);
                  const panelWidths: number[] = [];
                  
                  // If we have panelWidthOverrides AND not in all-custom mode, use them directly
                  // In all-custom mode, we MUST ignore overrides to ensure all panels are equal size
                  if (finalConfig.panelSelectionMode !== "all-custom" && 
                      finalConfig.panelWidthOverrides && 
                      Object.keys(finalConfig.panelWidthOverrides).length > 0) {
                    // Use the individual widths that were calculated
                    for (let i = 0; i < numPanels; i++) {
                      panelWidths.push(finalConfig.panelWidthOverrides[i] || finalConfig.stockPanelWidth || 1000);
                    }
                  } else {
                    // Fallback: calculate panel widths if no overrides exist
                    const availableForPanels = span.length - (span.leftGap?.size || 0) - (span.rightGap?.size || 0) - totalGaps;
                    
                    // Identify fixed panels (gate/hinge with custom widths) and calculate remaining space
                    const fixedPanels: { index: number; width: number }[] = [];
                    let fixedWidth = 0;
                    let standardPanelCount = 0;
                    
                    for (let i = 0; i < numPanels; i++) {
                      if (finalConfig.panelTypes[i] === "gate" || 
                          finalConfig.panelTypes[i] === "hinge" || 
                          finalConfig.panelTypes[i] === "custom") {
                        const width = finalConfig.panelWidthOverrides?.[i] || 
                          (finalConfig.panelTypes[i] === "gate" ? 900 : 
                           finalConfig.panelTypes[i] === "hinge" ? 1200 : 1000);
                        fixedPanels.push({ index: i, width });
                        fixedWidth += width;
                      } else {
                        standardPanelCount++;
                      }
                    }
                    
                    // Calculate width for standard panels
                    const availableForStandard = availableForPanels - fixedWidth;
                    
                    if (finalConfig.panelSelectionMode === "all-custom") {
                      // All-custom mode: use exact equal division with rounding
                      const uniformWidth = standardPanelCount > 0 ? Math.round(availableForStandard / standardPanelCount) : 0;
                      for (let i = 0; i < numPanels; i++) {
                        const fixedPanel = fixedPanels.find(fp => fp.index === i);
                        if (fixedPanel) {
                          panelWidths.push(fixedPanel.width);
                        } else {
                          panelWidths.push(uniformWidth);
                        }
                      }
                    } else {
                      // Other modes: distribute with floor + remainder
                      const baseWidth = standardPanelCount > 0 ? Math.floor(availableForStandard / standardPanelCount) : 0;
                      const remainder = availableForStandard - (baseWidth * standardPanelCount);
                      
                      let standardIndex = 0;
                      for (let i = 0; i < numPanels; i++) {
                        const fixedPanel = fixedPanels.find(fp => fp.index === i);
                        if (fixedPanel) {
                          panelWidths.push(fixedPanel.width);
                        } else {
                          const extraMm = standardIndex < remainder ? 1 : 0;
                          panelWidths.push(baseWidth + extraMm);
                          standardIndex++;
                        }
                      }
                    }
                  }
                  
                  const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
                  const gapSize = finalConfig.interPanelGaps[0] || 50;
                  
                  // Ensure panelSelectionMode is always defined
                  const configWithMode = {
                    ...finalConfig,
                    panelSelectionMode: finalConfig.panelSelectionMode || "stock-plus-custom" as const,
                  };
                  
                  updateSpan({ 
                    autoCalcConfig: configWithMode,
                    layoutMode: "auto-calc",
                    maxPanelWidth: finalConfig.maxPanelWidth,
                    panelLayout: {
                      panels: panelWidths,
                      gaps: finalConfig.interPanelGaps,
                      totalPanelWidth,
                      totalGapWidth: totalGaps,
                      averageGap: gapSize,
                      panelTypes: finalConfig.panelTypes,
                    }
                  });
                }}
              />
            </div>
          )}

          {/* Panel Configuration - Hide for BARR, Blade, Tubular, Hamptons PVC, custom-frameless, semi-frameless, and glass-pool-spigots (uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && !isGlassBalSpigots && (isFieldEnabled("maxPanelMm") || isFieldEnabled("betweenGapMm")) &&
           productVariant !== "alu-pool-barr" &&
           productVariant !== "alu-pool-blade" &&
           productVariant !== "alu-pool-tubular" &&
           productVariant !== "alu-bal-barr" &&
           productVariant !== "alu-bal-blade" &&
           !productVariant.startsWith("pvc-hamptons-") &&
           productVariant !== "custom-frameless" &&
           !isSemiFrameless && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Panel Configuration</h4>
                <InfoTooltip content="Configure the maximum panel width and target gap spacing. The system will calculate the optimal panel layout to achieve your desired gap size." />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {isFieldEnabled("maxPanelMm") ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max Panel Width</Label>
                    <Select
                      value={span.maxPanelWidth.toString()}
                      onValueChange={(value) => updateSpan({ maxPanelWidth: parseInt(value) })}
                    >
                      <SelectTrigger data-testid={`span-${span.spanId}-max-panel-width`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 37 }, (_, i) => 200 + i * 50).map((width) => (
                          <SelectItem key={width} value={width.toString()}>
                            {width}mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : <div></div>}
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Calculated Total</Label>
                  <div className="h-9 flex items-center px-3 rounded-md bg-muted text-sm font-medium" data-testid={`span-${span.spanId}-calc-total`}>
                    {calculatedTotal.toFixed(1)}mm
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Variance Amount</Label>
                  <div 
                    className={`h-9 flex items-center px-3 rounded-md text-sm font-medium ${
                      Math.abs(variance) < 0.1 ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400' : 
                      Math.abs(variance) <= 50 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' :
                      'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                    }`}
                    data-testid={`span-${span.spanId}-variance-amount`}
                  >
                    {variance >= 0 ? '+' : ''}{variance.toFixed(1)}mm
                  </div>
                </div>
              </div>

              {/* Gap Slider - Adjusts panel widths */}
              {isFieldEnabled("betweenGapMm") && (
                <GapSlider
                  label="Desired Gap Between Panels"
                  value={span.desiredGap}
                  onChange={(desiredGap) => updateSpan({ desiredGap })}
                  min={0}
                  max={99}
                  testId={`span-${span.spanId}-gap-slider`}
                />
              )}
            </div>
          )}

          {/* Hardware Configuration - Show channel, spigot, OR post based on product type (glass-pool-spigots uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && !isGlassBalSpigots && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && !isSemiFrameless ? (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <h4 className="text-sm font-semibold">Spigot Hardware</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Mounting Type</Label>
                  <Select
                    value={span.spigotMounting || "base-plate"}
                    onValueChange={(spigotMounting: "base-plate" | "core-drilled" | "side-mounted") => 
                      updateSpan({ spigotMounting })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-spigot-mounting`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base-plate">Base Plate</SelectItem>
                      <SelectItem value="core-drilled">Core Drilled</SelectItem>
                      <SelectItem value="side-mounted">Side Mounted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color/Finish</Label>
                  <Select
                    value={span.spigotColor || "polished"}
                    onValueChange={(spigotColor: "polished" | "satin" | "black" | "white") => 
                      updateSpan({ spigotColor })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-spigot-color`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polished">Polished</SelectItem>
                      <SelectItem value="satin">Satin</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {/* Gate Configuration - only for non-BARR/Blade/Tubular pool fencing and general fencing; glass-pool-spigots uses 4-col grid */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && isSectionEnabled("Gate") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Gate Required</Label>
                  <InfoTooltip content="Add a gate panel to this section. Choose hardware type (Master Range or Polaris Soft Close), mounting style (glass-to-glass or wall-mounted), and position the gate within the section." />
                </div>
                <Switch
                  checked={span.gateConfig?.required || false}
                  onCheckedChange={(required) => {
                    if (required) {
                      const gaps = getGateGaps("polaris", "glass");
                      updateSpan({
                        gateConfig: {
                          required: true,
                          hardware: "polaris",
                          hingeFrom: "glass",
                          latchTo: "glass",
                          hingeType: "glass-to-glass",
                          latchType: "glass-to-glass",
                          gateSize: 900,
                          hingePanelSize: 1200,
                          autoHingePanel: false,
                          position: 0,
                          flipped: false,
                          postAdapterPlate: false,
                          ...gaps,
                        },
                      });
                    } else {
                      updateSpan({ gateConfig: undefined });
                    }
                  }}
                  data-testid={`span-${span.spanId}-gate-toggle`}
                />
              </div>

              {span.gateConfig?.required && (
                <GateControls
                  config={span.gateConfig}
                  spanId={span.spanId}
                  onUpdate={(gateConfig) => updateSpan({ 
                    gateConfig: {
                      ...gateConfig,
                      postAdapterPlate: gateConfig.postAdapterPlate ?? false
                    }
                  })}
                  calculatedHingePanelSize={optimalHingePanelSize}
                  numPanels={span.panelLayout?.panels.length}
                />
              )}
            </div>
          )}

          {/* Raked Panels Configuration - only for non-BARR/Blade/Tubular; glass-pool-spigots uses 4-col grid */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && isSectionEnabled("Raked Panel") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Raked Panels (for step ups - retaining walls and height changes)</h4>
                <InfoTooltip content="Raked panels are designed for step ups at retaining walls and changes in heights. They have a fixed width of 1200mm with a sloped top edge to follow the ground level. Configure the height of the highest point." />
              </div>
              
              {span.maxPanelWidth < 1200 && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  Raked panels require 1200mm or greater panel width. Please set Max Panel Width to 1200mm or above to enable raked panels.
                </p>
              )}
            
            {/* Left Raked Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Left Raked Panel</Label>
                <Switch
                  checked={span.leftRakedPanel?.enabled || false}
                  disabled={span.maxPanelWidth < 1200}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      leftRakedPanel: { enabled, height: 1500 },
                    })
                  }
                  data-testid={`span-${span.spanId}-left-raked-toggle`}
                />
              </div>
              {span.leftRakedPanel?.enabled && (
                <div className="space-y-2">
                  <Label className="text-sm">Panel Height (top)</Label>
                  <Select
                    value={span.leftRakedPanel.height.toString()}
                    onValueChange={(value) =>
                      updateSpan({
                        leftRakedPanel: { ...span.leftRakedPanel!, height: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-left-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right Raked Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Right Raked Panel</Label>
                <Switch
                  checked={span.rightRakedPanel?.enabled || false}
                  disabled={span.maxPanelWidth < 1200}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      rightRakedPanel: { enabled, height: 1500 },
                    })
                  }
                  data-testid={`span-${span.spanId}-right-raked-toggle`}
                />
              </div>
              {span.rightRakedPanel?.enabled && (
                <div className="space-y-2">
                  <Label className="text-sm">Panel Height (top)</Label>
                  <Select
                    value={span.rightRakedPanel.height.toString()}
                    onValueChange={(value) =>
                      updateSpan({
                        rightRakedPanel: { ...span.rightRakedPanel!, height: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-right-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Fully Custom Panel Layout - Only for custom-glass */}
          {productVariant === "custom-glass" && (
            <div className="space-y-3 pt-4 border-t border-card-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Fully Custom Layout</Label>
                  <InfoTooltip content="Design every panel individually with exact measurements. Perfect for custom designs where each panel needs a specific width." />
                </div>
                <Switch
                  checked={span.layoutMode === "fully-custom"}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      layoutMode: enabled ? "fully-custom" : "auto-equalize",
                      customLayout: enabled ? {
                        panels: [{ widthMm: 1200 }],
                        gaps: [],
                        enforceExactFit: true,
                      } : undefined,
                    })
                  }
                  data-testid={`span-${span.spanId}-fully-custom-toggle`}
                />
              </div>
              {span.layoutMode === "fully-custom" && span.customLayout && (
                <FullyCustomPanelControls
                  customLayout={span.customLayout}
                  spanLength={span.length}
                  leftGapSize={span.leftGap?.size || 0}
                  rightGapSize={span.rightGap?.size || 0}
                  spanId={span.spanId}
                  onUpdate={(customLayout) => updateSpan({ customLayout })}
                />
              )}
            </div>
          )}


          {/* Custom Panel - Hide for BARR, Blade, Tubular, and glass-pool-spigots (uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && isSectionEnabled("Custom Panel") && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && (
            <div className="space-y-3 pt-4 border-t border-card-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Custom Panel</Label>
                    <InfoTooltip content="Add a custom-sized glass panel with specific width and height dimensions. Panel width is limited by the Max Panel Width setting. The panel can be positioned anywhere in the section using the position controls." />
                  </div>
                  <Switch
                    checked={span.customPanel?.enabled || false}
                    onCheckedChange={(enabled) =>
                      updateSpan({
                        customPanel: { 
                          enabled, 
                          width: Math.min(1200, span.maxPanelWidth), 
                          height: 1200, 
                          position: 0 
                        },
                      })
                    }
                    data-testid={`span-${span.spanId}-custom-panel-toggle`}
                  />
                </div>
                {span.customPanel?.enabled && (
                  <CustomPanelControls
                    config={span.customPanel}
                    spanId={span.spanId}
                    onUpdate={(customPanel) => updateSpan({ customPanel })}
                    numPanels={span.panelLayout?.panels.length || 1}
                    maxPanelWidth={span.maxPanelWidth}
                  />
                )}
              </div>
          )}

          {/* Hardware Configuration - Moved to bottom (glass-pool-spigots uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && !isGlassBalSpigots && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && productVariant !== "custom-frameless" && !isSemiFrameless ? (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <h4 className="text-sm font-semibold">Spigot Hardware</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Mounting Type</Label>
                  <Select
                    value={span.spigotMounting || "base-plate"}
                    onValueChange={(spigotMounting: "base-plate" | "core-drilled" | "side-mounted") => 
                      updateSpan({ spigotMounting })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-spigot-mounting`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base-plate">Base Plate</SelectItem>
                      <SelectItem value="core-drilled">Core Drilled</SelectItem>
                      <SelectItem value="side-mounted">Side Mounted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color/Finish</Label>
                  <Select
                    value={span.spigotColor || "polished"}
                    onValueChange={(spigotColor: "polished" | "satin" | "black" | "white") => 
                      updateSpan({ spigotColor })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-spigot-color`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polished">Polished</SelectItem>
                      <SelectItem value="satin">Satin</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {/* Gate Configuration - Moved to bottom (glass-pool-spigots uses 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && isSectionEnabled("Gate") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && productVariant !== "custom-frameless" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Gate Required</Label>
                  <InfoTooltip content="Add a gate panel to this section. Choose hardware type (Master Range or Polaris Soft Close), mounting style (glass-to-glass or wall-mounted), and position the gate within the section." />
                </div>
                <Switch
                  checked={span.gateConfig?.required || false}
                  onCheckedChange={(required) => {
                    if (required) {
                      const gaps = getGateGaps("polaris", "glass");
                      updateSpan({
                        gateConfig: {
                          required: true,
                          hardware: "polaris",
                          hingeFrom: "glass",
                          latchTo: "glass",
                          hingeType: "glass-to-glass",
                          latchType: "glass-to-glass",
                          gateSize: 900,
                          hingePanelSize: 1200,
                          autoHingePanel: false,
                          position: 0,
                          flipped: false,
                          postAdapterPlate: false,
                          ...gaps,
                        },
                      });
                    } else {
                      updateSpan({ gateConfig: undefined });
                    }
                  }}
                  data-testid={`span-${span.spanId}-gate-toggle`}
                />
              </div>

              {span.gateConfig?.required && (
                <GateControls
                  config={span.gateConfig}
                  spanId={span.spanId}
                  onUpdate={(gateConfig) => updateSpan({ 
                    gateConfig: {
                      ...gateConfig,
                      postAdapterPlate: gateConfig.postAdapterPlate ?? false
                    }
                  })}
                  calculatedHingePanelSize={optimalHingePanelSize}
                  numPanels={span.panelLayout?.panels.length}
                />
              )}
            </div>
          )}

          {/* Raked Panels - Moved to bottom (glass-pool-spigots shows Rake in the 4-col grid) */}
          {!isGlassSpigots && !isGlassPoolChannel && !isGlassBalChannel && !isGlassBalStandoffs && isSectionEnabled("Raked Panel") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant !== "alu-bal-barr" && productVariant !== "alu-bal-blade" && productVariant !== "custom-frameless" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Raked Panels (for step ups - retaining walls and height changes)</h4>
                <InfoTooltip content="Raked panels are designed for step ups at retaining walls and changes in heights. They have a fixed width of 1200mm with a sloped top edge to follow the ground level. Configure the height of the highest point." />
              </div>
              
              {span.maxPanelWidth < 1200 && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  Raked panels require 1200mm or greater panel width. Please set Max Panel Width to 1200mm or above to enable raked panels.
                </p>
              )}
            
            {/* Left Raked Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Left Raked Panel</Label>
                <Switch
                  checked={span.leftRakedPanel?.enabled || false}
                  disabled={span.maxPanelWidth < 1200}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      leftRakedPanel: { enabled, height: 1500 },
                    })
                  }
                  data-testid={`span-${span.spanId}-left-raked-toggle`}
                />
              </div>
              {span.leftRakedPanel?.enabled && (
                <div className="space-y-2">
                  <Label className="text-sm">Panel Height (top)</Label>
                  <Select
                    value={span.leftRakedPanel.height.toString()}
                    onValueChange={(value) =>
                      updateSpan({
                        leftRakedPanel: { ...span.leftRakedPanel!, height: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-left-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Right Raked Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Right Raked Panel</Label>
                <Switch
                  checked={span.rightRakedPanel?.enabled || false}
                  disabled={span.maxPanelWidth < 1200}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      rightRakedPanel: { enabled, height: 1500 },
                    })
                  }
                  data-testid={`span-${span.spanId}-right-raked-toggle`}
                />
              </div>
              {span.rightRakedPanel?.enabled && (
                <div className="space-y-2">
                  <Label className="text-sm">Panel Height (top)</Label>
                  <Select
                    value={span.rightRakedPanel.height.toString()}
                    onValueChange={(value) =>
                      updateSpan({
                        rightRakedPanel: { ...span.rightRakedPanel!, height: parseInt(value) },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-right-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </Card>
  );
}
