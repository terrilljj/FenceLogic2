import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { GlassThickness } from "@shared/schema";
import { calculateStockPanelFit } from "@shared/stockPanelFit";
import { findBestStockPanelWidth, getAvailableStockPanelWidths } from "@shared/findBestStockPanelWidth";
import { StockPanelFitDialog } from "./stock-panel-fit-dialog";

type PanelType = "standard" | "gate" | "hinge" | "custom";
type LayoutMode = "auto" | "manual-qty" | "manual-individual";

interface AutoCalcConfig {
  layoutMode?: LayoutMode;
  maxPanelWidth: number;
  panelHeight: number;
  glassType: GlassThickness;
  gapMode: "auto" | "manual";
  interPanelGaps: number[];
  panelTypes: PanelType[];
  panelWidthOverrides?: { [index: number]: number };
  panelSelectionMode?: "all-stock" | "stock-plus-custom" | "all-custom";
  stockPanelWidth?: number;
  customPanelPosition?: number;
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
  // State for stock panel fit dialog
  const [showStockFitDialog, setShowStockFitDialog] = useState(false);
  const [stockFitResult, setStockFitResult] = useState<ReturnType<typeof calculateStockPanelFit> | null>(null);

  // Initialize with default config if not exists
  const config = autoCalcConfig || {
    layoutMode: "auto" as const,
    maxPanelWidth: 1100, // Default 1100mm for semi-frameless
    panelHeight: 1500,
    glassType: "10mm-clear" as const,
    gapMode: "auto" as const,
    interPanelGaps: [30], // Fixed 30mm gaps
    panelTypes: ["standard", "standard"],
    panelSelectionMode: "stock-plus-custom" as const,
    stockPanelWidth: 950, // Actual stock size (not 966)
  };

  const { layoutMode = "auto", maxPanelWidth, panelHeight, glassType, gapMode, interPanelGaps, panelTypes, panelWidthOverrides, panelSelectionMode = "stock-plus-custom", stockPanelWidth = 950 } = config;
  const numPanels = panelTypes.length;
  const gapSize = interPanelGaps[0] || 50;

  // Auto-calculate optimal solution using stock panels + 1 custom panel
  // Semi-frameless with FIXED 30mm gaps
  const autoCalculatePanelCount = (): { 
    stockCount: number; 
    customWidth: number; 
    totalPanels: number;
    stockWidth: number;
  } => {
    const FIXED_GAP_MM = 30;
    const POST_WIDTH_MM = 50;
    const SHUFFLE_PER_SIDE_MM = 10;
    // Section length does NOT include wall posts - it's the clear span
    const availableSpace = spanLength;
    
    // Find best stock width available (must be actual stock size!)
    const availableStockWidths = getAvailableStockPanelWidths(panelHeight, glassType, maxPanelWidth);
    // Use 950mm or 1000mm as default for 1800mm panels (closest to old 966mm)
    const defaultStockWidth = stockPanelWidth && availableStockWidths.includes(stockPanelWidth) 
      ? stockPanelWidth 
      : availableStockWidths.find(w => w >= 900 && w <= 1000) 
      || availableStockWidths[Math.floor(availableStockWidths.length / 2)] 
      || 950;
    const stockOpeningWidth = defaultStockWidth - 2 * SHUFFLE_PER_SIDE_MM;
    
    // Calculate optimal panel count and custom width
    let bestSolution = {
      stockCount: 1,
      customWidth: 1000,
      totalPanels: 2,
      stockWidth: defaultStockWidth,
    };
    let smallestDeviation = Infinity;
    
    for (let stockCount = 1; stockCount <= 10; stockCount++) {
      const totalPanels = stockCount + 1; // stock + 1 custom
      const gapCount = totalPanels + 1;
      const corePostCount = totalPanels - 1;
      
      const totalStockOpenings = stockOpeningWidth * stockCount;
      const totalCorePosts = corePostCount * POST_WIDTH_MM;
      const totalGaps = gapCount * FIXED_GAP_MM;
      
      const remainingForCustom = availableSpace - totalStockOpenings - totalCorePosts - totalGaps;
      const customPanelWidth = remainingForCustom + 2 * SHUFFLE_PER_SIDE_MM;
      
      // Check if custom panel is reasonable (between 300mm and 2000mm)
      if (customPanelWidth >= 300 && customPanelWidth <= 2000) {
        const deviation = Math.abs(customPanelWidth - defaultStockWidth);
        if (deviation < smallestDeviation) {
          smallestDeviation = deviation;
          bestSolution = {
            stockCount,
            customWidth: Math.round(customPanelWidth),
            totalPanels,
            stockWidth: defaultStockWidth,
          };
        }
      }
    }
    
    // Validate solution
    if (bestSolution.totalPanels < 1 || bestSolution.stockCount < 0) {
      bestSolution = {
        stockCount: 1,
        customWidth: 1000,
        totalPanels: 2,
        stockWidth: defaultStockWidth,
      };
    }
    
    return bestSolution;
  };

