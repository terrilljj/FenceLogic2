import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ChevronLeft, ChevronRight, CircleDot, FlipHorizontal, Layers, Pencil, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SpanConfig } from "@shared/schema";
import { panelCutPlans } from "@/lib/cut-plan";
import { InfoTooltip } from "../info-tooltip";
import { HardwareCard, HardwareCardGrid, IconOptionPicker, LayoutModeThumb } from "./hardware-card";

interface AluPoolBarrConfigProps {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  /** All sections in design order — for cross-section panel offcut reuse + corner count. */
  allSpans?: SpanConfig[];
}

// BARR Pool Fence (SF-4 / PTS-019 / operator inputs spec 2026-05-25):
// premium pre-fabricated picket panels (25mm picket faces, 93mm gaps) on slimline
// 50×25mm posts. Two finishes (Satin Black / Pearl White) — the finish drives EVERY
// hardware SKU. AS 1926.1 compliant by design.
const STOCK_PANEL_W_MM = 2205;
const GATE_W_MM = 975;
// BARR post allowance is 25mm (slimline) — used by the layout solver + centre maths.
const POST_MM = 25;

type Finish = "satin-black" | "pearl-white";
const FINISH_META: Record<Finish, { code: "B" | "W"; label: string; swatch: string }> = {
  "satin-black": { code: "B", label: "Satin Black", swatch: "bg-zinc-900" },
  "pearl-white": { code: "W", label: "Pearl White", swatch: "bg-white ring-1 ring-inset ring-zinc-300" },
};

// Substrate → inline post / cover / fixings (operator inputs spec + PTS-019).
// BARR brackets are C-brackets + caps (BARR-specific — Blade uses FastFit, Tubular
// uses shrouds; operator ruling 2026-06-03: never shared).
type Substrate = "decking" | "concrete-slab" | "in-ground" | "core-drilled" | "side-mounted";
const SUBSTRATE_HARDWARE: Record<
  Substrate,
  {
    short: string;
    postSku: (code: string) => string;
    postTitle: string;
    coverSku?: (code: string) => string;
    coverTitle?: string;
    // Cross-range (50×50) corner/gate post + cover — finish-split families (SS-=Black, XP-=White).
    xPostSku: (code: string) => string;
    xPostTitle: string;
    xCoverSku?: (code: string) => string;
    xCoverTitle?: string;
    fixingSku?: string;
    fixingTitle?: string;
    fixingChip?: string;
    fixingTip: string;
    supplyNote?: string;
  }
