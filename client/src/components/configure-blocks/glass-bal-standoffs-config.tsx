import { useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpanConfig } from "@shared/schema";
import { cn } from "@/lib/utils";
import { computeSectionCutPlans } from "@/lib/cut-plan";
import { InfoTooltip } from "../info-tooltip";
import { GapSelect } from "./gap-select";
import { SpigotFamilyPicker, type SpigotFamily } from "./spigot-family-picker";
import { FINISH_LABEL, FINISH_SWATCH, type Finish } from "./glass-spigots-config";
import { GlassBalFallBand } from "./glass-bal-fall-band";

interface GlassBalStandoffsConfigProps {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  allSpans?: SpanConfig[];
  showLeftGap?: boolean;
  showRightGap?: boolean;
}

// Standoff balustrade glass (SF-16 / inputs spec): 15mm toughened, 1280mm high,
// pre-drilled. 14 fixed widths 400–1200mm. Standoff count comes from the panel's
// pre-drilled holes: ≤750mm wide = 4 standoffs, ≥800mm = 6 standoffs.
const GLASS_THICKNESS_MM = 15;
const GLASS_HEIGHT_MM = 1280;
const MAX_PANEL_MM = 1200;
const RAIL_STOCK_MM = 5800;

function panelWeightKg(widthMm: number): number {
  return (widthMm / 1000) * (GLASS_HEIGHT_MM / 1000) * GLASS_THICKNESS_MM * 2.5;
}

function standoffsForPanel(widthMm: number): number {
  return widthMm <= 750 ? 4 : 6;
}

// ── Standoff hardware matrix (SF-16: 50mm-dia subset, 18 SKUs) ─────────────────────
// Body type × depth × finish. Adjustable = GSA-50{depth}-{finish}; Fixed = GS50{depth}{finish}.
// White (Matt White) is NOT available on Fixed 20mm and Fixed 50mm (PTS-006 per-SKU enums).
const BODY_TYPES: SpigotFamily[] = [
  {
    value: "adjustable",
    label: "Adjustable Body",
    blurb: "Internal adjustment takes up substrate irregularity — DIY-friendly.",
    imageSku: "GSA-5030-P",
  },
  {
    value: "fixed",
    label: "Fixed Body",
    blurb: "Lower price; needs a flat substrate or installer shimming.",
    imageSku: "GS5030-P",
  },
];
const DEPTHS_BY_BODY: Record<string, string[]> = {
  adjustable: ["30", "45"],
  fixed: ["20", "30", "50"],
};
const STANDOFF_FINISHES: Finish[] = ["polished", "satin", "black", "white"];

const TIP = {
  maxPanel: "The widest glass panel used across this section. The layout fits as many panels as possible up to this width, then equalises the rest.",
  lhsGap: "End gap at the wall or corner on the left. Balustrade gaps stay within the AS-1170 non-climbable limit.",
  rhsGap: "End gap at the wall or corner on the right. Balustrade gaps stay within the AS-1170 non-climbable limit.",
  midGap: "Target gap between adjacent panels. Panels adjust their width to accommodate this across the section.",
};

function SectionNumber({ n, title }: { n: number; title: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{n}</span>
      <span className="text-sm font-medium">{title}</span>
    </span>
  );
}

/**
 * Standoff-balustrade configure block — same Oxworks accordion format as the other
 * balustrade wizard styles: Configure / Standoffs / Rail. Point-fix paradigm
 * (SF-16): 15mm × 1280mm pre-drilled glass on 50mm-dia stainless standoffs, capped
 * by a 35-Series top rail. No gates, no raked panels (balustrade).
 */
