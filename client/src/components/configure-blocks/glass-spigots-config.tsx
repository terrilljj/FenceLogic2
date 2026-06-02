import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig, getGateGaps } from "@shared/schema";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "../info-tooltip";
import { GateControls } from "../gate-controls";
import { CustomPanelControls } from "../custom-panel-controls";
import { GapSelect } from "./gap-select";
import { SpigotFamilyPicker, type SpigotFamily } from "./spigot-family-picker";
import { PanelThumb } from "./panel-thumb";

// Pool spigot families (SF-1 §2.1: 5 V1 families; Nova removed for pool).
// imageSku = base-plated black variant (Rio has no black → satin).
const POOL_FAMILIES: SpigotFamily[] = [
  { value: "madrid-pool", label: "Madrid Pool", blurb: "Cost-effective pool workhorse.", imageSku: "POOLMAD-SBP-B" },
  { value: "lifestyle", label: "Lifestyle", blurb: "Patented dual-friction.", imageSku: "LS-DF-SBP-B" },
  { value: "rio", label: "Rio", blurb: "Round Ø50mm (no black).", imageSku: "RIO-SBP-S" },
  { value: "insuluxe", label: "Insuluxe", blurb: "AS-3000 native thermal break.", imageSku: "INS-SBP-B" },
  { value: "madrid", label: "Madrid", blurb: "Balustrade-rated casting.", imageSku: "MAD-SBP-B" },
];
// AS-3000 ON filters families to these (ADR 0044 hard rule).
const AS3000_FAMILIES = ["madrid-pool", "madrid", "insuluxe"];

// Per-family finish enums (SF-1 §2.1), mapped to the 4 schema-supported spigotColor
// values. Matt White / White → "white". Insuluxe's Silver-Grey isn't representable in
// the frozen spigotColor enum → deferred to the data pass (shown set is the supported
// subset). Finish is chosen AFTER the family and filtered to it — no dead-ends.
type Finish = "polished" | "satin" | "black" | "white";
const FINISH_BY_FAMILY: Record<string, Finish[]> = {
  "madrid-pool": ["polished", "satin", "black", "white"],
  lifestyle: ["polished", "satin", "black"],
  rio: ["polished", "satin", "white"],
  insuluxe: ["black", "white"],
  madrid: ["polished", "satin", "black", "white"],
};
const FINISH_LABEL: Record<Finish, string> = { polished: "Polished", satin: "Satin", black: "Black", white: "White" };
const FINISH_SWATCH: Record<Finish, string> = {
  polished: "bg-gradient-to-br from-zinc-100 to-zinc-400",
  satin: "bg-zinc-400",
  black: "bg-zinc-900",
  white: "bg-white ring-1 ring-inset ring-zinc-300",
};
function defaultFinish(finishes: Finish[]): Finish {
  return finishes.includes("polished") ? "polished" : finishes[0];
}

// Raked retaining-wall panel heights (SF-1 §2.2: 12NRP-{1400..1800}HT).
const RAKE_HEIGHTS = ["1400", "1500", "1600", "1700", "1800"];

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

/** Numbered accordion header: badge + title + a live one-line summary of the section's
 *  current choices, with an explicit "edit" affordance. The summary + edit chip hide
 *  while the section is expanded (progressive disclosure — collapsed rows read as
 *  completed choices, e.g. "Madrid Pool · Polished · Base Plate · Concrete  ✎ edit"). */
function SectionHeader({ n, title, summary }: { n: number; title: string; summary?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="shrink-0 text-sm font-medium">{title}</span>
      {summary && (
        <>
          <span className="acc-summary min-w-0 flex-1 truncate text-left text-xs text-muted-foreground">
            {summary}
          </span>
          <span className="acc-summary ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" /> edit
          </span>
        </>
      )}
    </span>
  );
}

/**
 * "+ add" card for an optional panel add-on (gate / raked / custom). Collapsed = a
 * tappable add button with a placeholder thumbnail (real product art drops in via
 * the same storefront-image mechanism as the spigot family cards). Expanded = the
 * add-on's own controls, with a Remove action. Reuses the existing handlers — no
 * layout maths changes.
 */
