/**
 * Slot-driven BOM emitter for glass-pool-channel. Shares the pool panel/gate/hinge/latch
 * taxonomy with glass-pool-spigots, but replaces spigots+covers with the VersaTilt channel
 * system (channel kit, pressure plates, end plate, joining pins, stabilising washer, top infill
 * rubber, fixing). All SKUs resolve from the curated catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-pool-channel";
export type BomLine = { qty: number; description: string; sku: string };
const CHANNEL_STOCK = 4200; // VersaTilt 4200mm channel stock length

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}
function gateFinishCode(token: string): string {
  return ({ polished: "P", satin: "S", black: "B", white: "MW" } as Record<string, string>)[token] || "P";
}

export function emitGlassPoolChannelSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
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

  // ---- Panels + gate panels (no spigots/covers — channel-glazed) ----
  let glassPanels = 0;
  panels.forEach((width: number, i: number) => {
    const type = panelTypes[i] || "standard";
    if (type === "standard") { want(`panel ${width}`, { cs1: "Standard Panel", size_mm: width, snapSize: true }); glassPanels++; }
    else if (type === "raked") {
      const isLeft = i === 0 && span.leftRakedPanel?.enabled;
      const h = (isLeft ? span.leftRakedPanel?.height : span.rightRakedPanel?.height) ?? 1500;
      want(`raked ${h}`, { cs1: "Raked Panel", size_mm: h, snapSize: true }); glassPanels++;
    } else if (type === "hinge") {
      const soft = (span.gateConfig?.hardware || "polaris") !== "master";
      want(`hinge panel ${width}`, { cs1: soft ? "Soft Close Gate" : "Master Gate", cs2: "Hinge Panel", cs3: "", size_mm: width, snapSize: true });
    } else if (type === "gate") {
      const master = (span.gateConfig?.hardware || "polaris") === "master";
      const g2g = (span.gateConfig?.hingeType || "glass-to-glass") === "glass-to-glass";
      if (master) want(`gate ${width}`, { cs1: "Master Gate", cs2: "Gate Panel", cs3: "", size_mm: width, snapSize: true });
      else want(`gate ${width}`, { cs1: "Soft Close Gate", cs2: "Gate Panel", cs3: g2g ? "Glass to Glass" : "Glass to Wall/Post", size_mm: width, snapSize: true });
    }
  });

  // ---- VersaTilt channel system (per section) ----
  const chFin = (fieldOf(span, "channel-finish") === "black") ? "B" : "SA";
  const runMm = layout.totalPanelWidth || panels.reduce((a, b) => a + b, 0) || span.length || 0;
  const channels = Math.max(1, Math.ceil(runMm / CHANNEL_STOCK));
  want("channel kit", { cs1: "Channel", cs2: "", cs3: "", finish: chFin, __qty: channels });
  want("stabilising washer", { cs1: "Stabiling Washer", cs2: "", cs3: "", finish: "", __qty: channels });
  want("end plate", { cs1: "End Plate", cs2: "", cs3: "", finish: chFin });
  const plates = panels.reduce((sum, w) => sum + (Math.ceil((w - 150) / 300) + 1), 0);
  if (plates > 0) want("pressure plate", { cs1: "Pressure Plate", cs2: "", cs3: "", finish: "", __qty: plates });
  const pins = 2 * Math.max(0, channels - 1);
  if (pins > 0) want("joining pins", { cs1: "Joining Pins", cs2: "", cs3: "", finish: "", __qty: Math.ceil(pins / 10) });
  // top infill rubber — operator rule: 1 piece per 5 glass gaps (inter-panel gaps = panels-1)
  const gaps = Math.max(0, glassPanels - 1);
  if (gaps > 0) want("infill rubber", { cs1: "required this is a 300mm piece of infill rubber that is inserted to the top of the channel to cover the gap between panels, user custs to size allow 1 piece per 5 glass gaps", cs2: "", cs3: "", finish: "", __qty: Math.ceil(gaps / 5) });
  // channel mounting fixing
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate", "channel-substrate");
  if (substrate === "timber") want("timber fixing", { cs1: "Timber Fixing", cs2: "", cs3: "", finish: "", __qty: channels });
  else want("concrete fixing", { cs1: "Concrete Fixing", cs2: "", cs3: "", finish: "", __qty: channels });

  // ---- Gate hardware (hinge + latch) ----
  if (span.gateConfig?.required) {
    const master = (span.gateConfig.hardware || "polaris") === "master";
    const hingeMount = (span.gateConfig.hingeType || "glass-to-glass") === "glass-to-glass" ? "Glass to Glass" : "Post/Wall";
    const latchMount = (span.gateConfig.latchType || "glass-to-glass") === "glass-to-glass" ? "Glass to Glass" : "Post/Wall";
    const gFin = gateFinishCode((span as any).spigotColor || fieldOf(span, "spigot-color") || "polished");
    const hingeBrand = master ? "Master" : (fieldOf(span, "hinge-brand") === "polaris" ? "Soft Close - Polaris" : "Soft Close - Atlantic");
    const latchBrand = master ? "Master" : "Atlantic";
    want("hinge", { cs1: "Hinge", cs2: hingeBrand, cs3: hingeMount, finish: gFin });
    want("latch", { cs1: "Latch", cs2: latchBrand, cs3: latchMount, finish: gFin });
  }

  return out;
}
