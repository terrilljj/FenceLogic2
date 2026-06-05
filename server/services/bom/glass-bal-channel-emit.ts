/**
 * Slot-driven BOM emitter for glass-bal-channel (15mm). VersaTilt channel system + 35-Series
 * top rail, no gates/spigots (balustrade, channel-glazed). All SKUs resolve from the curated
 * catalogue; a miss → [UNMAPPED].
 */
import { resolveSlot } from "../slots/catalogue-slots";

const STYLE = "glass-bal-channel";
export type BomLine = { qty: number; description: string; sku: string };
const CHANNEL_STOCK = 4200;
const INFILL_CS1 = "required this is a 300mm piece of infill rubber that is inserted to the top of the channel to cover the gap between panels, user custs to size allow 1 piece per 5 glass gaps";

type SpanLike = any; type DesignLike = any;
function fieldOf(span: SpanLike, ...keys: string[]): string | undefined {
  const fv = span.fieldValues || {};
  for (const k of keys) { if (span[k] != null && span[k] !== "") return String(span[k]); if (fv[k] != null && fv[k] !== "") return String(fv[k]); }
  return undefined;
}
function railFinish35(token: string): string { return ({ polished: "SA", satin: "SA", black: "B", white: "MW" } as Record<string, string>)[token] || "SA"; }
const RAIL_FALLBACK = ["SA", "S", "MW", "B"];

export function emitGlassBalChannelSpan(design: DesignLike, span: SpanLike, unmapped: string[]): BomLine[] {
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

  // panels (channel-glazed, no spigots)
  for (const w of panels) want(`panel ${w}`, { cs1: "Standard Panels", size_mm: w, snapSize: true });

  // VersaTilt channel system
  const chFin = (fieldOf(span, "channel-finish") === "black") ? "B" : "SA";
  const runMm = layout.totalPanelWidth || panels.reduce((a, b) => a + b, 0) || span.length || 0;
  const channels = Math.max(1, Math.ceil(runMm / CHANNEL_STOCK));
  want("channel kit", { cs1: "Channel", cs2: "", cs3: "", finish: chFin, __qty: channels });
  want("glazing rubber kit", { cs1: "1 kit req per length of channel", cs2: "", cs3: "", finish: "", __qty: channels });
  want("end plate", { cs1: "End Plate", cs2: "", cs3: "", finish: chFin });
  want("stabilising washer", { cs1: "Stabiling Washer", cs2: "", cs3: "", finish: "", __qty: channels });
  const plates = panels.reduce((sum, w) => sum + (Math.ceil((w - 150) / 300) + 1), 0);
  if (plates > 0) want("friction plate", { cs1: "friction plate", cs2: "", cs3: "", finish: "", __qty: plates });
  const pins = 2 * Math.max(0, channels - 1);
  if (pins > 0) want("joining pins", { cs1: "Joining Pins", cs2: "", cs3: "", finish: "", __qty: Math.ceil(pins / 10) });
  const gaps = Math.max(0, panels.length - 1);
  if (gaps > 0) want("infill rubber", { cs1: INFILL_CS1, cs2: "", cs3: "", finish: "", __qty: Math.ceil(gaps / 5) });
  const substrate = fieldOf(span, "spigotSubstrate", "spigot-substrate", "channel-substrate");
  if (substrate === "timber") want("timber fixing", { cs1: "Timber Fixing", cs2: "", cs3: "", finish: "", __qty: channels });
  else want("concrete fixing", { cs1: "Concrete Fixing", cs2: "", cs3: "", finish: "", __qty: channels });

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
