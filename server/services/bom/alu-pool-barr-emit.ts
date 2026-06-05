/**
 * Slot-driven BOM emitter for alu-pool-barr (BARR aluminium pool fence, 1200mm). Panels + C-
 * brackets/caps per panel, substrate-driven inline posts + covers, cross-range 50×50 posts for
 * corners/gates, in-sheet AIRE side-mount (M10 fixings), finish-asymmetric D&D gate hardware,
 * fixings. All SKUs resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "alu-pool-barr";
export type BomLine = { qty: number; description: string; sku: string };

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitAluPoolBarrSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;
  const panelTypes: string[] = layout.panelTypes || [];

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };

  const code = (fieldOf(span, "barrFinish", "barr-finish") || "satin-black") === "pearl-white" ? "W" : "B";
  const substrate = fieldOf(span, "barr-substrate") || "decking";
  const basePlated = substrate === "decking" || substrate === "concrete-slab";
  const coreDrilled = substrate === "core-drilled";
  const sideMounted = substrate === "side-mounted";
  const material = fieldOf(span, "barr-material") || "concrete";
  const hasGate = !!span.gateConfig?.required;

  // panels + brackets
  let nonGatePanels = 0;
  panels.forEach((_w, i) => { if ((panelTypes[i] || "standard") !== "gate") { want("panel", { cs1: "panel", cs2: "", cs3: "", finish: code }); nonGatePanels++; } });
  if (nonGatePanels > 0) {
    want("panel brackets", { cs1: "panel brackets", cs2: "", cs3: "", finish: code, __qty: nonGatePanels });
    want("bracket caps", { cs1: "bracket caps", cs2: "", cs3: "", finish: code, __qty: nonGatePanels });
  }

  const totalPosts = layout.gaps?.length ?? (nonGatePanels + 1);
  const gatePosts = hasGate ? 2 : 0;
  const inlinePosts = Math.max(0, totalPosts - gatePosts);

  // inline posts
  if (sideMounted) {
    const corners = 0;
    const mid = Math.max(0, panels.length - 1 - corners);
    const facePosts = mid + 2;
    if (mid > 0) want("side-mount mid", { cs1: "side mount post mid post", cs2: "", cs3: "", finish: code, __qty: mid });
    want("side-mount end pack", { cs1: "side mount post l&r pack", cs2: "", cs3: "", finish: code });
    want("side-mount dome nut", { cs1: "pair with side mount post fixings 4x per 4 pack", cs2: "", cs3: "", finish: "", __qty: facePosts });
    if (material === "timber") want("side-mount timber fixing", { cs1: "Side mount post for timber\nSide mount post for con", cs2: "", cs3: "", finish: "", __qty: facePosts });
    else want("side-mount concrete fixing", { cs1: "Side mount post for concrete", cs2: "", cs3: "", finish: "", __qty: facePosts });
  } else if (inlinePosts > 0) {
    if (basePlated) {
      want("base post", { cs1: "base posts", cs2: "", cs3: "", finish: code, __qty: inlinePosts });
      want("domical cover", { cs1: "domical cover", cs2: "", cs3: "", finish: code, __qty: inlinePosts });
    } else {
      want("core/inground post", { cs1: "core and inground posts", cs2: "", cs3: "", finish: code, __qty: inlinePosts });
      if (coreDrilled) want("dress ring", { cs1: "dress ring", cs2: "", cs3: "", finish: code, __qty: inlinePosts });
    }
  }

  // gate — panel + finish-asymmetric D&D hardware + 2 cross-range 50×50 posts
  if (hasGate) {
    want("gate panel", { cs1: "gate panel", cs2: "", cs3: "", finish: code });
    if (code === "W") {
      want("gate hinge", { cs1: "Hinges to we used on white panels and bundled with white latch", cs2: "", cs3: "", finish: "W" });
      want("gate latch", { cs1: "Latch for white panels to be bundled with white hinges", cs2: "", cs3: "", finish: "W" });
    } else {
      want("gate hardware kit", { cs1: "Hinge & Latch kit for monument and black", cs2: "", cs3: "", finish: "" });
    }
    if (!sideMounted) {
      const xCs1 = basePlated ? "base plated post for corners and gates" : "core drill and inground posts for gates and corners";
      want("gate posts (cross-range)", { cs1: xCs1, cs2: "", cs3: "", finish: code, __qty: 2 });
    }
  }

  // fixings
  if (substrate === "decking") want("timber fixing", { cs1: "timber fixing base plated", cs2: "", cs3: "", finish: "", __qty: Math.ceil(totalPosts / 4) });
  else if (coreDrilled) want("grout", { cs1: "core dilled posts", cs2: "", cs3: "", finish: "", __qty: Math.ceil(totalPosts / 15) + 1 });

  return out;
}
