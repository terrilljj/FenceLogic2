import { useEffect, useState, type ReactNode } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SpanConfig, getGateGaps } from "@shared/schema";
import { channelCutPlans, computeSectionCutPlans, CHANNEL_PINS_PER_JOIN, CHANNEL_PIN_PACK_SIZE, CHANNEL_STOCK_MM, CHANNEL_STOCK_HD_MM } from "@/lib/cut-plan";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "../info-tooltip";
import { GateControls } from "../gate-controls";
import { CustomPanelControls } from "../custom-panel-controls";
import { GapSelect } from "./gap-select";
import { SpigotFamilyPicker, familyImageSrc, type SpigotFamily } from "./spigot-family-picker";
import { PanelThumb } from "./panel-thumb";
import { GlassBalFallBand } from "./glass-bal-fall-band";

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

// Per-family finish enums (SF-1 §2.1), mapped to the schema spigotColor values.
// Matt White / White → "white". Silver Grey is Insuluxe-only (SF-1 {B, SG, W}).
// Finish is chosen AFTER the family and filtered to it — no dead-ends.
export type Finish = "polished" | "satin" | "black" | "white" | "silver-grey";
export const FINISH_BY_FAMILY: Record<string, Finish[]> = {
  "madrid-pool": ["polished", "satin", "black", "white"],
  lifestyle: ["polished", "satin", "black"],
  rio: ["polished", "satin", "white"],
  insuluxe: ["black", "silver-grey", "white"],
  madrid: ["polished", "satin", "black", "white"],
  // Balustrade families (SF-8/SF-9 specs): {Polish, Satin, Black, Matt White},
  // uniform across families and mountings — full 4-finish coverage.
  nova: ["polished", "satin", "black", "white"],
  "madrid-deluxe": ["polished", "satin", "black", "white"],
};
export const FINISH_LABEL: Record<Finish, string> = {
  polished: "Polished",
  satin: "Satin",
  black: "Black",
  white: "White",
  "silver-grey": "Silver Grey",
};
export const FINISH_SWATCH: Record<Finish, string> = {
  polished: "bg-gradient-to-br from-zinc-100 to-zinc-400",
  satin: "bg-zinc-400",
  black: "bg-zinc-900",
  white: "bg-white ring-1 ring-inset ring-zinc-300",
  "silver-grey": "bg-gradient-to-br from-slate-300 to-slate-400",
};
function defaultFinish(finishes: Finish[]): Finish {
  return finishes.includes("polished") ? "polished" : finishes[0];
}

// Raked retaining-wall panel heights (SF-1 §2.2: 12NRP-{1400..1800}HT).
const RAKE_HEIGHTS = ["1400", "1500", "1600", "1700", "1800"];

