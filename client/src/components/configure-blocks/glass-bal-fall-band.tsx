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
 *   1-5m — standard barrier; toughened MONOLITHIC glass; run-length limit applies.
 *   >5m  — toughened LAMINATED glass is MANDATORY (AS1288 §7, no exceptions). Frameless
 *          spigot/channel/standoff systems have no Deemed-to-Satisfy pathway, so site-
 *          specific engineering certification is required (we proceed with the laminated spec).
 *
 * Glass build per system (from the PTS engineering extractions in the ECO Vault):
 *   spigots-12mm (Madrid Standard) 12mm mono / 11.52mm laminated
 *   spigots-15mm (Madrid Deluxe)   15mm mono / 16mm laminated
 *   channel      (VersaTilt)       15mm mono / 15mm laminated
 *   standoffs    (Standoff PF)     15mm mono / 15mm laminated
 */

export type GlassFallBand = "under-1m" | "1m-5m" | "over-5m";

export const GLASS_FALL_FIELD = "glass-bal-fall-height";

interface GlassBuild {
  /** Monolithic (toughened) thickness label for <5m. */
  mono: string;
  /** Laminated thickness label for >=5m. */
  laminated: string;
}

/** Per-variant glass build, keyed by the base style (suffix-insensitive). */
export function glassBuildFor(variant: ProductVariant | string): GlassBuild {
  if (variant.includes("15mm")) return { mono: "15mm toughened monolithic", laminated: "16mm toughened laminated" };
  if (variant.includes("12mm")) return { mono: "12mm toughened monolithic", laminated: "11.52mm toughened laminated" };
  // channel + standoffs are both 15mm, laminated stays 15mm
  return { mono: "15mm toughened monolithic", laminated: "15mm toughened laminated" };
}

/** Resolve the current band off the span (defaults to the standard 1-5m case). */
export function glassFallBand(span: SpanConfig): GlassFallBand {
  return ((span.fieldValues?.[GLASS_FALL_FIELD] as GlassFallBand) || "1m-5m");
}

/** The glass build that applies for a given band (laminated at >=5m). */
export function glassBuildForBand(variant: ProductVariant | string, band: GlassFallBand): { build: string; laminated: boolean } {
  const b = glassBuildFor(variant);
  const laminated = band === "over-5m";
  return { build: laminated ? b.laminated : b.mono, laminated };
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
  const { build, laminated } = glassBuildForBand(productVariant, band);

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
          { value: "over-5m", label: "Over 5m", blurb: "Laminated", icon: <Layers className="h-5 w-5" /> },
        ]}
      />

      {/* Glass spec + AS1288 compliance note, per band. */}
      <div
        className={
          "rounded-md border p-2.5 text-[11px] leading-relaxed " +
          (laminated
            ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-card-border bg-muted/30")
        }
        data-testid={`span-${span.spanId}-glass-spec`}
      >
        <p className="font-semibold">
          Glass: {build}
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
        {band === "over-5m" && (
          <p className="text-amber-800 dark:text-amber-300">
            Above a 5m fall, AS1288 §7 mandates toughened <strong>laminated</strong> glass — no exceptions. Frameless systems have no Deemed-to-Satisfy pathway, so site-specific engineering certification is required. We&apos;ve set the laminated spec and will proceed.
          </p>
        )}
      </div>
    </div>
  );
}
