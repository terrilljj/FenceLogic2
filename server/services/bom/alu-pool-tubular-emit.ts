/**
 * Slot-driven BOM emitter for alu-pool-tubular (Flat Top tubular aluminium pool fence). Panels,
 * substrate-driven posts (base/core/in-ground via this sheet; side-mount via the shared AIRE
 * table), shroud kits, post covers, angle shrouds, finish-asymmetric D&D gate hardware, fixings.
 * All SKUs resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";
import { emitSideMountPosts } from "./side-mount-posts";

const STYLE = "alu-pool-tubular";
export type BomLine = { qty: number; description: string; sku: string };

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}

export function emitAluPoolTubularSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
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

  // finish: white -> W; black/monument -> B (sheet panels are B/W; monument uses black panels + kit)
  const finishToken = fieldOf(span, "tubularFinish", "tubular-finish") || "black";
  const code = finishToken === "white" ? "W" : "B";
  const substrate = fieldOf(span, "tubular-substrate") || "decking";
  const basePlated = substrate === "decking" || substrate === "concrete-slab";
  const coreDrilled = substrate === "core-drilled";
  const sideMounted = substrate === "side-mounted";
  const material = fieldOf(span, "tubular-material") || "concrete";

  // panels (channel-equiv: one panel SKU per non-gate panel)
  let nonGatePanels = 0;
  panels.forEach((_w, i) => { if ((panelTypes[i] || "standard") !== "gate") { want("panel", { cs1: "panel", cs2: "", cs3: "", finish: code }); nonGatePanels++; } });

  const numPosts = layout.gaps?.length ?? (nonGatePanels + 1);
  const angledCorners = parseInt(String(fieldOf(span, "tubular-angled-corners") ?? "0"), 10) || 0;

  // shroud kit (1 per panel) + angle shrouds (4 per angled corner)
  if (nonGatePanels > 0) want("shroud kit", { cs1: "shroud kit 4 pack 1 per panel", cs2: "", cs3: "", finish: code, __qty: nonGatePanels });
  if (angledCorners > 0) want("angle shroud", { cs1: "horizontal angle shrouds option 2 per panel end when there is an angle", cs2: "", cs3: "", finish: code, __qty: angledCorners * 4 });

  // posts
  if (sideMounted) {
    emitSideMountPosts(out, unmapped, { finishCode: code, material, totalPanels: panels.length, corners: angledCorners });
  } else if (numPosts > 0) {
    if (basePlated) {
      want("post", { cs1: "base plated post", cs2: "", cs3: "", finish: code, __qty: numPosts });
      want("post cover", { cs1: "domical cover for base plated post", cs2: "", cs3: "", finish: code, __qty: numPosts });
    } else {
      want("post", { cs1: "core drill and inground posts", cs2: "", cs3: "", finish: code, __qty: numPosts });
      if (coreDrilled) want("dress ring", { cs1: "dress ring used for core drilled posts", cs2: "", cs3: "", finish: code, __qty: numPosts });
    }
  }

  // gate (panel + finish-asymmetric D&D hardware)
  if (span.gateConfig?.required) {
    want("gate panel", { cs1: "Gate Panel", cs2: "", cs3: "", finish: code });
    if (code === "W") {
      want("gate hinge", { cs1: "Hinges to we used on white panels and bundled with white latch", cs2: "", cs3: "", finish: "W" });
      want("gate latch", { cs1: "Latch for white panels to be bundled with white hinges", cs2: "", cs3: "", finish: "W" });
    } else {
      want("gate hardware kit", { cs1: "Hinge & Latch kit for monument and black", cs2: "", cs3: "", finish: "" });
    }
  }

  // fixings (substrate-driven)
  if (substrate === "decking") want("timber fixing", { cs1: "timber fixing", cs2: "", cs3: "", finish: "", __qty: Math.ceil(numPosts / 4) });
  else if (substrate === "concrete-slab") want("concrete fixing", { cs1: "concrete fixing", cs2: "", cs3: "", finish: "", __qty: Math.ceil(numPosts / 4) });
  else if (coreDrilled) want("grout", { cs1: "core dilled posts", cs2: "", cs3: "", finish: "", __qty: Math.ceil(numPosts / 15) + 1 });

  return out;
}
