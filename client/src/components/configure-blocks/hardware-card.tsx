import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { familyImageSrc } from "./spigot-family-picker";

/**
 * Visual primitives for the aluminium-style configure blocks (Blade / BARR / Flat Top
 * Tubular / alu balustrades). Operator ruling 2026-06-03: these styles must carry the
 * same visual language as the glass styles (image cards + icon pickers), not text.
 *
 *  • HardwareCard — non-interactive "included" product card: image + name + qty chip.
 *    The alu equivalent of the spigot family card — posts/covers/brackets have NO
 *    inputs, but the user still SEES the product they're getting.
 *  • IconOptionPicker — selectable icon cards (substrate, layout mode, ...) with the
 *    same active-ring treatment as the spigot family picker.
 */

// ── HardwareCard ─────────────────────────────────────────────────────────────────

export interface HardwareCardProps {
  /** Product SKU — drives the storefront image (placeholder until images land). */
  imageSku: string;
  title: string;
  /** Quantity / spec chip pinned to the image corner (e.g. "× 6", "1 per panel"). */
  chip?: string;
  /** One short line under the title. */
  blurb?: string;
  /** Extra detail behind an info tooltip — keeps the card itself terse. */
  testId?: string;
}

export function HardwareCard({ imageSku, title, chip, blurb, testId }: HardwareCardProps) {
  const img = familyImageSrc(imageSku);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-card-border bg-card p-2" data-testid={testId}>
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-muted text-center">
        {img ? (
          <img src={img} alt={title} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="px-1 text-[9px] leading-tight text-muted-foreground">
            image soon
            <br />
            <span className="font-mono">{imageSku}</span>
          </span>
        )}
        {chip && (
          <span className="absolute right-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {chip}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{title}</p>
        {blurb && <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{blurb}</p>}
      </div>
    </div>
  );
}

/** Grid wrapper so hardware cards lay out like the spigot family cards. */
export function HardwareCardGrid({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4" data-testid={testId}>
      {children}
    </div>
  );
}

// ── IconOptionPicker ─────────────────────────────────────────────────────────────

export interface IconOption {
  value: string;
  label: string;
  /** Lucide icon (or any node) shown above the label. */
  icon: ReactNode;
  blurb?: string;
}

export function IconOptionPicker({
  options,
  value,
  onSelect,
  spanId,
  idPrefix,
  columns = 4,
}: {
  options: IconOption[];
  value: string;
  onSelect: (value: string) => void;
  spanId: string;
  idPrefix: string;
  columns?: 2 | 3 | 4;
}) {
  const colsClass = columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={cn("grid gap-2", colsClass)} data-testid={`span-${spanId}-${idPrefix}-picker`}>
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-2.5 text-center transition-colors hover-elevate active-elevate-2",
              isActive ? "border-primary/50 bg-primary/5 ring-2 ring-primary" : "border-card-border bg-card",
            )}
            data-testid={`span-${spanId}-${idPrefix}-${o.value}`}
          >
            <span className={cn("relative", isActive ? "text-primary" : "text-muted-foreground")}>
              {o.icon}
              {isActive && (
                <span className="absolute -right-2.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </span>
            <span className="text-xs font-semibold leading-tight">{o.label}</span>
            {o.blurb && <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{o.blurb}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── LayoutModeThumb ──────────────────────────────────────────────────────────────
// Mini SVG diagrams for the panel layout-mode cards: evenly spaced vs full + infill.
// Colours match the elevation renderer (panels blue, posts dark).

export function LayoutModeThumb({ variant }: { variant: "even" | "infill" }) {
  const panelFill = "#d9e8f5";
  const panelStroke = "#b8d4e8";
  const postFill = "#1f2937";
  return (
    <svg viewBox="0 0 100 44" className="h-9 w-full" role="img" aria-label={variant === "even" ? "Evenly spaced" : "Full panels + infill"}>
      {variant === "even" ? (
        <>
          {/* 3 equal panels */}
          {[4, 36, 68].map((x) => (
            <rect key={x} x={x} y={6} width={26} height={32} fill={panelFill} stroke={panelStroke} strokeWidth="1.5" />
          ))}
          {[1, 33, 65, 97].map((x) => (
            <rect key={x} x={x} y={4} width={3} height={36} fill={postFill} />
          ))}
        </>
      ) : (
        <>
          {/* 2 full panels + 1 narrow infill */}
          <rect x={4} y={6} width={34} height={32} fill={panelFill} stroke={panelStroke} strokeWidth="1.5" />
          <rect x={44} y={6} width={34} height={32} fill={panelFill} stroke={panelStroke} strokeWidth="1.5" />
          <rect x={84} y={6} width={12} height={32} fill={panelFill} stroke={panelStroke} strokeWidth="1.5" />
          {[1, 40, 80, 97].map((x) => (
            <rect key={x} x={x} y={4} width={3} height={36} fill={postFill} />
          ))}
        </>
      )}
    </svg>
  );
}
