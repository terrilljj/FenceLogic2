/**
 * COMPREHENSIVE, AUTHORITATIVE SKU audit. For every launch style × gate-on/off × raked/custom,
 * it runs the REAL layout solver (computeSpanLayout — same code production uses, which snaps
 * glass to stocked sizes, centres gates, sizes hinge panels) and then the REAL BOM, then
 * classifies EVERY emitted SKU against the catalogue (bh_storefront):
 *
 *   ✅ SELLABLE  — in products + GST price + placed in a category (cart-addable)
 *   🟡 UNPLACED  — in products + priced, but no placement (checkout rejects it)
 *   🟠 NO PRICE  — in products, retail_price_inc_gst null
 *   🔴 PHANTOM   — not in bh_storefront.products at all (placeholder / made-to-size)
 *
 * Writes _reports/sku-audit.md + .csv. Reproducible:
 *   export $(cat .env | xargs) && npx tsx scripts/audit-skus.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import pg from "pg";
import { calculateComponents } from "../server/services/bom-calculator";
import { computeSpanLayout } from "../server/services/layout/layout-service";

const GATE = { required: true, gateSize: 975, hingePanelSize: 0, autoHingePanel: true, position: 0, flipped: false, hingeFrom: "wall" as const };

// A test case = a style + a span config (the solver fills the layout). `subs` fans out the
// substrate/mounting axis; `gate`/`raked` toggle those panel types.
type Case = { variant: string; productType: string; base: any; subs?: { key: string; values: string[] }; gate?: boolean; raked?: boolean };
const CASES: Case[] = [
  { variant: "glass-pool-spigots", productType: "glass-pool", base: { length: 6000, maxPanelWidth: 2000, desiredGap: 50, spigotMounting: "core-drilled", spigotColor: "polished" }, gate: true, raked: true },
  { variant: "glass-pool-channel", productType: "glass-pool", base: { length: 5000, maxPanelWidth: 2000, desiredGap: 50, channelMounting: "ground", fieldValues: { "channel-finish": "satin" } }, gate: true },
  { variant: "glass-bal-spigots-12mm", productType: "glass-balustrade", base: { length: 5000, maxPanelWidth: 1500, desiredGap: 50, spigotMounting: "core-drilled", spigotColor: "polished", fieldValues: { "glass-bal-fall-height": "1m-5m" } } },
  { variant: "glass-bal-spigots-15mm", productType: "glass-balustrade", base: { length: 5000, maxPanelWidth: 1400, desiredGap: 50, spigotMounting: "core-drilled", spigotColor: "polished", fieldValues: { "glass-bal-fall-height": "1m-5m" } } },
  { variant: "glass-bal-channel", productType: "glass-balustrade", base: { length: 5000, maxPanelWidth: 1400, desiredGap: 50, channelMounting: "ground", fieldValues: { "channel-finish": "satin" } } },
  { variant: "glass-bal-channel-hd", productType: "glass-balustrade", base: { length: 5000, maxPanelWidth: 1200, desiredGap: 50, channelMounting: "ground", fieldValues: { "channel-finish": "satin" } } },
  { variant: "glass-bal-standoffs", productType: "glass-balustrade", base: { length: 5000, maxPanelWidth: 1200, desiredGap: 50, spigotSubstrate: "concrete" }, subs: { key: "spigotSubstrate", values: ["concrete", "timber", "steel"] } },
  { variant: "alu-pool-tubular", productType: "aluminium-pool", base: { length: 6000, maxPanelWidth: 2450, desiredGap: 50, tubularFinish: "black" }, subs: { key: "tubular-substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled", "side-mounted"] }, gate: true },
  { variant: "alu-pool-barr", productType: "aluminium-pool", base: { length: 6000, maxPanelWidth: 2205, desiredGap: 50, barrFinish: "satin-black" }, subs: { key: "barr-substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled", "side-mounted"] }, gate: true },
  { variant: "alu-pool-blade", productType: "aluminium-pool", base: { length: 6000, maxPanelWidth: 2200, desiredGap: 50 }, subs: { key: "blade-substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled", "side-mounted"] }, gate: true },
  { variant: "alu-bal-barr", productType: "aluminium-balustrade", base: { length: 6000, maxPanelWidth: 1733, desiredGap: 50, balBarrFinish: "black", fieldValues: { "bal-fall-height": "over-1m" } }, subs: { key: "bal-substrate", values: ["core-drilled", "base-plated", "face-mounted"] } },
  { variant: "alu-bal-blade", productType: "aluminium-balustrade", base: { length: 6000, maxPanelWidth: 1700, desiredGap: 50 }, subs: { key: "bal-substrate", values: ["core-drilled", "base-plated", "face-mounted"] } },
];

function buildSpan(base: any, subKey?: string, subVal?: string, gate?: boolean, raked?: boolean) {
  const fieldValues = { ...(base.fieldValues || {}) };
  if (subKey && subVal && !["spigotSubstrate"].includes(subKey)) fieldValues[subKey] = subVal;
  const span: any = { spanId: "A", ...base, fieldValues,
    leftGap: { enabled: true, size: 25 }, rightGap: { enabled: true, size: 25 } };
  if (subKey === "spigotSubstrate") span.spigotSubstrate = subVal;
  if (gate) span.gateConfig = { ...GATE };
  if (raked) span.rightRakedPanel = { enabled: true, height: 1530 };
  return span;
}

(async () => {
  const emitted = new Map<string, { styles: Set<string>; desc: string }>();
  for (const cs of CASES) {
    const subVals = cs.subs ? cs.subs.values : [undefined];
    const toggles: { gate?: boolean; raked?: boolean }[] = [{}, ...(cs.gate ? [{ gate: true }] : []), ...(cs.raked ? [{ raked: true }] : [])];
    for (const sv of subVals) {
      for (const t of toggles) {
        const span = buildSpan(cs.base, cs.subs?.key, sv, t.gate, t.raked);
        let layout;
        try {
          layout = computeSpanLayout({ productVariant: cs.variant, gatesAllowed: !cs.variant.includes("bal-"), span });
        } catch (e: any) { console.error(`  ! layout ${cs.variant} ${sv} ${JSON.stringify(t)}: ${e.message}`); continue; }
        if (!layout?.panelLayout) continue;
        span.panelLayout = layout.panelLayout;
        let comps: any[] = [];
        try {
          comps = calculateComponents({ name: "audit", shape: "inline", productType: cs.productType, customSides: 1, productVariant: cs.variant, spans: [span] } as any);
        } catch (e: any) { console.error(`  ! bom ${cs.variant} ${sv} ${JSON.stringify(t)}: ${e.message}`); continue; }
        for (const c of comps) {
          if (!c.sku) continue;
          const e = emitted.get(c.sku) ?? { styles: new Set(), desc: c.description };
          e.styles.add(cs.variant);
          emitted.set(c.sku, e);
        }
      }
    }
  }
  const skus = [...emitted.keys()].sort();

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    `SELECT p.sku, p.retail_price_inc_gst::float AS price,
       EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku = p.sku) AS placed
     FROM bh_storefront.products p WHERE p.sku = ANY($1)`, [skus]);
  const cat = new Map(r.rows.map((x: any) => [x.sku, x]));
  await c.end();

  const rows = skus.map((sku) => {
    const e = emitted.get(sku)!; const cr: any = cat.get(sku);
    const status = !cr ? "🔴 PHANTOM" : cr.price == null ? "🟠 NO PRICE" : !cr.placed ? "🟡 UNPLACED" : "✅ SELLABLE";
    return { sku, status, price: cr?.price ?? null, styles: [...e.styles].join(" "), desc: e.desc };
  });
  const tally = (s: string) => rows.filter((x) => x.status === s).length;
  const summary = `SELLABLE ${tally("✅ SELLABLE")} · UNPLACED ${tally("🟡 UNPLACED")} · NO-PRICE ${tally("🟠 NO PRICE")} · PHANTOM ${tally("🔴 PHANTOM")}  (of ${rows.length} distinct SKUs)`;
  console.log("\n=== SKU AUDIT (real solver + real BOM) ===\n" + summary + "\n");
  const problems = rows.filter((x) => x.status !== "✅ SELLABLE");
  for (const p of problems) console.log(`  ${p.status}  ${p.sku}  [${p.styles}]  ${p.desc.slice(0, 50)}`);

  mkdirSync("_reports", { recursive: true });
  const md = [`# SKU audit (real layout solver + BOM)\n`, `${summary}\n`, `| Status | SKU | Price | Styles | Description |`, `|---|---|---|---|---|`,
    ...rows.sort((a, b) => a.status.localeCompare(b.status) || a.sku.localeCompare(b.sku))
      .map((x) => `| ${x.status} | \`${x.sku}\` | ${x.price ?? "—"} | ${x.styles} | ${x.desc.replace(/\|/g, "/").slice(0, 80)} |`)].join("\n");
  writeFileSync("_reports/sku-audit.md", md);
  writeFileSync("_reports/sku-audit.csv", "status,sku,price,styles,description\n" +
    rows.map((x) => `"${x.status}","${x.sku}",${x.price ?? ""},"${x.styles}","${x.desc.replace(/"/g, "'")}"`).join("\n"));
  console.log(`\nWrote _reports/sku-audit.md + .csv  (${problems.length} non-sellable)`);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
