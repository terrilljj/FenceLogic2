import { cn } from "@/lib/utils";

export type PanelVariant = "standard" | "gate" | "raked-left" | "raked-right" | "custom";

// Colours MATCH the elevation renderer (fence-visualization.tsx) exactly, so the
// "+ add" card icons read as the same object the user sees drawn in the elevation:
// standard = blue, gate = violet, raked = amber, custom = peach.
const FILL: Record<PanelVariant, string> = {
  standard: "#d9e8f5",
  gate: "#d4c5f9",
  "raked-left": "#f7ecc3",
  "raked-right": "#f7ecc3",
  custom: "#f9d5c5",
};
const STROKE: Record<PanelVariant, string> = {
  standard: "#b8d4e8",
  gate: "#b8a4e8",
  "raked-left": "#e3d194",
  "raked-right": "#e3d194",
  custom: "#fdba74",
};

/**
 * Lightweight SVG of a glass panel on two spigot feet — the visual token used in
 * the add-on "+ add" cards (gate / raked / custom) and the rake sub-cards. The
 * geometry and colours mirror the elevation renderer: gates carry hinge + latch
 * blocks, rakes have the flat top section sloping down to standard panel height.
 */
export function PanelThumb({
  variant = "standard",
  label,
  sub,
  className,
}: {
  variant?: PanelVariant;
  label?: string;
  sub?: string;
  className?: string;
}) {
  // Rakes: tall edge with a flat top section, sloping down to standard height on
  // the other side (matches the elevation's left/right raked drawing).
  // Others: simple rectangle.
  const panel =
    variant === "raked-left"
      ? "M16,10 L34,10 L84,30 L84,84 L16,84 Z"
      : variant === "raked-right"
        ? "M16,30 L66,10 L84,10 L84,84 L16,84 Z"
        : "M16,8 L84,8 L84,84 L16,84 Z";
  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", className)} role="img" aria-label={label || variant}>
      <path d={panel} fill={FILL[variant]} stroke={STROKE[variant]} strokeWidth="1.5" />
      {/* Gates carry the same hardware cues as the elevation: 2 hinge blocks on the
          hinge edge + 1 latch block on the opposite edge. Gates HANG from their
          hinges — no spigots under a gate (matches the elevation). */}
      {variant === "gate" ? (
        <>
          <rect x="16" y="18" width="7" height="9" fill="#475569" />
          <rect x="16" y="62" width="7" height="9" fill="#475569" />
          <rect x="77" y="22" width="7" height="9" fill="#475569" />
        </>
      ) : (
        <>
          {/* Spigots CLAMP the glass — drawn over the bottom edge of the panel
              (glass sits down into the spigot jaws), not as feet underneath it. */}
          <rect x="24" y="74" width="6" height="21" rx="1" fill="#9ca3af" />
          <rect x="70" y="74" width="6" height="21" rx="1" fill="#9ca3af" />
        </>
      )}
      {label && (
        <text x="50" y="50" textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{label}</text>
      )}
      {sub && (
        <text x="50" y="62" textAnchor="middle" fontSize="7.5" fill="#64748b">{sub}</text>
      )}
    </svg>
  );
}
