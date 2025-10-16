import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig, getGateGaps, ProductVariant } from "@shared/schema";
import { calculatePanelLayout, calculateBarrPanelLayout, calculateBladePanelLayout, calculateTubularPanelLayout, calculateHamptonsPanelLayout } from "@shared/panelCalculations";
import { GapSlider } from "./gap-slider";
import { NumericInput } from "./numeric-input";
import { GateControls } from "./gate-controls";
import { CustomPanelControls } from "./custom-panel-controls";
import { FullyCustomPanelControls } from "./fully-custom-panel-controls";
import { AutoCalcPanelControls } from "./auto-calc-panel-controls";
import { InfoTooltip } from "./info-tooltip";

interface SpanConfigPanelProps {
  span: SpanConfig;
  onUpdate: (span: SpanConfig) => void;
  productVariant?: ProductVariant;
  uiConfig?: any;
  showLeftGap?: boolean;
  showRightGap?: boolean;
}

export function SpanConfigPanel({
  span,
  onUpdate,
  productVariant = "glass-pool-spigots",
  uiConfig,
  showLeftGap,
  showRightGap,
}: SpanConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine if gates are allowed for this product variant
  const gatesAllowed = !productVariant.includes("bal-");

  // Helper function to check if a field is enabled in UI config
  const isFieldEnabled = (fieldName: string): boolean => {
    if (!uiConfig || !uiConfig.fieldConfigs) return true; // Default to enabled if no config
    const fieldConfig = uiConfig.fieldConfigs.find((fc: any) => fc.field === fieldName);
    return fieldConfig?.enabled !== false; // Default to enabled if not found
  };

  const updateSpan = (updates: Partial<SpanConfig>) => {
    // Disable raked panels if max panel width is changed to below 1200mm
    if (updates.maxPanelWidth !== undefined && updates.maxPanelWidth < 1200) {
      updates.leftRakedPanel = undefined;
      updates.rightRakedPanel = undefined;
    }
    onUpdate({ ...span, ...updates });
  };

  // Calculate panel layout whenever relevant parameters change
  useEffect(() => {
    // Handle fully custom layout mode - convert customLayout to panelLayout for visualization
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

    let layout;

    // Blade fencing uses a different calculation
    if (productVariant === "alu-pool-blade") {
      // Get Blade specifications
      const bladeHeight = span.bladeHeight || "1200mm";
      const layoutMode = span.bladeLayoutMode || "full-panels-cut-end";
      const hasGate = gatesAllowed && span.gateConfig?.required;
      const gateSize = hasGate ? (span.gateConfig?.gateSize || 975) : undefined;
      const gatePosition = hasGate ? (span.gateConfig?.position || 0) : 0;

      layout = calculateBladePanelLayout(
        span.length,
        bladeHeight,
        layoutMode,
        hasGate,
        gateSize,
        gatePosition
      );
    } 
    // BARR fencing uses a different calculation
    else if (productVariant === "alu-pool-barr") {
      // Get BARR specifications
      const barrHeight = span.barrHeight || "1200mm";
      const layoutMode = span.barrLayoutMode || "full-panels-cut-end";
      const hasGate = gatesAllowed && span.gateConfig?.required;
      const gateSize = hasGate ? (span.gateConfig?.gateSize || 975) : undefined;
      const gatePosition = hasGate ? (span.gateConfig?.position || 0) : 0;

      layout = calculateBarrPanelLayout(
        span.length,
        barrHeight,
        layoutMode,
        hasGate,
        gateSize,
        gatePosition
      );
    } 
    // Tubular Flat Top uses a different calculation
    else if (productVariant === "alu-pool-tubular") {
      // Get Tubular specifications
      const tubularHeight = span.tubularHeight || "1200mm";
      const tubularPanelWidth = span.tubularPanelWidth || "2450mm";
      const layoutMode = span.tubularLayoutMode || "full-panels-cut-end";
      const hasGate = gatesAllowed && span.gateConfig?.required;
      const gateSize = hasGate ? (span.gateConfig?.gateSize || 975) : undefined;
      const gatePosition = hasGate ? (span.gateConfig?.position || 0) : 0;

      layout = calculateTubularPanelLayout(
        span.length,
        tubularHeight,
        tubularPanelWidth,
        layoutMode,
        hasGate,
        gateSize,
        gatePosition
      );
    }
    // Hamptons PVC uses a different calculation
    else if (productVariant.startsWith("pvc-hamptons-")) {
      // Get Hamptons PVC specifications
      const hamptonsStyle = productVariant.replace("pvc-hamptons-", "") as "full-privacy" | "combo" | "vertical-paling" | "semi-privacy" | "3rail";
      const layoutMode = span.hamptonsLayoutMode || "full-panels-cut-end";
      const hasGate = gatesAllowed && span.gateConfig?.required;
      const gateSize = hasGate ? (span.gateConfig?.gateSize || 1000) : undefined;
      const gatePosition = hasGate ? (span.gateConfig?.position || 0) : 0;

      layout = calculateHamptonsPanelLayout(
        span.length,
        hamptonsStyle,
        layoutMode,
        hasGate,
        gateSize,
        gatePosition
      );
    } else {
      // Glass/standoff/general fencing calculation
      // Calculate total end gaps, using latch gap when gate latch is at wall boundary
      let leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
      let rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;
      
      // When gate is wall-mounted, the hinge end has 0 gap (attached to wall)
      if (span.gateConfig?.required && span.gateConfig.hingeFrom === "wall") {
        // Wall-mounted: hinge is at boundary, so that end gap is 0
        if (span.gateConfig.position === 0) {
          leftEndGap = 0; // Hinge at left wall
        } else if (span.gateConfig.position >= 1) {
          rightEndGap = 0; // Hinge at right wall
        }
      }
      
      let endGaps = leftEndGap + rightEndGap;

      // Use the configured hinge panel size (default 1200mm)
      const effectiveHingePanelSize = span.gateConfig?.hingePanelSize || 1200;

      // Calculate final panel layout with the configured hinge panel size
      // Only include gate config if gates are allowed for this product variant
      layout = calculatePanelLayout(
        span.length,
        endGaps,
        span.desiredGap,
        span.maxPanelWidth,
        span.leftRakedPanel?.enabled || false,
        span.rightRakedPanel?.enabled || false,
        (gatesAllowed && span.gateConfig?.required) ? {
          required: span.gateConfig.required,
          gateSize: span.gateConfig.gateSize,
          hingePanelSize: effectiveHingePanelSize,
          position: span.gateConfig.position,
          flipped: span.gateConfig.flipped,
          hingeFrom: span.gateConfig.hingeFrom,
          hingeGap: span.gateConfig.hingeGap,
          latchGap: span.gateConfig.latchGap,
        } : undefined,
        span.customPanel?.enabled ? {
          enabled: span.customPanel.enabled,
          width: span.customPanel.width,
          height: span.customPanel.height,
          position: span.customPanel.position,
        } : undefined
      );
    }

    // Update span with calculated layout if it changed
    const layoutChanged = 
      !span.panelLayout ||
      JSON.stringify(span.panelLayout) !== JSON.stringify(layout);

    if (layoutChanged) {
      onUpdate({ ...span, panelLayout: layout });
    }
  }, [span.length, span.desiredGap, span.maxPanelWidth, 
      span.leftGap, span.rightGap, 
      span.leftRakedPanel, span.rightRakedPanel, 
      span.gateConfig?.required, span.gateConfig?.gateSize, span.gateConfig?.hingePanelSize,
      span.gateConfig?.position, span.gateConfig?.flipped, span.gateConfig?.hingeFrom, span.gateConfig?.latchTo,
      span.gateConfig?.hingeGap, span.gateConfig?.latchGap,
      span.gateConfig?.savedGlassPosition,
      span.customPanel?.enabled, span.customPanel?.width, span.customPanel?.height, span.customPanel?.position,
      span.layoutMode, span.customLayout, // Add fully-custom layout dependencies
      span.bladeHeight, span.bladeLayoutMode, // Add Blade-specific dependencies
      span.barrHeight, span.barrLayoutMode, // Add BARR-specific dependencies
      span.tubularHeight, span.tubularPanelWidth, span.tubularLayoutMode, // Add Tubular-specific dependencies
      span.hamptonsStyle, span.hamptonsLayoutMode, // Add Hamptons PVC-specific dependencies
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

  // Calculate optimal hinge panel size for Auto button
  const calculateOptimalHingePanelSize = (): number | undefined => {
    if (!span.gateConfig?.required || span.gateConfig.hingeFrom !== "glass") {
      return undefined;
    }
    
    // Valid hinge panel sizes
    const validHingeSizes = [600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];
    
    const leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
    const rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;
    const endGaps = leftEndGap + rightEndGap;
    
    const effectiveLength = span.length - endGaps;
    const gateSize = span.gateConfig.gateSize;
    const hingeGap = span.gateConfig.hingeGap || 20;
    const latchGap = span.gateConfig.latchGap || 20;
    const desiredGap = span.desiredGap;
    
    // Fixed components: gate + hinge gap + latch gap
    const fixedGateAssembly = gateSize + hingeGap + latchGap;
    const remainingSpace = effectiveLength - fixedGateAssembly;
    
    // Calculate how many standard panels will fit with max panel width
    const maxPanelWidth = span.maxPanelWidth || 1400;
    const minPanelWidth = 300;
    
    // Try different hinge sizes and find the one that gives best balanced layout
    let bestHingeSize = 1200; // default
    let bestScore = Infinity;
    
    for (const hingeSize of validHingeSizes) {
      // Space after hinge panel and its gap
      const spaceAfterHinge = remainingSpace - hingeSize - desiredGap;
      
      // Calculate number of standard panels needed (ensure no panel exceeds max)
      const numStandardPanels = Math.max(1, Math.ceil(spaceAfterHinge / (maxPanelWidth + desiredGap)));
      
      // Calculate average standard panel size
      const totalGapsBetweenStandards = (numStandardPanels - 1) * desiredGap;
      const spaceForStandards = spaceAfterHinge - totalGapsBetweenStandards;
      const avgStandardSize = spaceForStandards / numStandardPanels;
      
      // Check if configuration is valid
      if (avgStandardSize >= minPanelWidth && avgStandardSize <= maxPanelWidth) {
        // Score: prefer panels closer to each other in size (balanced layout)
        const sizeDiff = Math.abs(hingeSize - avgStandardSize);
        
        if (sizeDiff < bestScore) {
          bestScore = sizeDiff;
          bestHingeSize = hingeSize;
        }
      }
    }
    
    return bestHingeSize;
  };
  
  const optimalHingePanelSize = calculateOptimalHingePanelSize();

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
      <div className="flex items-center justify-between p-6 border-b border-card-border">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Section {span.spanId}</h3>
          <InfoTooltip content="Configure this section's length, panel layout, gaps, gates, and special features. Each section can have custom panels, raked panels for slopes, and independently positioned gates." />
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
        <div className="p-6 pt-6 space-y-6">
          {/* Panel Layout Info - Hidden */}
          {!layoutValidation.valid && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 hidden" data-testid={`span-${span.spanId}-validation-error`}>
              <p className="text-sm text-destructive font-medium">{layoutValidation.message}</p>
            </div>
          )}

          {/* Section Length */}
          <NumericInput
            label="Section Length"
            value={span.length}
            onChange={(length) => updateSpan({ length })}
            min={0}
            max={50000}
            step={100}
            unit="mm"
            testId={`span-${span.spanId}-length`}
            tooltip="Enter the total length of this fence section. The default end gap is 25mm for corner junctions. Maximum end gap is 150mm to allow for adding a post or other non-fence item into the section."
          />

          {/* Glass Balustrade Configuration - glass thickness and top rail */}
          {(productVariant === "glass-bal-spigots" || productVariant === "glass-bal-channel" || productVariant === "glass-bal-standoffs") && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Glass Balustrade Configuration</h4>
                <InfoTooltip content="Configure glass thickness and optional top-mounted rail for your balustrade system. Top rails provide additional safety and aesthetic appeal." />
              </div>
              
              {/* Glass Thickness - not shown for standoffs (always 15mm) */}
              {productVariant !== "glass-bal-standoffs" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Glass Thickness</Label>
                  <Select
                    value={span.glassThickness || "12mm"}
                    onValueChange={(value) => {
                      const glassThickness = value as "12mm" | "15mm";
                      const updates: Partial<SpanConfig> = { glassThickness };
                      
                      // If switching to 15mm and rail type is 25x21, clear it (25x21 only works with 12mm)
                      if (glassThickness === "15mm" && span.handrail?.type === "nonorail-25x21") {
                        updates.handrail = {
                          ...span.handrail,
                          type: "series-35x35" // Default to universal 35 series
                        };
                      }
                      
                      updateSpan(updates);
                    }}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-glass-thickness`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12mm">12mm Glass</SelectItem>
                      <SelectItem value="15mm">15mm Glass</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {(span.glassThickness || "12mm") === "12mm" 
                      ? "12mm glass: 300-1500mm width, 970mm height" 
                      : "15mm glass: 300-1400mm width, 1000mm height"}
                  </p>
                </div>
              )}
              
              {/* Top Mounted Rail */}
              <div className="space-y-3 pt-2 border-t border-card-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Top Mounted Rail</Label>
                    <InfoTooltip content="Add a top-mounted handrail to your balustrade. Standard lengths are 5800mm with automatic optimization to minimize wastage across multiple sections." />
                  </div>
                  <Switch
                    checked={span.handrail?.enabled || false}
                    onCheckedChange={(enabled) => {
                      if (enabled) {
                        // Determine default rail type based on glass thickness
                        const glassThickness = productVariant === "glass-bal-standoffs" ? "15mm" : (span.glassThickness || "12mm");
                        const defaultRailType = glassThickness === "12mm" ? "nonorail-25x21" : "series-35x35";
                        
                        updateSpan({
                          handrail: {
                            enabled: true,
                            type: defaultRailType,
                            material: "stainless-steel",
                            finish: "satin",
                            startTermination: "end-cap",
                            endTermination: "end-cap",
                          }
                        });
                      } else {
                        updateSpan({ handrail: undefined });
                      }
                    }}
                    data-testid={`span-${span.spanId}-top-rail-toggle`}
                  />
                </div>

                {span.handrail?.enabled && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">Rail Type</Label>
                          <InfoTooltip content="25×21mm (NonoRail): For 12mm glass only. 30×21mm (NanoRail): Universal. 35×35mm (Series 35): Universal, larger profile." />
                        </div>
                        <Select
                          value={span.handrail.type}
                          onValueChange={(type) => updateSpan({ 
                            handrail: { ...span.handrail!, type: type as "nonorail-25x21" | "nanorail-30x21" | "series-35x35" }
                          })}
                        >
                          <SelectTrigger data-testid={`span-${span.spanId}-rail-type`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* 25x21 only for 12mm glass */}
                            {(productVariant === "glass-bal-standoffs" ? "15mm" : (span.glassThickness || "12mm")) === "12mm" && (
                              <SelectItem value="nonorail-25x21">25×21mm (NonoRail)</SelectItem>
                            )}
                            <SelectItem value="nanorail-30x21">30×21mm (NanoRail)</SelectItem>
                            <SelectItem value="series-35x35">35×35mm (Series 35)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Material</Label>
                        <Select
                          value={span.handrail.material}
                          onValueChange={(material) => updateSpan({ 
                            handrail: { ...span.handrail!, material: material as "stainless-steel" | "anodised-aluminium" }
                          })}
                        >
                          <SelectTrigger data-testid={`span-${span.spanId}-rail-material`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stainless-steel">Stainless Steel</SelectItem>
                            <SelectItem value="anodised-aluminium">Anodised Aluminium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Finish</Label>
                      <Select
                        value={span.handrail.finish}
                        onValueChange={(finish) => updateSpan({ 
                          handrail: { ...span.handrail!, finish: finish as "polished" | "satin" | "black" | "white" }
                        })}
                      >
                        <SelectTrigger data-testid={`span-${span.spanId}-rail-finish`}>
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">Start Termination</Label>
                          <InfoTooltip content="How the rail ends at the start of this section: End Cap (sealed end), Wall Tie (attached to wall), 90° Corner, or Adjustable Corner." />
                        </div>
                        <Select
                          value={span.handrail.startTermination || "end-cap"}
                          onValueChange={(termination) => updateSpan({ 
                            handrail: { ...span.handrail!, startTermination: termination as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" }
                          })}
                        >
                          <SelectTrigger data-testid={`span-${span.spanId}-rail-start-termination`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="end-cap">End Cap</SelectItem>
                            <SelectItem value="wall-tie">Wall Tie</SelectItem>
                            <SelectItem value="90-degree">90° Corner</SelectItem>
                            <SelectItem value="adjustable-corner">Adjustable Corner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">End Termination</Label>
                          <InfoTooltip content="How the rail ends at the end of this section: End Cap (sealed end), Wall Tie (attached to wall), 90° Corner, or Adjustable Corner." />
                        </div>
                        <Select
                          value={span.handrail.endTermination || "end-cap"}
                          onValueChange={(termination) => updateSpan({ 
                            handrail: { ...span.handrail!, endTermination: termination as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" }
                          })}
                        >
                          <SelectTrigger data-testid={`span-${span.spanId}-rail-end-termination`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="end-cap">End Cap</SelectItem>
                            <SelectItem value="wall-tie">Wall Tie</SelectItem>
                            <SelectItem value="90-degree">90° Corner</SelectItem>
                            <SelectItem value="adjustable-corner">Adjustable Corner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
                      <p><strong>Standard Length:</strong> 5800mm rails with automatic optimization</p>
                      <p><strong>Section Length:</strong> {span.length}mm rail required for this section</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blade Fencing Configuration - appears right after section length */}
          {productVariant === "alu-pool-blade" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Blade Panel Configuration</h4>
                <InfoTooltip content="Blade fencing features 50×16mm vertical aluminium blades with 40×40mm horizontal rails inset from top and bottom. Panels are 1700mm (1000mm height) or 2200mm (1200mm height). Choose layout mode and post type for your installation." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Panel Height</Label>
                    <InfoTooltip content="Panel height determines the panel width. 1000mm height = 1700mm wide panels, 1200mm height = 2200mm wide panels." />
                  </div>
                  <Select
                    value={span.bladeHeight || "1200mm"}
                    onValueChange={(value) => updateSpan({ bladeHeight: value as "1000mm" | "1200mm" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-blade-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000mm">1000mm (1700mm wide panels)</SelectItem>
                      <SelectItem value="1200mm">1200mm (2200mm wide panels)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Finish</Label>
                  <Select
                    value={span.bladeFinish || "satin-black"}
                    onValueChange={(value) => updateSpan({ bladeFinish: value as "satin-black" | "pearl-white" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-blade-finish`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satin-black">Satin Black (CN150A)</SelectItem>
                      <SelectItem value="pearl-white">Pearl White (GA078A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium">Layout Mode</Label>
                  <InfoTooltip content="Full Panels + Cut End: Uses full standard panels (1700mm or 2200mm based on height) with a cut panel at the end. Equally Spaced: Cuts all panels to equal widths for uniform appearance. Both modes accommodate 50mm posts between panels." />
                </div>
                <Select
                  value={span.bladeLayoutMode || "full-panels-cut-end"}
                  onValueChange={(value) => updateSpan({ bladeLayoutMode: value as "full-panels-cut-end" | "equally-spaced" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-blade-layout-mode`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-panels-cut-end">Full Panels + Cut End</SelectItem>
                    <SelectItem value="equally-spaced">Equally Spaced (All Cut)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.bladeLayoutMode || "full-panels-cut-end") === "full-panels-cut-end" 
                    ? "Uses full standard panels with a cut panel at the end (minimum 200mm)" 
                    : "Cuts all panels to equal widths for uniform appearance"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Post Type</Label>
                <Select
                  value={span.bladePostType || "welded-base-plate"}
                  onValueChange={(value) => updateSpan({ bladePostType: value as "welded-base-plate" | "standard" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-blade-post-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welded-base-plate">Welded Base Plate (1280mm)</SelectItem>
                    <SelectItem value="standard">Standard (1800mm/2500mm)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.bladePostType || "welded-base-plate") === "welded-base-plate" 
                    ? "Bolted down base plates for concrete surfaces" 
                    : "Inground, wall, or core drilled mounting"}
                </p>
              </div>

              {/* Blade Gate Configuration - same as BARR (position only) */}
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
                              gateSize: 975,
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

          {/* Tubular Flat Top Configuration - appears right after section length */}
          {productVariant === "alu-pool-tubular" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Tubular Flat Top Configuration</h4>
                <InfoTooltip content="Tubular Flat Top fencing features 16mm diameter round vertical tubes with 38×25mm top and bottom rails. Panel widths are 2450mm (standard) or 3000mm (large). Choose panel height, width, layout mode, and post type for your installation." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Panel Height</Label>
                  <Select
                    value={span.tubularHeight || "1200mm"}
                    onValueChange={(value) => updateSpan({ tubularHeight: value as "1200mm" | "900mm" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-tubular-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1200mm">1200mm (Pool Fencing)</SelectItem>
                      <SelectItem value="900mm">900mm (Non-Pool)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Finish</Label>
                  <Select
                    value={span.tubularFinish || "black"}
                    onValueChange={(value) => updateSpan({ tubularFinish: value as "black" | "white" | "monument" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-tubular-finish`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="black">Black</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="monument">Monument Grey</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Panel Width</Label>
                <Select
                  value={span.tubularPanelWidth || "2450mm"}
                  onValueChange={(value) => updateSpan({ tubularPanelWidth: value as "2450mm" | "3000mm" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-tubular-panel-width`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2450mm">2450mm (Standard)</SelectItem>
                    <SelectItem value="3000mm">3000mm (Large)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the standard panel width for your fence layout
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium">Layout Mode</Label>
                  <InfoTooltip content="Full Panels + Cut End: Uses full standard panels (2450mm or 3000mm based on selection) with a cut panel at the end. Equally Spaced: Cuts all panels to equal widths for uniform appearance. Both modes accommodate 50mm posts between panels." />
                </div>
                <Select
                  value={span.tubularLayoutMode || "full-panels-cut-end"}
                  onValueChange={(value) => updateSpan({ tubularLayoutMode: value as "full-panels-cut-end" | "equally-spaced" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-tubular-layout-mode`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-panels-cut-end">Full Panels + Cut End</SelectItem>
                    <SelectItem value="equally-spaced">Equally Spaced (All Cut)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.tubularLayoutMode || "full-panels-cut-end") === "full-panels-cut-end" 
                    ? "Uses full standard panels with a cut panel at the end (minimum 200mm)" 
                    : "Cuts all panels to equal widths for uniform appearance"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Post Type</Label>
                <Select
                  value={span.tubularPostType || "welded-base-plate"}
                  onValueChange={(value) => updateSpan({ tubularPostType: value as "welded-base-plate" | "standard" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-tubular-post-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welded-base-plate">Welded Base Plate (1280mm)</SelectItem>
                    <SelectItem value="standard">Standard (1800mm/2500mm)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.tubularPostType || "welded-base-plate") === "welded-base-plate" 
                    ? "Bolted down base plates for concrete surfaces" 
                    : "Inground, wall, or core drilled mounting"}
                </p>
              </div>

              {/* Tubular Gate Configuration - same as BARR/Blade (position only) */}
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
                              gateSize: 975,
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

          {/* BARR Fencing Configuration - appears right after section length */}
          {productVariant === "alu-pool-barr" && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">BARR Panel Configuration</h4>
                <InfoTooltip content="BARR fencing features 50×25mm vertical aluminium pickets with horizontal rails passing through punched holes. Panel widths vary by height: 1000mm = 1733mm wide, 1200mm = 2205mm wide, 1800mm = 1969mm wide. Choose layout mode and post type for your installation." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Panel Height</Label>
                    <InfoTooltip content="Panel height determines the panel width. 1000mm height = 1733mm wide panels, 1200mm height = 2205mm wide panels, 1800mm height = 1969mm wide panels." />
                  </div>
                  <Select
                    value={span.barrHeight || "1200mm"}
                    onValueChange={(value) => updateSpan({ barrHeight: value as "1000mm" | "1200mm" | "1800mm" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-barr-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000mm">1000mm (1733mm wide panels)</SelectItem>
                      <SelectItem value="1200mm">1200mm (2205mm wide panels)</SelectItem>
                      <SelectItem value="1800mm">1800mm (1969mm wide panels)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Finish</Label>
                  <Select
                    value={span.barrFinish || "satin-black"}
                    onValueChange={(value) => updateSpan({ barrFinish: value as "satin-black" | "pearl-white" })}
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-barr-finish`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satin-black">Satin Black (CN150A)</SelectItem>
                      <SelectItem value="pearl-white">Pearl White (GA078A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium">Layout Mode</Label>
                  <InfoTooltip content="Full Panels + Cut End: Uses full standard panels (1733mm/2205mm/1969mm based on height) with a cut panel at the end. Equally Spaced: Cuts all panels to equal widths for uniform appearance. Both modes accommodate 25mm posts between panels." />
                </div>
                <Select
                  value={span.barrLayoutMode || "full-panels-cut-end"}
                  onValueChange={(value) => updateSpan({ barrLayoutMode: value as "full-panels-cut-end" | "equally-spaced" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-barr-layout-mode`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-panels-cut-end">Full Panels + Cut End</SelectItem>
                    <SelectItem value="equally-spaced">Equally Spaced (All Cut)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.barrLayoutMode || "full-panels-cut-end") === "full-panels-cut-end" 
                    ? "Uses full standard panels with a cut panel at the end (minimum 200mm)" 
                    : "Cuts all panels to equal widths for uniform appearance"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Post Type</Label>
                <Select
                  value={span.barrPostType || "welded-base-plate"}
                  onValueChange={(value) => updateSpan({ barrPostType: value as "welded-base-plate" | "standard" })}
                >
                  <SelectTrigger data-testid={`span-${span.spanId}-barr-post-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welded-base-plate">Welded Base Plate (1280mm)</SelectItem>
                    <SelectItem value="standard">Standard (1800mm/2500mm)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(span.barrPostType || "welded-base-plate") === "welded-base-plate" 
                    ? "Bolted down base plates for concrete surfaces" 
                    : "Inground, wall, or core drilled mounting"}
                </p>
              </div>

              {/* BARR Gate Configuration - post-mounted with position only */}
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
                              gateSize: 975,
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

          {/* Gap Configurations - Hide for BARR, Blade, Tubular, and Hamptons PVC */}
          {productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && !productVariant.startsWith("pvc-hamptons-") && (showLeftGap || showRightGap) && (
            <div className="grid grid-cols-2 gap-4">
              {showLeftGap && isFieldEnabled("left-gap") && (
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

              {showRightGap && isFieldEnabled("right-gap") && (
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
          )}

          {/* Panel Configuration - Hide for BARR, Blade, Tubular, and Hamptons PVC */}
          {(isFieldEnabled("max-panel-width") || isFieldEnabled("desired-gap")) && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && !productVariant.startsWith("pvc-hamptons-") && (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Panel Configuration</h4>
                <InfoTooltip content="Configure the maximum panel width and target gap spacing. The system will calculate the optimal panel layout to achieve your desired gap size." />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {isFieldEnabled("max-panel-width") ? (
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
              {isFieldEnabled("desired-gap") && (
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

          {/* Hardware Configuration - Show spigot OR channel based on product type, hide for BARR, Blade, and Tubular */}
          {productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && productVariant === "glass-pool-channel" ? (
            <div className="space-y-4 pt-4 border-t border-card-border">
              <h4 className="text-sm font-semibold">Channel Hardware</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Channel Mounting</Label>
                  <Select
                    value={span.channelMounting || "ground"}
                    onValueChange={(channelMounting: "wall" | "ground") => 
                      updateSpan({ channelMounting })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-channel-mounting`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wall">Wall Mounted</SelectItem>
                      <SelectItem value="ground">Ground Mounted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
                  <p><strong>Channel System:</strong> Versatilt 4200mm aluminum channel</p>
                  <p><strong>Friction Clamps:</strong> Positioned at 300mm centers</p>
                  <p><strong>Mounting:</strong> {span.channelMounting === "wall" ? "Base mounted" : "Side mounted"}</p>
                </div>
              </div>
            </div>
          ) : productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" ? (
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

          {/* Gate Configuration - only for non-BARR/Blade/Tubular pool fencing and general fencing (not balustrades) */}
          {isFieldEnabled("gate-config") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && (
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

          {/* Raked Panels Configuration - only for non-BARR/Blade/Tubular pool fencing and general fencing (not balustrades) */}
          {isFieldEnabled("raked-panels") && gatesAllowed && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && (
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

          {/* Auto-Calc Configuration - Only for custom-frameless */}
          {productVariant === "custom-frameless" && (
            <div className="space-y-3 pt-4 border-t border-card-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Auto-Calc Configuration</Label>
                  <InfoTooltip content="Specify exact gap values, panel types (standard/gate/hinge), and max panel width. Panel widths are automatically calculated to fit perfectly." />
                </div>
                <Switch
                  checked={span.layoutMode === "auto-calc"}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      layoutMode: enabled ? "auto-calc" : "auto-equalize",
                      autoCalcConfig: enabled ? {
                        maxPanelWidth: 1200,
                        panelHeight: 1500,
                        glassType: "12mm",
                        gapMode: "auto",
                        interPanelGaps: [10],
                        panelTypes: ["standard", "standard"],
                      } : undefined,
                    })
                  }
                  data-testid={`span-${span.spanId}-auto-calc-toggle`}
                />
              </div>
              {span.layoutMode === "auto-calc" && span.autoCalcConfig && (
                <AutoCalcPanelControls
                  autoCalcConfig={span.autoCalcConfig}
                  spanLength={span.length}
                  leftGapSize={span.leftGap?.size || 0}
                  rightGapSize={span.rightGap?.size || 0}
                  spanId={span.spanId}
                  onUpdate={(autoCalcConfig) => updateSpan({ autoCalcConfig })}
                />
              )}
            </div>
          )}

          {/* Custom Panel - Hide for BARR, Blade, and Tubular */}
          {isFieldEnabled("custom-panel") && productVariant !== "alu-pool-barr" && productVariant !== "alu-pool-blade" && productVariant !== "alu-pool-tubular" && (
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
        </div>
      )}
    </Card>
  );
}
