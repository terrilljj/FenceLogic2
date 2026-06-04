/**
 * SKU-by-style report — runs the REAL BOM solver per launch style (across finish /
 * substrate / gate permutations), then joins every emitted SKU to its canonical
 * GST-inc price and primary image from the storefront. Doubles as the live gap report.
 *
 * One Neon DB holds all three sides:
 *   public.products.code  =  bh_storefront.products.sku  =  bh_storefront.product_images.sku
 *
 * Run:  export $(cat .env | xargs) && npx tsx scripts/sku-by-style.ts
 * Out:  _reports/sku-by-style.md  +  _reports/sku-by-style.csv  (+ console summary)
 */
import { writeFileSync, mkdirSync } from "fs";
import pg from "pg";
import { calculateComponents } from "../server/services/bom-calculator";

// ── Representative design + permutations per style ──────────────────────────────
// Each style runs N permutations; emitted SKUs are unioned. panelLayout is supplied
// directly (the BOM only needs panels/widths, not the layout solver) — 3 standard
// panels by default, with an extra gate permutation for pool styles.
type Ovr = Record<string, any>;

function makeDesign(variant: string, productType: string, ovr: Ovr, panels: number[] = [1000, 1000, 1000], panelTypes?: string[]) {
  const types = panelTypes ?? panels.map(() => "standard");
  return {
    name: "audit",
    productType,
    productVariant: variant,
    shape: "inline",
    spans: [{
      spanId: "A",
      length: 6000,
      maxPanelWidth: 1400,
      desiredGap: 20,
      layoutMode: "auto-equalize",
      spigotMounting: "base-plate",
      spigotColor: "polished",
      panelLayout: {
        panels,
        gaps: panels.map(() => 20),
        totalPanelWidth: panels.reduce((a, b) => a + b, 0),
        totalGapWidth: panels.length * 20,
        averageGap: 20,
        panelTypes: types,
      },
      ...ovr,
    }],
  } as any;
}

const RAIL = (finish: string) => ({ handrail: { enabled: true, type: "series-35x35", material: "anodised-aluminium", finish, startTermination: "end-cap", endTermination: "end-cap" } });
const GATE = { gateConfig: { required: true, gateSize: 975, hingePanelSize: 1200, position: 0, flipped: false, hingeFrom: "glass", hardware: "master" } };

type StyleDef = { variant: string; productType: string; label: string; perms: Ovr[]; panels?: number[]; panelTypes?: string[] };