export function GlassBalStandoffsConfig({
  span,
  updateSpan,
  allSpans,
  showLeftGap,
  showRightGap,
}: GlassBalStandoffsConfigProps) {
  const designSpans = allSpans?.length ? allSpans : [span];

  // ── Standoff hardware state (fieldValues + spigotColor for the finish) ──────────
  const body = (span.fieldValues?.["standoff-body"] as string) || "adjustable";
  const availableDepths = DEPTHS_BY_BODY[body] ?? DEPTHS_BY_BODY.adjustable;
  const storedDepth = span.fieldValues?.["standoff-depth"] as string | undefined;
  const depth = storedDepth && availableDepths.includes(storedDepth) ? storedDepth : "30";
  // White is unavailable on Fixed 20mm / Fixed 50mm (PTS-006 per-SKU finish enums).
  const whiteBlocked = body === "fixed" && (depth === "20" || depth === "50");
  const availableFinishes = whiteBlocked ? STANDOFF_FINISHES.filter((f) => f !== "white") : STANDOFF_FINISHES;
  const currentFinish = (span.spigotColor || "polished") as Finish;

  // Defaults + keep stored choices valid when the body/depth changes (single
  // updateSpan per pass — same-cycle updates accumulate in span-config-panel).
  useEffect(() => {
    const updates: Partial<SpanConfig> = {};
    const fv: Record<string, any> = { ...span.fieldValues };
    let fvChanged = false;
    if (!span.fieldValues?.["standoff-body"]) {
      fv["standoff-body"] = "adjustable";
      fvChanged = true;
    }
    if (!storedDepth || !availableDepths.includes(storedDepth)) {
      fv["standoff-depth"] = "30";
      fvChanged = true;
    }
    if (fvChanged) updates.fieldValues = fv;
    if (!availableFinishes.includes(currentFinish)) updates.spigotColor = "polished";
    if (Object.keys(updates).length) updateSpan(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId, body, depth, whiteBlocked]);

  // ── Substrate → fixing flow (per-section; two-step conditional) ─────────────────
  const substrate = (span.spigotSubstrate || "timber") as "timber" | "concrete" | "steel";
  // Timber/Concrete second axis: direct vs through-cladding. Steel: drill-tap vs through.
  const cladding = (span.fieldValues?.["standoff-cladding"] as string) || "direct";
  const steelMethod = (span.fieldValues?.["standoff-steel-method"] as string) || "drill-tap";

  // Standoff count across this section's layout (4 per panel ≤750mm, 6 per ≥800mm).
  const layoutPanels = span.panelLayout?.panels ?? [];
  const sectionStandoffs = layoutPanels.reduce((sum, w) => sum + standoffsForPanel(w), 0);

  const fixingsInfo: Record<string, string> = {
    "timber·direct": "M12×115mm self-tapping LAG screws (1 per standoff) into structural timber — joists or solid bearers.",
    "timber·cladding": "M12×160mm self-tapping LAG screws (1 per standoff) — the extra length reaches through the cladding into structural timber.",
    "concrete·direct": "M12×120mm threaded rods (1 per standoff) set in chemical anchor (1 tube per 20 standoffs).",
    "concrete·cladding": "M12×150mm threaded rods (1 per standoff) set in chemical anchor (1 tube per 15 standoffs) — the extra length reaches through render or veneer.",
    "steel·drill-tap": "M12×120mm threaded rods (1 per standoff), drilled and tapped into steel (minimum 10mm thick). No nut needed.",
    "steel·through": "M12 through-fix kits (1 per standoff) — rod, washer, spring washer and nut. Bolts through the steel with the nut on the backside.",
  };
  const fixingsKey = substrate === "steel" ? `steel·${steelMethod}` : `${substrate}·${cladding}`;

  // ── Rail (35-Series only — SF-16: no Nanorail leaf on this style) ───────────────
  const rail = span.handrail;
  // Rail finish (operator ruling 2026-06-03): MATCH the standoff finish by default —
  // polished/satin standoffs → Satin Anodised rail; black → Black; white → Matt White.
  // A toggle (same pattern as the pool spigots gate-hardware matcher) lets the user
  // pick a contrasting rail finish instead. (Mill is storefront-only, excluded.)
  const RAIL_FINISH_LABEL: Record<string, string> = { black: "Black", white: "Matt White", satin: "Satin Anodised" };
  const matchedRailFinish: "black" | "white" | "satin" =
    currentFinish === "black" ? "black" : currentFinish === "white" ? "white" : "satin";
  const railFinishMatch = (span.fieldValues?.["rail-finish-match"] as string) !== "false"; // default ON
  const railFinish = (rail?.finish || matchedRailFinish) as "black" | "white" | "satin";
  useEffect(() => {
    if (span.handrail === undefined) {
      updateSpan({
        handrail: {
          enabled: true,
          type: "series-35x35",
          material: "anodised-aluminium",
          finish: matchedRailFinish,
          startTermination: "end-cap",
          endTermination: "end-cap",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId, span.handrail === undefined]);
  // While matching is ON, keep the rail finish following the standoff finish.
  useEffect(() => {
    if (railFinishMatch && rail?.enabled && rail.finish !== matchedRailFinish) {
      updateSpan({ handrail: { ...rail, finish: matchedRailFinish } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [railFinishMatch, matchedRailFinish, rail?.enabled]);
  // Rail cut plan (5800mm stock, offcut reuse across sections — same engine as channel).
  const railPlanRaw = computeSectionCutPlans(
    designSpans.map((s) => ({
      id: s.spanId,
      label: s.name?.trim() || `Section ${s.spanId}`,
      runsMm: s.handrail?.enabled === false ? [] : [s.length],
    })),
    RAIL_STOCK_MM,
  ).get(span.spanId);
  const railPlan = {
    fullLengths: railPlanRaw?.fullLengths ?? 0,
    joins: railPlanRaw?.joins ?? 0,
    offcutOut: railPlanRaw?.offcutOutMm ?? 0,
    claimed: railPlanRaw?.claimedOffcuts ?? [],
  };

  const standardPanelWidth = layoutPanels.length ? Math.max(...layoutPanels) : span.maxPanelWidth;
  const weightKg = panelWeightKg(standardPanelWidth);

  // Keep max panel within the standoff glass range (400–1200mm).
  useEffect(() => {
    if (span.maxPanelWidth > MAX_PANEL_MM) updateSpan({ maxPanelWidth: MAX_PANEL_MM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.maxPanelWidth]);

  return (
    <Accordion
      type="multiple"
      defaultValue={["configure", "standoffs", "rail"]}
      className="rounded-md border border-card-border"
    >
      {/* 1. Configure */}
      <AccordionItem value="configure" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-configure`}>
          <SectionNumber n={1} title="Configure" />
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Max Panel Width</Label>
                <InfoTooltip content={TIP.maxPanel} />
              </div>
              <Select value={span.maxPanelWidth.toString()} onValueChange={(v) => updateSpan({ maxPanelWidth: parseInt(v) })}>
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-max-panel-width`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: (MAX_PANEL_MM - 400) / 50 + 1 }, (_, i) => 400 + i * 50).map((w) => (
                    <SelectItem key={w} value={w.toString()}>{w}mm</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showLeftGap && (
              <GapSelect
                label="LHS Gap"
                value={span.leftGap?.enabled ? span.leftGap.size : 0}
                onChange={(size) => updateSpan({ leftGap: size > 0 ? { enabled: true, position: "inside", size } : undefined })}
                min={0} max={125} step={5} tooltip={TIP.lhsGap}
                testId={`span-${span.spanId}-left-gap`}
              />
            )}

            <GapSelect
              label="Mid Gap"
              value={span.desiredGap}
              onChange={(desiredGap) => updateSpan({ desiredGap })}
              min={0} max={99} step={5} tooltip={TIP.midGap}
              testId={`span-${span.spanId}-gap-select`}
            />

            {showRightGap && (
              <GapSelect
                label="RHS Gap"
                value={span.rightGap?.enabled ? span.rightGap.size : 0}
                onChange={(size) => updateSpan({ rightGap: size > 0 ? { enabled: true, position: "inside", size } : undefined })}
                min={0} max={125} step={5} tooltip={TIP.rhsGap}
                testId={`span-${span.spanId}-right-gap`}
              />
            )}
          </div>

          <p className="mt-2.5 text-xs text-muted-foreground" data-testid={`span-${span.spanId}-panel-weight`}>
            Panel weight ≈ <span className="font-semibold text-foreground">{weightKg.toFixed(1)} kg</span>{" "}
            per {standardPanelWidth}×{GLASS_HEIGHT_MM}mm panel ({GLASS_THICKNESS_MM}mm glass, pre-drilled)
          </p>

          {/* AS1288 fall-height band — drives glass selection (toughened <5m / laminated ≥5m).
              Standoff point-fix has no run-length cap. */}
          <div className="mt-3">
            <GlassBalFallBand span={span} updateSpan={updateSpan} productVariant="glass-bal-standoffs" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Standoffs */}
      <AccordionItem value="standoffs" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-standoffs`}>
          <SectionNumber n={2} title="Standoffs" />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          {/* Body type — the primary hardware choice (Dimension-Matrix, not family). */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Standoff Body</Label>
              <InfoTooltip content="The 50mm stainless standoff that the pre-drilled glass bolts to. Adjustable bodies take up uneven substrate; fixed bodies are cheaper but need a flat surface or shims. One body type per job." />
            </div>
            <SpigotFamilyPicker
              families={BODY_TYPES}
              value={body}
              onSelect={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "standoff-body": v } })}
              spanId={span.spanId}
            />
          </div>

          {/* Depth + finish — filtered by body type (per-SKU PTS-006 enums). */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Body Depth</Label>
                <InfoTooltip content="How far the glass stands off the substrate. Adjustable bodies come in 30mm and 45mm; fixed bodies in 20mm, 30mm and 50mm." />
              </div>
              <Select
                value={depth}
                onValueChange={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "standoff-depth": v } })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-standoff-depth`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDepths.map((d) => (
                    <SelectItem key={d} value={d}>{d}mm</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Finish</Label>
                <InfoTooltip content="The standoff finish. White is not available on the fixed 20mm and 50mm bodies." />
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid={`span-${span.spanId}-finish-picker`}>
                {STANDOFF_FINISHES.map((f) => {
                  const blocked = !availableFinishes.includes(f);
                  const active = f === currentFinish && !blocked;
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={blocked}
                      onClick={() => updateSpan({ spigotColor: f })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover-elevate active-elevate-2",
                        blocked
                          ? "cursor-not-allowed border-card-border opacity-40"
                          : active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-card-border",
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
          </div>

          {/* Standoff count — driven by the pre-drilled panels, not a choice. */}
          <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-standoff-count`}>
            <p className="text-[11px] font-semibold">Standoffs for this section</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {layoutPanels.length
                ? `${sectionStandoffs} standoffs across ${layoutPanels.length} panel${layoutPanels.length === 1 ? "" : "s"} — panels up to 750mm wide take 4 standoffs, wider panels take 6 (set by the panel's pre-drilled holes).`
                : "Panels up to 750mm wide take 4 standoffs; wider panels take 6 (set by the panel's pre-drilled holes)."}
            </p>
          </div>

          {/* Substrate → fixing method (two-step conditional flow). */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Substrate</Label>
                <InfoTooltip content="The surface the standoffs fix to. Each section can use a different substrate; the fixings are included to match." />
              </div>
              <Select
                value={substrate}
                onValueChange={(v) => updateSpan({ spigotSubstrate: v as typeof substrate })}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-standoff-substrate`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timber">Timber</SelectItem>
                  <SelectItem value="concrete">Concrete</SelectItem>
                  <SelectItem value="steel">Steel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">
                  {substrate === "steel" ? "Steel Fixing" : "Cladding"}
                </Label>
                <InfoTooltip
                  content={
                    substrate === "steel"
                      ? "Drill-and-tap cuts an M12 thread into the steel itself (min 10mm thick). Through-fix bolts right through with a nut on the back."
                      : "Is there cladding (decking boards, render, brick veneer, weatherboard) between the fixing point and the structure? Through-cladding fixings are longer to reach the structure behind it."
                  }
                />
              </div>
              {substrate === "steel" ? (
                <Select
                  value={steelMethod}
                  onValueChange={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "standoff-steel-method": v } })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-standoff-steel-method`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drill-tap">Drill and tap</SelectItem>
                    <SelectItem value="through">Through steel</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={cladding}
                  onValueChange={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "standoff-cladding": v } })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-standoff-cladding`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct (no cladding)</SelectItem>
                    <SelectItem value="cladding">Through cladding</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Fixings included */}
          <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-fixings-info`}>
            <p className="text-[11px] font-semibold">
              Fixings included ({substrate}
              {substrate === "steel" ? ` · ${steelMethod === "drill-tap" ? "drill and tap" : "through steel"}` : ` · ${cladding === "direct" ? "direct" : "through cladding"}`})
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{fixingsInfo[fixingsKey]}</p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 3. Rail (35-Series top rail — the AS-1288 interlinking structure) */}
      <AccordionItem value="rail" className="px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-rail`}>
          <SectionNumber n={3} title="Rail" />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Top Mounted Rail</Label>
              <InfoTooltip content="35-Series top rail (35×35mm anodised aluminium) — it interlinks the panels for AS 1288 compliance. Standard 5800mm lengths, optimised across sections. Ships with glazing rubber and two end caps fitted." />
            </div>
            <Switch
              checked={rail?.enabled || false}
              onCheckedChange={(enabled) => {
                if (enabled) {
                  updateSpan({
                    handrail: rail
                      ? { ...rail, enabled: true, type: "series-35x35", material: "anodised-aluminium" }
                      : {
                          enabled: true,
                          type: "series-35x35",
                          material: "anodised-aluminium",
                          finish: "black",
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Finish</Label>
                      <InfoTooltip content="By default the rail finish matches your standoffs — polished or satin standoffs take a Satin Anodised rail, black takes Black, white takes Matt White. Turn the match off to pick a contrasting rail finish." />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Match standoffs</span>
                      <Switch
                        checked={railFinishMatch}
                        onCheckedChange={(on) =>
                          updateSpan({ fieldValues: { ...span.fieldValues, "rail-finish-match": on ? "true" : "false" } })
                        }
                        data-testid={`span-${span.spanId}-rail-finish-match`}
                      />
                    </div>
                  </div>
                  {railFinishMatch ? (
                    <div
                      className="flex h-8 items-center rounded-md border border-card-border bg-muted/30 px-3 text-xs text-muted-foreground"
                      data-testid={`span-${span.spanId}-rail-finish`}
                    >
                      {RAIL_FINISH_LABEL[matchedRailFinish]} (matches standoffs)
                    </div>
                  ) : (
                    <Select
                      value={railFinish}
                      onValueChange={(finish) => updateSpan({ handrail: { ...rail, finish: finish as "black" | "white" | "satin" } })}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-finish`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="white">Matt White</SelectItem>
                        <SelectItem value="satin">Satin Anodised</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Rail terminations per end — same enum as the other balustrade styles. */}
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
                      <SelectItem value="end-cap">End Cap (free end)</SelectItem>
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
                      <SelectItem value="end-cap">End Cap (free end)</SelectItem>
                      <SelectItem value="wall-tie">Wall Tie</SelectItem>
                      <SelectItem value="90-degree">90° Corner</SelectItem>
                      <SelectItem value="adjustable-corner">Adjustable Corner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rail lengths & offcut reuse — 5800mm stock, shared cut-plan engine. */}
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
    </Accordion>
  );
}
