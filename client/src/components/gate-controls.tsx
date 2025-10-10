import { ArrowLeftRight, FlipHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GateConfig {
  required: boolean;
  hardware: "master" | "polaris";
  hingeFrom: "glass" | "wall";
  latchTo: "glass" | "wall";
  gateSize: number;
  hingePanelSize: number;
  position: number;
  flipped: boolean;
}

interface GateControlsProps {
  config: GateConfig;
  spanId: number;
  onUpdate: (config: GateConfig) => void;
}

export function GateControls({ config, spanId, onUpdate }: GateControlsProps) {
  const updateConfig = (updates: Partial<GateConfig>) => {
    onUpdate({ ...config, ...updates });
  };

  // Valid gate sizes for each hardware type
  const polarisGateSizes = [800, 900];
  const masterGateSizes = [750, 834, 890, 1000];

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
            <Label className="text-sm font-medium">Hinge From</Label>
            <Select
              value={config.hingeFrom}
              onValueChange={(hingeFrom: "glass" | "wall") => updateConfig({ hingeFrom })}
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">Hinge Panel</Label>
            <Select
              value={config.hingePanelSize.toString()}
              onValueChange={(hingePanelSize) => updateConfig({ hingePanelSize: parseInt(hingePanelSize) })}
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
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-border">
        <Label className="text-sm font-medium">Gate Position Controls</Label>
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
            onClick={() => updateConfig({ position: Math.max(0, config.position - 1) })}
            data-testid={`gate-${spanId}-move-left`}
            disabled={config.position === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Move Left
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => updateConfig({ position: config.position + 1 })}
            data-testid={`gate-${spanId}-move-right`}
          >
            <ChevronRight className="w-4 h-4 mr-2" />
            Move Right
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => updateConfig({ hingeFrom: config.hingeFrom === "glass" ? "wall" : "glass" })}
            data-testid={`gate-${spanId}-switch-end`}
          >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Switch End
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Position:</span>
          <span className="font-mono font-medium">Panel {config.position + 1}</span>
        </div>
      </div>
    </div>
  );
}
