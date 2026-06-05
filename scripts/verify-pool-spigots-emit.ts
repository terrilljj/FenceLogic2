/**
 * Proves the slot-driven emitter (server/services/bom/glass-pool-spigots-emit.ts) produces a
 * clean, fully-resolved, fully-placed BOM across a config matrix — using the REAL layout solver.
 * No [UNMAPPED], no unplaced/phantom SKUs = ready to dispatch into calculateComponents.
 * Run: export $(cat .env | xargs) && npx tsx scripts/verify-pool-spigots-emit.ts
 */
import pg from "pg";
import { emitGlassPoolSpigotsSpan } from "../server/services/bom/glass-pool-spigots-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";

const GATE = { required: true, gateSize: 975, hingePanelSize: 0, autoHingePanel: true, position: 0, flipped: false, hingeFrom: "wall" as const };

// valid finish TOKENS per family × mounting (matches the real catalogue matrix)
const FAM = {
  "madrid-pool": { core: ["polished", "satin", "black", "white"], base: ["polished", "satin", "black", "white"] },
  madrid: { core: ["polished", "satin", "white"], base: ["polished", "satin", "black", "white"] },
  rio: { core: ["polished", "satin", "white"], base: ["polished", "satin", "white"] },
  insuluxe: { core: ["black", "silver-grey", "white"], base: ["black", "silver-grey", "white"] },
  lifestyle: { core: ["polished", "satin", "black"], base: ["polished", "satin", "black"] },
} as Record<string, { core: string[]; base: string[] }>;

type Cfg = { label: string; family: string; mounting: string; color: string; cover?: string; gate?: boolean; master?: boolean; raked?: boolean; as3000?: boolean; substrate?: string };
const cfgs: Cfg[] = [];
for (const [family, m] of Object.entries(FAM)) {
  for (const color of m.base) cfgs.push({ label: `${family} base ${color}`, family, mounting: "base-plate", color, cover: "dome-high", substrate: "concrete" });
  for (const color of m.core) cfgs.push({ label: `${family} core ${color}`, family, mounting: "core-drilled", color, cover: "dress-flat" });
}
// special covers + toggles + gates + fixings
cfgs.push(
  { label: "madrid base slim", family: "madrid", mounting: "base-plate", color: "polished", cover: "dome-slim", substrate: "timber" },
  { label: "madrid core raised", family: "madrid", mounting: "core-drilled", color: "polished", cover: "dress-raised" },
  { label: "rio core domed", family: "rio", mounting: "core-drilled", color: "polished", cover: "dress-raised" },
  { label: "AS3000 madrid-pool base", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", as3000: true, substrate: "concrete" },
  { label: "AS3000 madrid-pool core", family: "madrid-pool", mounting: "core-drilled", color: "polished", as3000: true },
  { label: "AS3000 insuluxe base", family: "insuluxe", mounting: "base-plate", color: "black", cover: "dome-high", as3000: true, substrate: "concrete" },
  { label: "gate softclose atlantic", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", gate: true, substrate: "concrete" },
  { label: "gate master", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", gate: true, master: true, substrate: "concrete" },
  { label: "raked", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", raked: true, substrate: "concrete" },
  { label: "timber lag", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", substrate: "timber" },
  { label: "steel", family: "madrid-pool", mounting: "base-plate", color: "polished", cover: "dome-high", substrate: "steel" },
);

(async () => {
  const allSkus = new Set<string>();
  const allUnmapped: string[] = [];
  for (const c of cfgs) {
    const span: any = {
      spanId: "A", length: 6000, maxPanelWidth: 1500, desiredGap: 50,
      spigotMounting: c.mounting, spigotColor: c.color, spigotSubstrate: c.substrate,
      fieldValues: { "spigot-family": c.family, spigotCover: c.cover, as3000: c.as3000 ? "true" : "", "fixing-method": c.substrate === "timber" ? "lag" : "" },
      leftGap: { enabled: true, size: 25 }, rightGap: { enabled: true, size: 25 },
    };
    if (c.gate) span.gateConfig = { ...GATE, hardware: c.master ? "master" : "polaris", hingeType: "glass-to-glass", latchType: "glass-to-glass" };
    if (c.raked) span.rightRakedPanel = { enabled: true, height: 1530 };
    let layout;
    try { layout = computeSpanLayout({ productVariant: "glass-pool-spigots", gatesAllowed: true, span }); }
    catch (e: any) { allUnmapped.push(`${c.label}: LAYOUT ${e.message}`); continue; }
    span.panelLayout = layout?.panelLayout;
    const um: string[] = [];
    const lines = emitGlassPoolSpigotsSpan({ productVariant: "glass-pool-spigots" }, span, um);
    for (const l of lines) allSkus.add(l.sku);
    for (const u of um) allUnmapped.push(`${c.label}: ${u}`);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const r = await client.query(
    `SELECT p.sku, EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed
     FROM bh_storefront.products p WHERE p.sku = ANY($1)`, [[...allSkus]]);
  await client.end();
  const known = new Map(r.rows.map((x: any) => [x.sku, x.placed]));
  const phantom = [...allSkus].filter((s) => !known.has(s));
  const unplaced = [...allSkus].filter((s) => known.get(s) === false);

  console.log(`\nGLASS-POOL-SPIGOTS emitter verification — ${cfgs.length} configs`);
  console.log(`  distinct SKUs emitted: ${allSkus.size}`);
  console.log(`  [UNMAPPED] gaps: ${allUnmapped.length}`);
  console.log(`  PHANTOM (not in catalogue): ${phantom.length}${phantom.length ? " → " + phantom.join(", ") : ""}`);
  console.log(`  UNPLACED (won't checkout): ${unplaced.length}${unplaced.length ? " → " + unplaced.join(", ") : ""}`);
  if (allUnmapped.length) { console.log("\nUNMAPPED detail:"); for (const u of allUnmapped) console.log("  ✗ " + u); }
  const ok = !allUnmapped.length && !phantom.length && !unplaced.length;
  console.log(ok ? "\n✅ CLEAN — emitter resolves every line to a placed SKU." : "\n❌ gaps above.");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
