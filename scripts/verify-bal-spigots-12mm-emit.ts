/**
 * Proves the glass-bal-spigots-12mm emitter produces a clean, fully-resolved, fully-placed BOM
 * across a config matrix (incl. both rail families × all terminations) via the real layout solver.
 * Run: export $(cat .env | xargs) && npx tsx scripts/verify-bal-spigots-12mm-emit.ts
 */
import pg from "pg";
import { emitGlassBalSpigots12mmSpan } from "../server/services/bom/glass-bal-spigots-12mm-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";

const FAMS = ["nova", "madrid"];
const FINISHES = ["polished", "satin", "black", "white"];
const TERMS = ["wall-tie", "end-cap", "90-degree", "adjustable-corner"];
const RAILS = ["series-35x35", "nonorail-25x21"];

type Cfg = { label: string; family: string; mounting: string; color: string; substrate?: string; fixing?: string; rail?: string; t1?: string; t2?: string };
const cfgs: Cfg[] = [];
// spigots + covers across family × mounting × finish
for (const family of FAMS) for (const color of FINISHES) {
  cfgs.push({ label: `${family} base ${color}`, family, mounting: "base-plate", color, substrate: "concrete" });
  cfgs.push({ label: `${family} core ${color}`, family, mounting: "core-drilled", color });
}
// fixings
cfgs.push(
  { label: "timber lag", family: "nova", mounting: "base-plate", color: "polished", substrate: "timber", fixing: "lag" },
  { label: "timber csk", family: "nova", mounting: "base-plate", color: "polished", substrate: "timber", fixing: "csk" },
  { label: "steel", family: "nova", mounting: "base-plate", color: "polished", substrate: "steel" },
);
// rail: each family × each termination pair
for (const rail of RAILS) for (const t of TERMS) {
  cfgs.push({ label: `rail ${rail} ${t}`, family: "nova", mounting: "base-plate", color: "polished", substrate: "concrete", rail, t1: t, t2: "wall-tie" });
}

(async () => {
  const allSkus = new Set<string>(); const allUnmapped: string[] = [];
  for (const c of cfgs) {
    const span: any = {
      spanId: "A", length: 6000, maxPanelWidth: 1500, desiredGap: 50,
      spigotMounting: c.mounting, spigotColor: c.color, spigotSubstrate: c.substrate,
      fieldValues: { "spigot-family": c.family, "fixing-method": c.fixing || "lag" },
      leftGap: { enabled: true, size: 25 }, rightGap: { enabled: true, size: 25 },
    };
    if (c.rail) span.handrail = { enabled: true, type: c.rail, material: "stainless-steel", finish: c.color, startTermination: c.t1, endTermination: c.t2 };
    let layout;
    try { layout = computeSpanLayout({ productVariant: "glass-bal-spigots-12mm", gatesAllowed: false, span }); }
    catch (e: any) { allUnmapped.push(`${c.label}: LAYOUT ${e.message}`); continue; }
    span.panelLayout = layout?.panelLayout;
    const um: string[] = [];
    for (const l of emitGlassBalSpigots12mmSpan({ productVariant: "glass-bal-spigots-12mm" }, span, um)) allSkus.add(l.sku);
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

  console.log(`\nGLASS-BAL-SPIGOTS-12MM emitter verification — ${cfgs.length} configs`);
  console.log(`  distinct SKUs: ${allSkus.size}`);
  console.log(`  [UNMAPPED]: ${allUnmapped.length}`);
  console.log(`  PHANTOM: ${phantom.length}${phantom.length ? " → " + phantom.join(", ") : ""}`);
  console.log(`  UNPLACED: ${unplaced.length}${unplaced.length ? " → " + unplaced.join(", ") : ""}`);
  if (allUnmapped.length) { console.log("\nUNMAPPED:"); for (const u of allUnmapped) console.log("  ✗ " + u); }
  const ok = !allUnmapped.length && !phantom.length && !unplaced.length;
  console.log(ok ? "\n✅ CLEAN" : "\n❌ gaps above.");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });

