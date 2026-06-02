import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, FlipHorizontal, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getGateGaps, HingeType, LatchType } from "@shared/schema";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./info-tooltip";

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
  postAdapterPlate?: boolean;
}

interface GateControlsProps {
  config: GateConfig;
  spanId: string | number;
  onUpdate: (config: GateConfig) => void;
  calculatedHingePanelSize?: number; // Auto-calculated hinge panel size when auto is enabled
  numPanels?: number; // Number of panels in the span for position limits
}

// Gate hardware as PHOTO cards (image-17 flow). The choice locks the hinge brand —
// Master Range gate panels have drilled bolt holes, Soft Close panels have a hinge
// cutout, so cross-pairing is physically impossible (SF-1 hard rule).
// Placeholder tiles show the SKU until VITE_STOREFRONT_IMAGE_BASE provides photos
// (same mechanism as the spigot family cards).
const HARDWARE_CARDS: { value: "polaris" | "master"; label: string; blurb: string; imageSku: string }[] = [
  { value: "polaris", label: "Soft Close", blurb: "Polaris / Atlantic self-closing hinges.", imageSku: "PSC-125GG-B" },
  { value: "master", label: "Master Range", blurb: "Budget select; manual-close hinge set.", imageSku: "MR-GGH-B" },
];
const IMAGE_BASE = (import.meta as any).env?.VITE_STOREFRONT_IMAGE_BASE as string | undefined;
function hardwareImageSrc(sku: string): string | undefined {
  if (!IMAGE_BASE) return undefined;
  return `${IMAGE_BASE}/_next/image?url=/products/${sku}.png&w=256&q=75`;
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
      {/* Auto hinge state — reflects the ACTUAL gate config (auto is the default).
          Picking a size from the Hinge Panel dropdown turns auto off; the Auto
          button turns it back on. (Not tied to the HINGE_AUTO_ENABLED env flag —
          that only affects a server resolve edge case, not this UI.) */}
      {config.hingeFrom === "glass" && config.autoHingePanel && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" data-testid={`hinge-auto-on-banner-${spanId}`}>
          <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-sm text-green-900 dark:text-green-100">
            Hinge panel auto-sizes to match your glass panels. Pick a size below to override.
          </AlertDescription>
        </Alert>
      )}

      {/* Gate position — the most-used controls, kept at the TOP of the gate config */}
      <div className="space-y-2 pb-3 border-b border-border">
        <Label className="text-sm font-medium">Gate Position</Label>
        {config.hingeFrom === "glass" ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="default"
                className="font-semibold"
                onClick={() => updateConfig({ position: Math.max(positionLimits.min, config.position - 1) })}
                data-testid={`gate-${spanId}-move-left`}
                disabled={config.position <= positionLimits.min}
              >
                <ChevronLeft className="w-4 h-4 mr-1.5" />
                Move Left
              </Button>
              <Button
                type="button"
                variant="default"
                className="font-semibold"
                onClick={() => updateConfig({ flipped: !config.flipped })}
                data-testid={`gate-${spanId}-flip`}
              >
                <FlipHorizontal className="w-4 h-4 mr-1.5" />
                Flip
              </Button>
              <Button
                type="button"
                variant="default"
                className="font-semibold"
                onClick={() => updateConfig({ position: Math.min(positionLimits.max, config.position + 1) })}
                data-testid={`gate-${spanId}-move-right`}
                disabled={config.position >= positionLimits.max}
              >
                <ChevronRight className="w-4 h-4 mr-1.5" />
                Move Right
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-mono font-medium">Panel {config.position + 1}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Position:</span>
            <span className="font-mono font-medium">
              {config.position <= 0 ? "Start of Section" : "End of Section"}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Gate hardware — PHOTO cards (image-17 flow). The choice locks the hinge brand. */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Gate Hardware</Label>
          <div className="grid max-w-md grid-cols-2 gap-2.5" data-testid={`gate-${spanId}-hardware`}>
            {HARDWARE_CARDS.map((hw) => {
              const isActive = config.hardware === hw.value;
              const img = hardwareImageSrc(hw.imageSku);
              return (
                <button
                  key={hw.value}
                  type="button"
                  onClick={() => {
                    // Keep gate size valid for the newly chosen hardware type
                    const validSizes = hw.value === "polaris" ? polarisGateSizes : masterGateSizes;
                    const newGateSize = validSizes.includes(config.gateSize)
                      ? config.gateSize
                      : hw.value === "polaris" ? 900 : 890;
                    updateConfig({ hardware: hw.value, gateSize: newGateSize });
                  }}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors hover-elevate active-elevate-2",
                    isActive ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
                  )}
                  data-testid={`gate-${spanId}-hardware-${hw.value}`}
                >
                  <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded bg-muted text-center">
                    {img ? (
                      <img src={img} alt={hw.label} className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="px-1 text-[9px] leading-tight text-muted-foreground">
                        image soon
                        <br />
                        <span className="font-mono">{hw.imageSku}</span>
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{hw.label}</p>
                    <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{hw.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 1 (image-17): Hinge Type | Latch To | Latch Type — options follow the brand */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hinge Type</Label>
            <Select
              value={config.hingeType || "glass-to-glass"}
              onValueChange={(hingeType: HingeType) => updateConfig({ hingeType })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-hinge-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.hardware === "master" ? (
                  <>
                    <SelectItem value="glass-to-glass">Glass to Glass</SelectItem>
                    <SelectItem value="glass-to-wall">Glass to Wall/Post</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="glass-to-glass">Glass to Glass</SelectItem>
                    <SelectItem value="wall-to-glass">Wall to Glass</SelectItem>
                  </>
                )}
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">Latch Type</Label>
            <Select
              value={config.latchType || "glass-to-glass"}
              onValueChange={(latchType: LatchType) => updateConfig({ latchType })}
            >
              <SelectTrigger data-testid={`gate-${spanId}-latch-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glass-to-glass">Glass to Glass</SelectItem>
                <SelectItem value="glass-to-wall">Glass to Wall/Post</SelectItem>
                <SelectItem value="corner-out">Corner Out</SelectItem>
                <SelectItem value="corner-in">Corner In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2 (image-17): Hinge From | Gate Size | Hinge Panel (glass-to-glass only) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <Label className="text-sm font-medium">
                  Hinge Panel{config.autoHingePanel ? " (auto)" : ""}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant={config.autoHingePanel ? "default" : "outline"}
                  onClick={() => {
                    if (calculatedHingePanelSize) {
                      updateConfig({
                        autoHingePanel: true,
                        hingePanelSize: calculatedHingePanelSize
                      });
                    } else {
                      updateConfig({ autoHingePanel: true });
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

        {/* Add Post Adapter Plate — image-17 rule: ONLY for Soft Close (Polaris/Atlantic)
            hinged to a wall or post. Not needed for glass-to-glass or Master Range. */}
        {config.hardware === "polaris" && config.hingeFrom === "wall" && (
          <div className="flex items-center gap-2 bg-muted/30 rounded-md p-3">
            <Checkbox
              id={`post-adapter-${spanId}`}
              checked={config.postAdapterPlate ?? false}
              onCheckedChange={(checked) => updateConfig({ postAdapterPlate: checked === true })}
              data-testid={`gate-${spanId}-post-adapter`}
            />
            <label htmlFor={`post-adapter-${spanId}`} className="text-sm font-medium cursor-pointer flex-1">
              Add Post Adapter Plate
            </label>
            <InfoTooltip content="Only required when hinging to 50–60mm square posts. Not needed for walls or larger posts." />
          </div>
        )}
      </div>
    </div>
  );
}