> = {
  decking: {
    short: "Decking",
    postSku: (c) => `BR-1280-BP-${c}`,
    postTitle: "1280mm Base Plate Post",
    coverSku: (c) => `BR-DC-2P-${c}`,
    coverTitle: "Domical Cover",
    xPostSku: (c) => (c === "B" ? "SS-1300-BP-B" : "XP-1300-BP-W"),
    xPostTitle: "50×50 Base Plate Post",
    xCoverSku: (c) => `XP-DC-2P-${c}`,
    xCoverTitle: "50×50 Domical Cover",
    fixingSku: "CSK-100-4PK",
    fixingTitle: "CSK Screws",
    fixingChip: "1 pack / 4 posts",
    fixingTip:
      "M10×100mm countersunk batten screw 4-packs — 1 pack per 4 posts. Must fix into LVL or F17 structural hardwood — regular pine decking joists aren't rated for an aluminium pool fence.",
  },
  "concrete-slab": {
    short: "Concrete slab",
    postSku: (c) => `BR-1280-BP-${c}`,
    postTitle: "1280mm Base Plate Post",
    coverSku: (c) => `BR-DC-2P-${c}`,
    coverTitle: "Domical Cover",
    xPostSku: (c) => (c === "B" ? "SS-1300-BP-B" : "XP-1300-BP-W"),
    xPostTitle: "50×50 Base Plate Post",
    xCoverSku: (c) => `XP-DC-2P-${c}`,
    xCoverTitle: "50×50 Domical Cover",
    fixingTip: "M10×100mm screw bolts into 32 MPa concrete. Base plates are pre-drilled ready to bolt down.",
    supplyNote: "You supply: M10 concrete screw bolts",
  },
  "in-ground": {
    short: "In-ground",
    postSku: (c) => `BR-1800-${c}`,
    postTitle: "1800mm Post",
    xPostSku: (c) => (c === "B" ? "SS-1800-B" : "XP-1800-FP-W"),
    xPostTitle: "50×50 Post",
    fixingTip: "The extra post length sets into your post holes. You supply the concrete mix.",
    supplyNote: "You supply: concrete mix",
  },
  "core-drilled": {
    short: "Core-drilled",
    postSku: (c) => `BR-1800-${c}`,
    postTitle: "1800mm Post",
    coverSku: (c) => `BR-DR-${c}`,
    coverTitle: "Dress Ring",
    xPostSku: (c) => (c === "B" ? "SS-1800-B" : "XP-1800-FP-W"),
    xPostTitle: "50×50 Post",
    xCoverSku: (c) => `XP-DR-${c}`,
    xCoverTitle: "50×50 Dress Ring",
    fixingSku: "GROUT-SETFAST-10KG",
    fixingTitle: "Grout 10kg",
    fixingChip: "1 / 15 posts",
    fixingTip: "Pourable grout — 76mm core holes, 100mm deep. 1 × 10kg bag per 15 posts plus a spare.",
  },
  // Side-mount uses the shared AIRE face-mount posts (operator 2026-06-04: the AR-series
  // posts are the only side-mount option). Fixing material defaults to concrete until the
  // timber/concrete/steel picker lands.
  "side-mounted": {
    short: "Side-mounted",
    postSku: (c) => `AR-1500-FMID-${c}`,
    postTitle: "AIRE 1500mm Face-Mount Post",
    coverSku: (c) => (c === "W" ? "GS-DN-4PK" : "GS-DN-4PK-B"),
    coverTitle: "M12 Dome Nut 4-pack",
    xPostSku: (c) => `AR-1500-FMLR-${c}-2PK`,
    xPostTitle: "AIRE Face-Mount L+R End 2-pack",
    fixingTitle: "M12 post fixings",
    fixingTip: "Match the Fixing surface you pick above: timber → M12×160 LAG screws, concrete → M12 rod + chemical anchor, steel → you supply M12. Dome nuts for the visible face are always included.",
    supplyNote: "Fixings per your selected surface",
  },
};

const TIP = {
  layoutMode:
    "Evenly spaced cuts every panel to the same width for a uniform rhythm. Full panels + infill keeps as many factory panels as possible and cuts one infill panel — fewer cuts, but one narrower bay.",
  finish: "Satin Black or Pearl White — your pick flows through to every post, bracket, cover and the gate hardware automatically.",
  substrate:
    "What the posts fix to. Decking and concrete slab use base-plated posts; in-ground and core-drilled use longer posts set into the ground or core holes.",
  posts:
    "Posts, covers and brackets are included automatically to match your finish, substrate and layout — nothing to choose.",
  crossRange:
    "BARR's slimline posts have a 25mm face — too narrow for the 32mm C-brackets and gate hardware at corners and gates. So corners and gates use a 50×50 post from our Six Star (Black) or Xpress (White) range, with matching 50×50 covers.",
  gate: "Adds a 975mm self-closing gate. Black ships the D&D hinge & latch as one bundled kit; Pearl White ships them as two separate D&D items (latch + hinge pair).",
  gatePosition:
    "Where the gate sits along this section. Standard lets the calculator place it; Set position pins the gate's centre line to a measurement from the left end.",
  cuts: "Cut panels are cut down from full 2205mm stock panels — cuts land in the 93mm gaps between pickets, never through a 25mm picket face. Offcuts big enough to cover another bay are reused automatically across your sections.",
  panel:
    "2205mm × 1200mm pre-fabricated panel — 25mm picket faces at 93mm gaps, welded to the rails. Pool compliant (AS 1926.1) by design.",
  corners:
    "Where two sections meet at a corner, the corner post is a 50×50 cross-range post (BARR's slimline post can't take brackets on both faces).",
};

/** Numbered accordion header with live summary + edit affordance (glass pattern). */
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
 * BARR Pool Fence configure block — Oxworks accordion (Configure / Posts &
 * Substrate / Gate) on the Blade visual template (hardware cards, icon pickers,
 * layout diagrams), plus BARR's extras: finish picker (B/W drives every SKU),
 * cross-range 50×50 corner/gate posts, paired C-bracket + cap, and
 * finish-asymmetric gate hardware (Black = 1 kit, White = 2 SKUs).
 */