function AddOnCard({
  title,
  addLabel,
  blurb,
  thumb,
  added,
  onAdd,
  onRemove,
  disabled,
  disabledReason,
  testId,
  children,
}: {
  title: string;
  addLabel: string;
  blurb?: string;
  thumb: ReactNode;
  added: boolean;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
  disabledReason?: string;
  testId: string;
  children?: ReactNode;
}) {
  if (added) {
    return (
      <div className="w-full rounded-md border border-primary/40 bg-primary/5" data-testid={testId}>
        <div className="flex items-center justify-between border-b border-primary/20 px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="h-9 w-9 shrink-0">{thumb}</span>
            <span className="text-sm font-semibold">{title}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} data-testid={`${testId}-remove`}>
            Remove
          </Button>
        </div>
        <div className="space-y-3 p-3">{children}</div>
      </div>
    );
  }
  return (
    <div className={cn("w-[132px]", disabled && "opacity-60")} data-testid={testId}>
      <button
        type="button"
        onClick={disabled ? undefined : onAdd}
        disabled={disabled}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-card-border bg-card p-2 hover-elevate active-elevate-2 disabled:cursor-not-allowed"
        data-testid={`${testId}-add`}
      >
        <span className="h-full w-full">{thumb}</span>
      </button>
      <Button type="button" size="sm" onClick={onAdd} disabled={disabled} className="mt-1.5 w-full" data-testid={`${testId}-add-btn`}>
        <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
      </Button>
      {disabled && disabledReason ? (
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{disabledReason}</p>
      ) : blurb ? (
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{blurb}</p>
      ) : null}
    </div>
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

  const rakedAdded = !!(span.leftRakedPanel?.enabled || span.rightRakedPanel?.enabled);
  const enableRaked = () => updateSpan({ leftRakedPanel: { enabled: true, height: 1500 } });
  const disableRaked = () =>
    updateSpan({ leftRakedPanel: { enabled: false, height: 1500 }, rightRakedPanel: { enabled: false, height: 1500 } });

  const customAdded = !!span.customPanel?.enabled;
  const enableCustom = () =>
    updateSpan({ customPanel: { enabled: true, width: Math.min(1200, span.maxPanelWidth), height: 1200, position: 0 } });
  const disableCustom = () =>
    updateSpan({ customPanel: { enabled: false, width: Math.min(1200, span.maxPanelWidth), height: 1200, position: 0 } });

  // Auto hinge sizing (default ON): keep the hinge panel matched to the optimal
  // size while autoHingePanel is true. Picking a size manually sets it false and
  // stops this. The optimal is independent of hingePanelSize, so no loop.
  const gc = span.gateConfig;
  useEffect(() => {
    if (gc?.required && gc.autoHingePanel && optimalHingePanelSize && gc.hingePanelSize !== optimalHingePanelSize) {
      updateSpan({ gateConfig: { ...gc, hingePanelSize: optimalHingePanelSize } });
    }
    // span.panelLayout is a dep on purpose: the layout-recalc effect can clobber this
    // update in the same flush (it spreads a stale span). Each layout write re-fires
    // this effect so it re-applies until hinge === optimal — convergence is guaranteed
    // because optimal does not depend on the current hinge size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimalHingePanelSize, gc?.required, gc?.autoHingePanel, gc?.hingePanelSize, span.panelLayout]);

  // Spigot family + AS-3000 (SF-1 / ADR 0044). AS-3000 ON filters the family list
  // to Madrid Pool / Madrid / Insuluxe. Family is written to fieldValues for the solver.
  const as3000 = span.fieldValues?.["as-3000"] === "true";
  const poolFamilies = as3000 ? POOL_FAMILIES.filter((f) => AS3000_FAMILIES.includes(f.value)) : POOL_FAMILIES;
  const currentFamily = span.fieldValues?.["spigot-family"] || "madrid-pool";
  useEffect(() => {
    if (!poolFamilies.some((f) => f.value === currentFamily)) {
      updateSpan({ fieldValues: { ...span.fieldValues, "spigot-family": "madrid-pool" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [as3000]);

  // Finish is filtered to the chosen family. If the family changes and the current
  // finish isn't offered (e.g. Rio has no black), fall back to the family default.
  const familyFinishes = FINISH_BY_FAMILY[currentFamily] ?? (["polished", "satin", "black", "white"] as Finish[]);
  const currentFinish = (span.spigotColor || "polished") as Finish;
  useEffect(() => {
    if (!familyFinishes.includes(currentFinish)) {
      updateSpan({ spigotColor: defaultFinish(familyFinishes) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFamily]);

  // PROGRESSIVE DISCLOSURE (owner "top-1%" requirement): every sub-section starts
  // COLLAPSED to a one-line summary of its current choices (defaults are sensible).
  // Expanding is an explicit "edit"; choosing a spigot family auto-collapses again.
  const [openSections, setOpenSections] = useState<string[]>([]);
  const collapseSection = (section: string) => setOpenSections((prev) => prev.filter((s) => s !== section));

  // Live summaries shown in the collapsed section headers.
  const familyLabel = POOL_FAMILIES.find((f) => f.value === currentFamily)?.label ?? currentFamily;
  const mountingLabel =
    ({ "base-plate": "Base Plate", "core-drilled": "Core Drilled", "side-mounted": "Side Mounted" } as Record<string, string>)[
      span.spigotMounting || "base-plate"
    ];
  const substrateLabel =
    ({ concrete: "Concrete", timber: "Timber deck", steel: "Steel" } as Record<string, string>)[span.spigotSubstrate || "concrete"];
  const spigotSummary = [familyLabel, FINISH_LABEL[currentFinish], mountingLabel, substrateLabel, as3000 ? "AS-3000" : null]
    .filter(Boolean)
    .join(" · ");
  const configureSummary = `${span.maxPanelWidth}mm max panel · gaps ${span.leftGap?.enabled ? span.leftGap.size : 0} / ${span.desiredGap} / ${span.rightGap?.enabled ? span.rightGap.size : 0}`;
  const addonItems = [
    span.gateConfig?.required ? `Gate ${span.gateConfig.gateSize}` : null,
    span.leftRakedPanel?.enabled ? `Left rake ${span.leftRakedPanel.height}H` : null,
    span.rightRakedPanel?.enabled ? `Right rake ${span.rightRakedPanel.height}H` : null,
    span.customPanel?.enabled ? `Custom ${span.customPanel.width}×${span.customPanel.height}` : null,
  ].filter(Boolean);
  const addonsSummary = addonItems.length ? addonItems.join(" · ") : "None — open to add a gate, raked or custom panel";

  return (
    <Accordion
      type="multiple"
      value={openSections}
      onValueChange={setOpenSections}
      className="rounded-md border border-card-border"
    >
      {/* 1. Configure — compact dropdown row: Max Panel Width | LHS | Mid | RHS */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger
          className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
          data-testid={`span-${span.spanId}-accordion-configure`}
        >
          <SectionHeader n={1} title="Configure" summary={configureSummary} />
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

      {/* 2. Spigot — kept near the top (owner request: simplest first choice). */}
      <AccordionItem value="spigot" className="border-b border-card-border px-3">
        <AccordionTrigger
          className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
          data-testid={`span-${span.spanId}-accordion-spigot`}
        >
          <SectionHeader n={2} title="Spigot" summary={spigotSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {/* AS-3000 compliance — filters the family list + sets the insulating default. */}
          <div className="flex items-center justify-between rounded-md border border-card-border p-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-medium">AS-3000 compliance</Label>
              <InfoTooltip content="Required within 1.25m of pool water (equipotential bonding). Limits the family choice to Madrid Pool, Madrid or Insuluxe and adds the insulating kit." />
            </div>
            <Switch
              checked={as3000}
              onCheckedChange={(on) => {
                const next: Record<string, any> = { ...span.fieldValues, "as-3000": on ? "true" : "false" };
                if (on && !AS3000_FAMILIES.includes(currentFamily)) next["spigot-family"] = "madrid-pool";
                updateSpan({ fieldValues: next });
              }}
              data-testid={`span-${span.spanId}-as3000-toggle`}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Spigot Family</Label>
              <InfoTooltip content="The spigot system — they differ in profile, finish range and certification. Madrid Pool is the cost-effective default; Insuluxe is AS-3000 native." />
            </div>
            <SpigotFamilyPicker
              families={poolFamilies}
              value={currentFamily}
              onSelect={(v) => {
                updateSpan({ fieldValues: { ...span.fieldValues, "spigot-family": v } });
                // Progressive disclosure: family is THE choice — collapse back to the
                // summary line. Finish/mounting/substrate stay editable via "edit".
                collapseSection("spigot");
              }}
              spanId={span.spanId}
            />
          </div>

          {/* Finish — filtered to the chosen family (SF-1 per-family enums). Family-first → finish. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <InfoTooltip content="Available finishes depend on the spigot family. When mixing earthed and un-earthed sections, choose Black on both so the covered and uncovered spigots match." />
            </div>
            <div className="flex flex-wrap gap-1.5" data-testid={`span-${span.spanId}-finish-picker`}>
              {familyFinishes.map((f) => {
                const active = f === currentFinish;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => updateSpan({ spigotColor: f })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover-elevate active-elevate-2",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border",
                    )}
                    data-testid={`span-${span.spanId}-finish-${f}`}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", FINISH_SWATCH[f])} />
                    {FINISH_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>

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
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Substrate</Label>
                <InfoTooltip content="The surface the spigots fix to — sets the right fixings per section (concrete vs timber deck need different anchors). Each section can use a different substrate." />
              </div>
              <Select
                value={span.spigotSubstrate || "concrete"}
                onValueChange={(v: "concrete" | "timber" | "steel") => updateSpan({ spigotSubstrate: v })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-spigot-substrate`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concrete">Concrete</SelectItem>
                  <SelectItem value="timber">Timber deck</SelectItem>
                  <SelectItem value="steel">Steel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 3. Gate, raked & custom — "+ add" image-cards */}
      {(gateEnabled || rakedEnabled || customEnabled) && (
        <AccordionItem value="addons" className="px-3">
          <AccordionTrigger
            className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
            data-testid={`span-${span.spanId}-accordion-addons`}
          >
            <SectionHeader n={3} title="Gate, raked & custom" summary={addonsSummary} />
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="flex flex-wrap items-start gap-3">
              {gateEnabled && (
                <AddOnCard
                  title="Gate"
                  addLabel="add a gate"
                  thumb={<PanelThumb variant="gate" label="900" sub="Gate" />}
                  added={!!span.gateConfig?.required}
                  onAdd={enableGate}
                  onRemove={disableGate}
                  testId={`span-${span.spanId}-addon-gate`}
                >
                  {span.gateConfig?.required && (
                    <GateControls
                      config={span.gateConfig}
                      spanId={span.spanId}
                      onUpdate={(gateConfig) => updateSpan({ gateConfig: { ...gateConfig, postAdapterPlate: gateConfig.postAdapterPlate ?? false } })}
                      calculatedHingePanelSize={optimalHingePanelSize}
                      numPanels={span.panelLayout?.panels.length}
                    />
                  )}
                </AddOnCard>
              )}

              {rakedEnabled && (
                <AddOnCard
                  title="Raked panels"
                  addLabel="add raked"
                  thumb={<PanelThumb variant="raked-right" label="1200H" sub="Rake" />}
                  added={rakedAdded}
                  onAdd={enableRaked}
                  onRemove={disableRaked}
                  disabled={span.maxPanelWidth < 1200}
                  disabledReason="Needs max panel width ≥ 1200mm."
                  testId={`span-${span.spanId}-addon-raked`}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {(["left", "right"] as const).map((side) => {
                      const panel = side === "left" ? span.leftRakedPanel : span.rightRakedPanel;
                      const setPanel = (p: { enabled: boolean; height: number }) =>
                        updateSpan(side === "left" ? { leftRakedPanel: p } : { rightRakedPanel: p });
                      return (
                        <div key={side} className="rounded-md border border-card-border p-2">
                          <div className="mx-auto mb-2 h-20 w-20">
                            <PanelThumb
                              variant={side === "left" ? "raked-left" : "raked-right"}
                              label={`${panel?.height ?? 1500}H`}
                              sub="Rake"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium capitalize">{side} rake</Label>
                            <Switch
                              checked={panel?.enabled || false}
                              onCheckedChange={(enabled) => setPanel({ enabled, height: panel?.height ?? 1500 })}
                              data-testid={`span-${span.spanId}-${side}-raked-toggle`}
                            />
                          </div>
                          {panel?.enabled && (
                            <Select value={String(panel.height)} onValueChange={(v) => setPanel({ enabled: true, height: parseInt(v) })}>
                              <SelectTrigger className="mt-2 h-8 text-xs" data-testid={`span-${span.spanId}-${side}-raked-height`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RAKE_HEIGHTS.map((h) => <SelectItem key={h} value={h}>{h}mm</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AddOnCard>
              )}

              {customEnabled && (
                <AddOnCard
                  title="Custom panel"
                  addLabel="add custom"
                  thumb={<PanelThumb variant="custom" label="1200" sub="Custom" />}
                  added={customAdded}
                  onAdd={enableCustom}
                  onRemove={disableCustom}
                  testId={`span-${span.spanId}-addon-custom`}
                >
                  {span.customPanel?.enabled && (
                    <CustomPanelControls
                      config={span.customPanel}
                      spanId={span.spanId}
                      onUpdate={(customPanel) => updateSpan({ customPanel })}
                      numPanels={span.panelLayout?.panels.length || 1}
                      maxPanelWidth={span.maxPanelWidth}
                    />
                  )}
                </AddOnCard>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

    </Accordion>
  );
}
