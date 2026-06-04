import { useEffect } from "react";
import { AlertTriangle, ArrowDownToLine, CircleDot, Minus, PanelTop, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SpanConfig } from "@shared/schema";
import { panelCutPlans } from "@/lib/cut-plan";
import { InfoTooltip } from "../info-tooltip";
import { HardwareCard, HardwareCardGrid, IconOptionPicker } from "./hardware-card";

interface AluBalConfigProps {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  allSpans?: SpanConfig[];
  /** "barr" (2 finishes, 1733 panel, C-bracket + cap) or "blade" (Black-only, 1700, FastFit no cap). */
  style: "barr" | "blade";
}

// Aluminium Balustrade (SF-12 BARR / SF-13 Blade). Shared AIRE post family + XP covers
// + 3D fixings engine; only panels + brackets + finish availability differ. No gates,
// no in-ground. BARR caps panel width at the fall-height c-to-c ceiling; Blade doesn't.
type Substrate = "core-drilled" | "base-plated" | "face-mounted";
type Material = "timber" | "concrete" | "steel";

const STYLE_META = {
  barr: {
    label: "BARR Balustrade",
    stockWidth: 1733,
    panelTitle: "BARR Panel",
    panelSku: (code: string) => `BR-PANEL-1733-1000-${code}`,
    bracketSku: (code: string) => `BR-BR60-${code}-4PK`,
    bracketTitle: "Extended C-Bracket Kit",
    hasCap: true,
    hasFinish: true,
  },
  blade: {
    label: "Blade Balustrade",
    stockWidth: 1700,
    panelTitle: "Blade Panel",
    panelSku: () => `BLA-PNL-1700-1000-B`,
    bracketSku: () => `FF-BH-OPEN-4PK-B`,
    bracketTitle: "FastFit Open Bracket",
    hasCap: false,
    hasFinish: false,
  },
} as const;

// Substrate → AIRE post + XP cover + fixings (per material).
const SUBSTRATE_META: Record<
  Substrate,
  {
    short: string;
    postSku: (code: string) => string;
    postTitle: string;
    coverSku?: (code: string) => string;
    coverTitle?: string;
    topPlate?: boolean; // core-drill ships a standalone top plate
    needsMaterial: boolean;
  }
> = {
  "core-drilled": {
    short: "Core-drilled",
    postSku: (c) => `AR-5800-FP-${c}`,
    postTitle: "AIRE 5800mm Post (cut to length)",
    coverSku: (c) => `XP-DR-${c}`,
    coverTitle: "Dress Ring",
    topPlate: true,
    needsMaterial: false, // chemical bond uniform across materials
  },
  "base-plated": {
    short: "Base-plated",
    postSku: (c) => `AR-1050-FPBP-${c}`,
    postTitle: "AIRE 1050mm Base Plate Post",
    coverSku: (c) => `XP-DC-2P-${c}`,
    coverTitle: "Domical Cover",
    needsMaterial: true,
  },
  "face-mounted": {
    short: "Face-mounted",
    postSku: (c) => `AR-1500-FMID-${c}`,
    postTitle: "AIRE 1500mm Face-Mount Post",
    needsMaterial: true,
  },
};

const FIXING_INFO: Record<string, { sku: string; title: string; chip?: string; tip: string; supply?: string }> = {
  "core-drilled": { sku: "GROUT-SETFAST-10KG", title: "Grout 10kg", chip: "1 / 15 posts", tip: "Pourable grout — posts set 100mm into the concrete and grouted. 1 × 10kg bag per 15 posts plus a spare." },
  "base-plated.timber": { sku: "S-110LAG-4PK", title: "M10 LAG Screws", chip: "1 pack / post", tip: "M10 LAG screw 4-packs, 4 per post, into structural timber." },
  "base-plated.concrete": { sku: "S-120ROD-4PK", title: "M10 Rods + Anchor", chip: "1 pack / post", tip: "M10 threaded rod 4-packs (4 per post) set in chemical anchor (1 tube per 20 posts)." },
  "base-plated.steel": { sku: "", title: "", tip: "Steel is substrate-thickness-dependent — you supply your own M10 bolt, nut and washer.", supply: "You supply: M10 bolt + nut + washer" },
  "face-mounted.timber": { sku: "GS160LAG", title: "M12 LAG Screws + Dome Nuts", chip: "4 / post", tip: "M12×160mm LAG screws, 4 per post, plus a dome-nut pack per post for the visible face." },
  "face-mounted.concrete": { sku: "GS150ROD", title: "M12 Rods + Anchor + Dome Nuts", chip: "4 / post", tip: "M12×150mm threaded rods (4 per post) + chemical anchor (1 tube per 15 posts) + a dome-nut pack per post." },
  "face-mounted.steel": { sku: "", title: "", tip: "Steel is substrate-thickness-dependent — you supply M12 bolts; dome nuts for the visible face are still included.", supply: "You supply: M12 bolt + nut + washer" },
};

