/**
 * Slot-driven BOM emitter for glass-bal-standoffs. Standoff hardware (adjustable/fixed × depth)
 * at 4 per panel + 35-Series top rail, no gates/spigots. All SKUs resolve from the curated
 * catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-bal-standoffs";
export type BomLine = { qty: number; description: string; sku: string };
const STANDOFFS_PER_PANEL = 4; // standoff-bal spec: 4 (or 6) fixings per panel; V1 = 4

const STANDOFF_CS1: Record<string, string> = {
  "adjustable-30": "standoff adjustable 30mm depth",
  "adjustable-45": "standoff adjustable 45mm depth",
  "fixed-30": "standoff fixed 30mm depth",
  "fixed-50": "standoff fixed 50mm depth",
};
function finishCode(token: string): string {
  switch (token) { case "polished": return "P"; case "satin": return "S"; case "black": return "B"; case "white": return "MW"; default: return token.toUpperCase(); }
}
function railFinish35(token: string): string { return ({ polished: "SA", satin: "SA", black: "B", white: "MW" } as Record<string, string>)[token] || "SA"; }
const RAIL_FALLBACK = ["SA", "S", "MW", "B"];

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitGlassBalStandoffsSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };
  const wantRail = (label: string, cs2: string, preferred: string, qty: number): void => {
    for (const f of [preferred, ...RAIL_FALLBACK]) {
      const m = resolveSlot(STYLE, { cs1: "Rail 35 Series", cs2, cs3: "", finish: f });
      if (m && m.category_slug) { out.push({ qty, description: m.description || m.sku, sku: m.sku }); return; }
    }
    unmapped.push(`${label} [Rail 35 Series / ${cs2} / finish~${preferred}]`);
  };

  // panels
  for (const w of panels) want(`panel ${w}`, { cs1: "glass panels", size_mm: w, snapSize: true });

  // standoff hardware — 4 per panel; finish falls back to "" for finish-limited (fixed) types
  const stType = STANDOFF_CS1[fieldOf(span, "standoff-type") || "adjustable-30"] || STANDOFF_CS1["adjustable-30"];
  const stFin = finishCode(fieldOf(span, "standoffFinish", "standoff-finish", "spigotColor") || "polished");
  const stQty = panels.length * STANDOFFS_PER_PANEL;
  if (stQty > 0) {
    let placed = false;
    for (const f of [stFin, ""]) {
      const m = resolveSlot(STYLE, { cs1: stType, cs2: "", cs3: "", finish: f });
      if (m && m.category_slug) { out.push({ qty: stQty, description: m.description || m.sku, sku: m.sku }); placed = true; break; }
    }
    if (!placed) unmapped.push(`standoff [${stType} / finish~${stFin}]`);
  }

  // fixings (per substrate)
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate");
  if (substrate === "timber") out.push({ qty: stQty, description: "M10 x 110mm timber lag screws SS316 (4-pack)", sku: "S-110LAG-4PK" });
  else out.push({ qty: Math.ceil(stQty / 20), description: "Soudal CA1400 Chemical Anchor — 400ml", sku: "SOUD-CA1400" });

  // 35-Series top rail
  const hr = span.handrail;
  if (hr?.enabled) {
    const rf = railFinish35(hr.finish || "satin");
    const rails = Math.max(1, Math.ceil((span.length || 0) / 5800));
    wantRail("rail length", "Rail", rf, rails);
    if (rails > 1) wantRail("inline joiner", "inline joiner", "SA", rails - 1);
    for (const term of [hr.startTermination, hr.endTermination]) {
      if (!term) continue;
      if (term === "wall-tie") wantRail("wall shroud", "wall shroud", rf, 1);
      else if (term === "end-cap") wantRail("end cap", "end cap", rf, 1);
      else if (term === "90-degree") wantRail("90° corner", "90 deg corner joiner", "SA", 1);
      else if (term === "adjustable-corner") wantRail("adjustable corner", "vertical joiner", "SA", 1);
    }
  }

  return out;
}