const STYLES: StyleDef[] = [
  { variant: "glass-pool-spigots", productType: "glass-pool", label: "Glass Pool — Spigots", perms: [
    { spigotColor: "polished", spigotSubstrate: "concrete", spigotMounting: "core-drilled", fieldValues: { "spigot-family": "madrid-pool" } },
    { spigotColor: "black", spigotSubstrate: "timber", spigotMounting: "base-plate", fieldValues: { "spigot-family": "madrid-pool" } },
    { ...GATE, spigotColor: "polished", fieldValues: { "spigot-family": "madrid-pool" } },
  ] },
  { variant: "glass-pool-channel", productType: "glass-pool", label: "Glass Pool — Channel", perms: [
    { channelMounting: "ground" }, { channelMounting: "wall" },
  ] },
  { variant: "glass-bal-spigots-12mm", productType: "glass-balustrade", label: "Glass Bal — Spigots 12mm", perms: [
    { spigotColor: "polished", spigotSubstrate: "concrete", spigotMounting: "core-drilled", fieldValues: { "spigot-family": "madrid", "glass-bal-fall-height": "1m-5m" }, ...RAIL("satin") },
    { spigotColor: "black", spigotSubstrate: "timber", fieldValues: { "spigot-family": "nova", "glass-bal-fall-height": "over-5m" }, ...RAIL("black") },
  ] },
  { variant: "glass-bal-spigots-15mm", productType: "glass-balustrade", label: "Glass Bal — Spigots 15mm", perms: [
    { spigotColor: "polished", spigotSubstrate: "concrete", fieldValues: { "spigot-family": "madrid-deluxe", "glass-bal-fall-height": "1m-5m" }, ...RAIL("satin") },
    { spigotColor: "black", fieldValues: { "spigot-family": "madrid-deluxe", "glass-bal-fall-height": "over-5m" }, ...RAIL("black") },
  ] },
  { variant: "glass-bal-channel", productType: "glass-balustrade", label: "Glass Bal — Channel 15mm", perms: [
    { spigotSubstrate: "timber", fieldValues: { "channel-finish": "satin-anodised", "glass-bal-fall-height": "1m-5m" }, ...RAIL("satin") },
    { spigotSubstrate: "concrete", fieldValues: { "channel-finish": "black", "glass-bal-fall-height": "over-5m" }, ...RAIL("black") },
  ] },
  { variant: "glass-bal-channel-hd", productType: "glass-balustrade", label: "Glass Bal — Channel HD 17.52", perms: [
    { spigotSubstrate: "concrete", fieldValues: { "channel-finish": "satin-anodised" }, ...RAIL("satin") },
    { spigotSubstrate: "steel", fieldValues: { "channel-finish": "black" }, ...RAIL("black") },
  ] },
  { variant: "glass-bal-standoffs", productType: "glass-balustrade", label: "Glass Bal — Standoffs", perms: [
    { spigotColor: "polished", spigotSubstrate: "timber", fieldValues: { "standoff-body": "adjustable", "standoff-depth": "30" }, ...RAIL("satin") },
    { spigotColor: "black", spigotSubstrate: "concrete", fieldValues: { "standoff-body": "fixed", "standoff-depth": "30" }, ...RAIL("black") },
  ] },
  { variant: "alu-pool-tubular", productType: "aluminium-pool", label: "Alu Pool — Tubular Flat Top", perms: [
    { tubularFinish: "black", tubularHeight: "1200", fieldValues: { "tubular-substrate": "decking" } },
    { tubularFinish: "white", fieldValues: { "tubular-substrate": "core-drilled" } },
    { ...GATE, tubularFinish: "black" },
  ], panels: [2400, 2400] },
  { variant: "alu-pool-barr", productType: "aluminium-pool", label: "Alu Pool — BARR", perms: [
    { barrFinish: "satin-black", fieldValues: { "barr-substrate": "decking" } },
    { barrFinish: "pearl-white", fieldValues: { "barr-substrate": "core-drilled" } },
    { ...GATE, barrFinish: "satin-black" },
  ], panels: [2205, 2205] },
  { variant: "alu-pool-blade", productType: "aluminium-pool", label: "Alu Pool — Blade", perms: [
    { fieldValues: { "blade-substrate": "decking" } },
    { ...GATE },
  ], panels: [2200, 2200] },
  { variant: "alu-bal-barr", productType: "aluminium-balustrade", label: "Alu Bal — BARR", perms: [
    { balBarrFinish: "black", balBarrPanelHeight: "1000mm", fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber", "bal-fall-height": "over-1m" } },
    { balBarrFinish: "white", fieldValues: { "bal-substrate": "core-drilled", "bal-fall-height": "over-1m" } },
    { balBarrFinish: "black", fieldValues: { "bal-substrate": "face-mounted", "bal-material": "concrete" } },
  ], panels: [1365, 1365] },
  { variant: "alu-bal-blade", productType: "aluminium-balustrade", label: "Alu Bal — Blade", perms: [
    { fieldValues: { "bal-substrate": "base-plated", "bal-material": "timber" } },
    { fieldValues: { "bal-substrate": "face-mounted", "bal-material": "steel" } },
  ], panels: [1700, 1700] },
];

// ── Run the solver, collect unique SKUs per style ───────────────────────────────
type Line = { sku: string; desc: string };
const perStyle = new Map<string, { label: string; lines: Map<string, Line> }>();

for (const s of STYLES) {
  const lines = new Map<string, Line>();
  for (const perm of s.perms) {
    let comps: any[] = [];
    try {
      comps = calculateComponents(makeDesign(s.variant, s.productType, perm, s.panels, s.panelTypes), [], []);
    } catch (e) {
      console.error(`solver threw for ${s.variant}:`, (e as Error).message);
    }
    for (const c of comps) {
      if (c.sku && !lines.has(c.sku)) lines.set(c.sku, { sku: c.sku, desc: c.description ?? "" });
    }
  }
  perStyle.set(s.variant, { label: s.label, lines });
}

// ── Join every unique SKU to calc catalogue + storefront price + image ──────────
const allSkus = [...new Set([...perStyle.values()].flatMap(v => [...v.lines.keys()]))];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const calcCodes = new Set<string>((await client.query("SELECT code FROM public.products")).rows.map((r: any) => r.code));
const priceMap = new Map<string, number>();
for (const r of (await client.query("SELECT sku, retail_price_inc_gst FROM bh_storefront.products WHERE sku = ANY($1)", [allSkus])).rows as any[]) {
  if (r.retail_price_inc_gst != null) priceMap.set(r.sku, Number(r.retail_price_inc_gst));
}
const imgMap = new Map<string, string>();
for (const r of (await client.query("SELECT sku, url, is_primary, sort_order FROM bh_storefront.product_images WHERE sku = ANY($1) ORDER BY is_primary DESC, sort_order ASC", [allSkus])).rows as any[]) {
  if (!imgMap.has(r.sku)) imgMap.set(r.sku, r.url);
}
await client.end();

// family stem = strip trailing -LAM then trailing -<digits> (made-to-size width)
const familyOf = (sku: string) => sku.replace(/-LAM$/, "").replace(/-\d+$/, "");
const calcFamilies = [...calcCodes].map(familyOf);
const familyExists = (sku: string) => { const f = familyOf(sku); return f !== sku && (calcFamilies.includes(f) || [...calcCodes].some(c => c.startsWith(f + "-"))); };

function classify(sku: string): { status: string; price: number | null; image: boolean } {
  const price = priceMap.get(sku) ?? null;
  const image = imgMap.has(sku);
  if (calcCodes.has(sku)) return { status: price != null ? "PRICED" : "IN-CALC / NO-PRICE", price, image };
  if (familyExists(sku)) return { status: "MADE-TO-SIZE (family exists)", price, image };
  return { status: "MISSING (seed)", price, image };
}

// ── Emit report ─────────────────────────────────────────────────────────────────
mkdirSync("_reports", { recursive: true });
const csv: string[] = ["style,sku,description,status,price_inc_gst,has_image"];
let md = `# SKU-by-style report\n\nGenerated by \`scripts/sku-by-style.ts\` (real solver, ${STYLES.length} styles). Joins each emitted SKU to \`bh_storefront.products.retail_price_inc_gst\` + \`bh_storefront.product_images\`.\n\nStatus: **PRICED** = exact catalogue row + price · **MADE-TO-SIZE** = family exists, exact width is cut-to-size · **MISSING** = no catalogue family (needs seeding).\n`;

const tally = { PRICED: 0, "MADE-TO-SIZE": 0, MISSING: 0, OTHER: 0 };
const missingByStyle = new Map<string, string[]>();

for (const s of STYLES) {
  const entry = perStyle.get(s.variant)!;
  const rows = [...entry.lines.values()].map(l => ({ ...l, ...classify(l.sku) })).sort((a, b) => a.sku.localeCompare(b.sku));
  md += `\n## ${entry.label}  \`${s.variant}\`\n\n| SKU | Description | Status | Price (inc GST) | Img |\n|---|---|---|---|---|\n`;
  const miss: string[] = [];
  for (const r of rows) {
    const k = r.status.startsWith("PRICED") ? "PRICED" : r.status.startsWith("MADE") ? "MADE-TO-SIZE" : r.status.startsWith("MISSING") ? "MISSING" : "OTHER";
    tally[k as keyof typeof tally]++;
    if (k === "MISSING") miss.push(r.sku);
    md += `| \`${r.sku}\` | ${r.desc.slice(0, 48)} | ${r.status} | ${r.price != null ? "$" + r.price.toFixed(2) : "—"} | ${r.image ? "✓" : "—"} |\n`;
    csv.push(`${s.variant},${r.sku},"${r.desc.replace(/"/g, "'")}",${r.status},${r.price ?? ""},${r.image}`);
  }
  if (miss.length) missingByStyle.set(entry.label, miss);
}

md = md.replace("\n## ", `\n## Summary\n\n- **PRICED** (exact + price): ${tally.PRICED}\n- **MADE-TO-SIZE** (family exists): ${tally["MADE-TO-SIZE"]}\n- **MISSING** (seed): ${tally.MISSING}\n\n### Missing by style\n${[...missingByStyle].map(([s, m]) => `- **${s}**: ${[...new Set(m.map(familyOf))].join(", ")}`).join("\n") || "- none"}\n\n## `);

writeFileSync("_reports/sku-by-style.md", md);
writeFileSync("_reports/sku-by-style.csv", csv.join("\n"));

console.log(`\nSKU-by-style report → _reports/sku-by-style.md (+ .csv)`);
console.log(`  PRICED: ${tally.PRICED} · MADE-TO-SIZE: ${tally["MADE-TO-SIZE"]} · MISSING: ${tally.MISSING}`);
console.log(`  styles with missing SKUs:`);
for (const [s, m] of missingByStyle) console.log(`    ${s}: ${[...new Set(m.map(familyOf))].join(", ")}`);
