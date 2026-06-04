import { Label } from "@/components/ui/label";
import { ArrowDownToLine, PanelTop, Layers } from "lucide-react";
import type { SpanConfig, ProductVariant } from "@shared/schema";
import { InfoTooltip } from "../info-tooltip";
import { IconOptionPicker } from "./hardware-card";

/**
 * AS1288 fall-height band for the GLASS balustrade styles.
 *
 * Unlike the aluminium balustrade band (which is a structural panel-cap toggle),
 * the glass band drives the AS1288 §7 GLASS SELECTION:
 *   <1m  — not an NCC fall-prevention barrier; the system run-length limit is lifted.
 *   1-5m — standard barrier; toughened glass; run-length limit applies.
 *   >5m  — AS1288 §7 mandates LAMINATED glass. These styles are toughened-only — the ONLY
 *          laminated option in the range is the VersaTilt HD Channel (17.52mm SGP), so >5m
 *          REDIRECTS the customer there (no laminated SKU is emitted for these styles).
 *
 * Glass build per style: spigots-12mm 970NTG (12mm) · spigots-15mm + channel 1000FBG (15mm)
 * · standoffs 1280S (15mm). All toughened.
 */

export type GlassFallBand = "under-1m" | "1m-5m" | "over-5m";

export const GLASS_FALL_FIELD = "glass-bal-fall-height";

/** Toughened glass build per standard style — the ONLY build these styles offer.
 * The single laminated option in the range is the VersaTilt HD Channel (17.52mm SGP);
 * these styles have no laminated SKU, so >5m redirects there. */
export function glassBuildFor(variant: ProductVariant | string): string {
  if (variant.includes("15mm")) return "15mm toughened monolithic";
  if (variant.includes("12mm")) return "12mm toughened monolithic";
  return "15mm toughened monolithic"; // channel + standoffs
}

/** Resolve the current band off the span (defaults to the standard 1-5m case). */
export function glassFallBand(span: SpanConfig): GlassFallBand {
  return ((span.fieldValues?.[GLASS_FALL_FIELD] as GlassFallBand) || "1m-5m");
}

interface Props {
  span: SpanConfig;
  updateSpan: (updates: Partial<SpanConfig>) => void;
  productVariant: ProductVariant | string;
  /** Madrid Standard (12mm spigots, family=madrid) is the only system with a 4.88m run cap. */
  showRunCapNote?: boolean;
}

export function GlassBalFallBand({ span, updateSpan, productVariant, showRunCapNote = false }: Props) {
  const band = glassFallBand(span);
  const build = glassBuildFor(productVariant);
  const over5m = band === "over-5m"; // these styles can't go laminated → redirect to HD

  const setBand = (v: string) =>
    updateSpan({ fieldValues: { ...span.fieldValues, [GLASS_FALL_FIELD]: v } });

  return (
    <div className="space-y-1.5" data-testid={`span-${span.spanId}-glass-fall`}>
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground">Fall Height</Label>
        <InfoTooltip content="How far someone could fall over the balustrade. AS1288 §7 selects the glass by this: under 1m is not an NCC fall-barrier; 1–5m is the standard case (toughened); over 5m mandates toughened laminated glass." />
      </div>
      <IconOptionPicker
        spanId={span.spanId}
        idPrefix="glass-fall"
        value={band}
        onSelect={setBand}
        columns={3}
        options={[
          { value: "under-1m", label: "Under 1m", blurb: "No barrier case", icon: <ArrowDownToLine className="h-5 w-5" /> },
          { value: "1m-5m", label: "1m – 5m", blurb: "Toughened", icon: <PanelTop className="h-5 w-5" /> },
          { value: "over-5m", label: "Over 5m", blurb: "Laminated → HD", icon: <Layers className="h-5 w-5" /> },
        ]}
      />

      {/* Glass spec + AS1288 compliance note, per band. */}
      <div
        className={
          "rounded-md border p-2.5 text-[11px] leading-relaxed " +
          (over5m
            ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-card-border bg-muted/30")
        }
        data-testid={`span-${span.spanId}-glass-spec`}
      >
        <p className="font-semibold">
          Glass: {over5m ? "laminated required — see below" : build}
        </p>
        {band === "under-1m" && (
          <p className="text-muted-foreground">
            Under a 1m fall this isn&apos;t an NCC fall-prevention barrier{showRunCapNote ? " — the 4.88m run-length limit is lifted" : ""}. Grade A safety glass still applies.
          </p>
        )}
        {band === "1m-5m" && (
          <p className="text-muted-foreground">
            Standard balustrade barrier. Toughened monolithic glass to AS1288 §7{showRunCapNote ? "; the 4.88m certified run-length limit applies" : ""}.
          </p>
        )}
        {over5m && (
          <p className="text-amber-800 dark:text-amber-300">
            Above a 5m fall, AS1288 §7 mandates <strong>laminated</strong> glass — and this style is toughened only. The only laminated option is the <strong>VersaTilt HD Channel</strong> (17.52mm SGP). Switch this section to the HD Channel style.
          </p>
        )}
      </div>
    </div>
  );
}