const TIP = {
  finish: "Satin Black or Pearl White — the finish flows through to every post, bracket and cover.",
  fall: "How far someone could fall over the balustrade. Under 1m has no barrier-load case. 1m–5m is the standard balustrade case. Over 5m needs separate engineering — we'll quote it manually.",
  substrate: "What the posts fix to. Core-drilled sets into concrete; base-plated bolts onto a slab or deck; face-mounted bolts to a vertical edge. No in-ground for balustrade.",
  material: "What's behind the fixing surface — it sets the fixing type. Steel is customer-supplied (thickness-dependent).",
  corners: "How many corners your run turns. Face-mounted corners use two posts back-to-back (they can only fix to one face); core-drilled and base-plated share a single corner post.",
  posts: "Posts, covers and fixings are included automatically to match your substrate — the AIRE 50×50 posts are our universal HD balustrade range.",
  cuts: "Cut panels are cut down from a full stock panel — cut between pickets, never through one. Offcuts big enough to cover another bay are reused automatically across your sections.",
};

function SectionHeader({ n, title, summary }: { n: number; title: string; summary?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 pr-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{n}</span>
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

export function AluBalConfig({ span, updateSpan, allSpans, style }: AluBalConfigProps) {
  const designSpans = allSpans?.length ? allSpans : [span];
  const meta = STYLE_META[style];

  const finishCode: "B" | "W" =
    style === "barr" ? (span.balBarrFinish === "white" ? "W" : "B") : "B";
  const finishName = finishCode === "W" ? "Pearl White" : style === "barr" ? "Satin Black" : "Black";
  const substrate = ((span.fieldValues?.["bal-substrate"] as string) || "base-plated") as Substrate;
  const subMeta = SUBSTRATE_META[substrate];
  const material = ((span.fieldValues?.["bal-material"] as string) || "timber") as Material;
  const fallHeight = (span.fieldValues?.["bal-fall-height"] as string) || "1m-5m";
  const over5m = fallHeight === "over-5m";
  const corners = parseInt(String(span.fieldValues?.["bal-corners"] ?? "0"), 10) || 0;

  // Defaults — height 1000mm, base-plated, 1m-5m fall.
  useEffect(() => {
    const fv: Record<string, any> = { ...span.fieldValues };
    let changed = false;
    if (!span.fieldValues?.["bal-substrate"]) { fv["bal-substrate"] = "base-plated"; changed = true; }
    if (!span.fieldValues?.["bal-fall-height"]) { fv["bal-fall-height"] = "1m-5m"; changed = true; }
    const updates: Partial<SpanConfig> = {};
    if (changed) updates.fieldValues = fv;
    if (style === "barr" && span.balBarrPanelHeight !== "1000mm") updates.balBarrPanelHeight = "1000mm";
    if (style === "barr" && !span.balBarrFinish) updates.balBarrFinish = "black";
    if (Object.keys(updates).length) updateSpan(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId]);

  // ── Counts (this section; the Review BOM aggregates the design-level totals). ────
  const layoutPanels = span.panelLayout?.panels ?? [];
  const sectionPanels = layoutPanels.length;
  const sectionPosts = sectionPanels ? sectionPanels + 1 : 0;

  // Panel cut plan with cross-section offcut reuse.
  const cutPlans = panelCutPlans(
    designSpans.map((s) => ({
      id: s.spanId,
      label: s.name?.trim() || `Section ${s.spanId}`,
      panelWidthsMm: s.panelLayout?.panels ?? [],
    })),
    meta.stockWidth,
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

  const fix = FIXING_INFO[subMeta.needsMaterial ? `${substrate}.${material}` : substrate];

  const setFV = (key: string, value: string) => updateSpan({ fieldValues: { ...span.fieldValues, [key]: value } });

  const configureSummary = span.panelLayout
    ? `${meta.hasFinish ? finishName + " · " : ""}${fallHeight === "under-1m" ? "<1m" : fallHeight === "over-5m" ? ">5m" : "1–5m"} fall · ${totalPanels} panel${totalPanels === 1 ? "" : "s"}`
    : `${meta.hasFinish ? finishName + " · " : ""}${fallHeight === "under-1m" ? "<1m" : fallHeight === "over-5m" ? ">5m" : "1–5m"} fall`;
  const postsSummary = span.panelLayout
    ? `${subMeta.short}${subMeta.needsMaterial ? " · " + material : ""}${corners > 0 ? ` · ${corners} corner${corners > 1 ? "s" : ""}` : ""}`
    : subMeta.short;

  return (
    <Accordion type="multiple" defaultValue={["configure", "posts"]} className="rounded-md border border-card-border">
      {/* 1. Configure — finish (BARR) + fall-height band + panel cut plan. */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline [&[data-state=open]_.acc-summary]:hidden" data-testid={`span-${span.spanId}-accordion-configure`}>
          <SectionHeader n={1} title="Configure" summary={configureSummary} />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {meta.hasFinish ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Finish</Label>
                <InfoTooltip content={TIP.finish} />
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid={`span-${span.spanId}-finish-picker`}>
                {([
                  { v: "black", label: "Satin Black", swatch: "bg-zinc-900" },
                  { v: "white", label: "Pearl White", swatch: "bg-white ring-1 ring-inset ring-zinc-300" },
                ] as const).map((f) => {
                  const active = (span.balBarrFinish || "black") === f.v;
                  return (
                    <button
                      key={f.v}
                      type="button"
                      onClick={() => updateSpan({ balBarrFinish: f.v })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover-elevate active-elevate-2",
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border",
                      )}
                      data-testid={`span-${span.spanId}-finish-${f.v}`}
                    >
                      <span className={cn("h-3.5 w-3.5 rounded-full", f.swatch)} />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground" data-testid={`span-${span.spanId}-finish-info`}>
              Blade balustrade is Satin Black only.
            </p>
          )}

          {/* Fall-height band. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Fall Height</Label>
              <InfoTooltip content={TIP.fall} />
            </div>
            <IconOptionPicker
              spanId={span.spanId}
              idPrefix="bal-fall"
              value={fallHeight}
              onSelect={(v) => setFV("bal-fall-height", v)}
              columns={3}
              options={[
                { value: "under-1m", label: "Under 1m", blurb: "No barrier case", icon: <ArrowDownToLine className="h-5 w-5" /> },
                { value: "1m-5m", label: "1m – 5m", blurb: "Standard", icon: <PanelTop className="h-5 w-5" /> },
                { value: "over-5m", label: "Over 5m", blurb: "Manual quote", icon: <AlertTriangle className="h-5 w-5" /> },
              ]}
            />
          </div>

          {over5m ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30" data-testid={`span-${span.spanId}-over5m-notice`}>
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Over 5m needs separate engineering</p>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                Balustrades above a 5m fall need a specific engineering sign-off. Email us at
                hello@barrierhub.com.au and we'll quote it manually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[96px_1fr] gap-2.5 rounded-md border border-card-border p-2.5" data-testid={`span-${span.spanId}-panel-cut-plan`}>
              <HardwareCard imageSku={meta.panelSku(finishCode)} title={meta.panelTitle} chip={span.panelLayout ? `× ${stockPanelsNeeded}` : undefined} testId={`span-${span.spanId}-panel-card`} />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-semibold">Panels &amp; cuts</p>
                  <InfoTooltip content={TIP.cuts} />
                </div>
                {span.panelLayout ? (
                  <ul className="space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    <li>
                      {stockPanelsNeeded} × {meta.stockWidth}mm stock
                      {cutPlan.fullPanels > 0 ? ` · ${cutPlan.fullPanels} full` : ""}
                      {cutPlan.cutPanels > 0 ? ` · ${cutPlan.cutPanels} cut → ${cutPlan.cutWidths.map((w) => Math.round(w)).join(", ")}mm` : ""}
                    </li>
                    {cutPlan.claimed.length > 0 && (
                      <li className="font-medium text-primary">{cutPlan.claimed.length} cut from offcuts — saved {cutPlan.claimed.length} panel{cutPlan.claimed.length > 1 ? "s" : ""}</li>
                    )}
                    <li>{cutPlan.offcutsOut.length > 0 ? `Offcuts left: ${cutPlan.offcutsOut.map((o) => Math.round(o)).join(", ")}mm (auto-reused)` : "No usable offcuts"}</li>
                    {style === "barr" && fallHeight === "1m-5m" && <li className="text-[10px]">Panels capped at 1365mm (1425mm post centres) for the 1m–5m barrier load.</li>}
                  </ul>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Cuts appear once the layout is calculated.</p>
                )}
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* 2. Posts & Substrate — icon picker + (conditional) material + corners + hardware cards. */}
      <AccordionItem value="posts" className="px-3">
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
              idPrefix="bal-substrate"
              value={substrate}
              onSelect={(v) => setFV("bal-substrate", v)}
              columns={3}
              options={[
                { value: "core-drilled", label: "Core-drilled", blurb: "Into concrete", icon: <CircleDot className="h-5 w-5" /> },
                { value: "base-plated", label: "Base-plated", blurb: "Bolt-down", icon: <PanelTop className="h-5 w-5" /> },
                { value: "face-mounted", label: "Face-mounted", blurb: "Vertical edge", icon: <ArrowDownToLine className="h-5 w-5 rotate-90" /> },
              ]}
            />
          </div>

          {/* Material — only when the substrate needs it (base-plated / face-mounted). */}
          {subMeta.needsMaterial && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Fixing surface</Label>
                <InfoTooltip content={TIP.material} />
              </div>
              <IconOptionPicker
                spanId={span.spanId}
                idPrefix="bal-material"
                value={material}
                onSelect={(v) => setFV("bal-material", v)}
                columns={3}
                options={[
                  { value: "timber", label: "Timber", blurb: "LAG screws", icon: <PanelTop className="h-5 w-5" /> },
                  { value: "concrete", label: "Concrete", blurb: "Rod + anchor", icon: <CircleDot className="h-5 w-5" /> },
                  { value: "steel", label: "Steel", blurb: "You supply", icon: <AlertTriangle className="h-5 w-5" /> },
                ]}
              />
            </div>
          )}

          {/* Corners — drives face-mount back-to-back post topology. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Corners</Label>
              <InfoTooltip content={TIP.corners} />
            </div>
            <div className="flex items-center rounded-md border border-card-border w-fit">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={corners <= 0} onClick={() => setFV("bal-corners", String(Math.max(0, corners - 1)))} data-testid={`span-${span.spanId}-corners-minus`}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-xs font-semibold" data-testid={`span-${span.spanId}-corners-count`}>{corners}</span>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setFV("bal-corners", String(corners + 1))} data-testid={`span-${span.spanId}-corners-plus`}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Included hardware — posts / covers / brackets / fixings. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Included for this section</Label>
              <InfoTooltip content={TIP.posts} />
            </div>
            <HardwareCardGrid testId={`span-${span.spanId}-included-hardware`}>
              <HardwareCard
                imageSku={subMeta.postSku(finishCode)}
                title={subMeta.postTitle}
                chip={span.panelLayout ? `× ${sectionPosts}` : undefined}
                blurb={substrate === "face-mounted" ? "+ L+R end pack" : "AIRE 50×50 · cap incl."}
                testId={`span-${span.spanId}-post-card`}
              />
              {subMeta.coverSku && (
                <HardwareCard
                  imageSku={subMeta.coverSku(finishCode)}
                  title={subMeta.coverTitle!}
                  chip={span.panelLayout ? `× ${sectionPosts}` : "1 / post"}
                  blurb={subMeta.topPlate ? "+ top plate per post" : "Finishes the post base"}
                  testId={`span-${span.spanId}-cover-card`}
                />
              )}
              <HardwareCard
                imageSku={meta.bracketSku(finishCode)}
                title={meta.bracketTitle}
                chip={span.panelLayout ? `× ${sectionPanels}` : "1 / panel"}
                blurb={meta.hasCap ? "+ bracket caps" : "4 brackets / panel"}
                testId={`span-${span.spanId}-bracket-card`}
              />
              {fix.sku && (
                <HardwareCard imageSku={fix.sku} title={fix.title} chip={fix.chip} blurb="Included to match" testId={`span-${span.spanId}-fixing-card`} />
              )}
            </HardwareCardGrid>
            <div className="flex items-center gap-1.5" data-testid={`span-${span.spanId}-fixings-info`}>
              <p className="text-[11px] text-muted-foreground">{fix.supply ?? `${fix.title} included`}</p>
              <InfoTooltip content={fix.tip} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
