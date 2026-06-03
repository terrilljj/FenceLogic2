import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FlipHorizontal, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getGateGaps, HingeType, LatchType } from "@shared/schema";
import { STOCK_HINGE_PANEL_SIZES } from "@shared/panelCalculations";
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
  /** Distance (mm) from the LEFT end of the run to the gate's centre line. When set,
   *  the run splits at the gate and each side solves independently. */
  centreFromLeft?: number;
}

interface GateControlsProps {
  config: GateConfig;
  spanId: string | number;
  onUpdate: (config: GateConfig) => void;
  calculatedHingePanelSize?: number; // Auto-calculated hinge panel size when auto is enabled
  numPanels?: number; // Number of panels in the span for position limits
  /** The gate's ACTUAL centre distance (mm) from the left end, computed from the live
   *  layout. When provided, Gate Position runs in CENTRE MODE: Move Left/Right nudge
   *  the centre by 50mm and the readout/panels update live. */
  actualGateCentre?: number;
  /** Run length + end gaps (mm) — used to bound how far the gate centre can travel. */
  spanLengthMm?: number;
  leftEndGapMm?: number;
  rightEndGapMm?: number;
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

export function GateControls({
  config,
  spanId,
  onUpdate,
  calculatedHingePanelSize,
  numPanels = 1,
  actualGateCentre,
  spanLengthMm,
  leftEndGapMm = 25,
  rightEndGapMm = 25,
}: GateControlsProps) {
  const [hingeWarningAcknowledged, setHingeWarningAcknowledged] = useState(false);

  // ── GATE PLACEMENT, DUAL MODE (owner 2026-06-03):
  //  • STANDARD — the solver places the gate by panel position for the best panel
  //    sizes; Move Left/Right shift it one panel at a time.
  //  • SET POSITION — the gate centre is pinned to a measurement; Move Left/Right
  //    nudge it 50mm at a time, typing jumps straight there, panels work around it.
  // The toggle is available whenever the parent supplies the live actual centre
  // (glass-pool-spigots); other variants keep the old panel-index positioning.
  const centreCapable = actualGateCentre !== undefined && config.hingeFrom === "glass";
  const definedMode = centreCapable && config.centreFromLeft !== undefined;
  // 100mm per click — matches the stock hinge-panel spacing, so every click lands on
  // a new clean gate position (50mm steps fell between stock positions and were
  // swallowed by the solver).
  const CENTRE_STEP = 100;

  // Conservative travel limits so a nudge never lands somewhere the solver can't
  // build (each side needs its hinge/latch gap + room for glass).
  const hingeOnLeft = config.flipped;
  const sideMinSpace = (isHingeSide: boolean) =>
    isHingeSide
      ? (config.autoHingePanel !== false ? 450 : config.hingePanelSize + 50) + config.hingeGap
      : 450 + config.latchGap;
  const minCentre = Math.ceil(leftEndGapMm + sideMinSpace(hingeOnLeft) + config.gateSize / 2);
  const maxCentre = Math.floor((spanLengthMm ?? 0) - rightEndGapMm - sideMinSpace(!hingeOnLeft) - config.gateSize / 2);

  const clampCentre = (n: number) => Math.max(minCentre, Math.min(maxCentre, Math.round(n)));
  const currentCentre = config.centreFromLeft ?? actualGateCentre ?? 0;
  // Nudges work from the ACHIEVED centre (what the user sees) — the stored request can
  // drift from it after flips/clamps, which made clicks "catch up" invisibly. The +1mm
  // directional bias resolves ties between two equally-near clean positions in the
  // direction of travel, so every click produces a visible move.
  const nudgeBase = actualGateCentre ?? currentCentre;
  const nudgeCentre = (dir: 1 | -1) => {
    onUpdate({ ...config, centreFromLeft: clampCentre(nudgeBase + dir * (CENTRE_STEP + 1)) });
  };

  // Live centre readout — shows the ACTUAL built centre; editable. Focused-aware so
  // the solver's adjustments never overwrite mid-typing.
  const [centreText, setCentreText] = useState(String(Math.round(actualGateCentre ?? 0)));
  const [centreFocused, setCentreFocused] = useState(false);
  useEffect(() => {
    if (!centreFocused && actualGateCentre !== undefined) setCentreText(String(Math.round(actualGateCentre)));
  }, [actualGateCentre, centreFocused]);

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
      {/* Match-panel-size state — reflects the ACTUAL gate config (ON is the default).
          Toggle OFF to set a manual hinge size (e.g. a narrow hinge panel that places
          the gate exactly where you need it) — the other panels then size independently. */}
      {config.hingeFrom === "glass" && config.autoHingePanel && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" data-testid={`hinge-auto-on-banner-${spanId}`}>
          <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-sm text-green-900 dark:text-green-100">
            Hinge panel matches your glass panel sizes. Turn off "Match panel size" to set it
            manually — the other panels will then size independently.
          </AlertDescription>
        </Alert>
      )}

