import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig, getGateGaps } from "@shared/schema";
import { InfoTooltip } from "../info-tooltip";
import { GateControls } from "../gate-controls";
import { CustomPanelControls } from "../custom-panel-controls";
import { GapSelect } from "./gap-select";

interface GlassSpigotsConfigProps {
  span: SpanConfig;
  /** Shared-state writer — same contract the page and the Phase-2 wizard pass. */
  updateSpan: (updates: Partial<SpanConfig>) => void;
  gatesAllowed: boolean;
  optimalHingePanelSize: number | undefined;
  showLeftGap?: boolean;
  showRightGap?: boolean;
  isFieldEnabled: (fieldKey: string) => boolean;
  isSectionEnabled: (section: string) => boolean;
}

// Glass density ≈ 2.5 kg per m² per mm of thickness. glass-pool-spigots is 12mm,
// standard panel height 1200mm. Computed, not stored (data layer is frozen).
const GLASS_DENSITY_KG = 2.5;
const GLASS_THICKNESS_MM = 12;
const STANDARD_PANEL_HEIGHT_MM = 1200;

function panelWeightKg(widthMm: number, heightMm: number, thicknessMm: number): number {
  const areaM2 = (widthMm / 1000) * (heightMm / 1000);
  return areaM2 * thicknessMm * GLASS_DENSITY_KG;
}

const TIP = {
  maxPanel:
    "The widest glass panel used across this section. The layout fits as many panels as possible up to this width, then equalises the remaining panels.",
  lhsGap: "End gap at the wall or corner on the left. Default 25mm; up to 150mm to allow fitting a post or junction.",
  rhsGap: "End gap at the wall or corner on the right. Default 25mm; up to 150mm to allow fitting a post or junction.",
  midGap: "Target gap between adjacent panels. Panels adjust their width to accommodate this across the section.",
};

/** Numbered, single-open accordion for the spigot's number badge. */
function SectionNumber({ n, title }: { n: number; title: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="text-sm font-medium">{title}</span>
    </span>
  );
}

/**
 * The Oxworks-style configure block for glass-pool-spigots. Operates entirely on
 * the shared `span` / `updateSpan` state and re-homes the EXISTING gate / raked /
 * custom-panel sub-components into a numbered accordion — no layout maths is
 * rewritten here. Structural primitives (accordion shell, GapSelect) are
 * style-agnostic; the field content below is glass-specific and helper-gated.
 */
