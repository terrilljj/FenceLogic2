import { useEffect } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpanConfig, ProductVariant } from "@shared/schema";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "../info-tooltip";
import { GapSelect } from "./gap-select";
import { SpigotFamilyPicker, type SpigotFamily } from "./spigot-family-picker";
import { COVER_MATRIX, MADRID_COVERS, FINISH_BY_FAMILY, FINISH_LABEL, FINISH_SWATCH, type Finish } from "./glass-spigots-config";

interface GlassBalSpigotsConfigProps {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  productVariant: ProductVariant;
  showLeftGap?: boolean;
  showRightGap?: boolean;
}

// Glass density ~2.5 kg/m²/mm. Balustrade glass is 12mm (970 high) or 15mm (1000 high).
const GLASS_DENSITY_KG = 2.5;

function panelWeightKg(widthMm: number, heightMm: number, thicknessMm: number): number {
  return (widthMm / 1000) * (heightMm / 1000) * thicknessMm * GLASS_DENSITY_KG;
}

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
 * Balustrade-spigots configure block — SAME Oxworks accordion format as
 * glass-pool-spigots, with the balustrade section set: Configure (+ glass
 * thickness) / Spigot / Rail. No Gate, no Raked (balustrade). Operates on the
 * shared span/updateSpan state and reuses the GapSelect primitive.
 */
