import { useEffect, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, CircleDot, FlipHorizontal, Layers, Minus, Pencil, Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SpanConfig } from "@shared/schema";
import { panelCutPlans } from "@/lib/cut-plan";
import { InfoTooltip } from "../info-tooltip";
import { HardwareCard, HardwareCardGrid, IconOptionPicker, LayoutModeThumb } from "./hardware-card";

interface AluPoolTubularConfigProps {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  /** All sections in design order — for cross-section panel offcut reuse. */
  allSpans?: SpanConfig[];
}

// Flat Top Tubular Pool Fence (SF-3 / PTS-024 / inputs spec 2026-05-25 + Path C lock):
// the traffic-driver budget aluminium pool fence. 3 finishes drive every SKU; 3000mm
// stock is Black-only; White borrows the Xpress (XP-) post range. Shrouds are the
// bracket-equivalent. AS 1926.1 compliant by design.
const GATE_W_MM = 975;
const POST_MM = 50;

type Finish = "black" | "white" | "monument";
const FINISH_META: Record<Finish, { code: "B" | "W" | "MN"; label: string; swatch: string }> = {
  black: { code: "B", label: "Black", swatch: "bg-zinc-900" },
  white: { code: "W", label: "White", swatch: "bg-white ring-1 ring-inset ring-zinc-300" },
  monument: { code: "MN", label: "Monument", swatch: "bg-slate-500" },
};

type Substrate = "decking" | "concrete-slab" | "in-ground" | "core-drilled" | "side-mounted";
const SUBSTRATE_HARDWARE: Record<
  Substrate,
  {
    short: string;
    postSku: (code: string, white: boolean) => string;
    postTitle: string;
    coverSku?: (code: string, white: boolean) => string;
    coverTitle?: string;
    fixingSku?: (code: string) => string;
    fixingTitle?: string;
    fixingChip?: string;
    fixingTip: string;
    supplyNote?: string;
  }
> = {
  decking: {
    short: "Decking",
    postSku: (c, w) => (w ? "XP-1300-BP-W" : `SS-1300-BP-${c}`),
    postTitle: "1300mm Base Plate Post",
    coverSku: (c, w) => (w ? "XP-DC-2P-W" : `SS-DC-${c}`),
    coverTitle: "Domical Cover",
    fixingSku: () => `CSK-100-4PK`,
    fixingTitle: "CSK Screws",
    fixingChip: "1 pack / 4 posts",
    fixingTip: "M10×100mm countersunk batten screw 4-packs — 1 pack per 4 posts, fixed into structural timber.",
  },
  "concrete-slab": {
    short: "Concrete slab",
    postSku: (c, w) => (w ? "XP-1300-BP-W" : `SS-1300-BP-${c}`),
    postTitle: "1300mm Base Plate Post",
    coverSku: (c, w) => (w ? "XP-DC-2P-W" : `SS-DC-${c}`),
    coverTitle: "Domical Cover",
    fixingTip: "You supply the concrete fixings. The base plates are pre-drilled ready to bolt down.",
    supplyNote: "You supply: concrete fixings",
  },
  "in-ground": {
    short: "In-ground",
    postSku: (_c, w) => (w ? "XP-1800-FP-W" : `SS-1800-${_c}`),
    postTitle: "1800mm Post",
    fixingTip: "The extra post length sets into your post holes. You supply the concrete mix.",
    supplyNote: "You supply: concrete mix",
  },
  "core-drilled": {
    short: "Core-drilled",
    postSku: (_c, w) => (w ? "XP-1800-FP-W" : `SS-1800-${_c}`),
    postTitle: "1800mm Post",
    fixingSku: () => `GROUT-SETFAST-10KG`,
    fixingTitle: "Grout 10kg",
    fixingChip: "1 / 10 posts",
    fixingTip: "Pourable grout — 1 × 10kg bag per 10 posts plus a spare.",
  },
  // Side-mount uses the shared AIRE face-mount posts (B/W/MN — AR-1500-*-MN exists per
  // operator 2026-06-04). Fixing material defaults to concrete until the picker lands.
  "side-mounted": {
    short: "Side-mounted",
    postSku: (c) => `AR-1500-FMID-${c}`,
    postTitle: "AIRE 1500mm Face-Mount Post",
    coverSku: (_c, w) => (w ? "GS-DN-4PK" : "GS-DN-4PK-B"),
    coverTitle: "M12 Dome Nut 4-pack",
    fixingSku: () => `GS150ROD`,
    fixingTitle: "M12 Rods + Anchor",
    fixingChip: "4 / post",
    fixingTip: "AIRE face-mount posts bolt to a vertical face (fascia or slab edge) with M12 fixings + a dome-nut pack per post. Currently assumes a concrete face (rod + chemical anchor) — a timber/concrete/steel picker is coming.",
  },
};