export function GlassSpigotsConfig({
  span,
  updateSpan,
  gatesAllowed,
  optimalHingePanelSize,
  showLeftGap,
  showRightGap,
  isFieldEnabled,
  isSectionEnabled,
}: GlassSpigotsConfigProps) {
  const standardPanelWidth = span.panelLayout?.panels?.length
    ? Math.max(...span.panelLayout.panels)
    : span.maxPanelWidth;
  const weightKg = panelWeightKg(standardPanelWidth, STANDARD_PANEL_HEIGHT_MM, GLASS_THICKNESS_MM);

  const gateEnabled = isSectionEnabled("Gate") && gatesAllowed;
  const rakedEnabled = isSectionEnabled("Raked Panel") && gatesAllowed;
  const customEnabled = isSectionEnabled("Custom Panel");

  // Controlled accordion so expanding the Gate section auto-inserts a gate.
  const [openSection, setOpenSection] = useState<string>("configure");

  const enableGate = () => {
    const gaps = getGateGaps("polaris", "glass");
    updateSpan({
      gateConfig: {
        required: true,
        hardware: "polaris",
        hingeFrom: "glass",
        latchTo: "glass",
        hingeType: "glass-to-glass",
        latchType: "glass-to-glass",
        gateSize: 900,
        hingePanelSize: optimalHingePanelSize ?? 1200,
        autoHingePanel: true,
        position: 0,
        flipped: false,
        postAdapterPlate: false,
        ...gaps,
      },
    });
  };
  const disableGate = () => updateSpan({ gateConfig: undefined });

  // Auto hinge sizing (default ON): keep the hinge panel matched to the optimal
  // size while autoHingePanel is true. Picking a size manually sets it false and
  // stops this. The optimal is independent of hingePanelSize, so no loop.
  const gc = span.gateConfig;
  useEffect(() => {
    if (gc?.required && gc.autoHingePanel && optimalHingePanelSize && gc.hingePanelSize !== optimalHingePanelSize) {
      updateSpan({ gateConfig: { ...gc, hingePanelSize: optimalHingePanelSize } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimalHingePanelSize, gc?.required, gc?.autoHingePanel, gc?.hingePanelSize]);

  return (
    <Accordion
      type="single"
      collapsible
      value={openSection}
      onValueChange={(v) => {
        setOpenSection(v);
        // Opening the Gate section auto-inserts a gate (owner request).
        if (v === "gate" && !span.gateConfig?.required) enableGate();
      }}
      className="rounded-md border border-card-border"
    >
      {/* 1. Configure — compact dropdown row: Max Panel Width | LHS | Mid | RHS */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-configure`}>
          <SectionNumber n={1} title="Configure" />
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {isFieldEnabled("maxPanelMm") && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Max Panel Width</Label>
                  <InfoTooltip content={TIP.maxPanel} />
                </div>
                <Select
                  value={span.maxPanelWidth.toString()}
                  onValueChange={(value) => updateSpan({ maxPanelWidth: parseInt(value) })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-max-panel-width`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 37 }, (_, i) => 200 + i * 50).map((w) => (
                      <SelectItem key={w} value={w.toString()}>{w}mm</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showLeftGap && isFieldEnabled("startGapMm") && (
              <GapSelect
                label="LHS Gap"
                value={span.leftGap?.enabled ? span.leftGap.size : 0}
                onChange={(size) => updateSpan({ leftGap: size > 0 ? { enabled: true, position: "inside", size } : undefined })}
                min={0}
                max={150}
                step={5}
                tooltip={TIP.lhsGap}
                testId={`span-${span.spanId}-left-gap`}
              />
            )}

            {isFieldEnabled("betweenGapMm") && (
              <GapSelect
                label="Mid Gap"
                value={span.desiredGap}
                onChange={(desiredGap) => updateSpan({ desiredGap })}
                min={0}
                max={99}
                step={5}
                tooltip={TIP.midGap}
                testId={`span-${span.spanId}-gap-select`}
              />
            )}

            {showRightGap && isFieldEnabled("endGapMm") && (
              <GapSelect
                label="RHS Gap"
                value={span.rightGap?.enabled ? span.rightGap.size : 0}
                onChange={(size) => updateSpan({ rightGap: size > 0 ? { enabled: true, position: "inside", size } : undefined })}
                min={0}
                max={150}
                step={5}
                tooltip={TIP.rhsGap}
                testId={`span-${span.spanId}-right-gap`}
              />
            )}
          </div>

          {/* Panel weight — computed (area × thickness × density), not stored. */}
          <p className="mt-2.5 text-xs text-muted-foreground" data-testid={`span-${span.spanId}-panel-weight`}>
            Panel weight ≈ <span className="font-semibold text-foreground">{weightKg.toFixed(1)} kg</span>{" "}
            per {standardPanelWidth}×{STANDARD_PANEL_HEIGHT_MM}mm panel ({GLASS_THICKNESS_MM}mm glass)
          </p>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Gate */}
      {gateEnabled && (
        <AccordionItem value="gate" className="border-b border-card-border px-3">
          <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-gate`}>
            <SectionNumber n={2} title="Gate" />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            {span.gateConfig?.required ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">A gate is added to this section.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={disableGate}
                    data-testid={`span-${span.spanId}-gate-remove`}
                  >
                    Remove gate
                  </Button>
                </div>
                <GateControls
                  config={span.gateConfig}
                  spanId={span.spanId}
                  onUpdate={(gateConfig) => updateSpan({ gateConfig: { ...gateConfig, postAdapterPlate: gateConfig.postAdapterPlate ?? false } })}
                  calculatedHingePanelSize={optimalHingePanelSize}
                  numPanels={span.panelLayout?.panels.length}
                />
              </>
            ) : (
              <Button
                type="button"
                onClick={enableGate}
                data-testid={`span-${span.spanId}-gate-add`}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add a gate to this section
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      )}

      {/* 3. Raked & Custom panels */}
      {(rakedEnabled || customEnabled) && (
        <AccordionItem value="raked" className="border-b border-card-border px-3">
          <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-raked`}>
            <SectionNumber n={3} title="Raked &amp; Custom" />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            {rakedEnabled && (
              <>
                {span.maxPanelWidth < 1200 && (
                  <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    Raked panels require max panel width ≥ 1200mm.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Left Rake</Label>
                  <Switch
                    checked={span.leftRakedPanel?.enabled || false}
                    disabled={span.maxPanelWidth < 1200}
                    onCheckedChange={(enabled) => updateSpan({ leftRakedPanel: { enabled, height: 1500 } })}
                    data-testid={`span-${span.spanId}-left-raked-toggle`}
                  />
                </div>
                {span.leftRakedPanel?.enabled && (
                  <Select
                    value={span.leftRakedPanel.height.toString()}
                    onValueChange={(v) => updateSpan({ leftRakedPanel: { ...span.leftRakedPanel!, height: parseInt(v) } })}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid={`span-${span.spanId}-left-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Right Rake</Label>
                  <Switch
                    checked={span.rightRakedPanel?.enabled || false}
                    disabled={span.maxPanelWidth < 1200}
                    onCheckedChange={(enabled) => updateSpan({ rightRakedPanel: { enabled, height: 1500 } })}
                    data-testid={`span-${span.spanId}-right-raked-toggle`}
                  />
                </div>
                {span.rightRakedPanel?.enabled && (
                  <Select
                    value={span.rightRakedPanel.height.toString()}
                    onValueChange={(v) => updateSpan({ rightRakedPanel: { ...span.rightRakedPanel!, height: parseInt(v) } })}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid={`span-${span.spanId}-right-raked-height`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1400">1400mm</SelectItem>
                      <SelectItem value="1500">1500mm</SelectItem>
                      <SelectItem value="1600">1600mm</SelectItem>
                      <SelectItem value="1700">1700mm</SelectItem>
                      <SelectItem value="1800">1800mm</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </>
            )}

            {customEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Custom Panel</Label>
                  <Switch
                    checked={span.customPanel?.enabled || false}
                    onCheckedChange={(enabled) => updateSpan({ customPanel: { enabled, width: Math.min(1200, span.maxPanelWidth), height: 1200, position: 0 } })}
                    data-testid={`span-${span.spanId}-custom-panel-toggle`}
                  />
                </div>
                {span.customPanel?.enabled && (
                  <CustomPanelControls
                    config={span.customPanel}
                    spanId={span.spanId}
                    onUpdate={(customPanel) => updateSpan({ customPanel })}
                    numPanels={span.panelLayout?.panels.length || 1}
                    maxPanelWidth={span.maxPanelWidth}
                  />
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      )}

      {/* 4. Spigot */}
      <AccordionItem value="spigot" className="px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-spigot`}>
          <SectionNumber n={4} title="Spigot" />
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mounting</Label>
              <Select
                value={span.spigotMounting || "base-plate"}
                onValueChange={(v: "base-plate" | "core-drilled" | "side-mounted") => updateSpan({ spigotMounting: v })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-spigot-mounting`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base-plate">Base Plate</SelectItem>
                  <SelectItem value="core-drilled">Core Drilled</SelectItem>
                  <SelectItem value="side-mounted">Side Mounted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <Select
                value={span.spigotColor || "polished"}
                onValueChange={(v: "polished" | "satin" | "black" | "white") => updateSpan({ spigotColor: v })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-spigot-color`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polished">Polished</SelectItem>
                  <SelectItem value="satin">Satin</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                  <SelectItem value="white">White</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