// COVER MATRIX (operator 2026-06-03, SKUs from _reports/calc-csv-gen-2026-05-29):
// core-drilled spigots take DRESS RINGS, base-plated take DOMICAL COVERS — but the
// variant range is PER FAMILY. Madrid has flat/raised rings and slim/high domes;
// Insuluxe has exactly one of each, so the UI shows "included" instead of a choice.
// `slim: true` marks variants blocked by the protruding-rod rule (base-plate on
// concrete/steel needs the taller cover).
export type CoverOption = { value: string; label: string; blurb: string; sku: string; slim?: boolean };
export const MADRID_COVERS: { dress: CoverOption[]; dome: CoverOption[] } = {
  dress: [
    { value: "dress-flat", label: "Flat dress ring", blurb: "Slim ring, sits flush around the spigot.", sku: "MAD-DR-P" },
    { value: "dress-raised", label: "Raised dress ring", blurb: "Taller ring for an uneven surface.", sku: "MAD-DR-RAISED-P" },
  ],
  dome: [
    { value: "dome-slim", label: "Slimline domical", blurb: "Low 12mm dome over the base plate.", sku: "MAD-SDC-P", slim: true },
    { value: "dome-high", label: "High domical", blurb: "22mm dome — clears rod fixings.", sku: "MAD-HDC-P" },
  ],
};
export const COVER_MATRIX: Record<string, { dress: CoverOption[]; dome: CoverOption[] }> = {
  "madrid-pool": MADRID_COVERS,
  madrid: MADRID_COVERS,
  lifestyle: {
    dress: [
      { value: "dress-flat", label: "Flat dress ring", blurb: "Slim ring, sits flush around the spigot.", sku: "LS-DR-P" },
      { value: "dress-raised", label: "Raised dress ring", blurb: "Taller ring for an uneven surface.", sku: "LS-DR-RAISED-P" },
    ],
    dome: [{ value: "dome-high", label: "Domical cover", blurb: "Square-profile dome over the base plate.", sku: "LS-DC-P" }],
  },
  rio: {
    dress: [
      { value: "dress-flat", label: "Flat dress ring", blurb: "Ø90mm flat ring around the spigot.", sku: "RIO-DR-P" },
      { value: "dress-raised", label: "Domed dress ring", blurb: "Ø102mm domed ring.", sku: "RIO-SDC-P" },
    ],
    dome: [{ value: "dome-high", label: "High domical", blurb: "27mm dome over the base plate.", sku: "RIO-HDC-P" }],
  },
  insuluxe: {
    dress: [{ value: "dress-flat", label: "Dress ring", blurb: "Conceals the Insuluxe spigot base.", sku: "INS-DR-B" }],
    dome: [{ value: "dome-high", label: "High domical", blurb: "26mm two-part dome cover.", sku: "INS-HDC-B" }],
  },
  // Balustrade families (SF-8/SF-9). SKU codes follow the family prefix pattern —
  // operator to confirm exact codes in the hands-on round.
  nova: {
    dress: [
      { value: "dress-flat", label: "Flat dress ring", blurb: "Slim ring, sits flush around the spigot.", sku: "NOV-DR-P" },
      { value: "dress-raised", label: "Raised dress ring", blurb: "Taller ring for an uneven surface.", sku: "NOV-DR-RAISED-P" },
    ],
    dome: [
      { value: "dome-slim", label: "Slimline domical", blurb: "Low dome over the base plate.", sku: "NOV-SDC-P", slim: true },
      { value: "dome-high", label: "High domical", blurb: "Taller dome — clears rod fixings.", sku: "NOV-HDC-P" },
    ],
  },
  "madrid-deluxe": {
    dress: [
      { value: "dress-flat", label: "Flat dress ring", blurb: "Slim ring, sits flush around the spigot.", sku: "MADDEL-DR-P" },
      { value: "dress-raised", label: "Raised dress ring", blurb: "Taller ring for an uneven surface.", sku: "MADDEL-DR-RAISED-P" },
    ],
    dome: [
      { value: "dome-slim", label: "Slimline domical", blurb: "Low dome over the base plate.", sku: "MADDEL-SDC-P", slim: true },
      { value: "dome-high", label: "High domical", blurb: "Taller dome — clears rod fixings.", sku: "MADDEL-HDC-P" },
    ],
  },
};

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
  /** All sections in design order — for cross-section offcut reuse (channel cut plans). */
  allSpans?: SpanConfig[];
  /** "glass-pool-spigots" (default) or "glass-pool-channel". Channel swaps the
   *  hardware section (2) from Spigot to Channel; Configure (1) and Gate/raked/
   *  custom (3) are identical across both — the glass logic is shared (owner
   *  ruling 2026-06-03: "change spigots to channel"). */
  productVariant?: string;
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
  midGap:
    "The actual gap between adjacent panels. Glass comes in 50mm width steps, so the achievable gap moves in steps of 50mm divided by the number of gaps — the steppers jump between achievable values.",
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
  allSpans,
  productVariant = "glass-pool-spigots",
}: GlassSpigotsConfigProps) {
  // CHANNEL MODE: VersaTilt channel system replaces the spigot ecosystem — no family
  // picker, no covers, channel finish {Black, Satin Anodised}, M12 fixings per
  // substrate. Glass/gates/raked/custom logic is untouched.
  //  • glass-pool-channel: 12mm × 1200mm pool glass, gates allowed.
  //  • glass-bal-channel:  15mm × 1000mm balustrade glass, NO gates/raked, + Rail
  //    section. Operator ruling 2026-06-03 (_docs/channel-ui-build-spec.md): pool
  //    channel carried over verbatim + 35-Series rail (finish auto-matched) +
  //    friction plates at 300mm centres.
  // HD = VersaTilt Heavy Duty (PTS-028): 17.52mm SGP laminated, 3600mm channel, HD
  // friction plates + washers, 35-Series rail with a 17.52 runner insert. Otherwise
  // identical to the standard 15mm bal channel.
  const isBalChannelHd = productVariant === "glass-bal-channel-hd";
  const isBalChannel = productVariant === "glass-bal-channel" || isBalChannelHd;
  const isChannel = productVariant === "glass-pool-channel" || isBalChannel;
  // Glass spec per mode: pool = 12mm × 1200mm; bal channel = 15mm × 1000mm (PTS-003);
  // HD bal channel = 17.52mm SGP laminated × 1000mm (PTS-028).
  const glassThicknessMm = isBalChannelHd ? 17.52 : isBalChannel ? 15 : GLASS_THICKNESS_MM;
  const glassHeightMm = isBalChannel ? 1000 : STANDARD_PANEL_HEIGHT_MM;
  // PTS-003 max span for the 15mm bal channel: 1400mm (pool styles go to 2000mm).
  const maxPanelCapMm = isBalChannel ? 1400 : 2000;
  const standardPanelWidth = span.panelLayout?.panels?.length
    ? Math.max(...span.panelLayout.panels)
    : span.maxPanelWidth;
  const weightKg = panelWeightKg(standardPanelWidth, glassHeightMm, glassThicknessMm);

  // Keep max panel within the PTS cap (e.g. arriving from a generic-1800 default).
  useEffect(() => {
    if (span.maxPanelWidth > maxPanelCapMm) updateSpan({ maxPanelWidth: maxPanelCapMm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPanelCapMm, span.maxPanelWidth]);

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

  // PROGRESSIVE DISCLOSURE (owner-tuned): sections start EXPANDED so a first-time
  // user sees everything that's configurable. Collapsing kicks in as choices are
  // made — picking a spigot family collapses that section to its one-line summary,
  // and any section can be collapsed/expanded via its header.
  const [openSections, setOpenSections] = useState<string[]>(["configure", "spigot", "addons", "rail"]);
  const collapseSection = (section: string) => setOpenSections((prev) => prev.filter((s) => s !== section));

  // Substrate → mounting → covers → fixings flow (SF-1 §2.4 install logic):
  //  • Only CONCRETE can be core-drilled — timber decks and steel are base-plate only.
  //  • Base-plate rod fixings on concrete/steel protrude, so the RAISED/HIGH cover
  //    variant is required (flat dress ring / slim domical won't sit flush).
  //  • Fixings are auto-included per substrate × mounting (shown, not chosen).
  const substrate = (span.spigotSubstrate || "concrete") as "concrete" | "timber" | "steel";
  const mounting = span.spigotMounting === "core-drilled" && substrate === "concrete" ? "core-drilled" : "base-plate";
  const needsRaisedCover = mounting === "base-plate" && (substrate === "concrete" || substrate === "steel");

  // COVERS: category follows the mounting (core-drill → dress rings; base-plate →
  // domical covers); the variant range comes from the per-family COVER_MATRIX.
  // Cross-rule: base-plate rods on concrete/steel protrude → slim variants disabled.
  // A family with a single variant shows "included" instead of a fake choice.
  const coverCategory = mounting === "core-drilled" ? "dress" : "dome";
  const coverOptions = (COVER_MATRIX[currentFamily] ?? MADRID_COVERS)[coverCategory].map((o) => ({
    ...o,
    disabled: !!o.slim && needsRaisedCover,
    disabledReason: "Won't clear the rod fixings on concrete/steel.",
  }));
  const enabledCovers = coverOptions.filter((o) => !o.disabled);
  const defaultCover = enabledCovers[0]?.value ?? coverOptions[0].value;
  const storedCover = span.fieldValues?.["spigot-cover"] as string | undefined;
  const spigotCover = storedCover && enabledCovers.some((o) => o.value === storedCover) ? storedCover : defaultCover;
  const selectedCover = coverOptions.find((o) => o.value === spigotCover) ?? coverOptions[0];
  const fixingsInfo =
    mounting === "core-drilled"
      ? "Pourable grout — 1 bag per 10 spigots plus a spare. No mechanical fixings."
      : substrate === "concrete"
        ? "M10×120mm stainless threaded rods (1 pack per spigot) + chemical anchor (1 per 6 spigots)."
        : substrate === "timber"
          ? "100mm countersunk batten screws (1 pack per spigot). Fix into joists or solid bearers."
          : "M10×120mm stainless threaded rods (1 pack per spigot). No chemical anchor needed for steel.";

  // Gate hardware (hinges + latches) finish: match the spigot finish, or pick one.
  const hardwareFinish = (span.fieldValues?.["hardware-finish"] as string) || "match";

  // MID GAP truth (owner 2026-06-03): panels sit on a 50mm grid, so the mid gap can
  // only take values 50/M apart (M = number of mid gaps). The control shows the
  // ACTUAL achieved gap from the layout and its steppers jump between achievable
  // values — from 83mm with one gap, down lands on 33 (one panel grows 50mm).
  const midGaps = (() => {
    const gaps = [...(span.panelLayout?.gaps ?? [])];
    if (span.gateConfig?.required) {
      // Hardware gaps (hinge/latch) are fixed by the gate — exclude from the mid-gap set.
      for (const hw of [span.gateConfig.hingeGap, span.gateConfig.latchGap]) {
        const i = gaps.findIndex((g) => Math.abs(g - hw) < 0.01);
        if (i >= 0) gaps.splice(i, 1);
      }
    }
    return gaps;
  })();
  const actualMidGap = midGaps.length ? Math.round(midGaps[0] * 10) / 10 : span.desiredGap;
  const midGapStep = 50 / Math.max(1, midGaps.length);

  // The gate's ACTUAL centre distance from the left end (live, from the built layout).
  // Drives the centre-mode Gate Position controls: Move Left/Right nudge it, the
  // readout shows it, panels re-solve dynamically.
  const actualGateCentre = (() => {
    if (!span.gateConfig?.required || !span.panelLayout?.panels?.length) return undefined;
    const types = span.panelLayout.panelTypes ?? [];
    let x = span.leftGap?.enabled ? span.leftGap.size : 0;
    for (let i = 0; i < span.panelLayout.panels.length; i++) {
      if (types[i] === "gate") return Math.round((x + span.panelLayout.panels[i] / 2) * 10) / 10;
      x += span.panelLayout.panels[i] + (span.panelLayout.gaps[i] ?? 0);
    }
    return undefined;
  })();

  // Live summaries shown in the collapsed section headers.
  const familyLabel = POOL_FAMILIES.find((f) => f.value === currentFamily)?.label ?? currentFamily;
  const mountingLabel = mounting === "core-drilled" ? "Core Drilled" : "Base Plate";
  const substrateLabel =
    ({ concrete: "Concrete", timber: "Timber deck", steel: "Steel" } as Record<string, string>)[substrate];
  const spigotSummary = [
    familyLabel,
    FINISH_LABEL[currentFinish],
    substrateLabel,
    mountingLabel,
    selectedCover.label,
    as3000 ? "AS-3000" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── CHANNEL hardware state (glass-pool-channel only) ──────────────────────────
  // VersaTilt (VER-) single family. Finish {Black, Satin Anodised} (Mill excluded).
  // Deck mount only in V1. Fixings are M12 per substrate (GS* individuals — channel
  // anchors at 300mm centres), shown not chosen. Stored in fieldValues so the solver
  // / BOM can read them; substrate reuses the shared spigotSubstrate field.
  const channelFinish = (span.fieldValues?.["channel-finish"] as string) || "satin-anodised";
  const channelFixingsInfo: Record<string, string> = {
    concrete:
      "M12 stainless threaded rods (1 per anchor, 300mm centres) + chemical anchor. You supply M12 nuts and working washers.",
    timber:
      "M12×160mm stainless LAG screws (1 per anchor, 300mm centres) into structural timber. You supply M12 nuts and working washers.",
    steel:
      "Customer-supplied M12 stainless hardware — bolt through the steel or drill-and-tap. M10 spigot hardware is not sufficient for channel loads.",
  };
  // Channel terminations: every open channel end (section ends + both sides of a gate
  // break) is finished with an END CAP or a CUT MITRE (operator rule). Stored per end.
  const channelTermOf = (key: string) => (span.fieldValues?.[key] as string) || "end-cap";
  const setChannelField = (key: string, value: string) =>
    updateSpan({ fieldValues: { ...span.fieldValues, [key]: value } });
  const gateInLayout = !!span.gateConfig?.required;

  // Channel cut plans for ALL sections via the shared cut-plan engine. AUTO-OPTIMISED
  // (operator design): the user configures all glass runs freely; offcuts from earlier
  // sections are reused automatically before any new full length is cut. The same
  // engine will drive handrail cut optimisation.
  const designSpans = allSpans?.length ? allSpans : [span];
  const channelStockMm = isBalChannelHd ? CHANNEL_STOCK_HD_MM : CHANNEL_STOCK_MM;
  const allPlans = channelCutPlans(designSpans, channelStockMm);
  const channelPlanRaw = allPlans.get(span.spanId);
  const channelPlan = {
    fullLengths: channelPlanRaw?.fullLengths ?? 0,
    joins: channelPlanRaw?.joins ?? 0,
    pins: (channelPlanRaw?.joins ?? 0) * CHANNEL_PINS_PER_JOIN,
    pinPacks: Math.ceil(((channelPlanRaw?.joins ?? 0) * CHANNEL_PINS_PER_JOIN) / CHANNEL_PIN_PACK_SIZE),
    offcutOut: channelPlanRaw?.offcutOutMm ?? 0,
    claimed: channelPlanRaw?.claimedOffcuts ?? [],
  };

  const channelSummary = [
    "VersaTilt",
    channelFinish === "black" ? "Black" : "Satin Anodised",
    substrateLabel,
    `${channelPlan.fullLengths} × ${channelStockMm}mm`,
    channelPlan.claimed.length ? "offcut reused" : null,
    channelPlan.joins > 0 ? `${channelPlan.joins} join${channelPlan.joins > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── RAIL (glass-bal-channel only): 35-Series top rail, 5800mm stock. Finish is
  // AUTO-MATCHED to the channel finish (operator ruling: Black→Black, SA→SA — no
  // independent rail finish input). Same cut-plan engine as the channel (offcuts
  // from earlier sections reused automatically).
  const RAIL_STOCK_MM = 5800;
  const railFinish: "black" | "satin" = channelFinish === "black" ? "black" : "satin";
  const railFinishLabel = channelFinish === "black" ? "Black" : "Satin Anodised";
  const rail = span.handrail;
  // Top rail defaults ON for balustrade. enabled:false is respected (deliberate off).
  useEffect(() => {
    if (isBalChannel && span.handrail === undefined) {
      updateSpan({
        handrail: {
          enabled: true,
          type: "series-35x35",
          material: "anodised-aluminium",
          finish: railFinish,
          startTermination: "end-cap",
          endTermination: "end-cap",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBalChannel, span.spanId, span.handrail === undefined]);
  // Keep the rail finish matched when the channel finish changes.
  useEffect(() => {
    if (isBalChannel && rail?.enabled && rail.finish !== railFinish) {
      updateSpan({ handrail: { ...rail, finish: railFinish } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBalChannel, railFinish, rail?.enabled]);
  // Rail cut plan across all sections (5800mm stock, rail-enabled sections only).
  const railPlanRaw = isBalChannel
    ? computeSectionCutPlans(
        designSpans.map((s) => ({
          id: s.spanId,
          label: s.name?.trim() || `Section ${s.spanId}`,
          runsMm: s.handrail?.enabled === false ? [] : [s.length],
        })),
        RAIL_STOCK_MM,
      ).get(span.spanId)
    : undefined;
  const railPlan = {
    fullLengths: railPlanRaw?.fullLengths ?? 0,
    joins: railPlanRaw?.joins ?? 0,
    offcutOut: railPlanRaw?.offcutOutMm ?? 0,
    claimed: railPlanRaw?.claimedOffcuts ?? [],
  };
  const railSummary = rail?.enabled
    ? ["35 Series", railFinishLabel, `${railPlan.fullLengths} × 5800mm`, railPlan.claimed.length ? "offcut reused" : null]
        .filter(Boolean)
        .join(" · ")
    : "No top rail";
  const configureSummary = `${span.maxPanelWidth}mm max panel · gaps ${span.leftGap?.enabled ? span.leftGap.size : 0} / ${actualMidGap} / ${span.rightGap?.enabled ? span.rightGap.size : 0}`;
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
                    {Array.from({ length: (maxPanelCapMm - 200) / 50 + 1 }, (_, i) => 200 + i * 50).map((w) => (
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
                max={99}
                step={1}
                tooltip={TIP.lhsGap}
                testId={`span-${span.spanId}-left-gap`}
              />
            )}

            {isFieldEnabled("betweenGapMm") && (
              <GapSelect
                label="Mid Gap"
                value={actualMidGap}
                onChange={(desiredGap) => updateSpan({ desiredGap })}
                min={0}
                max={99}
                step={midGapStep}
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
                max={99}
                step={1}
                tooltip={TIP.rhsGap}
                testId={`span-${span.spanId}-right-gap`}
              />
            )}
          </div>

          {/* Panel weight — computed (area × thickness × density), not stored. */}
          <p className="mt-2.5 text-xs text-muted-foreground" data-testid={`span-${span.spanId}-panel-weight`}>
            Panel weight ≈ <span className="font-semibold text-foreground">{weightKg.toFixed(1)} kg</span>{" "}
            per {standardPanelWidth}×{glassHeightMm}mm panel ({glassThicknessMm}mm glass)
          </p>

          {/* AS1288 fall-height band — standard balustrade channel only (not pool). VersaTilt
              has no run-length cap, so no run-cap note. HD is ALWAYS 17.52 SGP laminated, so it
              skips the band and shows a fixed spec note instead. */}
          {isBalChannel && !isBalChannelHd && (
            <div className="mt-3">
              <GlassBalFallBand span={span} updateSpan={updateSpan} productVariant={productVariant} />
            </div>
          )}
          {isBalChannelHd && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed dark:border-amber-900 dark:bg-amber-950/30" data-testid={`span-${span.spanId}-glass-spec`}>
              <p className="font-semibold">Glass: 17.52mm Grade A toughened SGP laminated</p>
              <p className="text-amber-800 dark:text-amber-300">
                Heavy-duty VersaTilt (PTS-028): laminated by design — rated for high-wind / high-fall / C1–C2 occupancy up to 50m. The build (17.52 vs 21.52mm) is confirmed by engineering against your wind region, height and substrate.
              </p>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* 2. Hardware — Channel (glass-pool-channel) or Spigot (glass-pool-spigots). */}
      {isChannel ? (
        <AccordionItem value="spigot" className="border-b border-card-border px-3">
          <AccordionTrigger
            className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
            data-testid={`span-${span.spanId}-accordion-spigot`}
          >
            <SectionHeader n={2} title="Channel" summary={channelSummary} />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            {/* Channel finish — {Black, Satin Anodised}; Mill is storefront-only. Flows
                through to end plates and channel accessories (1:1 finish match). */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Channel Finish</Label>
                <InfoTooltip content="The VersaTilt channel and its end plates come in Black or Satin Anodised. The finish applies to every visible channel component in this section." />
              </div>
              <div className="flex gap-2">
                {[
                  { value: "satin-anodised", label: "Satin Anodised", swatch: "bg-gradient-to-br from-zinc-300 to-zinc-400" },
                  { value: "black", label: "Black", swatch: "bg-zinc-900" },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateSpan({ fieldValues: { ...span.fieldValues, "channel-finish": f.value } })}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      channelFinish === f.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-card-border text-muted-foreground hover:border-primary/40",
                    )}
                    data-testid={`span-${span.spanId}-channel-finish-${f.value}`}
                  >
                    <span className={cn("h-4 w-4 rounded-full border border-black/10", f.swatch)} />
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Substrate — drives the M12 fixings (shown, not chosen). */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Substrate</Label>
                  <InfoTooltip content="The surface the channel fixes to. Each section can use a different substrate; the fixings are included to match." />
                </div>
                <Select
                  value={substrate}
                  onValueChange={(v) => updateSpan({ spigotSubstrate: v as "concrete" | "timber" | "steel" })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-channel-substrate`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concrete">Concrete</SelectItem>
                    <SelectItem value="timber">Timber deck</SelectItem>
                    <SelectItem value="steel">Steel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground">Mounting</Label>
                  <InfoTooltip content="The channel mounts flat to your deck or slab and the glass sits inside it. Face-mounted channel (bolted to a balcony edge) is a future addition." />
                </div>
                <div className="flex h-8 items-center rounded-md border border-card-border bg-muted/30 px-3 text-xs text-muted-foreground">
                  Deck mount
                </div>
              </div>
            </div>

            {/* Channel terminations — every open channel end gets an end cap or a cut
                mitre. A gate breaks the channel, adding two more ends to finish. */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Channel Terminations</Label>
                <InfoTooltip content="Every open end of the channel is finished with an end cap, or mitre-cut where it meets another channel at a corner. A gate breaks the channel, so both sides of the gate also need a termination." />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: "channel-term-lhs", label: "Left end" },
                  { key: "channel-term-rhs", label: "Right end" },
                  ...(gateInLayout
                    ? [
                        { key: "channel-term-gate-lhs", label: "Gate break — left side" },
                        { key: "channel-term-gate-rhs", label: "Gate break — right side" },
                      ]
                    : []),
                ].map((t) => (
                  <div key={t.key} className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t.label}</Label>
                    <Select value={channelTermOf(t.key)} onValueChange={(v) => setChannelField(t.key, v)}>
                      <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-${t.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end-cap">End cap</SelectItem>
                        <SelectItem value="mitre">Cut mitre (corner)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel lengths, joins & offcut reuse — 4200mm stock. Offcuts from earlier
                sections are reused AUTOMATICALLY (cut optimisation — saves waste & cost). */}
            <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-channel-usage`}>
              <p className="text-[11px] font-semibold">Channel for this section</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {channelPlan.fullLengths} × {channelStockMm}mm length{channelPlan.fullLengths === 1 ? "" : "s"}
                {channelPlan.claimed.length > 0
                  ? ` + ${channelPlan.claimed
                      .map((o) => `${o.lengthMm.toLocaleString()}mm offcut from ${o.fromLabel}`)
                      .join(" + ")} (reused automatically)`
                  : ""}
                {channelPlan.joins > 0
                  ? ` · ${channelPlan.joins} join${channelPlan.joins > 1 ? "s" : ""} (${channelPlan.pins} joining pins — ${channelPlan.pinPacks} pack${channelPlan.pinPacks > 1 ? "s" : ""} of 10)`
                  : " · no joins"}
                {` · Offcut left over: ${channelPlan.offcutOut.toLocaleString()}mm`}
              </p>
              {channelPlan.claimed.length > 0 && (
                <p className="mt-1 text-[11px] font-medium text-primary">
                  Cut optimisation: reusing offcuts saved {channelPlan.claimed.length} extra length
                  {channelPlan.claimed.length > 1 ? "s" : ""} of channel on this section.
                </p>
              )}
            </div>

            {/* Fixings included — per substrate (M12; channel anchors at 300mm centres). */}
            <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-fixings-info`}>
              <p className="text-[11px] font-semibold">Fixings included ({substrateLabel.toLowerCase()} · deck mount)</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{channelFixingsInfo[substrate]}</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      ) : (
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

          {/* Substrate FIRST — it determines which mountings are possible (SF-1 §2.4). */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Substrate</Label>
                <InfoTooltip content="The surface the spigots fix to. Concrete can be core-drilled or base-plated; timber decks and steel must be base-plated. Each section can use a different substrate." />
              </div>
              <Select
                value={substrate}
                onValueChange={(v: "concrete" | "timber" | "steel") => {
                  // Timber/steel can't be core-drilled — switch to base-plate automatically.
                  const updates: Partial<SpanConfig> = { spigotSubstrate: v };
                  if (v !== "concrete" && span.spigotMounting === "core-drilled") {
                    updates.spigotMounting = "base-plate";
                  }
                  updateSpan(updates);
                }}
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

            {/* Mounting — options filtered by substrate (core-drill needs concrete). */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Mounting</Label>
                <InfoTooltip content="Core-drill drops the spigot into a grouted hole in concrete. Base-plate bolts onto the finished surface — the only option for timber decks and steel." />
              </div>
              <Select
                value={mounting}
                onValueChange={(v: "base-plate" | "core-drilled") => updateSpan({ spigotMounting: v })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-spigot-mounting`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base-plate">Base Plate</SelectItem>
                  {substrate === "concrete" && <SelectItem value="core-drilled">Core Drilled</SelectItem>}
                </SelectContent>
              </Select>
              {substrate !== "concrete" && (
                <p className="text-[10px] leading-tight text-muted-foreground">Core-drill needs solid concrete.</p>
              )}
            </div>
          </div>

          {/* Covers — category follows the mounting (core-drill → dress rings;
              base-plate → domical covers); variant range is per family (COVER_MATRIX).
              Families with a single variant show it as "included" — no fake choice. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">
                Spigot Covers — {mounting === "core-drilled" ? "core-drilled spigots take dress rings" : "base-plated spigots take domical covers"}
              </Label>
              <InfoTooltip content="Covers hide the spigot base. Core-drilled spigots sit into the ground, so a dress ring covers the entry. Base-plated spigots have a visible plate and bolts, so a domical cover hides the lot. Finished to match your spigot finish." />
            </div>
            {coverOptions.length === 1 ? (
              /* Single variant for this family — show as included, not a choice. */
              <div
                className="flex max-w-md items-center gap-2.5 rounded-md border border-card-border bg-muted/30 p-2.5"
                data-testid={`span-${span.spanId}-cover-included`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-center">
                  {familyImageSrc(selectedCover.sku) ? (
                    <img src={familyImageSrc(selectedCover.sku)} alt={selectedCover.label} className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="px-0.5 font-mono text-[7px] leading-tight text-muted-foreground">{selectedCover.sku}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{selectedCover.label} included</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {selectedCover.blurb} Finished to match your spigots.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid max-w-md grid-cols-2 gap-2.5" data-testid={`span-${span.spanId}-cover-picker`}>
                {coverOptions.map((opt) => {
                  const active = spigotCover === opt.value;
                  const img = familyImageSrc(opt.sku);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && updateSpan({ fieldValues: { ...span.fieldValues, "spigot-cover": opt.value } })}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors hover-elevate active-elevate-2",
                        active ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
                        opt.disabled && "cursor-not-allowed opacity-50",
                      )}
                      data-testid={`span-${span.spanId}-cover-${opt.value}`}
                    >
                      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded bg-muted text-center">
                        {img ? (
                          <img src={img} alt={opt.label} className="h-full w-full object-contain" loading="lazy" />
                        ) : (
                          <span className="px-1 text-[9px] leading-tight text-muted-foreground">
                            image soon
                            <br />
                            <span className="font-mono">{opt.sku}</span>
                          </span>
                        )}
                        {active && (
                          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{opt.label}</p>
                        <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {opt.disabled ? opt.disabledReason : opt.blurb}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fixings — auto-included per substrate × mounting (informational, not a choice). */}
          <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-fixings-info`}>
            <p className="text-[11px] font-semibold">Fixings included ({substrateLabel.toLowerCase()} · {mountingLabel.toLowerCase()})</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{fixingsInfo}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
      )}

      {/* 3. Gate, raked & custom — "+ add" image-cards. Pool styles only: balustrade
          has no gates and no raked panels (operator rule, cross-style). */}
      {!isBalChannel && (gateEnabled || rakedEnabled || customEnabled) && (
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
                    <>
                      <GateControls
                        config={span.gateConfig}
                        spanId={span.spanId}
                        onUpdate={(gateConfig) => updateSpan({ gateConfig: { ...gateConfig, postAdapterPlate: gateConfig.postAdapterPlate ?? false } })}
                        calculatedHingePanelSize={optimalHingePanelSize}
                        numPanels={span.panelLayout?.panels.length}
                        actualGateCentre={actualGateCentre}
                        spanLengthMm={span.length}
                        leftEndGapMm={span.leftGap?.enabled ? span.leftGap.size : 0}
                        rightEndGapMm={span.rightGap?.enabled ? span.rightGap.size : 0}
                      />

                      {/* Hinge & latch finish — match the spigot finish (default) or pick
                          a finish for the gate hardware. Stored in fieldValues so the
                          solver pass can map it to the brand-specific SKU suffix. */}
                      <div className="space-y-1.5 rounded-md border border-card-border p-2.5" data-testid={`span-${span.spanId}-hardware-finish`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs font-medium">Hinge &amp; latch finish</Label>
                            <InfoTooltip content="The finish of the gate hinges and latch. Matching the spigot finish keeps all the hardware consistent; pick a finish here to contrast instead." />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              Match spigots ({FINISH_LABEL[currentFinish]})
                            </span>
                            <Switch
                              checked={hardwareFinish === "match"}
                              onCheckedChange={(on) =>
                                updateSpan({
                                  fieldValues: { ...span.fieldValues, "hardware-finish": on ? "match" : currentFinish },
                                })
                              }
                              data-testid={`span-${span.spanId}-hardware-finish-match`}
                            />
                          </div>
                        </div>
                        {hardwareFinish !== "match" && (
                          <div className="flex flex-wrap gap-1.5" data-testid={`span-${span.spanId}-hardware-finish-picker`}>
                            {(["polished", "satin", "black", "white"] as Finish[]).map((f) => {
                              const active = hardwareFinish === f;
                              return (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => updateSpan({ fieldValues: { ...span.fieldValues, "hardware-finish": f } })}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover-elevate active-elevate-2",
                                    active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border",
                                  )}
                                  data-testid={`span-${span.spanId}-hardware-finish-${f}`}
                                >
                                  <span className={cn("h-3.5 w-3.5 rounded-full", FINISH_SWATCH[f])} />
                                  {FINISH_LABEL[f]}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
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

      {/* 3. Rail — glass-bal-channel only: 35-Series top rail (the single V1 rail
          family). Finish auto-matches the channel finish; 5800mm stock lengths with
          the same automatic cross-section cut optimisation as the channel. */}
      {isBalChannel && (
        <AccordionItem value="rail" className="px-3">
          <AccordionTrigger
            className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
            data-testid={`span-${span.spanId}-accordion-rail`}
          >
            <SectionHeader n={3} title="Rail" summary={railSummary} />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Top Mounted Rail</Label>
                <InfoTooltip content="35-Series top rail (35×35mm anodised aluminium) — the handrail for the channel system. Standard 5800mm lengths, optimised across sections to reduce wastage." />
              </div>
              <Switch
                checked={rail?.enabled || false}
                onCheckedChange={(enabled) => {
                  if (enabled) {
                    updateSpan({
                      handrail: rail
                        ? { ...rail, enabled: true, type: "series-35x35", material: "anodised-aluminium", finish: railFinish }
                        : {
                            enabled: true,
                            type: "series-35x35",
                            material: "anodised-aluminium",
                            finish: railFinish,
                            startTermination: "end-cap",
                            endTermination: "end-cap",
                          },
                    });
                  } else {
                    updateSpan({ handrail: rail ? { ...rail, enabled: false } : undefined });
                  }
                }}
                data-testid={`span-${span.spanId}-top-rail-toggle`}
              />
            </div>

            {rail?.enabled && (
              <div className="space-y-3">
                {/* 35 Series is the single V1 rail family; finish auto-matches the channel
                    (operator ruling: Black→Black, Satin Anodised→Satin Anodised). */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rail</Label>
                    <div
                      className="flex h-8 items-center rounded-md border border-card-border bg-muted/30 px-3 text-xs text-muted-foreground"
                      data-testid={`span-${span.spanId}-rail-type`}
                    >
                      35×35mm (Series 35) · Anodised Aluminium
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Finish</Label>
                      <InfoTooltip content="The rail finish automatically matches your channel finish — a Black channel gets a Black rail, a Satin Anodised channel gets a Satin Anodised rail." />
                    </div>
                    <div
                      className="flex h-8 items-center gap-2 rounded-md border border-card-border bg-muted/30 px-3 text-xs text-muted-foreground"
                      data-testid={`span-${span.spanId}-rail-finish`}
                    >
                      <span
                        className={cn(
                          "h-3.5 w-3.5 rounded-full border border-black/10",
                          channelFinish === "black" ? "bg-zinc-900" : "bg-gradient-to-br from-zinc-300 to-zinc-400",
                        )}
                      />
                      {railFinishLabel} (matches channel)
                    </div>
                  </div>
                </div>

                {/* Rail terminations per end — same enum as the bal spigots Rail accordion. */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start Termination</Label>
                    <Select
                      value={rail.startTermination || "end-cap"}
                      onValueChange={(t) =>
                        updateSpan({
                          handrail: { ...rail, startTermination: t as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-start-termination`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end-cap">End Cap</SelectItem>
                        <SelectItem value="wall-tie">Wall Tie</SelectItem>
                        <SelectItem value="90-degree">90° Corner</SelectItem>
                        <SelectItem value="adjustable-corner">Adjustable Corner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End Termination</Label>
                    <Select
                      value={rail.endTermination || "end-cap"}
                      onValueChange={(t) =>
                        updateSpan({
                          handrail: { ...rail, endTermination: t as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-end-termination`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end-cap">End Cap</SelectItem>
                        <SelectItem value="wall-tie">Wall Tie</SelectItem>
                        <SelectItem value="90-degree">90° Corner</SelectItem>
                        <SelectItem value="adjustable-corner">Adjustable Corner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Rail lengths & offcut reuse — 5800mm stock, same cut-plan engine as the channel. */}
                <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-rail-usage`}>
                  <p className="text-[11px] font-semibold">Rail for this section</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {railPlan.fullLengths} × 5800mm length{railPlan.fullLengths === 1 ? "" : "s"}
                    {railPlan.claimed.length > 0
                      ? ` + ${railPlan.claimed
                          .map((o) => `${o.lengthMm.toLocaleString()}mm offcut from ${o.fromLabel}`)
                          .join(" + ")} (reused automatically)`
                      : ""}
                    {railPlan.joins > 0
                      ? ` · ${railPlan.joins} join${railPlan.joins > 1 ? "s" : ""} (1 inline joiner per join)`
                      : " · no joins"}
                    {` · Offcut left over: ${railPlan.offcutOut.toLocaleString()}mm`}
                  </p>
                  {railPlan.claimed.length > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-primary">
                      Cut optimisation: reusing offcuts saved {railPlan.claimed.length} extra length
                      {railPlan.claimed.length > 1 ? "s" : ""} of rail on this section.
                    </p>
                  )}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      )}

    </Accordion>
  );
}