const TIP = {
  finish: "Black, White or Monument — your pick flows through to every post, shroud and the gate. The wide 3000mm panel is Black-only; White and Monument run the 2450mm panel.",
  width: "Black runs in a wide 3000mm panel (fewer posts, cheaper per metre) or the standard 2450mm. White and Monument are 2450mm only.",
  layoutMode:
    "Evenly spaced cuts every panel the same. Full panels + infill keeps as many factory panels as possible and cuts one infill — fewer cuts, one narrower bay.",
  substrate:
    "What the posts fix to. Decking and concrete slab use base-plated posts; in-ground and core-drilled use longer posts set into the ground or core holes.",
  posts: "Posts, shrouds and covers are included automatically to match your finish and substrate.",
  angled: "Square (90°) corners are handled by the standard shroud kit. Each ANGLED corner needs swivel shrouds — set how many angled corners your run has.",
  gate: "Adds a 975mm self-closing gate. Black and Monument ship the D&D hinge & latch as one bundled kit; White ships them as two separate D&D items.",
  gatePosition:
    "Where the gate sits along this section. Standard lets the calculator place it; Set position pins the gate's centre to a measurement from the left end.",
  cuts: "Cut panels are cut down from a full stock panel — cut between the pickets, never through one. Offcuts big enough to cover another bay are reused automatically across your sections.",
};

function SectionHeader({ n, title, summary }: { n: number; title: string; summary?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="shrink-0 text-sm font-medium">{title}</span>
      {summary && (
        <>
          <span className="acc-summary min-w-0 flex-1 truncate text-left text-xs text-muted-foreground">{summary}</span>
          <span className="acc-summary ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" /> edit
          </span>
        </>
      )}
    </span>
  );
}

/**
 * Flat Top Tubular configure block — Oxworks accordion on the Blade/BARR visual
 * template. The most complex alu pool style: 3 finishes (3000mm Black-only),
 * cross-range White posts/covers, shrouds as the bracket-equivalent, swivel
 * shrouds at angled corners, and finish-asymmetric gate hardware.
 */