  // Calculate panel widths based on mode
  const calculatePanelWidths = (): number[] => {
    // Calculate correct total gaps based on actual gap values in array
    const totalGaps = interPanelGaps.reduce((sum, gap) => sum + gap, 0);
    const availableForPanels = spanLength - leftGapSize - rightGapSize - totalGaps;
    
    // For gate/hinge panels, use specified widths; standard panels distribute remaining space
    const fixedPanels: { index: number; width: number }[] = [];
    let fixedWidth = 0;
    let standardPanelCount = 0;
    
    for (let i = 0; i < numPanels; i++) {
      if (panelTypes[i] === "gate" || panelTypes[i] === "hinge" || panelTypes[i] === "custom") {
        const width = panelWidthOverrides?.[i] || 
          (panelTypes[i] === "gate" ? 900 : 
           panelTypes[i] === "hinge" ? 1200 : 1000);
        fixedPanels.push({ index: i, width });
        fixedWidth += width;
      } else {
        standardPanelCount++;
      }
    }
    
    // Calculate width for standard panels based on panel selection mode
    let standardPanelWidth: number;
    
    if (panelSelectionMode === "all-stock") {
      // All stock mode: use the selected stock panel width for all standard panels
      standardPanelWidth = stockPanelWidth || 966;
    } else {
      // Stock+custom or all-custom modes: distribute remaining space
      const availableForStandard = availableForPanels - fixedWidth;
      standardPanelWidth = standardPanelCount > 0 ? Math.floor(availableForStandard / standardPanelCount) : 0;
      
      // Enforce maxPanelWidth constraint
      if (standardPanelWidth > maxPanelWidth) {
        standardPanelWidth = maxPanelWidth;
      }
    }
    
    // Build final widths array
    const panelWidths: number[] = [];
    
    for (let i = 0; i < numPanels; i++) {
      const fixedPanel = fixedPanels.find(fp => fp.index === i);
      if (fixedPanel) {
        panelWidths.push(fixedPanel.width);
      } else {
        panelWidths.push(standardPanelWidth);
      }
    }
    
    return panelWidths;
  };

  const panelWidths = calculatePanelWidths();
  const totalPanelWidth = panelWidths.reduce((sum, w) => sum + w, 0);
  const totalGapWidth = interPanelGaps.reduce((sum, gap) => sum + gap, 0);
  const totalUsed = leftGapSize + totalPanelWidth + totalGapWidth + rightGapSize;
  const remaining = spanLength - totalUsed;
  const isValid = Math.abs(remaining) <= 2;

