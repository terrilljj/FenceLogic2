/**
 * Slot-driven BOM emitter for glass-bal-spigots-15mm. Same shape as the 12mm sibling but:
 * single family (Madrid Deluxe), 35-Series rail only (no Nanorail, no separate rubber row),
 * and the operator's 15mm calslot labels ("Base Plated", "Domical Cover High", "Standard
 * Panels", etc.). All SKUs resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-bal-spigots-15mm";
export type BomLine = { qty: number; description: string; sku: string };

const FAMILY_CS1 = "Spigot Madrid Deluxe"; // 15mm bal is Madrid Deluxe only
const MOUNT_CS2: Record<string, string> = { "base-plate": "Base Plated", "core-drilled": "Core Drilled" };
function finishCode(token: string): string {
  switch (token) { case "polished": return "P"; case "satin": return "S"; case "black": return "B"; case "white": return "MW"; default: return token.toUpperCase(); }
}
// 35-Series rail finish auto-match (no Polished -> Satin-Anodised); joiners are SA-only.
function railFinish35(token: string): string { return ({ polished: "SA", satin: "SA", black: "B", white: "MW" } as Record<string, string>)[token] || "SA"; }
const RAIL_FALLBACK = ["SA", "S", "MW", "B"];

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitGlassBalSpigots15mmSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;

  const mounting = fieldOf(span, "spigotMounting", "spigot-mounting") || "base-plate";
  const colorToken = fieldOf(span, "spigotColor", "spigot-color") || "polished";
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate");
  const fixing = (fieldOf(span, "fixing-method", "fixingMethod") || "lag").toLowerCase();
  const fin = finishCode(colorToken);
  const mountCs2 = MOUNT_CS2[mounting] || "Base Plated";

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

  // panels + spigots (2/panel) + covers (fixing-driven)
  for (const w of panels) want(`panel ${w}`, { cs1: "Standard Panels", size_mm: w, snapSize: true });
  const spigotQty = panels.length * 2;
  if (spigotQty > 0) {
    want("spigot", { cs1: FAMILY_CS1, cs2: mountCs2, cs3: "", finish: fin, __qty: spigotQty });
    if (mounting === "core-drilled") {
      want("dress ring", { cs1: FAMILY_CS1, cs2: "Dress Ring", cs3: "", finish: fin, __qty: spigotQty });
    } else {
      want("domical cover", { cs1: FAMILY_CS1, cs2: fixing === "csk" ? "Domical Cover Slim" : "Domical Cover High", cs3: "", finish: fin, __qty: spigotQty });
    }
    // fixings / grout
    if (mounting === "core-drilled") {
      out.push({ qty: Math.ceil(spigotQty / 10), description: "Fast Setting Pourable Grout - 10kg bag", sku: "GROUT-SETFAST-10KG" });
    } else if (substrate === "concrete") {
      out.push({ qty: spigotQty, description: "M10 x 120mm concrete threaded rods (4-pack)", sku: "S-120ROD-4PK" });
      out.push({ qty: Math.ceil(spigotQty / 20), description: "Soudal CA1400 Chemical Anchor — 400ml", sku: "SOUD-CA1400" });
    } else if (substrate === "timber") {
      if (fixing === "csk") out.push({ qty: spigotQty, description: "100mm countersunk screw (4-pack)", sku: "CSK-100-4PK" });
      else out.push({ qty: spigotQty, description: "M10 x 110mm timber lag screws SS316 (4-pack)", sku: "S-110LAG-4PK" });
    } // steel → customer-supplied
  }

  // top rail (35 Series only)
  const hr = span.handrail;
  if (hr?.enabled) {
    const rf = railFinish35(hr.finish || colorToken);
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
