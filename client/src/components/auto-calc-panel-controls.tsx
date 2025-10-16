import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type PanelType = "standard" | "gate" | "hinge" | "raked";

interface AutoCalcConfig {
  maxPanelWidth: number;
  panelHeight: number;
  glassType: "12mm" | "15mm";
  gapMode: "auto" | "manual"; // Auto-calc gaps or user-defined
  interPanelGaps: number[]; // Exact gap values between panels
  panelTypes: PanelType[]; // Type for each panel position
  panelWidthOverrides?: { [index: number]: number }; // Optional width overrides for specific panels
  gateConfigs?: Array<{
    position: number;
    widthMm?: number;
    hardwareType?: string;
  }>;
  hingeConfigs?: Array<{
    position: number;
    widthMm?: number;
  }>;
}

interface AutoCalcPanelControlsProps {
  autoCalcConfig: AutoCalcConfig | undefined;
  spanLength: number;
  leftGapSize: number;
  rightGapSize: number;
  spanId: string | number;
  onUpdate: (autoCalcConfig: AutoCalcConfig) => void;
}

export function AutoCalcPanelControls({
  autoCalcConfig,
  spanLength,
  leftGapSize,
  rightGapSize,
  spanId,
  onUpdate
}: AutoCalcPanelControlsProps) {
  // Initialize with default config if not exists
  const config = autoCalcConfig || {
    maxPanelWidth: 1200,
    panelHeight: 1500,
    glassType: "12mm" as const,
    gapMode: "auto" as const,
    interPanelGaps: [10], // One gap for 2 panels by default
    panelTypes: ["standard", "standard"],
  };

  const { maxPanelWidth, panelHeight, glassType, gapMode, interPanelGaps, panelTypes, panelWidthOverrides } = config;
  const numPanels = panelTypes.length;

  // Calculate auto panel widths
  const calculatePanelWidths = (): number[] => {
    const totalGaps = interPanelGaps.reduce((sum, gap) => sum + gap, 0);
    const availableForPanels = spanLength - leftGapSize - rightGapSize - totalGaps;
    
    // Count fixed-width panels (overrides, gates, hinges with specified width)
    let fixedWidth = 0;
    let flexiblePanelCount = numPanels;
    
    // Account for width overrides
    if (panelWidthOverrides) {
      Object.values(panelWidthOverrides).forEach(width => {
        fixedWidth += width;
        flexiblePanelCount--;
      });
    }
    
    config.gateConfigs?.forEach(gc => {
      if (gc.widthMm && !panelWidthOverrides?.[gc.position]) {
        fixedWidth += gc.widthMm;
        flexiblePanelCount--;
      }
    });
    
    config.hingeConfigs?.forEach(hc => {
      if (hc.widthMm && !panelWidthOverrides?.[hc.position]) {
        fixedWidth += hc.widthMm;
        flexiblePanelCount--;
      }
    });
    
    const remainingForFlexible = availableForPanels - fixedWidth;
    const calculatedWidth = flexiblePanelCount > 0 ? Math.floor(remainingForFlexible / flexiblePanelCount) : 0;
    
    // Build panel width array
    const panelWidths: number[] = [];
    for (let i = 0; i < numPanels; i++) {
      // Check for width override first
      if (panelWidthOverrides?.[i]) {
        panelWidths.push(panelWidthOverrides[i]);
        continue;
      }
      
      const isGate = config.gateConfigs?.find(gc => gc.position === i);
      const isHinge = config.hingeConfigs?.find(hc => hc.position === i);
      
      if (isGate?.widthMm) {
        panelWidths.push(isGate.widthMm);
      } else if (isHinge?.widthMm) {
        panelWidths.push(isHinge.widthMm);
      } else {
        panelWidths.push(Math.min(calculatedWidth, maxPanelWidth));
      }
    }
    
    return panelWidths;
  };

  const panelWidths = calculatePanelWidths();
  const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
  const totalGapWidth = interPanelGaps.reduce((sum, g) => sum + g, 0);
  const totalUsed = leftGapSize + totalPanelWidth + totalGapWidth + rightGapSize;
  const remaining = spanLength - totalUsed;
  const isValid = Math.abs(remaining) <= 2; // ±2mm tolerance

  const updateMaxPanelWidth = (value: number) => {
    onUpdate({ ...config, maxPanelWidth: value });
  };

  const updatePanelHeight = (value: number) => {
    onUpdate({ ...config, panelHeight: value });
  };

  const updateGlassType = (value: "12mm" | "15mm") => {
    onUpdate({ ...config, glassType: value });
  };

  const updateGap = (index: number, value: number) => {
    const newGaps = [...interPanelGaps];
    newGaps[index] = value;
    onUpdate({ ...config, interPanelGaps: newGaps });
  };

  const updatePanelType = (index: number, type: PanelType) => {
    const newTypes = [...panelTypes];
    newTypes[index] = type;
    onUpdate({ ...config, panelTypes: newTypes });
  };

  const applyTypeToAll = (type: PanelType) => {
    const newTypes = Array(numPanels).fill(type);
    onUpdate({ ...config, panelTypes: newTypes });
  };

  const updatePanelWidthOverride = (index: number, widthMm: number | null) => {
    const newOverrides = { ...(panelWidthOverrides || {}) };
    if (widthMm === null) {
      delete newOverrides[index];
    } else {
      newOverrides[index] = widthMm;
    }
    onUpdate({ ...config, panelWidthOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined });
  };

  const addPanel = () => {
    const newTypes = [...panelTypes, "standard" as PanelType];
    const newGaps = [...interPanelGaps, 10];
    onUpdate({ ...config, panelTypes: newTypes, interPanelGaps: newGaps });
  };

  const removePanel = (index: number) => {
    if (numPanels <= 1) return;
    
    const newTypes = panelTypes.filter((_, i) => i !== index);
    // Remove gap: if removing last panel, remove last gap; otherwise remove gap at index
    const newGaps = index === numPanels - 1 
      ? interPanelGaps.slice(0, -1)
      : interPanelGaps.filter((_, i) => i !== index);
    
    onUpdate({ ...config, panelTypes: newTypes, interPanelGaps: newGaps });
  };

  return (
    <div className="space-y-4 bg-muted/30 rounded-md p-4" data-testid={`auto-calc-panel-controls-${spanId}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Auto-Calc Panel Configuration</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={addPanel}
          data-testid={`add-panel-${spanId}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Panel
        </Button>
      </div>

      {/* Panel Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Max Panel Width */}
        <div className="bg-background rounded-md p-3 border">
          <Label className="text-sm font-medium mb-2 block">Max Panel Width</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={500}
              max={2000}
              step={50}
              value={maxPanelWidth}
              onChange={(e) => updateMaxPanelWidth(parseInt(e.target.value) || 1200)}
              className="h-9 w-full"
              data-testid={`max-panel-width-${spanId}`}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">mm</span>
          </div>
        </div>

        {/* Panel Height */}
        <div className="bg-background rounded-md p-3 border">
          <Label className="text-sm font-medium mb-2 block">Panel Height</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1200}
              max={1800}
              step={50}
              value={panelHeight}
              onChange={(e) => updatePanelHeight(parseInt(e.target.value) || 1500)}
              className="h-9 w-full"
              data-testid={`panel-height-${spanId}`}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">mm</span>
          </div>
        </div>

        {/* Glass Type */}
        <div className="bg-background rounded-md p-3 border">
          <Label className="text-sm font-medium mb-2 block">Glass Type</Label>
          <Select
            value={glassType}
            onValueChange={(value) => updateGlassType(value as "12mm" | "15mm")}
          >
            <SelectTrigger className="h-9" data-testid={`glass-type-${spanId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12mm">12mm Toughened</SelectItem>
              <SelectItem value="15mm">15mm Toughened</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Gap Mode */}
        <div className="bg-background rounded-md p-3 border">
          <Label className="text-sm font-medium mb-2 block">Gap Mode</Label>
          <Select
            value={gapMode}
            onValueChange={(value) => onUpdate({ ...config, gapMode: value as "auto" | "manual" })}
          >
            <SelectTrigger className="h-9" data-testid={`gap-mode-${spanId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (with toggle)</SelectItem>
              <SelectItem value="manual">Manual (fixed value)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gap Control - Shows different UI based on mode */}
      <div className="bg-background rounded-md p-3 border">
        <Label className="text-sm font-medium mb-2 block">Between Panel Gap</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={6}
            max={30}
            step={1}
            value={interPanelGaps[0] || 10}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 10;
              // Apply to all gaps
              const newGaps = interPanelGaps.map(() => value);
              onUpdate({ ...config, interPanelGaps: newGaps });
            }}
            className="h-9 w-full"
            data-testid={`between-panel-gap-${spanId}`}
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">mm</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {gapMode === "auto" 
            ? "Use up/down arrows to adjust - panels auto-resize to fit" 
            : "Set fixed gap value - panels auto-resize to fit"}
        </p>
      </div>

      {/* Apply Type to All */}
      <div className="bg-background rounded-md p-3 border">
        <Label className="text-sm font-medium mb-2 block">Quick Apply Type</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("standard")}
            data-testid={`apply-standard-${spanId}`}
          >
            All Standard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("gate")}
            data-testid={`apply-gate-${spanId}`}
          >
            All Gate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("hinge")}
            data-testid={`apply-hinge-${spanId}`}
          >
            All Hinge
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("raked")}
            data-testid={`apply-raked-${spanId}`}
          >
            All Raked
          </Button>
        </div>
      </div>

      {/* Panel Configuration */}
      <div className="space-y-3">
        {panelTypes.map((type, index) => (
          <div key={index} className="space-y-2">

            {/* Panel */}
            <div className="flex items-center gap-2 bg-background rounded-md p-3 border">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Panel {index + 1}</Label>
                  <Badge variant="secondary" className="text-xs">
                    {panelWidths[index]}mm
                  </Badge>
                  {panelWidthOverrides?.[index] && (
                    <Badge variant="outline" className="text-xs">Override</Badge>
                  )}
                </div>
                <Select
                  value={type}
                  onValueChange={(value) => updatePanelType(index, value as PanelType)}
                >
                  <SelectTrigger className="h-9" data-testid={`panel-type-${spanId}-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Glass</SelectItem>
                    <SelectItem value="gate">Gate Panel</SelectItem>
                    <SelectItem value="hinge">Hinge Panel</SelectItem>
                    <SelectItem value="raked">Raked Panel</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Width Override */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={200}
                    max={2000}
                    step={1}
                    placeholder="Auto"
                    value={panelWidthOverrides?.[index] || ""}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      updatePanelWidthOverride(index, value);
                    }}
                    className="h-8 text-xs"
                    data-testid={`panel-width-override-${spanId}-${index}`}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">mm (override)</span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removePanel(index)}
                disabled={numPanels <= 1}
                className="h-9 w-9"
                data-testid={`remove-panel-${spanId}-${index}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className={`rounded-md border p-3 ${isValid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-destructive/10 border-destructive/50'}`}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Total Length:</span>
            <span className="ml-2 font-medium">{totalUsed}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Available:</span>
            <span className="ml-2 font-medium">{spanLength}mm</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Remaining:</span>
            <span className={`ml-2 font-semibold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {remaining > 0 ? '+' : ''}{remaining}mm
            </span>
            {!isValid && (
              <span className="ml-2 text-destructive text-xs">(Must be within ±2mm)</span>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <div className="flex justify-between">
          <span>Left Gap:</span>
          <span>{leftGapSize}mm</span>
        </div>
        <div className="flex justify-between">
          <span>Panels ({numPanels}):</span>
          <span>{totalPanelWidth}mm</span>
        </div>
        <div className="flex justify-between">
          <span>Inter-Panel Gaps ({interPanelGaps.length}):</span>
          <span>{totalGapWidth}mm</span>
        </div>
        <div className="flex justify-between">
          <span>Right Gap:</span>
          <span>{rightGapSize}mm</span>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t">
          <span>Total:</span>
          <span>{totalUsed}mm</span>
        </div>
      </div>

      {!isValid && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            Adjust number of panels, gaps, or max panel width to fit within ±2mm tolerance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