export function AluPoolTubularConfig({ span, updateSpan, allSpans }: AluPoolTubularConfigProps) {
  const designSpans = allSpans?.length ? allSpans : [span];

  const layoutMode = span.tubularLayoutMode || "equally-spaced";
  const finish = (span.tubularFinish || "black") as Finish;
  const fin = FINISH_META[finish];
  const isWhite = fin.code === "W";
  const substrate = ((span.fieldValues?.["tubular-substrate"] as string) || "decking") as Substrate;
  const hw = SUBSTRATE_HARDWARE[substrate];
  // Black may use the wide 3000mm panel; White/Monument are 2450 only.
  const stockWidth = finish === "black" && span.tubularPanelWidth === "3000mm" ? "3000mm" : "2450mm";
  const gateOn = !!span.gateConfig?.required;
  const angledCorners = parseInt(String(span.fieldValues?.["tubular-angled-corners"] ?? "0"), 10) || 0;

  // Defaults + keep the panel width valid for the finish (only Black has 3000mm).
  useEffect(() => {
    const updates: Partial<SpanConfig> = {};
    if (span.tubularHeight !== "1200mm") updates.tubularHeight = "1200mm";
    if (!span.tubularLayoutMode) updates.tubularLayoutMode = "equally-spaced";
    if (!span.tubularFinish) updates.tubularFinish = "black";
    if (!span.tubularPanelWidth) updates.tubularPanelWidth = "2450mm";
    if (finish !== "black" && span.tubularPanelWidth === "3000mm") updates.tubularPanelWidth = "2450mm";
    if (!span.fieldValues?.["tubular-substrate"]) {
      updates.fieldValues = { ...span.fieldValues, "tubular-substrate": "decking" };
    }
    if (Object.keys(updates).length) updateSpan(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId, finish]);

  // ── Layout-derived counts ────────────────────────────────────────────────────────
  const layoutPanels = span.panelLayout?.panels ?? [];
  const layoutTypes = span.panelLayout?.panelTypes ?? layoutPanels.map(() => "standard");
  const tubPanelWidths = layoutPanels.filter((_, i) => layoutTypes[i] !== "gate");
  const postCount = layoutPanels.length ? layoutPanels.length + 1 : 0;
  const gateIndex = layoutTypes.indexOf("gate");

  // ── Panel cut plan with cross-section offcut reuse. ─────────────────────────────
  const stockWidthMm = stockWidth === "3000mm" ? 3000 : 2450;
  const cutPlans = panelCutPlans(
    designSpans.map((s) => {
      const panels = s.panelLayout?.panels ?? [];
      const types = s.panelLayout?.panelTypes ?? panels.map(() => "standard");
      return {
        id: s.spanId,
        label: s.name?.trim() || `Section ${s.spanId}`,
        panelWidthsMm: panels.filter((_, i) => types[i] !== "gate"),
      };
    }),
    stockWidthMm,
  );
  const cutPlanRaw = cutPlans.get(span.spanId);
  const cutPlan = {
    fullPanels: cutPlanRaw?.fullPanels ?? 0,
    cutPanels: cutPlanRaw?.cutPanels ?? 0,
    cutWidths: cutPlanRaw?.cutWidthsMm ?? [],
    claimed: cutPlanRaw?.claimedOffcuts ?? [],
    offcutsOut: cutPlanRaw?.offcutsOutMm ?? [],
  };
  const stockPanelsNeeded = cutPlan.fullPanels + cutPlan.cutPanels;
  const totalPanels = stockPanelsNeeded + cutPlan.claimed.length;

  // ── Gate position — DUAL MODE (parity with the glass + Blade + BARR gates) ──────
  const CENTRE_STEP = 50;
  const maxGatePosition = tubPanelWidths.length;
  const gatePosition = span.gateConfig?.position ?? 0;
  const definedMode = span.gateConfig?.centreFromLeft != null;
  const minCentre = Math.ceil(POST_MM + GATE_W_MM / 2);
  const maxCentre = Math.floor(span.length - POST_MM - GATE_W_MM / 2);
  const clampCentre = (n: number) => Math.max(minCentre, Math.min(maxCentre, n));
  const actualGateCentre = (() => {
    if (gateIndex < 0 || !span.panelLayout) return undefined;
    const gaps = span.panelLayout.gaps ?? [];
    let x = 0;
    for (let i = 0; i < gateIndex; i++) x += (gaps[i] ?? 0) + layoutPanels[i];
    x += gaps[gateIndex] ?? 0;
    return Math.round(x + layoutPanels[gateIndex] / 2);
  })();
  const [centreText, setCentreText] = useState<string>("");
  const [centreFocused, setCentreFocused] = useState(false);
  useEffect(() => {
    if (!centreFocused) {
      const v = span.gateConfig?.centreFromLeft ?? actualGateCentre;
      if (v != null) setCentreText(String(Math.round(v)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.gateConfig?.centreFromLeft, actualGateCentre, centreFocused]);

  const moveGate = (delta: number) => {
    if (!span.gateConfig) return;
    if (definedMode) {
      const base = span.gateConfig.centreFromLeft ?? actualGateCentre ?? minCentre;
      updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clampCentre(base + delta * CENTRE_STEP) } });
    } else {
      const next = Math.max(0, Math.min(maxGatePosition, gatePosition + delta));
      if (next !== gatePosition) updateSpan({ gateConfig: { ...span.gateConfig, position: next } });
    }
  };
  const gatePositionLabel =
    gateIndex < 0 ? "" : gateIndex === 0 ? "left end" : gateIndex >= layoutPanels.length - 1 ? "right end" : `bay ${gateIndex + 1} of ${layoutPanels.length}`;

  const enableGate = () =>
    updateSpan({
      gateConfig: {
        required: true,
        hardware: "polaris",
        hingeFrom: "glass",
        latchTo: "glass",
        hingeType: "glass-to-glass",
        latchType: "glass-to-glass",
        gateSize: GATE_W_MM,
        hingePanelSize: 2450,
        autoHingePanel: false,
        position: 0,
        flipped: false,
        hingeGap: 20,
        latchGap: 20,
        postAdapterPlate: false,
      },
    });
  const disableGate = () => updateSpan({ gateConfig: undefined });

  const setAngled = (n: number) =>
    updateSpan({ fieldValues: { ...span.fieldValues, "tubular-angled-corners": String(Math.max(0, n)) } });

  // ── Section summaries ────────────────────────────────────────────────────────────
  const configureSummary = span.panelLayout
    ? `${fin.label} · ${stockWidth} · ${totalPanels} panel${totalPanels === 1 ? "" : "s"}`
    : `${fin.label} · ${stockWidth}`;
  const postsSummary = span.panelLayout
    ? `${hw.short} · ${postCount} × ${hw.postTitle}${angledCorners > 0 ? ` · ${angledCorners} angled` : ""}`
    : `${hw.short} · ${hw.postTitle}`;
  const gateSummary = gateOn
    ? `975mm gate${gatePositionLabel ? ` · ${gatePositionLabel}` : ""} · ${isWhite ? "D&D latch + hinges" : "D&D kit"}`
    : "None — open to add a gate";

  return (
    <Accordion type="multiple" defaultValue={["configure", "posts", "gate"]} className="rounded-md border border-card-border">
      {/* 1. Configure — finish swatches + (Black) width + layout cards + cut plan. */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden" data-testid={`span-${span.spanId}-accordion-configure`}>
          <SectionHeader n={1} title="Configure" summary={configureSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {/* Finish — drives EVERY SKU (B/W/MN). */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <InfoTooltip content={TIP.finish} />
            </div>
            <div className="flex flex-wrap gap-1.5" data-testid={`span-${span.spanId}-finish-picker`}>
              {(Object.keys(FINISH_META) as Finish[]).map((f) => {
                const meta = FINISH_META[f];
                const active = f === finish;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => updateSpan({ tubularFinish: f })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover-elevate active-elevate-2",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border",
                    )}
                    data-testid={`span-${span.spanId}-finish-${f}`}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", meta.swatch)} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel width — Black only (2450 / 3000). Hidden for White/Monument (2450 fixed). */}
          {finish === "black" ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Panel Width</Label>
                <InfoTooltip content={TIP.width} />
              </div>
              <div className="grid grid-cols-2 gap-2" data-testid={`span-${span.spanId}-tubular-width`}>
                {(["2450mm", "3000mm"] as const).map((w) => {
                  const active = stockWidth === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => updateSpan({ tubularPanelWidth: w })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-md border p-2 transition-colors hover-elevate active-elevate-2",
                        active ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
                      )}
                      data-testid={`span-${span.spanId}-width-${w}`}
                    >
                      <span className="text-xs font-semibold">{w}</span>
                      <span className="text-[10px] text-muted-foreground">{w === "3000mm" ? "Wide · fewer posts" : "Standard"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground" data-testid={`span-${span.spanId}-tubular-width`}>
              {fin.label} runs the 2450mm panel (the wide 3000mm panel is Black-only).
            </p>
          )}

          {/* Layout mode — visual cards. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Panel Layout</Label>
              <InfoTooltip content={TIP.layoutMode} />
            </div>
            <div className="grid grid-cols-2 gap-2" data-testid={`span-${span.spanId}-tubular-layout-mode`}>
              {(
                [
                  { value: "equally-spaced", label: "Evenly spaced", thumb: "even" as const },
                  { value: "full-panels-cut-end", label: "Full panels + infill", thumb: "infill" as const },
                ] as const
              ).map((m) => {
                const active = layoutMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => updateSpan({ tubularLayoutMode: m.value })}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-md border p-2.5 transition-colors hover-elevate active-elevate-2",
                      active ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
                    )}
                    data-testid={`span-${span.spanId}-layout-mode-${m.value}`}
                  >
                    <LayoutModeThumb variant={m.thumb} />
                    <span className="text-xs font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel + cut plan. */}
          <div className="grid grid-cols-[96px_1fr] gap-2.5 rounded-md border border-card-border p-2.5" data-testid={`span-${span.spanId}-panel-cut-plan`}>
            <HardwareCard
              imageSku={stockWidth === "3000mm" ? "SS-FTP-3000-B" : `SS-FTP-2450-${fin.code}`}
              title="Flat Top Panel"
              chip={span.panelLayout ? `× ${stockPanelsNeeded}` : undefined}
              testId={`span-${span.spanId}-panel-card`}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold">Panels &amp; cuts</p>
                <InfoTooltip content={TIP.cuts} />
              </div>
              {span.panelLayout ? (
                <ul className="space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  <li>
                    {stockPanelsNeeded} × {stockWidth} stock
                    {cutPlan.fullPanels > 0 ? ` · ${cutPlan.fullPanels} full` : ""}
                    {cutPlan.cutPanels > 0 ? ` · ${cutPlan.cutPanels} cut → ${cutPlan.cutWidths.map((w) => Math.round(w)).join(", ")}mm` : ""}
                  </li>
                  {cutPlan.claimed.length > 0 && (
                    <li className="font-medium text-primary">
                      {cutPlan.claimed.length} cut from offcuts — saved {cutPlan.claimed.length} panel{cutPlan.claimed.length > 1 ? "s" : ""}
                    </li>
                  )}
                  <li>
                    {cutPlan.offcutsOut.length > 0
                      ? `Offcuts left: ${cutPlan.offcutsOut.map((o) => Math.round(o)).join(", ")}mm (auto-reused)`
                      : "No usable offcuts"}
                  </li>
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">Cuts appear once the layout is calculated.</p>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Posts & Substrate — icon picker + hardware cards + angled-corner shrouds. */}
      <AccordionItem value="posts" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden" data-testid={`span-${span.spanId}-accordion-posts`}>
          <SectionHeader n={2} title="Posts & Substrate" summary={postsSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Substrate</Label>
              <InfoTooltip content={TIP.substrate} />
            </div>
            <IconOptionPicker
              spanId={span.spanId}
              idPrefix="tubular-substrate"
              value={substrate}
              onSelect={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "tubular-substrate": v } })}
              options={[
                { value: "decking", label: "Decking", blurb: "Timber deck", icon: <Layers className="h-6 w-6" /> },
                { value: "concrete-slab", label: "Concrete Slab", blurb: "Bolt-down", icon: <Square className="h-6 w-6" /> },
                { value: "in-ground", label: "In-ground", blurb: "Post holes", icon: <ArrowDownToLine className="h-6 w-6" /> },
                { value: "core-drilled", label: "Core-drilled", blurb: "Into concrete", icon: <CircleDot className="h-6 w-6" /> },
                { value: "side-mounted", label: "Side-mounted", blurb: "AIRE face-mount", icon: <FlipHorizontal className="h-6 w-6" /> },
              ]}
            />
          </div>

          {/* Included hardware — product cards. Shrouds are the tubular bracket-equivalent. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Included for this section</Label>
              <InfoTooltip content={TIP.posts} />
            </div>
            <HardwareCardGrid testId={`span-${span.spanId}-included-hardware`}>
              <HardwareCard
                imageSku={hw.postSku(fin.code, isWhite)}
                title={hw.postTitle}
                chip={span.panelLayout ? `× ${postCount}` : undefined}
                blurb={isWhite ? "50×50mm · Xpress range" : "50×50mm · cap included"}
                testId={`span-${span.spanId}-post-card`}
              />
              {hw.coverSku && (
                <HardwareCard
                  imageSku={hw.coverSku(fin.code, isWhite)}
                  title={hw.coverTitle!}
                  chip={span.panelLayout ? `× ${postCount}` : "1 / post"}
                  blurb="Finishes the post base"
                  testId={`span-${span.spanId}-cover-card`}
                />
              )}
              <HardwareCard
                imageSku={`SS-BH4-${fin.code}`}
                title="Shroud Kit"
                chip={span.panelLayout ? `× ${tubPanelWidths.length}` : "1 / panel"}
                blurb="4 shrouds + screws / panel"
                testId={`span-${span.spanId}-shroud-card`}
              />
              {hw.fixingSku && (
                <HardwareCard
                  imageSku={hw.fixingSku(fin.code)}
                  title={hw.fixingTitle!}
                  chip={hw.fixingChip}
                  blurb="Included to match"
                  testId={`span-${span.spanId}-fixing-card`}
                />
              )}
            </HardwareCardGrid>
            <div className="flex items-center gap-1.5" data-testid={`span-${span.spanId}-fixings-info`}>
              <p className="text-[11px] text-muted-foreground">{hw.supplyNote ?? `${hw.fixingTitle} included`}</p>
              <InfoTooltip content={hw.fixingTip} />
            </div>
          </div>

          {/* Angled corners → horizontal swivel shrouds (square corners use the std kit). */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Angled corners</Label>
              <InfoTooltip content={TIP.angled} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-md border border-card-border">
                <Button
                  type="button" variant="ghost" size="sm" className="h-8 px-2"
                  disabled={angledCorners <= 0}
                  onClick={() => setAngled(angledCorners - 1)}
                  data-testid={`span-${span.spanId}-angled-minus`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-xs font-semibold" data-testid={`span-${span.spanId}-angled-count`}>{angledCorners}</span>
                <Button
                  type="button" variant="ghost" size="sm" className="h-8 px-2"
                  onClick={() => setAngled(angledCorners + 1)}
                  data-testid={`span-${span.spanId}-angled-plus`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {angledCorners > 0 && (
                <div className="flex-1">
                  <HardwareCard
                    imageSku={`SS-BSWIV-HORIZ-${fin.code}`}
                    title="Horizontal Swivel Shroud"
                    chip={`× ${angledCorners * 4}`}
                    blurb="4 per angled corner"
                    testId={`span-${span.spanId}-swivel-card`}
                  />
                </div>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 3. Gate — finish-asymmetric hardware + dual-mode position. */}
      <AccordionItem value="gate" className="px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden" data-testid={`span-${span.spanId}-accordion-gate`}>
          <SectionHeader n={3} title="Gate" summary={gateSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Add a Gate</Label>
              <InfoTooltip content={TIP.gate} />
            </div>
            <Switch checked={gateOn} onCheckedChange={(on) => (on ? enableGate() : disableGate())} data-testid={`span-${span.spanId}-tubular-gate-toggle`} />
          </div>

          {gateOn && (
            <div className="space-y-3">
              <div className="space-y-2 pb-3 border-b border-border" data-testid={`span-${span.spanId}-gate-position`}>
                <div className="flex items-center gap-1">
                  <Label className="text-sm font-medium">Gate Position</Label>
                  <InfoTooltip content={TIP.gatePosition} />
                </div>
                <div className="flex w-fit overflow-hidden rounded-md border border-input">
                  <button
                    type="button"
                    onClick={() => span.gateConfig && updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: undefined } })}
                    className={cn("px-3 py-1.5 text-xs font-medium transition-colors", !definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate")}
                    data-testid={`gate-${span.spanId}-mode-standard`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => span.gateConfig && updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clampCentre(actualGateCentre ?? minCentre) } })}
                    className={cn("border-l border-input px-3 py-1.5 text-xs font-medium transition-colors", definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate")}
                    data-testid={`gate-${span.spanId}-mode-defined`}
                  >
                    Set position
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" variant="default" className="font-semibold" onClick={() => moveGate(-1)}
                    disabled={definedMode ? (span.gateConfig?.centreFromLeft ?? minCentre) - CENTRE_STEP < minCentre : gatePosition <= 0}
                    data-testid={`gate-${span.spanId}-move-left`}>
                    <ChevronLeft className="w-4 h-4 mr-1.5" />Move Left
                  </Button>
                  <Button type="button" variant="default" className="font-semibold"
                    onClick={() => span.gateConfig && updateSpan({ gateConfig: { ...span.gateConfig, flipped: !span.gateConfig.flipped } })}
                    data-testid={`gate-${span.spanId}-flip`}>
                    <FlipHorizontal className="w-4 h-4 mr-1.5" />Flip
                  </Button>
                  <Button type="button" variant="default" className="font-semibold" onClick={() => moveGate(1)}
                    disabled={definedMode ? (span.gateConfig?.centreFromLeft ?? maxCentre) + CENTRE_STEP > maxCentre : gatePosition >= maxGatePosition}
                    data-testid={`gate-${span.spanId}-move-right`}>
                    <ChevronRight className="w-4 h-4 mr-1.5" />Move Right
                  </Button>
                </div>
                {definedMode ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Gate centre:</span>
                    <div className="relative w-28">
                      <input
                        type="number" inputMode="numeric" value={centreText}
                        onFocus={() => setCentreFocused(true)}
                        onChange={(e) => {
                          setCentreText(e.target.value);
                          const n = parseInt(e.target.value, 10);
                          if (!Number.isNaN(n) && span.gateConfig) updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clampCentre(n) } });
                        }}
                        onBlur={() => {
                          setCentreFocused(false);
                          const n = parseInt(centreText, 10);
                          if (!Number.isNaN(n) && span.gateConfig) {
                            const clamped = clampCentre(n);
                            updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clamped } });
                            setCentreText(String(clamped));
                          } else if (actualGateCentre !== undefined) setCentreText(String(actualGateCentre));
                        }}
                        className="h-8 w-full rounded-md border border-input bg-background pr-9 text-center text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        data-testid={`gate-${span.spanId}-centre-from-left`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                    </div>
                    <span className="text-xs text-muted-foreground">from the left end</span>
                    <InfoTooltip content="The distance from the left end of this section to the centre line of the gate. Move Left/Right shifts it 50mm at a time; type a measurement to place it exactly." />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Position:</span>
                    <span className="font-mono font-medium" data-testid={`span-${span.spanId}-gate-position-label`}>
                      {gateIndex >= 0 ? `Panel ${gateIndex + 1}` : `Panel ${gatePosition + 1}`}
                    </span>
                    {actualGateCentre !== undefined && <span className="text-xs text-muted-foreground">· centre ≈ {actualGateCentre}mm from the left</span>}
                    <span className="text-xs text-muted-foreground">· hinges {span.gateConfig?.flipped ? "right" : "left"}</span>
                  </div>
                )}
              </div>

              {/* Gate hardware — finish-asymmetric: B/MN = 1 bundled kit, White = 2 SKUs. */}
              <HardwareCardGrid testId={`span-${span.spanId}-gate-hardware`}>
                <HardwareCard imageSku={`SS-FTG-0975-${fin.code}`} title="Flat Top Gate 975mm" chip="× 1" blurb={`Welded frame · ${fin.label}`} testId={`span-${span.spanId}-gate-card`} />
                {isWhite ? (
                  <>
                    <HardwareCard imageSku="ML-TL-W" title="D&D Magna-Latch (White)" chip="× 1" blurb="Top pull lockable latch" testId={`span-${span.spanId}-gate-latch-card`} />
                    <HardwareCard imageSku="TC-H-AT-2L-W" title="D&D TruClose Hinges (White)" chip="1 pair" blurb="Self-closing hinge set" testId={`span-${span.spanId}-gate-hinge-card`} />
                  </>
                ) : (
                  <HardwareCard imageSku="ML-TL-TC-H-AT" title="D&D Hinge & Latch Kit" chip="1 kit" blurb="Magna-Latch + 2 TruClose hinges" testId={`span-${span.spanId}-gate-hardware-card`} />
                )}
              </HardwareCardGrid>
              <div className="flex items-center gap-1.5" data-testid={`span-${span.spanId}-gate-info`}>
                <p className="text-[11px] text-muted-foreground">
                  {isWhite ? "D&D latch + hinge pair (2 items — no bundled kit in White)" : "D&D hinge & latch kit (1 kit)"}
                  {" · self-closing · latch ≥1500mm · swings away from the pool"}
                </p>
                <InfoTooltip content="Pool compliant D&D gate hardware, rated to 30kg self-close. Hang the gate so it swings away from the pool with the latch at least 1500mm above the ground. Avoid hanging the gate off a corner post unless it's well supported." />
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
