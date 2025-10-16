import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type PanelType = "standard" | "gate" | "hinge";
type LayoutMode = "auto" | "manual-qty" | "manual-individual";

interface AutoCalcConfig {
  layoutMode?: LayoutMode;
  maxPanelWidth: number;
  panelHeight: number;
  glassType: "12mm" | "15mm";
  gapMode: "auto" | "manual";
  interPanelGaps: number[];
  panelTypes: PanelType[];
  panelWidthOverrides?: { [index: number]: number };
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
    layoutMode: "auto" as const,
    maxPanelWidth: 1500,
    panelHeight: 1500,
    glassType: "12mm" as const,
    gapMode: "auto" as const,
    interPanelGaps: [50],
    panelTypes: ["standard", "standard"],
  };

  const { layoutMode = "auto", maxPanelWidth, panelHeight, glassType, gapMode, interPanelGaps, panelTypes, panelWidthOverrides } = config;
  const numPanels = panelTypes.length;
  const gapSize = interPanelGaps[0] || 50;

  // Auto-calculate number of panels that fit with max panel width
  const autoCalculatePanelCount = (): number => {
    const availableLength = spanLength - leftGapSize - rightGapSize;
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
    return Math.max(1, numPanels - 1);
  };

  // Calculate panel widths based on mode
  const calculatePanelWidths = (): number[] => {
    // Calculate correct total gaps based on actual number of panels (N panels = N-1 gaps)
    const numGaps = Math.max(0, numPanels - 1);
    const totalGaps = numGaps * gapSize;
    const availableForPanels = spanLength - leftGapSize - rightGapSize - totalGaps;
    
    if (layoutMode === "manual-individual" && panelWidthOverrides) {
      // Use individual overrides
      const panelWidths: number[] = [];
      for (let i = 0; i < numPanels; i++) {
        panelWidths.push(panelWidthOverrides[i] || maxPanelWidth);
      }
      return panelWidths;
    }
    
    // For auto and manual-qty modes, distribute evenly to fill available space
    const baseWidth = numPanels > 0 ? Math.floor(availableForPanels / numPanels) : 0;
    const remainder = availableForPanels - (baseWidth * numPanels);
    
    const panelWidths: number[] = [];
    for (let i = 0; i < numPanels; i++) {
      // Distribute remainder across first panels to fill exactly
      const extraMm = i < remainder ? 1 : 0;
      panelWidths.push(baseWidth + extraMm);
    }
    
    return panelWidths;
  };

  const panelWidths = calculatePanelWidths();
  const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
  const numGaps = Math.max(0, numPanels - 1);
  const totalGapWidth = numGaps * gapSize;
  const totalUsed = leftGapSize + totalPanelWidth + totalGapWidth + rightGapSize;
  const remaining = spanLength - totalUsed;
  const isValid = Math.abs(remaining) <= 2;

  const updateLayoutMode = (mode: LayoutMode) => {
    if (mode === "auto") {
      // Auto-calculate panel count
      const autoPanelCount = autoCalculatePanelCount();
      const newTypes = Array(autoPanelCount).fill("standard");
      const newGaps = Array(autoPanelCount - 1).fill(gapSize);
      onUpdate({
        ...config,
        layoutMode: mode,
        panelTypes: newTypes,
        interPanelGaps: newGaps,
        panelWidthOverrides: undefined,
      });
    } else {
      onUpdate({ ...config, layoutMode: mode });
    }
  };

  const updatePanelCount = (count: number) => {
    const newTypes = Array(count).fill("standard");
    const newGaps = Array(Math.max(0, count - 1)).fill(gapSize);
    onUpdate({
      ...config,
      panelTypes: newTypes,
      interPanelGaps: newGaps,
      panelWidthOverrides: undefined,
    });
  };

  const updatePanelType = (index: number, type: PanelType) => {
    const newTypes = [...panelTypes];
    newTypes[index] = type;
    onUpdate({ ...config, panelTypes: newTypes });
  };

  const updatePanelWidth = (index: number, width: number) => {
    const newOverrides = { ...(panelWidthOverrides || {}) };
    newOverrides[index] = width;
    onUpdate({ ...config, panelWidthOverrides: newOverrides });
  };

  const clearPanelOverride = (index: number) => {
    if (!panelWidthOverrides) return;
    const newOverrides = { ...panelWidthOverrides };
    delete newOverrides[index];
    onUpdate({ ...config, panelWidthOverrides: newOverrides });
  };

  const addPanel = () => {
    const newTypes = [...panelTypes, "standard" as PanelType];
    const newGaps = [...interPanelGaps, gapSize];
    onUpdate({
      ...config,
      panelTypes: newTypes,
      interPanelGaps: newGaps,
    });
  };

  const removePanel = (index: number) => {
    if (panelTypes.length <= 1) return;
    
    const newTypes = panelTypes.filter((_, i) => i !== index);
    const newGaps = interPanelGaps.filter((_, i) => {
      if (index === 0) return i !== 0;
      return i !== index - 1;
    });
    
    const newOverrides = { ...(panelWidthOverrides || {}) };
    delete newOverrides[index];
    
    onUpdate({
      ...config,
      panelTypes: newTypes,
      interPanelGaps: newGaps.length > 0 ? newGaps : [gapSize],
      panelWidthOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
    });
  };

  const updateMaxPanelWidth = (value: number) => {
    // If in auto mode, recalculate panel count with new max width
    if (layoutMode === "auto") {
      const availableLength = spanLength - leftGapSize - rightGapSize;
      let numPanels = 1;
      
      while (numPanels <= 20) {
        const totalGaps = (numPanels - 1) * gapSize;
        const totalPanelWidth = numPanels * value;
        if (totalPanelWidth + totalGaps <= availableLength) {
          numPanels++;
        } else {
          break;
        }
      }
      const autoPanelCount = Math.max(1, numPanels - 1);
      const newTypes = Array(autoPanelCount).fill("standard");
      const newGaps = Array(autoPanelCount - 1).fill(gapSize);
      
      onUpdate({
        ...config,
        maxPanelWidth: value,
        panelTypes: newTypes,
        interPanelGaps: newGaps,
        panelWidthOverrides: undefined,
      });
    } else {
      onUpdate({ ...config, maxPanelWidth: value });
    }
  };

  const updatePanelHeight = (value: number) => {
    onUpdate({ ...config, panelHeight: value });
  };

  const updateGlassType = (value: "12mm" | "15mm") => {
    onUpdate({ ...config, glassType: value });
  };

  const applyTypeToAll = (type: PanelType) => {
    const newTypes = panelTypes.map(() => type);
    onUpdate({ ...config, panelTypes: newTypes });
  };

  return (
    <div className="space-y-4">
      {/* Layout Mode Selector - First Input */}
      <div className="bg-card rounded-md p-4 border">
        <Label className="text-sm font-medium mb-3 block">Panel Layout Mode</Label>
        <Select
          value={layoutMode}
          onValueChange={(value) => updateLayoutMode(value as LayoutMode)}
        >
          <SelectTrigger className="h-9" data-testid={`layout-mode-${spanId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto Set Panel Widths</SelectItem>
            <SelectItem value="manual-qty">Manual Set Qty of Panels</SelectItem>
            <SelectItem value="manual-individual">Manual Set Every Panel</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-2">
          {layoutMode === "auto" && "Automatically calculates number of panels based on default 1200mm width"}
          {layoutMode === "manual-qty" && "Specify the number of panels - widths auto-calculated to fit"}
          {layoutMode === "manual-individual" && "Set width for each individual panel"}
        </p>
      </div>

      {/* Panel Count - Only for Manual Qty Mode */}
      {layoutMode === "manual-qty" && (
        <div className="bg-card rounded-md p-4 border">
          <Label className="text-sm font-medium mb-3 block">Number of Panels</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={20}
              value={numPanels}
              onChange={(e) => updatePanelCount(parseInt(e.target.value) || 1)}
              className="h-9"
              data-testid={`panel-count-${spanId}`}
            />
            <span className="text-sm text-muted-foreground">panels</span>
          </div>
        </div>
      )}

      {/* Add/Remove Panels - Only for Manual Individual Mode */}
      {layoutMode === "manual-individual" && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addPanel}
            className="flex-1"
            data-testid={`add-panel-${spanId}`}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Panel
          </Button>
        </div>
      )}

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
          <div className="flex flex-col gap-2">
            <Select
              value={panelHeight === 1000 ? "1000" : panelHeight === 1200 ? "1200" : "manual"}
              onValueChange={(value) => {
                if (value === "1000") {
                  updatePanelHeight(1000);
                } else if (value === "1200") {
                  updatePanelHeight(1200);
                } else {
                  // For manual, keep current value or default to 1500
                  if (panelHeight === 1000 || panelHeight === 1200) {
                    updatePanelHeight(1500);
                  }
                }
              }}
            >
              <SelectTrigger className="h-9" data-testid={`panel-height-selector-${spanId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1000mm</SelectItem>
                <SelectItem value="1200">1200mm</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            {panelHeight !== 1000 && panelHeight !== 1200 && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1000}
                  max={1800}
                  step={50}
                  value={panelHeight}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1000;
                    updatePanelHeight(Math.max(1000, value));
                  }}
                  className="h-9 flex-1"
                  data-testid={`panel-height-manual-${spanId}`}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">mm</span>
              </div>
            )}
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
      </div>

      {/* Panel Types Configuration */}
      <div className="bg-card rounded-md p-4 border space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Panel Types</Label>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => applyTypeToAll("standard")}
              data-testid={`apply-standard-all-${spanId}`}
            >
              All Standard
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => applyTypeToAll("gate")}
              data-testid={`apply-gate-all-${spanId}`}
            >
              All Gate
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => applyTypeToAll("hinge")}
              data-testid={`apply-hinge-all-${spanId}`}
            >
              All Hinge
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {panelTypes.map((type, index) => (
            <div key={index} className="flex items-center gap-2">
              <Badge variant="outline" className="w-20 justify-center">
                Panel {index + 1}
              </Badge>
              <Select
                value={type}
                onValueChange={(value) => updatePanelType(index, value as PanelType)}
              >
                <SelectTrigger className="h-9 flex-1" data-testid={`panel-type-${spanId}-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Glass</SelectItem>
                  <SelectItem value="gate">Gate Panel</SelectItem>
                  <SelectItem value="hinge">Hinge Panel</SelectItem>
                </SelectContent>
              </Select>
              <Badge className={
                type === "standard" ? "bg-blue-500" : 
                type === "gate" ? "bg-green-500" : 
                "bg-orange-500"
              }>
                {panelWidths[index]}mm
              </Badge>
              {layoutMode === "manual-individual" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removePanel(index)}
                  disabled={panelTypes.length <= 1}
                  data-testid={`remove-panel-${spanId}-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <Alert variant={isValid ? "default" : "destructive"}>
        <AlertDescription className="text-sm">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Section Length:</span>
              <span className="font-medium">{spanLength}mm</span>
            </div>
            <div className="flex justify-between">
              <span>Left Gap:</span>
              <span className="font-medium">{leftGapSize}mm</span>
            </div>
            <div className="flex justify-between">
              <span>Total Panel Width:</span>
              <span className="font-medium">{totalPanelWidth}mm</span>
            </div>
            <div className="flex justify-between">
              <span>Total Gap Width:</span>
              <span className="font-medium">{totalGapWidth}mm</span>
            </div>
            <div className="flex justify-between">
              <span>Right Gap:</span>
              <span className="font-medium">{rightGapSize}mm</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span>Total Used:</span>
              <span className="font-medium">{totalUsed}mm</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className={`font-medium ${isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {remaining > 0 ? '+' : ''}{remaining}mm
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
