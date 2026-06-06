/**
 * Slot-driven BOM emitter for glass-pool-spigots — implements the emission map
 * (verticals/barrier-hub/calculator/style-validation/glass-pool-spigots-emission-map.md)
 * entirely via resolveSlot() against the operator-curated catalogue. NO hardcoded SKUs,
 * NO guesses: every line resolves from the slot table or surfaces a visible [UNMAPPED] gap.
 *
 * Not yet wired into calculateComponents — proven in isolation first
 * (scripts/verify-pool-spigots-emit.ts), then dispatched.
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-pool-spigots";

export type BomLine = { qty: number; description: string; sku: string };

// ---- input-token → catalogue mappings ----
const FAMILY_CS1: Record<string, string> = {
  "madrid-pool": "Spigot-Madrid Pool",
  madrid: "Spigot-Madrid",
  insuluxe: "Spigot-Insuluxe",
  rio: "Spigot-Rio",
  lifestyle: "Spigot-Lifestyle-Square",
};
// Madrid Pool borrows Madrid's dress rings / domical / insulating covers.
const COVER_CS1: Record<string, string> = { ...FAMILY_CS1, "madrid-pool": "Spigot-Madrid" };
const MOUNT_CS2: Record<string, string> = { "base-plate": "Base Plate", "core-drilled": "Core Drilled" };

/** finish token → catalogue suffix code (White is `W` for Insuluxe, `MW` elsewhere). */
function finishCode(family: string, token: string): string {
  // Insuluxe is a polymer spigot stocked ONLY in Black / Silver-Grey / White — it has no
  // polished or satin tier, so both collapse to Silver-Grey (matches the catalogue + the old
  // solver). Without this, an (unscoped) UI finish pick of polished/satin → an UNMAPPED spigot.
  if (family === "insuluxe") {
    if (token === "black") return "B";
    if (token === "white") return "W";
    return "SG"; // polished / satin / silver-grey all map to the only stocked tier
  }
  switch (token) {
    case "silver-grey": return "SG";
    case "polished": return "P";
    case "satin": return "S";
    case "black": return "B";
    case "white": return "MW";
    default: return token.toUpperCase();
  }
}

type SpanLike = any;
type DesignLike = any;

function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) {
    if (span[k] != null && span[k] !== "") return String(span[k]);
    if (fv[k] != null && fv[k] !== "") return String(fv[k]);
  }
  return undefined;
}
const truthy = (v: string | undefined) => v != null && ["true", "1", "yes", "on"].includes(String(v).toLowerCase());

/**
 * Emit the full glass-pool-spigots BOM for one span. `unmapped` collects any miss so the
 * caller can surface it loudly rather than ship a guessed SKU.
 */
export function emitGlassPoolSpigotsSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;

  const panels: number[] = layout.panels;
  const panelTypes: string[] = layout.panelTypes || [];

  const mounting = fieldOf(span, "spigotMounting", "spigot-mounting") || "base-plate";
  const family = fieldOf(span, "spigot-family") || "madrid-pool";
  const colorToken = fieldOf(span, "spigotColor", "spigot-color") || "polished";
  const coverChoice = fieldOf(span, "spigotCover", "spigot-cover"); // dress-flat|dress-raised|dome-slim|dome-high
  const as3000 = truthy(fieldOf(span, "as3000", "as-3000", "as3000-toggle"));
  const fin = finishCode(family, colorToken);
  const famCs1 = FAMILY_CS1[family];
  const coverCs1 = COVER_CS1[family];
  const mountCs2 = MOUNT_CS2[mounting] || "Base Plate";

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };

  // Gate hinges/latches DON'T share the spigot's finish-code convention: Master hinges are
  // coded BLK (not B) and Atlantic soft-close hardware is coded W for white (not MW). Try the
  // catalogue's plausible finish codes for the chosen colour in order and take the first that
  // resolves — robust to the per-brand coding differences in the operator sheet.
  const HW_FINISH_TRY: Record<string, string[]> = {
    black: ["B", "BLK"], white: ["MW", "W"], polished: ["P"], satin: ["S"], "silver-grey": ["SG"],
  };
  const wantHardware = (label: string, base: any, color: string): void => {
    const tries = HW_FINISH_TRY[color] || [finishCode(family, color)];
    for (const f of tries) {
      const m = resolveSlot(STYLE, { ...base, finish: f });
      if (m && m.category_slug) { out.push({ qty: base.__qty ?? 1, description: m.description || m.sku, sku: m.sku }); return; }
    }
    unmapped.push(`${label} [${JSON.stringify({ ...base, finish: tries.join("|"), __qty: undefined })}]`);
  };

  // count non-gate panels (spigots are 2 per panel, gate excluded)
  let nonGatePanels = 0;

  panels.forEach((width: number, i: number) => {
    const type = panelTypes[i] || "standard";
    if (type === "standard") {
      want(`panel ${width}`, { cs1: "Standard Panel", size_mm: width, snapSize: true });
    } else if (type === "raked") {
      const isLeft = i === 0 && span.leftRakedPanel?.enabled;
      const h = (isLeft ? span.leftRakedPanel?.height : span.rightRakedPanel?.height) ?? 1500;
      want(`raked ${h}`, { cs1: "Raked Panel", size_mm: h, snapSize: true });
    } else if (type === "hinge") {
      const soft = (span.gateConfig?.hardware || "polaris") !== "master";
      want(`hinge panel ${width}`, { cs1: soft ? "Soft Close Gate" : "Master Gate", cs2: "Hinge Panel", cs3: "", size_mm: width, snapSize: true });
    } else if (type === "gate") {
      const master = (span.gateConfig?.hardware || "polaris") === "master";
      const g2g = (span.gateConfig?.hingeType || "glass-to-glass") === "glass-to-glass";
      if (master) want(`gate ${width}`, { cs1: "Master Gate", cs2: "Gate Panel", cs3: "", size_mm: width, snapSize: true });
      else want(`gate ${width}`, { cs1: "Soft Close Gate", cs2: "Gate Panel", cs3: g2g ? "Glass to Glass" : "Glass to Wall/Post", size_mm: width, snapSize: true });
    }

    if (type !== "gate") nonGatePanels++;
  });

  // ---- Spigots: 2 per non-gate panel ----
  const spigotQty = nonGatePanels * 2;
  if (spigotQty > 0) {
    if (as3000 && family === "insuluxe") {
      want("spigot", { cs1: famCs1, cs2: mountCs2, cs3: "", finish: fin, __qty: spigotQty });
    } else if (as3000 && (family === "madrid-pool" || family === "madrid")) {
      // hidden spigot defaults to cheapest polished Madrid Pool (cost lever)
      want("spigot(as3000 hidden)", { cs1: "Spigot-Madrid Pool", cs2: mountCs2, cs3: "", finish: "P", __qty: spigotQty });
    } else {
      want("spigot", { cs1: famCs1, cs2: mountCs2, cs3: "", finish: fin, __qty: spigotQty });
    }

    // ---- Covers: 1 per spigot, except Lifestyle base-plate (bundled) ----
    const isLifestyleBaseBundled = family === "lifestyle" && mounting === "base-plate";
    if (as3000 && (family === "madrid-pool" || family === "madrid")) {
      // insulating cover replaces the normal cover; finish defaults Black
      want("insulating cover", { cs1: "Spigot-Madrid", cs2: mountCs2, cs3: "Insulating Cover", finish: "B", __qty: spigotQty });
    } else if (!isLifestyleBaseBundled) {
      if (mounting === "core-drilled") {
        const raised = coverChoice === "dress-raised";
        want("dress ring", { cs1: coverCs1, cs2: "Dress Ring", cs3: raised ? "Raised" : "", finish: fin, __qty: spigotQty });
      } else {
        const slim = coverChoice === "dome-slim";
        want("domical cover", { cs1: coverCs1, cs2: slim ? "Domical Cover Slim" : "Domical Cover", cs3: "", finish: fin, __qty: spigotQty });
      }
    }
  }

  // ---- Gate hardware: hinge + latch (+ square-post adapter) ----
  if (span.gateConfig?.required) {
    const master = (span.gateConfig.hardware || "polaris") === "master";
    const hingeMount = (span.gateConfig.hingeType || "glass-to-glass") === "glass-to-glass" ? "Glass to Glass" : "Post/Wall";
    // Latch mount maps 1:1 to the catalogue cs3 — NOT a binary g2g/else collapse, which sent
    // Corner In/Out AND Glass-to-Wall all to the wall latch. (Glass-to-Wall → "Post/Wall".)
    const LATCH_MOUNT: Record<string, string> = {
      "glass-to-glass": "Glass to Glass", "glass-to-wall": "Post/Wall",
      "corner-out": "Corner Out", "corner-in": "Corner In",
    };
    const latchMount = LATCH_MOUNT[span.gateConfig.latchType || "glass-to-glass"] || "Glass to Glass";
    // soft-close default brand = Atlantic
    const hingeBrand = master ? "Master" : (fieldOf(span, "hinge-brand") === "polaris" ? "Soft Close - Polaris" : "Soft Close - Atlantic");
    const latchBrand = master ? "Master" : "Atlantic";
    wantHardware("hinge", { cs1: "Hinge", cs2: hingeBrand, cs3: hingeMount }, colorToken);
    wantHardware("latch", { cs1: "Latch", cs2: latchBrand, cs3: latchMount }, colorToken);
  }

  // ---- Fixings / grout (per substrate × mounting; §6) ----
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate");
  if (spigotQty > 0) {
    if (mounting === "core-drilled") {
      const bags = Math.ceil(spigotQty / 10);
      out.push({ qty: bags, description: "Fast Setting Pourable Grout - 10kg bag", sku: "GROUT-SETFAST-10KG" });
    } else if (substrate === "concrete") {
      out.push({ qty: spigotQty, description: "M10 x 120mm concrete threaded rods (4-pack)", sku: "S-120ROD-4PK" });
      out.push({ qty: Math.ceil(spigotQty / 20), description: "Soudal CA1400 Chemical Anchor — 400ml", sku: "SOUD-CA1400" });
    } else if (substrate === "timber") {
      const fixing = (fieldOf(span, "fixing-method", "fixingMethod") || "lag").toLowerCase();
      if (fixing === "csk") out.push({ qty: spigotQty, description: "100mm countersunk screw (4-pack)", sku: "CSK-100-4PK" });
      else out.push({ qty: spigotQty, description: "M10 x 110mm timber lag screws SS316 (4-pack)", sku: "S-110LAG-4PK" });
    }
    // steel → customer-supplied (no emission)
  }

  return out;
}
