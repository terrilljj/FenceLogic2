import { cn } from "@/lib/utils";

export type PanelVariant = "standard" | "gate" | "raked-left" | "raked-right" | "custom";

const FILL: Record<PanelVariant, string> = {
  standard: "#bfdbfe",
  gate: "#ddd6fe",
  "raked-left": "#cfe3fb",
  "raked-right": "#cfe3fb",
  custom: "#fed7c3",
};
const STROKE: Record<PanelVariant, string> = {
  standard: "#93c5fd",
  gate: "#c4b5fd",
  "raked-left": "#93c5fd",
  "raked-right": "#93c5fd",
  custom: "#fdba74",
};

/**
 * Lightweight SVG of a glass panel on two spigot feet — the visual token used in
 * the add-on "+ add" cards (gate / raked / custom) and the rake sub-cards. Colour
 * by variant matches the operator mockups (gate = violet, raked = sky, custom =
 * peach). Raked variants angle the top edge. Placeholder until real product art.
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
  const topLeftY = variant === "raked-right" ? 30 : 8;
  const topRightY = variant === "raked-left" ? 30 : 8;
  const panel = `M16,${topLeftY} L84,${topRightY} L84,84 L16,84 Z`;
  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", className)} role="img" aria-label={label || variant}>
      <path d={panel} fill={FILL[variant]} stroke={STROKE[variant]} strokeWidth="1.5" />
      <rect x="24" y="84" width="6" height="11" rx="1" fill="#9ca3af" />
      <rect x="70" y="84" width="6" height="11" rx="1" fill="#9ca3af" />
      {label && (
        <text x="50" y="50" textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">{label}</text>
      )}
      {sub && (
        <text x="50" y="62" textAnchor="middle" fontSize="7.5" fill="#64748b">{sub}</text>
      )}
    </svg>
  );
}
