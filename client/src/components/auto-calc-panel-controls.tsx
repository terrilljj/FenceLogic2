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

interface SemiFramelessPostConfig {
  lhsPostType?: "wall" | "end" | "corner-in" | "corner-out";
  rhsPostType?: "wall" | "end" | "corner-in" | "corner-out";
}

interface AutoCalcPanelControlsProps {
  autoCalcConfig: AutoCalcConfig | undefined;
  spanLength: number;
  leftGapSize: number;
  rightGapSize: number;
  spanId: string | number;
  onUpdate: (autoCalcConfig: AutoCalcConfig) => void;
  postConfig?: SemiFramelessPostConfig;
}

export function AutoCalcPanelControls({
  autoCalcConfig,
  spanLength,
  leftGapSize,
  rightGapSize,
  spanId,
  onUpdate,
  postConfig
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

  // Helper: Calculate spacing to glass based on post type
  const getPostSpacing = (postType: "wall" | "end" | "corner-in" | "corner-out" | undefined): number => {
    // Wall post: 40mm (50mm post, glass shuffles 10mm)
    // End post: 90mm (50mm gap + 50mm post - 10mm shuffle = 90mm)
    // Corner: 40mm (same as wall)
    switch (postType) {
      case "end":
        return 90;
      case "wall":
      case "corner-in":
      case "corner-out":
      default:
        return 40;
    }
  };

  // Auto-calculate optimal solution using mixed stock panels
  // Try combinations of 2 adjacent stock sizes (e.g., 950+1000)
  // If custom needed, constrain it within the 50mm stock range
  const autoCalculatePanelCount = (): { 
    stockCount: number; 
    customWidth: number; 
    totalPanels: number;
    stockWidth: number;
    stock1Width?: number;
    stock1Count?: number;
    stock2Width?: number;
    stock2Count?: number;
  } => {
    // USER'S EXACT POST DATA - NO SHUFFLE, NO GAPS
    const INTERMEDIATE_POST_MM = 30; // Core posts between panels
    
    // Calculate actual spacing based on post types
    const lhsSpacing = getPostSpacing(postConfig?.lhsPostType);
    const rhsSpacing = getPostSpacing(postConfig?.rhsPostType);
    
    // Available space for panels = section length - LHS spacing - RHS spacing
    const availableSpace = spanLength - lhsSpacing - rhsSpacing;
    
    console.log('🔍 Auto-calc params:', {
      spanLength,
      lhsSpacing,
      rhsSpacing,
      availableSpace,
      panelHeight,
      glassType,
      maxPanelWidth
    });
    
    // Get all available stock widths
    const availableStockWidths = getAvailableStockPanelWidths(panelHeight, glassType, maxPanelWidth).sort((a, b) => a - b);
    console.log('📦 Available stock widths:', availableStockWidths);
    
    if (availableStockWidths.length === 0) {
      return {
        stockCount: 1,
        customWidth: 1000,
        totalPanels: 2,
        stockWidth: 950,
      };
    }
    
    let bestSolution: any = null;
    let bestScore = Infinity; // Lower score is better
    
    // Scoring function: Prefer fewer panels and larger sizes
    const calculateScore = (panelCount: number, variance: number, avgPanelSize: number) => {
      // Heavy penalty for more panels (want to minimize panel count)
      const panelCountPenalty = panelCount * 1000;
      // Prefer larger panel sizes (inverse of size)
      const sizePenalty = avgPanelSize > 0 ? 10000 / avgPanelSize : 1000;
      // Small penalty for variance
      const variancePenalty = variance * 10;
      
      return panelCountPenalty + sizePenalty + variancePenalty;
    };
    
    // Try combinations of adjacent stock sizes (within 50mm)
    // Start from LARGEST sizes first (reverse order)
    for (let i = availableStockWidths.length - 1; i >= 0; i--) {
      const width1 = availableStockWidths[i];
      
      // Try using only one stock size (limit to reasonable panel counts: 2-10)
      for (let totalPanels = 2; totalPanels <= 10; totalPanels++) {
        const intermediatePosts = (totalPanels - 1) * INTERMEDIATE_POST_MM;
        const panelSpace = availableSpace - intermediatePosts;
        
        // Check if we can use all of width1
        const totalPanelWidth = totalPanels * width1;
        const variance1 = Math.abs(totalPanelWidth - panelSpace);
        
        if (variance1 <= 2) {
          const score = calculateScore(totalPanels, variance1, width1);
          console.log(`  Single: ${totalPanels}x${width1} var=${variance1.toFixed(1)}mm score=${score.toFixed(0)}`);
          if (score < bestScore) {
            bestScore = score;
            bestSolution = {
              stockCount: totalPanels,
              customWidth: 0,
              totalPanels,
              stockWidth: width1,
              stock1Width: width1,
              stock1Count: totalPanels,
              stock2Width: undefined,
              stock2Count: 0,
            };
          }
        }
        
        // Try mixing with adjacent stock size (within 50mm)
        for (let j = i + 1; j < availableStockWidths.length; j++) {
          const width2 = availableStockWidths[j];
          if (width2 - width1 > 50) break; // Only try within 50mm range
          
          // Try different combinations of width1 and width2
          for (let count1 = 1; count1 < totalPanels; count1++) {
            const count2 = totalPanels - count1;
            const totalPanelWidth = count1 * width1 + count2 * width2;
            const variance = Math.abs(totalPanelWidth - panelSpace);
            
            if (variance <= 2) {
              const avgSize = (count1 * width1 + count2 * width2) / totalPanels;
              const score = calculateScore(totalPanels, variance, avgSize);
              console.log(`  Mixed: ${totalPanels}p (${count1}x${width1} + ${count2}x${width2}) var=${variance.toFixed(1)}mm score=${score.toFixed(0)}`);
              if (score < bestScore) {
                bestScore = score;
                bestSolution = {
                  stockCount: totalPanels,
                  customWidth: 0,
                  totalPanels,
                  stockWidth: width1, // Primary stock width
                  stock1Width: width1,
                  stock1Count: count1,
                  stock2Width: width2,
                  stock2Count: count2,
                };
              }
            }
          }
        }
      }
    }
    
    // If no perfect stock combination found, fall back to stock + custom
    if (!bestSolution) {
      // Use LARGEST stock size available (within maxPanelWidth) as the primary stock
      const defaultStockWidth = availableStockWidths[availableStockWidths.length - 1] || 950;
      
      // Limit to reasonable panel counts: 1-6 stock panels + 1 custom
      for (let stockCount = 1; stockCount <= 6; stockCount++) {
        const totalPanels = stockCount + 1;
        const intermediatePosts = (totalPanels - 1) * INTERMEDIATE_POST_MM;
        const panelSpace = availableSpace - intermediatePosts;
        const totalStockWidth = stockCount * defaultStockWidth;
        const customPanelWidth = panelSpace - totalStockWidth;
        
        // CRITICAL: Custom panel MUST NOT exceed maxPanelWidth
        if (customPanelWidth > maxPanelWidth) {
          console.log(`  ❌ Stock+Custom rejected: custom ${customPanelWidth}mm > max ${maxPanelWidth}mm`);
          continue; // Skip this combination
        }
        
        if (customPanelWidth >= 300 && customPanelWidth <= maxPanelWidth) {
          const avgSize = (stockCount * defaultStockWidth + customPanelWidth) / totalPanels;
          const variance = 0; // No variance since we're using exact calculation
          const score = calculateScore(totalPanels, variance, avgSize);
          console.log(`  Stock+Custom: ${stockCount}x${defaultStockWidth} + 1x${Math.round(customPanelWidth)} score=${score.toFixed(0)}`);
          
          if (score < bestScore) {
            bestScore = score;
            bestSolution = {
              stockCount,
              customWidth: Math.round(customPanelWidth),
              totalPanels,
              stockWidth: defaultStockWidth,
              stock1Width: defaultStockWidth,
              stock1Count: stockCount,
              stock2Width: undefined,
              stock2Count: 0,
            };
          }
        }
      }
    }
    
    const finalSolution = bestSolution || {
      stockCount: 1,
      customWidth: 1000,
      totalPanels: 2,
      stockWidth: 950,
    };
    
    console.log('✅ Auto-calc solution:', finalSolution);
    return finalSolution;
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
        // Build panel types based on solution (mixed stock or stock+custom)
        const newTypes: PanelType[] = [];
        const newOverrides: Record<number, number> = {};
        
        if (solution.customWidth > 0) {
          // Solution uses stock + custom
          for (let i = 0; i < solution.stockCount; i++) {
            newTypes.push("standard");
          }
          newTypes.push("custom");
          newOverrides[solution.stockCount] = solution.customWidth;
        } else if (solution.stock2Width && solution.stock2Count && solution.stock2Count > 0) {
          // Solution uses mixed stock (2 different sizes)
          // Add stock1 panels
          for (let i = 0; i < (solution.stock1Count || 0); i++) {
            newTypes.push("standard");
            if (solution.stock1Width) {
              newOverrides[i] = solution.stock1Width;
            }
          }
          // Add stock2 panels
          for (let i = 0; i < solution.stock2Count; i++) {
            const index = (solution.stock1Count || 0) + i;
            newTypes.push("standard");
            newOverrides[index] = solution.stock2Width;
          }
        } else {
          // Solution uses all same stock size
          for (let i = 0; i < solution.totalPanels; i++) {
            newTypes.push("standard");
            if (solution.stock1Width) {
              newOverrides[i] = solution.stock1Width;
            }
          }
        }
        
        const newGaps = Array(solution.totalPanels - 1).fill(30);
        onUpdate({
          ...config,
          panelTypes: newTypes,
          interPanelGaps: newGaps,
          panelWidthOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
          panelSelectionMode: solution.customWidth > 0 ? "stock-plus-custom" as const : "all-stock" as const,
          stockPanelWidth: solution.stockWidth,
          customPanelPosition: solution.customWidth > 0 ? solution.stockCount : undefined,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spanLength, leftGapSize, rightGapSize, maxPanelWidth, gapSize, layoutMode, panelSelectionMode, postConfig?.lhsPostType, postConfig?.rhsPostType]);

  const updateLayoutMode = (mode: LayoutMode) => {
    if (mode === "auto") {
      // Auto-calculate optimal solution
      const solution = autoCalculatePanelCount();
      const newTypes: PanelType[] = [];
      const newOverrides: Record<number, number> = {};
      
      if (solution.customWidth > 0) {
        // Solution uses stock + custom
        for (let i = 0; i < solution.stockCount; i++) {
          newTypes.push("standard");
        }
        newTypes.push("custom");
        newOverrides[solution.stockCount] = solution.customWidth;
      } else if (solution.stock2Width && solution.stock2Count && solution.stock2Count > 0) {
        // Solution uses mixed stock (2 different sizes)
        for (let i = 0; i < (solution.stock1Count || 0); i++) {
          newTypes.push("standard");
          if (solution.stock1Width) {
            newOverrides[i] = solution.stock1Width;
          }
        }
        for (let i = 0; i < solution.stock2Count; i++) {
          const index = (solution.stock1Count || 0) + i;
          newTypes.push("standard");
          newOverrides[index] = solution.stock2Width;
        }
      } else {
        // Solution uses all same stock size
        for (let i = 0; i < solution.totalPanels; i++) {
          newTypes.push("standard");
          if (solution.stock1Width) {
            newOverrides[i] = solution.stock1Width;
          }
        }
      }
      
      const newGaps = Array(solution.totalPanels - 1).fill(30);
      onUpdate({
        ...config,
        layoutMode: mode,
        panelTypes: newTypes,
        interPanelGaps: newGaps,
        panelWidthOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
        panelSelectionMode: solution.customWidth > 0 ? "stock-plus-custom" as const : "all-stock" as const,
        stockPanelWidth: solution.stockWidth,
        customPanelPosition: solution.customWidth > 0 ? solution.stockCount : undefined,
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
      // Calculate optimal solution using the new mixed stock algorithm
      const solution = autoCalculatePanelCount();
      
      // Build panel types based on solution
      const panelTypes: PanelType[] = [];
      const panelWidthOverrides: Record<number, number> = {};
      
      if (solution.customWidth > 0) {
        // Solution uses stock + custom
        for (let i = 0; i < solution.stockCount; i++) {
          panelTypes.push("standard");
        }
        panelTypes.push("custom");
        panelWidthOverrides[solution.stockCount] = solution.customWidth;
      } else if (solution.stock2Width && solution.stock2Count && solution.stock2Count > 0) {
        // Solution uses mixed stock (2 different sizes)
        for (let i = 0; i < (solution.stock1Count || 0); i++) {
          panelTypes.push("standard");
          if (solution.stock1Width) {
            panelWidthOverrides[i] = solution.stock1Width;
          }
        }
        for (let i = 0; i < solution.stock2Count; i++) {
          const index = (solution.stock1Count || 0) + i;
          panelTypes.push("standard");
          panelWidthOverrides[index] = solution.stock2Width;
        }
      } else {
        // Solution uses all same stock size
        for (let i = 0; i < solution.totalPanels; i++) {
          panelTypes.push("standard");
          if (solution.stock1Width) {
            panelWidthOverrides[i] = solution.stock1Width;
          }
        }
      }
      
      const initialConfig = {
        ...config,
        panelTypes,
        interPanelGaps: Array(solution.totalPanels - 1).fill(30),
        panelSelectionMode: solution.customWidth > 0 ? "stock-plus-custom" as const : "all-stock" as const,
        stockPanelWidth: solution.stockWidth,
        panelWidthOverrides: Object.keys(panelWidthOverrides).length > 0 ? panelWidthOverrides : undefined,
        customPanelPosition: solution.customWidth > 0 ? solution.stockCount : undefined,
      };
      
      onUpdate(initialConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Removed: Old all-stock auto-calculation - now using stock+custom as default

  return (
    <div className="space-y-4">
      {/* Panel Selection Mode */}
      <div className="bg-card rounded-md p-4 border space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Panel Selection Mode</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Re-run auto-calculation
              const solution = autoCalculatePanelCount();
              
              // Build panel types based on solution
              const panelTypes: PanelType[] = [];
              const panelWidthOverrides: Record<number, number> = {};
              
              if (solution.customWidth > 0) {
                // Solution uses stock + custom
                for (let i = 0; i < solution.stockCount; i++) {
                  panelTypes.push("standard");
                }
                panelTypes.push("custom");
                panelWidthOverrides[solution.stockCount] = solution.customWidth;
              } else if (solution.stock2Width && solution.stock2Count && solution.stock2Count > 0) {
                // Solution uses mixed stock (2 different sizes)
                for (let i = 0; i < (solution.stock1Count || 0); i++) {
                  panelTypes.push("standard");
                  if (solution.stock1Width) {
                    panelWidthOverrides[i] = solution.stock1Width;
                  }
                }
                for (let i = 0; i < solution.stock2Count; i++) {
                  const index = (solution.stock1Count || 0) + i;
                  panelTypes.push("standard");
                  panelWidthOverrides[index] = solution.stock2Width;
                }
              } else {
                // Solution uses all same stock size
                for (let i = 0; i < solution.totalPanels; i++) {
                  panelTypes.push("standard");
                  if (solution.stock1Width) {
                    panelWidthOverrides[i] = solution.stock1Width;
                  }
                }
              }
              
              const updatedConfig = {
                ...config,
                panelTypes,
                interPanelGaps: Array(solution.totalPanels - 1).fill(30),
                panelSelectionMode: solution.customWidth > 0 ? "stock-plus-custom" as const : "all-stock" as const,
                stockPanelWidth: solution.stockWidth,
                panelWidthOverrides: Object.keys(panelWidthOverrides).length > 0 ? panelWidthOverrides : undefined,
                customPanelPosition: solution.customWidth > 0 ? solution.stockCount : undefined,
              };
              
              onUpdate(updatedConfig);
            }}
            data-testid={`recalculate-${spanId}`}
          >
            Re-calculate
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <Select
            value={panelSelectionMode}
            onValueChange={(value: "all-stock" | "stock-plus-custom" | "all-custom") => {
              console.log("🔄 Panel selection mode changed to:", value);
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