  // Trigger initial calculation and recalculate when key inputs change
  // ALSO detect and fix old "all-stock" configs
  useEffect(() => {
    if (layoutMode === "auto") {
      // Recalculate optimal solution when in auto mode
      const solution = autoCalculatePanelCount();
      
      // Detect old/incorrect configs that need fixing:
      // 1. Wrong panel count
      // 2. Using "all-stock" mode (old default)
      // 3. Not using stock-plus-custom mode
      const needsRecalculation = 
        solution.totalPanels !== panelTypes.length ||
        panelSelectionMode === "all-stock" ||
        panelSelectionMode !== "stock-plus-custom";
      
      if (needsRecalculation) {
        // Build panel types: stock panels + 1 custom at end
        const newTypes: PanelType[] = [
          ...Array(solution.stockCount).fill("standard" as const),
          "custom" as const,
        ];
        
        const newOverrides: Record<number, number> = {
          [solution.stockCount]: solution.customWidth,
        };
        
        const newGaps = Array(solution.totalPanels - 1).fill(30);
        onUpdate({
          ...config,
          panelTypes: newTypes,
          interPanelGaps: newGaps,
          panelWidthOverrides: newOverrides,
          panelSelectionMode: "stock-plus-custom" as const,
          stockPanelWidth: solution.stockWidth,
          customPanelPosition: solution.stockCount,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spanLength, leftGapSize, rightGapSize, maxPanelWidth, gapSize, layoutMode, panelSelectionMode]);

  const updateLayoutMode = (mode: LayoutMode) => {
    if (mode === "auto") {
      // Auto-calculate optimal solution
      const solution = autoCalculatePanelCount();
      const newTypes: PanelType[] = [
        ...Array(solution.stockCount).fill("standard" as const),
        "custom" as const,
      ];
      const newOverrides: Record<number, number> = {
        [solution.stockCount]: solution.customWidth,
      };
      const newGaps = Array(solution.totalPanels - 1).fill(30);
      onUpdate({
        ...config,
        layoutMode: mode,
        panelTypes: newTypes,
        interPanelGaps: newGaps,
        panelWidthOverrides: newOverrides,
        panelSelectionMode: "stock-plus-custom" as const,
        stockPanelWidth: solution.stockWidth,
        customPanelPosition: solution.stockCount,
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

  const updateGap = (index: number, value: number) => {
    const newGaps = [...interPanelGaps];
    newGaps[index] = value;
    onUpdate({ ...config, interPanelGaps: newGaps });
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
    // If in auto mode, recalculate optimal solution with new max width
    if (layoutMode === "auto") {
      // First update the maxPanelWidth
      onUpdate({ ...config, maxPanelWidth: value });
      // The useEffect will trigger auto-recalculation
    } else {
      onUpdate({ ...config, maxPanelWidth: value });
    }
  };

  const updatePanelHeight = (value: number) => {
    onUpdate({ ...config, panelHeight: value });
  };

  const updateGlassType = (value: GlassThickness) => {
    onUpdate({ ...config, glassType: value });
  };

  const updateDefaultGapSize = (value: number) => {
    // Update the default gap size and apply to all gaps that haven't been individually overridden
    // For simplicity, we'll update the first gap (which is the default) and recalculate
    const newGaps = Array(Math.max(0, numPanels - 1)).fill(value);
    onUpdate({ ...config, interPanelGaps: newGaps });
  };

  const applyTypeToAll = (type: PanelType) => {
    const newTypes = panelTypes.map(() => type);
    onUpdate({ ...config, panelTypes: newTypes });
  };

  // Initialize autoCalcConfig on mount if it doesn't exist
  useEffect(() => {
    if (!autoCalcConfig) {
      // Calculate optimal solution using stock panels + 1 custom panel with FIXED 30mm gaps
      const FIXED_GAP_MM = 30;
      const POST_WIDTH_MM = 50;
      const SHUFFLE_PER_SIDE_MM = 10;
      // Section length does NOT include wall posts - it's the clear span
      const availableSpace = spanLength;
      const maxPanelWidth = config.maxPanelWidth;
      
      // Find best stock width available (must be actual stock size!)
      const availableStockWidths = getAvailableStockPanelWidths(config.panelHeight, config.glassType, maxPanelWidth);
      const defaultStockWidth = availableStockWidths.find(w => w >= 900 && w <= 1000) || availableStockWidths[Math.floor(availableStockWidths.length / 2)] || 950;
      const stockOpeningWidth = defaultStockWidth - 2 * SHUFFLE_PER_SIDE_MM;
      
      // Calculate optimal panel count and custom width
      // Try different stock panel counts and find which gives the best custom panel size
      let bestSolution = {
        stockCount: 1,
        customWidth: 1000,
        totalPanels: 2,
      };
      let smallestDeviation = Infinity;
      
      for (let stockCount = 1; stockCount <= 10; stockCount++) {
        const totalPanels = stockCount + 1; // stock + 1 custom
        const gapCount = totalPanels + 1;
        const corePostCount = totalPanels - 1;
        
        const totalStockOpenings = stockOpeningWidth * stockCount;
        const totalCorePosts = corePostCount * POST_WIDTH_MM;
        const totalGaps = gapCount * FIXED_GAP_MM;
        
        const remainingForCustom = availableSpace - totalStockOpenings - totalCorePosts - totalGaps;
        const customPanelWidth = remainingForCustom + 2 * SHUFFLE_PER_SIDE_MM;
        
        // Check if custom panel is reasonable (between 300mm and 2000mm)
        if (customPanelWidth >= 300 && customPanelWidth <= 2000) {
          const deviation = Math.abs(customPanelWidth - defaultStockWidth);
          if (deviation < smallestDeviation) {
            smallestDeviation = deviation;
            bestSolution = {
              stockCount,
              customWidth: Math.round(customPanelWidth),
              totalPanels,
            };
          }
        }
      }
      
      // Validate solution
      if (bestSolution.totalPanels < 1 || bestSolution.stockCount < 0) {
        bestSolution = {
          stockCount: 1,
          customWidth: 1000,
          totalPanels: 2,
        };
      }
      
      // Build panel types: stock panels + 1 custom at end
      const panelTypes: PanelType[] = [
        ...Array(Math.max(0, bestSolution.stockCount)).fill("standard" as const),
        "custom" as const,
      ];
      
      const panelWidthOverrides: Record<number, number> = {
        [bestSolution.stockCount]: bestSolution.customWidth, // Custom panel at end
      };
      
      const initialConfig = {
        ...config,
        panelTypes,
        interPanelGaps: Array(bestSolution.totalPanels - 1).fill(FIXED_GAP_MM),
        panelSelectionMode: "stock-plus-custom" as const,
        stockPanelWidth: defaultStockWidth,
        panelWidthOverrides,
        customPanelPosition: bestSolution.stockCount,
      };
      
      onUpdate(initialConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Removed: Old all-stock auto-calculation - now using stock+custom as default

  return (
    <div className="space-y-4">
      {/* Info about auto calculation */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Panel count auto-calculated based on max width. Mark panels as Gate/Hinge/Custom to set specific widths - standard panels auto-adjust to fill remaining space.
        </AlertDescription>
      </Alert>

      {/* Panel Selection Mode */}
      <div className="bg-card rounded-md p-4 border space-y-3">
        <Label className="text-sm font-medium">Panel Selection Mode</Label>
        <div className="grid grid-cols-1 gap-3">
          <Select
            value={panelSelectionMode}
            onValueChange={(value: "all-stock" | "stock-plus-custom" | "all-custom") => {
              onUpdate({ ...config, panelSelectionMode: value });
            }}
          >
            <SelectTrigger className="h-9" data-testid={`panel-selection-mode-${spanId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-stock">All Stock Panels</SelectItem>
              <SelectItem value="stock-plus-custom">Stock Panels + 1 Custom</SelectItem>
              <SelectItem value="all-custom">All Custom Panels</SelectItem>
            </SelectContent>
          </Select>

          {(panelSelectionMode === "stock-plus-custom" || panelSelectionMode === "all-stock") && (
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Stock Panel Width:</Label>
              {panelSelectionMode === "all-stock" ? (
                <Select
                  value={stockPanelWidth.toString()}
                  onValueChange={(value) => {
                    onUpdate({ ...config, stockPanelWidth: parseInt(value) });
                  }}
                >
                  <SelectTrigger className="h-9 flex-1" data-testid={`stock-panel-width-${spanId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableStockPanelWidths(panelHeight, glassType, maxPanelWidth).map((width) => (
                      <SelectItem key={width} value={width.toString()}>
                        {width}mm panel (opening: {width - 20}mm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input
                    type="number"
                    min={200}
                    max={2000}
                    step={50}
                    value={stockPanelWidth}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 966;
                      onUpdate({ ...config, stockPanelWidth: value });
                    }}
                    className="h-9 flex-1"
                    data-testid={`stock-panel-width-${spanId}`}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">mm</span>
                </>
              )}
            </div>
          )}
        </div>

        {(panelSelectionMode === "stock-plus-custom" || panelSelectionMode === "all-stock") && (
          <div className="pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // First try to fit with ±50mm tolerance across ALL available stock widths
                const bestFit = findBestStockPanelWidth({
                  sectionLengthMm: spanLength,
                  panelHeight,
                  glassType,
                  maxPanelWidth,
                  minGapMm: 6,
                  maxGapMm: 100,
                  postWidthMm: 50,
                  shufflePerSideMm: 10,
                  lengthToleranceMm: 50, // ±50mm tolerance
                });

                // If stock panels can fit within ±50mm tolerance
                if (bestFit.canFit) {
                  const variance = bestFit.lengthAdjustment || 0;
                  if (variance === 0) {
                    alert(`✓ Stock panels fit perfectly!\n\nUsing ${bestFit.panelCount} × ${bestFit.stockPanelWidth}mm stock panels\nGaps: ${bestFit.averageGap?.toFixed(1)}mm\nVariance: 0mm`);
                  } else {
                    alert(`✓ Stock panels fit within ±50mm tolerance!\n\nUsing ${bestFit.panelCount} × ${bestFit.stockPanelWidth}mm stock panels\nAdjust section: ${variance > 0 ? '+' : ''}${variance}mm\nNew length: ${spanLength + variance}mm\nGaps: ${bestFit.averageGap?.toFixed(1)}mm`);
                  }
                  return;
                }

                // Stock panels can't fit within ±50mm tolerance
                // Use the best stock width found to calculate alternative solutions
                const fitResult = calculateStockPanelFit({
                  sectionLengthMm: spanLength,
                  stockPanelWidthMm: bestFit.stockPanelWidth, // Use the best stock width found
                  minGapMm: 6,
                  maxGapMm: 100,
                  postWidthMm: 50,
                  shufflePerSideMm: 10,
                });

                // Show dialog with options
                setStockFitResult(fitResult);
                setShowStockFitDialog(true);
              }}
              data-testid={`check-stock-fit-${spanId}`}
            >
              Check Stock Panel Fit
            </Button>
          </div>
        )}
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
            onValueChange={(value) => updateGlassType(value as GlassThickness)}
          >
            <SelectTrigger className="h-9" data-testid={`glass-type-${spanId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10mm-clear">10mm Clear</SelectItem>
              <SelectItem value="10mm-obscure">10mm Obscure</SelectItem>
              <SelectItem value="12mm">12mm Toughened</SelectItem>
              <SelectItem value="15mm">15mm Toughened</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Gap Size */}
        <div className="bg-background rounded-md p-3 border">
          <Label className="text-sm font-medium mb-2 block">Gap Between Panels</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={500}
              step={10}
              value={gapSize}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 50;
                updateDefaultGapSize(value);
              }}
              className="h-9 flex-1"
              data-testid={`default-gap-${spanId}`}
            />
            <span className="text-sm text-muted-foreground">mm</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Default gap size (can override individual gaps below)
          </p>
        </div>
      </div>

      {/* Panel Types Configuration */}
      <div className="bg-card rounded-md p-4 border space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Panel Configuration ({numPanels} panels auto-calculated)</Label>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => applyTypeToAll("standard")}
            data-testid={`apply-standard-all-${spanId}`}
          >
            Reset All to Auto-Sized
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {panelTypes.map((type, index) => (
            <div key={index} className="space-y-2">
              {/* Panel Row */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center shrink-0">
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
                    <SelectItem value="standard">Auto-Sized (Custom Cut)</SelectItem>
                    <SelectItem value="gate">Gate Panel</SelectItem>
                    <SelectItem value="hinge">Hinge Panel</SelectItem>
                    <SelectItem value="custom">Custom Width</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Show width input for gate/hinge/custom, auto-calculated width for standard */}
                {type === "gate" || type === "hinge" || type === "custom" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      min={200}
                      max={2000}
                      step={50}
                      value={panelWidthOverrides?.[index] || 
                        (type === "gate" ? 900 : 
                         type === "hinge" ? 1200 : 1000)}
                      onChange={(e) => {
                        const defaultWidth = type === "gate" ? 900 : 
                                           type === "hinge" ? 1200 : 1000;
                        const value = parseInt(e.target.value) || defaultWidth;
                        updatePanelWidth(index, value);
                      }}
                      className="h-9 w-24"
                      data-testid={`panel-width-${spanId}-${index}`}
                    />
                    <span className="text-sm text-muted-foreground">mm</span>
                  </div>
                ) : (
                  <Badge className="bg-blue-500 shrink-0">
                    {panelWidths[index]}mm (auto)
                  </Badge>
                )}
              </div>
              
              {/* Gap Row - Show gap after each panel except the last */}
              {index < panelTypes.length - 1 && (
                <div className="flex items-center gap-2 pl-4 border-l-2 border-muted ml-10">
                  <span className="text-sm text-muted-foreground shrink-0">Gap:</span>
                  <Input
                    type="number"
                    min={0}
                    max={500}
                    step={10}
                    value={interPanelGaps[index] || gapSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || gapSize;
                      updateGap(index, value);
                    }}
                    className="h-8 w-24"
                    data-testid={`gap-${spanId}-${index}`}
                  />
                  <span className="text-sm text-muted-foreground">mm</span>
                  {interPanelGaps[index] === gapSize && (
                    <Badge variant="outline" className="text-xs shrink-0">default</Badge>
                  )}
                </div>
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
            {!isValid && (
              <p className="text-xs text-destructive mt-2 pt-2 border-t">
                ⚠️ Length mismatch exceeds tolerance (±2mm). Adjust panel count or max width.
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Stock Panel Fit Dialog */}
      {stockFitResult && (
        <StockPanelFitDialog
          open={showStockFitDialog}
          onOpenChange={setShowStockFitDialog}
          fitResult={stockFitResult}
          currentLengthMm={spanLength}
          stockPanelWidthMm={stockPanelWidth}
          onAdjustLength={(newLengthMm) => {
            // This would need to be handled by the parent component
            // For now, just show a message
            console.log(`Adjust section length to ${newLengthMm}mm`);
          }}
          onUseStockPlusCustom={(customPanelWidth, position) => {
            // Set panel selection mode and configure panels
            onUpdate({
              ...config,
              panelSelectionMode: "stock-plus-custom",
              stockPanelWidth,
              customPanelPosition: position,
            });
          }}
          onUseAllCustom={() => {
            // Switch to all custom mode
            onUpdate({
              ...config,
              panelSelectionMode: "all-custom",
            });
          }}
        />
      )}
    </div>
  );
}
