import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig } from "@shared/schema";
import { calculatePanelLayout } from "@shared/panelCalculations";
import { GapSlider } from "./gap-slider";
import { NumericInput } from "./numeric-input";
import { GateControls } from "./gate-controls";

interface SpanConfigPanelProps {
  span: SpanConfig;
  onUpdate: (span: SpanConfig) => void;
  showTopGap?: boolean;
  showBottomGap?: boolean;
  showLeftGap?: boolean;
  showRightGap?: boolean;
}

export function SpanConfigPanel({
  span,
  onUpdate,
  showTopGap,
  showBottomGap,
  showLeftGap,
  showRightGap,
}: SpanConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateSpan = (updates: Partial<SpanConfig>) => {
    // Disable raked panels if max panel width is changed from 1200mm
    if (updates.maxPanelWidth !== undefined && updates.maxPanelWidth !== 1200) {
      updates.leftRakedPanel = undefined;
      updates.rightRakedPanel = undefined;
    }
    onUpdate({ ...span, ...updates });
  };

  // Calculate panel layout whenever relevant parameters change
  useEffect(() => {
    // Calculate total end gaps
    let endGaps = 0;
    if (span.leftGap?.enabled) endGaps += span.leftGap.size;
    if (span.rightGap?.enabled) endGaps += span.rightGap.size;
    if (span.topGap?.enabled) endGaps += span.topGap.size;
    if (span.bottomGap?.enabled) endGaps += span.bottomGap.size;

    // Calculate panel layout
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
        hingePanelSize: span.gateConfig.hingePanelSize,
        position: span.gateConfig.position,
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
      span.leftGap, span.rightGap, span.topGap, span.bottomGap, 
      span.leftRakedPanel, span.rightRakedPanel, onUpdate, span]);

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
    
    // Calculate end gaps
    let endGaps = 0;
    if (span.leftGap?.enabled) endGaps += span.leftGap.size;
    if (span.rightGap?.enabled) endGaps += span.rightGap.size;
    if (span.topGap?.enabled) endGaps += span.topGap.size;
    if (span.bottomGap?.enabled) endGaps += span.bottomGap.size;
    
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

  return (
    <Card className="overflow-hidden" data-testid={`span-${span.spanId}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover-elevate active-elevate-2 text-left"
        data-testid={`span-${span.spanId}-toggle`}
      >
        <h3 className="text-lg font-semibold">Span {span.spanId}</h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="p-6 pt-0 space-y-6 border-t border-card-border">
          {/* Panel Layout Info */}
          {!layoutValidation.valid && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3" data-testid={`span-${span.spanId}-validation-error`}>
              <p className="text-sm text-destructive font-medium">{layoutValidation.message}</p>
            </div>
          )}
          {layoutValidation.valid && (
            <div className="bg-primary/10 border border-primary/20 rounded-md p-3" data-testid={`span-${span.spanId}-panel-layout`}>
              <p className="text-sm font-medium text-primary">{layoutValidation.message}</p>
            </div>
          )}

          {/* Span Length */}
          <NumericInput
            label="Span Length"
            value={span.length}
            onChange={(length) => updateSpan({ length })}
            min={0}
            max={50000}
            step={100}
            unit="mm"
            testId={`span-${span.spanId}-length`}
          />

          {/* Gap Configurations */}
          {showTopGap && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Top Gap (Connects to adjacent side)</Label>
                <Switch
                  checked={span.topGap?.enabled || false}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      topGap: { enabled, position: "inside", size: 100 },
                    })
                  }
                  data-testid={`span-${span.spanId}-top-gap-toggle`}
                />
              </div>
              {span.topGap?.enabled && (
                <>
                  <Select
                    value={span.topGap.position}
                    onValueChange={(position: "inside" | "outside") =>
                      updateSpan({
                        topGap: { ...span.topGap!, position },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-top-gap-position`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inside">Inside</SelectItem>
                      <SelectItem value="outside">Outside</SelectItem>
                    </SelectContent>
                  </Select>
                  <NumericInput
                    label="Gap Size"
                    value={span.topGap.size}
                    onChange={(size) =>
                      updateSpan({
                        topGap: { ...span.topGap!, size },
                      })
                    }
                    min={0}
                    max={150}
                    unit="mm"
                    testId={`span-${span.spanId}-top-gap-size`}
                  />
                </>
              )}
            </div>
          )}

          {showBottomGap && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Bottom Gap (Connects to adjacent side)</Label>
                <Switch
                  checked={span.bottomGap?.enabled || false}
                  onCheckedChange={(enabled) =>
                    updateSpan({
                      bottomGap: { enabled, position: "inside", size: 100 },
                    })
                  }
                  data-testid={`span-${span.spanId}-bottom-gap-toggle`}
                />
              </div>
              {span.bottomGap?.enabled && (
                <>
                  <Select
                    value={span.bottomGap.position}
                    onValueChange={(position: "inside" | "outside") =>
                      updateSpan({
                        bottomGap: { ...span.bottomGap!, position },
                      })
                    }
                  >
                    <SelectTrigger data-testid={`span-${span.spanId}-bottom-gap-position`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inside">Inside</SelectItem>
                      <SelectItem value="outside">Outside</SelectItem>
                    </SelectContent>
                  </Select>
                  <NumericInput
                    label="Gap Size"
                    value={span.bottomGap.size}
                    onChange={(size) =>
                      updateSpan({
                        bottomGap: { ...span.bottomGap!, size },
                      })
                    }
                    min={0}
                    max={150}
                    unit="mm"
                    testId={`span-${span.spanId}-bottom-gap-size`}
                  />
                </>
              )}
            </div>
          )}

          {showLeftGap && (
            <GapSlider
              label="Left Gap (Connects to adjacent side)"
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
          )}

          {showRightGap && (
            <GapSlider
              label="Right Gap (Connects to adjacent side)"
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
          )}

          {/* Panel Configuration */}
          <div className="space-y-4 pt-4 border-t border-card-border">
            <h4 className="text-sm font-semibold">Panel Configuration</h4>
            
            <div className="grid grid-cols-2 gap-4">
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

          {/* Raked Panels Configuration */}
          <div className="space-y-4 pt-4 border-t border-card-border">
            <h4 className="text-sm font-semibold">Raked Panels (for slopes/stairs)</h4>
            
            {span.maxPanelWidth !== 1200 && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                Raked panels require 1200mm panel width. Please set Max Panel Width to 1200mm to enable raked panels.
              </p>
            )}
            
            {/* Left Raked Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Left Raked Panel</Label>
                <Switch
                  checked={span.leftRakedPanel?.enabled || false}
                  disabled={span.maxPanelWidth !== 1200}
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
                  disabled={span.maxPanelWidth !== 1200}
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

          {/* Gate Configuration */}
          <div className="space-y-4 pt-4 border-t border-card-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Gate Required</Label>
              <Switch
                checked={span.gateConfig?.required || false}
                onCheckedChange={(required) =>
                  updateSpan({
                    gateConfig: required
                      ? {
                          required: true,
                          hardware: "master",
                          hingeFrom: "glass",
                          latchTo: "glass",
                          gateSize: 890,
                          hingePanelSize: 1200,
                          position: 0,
                          flipped: false,
                        }
                      : undefined,
                  })
                }
                data-testid={`span-${span.spanId}-gate-toggle`}
              />
            </div>

            {span.gateConfig?.required && (
              <GateControls
                config={span.gateConfig}
                spanId={span.spanId}
                onUpdate={(gateConfig: typeof span.gateConfig) => updateSpan({ gateConfig })}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
