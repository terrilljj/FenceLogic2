/**
 * Slot-driven BOM emitter for alu-pool-blade (Blade aluminium pool fence — Black only). Blade
 * panels + FastFit brackets, substrate-driven posts + covers, in-sheet AIRE side-mount, black
 * D&D gate kit (the gate leaf is a blade panel — no separate gate-panel SKU). Fixings. All SKUs
 * resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "alu-pool-blade";
export type BomLine = { qty: number; description: string; sku: string };

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitAluPoolBladeSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;
  const panelTypes: string[] = layout.panelTypes || [];
  const code = "B"; // Blade is Black-only

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };

  const substrate = fieldOf(span, "blade-substrate") || "decking";
  const basePlated = substrate === "decking" || substrate === "concrete-slab";
  const coreDrilled = substrate === "core-drilled";
  const sideMounted = substrate === "side-mounted";
  const material = fieldOf(span, "blade-material") || "concrete";
  const hasGate = !!span.gateConfig?.required;

  // panels (gate leaf is a blade panel) + FastFit brackets (1 per non-gate panel)
  let nonGatePanels = 0;
  panels.forEach((_w, i) => {
    want("blade panel", { cs1: "blade panel", cs2: "", cs3: "", finish: code });
    if ((panelTypes[i] || "standard") !== "gate") nonGatePanels++;
  });
  if (nonGatePanels > 0) want("panel brackets", { cs1: "panel brackets 4 pack", cs2: "", cs3: "", finish: code, __qty: nonGatePanels });

  const totalPosts = layout.gaps?.length ?? (nonGatePanels + 1);

  // posts
  if (sideMounted) {
    const mid = Math.max(0, panels.length - 1);
    const facePosts = mid + 2;
    if (mid > 0) want("side-mount mid", { cs1: "side mount post mid post", cs2: "", cs3: "", finish: code, __qty: mid });
    want("side-mount end pack", { cs1: "side mount post l&r pack", cs2: "", cs3: "", finish: code });
    want("side-mount dome nut", { cs1: "pair with side mount post fixings 4x per 4 pack", cs2: "", cs3: "", finish: "", __qty: facePosts });
    if (material === "timber") want("side-mount timber fixing", { cs1: "Side mount post for timber", cs2: "", cs3: "", finish: "", __qty: facePosts });
    else want("side-mount concrete fixing", { cs1: "Side mount post for concrete", cs2: "", cs3: "", finish: "", __qty: facePosts });
  } else if (totalPosts > 0) {
    if (basePlated) {
      want("base post", { cs1: "base plated post", cs2: "", cs3: "", finish: code, __qty: totalPosts });
      want("post cover", { cs1: "domical cover for base plated post", cs2: "", cs3: "", finish: code, __qty: totalPosts });
    } else {
      want("core/inground post", { cs1: "core drill and inground posts", cs2: "", cs3: "", finish: code, __qty: totalPosts });
      if (coreDrilled) want("dress ring", { cs1: "dress ring used for core drilled posts", cs2: "", cs3: "", finish: code, __qty: totalPosts });
    }
  }

  // gate (Black D&D kit; gate leaf already counted as a blade panel)
  if (hasGate) want("gate hardware kit", { cs1: "Hinge & Latch kit for monument and black", cs2: "", cs3: "", finish: "" });

  // fixings
  if (substrate === "decking") want("timber fixing", { cs1: "timber fixing base plated", cs2: "", cs3: "", finish: "", __qty: Math.ceil(totalPosts / 4) });
  else if (substrate === "concrete-slab") want("concrete fixing", { cs1: "concrete fixing base plated", cs2: "", cs3: "", finish: "", __qty: Math.ceil(totalPosts / 4) });
  else if (coreDrilled) want("grout", { cs1: "core dilled posts", cs2: "", cs3: "", finish: "", __qty: Math.ceil(totalPosts / 15) + 1 });

  return out;
}