      {/* Gate position — the most-used controls, kept at the TOP of the gate config */}
      <div className="space-y-2 pb-3 border-b border-border">
        <Label className="text-sm font-medium">Gate Position</Label>
        {config.hingeFrom === "glass" ? (
          <>
            {/* Placement mode toggle — Standard (solver-optimised) | Set position (pinned centre) */}
            {centreCapable && (
              <div className="flex w-fit overflow-hidden rounded-md border border-input">
                <button
                  type="button"
                  onClick={() => updateConfig({ centreFromLeft: undefined })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    !definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate",
                  )}
                  data-testid={`gate-${spanId}-mode-standard`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ centreFromLeft: clampCentre(actualGateCentre ?? minCentre) })}
                  className={cn(
                    "border-l border-input px-3 py-1.5 text-xs font-medium transition-colors",
                    definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate",
                  )}
                  data-testid={`gate-${spanId}-mode-defined`}
                >
                  Set position
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="default"
                className="font-semibold"
                onClick={() =>
                  definedMode
                    ? nudgeCentre(-1)
                    : updateConfig({ position: Math.max(positionLimits.min, config.position - 1) })
                }
                data-testid={`gate-${spanId}-move-left`}
                disabled={definedMode ? nudgeBase - CENTRE_STEP < minCentre : config.position <= positionLimits.min}
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
                onClick={() =>
                  definedMode
                    ? nudgeCentre(1)
                    : updateConfig({ position: Math.min(positionLimits.max, config.position + 1) })
                }
                data-testid={`gate-${spanId}-move-right`}
                disabled={definedMode ? nudgeBase + CENTRE_STEP > maxCentre : config.position >= positionLimits.max}
              >
                <ChevronRight className="w-4 h-4 mr-1.5" />
                Move Right
              </Button>
            </div>

            {definedMode ? (
              /* LIVE gate-centre measurement: shows where the gate's centre line actually
                 sits; Move Left/Right shift it 50mm per click; type a number to jump
                 straight there (e.g. centring on a path). Panels re-solve dynamically. */
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Gate centre:</span>
                <div className="relative w-28">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={centreText}
                    onFocus={() => setCentreFocused(true)}
                    onChange={(e) => {
                      setCentreText(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) updateConfig({ centreFromLeft: clampCentre(n) });
                    }}
                    onBlur={() => {
                      setCentreFocused(false);
                      const n = parseInt(centreText, 10);
                      if (!Number.isNaN(n)) {
                        const clamped = clampCentre(n);
                        updateConfig({ centreFromLeft: clamped });
                        setCentreText(String(clamped));
                      } else if (actualGateCentre !== undefined) {
                        setCentreText(String(Math.round(actualGateCentre)));
                      }
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background pr-9 text-center text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    data-testid={`gate-${spanId}-centre-from-left`}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    mm
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">from the left end</span>
                <InfoTooltip content="The distance from the left end of this section to the centre line of the gate. Move Left/Right shifts it 50mm at a time; type a measurement to place it exactly — e.g. centring the gate on a path to the pool. The panels each side re-size automatically. Switch back to Standard to let the calculator place the gate for the best panel sizes." />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Position:</span>
                <span className="font-mono font-medium">Panel {config.position + 1}</span>
                {centreCapable && actualGateCentre !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    · gate centre ≈ {Math.round(actualGateCentre)}mm from the left end
                  </span>
                )}
              </div>
            )}
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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Hinge Panel</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Match panel size</span>
                  <Switch
                    checked={config.autoHingePanel}
                    onCheckedChange={(on) => {
                      if (on && calculatedHingePanelSize) {
                        // Back to matching: re-optimise the hinge to suit the panel range.
                        updateConfig({ autoHingePanel: true, hingePanelSize: calculatedHingePanelSize });
                      } else {
                        // Manual mode: keep the current size; the dropdown below unlocks and
                        // the other panels size independently of the hinge.
                        updateConfig({ autoHingePanel: on });
                      }
                    }}
                    data-testid={`gate-${spanId}-match-panel-toggle`}
                  />
                </div>
              </div>
              <Select
                value={config.hingePanelSize.toString()}
                disabled={config.autoHingePanel}
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
                  {/* Stock hinge panel widths only — 600mm smallest, 1800mm largest. */}
                  {STOCK_HINGE_PANEL_SIZES.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!config.autoHingePanel && (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Manual hinge size — the other panels in the run size independently.
                </p>
              )}
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
