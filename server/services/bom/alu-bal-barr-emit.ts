/**
 * Slot-driven BOM emitter for alu-bal-barr (BARR aluminium balustrade). Panels + brackets/covers,
 * substrate-driven AIRE posts (base-plated / core-drilled / face-mounted) + covers, fixings. No
 * gates (balustrade). All SKUs resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "alu-bal-barr";
export type BomLine = { qty: number; description: string; sku: string };

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitAluBalBarrSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
  const out: BomLine[] = [];
  const layout = span.panelLayout;
  if (!layout?.panels?.length) return out;
  const panels: number[] = layout.panels;

  const want = (label: string, q: any): void => {
    const m = resolveSlot(STYLE, q);
    if (m && m.category_slug) out.push({ qty: q.__qty ?? 1, description: m.description || m.sku, sku: m.sku });
    else unmapped.push(`${label} [${JSON.stringify({ ...q, __qty: undefined })}]${m && !m.category_slug ? ` (${m.sku} UNPLACED)` : ""}`);
  };

  const ff = (fieldOf(span, "balBarrFinish", "bal-finish", "barrFinish") || "black").toLowerCase();
  const code = ff === "white" || ff.startsWith("pearl") ? "W" : ff === "monument" ? "MN" : "B";
  const substrate = fieldOf(span, "bal-substrate") || "base-plated";
  const basePlated = substrate === "base-plated";
  const coreDrilled = substrate === "core-drilled";
  const faceMounted = substrate === "face-mounted" || substrate === "side-mounted";
  const material = fieldOf(span, "bal-material") || "timber"; // matches the UI's displayed default

  // panels + brackets + bracket covers
  const n = panels.length;
  for (const _w of panels) want("panel", { cs1: "panel", cs2: "", cs3: "", finish: code });
  want("brackets", { cs1: "bbrackets to attach panels to posts", cs2: "", cs3: "", finish: code, __qty: n });
  want("bracket covers", { cs1: "bracket covers", cs2: "", cs3: "", finish: code, __qty: n });

  const posts = n + 1; // inline balustrade (corners shared)

  if (faceMounted) {
    const mid = Math.max(0, n - 1);
    const facePosts = mid + 2;
    if (mid > 0) want("side-mount mid", { cs1: "side mount post mid post", cs2: "", cs3: "", finish: code, __qty: mid });
    want("side-mount end pack", { cs1: "side mount post l&r pack", cs2: "", cs3: "", finish: code });
    want("side-mount dome nut", { cs1: "pair with side mount post fixings 4x per 4 pack", cs2: "", cs3: "", finish: "", __qty: facePosts });
    if (material === "timber") want("side-mount timber fixing", { cs1: "Side mount post for timber", cs2: "", cs3: "", finish: "", __qty: facePosts });
    else want("side-mount concrete fixing", { cs1: "Side mount post for concrete", cs2: "", cs3: "", finish: "", __qty: facePosts });
  } else if (basePlated) {
    want("base post", { cs1: "base plated post", cs2: "", cs3: "", finish: code, __qty: posts });
    want("domical cover", { cs1: "domical cover", cs2: "", cs3: "", finish: code, __qty: posts });
    if (material === "timber") want("timber fixing", { cs1: "timber fixing base plated", cs2: "", cs3: "", finish: "", __qty: posts });
  } else if (coreDrilled) {
    want("core post", { cs1: "core drill and inground posts", cs2: "", cs3: "", finish: code, __qty: posts });
    want("dress ring", { cs1: "dress ring used for core drilled posts", cs2: "", cs3: "", finish: code, __qty: posts });
    want("grout", { cs1: "core dilled posts", cs2: "", cs3: "", finish: "", __qty: Math.ceil(posts / 15) + 1 });
  }

  return out;
}
