import { useState } from "react";
import { ArrowLeftRight, FlipHorizontal, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getGateGaps, HingeType, LatchType } from "@shared/schema";

interface GateConfig {
  required: boolean;
  hardware: "master" | "polaris";
  hingeFrom: "glass" | "wall";
  latchTo: "glass" | "wall";
  hingeType: HingeType;
  latchType: LatchType;
  gateSize: number;
  hingePanelSize: number;
  autoHingePanel: boolean;
  position: number;
  flipped: boolean;
  savedGlassPosition?: number;
  hingeGap: number;
  latchGap: number;
}

interface GateControlsProps {
  config: GateConfig;
  spanId: string | number;
  onUpdate: (config: GateConfig) => void;
  calculatedHingePanelSize?: number; // Auto-calculated hinge panel size when auto is enabled
  numPanels?: number; // Number of panels in the span for position limits
}

export function GateControls({ config, spanId, onUpdate, calculatedHingePanelSize, numPanels = 1 }: GateControlsProps) {
  const [hingeWarningAcknowledged, setHingeWarningAcknowledged] = useState(false);

  const updateConfig = (updates: Partial<GateConfig>) => {
    // Automatically update gaps when hardware or hingeFrom changes
    const newHardware = updates.hardware ?? config.hardware;
    const newHingeFrom = updates.hingeFrom ?? config.hingeFrom;
    const gaps = getGateGaps(newHardware, newHingeFrom);
    
    onUpdate({ ...config, ...updates, ...gaps });
  };

  // Valid gate sizes for each hardware type
  const polarisGateSizes = [800, 900];
  const masterGateSizes = [750, 834, 890, 1000];

  // Calculate position limits based on mount type
  const getPositionLimits = () => {
    if (config.hingeFrom === "wall") {
      // Wall-mounted: only positions 0 (left) or 1 (right) allowed
      return { min: 0, max: 1 };
    } else {
      // Glass-to-glass: 0 to (numPanels - 1)
      return { min: 0, max: Math.max(0, numPanels - 1) };
    }
  };

  const positionLimits = getPositionLimits();

  return (
    <div className="space-y-4 bg-muted/30 rounded-md p-4" data-testid={`gate-controls-${spanId}`}>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Gate Hardware</Label>
          <Select
            value={config.hardware}
            onValueChange={(hardware: "master" | "polaris") => {
              // Check if current gate size is valid for new hardware type
              const validSizes = hardware === "polaris" ? polarisGateSizes : masterGateSizes;
              const currentSizeValid = validSizes.includes(config.gateSize);
              
              // If current size is invalid, use default for new hardware type
              const newGateSize = currentSizeValid ? config.gateSize : (hardware === "polaris" ? 900 : 890);
              
              updateConfig({ hardware, gateSize: newGateSize });
            }}
          >
            <SelectTrigger data-testid={`gate-${spanId}-hardware`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="master">Master Range</SelectItem>
              <SelectItem value="polaris">Polaris Soft Close</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hinge Type</Label>
            <Select
              value={config.hingeType || "standard"}
              onValueChange={(hingeType: HingeType) => updateConfig({ hingeType })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-hinge-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Heavy Duty</SelectItem>
                <SelectItem value="self-close">Premium Self-Closing</SelectItem>
                <SelectItem value="soft-close">Soft Close</SelectItem>
                <SelectItem value="dd-magnamatic">D&D Magnamatic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Latch Type</Label>
            <Select
              value={config.latchType || "key-lock"}
              onValueChange={(latchType: LatchType) => updateConfig({ latchType })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-latch-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key-lock">Key Lock</SelectItem>
                <SelectItem value="magnetic">Magnetic</SelectItem>
                <SelectItem value="self-latch">Self-Latching</SelectItem>
                <SelectItem value="double-action">Double-Action</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hinge From</Label>
            <Select
              value={config.hingeFrom}
              onValueChange={(hingeFrom: "glass" | "wall") => {
                const updates: Partial<GateConfig> = { hingeFrom };
                
                if (hingeFrom === "wall" && config.hingeFrom !== "wall") {
                  // Switching to wall mode: save glass position and normalize to 0 or 1
                  updates.savedGlassPosition = config.position;
                  updates.position = config.position > 0 ? 1 : 0;
                } else if (hingeFrom === "glass" && config.hingeFrom === "wall") {
                  // Switching back to glass mode: restore saved position
                  updates.position = config.savedGlassPosition ?? config.position;
                  updates.savedGlassPosition = undefined;
                }
                
                updateConfig(updates);
              }}
            >
              <SelectTrigger data-testid={`gate-${spanId}-hinge-from`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glass">Glass</SelectItem>
                <SelectItem value="wall">Wall/Post</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Latch To</Label>
            <Select
              value={config.latchTo}
              onValueChange={(latchTo: "glass" | "wall") => updateConfig({ latchTo })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-latch-to`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glass">Glass</SelectItem>
                <SelectItem value="wall">Wall/Post</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gate Size</Label>
            <Select
              value={config.gateSize.toString()}
              onValueChange={(gateSize) => updateConfig({ gateSize: parseInt(gateSize) })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-size`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.hardware === "polaris" ? (
                  <>
                    <SelectItem value="800">800mm</SelectItem>
                    <SelectItem value="900">900mm</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="750">750mm</SelectItem>
                    <SelectItem value="834">834mm</SelectItem>
                    <SelectItem value="890">890mm</SelectItem>
                    <SelectItem value="1000">1000mm</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {config.hingeFrom === "glass" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hinge Panel</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    console.log('Auto button clicked, calculatedHingePanelSize:', calculatedHingePanelSize);
                    if (calculatedHingePanelSize) {
                      console.log('Updating hinge panel to:', calculatedHingePanelSize);
                      updateConfig({ 
                        autoHingePanel: false,
                        hingePanelSize: calculatedHingePanelSize 
                      });
                    } else {
                      console.log('No calculatedHingePanelSize available!');
                    }
                  }}
                  data-testid={`gate-${spanId}-auto-hinge-button`}
                  className="h-7 text-xs"
                >
                  Auto
                </Button>
              </div>
              <Select
                value={config.hingePanelSize.toString()}
                onValueChange={(value) => {
                  updateConfig({ 
                    autoHingePanel: false, 
                    hingePanelSize: parseInt(value) 
                  });
                }}
              >
                <SelectTrigger data-testid={`gate-${spanId}-hinge-panel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.hingePanelSize < 1000 && (
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md mt-2" data-testid={`gate-${spanId}-hinge-warning`}>
                  <Checkbox
                    id={`hinge-warning-${spanId}`}
                    checked={hingeWarningAcknowledged}
                    onCheckedChange={(checked) => setHingeWarningAcknowledged(checked === true)}
                    className="mt-0.5"
                    data-testid={`gate-${spanId}-hinge-warning-checkbox`}
                  />
                  <label htmlFor={`hinge-warning-${spanId}`} className="flex-1 cursor-pointer">
                    Caution: Hinge panels less than 1000mm wide may be too small to support the weight of the gate and must be supported by a glass clip.
                  </label>
                  <TriangleAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-border">
        <Label className="text-sm font-medium">Gate Position Controls</Label>
        {config.hingeFrom === "glass" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => updateConfig({ flipped: !config.flipped })}
                data-testid={`gate-${spanId}-flip`}
              >
                <FlipHorizontal className="w-4 h-4 mr-2" />
                Flip Orientation
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => updateConfig({ position: Math.max(positionLimits.min, config.position - 1) })}
                data-testid={`gate-${spanId}-move-left`}
                disabled={config.position <= positionLimits.min}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Move Left
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => updateConfig({ position: Math.min(positionLimits.max, config.position + 1) })}
                data-testid={`gate-${spanId}-move-right`}
                disabled={config.position >= positionLimits.max}
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Move Right
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-mono font-medium">Panel {config.position + 1}</span>
            </div>
          </>
        )}
        {config.hingeFrom === "wall" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  // Toggle between start (0) and end (1)
                  updateConfig({ position: config.position <= 0 ? 1 : 0 });
                }}
                data-testid={`gate-${spanId}-switch-end`}
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Switch to {config.position <= 0 ? "End" : "Start"}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-mono font-medium">
                {config.position <= 0 ? "Start of Section" : "End of Section"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