export function GlassBalSpigotsConfig({
  span,
  updateSpan,
  productVariant,
  showLeftGap,
  showRightGap,
}: GlassBalSpigotsConfigProps) {
  // Thickness is the style itself (separate 12mm / 15mm calc styles), not a field.
  const thickness: "12mm" | "15mm" = productVariant.includes("15mm") ? "15mm" : "12mm";
  // PTS max panel span: 15mm → 1400mm, 12mm → 1500mm (not the generic 1800).
  const maxPanelCap = thickness === "15mm" ? 1400 : 1500;

  // Keep max panel within the PTS cap (e.g. after a shape change adds a generic-1800 span).
  useEffect(() => {
    if (span.maxPanelWidth > maxPanelCap) updateSpan({ maxPanelWidth: maxPanelCap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPanelCap, span.maxPanelWidth]);
  const thicknessMm = thickness === "15mm" ? 15 : 12;
  const panelHeightMm = thickness === "15mm" ? 1000 : 970;
  const standardPanelWidth = span.panelLayout?.panels?.length
    ? Math.max(...span.panelLayout.panels)
    : span.maxPanelWidth;
  const weightKg = panelWeightKg(standardPanelWidth, panelHeightMm, thicknessMm);

  const rail = span.handrail;
  const defaultRailType: "nonorail-25x21" | "series-35x35" = thickness === "12mm" ? "nonorail-25x21" : "series-35x35";

  // Top rail defaults ON for all balustrade styles. Turning it off sets
  // enabled:false (not undefined), so this won't re-enable a deliberate off.
  useEffect(() => {
    if (span.handrail === undefined) {
      updateSpan({
        handrail: {
          enabled: true,
          type: defaultRailType,
          material: defaultRailType === "series-35x35" ? "anodised-aluminium" : "stainless-steel",
          finish: "satin",
          startTermination: "end-cap",
          endTermination: "end-cap",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.spanId, span.handrail === undefined]);

  // V1 spigot families: 12mm → Madrid Standard + Nova; 15mm → Madrid Deluxe only.
  // (SF-8 walk / 15mm inputs-spec.) Written to fieldValues['spigot-family'], which
  // the solver reads as the spigot-hardware discriminator.
  const spigotFamilies: SpigotFamily[] = thickness === "15mm"
    ? [{ value: "madrid-deluxe", label: "Madrid Deluxe", blurb: "15mm balustrade system (PTS-002).", imageSku: "MADDEL-SBP-B" }]
    : [
        { value: "madrid", label: "Madrid Standard", blurb: "Cost-effective; 4.88m run cap (PTS-007).", imageSku: "MAD-SBP-B" },
        { value: "nova", label: "Nova", blurb: "No per-run cap (PTS-001).", imageSku: "NOV-SBP-B" },
      ];
  const currentFamily = span.fieldValues?.["spigot-family"] || spigotFamilies[0].value;
  // Keep the family valid for the style (15mm is single-family).
  useEffect(() => {
    if (!span.fieldValues?.["spigot-family"] || !spigotFamilies.some((f) => f.value === span.fieldValues?.["spigot-family"])) {
      updateSpan({ fieldValues: { ...span.fieldValues, "spigot-family": spigotFamilies[0].value } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thickness, span.spanId]);

  // Spigot finish (SF-8/SF-9 job-wide cosmetic input): {Polish, Satin, Black, Matt White},
  // uniform across balustrade families and mountings. Filtered via the shared per-family
  // enums; covers auto-match the chosen finish.
  const familyFinishes = FINISH_BY_FAMILY[currentFamily] ?? (["polished", "satin", "black", "white"] as Finish[]);
  const currentFinish = (span.spigotColor || "polished") as Finish;
  useEffect(() => {
    if (!familyFinishes.includes(currentFinish)) {
      updateSpan({ spigotColor: familyFinishes[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFamily, span.spanId]);

  return (
    <Accordion
      type="multiple"
      defaultValue={["configure", "spigot", "rail"]}
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
                  {Array.from({ length: (maxPanelCap - 200) / 50 + 1 }, (_, i) => 200 + i * 50).map((w) => (
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
            per {standardPanelWidth}×{panelHeightMm}mm panel ({thicknessMm}mm glass)
          </p>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Spigot */}
      <AccordionItem value="spigot" className="border-b border-card-border px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-spigot`}>
          <SectionNumber n={2} title="Spigot" />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Spigot Family</Label>
              <InfoTooltip content="The spigot system. 15mm balustrade uses Madrid Deluxe; 12mm offers Madrid Standard or Nova. Engineering certification differs by family." />
            </div>
            <SpigotFamilyPicker
              families={spigotFamilies}
              value={currentFamily}
              onSelect={(v) => updateSpan({ fieldValues: { ...span.fieldValues, "spigot-family": v } })}
              spanId={span.spanId}
            />
          </div>

          {/* Finish — same swatch picker as pool spigots. Writes spigotColor (schema enum);
              covers and spigot SKUs auto-match this finish. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <InfoTooltip content="The spigot finish. Spigot covers are finished to match automatically." />
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
          {/* SF-1 hardware flow (same rules as pool spigots): substrate → mounting →
              covers → fixings. Only CONCRETE can be core-drilled; base-plate rods on
              concrete/steel protrude → raised/high cover required. */}
          {(() => {
            const substrate = (span.spigotSubstrate || "concrete") as "concrete" | "timber" | "steel";
            const mounting = span.spigotMounting === "core-drilled" && substrate === "concrete" ? "core-drilled" : "base-plate";
            const needsRaisedCover = mounting === "base-plate" && (substrate === "concrete" || substrate === "steel");
            const coverCategory = mounting === "core-drilled" ? "dress" : "dome";
            const coverOptions = (COVER_MATRIX[currentFamily] ?? MADRID_COVERS)[coverCategory].map((o) => ({
              ...o,
              disabled: !!o.slim && needsRaisedCover,
            }));
            const enabledCovers = coverOptions.filter((o) => !o.disabled);
            const storedCover = span.fieldValues?.["spigot-cover"] as string | undefined;
            const spigotCover = storedCover && enabledCovers.some((o) => o.value === storedCover)
              ? storedCover
              : enabledCovers[0]?.value ?? coverOptions[0].value;
            const fixingsInfo: Record<string, string> = {
              "concrete·base-plate": "M10×120mm stainless threaded rods (1 pack per spigot) + chemical anchor (1 per 6 spigots).",
              "concrete·core-drilled": "Pourable grout — 1 bag per 10 spigots plus a spare. No mechanical fixings.",
              "timber·base-plate": "100mm countersunk batten screws (1 pack per spigot). Fix into joists or solid bearers.",
              "steel·base-plate": "M10×120mm stainless threaded rods (1 pack per spigot). No chemical anchor needed for steel.",
            };
            return (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Substrate</Label>
                      <InfoTooltip content="The surface the spigots fix to. Concrete can be core-drilled or base-plated; timber decks and steel must be base-plated." />
                    </div>
                    <Select
                      value={substrate}
                      onValueChange={(v) => {
                        const next: Partial<typeof span> = { spigotSubstrate: v as typeof substrate };
                        if (v !== "concrete" && span.spigotMounting === "core-drilled") next.spigotMounting = "base-plate";
                        updateSpan(next);
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
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mounting</Label>
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
                  </div>
                </div>

                {/* Covers — category follows mounting; range follows the family matrix. */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Spigot Covers — {mounting === "core-drilled" ? "dress rings" : "domical covers"}
                    </Label>
                    <InfoTooltip content="Core-drilled spigots take dress rings; base-plated take domical covers. On concrete or steel the rod fixings protrude, so the taller cover is required." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {coverOptions.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        disabled={o.disabled}
                        onClick={() => updateSpan({ fieldValues: { ...span.fieldValues, "spigot-cover": o.value } })}
                        className={
                          "rounded-md border p-2 text-left text-xs transition-colors " +
                          (o.disabled
                            ? "cursor-not-allowed border-card-border opacity-40"
                            : spigotCover === o.value
                              ? "border-primary bg-primary/5"
                              : "border-card-border hover:border-primary/40")
                        }
                        data-testid={`span-${span.spanId}-cover-${o.value}`}
                      >
                        <span className="font-medium">{o.label}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {o.disabled ? "Won't clear the rod fixings on concrete/steel." : o.blurb}
                        </span>
                      </button>
                    ))}
                  </div>
                  {coverOptions.length === 1 && (
                    <p className="text-[11px] text-muted-foreground">This family has one cover option — included automatically.</p>
                  )}
                </div>

                {/* Fixings included */}
                <div className="rounded-md border border-card-border bg-muted/30 p-2.5" data-testid={`span-${span.spanId}-fixings-info`}>
                  <p className="text-[11px] font-semibold">Fixings included ({substrate} · {mounting === "core-drilled" ? "core drilled" : "base plate"})</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {fixingsInfo[`${substrate}·${mounting}`] ?? fixingsInfo["concrete·base-plate"]}
                  </p>
                </div>
              </>
            );
          })()}
        </AccordionContent>
      </AccordionItem>

      {/* 3. Rail (top-mounted handrail) */}
      <AccordionItem value="rail" className="px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline" data-testid={`span-${span.spanId}-accordion-rail`}>
          <SectionNumber n={3} title="Rail" />
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Top Mounted Rail</Label>
              <InfoTooltip content="Add a top-mounted handrail. Standard 5800mm lengths, optimised across sections to reduce wastage." />
            </div>
            <Switch
              checked={rail?.enabled || false}
              onCheckedChange={(enabled) => {
                if (enabled) {
                  updateSpan({ handrail: rail
                    ? { ...rail, enabled: true }
                    : { enabled: true, type: defaultRailType, material: defaultRailType === "series-35x35" ? "anodised-aluminium" : "stainless-steel", finish: "satin", startTermination: "end-cap", endTermination: "end-cap" } });
                } else {
                  updateSpan({ handrail: rail ? { ...rail, enabled: false } : undefined });
                }
              }}
              data-testid={`span-${span.spanId}-top-rail-toggle`}
            />
          </div>

          {rail?.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rail Type</Label>
                  <Select
                    value={rail.type}
                    onValueChange={(type) => {
                      const t = type as "nonorail-25x21" | "nanorail-30x21" | "series-35x35";
                      const is35 = t === "series-35x35";
                      // 35 Series → anodised aluminium, and it has no Polished finish.
                      updateSpan({ handrail: {
                        ...rail,
                        type: t,
                        material: is35 ? "anodised-aluminium" : rail.material,
                        finish: is35 && rail.finish === "polished" ? "satin" : rail.finish,
                      } });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Launch rail choices: 12mm = 25×21 + 35 Series; 15mm = 35 Series only. */}
                      {thickness === "12mm" && <SelectItem value="nonorail-25x21">25×21mm (NonoRail)</SelectItem>}
                      <SelectItem value="series-35x35">35×35mm (Series 35)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <Select value={rail.material} onValueChange={(material) => updateSpan({ handrail: { ...rail, material: material as "stainless-steel" | "anodised-aluminium" } })}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-material`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stainless-steel">Stainless Steel</SelectItem>
                      <SelectItem value="anodised-aluminium">Anodised Aluminium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Finish</Label>
                  <Select value={rail.finish} onValueChange={(finish) => updateSpan({ handrail: { ...rail, finish: finish as "polished" | "satin" | "black" | "white" } })}>
                    <SelectTrigger className="h-8 text-xs" data-testid={`span-${span.spanId}-rail-finish`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* 35 Series (aluminium) has no Polished — Satin Anodised / Black / Matt White only. */}
                      {rail.type === "series-35x35" ? (
                        <>
                          <SelectItem value="satin">Satin Anodised</SelectItem>
                          <SelectItem value="black">Black</SelectItem>
                          <SelectItem value="white">Matt White</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="polished">Polished</SelectItem>
                          <SelectItem value="satin">Satin</SelectItem>
                          <SelectItem value="black">Black</SelectItem>
                          <SelectItem value="white">White</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start Termination</Label>
                  <Select value={rail.startTermination || "end-cap"} onValueChange={(t) => updateSpan({ handrail: { ...rail, startTermination: t as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" } })}>
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
                  <Select value={rail.endTermination || "end-cap"} onValueChange={(t) => updateSpan({ handrail: { ...rail, endTermination: t as "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner" } })}>
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
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
