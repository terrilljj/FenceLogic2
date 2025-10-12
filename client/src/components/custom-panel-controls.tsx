import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CustomPanelConfig {
  enabled: boolean;
  width: number;
  height: number;
  position: number;
}

interface CustomPanelControlsProps {
  config: CustomPanelConfig;
  spanId: string | number;
  onUpdate: (config: CustomPanelConfig) => void;
  numPanels?: number; // Number of panels in the span for position limits
  maxPanelWidth?: number; // Maximum panel width from span configuration
}

export function CustomPanelControls({ config, spanId, onUpdate, numPanels = 1, maxPanelWidth = 2000 }: CustomPanelControlsProps) {
  const updateConfig = (updates: Partial<CustomPanelConfig>) => {
    onUpdate({ ...config, ...updates });
  };

  const handleMoveLeft = () => {
    if (config.position > 0) {
      updateConfig({ position: config.position - 1 });
    }
  };

  const handleMoveRight = () => {
    if (config.position < numPanels - 1) {
      updateConfig({ position: config.position + 1 });
    }
  };

  const effectiveMaxWidth = Math.min(maxPanelWidth, 2000);

  return (
    <div className="space-y-4 bg-muted/30 rounded-md p-4" data-testid={`custom-panel-controls-${spanId}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Panel Width (mm)</Label>
            <Input
              type="number"
              min={200}
              max={effectiveMaxWidth}
              step={50}
              value={config.width}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 200;
                updateConfig({ width: Math.min(value, effectiveMaxWidth) });
              }}
              data-testid={`custom-panel-${spanId}-width`}
            />
            <p className="text-xs text-muted-foreground">
              Max: {effectiveMaxWidth}mm (from panel config)
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Panel Height (mm)</Label>
            <Input
              type="number"
              min={1200}
              max={1800}
              step={50}
              value={config.height}
              onChange={(e) => updateConfig({ height: parseInt(e.target.value) || 1200 })}
              data-testid={`custom-panel-${spanId}-height`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Panel Position Controls</Label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleMoveLeft}
              disabled={config.position <= 0}
              data-testid={`custom-panel-${spanId}-move-left`}
            >
              <ChevronLeft className="h-4 w-4" />
              Move Left
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleMoveRight}
              disabled={config.position >= numPanels - 1}
              data-testid={`custom-panel-${spanId}-move-right`}
            >
              Move Right
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Label className="text-sm text-muted-foreground">Position:</Label>
            <span className="text-sm font-medium" data-testid={`custom-panel-${spanId}-position-display`}>
              Panel {config.position + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
