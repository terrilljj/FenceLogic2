import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Ruler, Wrench, Grid3x3 } from "lucide-react";
import type { StockPanelFitResult } from "@shared/stockPanelFit";

interface StockPanelFitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fitResult: StockPanelFitResult;
  currentLengthMm: number;
  stockPanelWidthMm: number;
  onAdjustLength: (newLengthMm: number) => void;
  onUseStockPlusCustom: (customPanelWidth: number, position: number) => void;
  onUseAllCustom: () => void;
}

export function StockPanelFitDialog({
  open,
  onOpenChange,
  fitResult,
  currentLengthMm,
  stockPanelWidthMm,
  onAdjustLength,
  onUseStockPlusCustom,
  onUseAllCustom,
}: StockPanelFitDialogProps) {
  if (fitResult.canFitStock) {
    return null;
  }

  const { suggestedLengthAdjustments, customPanelSolution } = fitResult;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl" data-testid="dialog-stock-panel-fit">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Stock Panels Can't Fit This Section Length
          </AlertDialogTitle>
          <AlertDialogDescription>
            The current section length ({currentLengthMm}mm) cannot accommodate stock {stockPanelWidthMm}mm panels with acceptable gap spacing. 
            Choose one of the following solutions:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          {/* Option 1: Adjust Section Length */}
          {suggestedLengthAdjustments && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Ruler className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Option 1: Adjust Section Length</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Modify the section length to allow all stock {stockPanelWidthMm}mm panels to fit perfectly.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAdjustLength(suggestedLengthAdjustments.shorter);
                        onOpenChange(false);
                      }}
                      data-testid="button-adjust-shorter"
                    >
                      Shorten to {suggestedLengthAdjustments.shorter}mm
                      <span className="ml-1 text-muted-foreground">
                        ({suggestedLengthAdjustments.shorter - currentLengthMm}mm)
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onAdjustLength(suggestedLengthAdjustments.longer);
                        onOpenChange(false);
                      }}
                      data-testid="button-adjust-longer"
                    >
                      Lengthen to {suggestedLengthAdjustments.longer}mm
                      <span className="ml-1 text-muted-foreground">
                        (+{suggestedLengthAdjustments.longer - currentLengthMm}mm)
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Option 2: Stock + 1 Custom */}
          {customPanelSolution && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Wrench className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Option 2: Stock Panels + 1 Custom Panel</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use {customPanelSolution.stockPanelCount} × {customPanelSolution.stockPanelWidth}mm stock panels 
                    plus 1 custom {customPanelSolution.customPanelWidth}mm panel.
                  </p>
                  <div className="bg-muted/50 rounded p-2 text-xs space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock panels:</span>
                      <span className="font-medium">
                        {customPanelSolution.stockPanelCount} × {customPanelSolution.stockPanelWidth}mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custom panel:</span>
                      <span className="font-medium">
                        1 × {customPanelSolution.customPanelWidth}mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Variance from stock:</span>
                      <span className="font-medium">
                        {Math.abs(customPanelSolution.customPanelWidth - customPanelSolution.stockPanelWidth)}mm
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      onUseStockPlusCustom(
                        customPanelSolution.customPanelWidth,
                        customPanelSolution.suggestedPosition
                      );
                      onOpenChange(false);
                    }}
                    data-testid="button-use-stock-plus-custom"
                  >
                    Use Stock + Custom Panels
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Option 3: All Custom */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Grid3x3 className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium mb-1">Option 3: All Custom Panels</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Use custom-cut panels throughout the section, allowing maximum flexibility for exact fit.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onUseAllCustom();
                    onOpenChange(false);
                  }}
                  data-testid="button-use-all-custom"
                >
                  Use All Custom Panels
                </Button>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-dialog"
          >
            Cancel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
