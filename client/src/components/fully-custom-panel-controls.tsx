import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomLayoutPanel {
  widthMm: number;
  heightMm?: number;
}

interface CustomLayoutGap {
  beforeMm: number;
}

interface CustomLayout {
  panels: CustomLayoutPanel[];
  gaps: CustomLayoutGap[];
  enforceExactFit: boolean;
}

interface FullyCustomPanelControlsProps {
  customLayout: CustomLayout | undefined;
  spanLength: number;
  leftGapSize: number;
  rightGapSize: number;
  spanId: string | number;
  onUpdate: (customLayout: CustomLayout) => void;
}

export function FullyCustomPanelControls({ 
  customLayout, 
  spanLength, 
  leftGapSize, 
  rightGapSize, 
  spanId, 
  onUpdate 
}: FullyCustomPanelControlsProps) {
  // Initialize with empty layout if not exists
  const layout = customLayout || {
    panels: [{ widthMm: 1200 }],
    gaps: [],
    enforceExactFit: true,
  };

  const panels = layout.panels;
  const gaps = layout.gaps;

  // Calculate totals
  const totalPanelWidth = panels.reduce((sum, p) => sum + p.widthMm, 0);
  const totalGapWidth = gaps.reduce((sum, g) => sum + g.beforeMm, 0);
  const totalUsed = leftGapSize + totalPanelWidth + totalGapWidth + rightGapSize;
  const availableLength = spanLength;
  const remaining = availableLength - totalUsed;
  const isValid = Math.abs(remaining) <= 1; // ±1mm tolerance

  const updatePanel = (index: number, widthMm: number) => {
    const newPanels = [...panels];
    newPanels[index] = { ...newPanels[index], widthMm };
    onUpdate({ ...layout, panels: newPanels });
  };

  const updateGap = (gapIndex: number, beforeMm: number) => {
    const newGaps = [...gaps];
    newGaps[gapIndex] = { beforeMm };
    onUpdate({ ...layout, gaps: newGaps });
  };

  const addPanel = () => {
    const newPanels = [...panels, { widthMm: 1200 }];
    // Gaps array should have panels.length - 1 elements
    // When adding a panel, add one more gap (will be between second-to-last and new last panel)
    const newGaps = [...gaps, { beforeMm: 10 }];
    onUpdate({ ...layout, panels: newPanels, gaps: newGaps });
  };

  const removePanel = (index: number) => {
    if (panels.length <= 1) return; // Keep at least one panel
    const newPanels = panels.filter((_, i) => i !== index);
    // After removing panel, we need panels.length - 2 gaps (since newPanels has one less)
    // Remove the gap that was after the removed panel, or the last gap if removing last panel
    let newGaps;
    if (index === panels.length - 1) {
      // Removing last panel - remove last gap
      newGaps = gaps.slice(0, -1);
    } else {
      // Removing middle panel - remove gap at same index (gap after this panel)
      newGaps = gaps.filter((_, i) => i !== index);
    }
    onUpdate({ ...layout, panels: newPanels, gaps: newGaps });
  };

  const autoScaleLastPanel = () => {
    if (panels.length === 0) return;
    const lastIndex = panels.length - 1;
    const otherPanelsWidth = panels.slice(0, -1).reduce((sum, p) => sum + p.widthMm, 0);
    const neededWidth = availableLength - leftGapSize - rightGapSize - totalGapWidth - otherPanelsWidth;
    
    if (neededWidth >= 200 && neededWidth <= 2000) {
      updatePanel(lastIndex, neededWidth);
    }
  };

  return (
    <div className="space-y-4 bg-muted/30 rounded-md p-4" data-testid={`fully-custom-panel-controls-${spanId}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Fully Custom Panel Layout</h4>
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

      {/* Length summary */}
      <div className={`rounded-md border p-3 ${isValid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-destructive/10 border-destructive/50'}`}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Total Length:</span>
            <span className="ml-2 font-medium">{totalUsed}mm</span>
          </div>
          <div>
            <span className="text-muted-foreground">Available:</span>
            <span className="ml-2 font-medium">{availableLength}mm</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Remaining:</span>
            <span className={`ml-2 font-semibold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {remaining > 0 ? '+' : ''}{remaining}mm
            </span>
            {!isValid && (
              <span className="ml-2 text-destructive text-xs">(Must be within ±1mm)</span>
            )}
          </div>
        </div>
      </div>

      {/* Auto-scale helper */}
      {!isValid && panels.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          onClick={autoScaleLastPanel}
          className="w-full"
          data-testid={`auto-scale-${spanId}`}
        >
          Auto-Scale Last Panel to Fit
        </Button>
      )}

      {/* Panels list */}
      <div className="space-y-3">
        {panels.map((panel, index) => (
          <div key={index} className="space-y-2">
            {/* Gap before this panel (except first panel) */}
            {index > 0 && (
              <div className="flex items-center gap-2 bg-background rounded-md p-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Gap {index}:</Label>
                <Input
                  type="number"
                  min={6}
                  max={30}
                  step={1}
                  value={gaps[index - 1]?.beforeMm || 10}
                  onChange={(e) => updateGap(index - 1, parseInt(e.target.value) || 10)}
                  className="h-8"
                  data-testid={`gap-${spanId}-${index}`}
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            )}

            {/* Panel */}
            <div className="flex items-center gap-2 bg-background rounded-md p-3 border">
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-medium">Panel {index + 1}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={200}
                    max={2000}
                    step={1}
                    value={panel.widthMm}
                    onChange={(e) => updatePanel(index, parseInt(e.target.value) || 200)}
                    className="h-9"
                    data-testid={`panel-width-${spanId}-${index}`}
                  />
                  <span className="text-sm text-muted-foreground">mm</span>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removePanel(index)}
                disabled={panels.length <= 1}
                className="h-9 w-9"
                data-testid={`remove-panel-${spanId}-${index}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <div className="flex justify-between">
          <span>Left Gap:</span>
          <span>{leftGapSize}mm</span>
        </div>
        <div className="flex justify-between">
          <span>Panels ({panels.length}):</span>
          <span>{totalPanelWidth}mm</span>
        </div>
        <div className="flex justify-between">
          <span>Inter-Panel Gaps ({gaps.length}):</span>
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
            Total length must equal span length within ±1mm. Adjust panel widths or use auto-scale.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
