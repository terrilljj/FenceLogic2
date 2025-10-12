import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig, getGateGaps, ProductVariant } from "@shared/schema";
import { calculatePanelLayout } from "@shared/panelCalculations";
import { GapSlider } from "./gap-slider";
import { NumericInput } from "./numeric-input";
import { GateControls } from "./gate-controls";
import { CustomPanelControls } from "./custom-panel-controls";
import { InfoTooltip } from "./info-tooltip";

interface SpanConfigPanelProps {
  span: SpanConfig;
  onUpdate: (span: SpanConfig) => void;
  productVariant?: ProductVariant;
  showLeftGap?: boolean;
  showRightGap?: boolean;
}

export function SpanConfigPanel({
  span,
  onUpdate,
  productVariant = "glass-pool-spigots",
  showLeftGap,
  showRightGap,
}: SpanConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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

    // Calculate auto hinge panel size if enabled
    // For auto mode, calculate a temporary layout first to determine the most common panel size
    let effectiveHingePanelSize = span.gateConfig?.hingePanelSize || 1200;
    
    if (span.gateConfig?.required && span.gateConfig.autoHingePanel) {
      // Valid hinge panel sizes
      const validHingeSizes = [600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];
      
      // Calculate a temporary layout with default hinge size to determine panel sizes
      const tempLayout = calculatePanelLayout(
        span.length,
        endGaps,
        span.desiredGap,
        span.maxPanelWidth,
        span.leftRakedPanel?.enabled || false,
        span.rightRakedPanel?.enabled || false,
        span.gateConfig?.required ? {
          required: span.gateConfig.required,
          gateSize: span.gateConfig.gateSize,
          hingePanelSize: span.maxPanelWidth, // Use max panel width for temp calculation
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
      
      // Find most common panel size from temp layout (excluding gate, hinge, raked, and custom panels)
      const regularPanels = tempLayout.panels.filter((_, i) => {
        const type = tempLayout.panelTypes?.[i];
        return type === "standard"; // Only include standard panels
      });
      
      if (regularPanels.length > 0) {
        // Get most common panel size
        const panelCounts = new Map<number, number>();
        regularPanels.forEach(panel => {
          panelCounts.set(panel, (panelCounts.get(panel) || 0) + 1);
        });
        
        const mostCommon = Array.from(panelCounts.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        const calculatedSize = mostCommon[0];
        
        // Round to nearest valid hinge panel size
        effectiveHingePanelSize = validHingeSizes.reduce((prev, curr) => {
          return Math.abs(curr - calculatedSize) < Math.abs(prev - calculatedSize) ? curr : prev;
        });
      } else {
        // No regular panels yet, use max panel width rounded to nearest valid size
        effectiveHingePanelSize = validHingeSizes.reduce((prev, curr) => {
          return Math.abs(curr - span.maxPanelWidth) < Math.abs(prev - span.maxPanelWidth) ? curr : prev;
        });
      }
    }

    // Calculate final panel layout with the effective hinge panel size
    const layout = calculatePanelLayout(
      span.length,
      endGaps,
      span.desiredGap,
      span.maxPanelWidth,
      span.leftRakedPanel?.enabled || false,
      span.rightRakedPanel?.enabled || false,
      span.gateConfig?.required ? {
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
      span.gateConfig?.required, span.gateConfig?.gateSize, span.gateConfig?.hingePanelSize, span.gateConfig?.autoHingePanel,
      span.gateConfig?.position, span.gateConfig?.flipped, span.gateConfig?.hingeFrom, span.gateConfig?.latchTo,
      span.gateConfig?.hingeGap, span.gateConfig?.latchGap,
      span.gateConfig?.savedGlassPosition,
      span.customPanel?.enabled, span.customPanel?.width, span.customPanel?.height, span.customPanel?.position,
      onUpdate]);

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

  // Calculate auto hinge panel size for display
  const calculateAutoHingePanelSize = (): number | undefined => {
    if (!span.gateConfig?.required || !span.gateConfig.autoHingePanel) {
      return undefined;
    }
    
    // Valid hinge panel sizes
    const validHingeSizes = [600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];
    
    // Use the current panelLayout if available
    if (span.panelLayout?.panels) {
      const regularPanels = span.panelLayout.panels.filter((_, i) => {
        const type = span.panelLayout?.panelTypes?.[i];
        return type === "standard"; // Only include standard panels
      });
      
      if (regularPanels.length > 0) {
        const panelCounts = new Map<number, number>();
        regularPanels.forEach(panel => {
          panelCounts.set(panel, (panelCounts.get(panel) || 0) + 1);
        });
        
        const mostCommon = Array.from(panelCounts.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        const calculatedSize = mostCommon[0];
        
        // Round to nearest valid hinge panel size
        return validHingeSizes.reduce((prev, curr) => {
          return Math.abs(curr - calculatedSize) < Math.abs(prev - calculatedSize) ? curr : prev;
        });
      }
    }
    
    // Round max panel width to nearest valid size
    return validHingeSizes.reduce((prev, curr) => {
      return Math.abs(curr - span.maxPanelWidth) < Math.abs(prev - span.maxPanelWidth) ? curr : prev;
    });
  };
  
  const autoHingePanelSize = calculateAutoHingePanelSize();

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

          {/* Gap Configurations */}
          {(showLeftGap || showRightGap) && (
            <div className="grid grid-cols-2 gap-4">
              {showLeftGap && (
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

              {showRightGap && (
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

          {/* Panel Configuration */}
          <div className="space-y-4 pt-4 border-t border-card-border">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">Panel Configuration</h4>
              <InfoTooltip content="Configure the maximum panel width and target gap spacing. The system will calculate the optimal panel layout to achieve your desired gap size." />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
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
            <GapSlider
              label="Desired Gap Between Panels"
              value={span.desiredGap}
              onChange={(desiredGap) => updateSpan({ desiredGap })}
              min={0}
              max={99}
              testId={`span-${span.spanId}-gap-slider`}
            />
          </div>

          {/* Hardware Configuration - Show spigot OR channel based on product type */}
          {productVariant === "glass-pool-channel" ? (
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
          ) : (
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
          )}

          {/* Gate Configuration */}
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
                        hingeType: "standard",
                        latchType: "key-lock",
                        gateSize: 900,
                        hingePanelSize: 1200,
                        autoHingePanel: true,
                        position: 0,
                        flipped: false,
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
                onUpdate={(gateConfig) => updateSpan({ gateConfig })}
                calculatedHingePanelSize={autoHingePanelSize}
                numPanels={span.panelLayout?.panels.length}
              />
            )}
          </div>

          {/* Raked Panels Configuration */}
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

            {/* Custom Panel */}
            <div className="space-y-3">
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
          </div>
        </div>
      )}
    </Card>
  );
}
