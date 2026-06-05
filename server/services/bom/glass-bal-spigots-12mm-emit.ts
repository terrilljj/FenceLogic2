/**
 * Slot-driven BOM emitter for glass-bal-spigots-12mm — implements the inputs-spec
 * (verticals/barrier-hub/calculator/style-validation/glass-bal-spigots-12mm-calculator-inputs-spec.md)
 * via resolveSlot() against the curated catalogue. Reuses the pool spigot/cover pattern and
 * adds the balustrade top-rail + terminator system. No gates (balustrade). No guesses — a miss
 * surfaces a visible [UNMAPPED] line.
 *
 * Per-family rail labels are read AS the operator tagged them (they differ between the two rail
 * families and carry a couple of typos — "Domimical", "wall shroud offest" — mapped here rather
 * than re-cleaned in the sheet).
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-bal-spigots-12mm";
export type BomLine = { qty: number; description: string; sku: string };

const MOUNT_CS2: Record<string, string> = { "base-plate": "Base Plate", "core-drilled": "Core Drilled" };
function familyCs1(token: string): string { return token.toLowerCase().includes("nova") ? "Spigot-Nova" : "Spigot-Madrid"; }
function finishCode(token: string): string {
  switch (token) { case "polished": return "P"; case "satin": return "S"; case "black": return "B"; case "white": return "MW"; default: return token.toUpperCase(); }
}

// Rail family label maps (exact operator calslot_2 strings, per family).
type RailMap = { cs1: string; rail: string; rubber: string; rubberPerRail: number; inline: string; corner90: string; adjustable: string; endcap: string; wall: string; joinersSA: boolean };
const RAIL_35: RailMap = { cs1: "Rail 35 Series", rail: "Rail", rubber: "rail rubber 1 per length", rubberPerRail: 1, inline: "joiner inline", corner90: "joiner corner 90 degree", adjustable: "joiner vertical adjustable", endcap: "end cap", wall: "wall shroud", joinersSA: true };
const RAIL_NANO: RailMap = { cs1: "RAIL 25x21", rail: "RAIL", rubber: "rail rubber 2 per 5.8m length of rail", rubberPerRail: 2, inline: "inline joiner", corner90: "corner", adjustable: "horizontal adjustable", endcap: "end cap", wall: "wall shroud", joinersSA: false };
function railMapFor(type: string): RailMap { return type === "series-35x35" ? RAIL_35 : RAIL_NANO; }
// Spigot finish -> rail finish (inputs-spec). 35 Series has no Polished -> Satin-Anodised substitute.
function railFinish(map: RailMap, spigotFinishToken: string): string {
  if (map === RAIL_35) return ({ polished: "SA", satin: "SA", black: "B", white: "MW" } as Record<string, string>)[spigotFinishToken] || "SA";
  return ({ polished: "P", satin: "S", black: "B", white: "MW" } as Record<string, string>)[spigotFinishToken] || "P";
}
const FINISH_FALLBACK: Record<"35" | "nano", string[]> = { "35": ["SA", "S", "MW", "B"], nano: ["P", "S", "B", "MW"] };

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitGlassBalSpigots12mmSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;

  const mounting = fieldOf(span, "spigotMounting", "spigot-mounting") || "base-plate";
  const familyToken = fieldOf(span, "spigot-family") || "nova";
  const colorToken = fieldOf(span, "spigotColor", "spigot-color") || "polished";
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate");
  const fixing = (fieldOf(span, "fixing-method", "fixingMethod") || "lag").toLowerCase();
  const fin = finishCode(colorToken);
  const famCs1 = familyCs1(familyToken);
  const mountCs2 = MOUNT_CS2[mounting] || "Base Plate";

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };
  // resolve a rail component, trying the matched finish then the family fallback order
  const wantRail = (label: string, cs1: string, cs2: string, preferred: string, order: string[], qty: number): void => {
    for (const f of [preferred, ...order]) {
      const m = resolveSlot(STYLE, { cs1, cs2, cs3: "", finish: f });
      if (m && m.category_slug) { out.push({ qty, description: m.description || m.sku, sku: m.sku }); return; }
    }
    unmapped.push(`${label} [${cs1} / ${cs2} / finish~${preferred}]`);
  };

  // ---- Panels (all standard glass) + spigots (2/panel) + covers (fixing-driven) ----
  for (const w of panels) want(`panel ${w}`, { cs1: "Standard Glass Panel", size_mm: w, snapSize: true });
  const spigotQty = panels.length * 2;
  if (spigotQty > 0) {
    want("spigot", { cs1: famCs1, cs2: mountCs2, cs3: "", finish: fin, __qty: spigotQty });
    // cover: core-drill -> dress ring; base-plate -> slim (CSK) else high (lag/rod/steel protrude)
    if (mounting === "core-drilled") {
      want("dress ring", { cs1: famCs1, cs2: "Dress Ring", cs3: "", finish: fin, __qty: spigotQty });
    } else {
      const slim = fixing === "csk";
      want("domical cover", { cs1: famCs1, cs2: slim ? "Domimical Cover Slim" : "Domical High", cs3: "", finish: fin, __qty: spigotQty });
    }
    // ---- Fixings / grout (per substrate × mounting) — blank-calslot SKUs, placed ----
    if (mounting === "core-drilled") {
      out.push({ qty: Math.ceil(spigotQty / 10), description: "Fast Setting Pourable Grout - 10kg bag", sku: "GROUT-SETFAST-10KG" });
    } else if (substrate === "concrete") {
      out.push({ qty: spigotQty, description: "M10 x 120mm concrete threaded rods (4-pack)", sku: "S-120ROD-4PK" });
      out.push({ qty: Math.ceil(spigotQty / 20), description: "Soudal CA1400 Chemical Anchor — 400ml", sku: "SOUD-CA1400" });
    } else if (substrate === "timber") {
      if (fixing === "csk") out.push({ qty: spigotQty, description: "100mm countersunk screw (4-pack)", sku: "CSK-100-4PK" });
      else out.push({ qty: spigotQty, description: "M10 x 110mm timber lag screws SS316 (4-pack)", sku: "S-110LAG-4PK" });
    }
    // steel → customer-supplied (no emission)
  }

  // ---- Top rail (per section) ----
  const hr = span.handrail;
  if (hr?.enabled) {
    const map = railMapFor(hr.type);
    const ford = map === RAIL_35 ? FINISH_FALLBACK["35"] : FINISH_FALLBACK.nano;
    const rf = railFinish(map, hr.finish || colorToken);
    const saOr = (f: string) => (map.joinersSA ? "SA" : f); // 35 Series joiners are SA-only
    const rails = Math.max(1, Math.ceil((span.length || 0) / 5800));

    wantRail("rail length", map.cs1, map.rail, rf, ford, rails);
    want("rail rubber", { cs1: map.cs1, cs2: map.rubber, cs3: "", finish: "", __qty: rails * map.rubberPerRail }); // finish-neutral
    if (rails > 1) wantRail("inline joiner", map.cs1, map.inline, saOr(rf), ford, rails - 1);

    for (const term of [hr.startTermination, hr.endTermination]) {
      if (!term) continue;
      if (term === "wall-tie") wantRail("wall shroud", map.cs1, map.wall, rf, ford, 1);
      else if (term === "end-cap") wantRail("end cap", map.cs1, map.endcap, rf, ford, 1);
      else if (term === "90-degree") wantRail("90° corner", map.cs1, map.corner90, saOr(rf), ford, 1);
      else if (term === "adjustable-corner") wantRail("adjustable corner", map.cs1, map.adjustable, saOr(rf), ford, 1);
    }
  }

  return out;
}
