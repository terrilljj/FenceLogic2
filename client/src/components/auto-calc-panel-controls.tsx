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
  const defaultPanelWidth = 1200;
  
  // Initialize with default config if not exists
  const config = autoCalcConfig || {
    layoutMode: "auto" as const,
    maxPanelWidth: 1200,
    panelHeight: 1500,
    glassType: "12mm" as const,
    gapMode: "auto" as const,
    interPanelGaps: [10],
    panelTypes: ["standard", "standard"],
  };

  const { layoutMode = "auto", maxPanelWidth, panelHeight, glassType, gapMode, interPanelGaps, panelTypes, panelWidthOverrides } = config;
  const numPanels = panelTypes.length;
  const gapSize = interPanelGaps[0] || 10;

  // Auto-calculate number of panels that fit with default panel width
  const autoCalculatePanelCount = (): number => {
    const availableLength = spanLength - leftGapSize - rightGapSize;
    let numPanels = 1;
    
    while (numPanels <= 20) {
      const totalGaps = (numPanels - 1) * gapSize;
      const totalPanelWidth = numPanels * defaultPanelWidth;
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
    const totalGaps = interPanelGaps.reduce((sum, gap) => sum + gap, 0);
    const availableForPanels = spanLength - leftGapSize - rightGapSize - totalGaps;
    
    if (layoutMode === "manual-individual" && panelWidthOverrides) {
      // Use individual overrides
      const panelWidths: number[] = [];
      for (let i = 0; i < numPanels; i++) {
        panelWidths.push(panelWidthOverrides[i] || defaultPanelWidth);
      }
      return panelWidths;
    }
    
    // For auto and manual-qty modes, distribute evenly to fill available space
    const calculatedWidth = numPanels > 0 ? Math.floor(availableForPanels / numPanels) : 0;
    
    const panelWidths: number[] = [];
    for (let i = 0; i < numPanels; i++) {
      panelWidths.push(calculatedWidth);
    }
    
    return panelWidths;
  };

  const panelWidths = calculatePanelWidths();
  const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
  const totalGapWidth = interPanelGaps.reduce((sum, g) => sum + g, 0);
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
    onUpdate({ ...config, maxPanelWidth: value });
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

      {/* Gap Control */}
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
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("standard")}
            className="flex-1"
            data-testid={`apply-standard-${spanId}`}
          >
            All Standard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("gate")}
            className="flex-1"
            data-testid={`apply-gate-${spanId}`}
          >
            All Gate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTypeToAll("hinge")}
            className="flex-1"
            data-testid={`apply-hinge-${spanId}`}
          >
            All Hinge
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
                {/* Panel Type and Width */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap min-w-[80px]">Panel {index + 1}:</Label>
                  <Select
                    value={type}
                    onValueChange={(value) => updatePanelType(index, value as PanelType)}
                  >
                    <SelectTrigger className="h-8 flex-1" data-testid={`panel-type-${spanId}-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="gate">Gate</SelectItem>
                      <SelectItem value="hinge">Hinge</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={500}
                      max={2000}
                      step={50}
                      value={panelWidthOverrides?.[index] || panelWidths[index]}
                      onChange={(e) => updatePanelWidth(index, parseInt(e.target.value) || 1200)}
                      className="h-8 w-24"
                      disabled={layoutMode !== "manual-individual"}
                      data-testid={`panel-width-${spanId}-${index}`}
                    />
                    <span className="text-xs text-muted-foreground">mm</span>
                  </div>
                  {panelWidthOverrides?.[index] && layoutMode === "manual-individual" && (
                    <Badge variant="secondary" className="text-xs">Override</Badge>
                  )}
                </div>
              </div>
              
              {/* Remove Panel Button - Only for Manual Individual */}
              {layoutMode === "manual-individual" && panelTypes.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removePanel(index)}
                  data-testid={`remove-panel-${spanId}-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
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