export function AluPoolBarrConfig({ span, updateSpan, allSpans }: AluPoolBarrConfigProps) {
  const designSpans = allSpans?.length ? allSpans : [span];

  const layoutMode = span.barrLayoutMode || "equally-spaced";
  const finish = (span.barrFinish || "satin-black") as Finish;
  const fin = FINISH_META[finish];
  const substrate = ((span.fieldValues?.["barr-substrate"] as string) || "decking") as Substrate;
  const hw = SUBSTRATE_HARDWARE[substrate];
  const gateOn = !!span.gateConfig?.required;

  // Pool BARR is 1200mm height only + Mode A default (operator inputs spec).
  useEffect(() => {
    const updates: Partial<SpanConfig> = {};
    if (span.barrHeight !== "1200mm") updates.barrHeight = "1200mm";
    if (!span.barrLayoutMode) updates.barrLayoutMode = "equally-spaced";
    if (!span.barrFinish) updates.barrFinish = "satin-black";
    if (!span.fieldValues?.["barr-substrate"]) {
      updates.fieldValues = { ...span.fieldValues, "barr-substrate": "decking" };
    }
    if (Object.keys(updates).length) updateSpan(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId]);

  // ── Layout-derived counts ────────────────────────────────────────────────────────
  const layoutPanels = span.panelLayout?.panels ?? [];
  const layoutTypes = span.panelLayout?.panelTypes ?? layoutPanels.map(() => "standard");
  const barrPanelWidths = layoutPanels.filter((_, i) => layoutTypes[i] !== "gate");
  const gateIndex = layoutTypes.indexOf("gate");
  // Inline posts: bays + 1, MINUS the cross-range posts (gate posts are cross-range).
  const totalPosts = layoutPanels.length ? layoutPanels.length + 1 : 0;
  const gatePostCount = gateOn ? 2 : 0;
  const inlinePostCount = Math.max(0, totalPosts - gatePostCount);
  // Corners belong to the DESIGN (where sections meet): N sections → N-1 corners.
  const cornerCount = Math.max(0, designSpans.length - 1);
  const isFirstSpan = designSpans[0]?.spanId === span.spanId;

  // ── Panel cut plan with cross-section offcut reuse (gates are their own SKU). ───
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
    STOCK_PANEL_W_MM,
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

  // ── Gate position — DUAL MODE (parity with the glass + Blade gates) ─────────────
  const CENTRE_STEP = 50;
  const maxGatePosition = barrPanelWidths.length;
  const gatePosition = span.gateConfig?.position ?? 0;
  const definedMode = span.gateConfig?.centreFromLeft != null;
  const minCentre = Math.ceil(POST_MM + GATE_W_MM / 2);
  const maxCentre = Math.floor(span.length - POST_MM - GATE_W_MM / 2);
  const clampCentre = (n: number) => Math.max(minCentre, Math.min(maxCentre, n));
  const actualGateCentre = (() => {
    if (gateIndex < 0 || !span.panelLayout) return undefined;
    const gaps = span.panelLayout.gaps ?? [];
    let x = 0;
    for (let i = 0; i < gateIndex; i++) {
      x += (gaps[i] ?? 0) + layoutPanels[i];
    }
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
      if (next !== gatePosition) {
        updateSpan({ gateConfig: { ...span.gateConfig, position: next } });
      }
    }
  };
  const gatePositionLabel =
    gateIndex < 0
      ? ""
      : gateIndex === 0
        ? "left end"
        : gateIndex >= layoutPanels.length - 1
          ? "right end"
          : `bay ${gateIndex + 1} of ${layoutPanels.length}`;

  const enableGate = () =>
    updateSpan({
      gateConfig: {
        required: true,
        // NOTE: hardware/hinge enums are glass-gate schema fields (required by the
        // schema). BARR's REAL hardware is finish-asymmetric D&D (Black = bundled kit,
        // White = latch + hinge pair) — the BOM phase maps it from productVariant +
        // barrFinish, not this enum.
        hardware: "polaris",
        hingeFrom: "glass",
        latchTo: "glass",
        hingeType: "glass-to-glass",
        latchType: "glass-to-glass",
        gateSize: GATE_W_MM,
        hingePanelSize: STOCK_PANEL_W_MM,
        autoHingePanel: false,
        position: 0,
        flipped: false,
        hingeGap: 20,
        latchGap: 20,
        postAdapterPlate: false,
      },
    });
  const disableGate = () => updateSpan({ gateConfig: undefined });

  // ── Section summaries ────────────────────────────────────────────────────────────
  const configureSummary = span.panelLayout
    ? `${fin.label} · ${layoutMode === "equally-spaced" ? "Evenly spaced" : "Full + infill"} · ${totalPanels} panel${totalPanels === 1 ? "" : "s"}`
    : `${fin.label} · ${layoutMode === "equally-spaced" ? "Evenly spaced" : "Full + infill"}`;
  const postsSummary = span.panelLayout
    ? `${hw.short} · ${inlinePostCount} × ${hw.postTitle}${cornerCount > 0 ? ` · ${cornerCount} corner post${cornerCount > 1 ? "s" : ""}` : ""}`
    : `${hw.short} · ${hw.postTitle}`;
  const gateSummary = gateOn
    ? `975mm gate${gatePositionLabel ? ` · ${gatePositionLabel}` : ""} · ${fin.code === "B" ? "D&D kit" : "D&D latch + hinges"}`
    : "None — open to add a gate";

  return (
    <Accordion
      type="multiple"
      defaultValue={["configure", "posts", "gate"]}
      className="rounded-md border border-card-border"
    >
      {/* 1. Configure — finish swatches + layout mode cards + panel cut plan. */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger
          className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
          data-testid={`span-${span.spanId}-accordion-configure`}
        >
          <SectionHeader n={1} title="Configure" summary={configureSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {/* Finish — drives EVERY hardware SKU (B/W). */}
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
                    onClick={() => updateSpan({ barrFinish: f })}
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

          {/* Layout mode — visual cards with mini panel diagrams. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Panel Layout</Label>
              <InfoTooltip content={TIP.layoutMode} />
            </div>
            <div className="grid grid-cols-2 gap-2" data-testid={`span-${span.spanId}-barr-layout-mode`}>
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
                    onClick={() => updateSpan({ barrLayoutMode: m.value })}
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

          {/* Panel + cut plan — compact card: the panel product + the cut numbers. */}
          <div className="grid grid-cols-[96px_1fr] gap-2.5 rounded-md border border-card-border p-2.5" data-testid={`span-${span.spanId}-panel-cut-plan`}>
            <HardwareCard
              imageSku={`BR-PANEL-2205-1200-${fin.code}`}
              title="BARR Panel"
              chip={span.panelLayout ? `× ${stockPanelsNeeded}` : undefined}
              testId={`span-${span.spanId}-panel-card`}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold">Panels &amp; cuts</p>
                <InfoTooltip content={`${TIP.panel} ${TIP.cuts}`} />
              </div>
              {span.panelLayout ? (
                <ul className="space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  <li>
                    {stockPanelsNeeded} × 2205mm stock
                    {cutPlan.fullPanels > 0 ? ` · ${cutPlan.fullPanels} full` : ""}
                    {cutPlan.cutPanels > 0 ? ` · ${cutPlan.cutPanels} cut → ${cutPlan.cutWidths.map((w) => Math.round(w)).join(", ")}mm` : ""}
                  </li>
                  {cutPlan.claimed.length > 0 && (
                    <li className="font-medium text-primary">
                      {cutPlan.claimed.length} cut from offcuts — saved {cutPlan.claimed.length} panel
                      {cutPlan.claimed.length > 1 ? "s" : ""}
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

      {/* 2. Posts & Substrate — icon picker + inline post cards + cross-range corner cards. */}
      <AccordionItem value="posts" className="border-b border-card-border px-3">
        <AccordionTrigger
          className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
          data-testid={`span-${span.spanId}-accordion-posts`}
        >
          <SectionHeader n={2} title="Posts & Substrate" summary={postsSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {/* Substrate — icon cards. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Substrate</Label>
              <InfoTooltip content={TIP.substrate} />
            </div>
            <IconOptionPicker
              spanId={span.spanId}
              idPrefix="barr-substrate"
              value={substrate}
              onSelect={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "barr-substrate": v } })}
              options={[
                { value: "decking", label: "Decking", blurb: "Timber deck", icon: <Layers className="h-6 w-6" /> },
                { value: "concrete-slab", label: "Concrete Slab", blurb: "Bolt-down", icon: <Square className="h-6 w-6" /> },
                { value: "in-ground", label: "In-ground", blurb: "Post holes", icon: <ArrowDownToLine className="h-6 w-6" /> },
                { value: "core-drilled", label: "Core-drilled", blurb: "Into concrete", icon: <CircleDot className="h-6 w-6" /> },
                { value: "side-mounted", label: "Side-mounted", blurb: "AIRE face-mount", icon: <FlipHorizontal className="h-6 w-6" /> },
              ]}
            />
          </div>

          {/* Fixing surface — side-mount only; drives the AIRE post fixings. */}
          {substrate === "side-mounted" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Fixing surface</Label>
                <InfoTooltip content="The face the AIRE side-mount posts bolt to. Timber takes M12 LAG screws; concrete takes M12 threaded rod + chemical anchor; steel is customer-supplied M12. Dome nuts are included either way." />
              </div>
              <IconOptionPicker
                spanId={span.spanId}
                idPrefix="barr-material"
                value={(span.fieldValues?.["barr-material"] as string) || "concrete"}
                onSelect={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "barr-material": v } })}
                columns={3}
                options={[
                  { value: "timber", label: "Timber", blurb: "M12 LAG screws", icon: <Layers className="h-5 w-5" /> },
                  { value: "concrete", label: "Concrete", blurb: "Rod + chem anchor", icon: <CircleDot className="h-5 w-5" /> },
                  { value: "steel", label: "Steel", blurb: "You supply M12", icon: <AlertTriangle className="h-5 w-5" /> },
                ]}
              />
            </div>
          )}

          {/* Inline hardware — product cards (finish-matched SKUs). */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Included for this section</Label>
              <InfoTooltip content={TIP.posts} />
            </div>
            <HardwareCardGrid testId={`span-${span.spanId}-included-hardware`}>
              <HardwareCard
                imageSku={hw.postSku(fin.code)}
                title={hw.postTitle}
                chip={span.panelLayout ? `× ${inlinePostCount}` : undefined}
                blurb="50×25mm slimline · cap included"
                testId={`span-${span.spanId}-post-card`}
              />
              {hw.coverSku && (
                <HardwareCard
                  imageSku={hw.coverSku(fin.code)}
                  title={hw.coverTitle!}
                  chip={span.panelLayout ? `× ${inlinePostCount}` : "1 / post"}
                  blurb="Finishes the post base"
                  testId={`span-${span.spanId}-cover-card`}
                />
              )}
              <HardwareCard
                imageSku={`BR-BR25-${fin.code}-4PK`}
                title="C-Bracket Kit"
                chip={span.panelLayout ? `× ${barrPanelWidths.length}` : "1 / panel"}
                blurb="4 brackets + screws"
                testId={`span-${span.spanId}-bracket-card`}
              />
              <HardwareCard
                imageSku={`BR-BRCAP-${fin.code}-4PK`}
                title="Bracket Caps"
                chip={span.panelLayout ? `× ${barrPanelWidths.length}` : "1 / panel"}
                blurb="Covers the bracket joins"
                testId={`span-${span.spanId}-bracket-cap-card`}
              />
              {hw.fixingSku && (
                <HardwareCard
                  imageSku={hw.fixingSku}
                  title={hw.fixingTitle!}
                  chip={hw.fixingChip}
                  blurb="Included to match"
                  testId={`span-${span.spanId}-fixing-card`}
                />
              )}
            </HardwareCardGrid>
            <div className="flex items-center gap-1.5" data-testid={`span-${span.spanId}-fixings-info`}>
              <p className="text-[11px] text-muted-foreground">
                {hw.supplyNote ?? `${hw.fixingTitle} included`}
              </p>
              <InfoTooltip content={hw.fixingTip} />
            </div>
          </div>

          {/* Cross-range corner posts — design-level (where sections meet). Shown on the
              first section only, so they aren't double-counted across sections. */}
          {cornerCount > 0 && isFirstSpan && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">
                  Corner posts — {cornerCount} corner{cornerCount > 1 ? "s" : ""} in your design
                </Label>
                <InfoTooltip content={TIP.crossRange} />
              </div>
              <HardwareCardGrid testId={`span-${span.spanId}-corner-hardware`}>
                <HardwareCard
                  imageSku={hw.xPostSku(fin.code)}
                  title={hw.xPostTitle}
                  chip={`× ${cornerCount}`}
                  blurb="Cross-range — takes brackets on both faces"
                  testId={`span-${span.spanId}-corner-post-card`}
                />
                {hw.xCoverSku && (
                  <HardwareCard
                    imageSku={hw.xCoverSku(fin.code)}
                    title={hw.xCoverTitle!}
                    chip={`× ${cornerCount}`}
                    blurb="Sized for the 50×50 post"
                    testId={`span-${span.spanId}-corner-cover-card`}
                  />
                )}
              </HardwareCardGrid>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* 3. Gate — toggle + cross-range gate posts + finish-asymmetric hardware + dual-mode position. */}
      <AccordionItem value="gate" className="px-3">
        <AccordionTrigger
          className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden"
          data-testid={`span-${span.spanId}-accordion-gate`}
        >
          <SectionHeader n={3} title="Gate" summary={gateSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Add a Gate</Label>
              <InfoTooltip content={TIP.gate} />
            </div>
            <Switch
              checked={gateOn}
              onCheckedChange={(on) => (on ? enableGate() : disableGate())}
              data-testid={`span-${span.spanId}-barr-gate-toggle`}
            />
          </div>

          {gateOn && (
            <div className="space-y-3">
              {/* Gate position — dual-mode controls (parity with the glass + Blade gates). */}
              <div className="space-y-2 pb-3 border-b border-border" data-testid={`span-${span.spanId}-gate-position`}>
                <div className="flex items-center gap-1">
                  <Label className="text-sm font-medium">Gate Position</Label>
                  <InfoTooltip content={TIP.gatePosition} />
                </div>

                <div className="flex w-fit overflow-hidden rounded-md border border-input">
                  <button
                    type="button"
                    onClick={() =>
                      span.gateConfig && updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: undefined } })
                    }
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      !definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate",
                    )}
                    data-testid={`gate-${span.spanId}-mode-standard`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      span.gateConfig &&
                      updateSpan({
                        gateConfig: { ...span.gateConfig, centreFromLeft: clampCentre(actualGateCentre ?? minCentre) },
                      })
                    }
                    className={cn(
                      "border-l border-input px-3 py-1.5 text-xs font-medium transition-colors",
                      definedMode ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate",
                    )}
                    data-testid={`gate-${span.spanId}-mode-defined`}
                  >
                    Set position
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="default"
                    className="font-semibold"
                    onClick={() => moveGate(-1)}
                    disabled={
                      definedMode
                        ? (span.gateConfig?.centreFromLeft ?? minCentre) - CENTRE_STEP < minCentre
                        : gatePosition <= 0
                    }
                    data-testid={`gate-${span.spanId}-move-left`}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1.5" />
                    Move Left
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="font-semibold"
                    onClick={() =>
                      span.gateConfig &&
                      updateSpan({ gateConfig: { ...span.gateConfig, flipped: !span.gateConfig.flipped } })
                    }
                    data-testid={`gate-${span.spanId}-flip`}
                  >
                    <FlipHorizontal className="w-4 h-4 mr-1.5" />
                    Flip
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="font-semibold"
                    onClick={() => moveGate(1)}
                    disabled={
                      definedMode
                        ? (span.gateConfig?.centreFromLeft ?? maxCentre) + CENTRE_STEP > maxCentre
                        : gatePosition >= maxGatePosition
                    }
                    data-testid={`gate-${span.spanId}-move-right`}
                  >
                    <ChevronRight className="w-4 h-4 mr-1.5" />
                    Move Right
                  </Button>
                </div>

                {definedMode ? (
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
                          if (!Number.isNaN(n) && span.gateConfig) {
                            updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clampCentre(n) } });
                          }
                        }}
                        onBlur={() => {
                          setCentreFocused(false);
                          const n = parseInt(centreText, 10);
                          if (!Number.isNaN(n) && span.gateConfig) {
                            const clamped = clampCentre(n);
                            updateSpan({ gateConfig: { ...span.gateConfig, centreFromLeft: clamped } });
                            setCentreText(String(clamped));
                          } else if (actualGateCentre !== undefined) {
                            setCentreText(String(actualGateCentre));
                          }
                        }}
                        className="h-8 w-full rounded-md border border-input bg-background pr-9 text-center text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        data-testid={`gate-${span.spanId}-centre-from-left`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        mm
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">from the left end</span>
                    <InfoTooltip content="The distance from the left end of this section to the centre line of the gate. Move Left/Right shifts it 50mm at a time; type a measurement to place it exactly. The panels each side re-solve automatically." />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Position:</span>
                    <span className="font-mono font-medium" data-testid={`span-${span.spanId}-gate-position-label`}>
                      {gateIndex >= 0 ? `Panel ${gateIndex + 1}` : `Panel ${gatePosition + 1}`}
                    </span>
                    {actualGateCentre !== undefined && (
                      <span className="text-xs text-muted-foreground">· centre ≈ {actualGateCentre}mm from the left</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · hinges {span.gateConfig?.flipped ? "right" : "left"}
                    </span>
                  </div>
                )}
              </div>

              {/* Gate hardware — finish-asymmetric: Black = 1 bundled kit, White = 2 SKUs.
                  Gate posts are cross-range 50×50 (same reason as corners). */}
              <HardwareCardGrid testId={`span-${span.spanId}-gate-hardware`}>
                <HardwareCard
                  imageSku={`BR-GATE-0975-1200-${fin.code}`}
                  title="BARR Gate 975mm"
                  chip="× 1"
                  blurb={`Welded frame · ${fin.label}`}
                  testId={`span-${span.spanId}-gate-card`}
                />
                {fin.code === "B" ? (
                  <HardwareCard
                    imageSku="ML-TL-TC-H-AT"
                    title="D&D Hinge & Latch Kit"
                    chip="1 kit"
                    blurb="Magna-Latch + 2 TruClose hinges"
                    testId={`span-${span.spanId}-gate-hardware-card`}
                  />
                ) : (
                  <>
                    <HardwareCard
                      imageSku="ML-TL-W"
                      title="D&D Magna-Latch (White)"
                      chip="× 1"
                      blurb="Top pull lockable latch"
                      testId={`span-${span.spanId}-gate-latch-card`}
                    />
                    <HardwareCard
                      imageSku="TC-H-AT-2L-W"
                      title="D&D TruClose Hinges (White)"
                      chip="1 pair"
                      blurb="Self-closing hinge set"
                      testId={`span-${span.spanId}-gate-hinge-card`}
                    />
                  </>
                )}
                <HardwareCard
                  imageSku={hw.xPostSku(fin.code)}
                  title={`${hw.xPostTitle} (gate)`}
                  chip="× 2"
                  blurb="Hinge + latch side posts"
                  testId={`span-${span.spanId}-gate-post-card`}
                />
                {hw.xCoverSku && (
                  <HardwareCard
                    imageSku={hw.xCoverSku(fin.code)}
                    title={hw.xCoverTitle!}
                    chip="× 2"
                    blurb="Sized for the 50×50 post"
                    testId={`span-${span.spanId}-gate-post-cover-card`}
                  />
                )}
              </HardwareCardGrid>
              <div className="flex items-center gap-1.5" data-testid={`span-${span.spanId}-gate-info`}>
                <p className="text-[11px] text-muted-foreground">
                  {fin.code === "B"
                    ? "D&D hinge & latch kit (1 kit)"
                    : "D&D latch + hinge pair (2 items — no bundled kit in White)"}
                  {" · self-closing · latch ≥1500mm · swings away from the pool"}
                </p>
                <InfoTooltip content="Pool compliant gate hardware, rated to 30kg self-close. The gate hangs off two 50×50 cross-range posts (BARR's slimline posts can't take the hinge hardware). Hang the gate so it swings away from the pool with the latch at least 1500mm above the ground." />
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
