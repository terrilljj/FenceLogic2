/**
 * CATALOGUE-BY-STYLE CSV GENERATOR — the slot-mapping worksheet (grouped by style).
 *
 * For each launch style it lists EVERY distinct product (SKU) the storefront places under
 * that style's category tree — one row per SKU, NOT per size×finish permutation. This is the
 * clean catalogue the operator confirms before the BOM solver is re-pointed at product_slots.
 *
 * Source of truth = bh_storefront (the same Neon data the live Vercel storefront renders):
 *   product_placements (sku ↔ category_slug)  JOIN  products (name, retail_price_inc_gst)
 *   + primary image from product_images
 *
 * Each style maps to a category_slug PREFIX (LIKE '<prefix>%'). Non-calc sub-ranges
 * (-pik, -premium-perf, -visor) fall outside every prefix and are naturally excluded.
 *
 * Output per style: _reports/catalogue-by-style/<style>.xlsx (with thumbnails PHYSICALLY
 *         embedded — they render in Excel for Mac / Windows offline, no IMAGE() proxy that
 *         returns #BLOCKED!) + <style>.csv (same data, image as a plain URL) + README.md.
 *         Columns: image, sku, description, subcat_1..N (named hierarchy below the style root,
 *         from bh_storefront.categories.display_name), retail_price_inc_gst, category_slug.
 *
 * Run all 12:        export $(cat .env | xargs) && npx tsx scripts/gen-catalogue-by-style.ts
 * Run one (test):    export $(cat .env | xargs) && npx tsx scripts/gen-catalogue-by-style.ts glass-pool-spigots
 *
 * Read-only DB. Does not commit.
 */
import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import pg from "pg";
import ExcelJS from "exceljs";

const IMAGE_BASE = process.env.VITE_STOREFRONT_IMAGE_BASE || "";
const STAMP = new Date().toISOString().slice(0, 10); // YYYY-MM-DD — date-stamps the output folder

// The 16 live calc styles → their bh_storefront category_slug prefix (LIKE '<prefix>%').
// File name = the calc productVariant id so the sheet maps 1:1 to a style in the calculator.
const STYLES: { style: string; prefix: string }[] = [
  { style: "glass-pool-spigots",     prefix: "pool-fencing-glass-spigots" },
  { style: "glass-pool-channel",     prefix: "pool-fencing-glass-channel" },
  { style: "glass-bal-spigots-12mm", prefix: "balustrade-glass-spigots-12mm" },
  { style: "glass-bal-spigots-15mm", prefix: "balustrade-glass-spigots-15mm" },
  { style: "glass-bal-channel",      prefix: "balustrade-glass-channel-15mm" }, // calc channel = 15mm VersaTilt
  { style: "glass-bal-channel-hd",   prefix: "balustrade-glass-channel-17-52-hd" },
  { style: "glass-bal-standoffs",    prefix: "balustrade-glass-standoff-15mm" },
  { style: "alu-pool-tubular",       prefix: "pool-fencing-metal-flat-top-tubular" },
  { style: "alu-pool-barr",          prefix: "pool-fencing-metal-barr" },
  { style: "alu-pool-blade",         prefix: "pool-fencing-metal-blade" },
  { style: "alu-pool-premium-perf",  prefix: "pool-fencing-metal-premium-perf" },
  { style: "alu-pool-pik",           prefix: "pool-fencing-metal-pik" },
  { style: "alu-bal-barr",           prefix: "balustrade-metal-barr" },
  { style: "alu-bal-blade",          prefix: "balustrade-metal-blade" },
  { style: "alu-bal-premium-perf",   prefix: "balustrade-metal-premium-perf" },
  { style: "alu-bal-visor",          prefix: "balustrade-metal-visor" },
];

// Per-style SOLVER VARIABLES — the config inputs the BOM solver reads for that style, with their
// option set, default and the span field they write to. Rendered as a "Solver" worksheet so a
// human reviewing the slot sheet sees exactly what drives SKU selection. (v1 — config-derived;
// refine as configs evolve.)
type SolverVar = { var: string; options: string; def: string; writes: string };
const SOLVER_VARS: Record<string, SolverVar[]> = {
  "glass-pool-spigots": [
    { var: "Spigot family", options: "Madrid Standard / Madrid Deluxe / Nova", def: "Madrid Standard", writes: "fieldValues.spigot-family" },
    { var: "Mounting", options: "base-plate / core-drilled", def: "base-plate", writes: "spigotMounting" },
    { var: "Finish", options: "polished / satin / black / white", def: "polished", writes: "spigotColor" },
    { var: "Substrate", options: "concrete / timber / steel", def: "concrete", writes: "spigotSubstrate" },
    { var: "Base fixing", options: "lag / countersunk", def: "lag", writes: "fieldValues.fixing-method" },
    { var: "Gate", options: "none / Polaris / Master (soft-close)", def: "none", writes: "gateConfig" },
  ],
  "glass-pool-channel": [
    { var: "Channel finish", options: "satin / black", def: "satin", writes: "fieldValues.channel-finish" },
    { var: "Mounting", options: "deck-mount", def: "deck-mount", writes: "channelMounting" },
    { var: "End terminations (L/R/gate)", options: "end-cap / mitre / none", def: "end-cap", writes: "fieldValues.channel-term-*" },
    { var: "Gate", options: "none / Polaris / Master", def: "none", writes: "gateConfig" },
  ],
  "glass-bal-spigots-12mm": [
    { var: "Spigot family", options: "Madrid Standard / Nova", def: "Madrid Standard", writes: "fieldValues.spigot-family" },
    { var: "Mounting", options: "base-plate / core-drilled", def: "base-plate", writes: "spigotMounting" },
    { var: "Finish", options: "polished / satin / black / white", def: "polished", writes: "spigotColor" },
    { var: "Substrate", options: "concrete / timber / steel", def: "concrete", writes: "spigotSubstrate" },
    { var: "Rail profile", options: "NonoRail 25×21 / 35-Series", def: "NonoRail 25×21", writes: "handrail.type" },
    { var: "Rail terminations", options: "end-cap / wall-tie / 90° / adjustable", def: "end-cap", writes: "handrail.start/endTermination" },
  ],
  "glass-bal-spigots-15mm": [
    { var: "Family", options: "Madrid Deluxe (15mm)", def: "Madrid Deluxe", writes: "fieldValues.spigot-family" },
    { var: "Mounting", options: "base-plate / core-drilled", def: "base-plate", writes: "spigotMounting" },
    { var: "Finish", options: "polished / satin / black / white", def: "polished", writes: "spigotColor" },
    { var: "Substrate", options: "concrete / timber / steel", def: "concrete", writes: "spigotSubstrate" },
    { var: "Rail profile", options: "35-Series (15mm only)", def: "35-Series", writes: "handrail.type" },
    { var: "Rail terminations", options: "end-cap / wall-tie / 90° / adjustable", def: "end-cap", writes: "handrail.start/endTermination" },
  ],
  "glass-bal-channel": [
    { var: "Channel finish", options: "satin / black", def: "satin", writes: "fieldValues.channel-finish" },
    { var: "Rail", options: "35-Series on / off", def: "on", writes: "handrail.enabled" },
    { var: "Rail terminations", options: "end-cap / wall-tie / 90° / adjustable", def: "end-cap", writes: "handrail.start/endTermination" },
    { var: "Fall-height band", options: "≤1m / 1–4m / 4–5m (glass selection)", def: "1–4m", writes: "fieldValues.fall-height" },
  ],
  "glass-bal-channel-hd": [
    { var: "Channel finish", options: "satin / black", def: "satin", writes: "fieldValues.channel-finish" },
    { var: "Rail", options: "35-Series on / off", def: "on", writes: "handrail.enabled" },
    { var: "Rail terminations", options: "end-cap / wall-tie / 90° / adjustable", def: "end-cap", writes: "handrail.start/endTermination" },
    { var: "Fall-height", options: ">5m laminated (1100SGP HD)", def: ">5m", writes: "fieldValues.fall-height" },
  ],
  "glass-bal-standoffs": [
    { var: "Finish", options: "polished / satin / black", def: "satin", writes: "spigotColor" },
    { var: "Substrate", options: "concrete / timber / steel", def: "concrete", writes: "spigotSubstrate" },
    { var: "Rail", options: "35-Series on / off", def: "on", writes: "handrail.enabled" },
    { var: "Rail terminations", options: "end-cap / wall-tie / 90° / adjustable", def: "end-cap", writes: "handrail.start/endTermination" },
  ],
  "alu-pool-tubular": [
    { var: "Finish", options: "black / white", def: "black", writes: "fieldValues.tubular-finish" },
    { var: "Substrate", options: "decking / concrete-slab / in-ground / core-drilled / side-mounted", def: "concrete-slab", writes: "fieldValues.tubular-substrate" },
    { var: "Gate", options: "none / gate", def: "none", writes: "gateConfig" },
  ],
  "alu-pool-barr": [
    { var: "Finish", options: "black / white", def: "black", writes: "balBarrFinish" },
    { var: "Substrate", options: "decking / concrete-slab / in-ground / core-drilled / side-mounted", def: "concrete-slab", writes: "fieldValues.barr-substrate" },
    { var: "Fixing material", options: "timber / concrete / steel", def: "concrete", writes: "fieldValues.bal-material" },
    { var: "Gate / corners", options: "count", def: "0", writes: "gateConfig / fieldValues.bal-corners" },
  ],
  "alu-pool-blade": [
    { var: "Finish", options: "black only", def: "black", writes: "—" },
    { var: "Substrate", options: "decking / concrete-slab / in-ground / core-drilled / side-mounted", def: "concrete-slab", writes: "fieldValues.blade-substrate" },
    { var: "Fixing material", options: "timber / concrete / steel", def: "concrete", writes: "fieldValues.bal-material" },
    { var: "Gate / corners", options: "count", def: "0", writes: "gateConfig / fieldValues.bal-corners" },
  ],
  "alu-pool-premium-perf": [
    { var: "Finish", options: "black / mill-natural", def: "black", writes: "fieldValues.perf-finish" },
    { var: "Panel method", options: "brackets / U-channel", def: "U-channel", writes: "fieldValues.perf-method" },
    { var: "Mount", options: "decking / concrete-slab / in-ground / core-drilled", def: "concrete-slab", writes: "fieldValues.perf-substrate" },
    { var: "Gate", options: "none / gate", def: "none", writes: "gateConfig" },
  ],
  "alu-pool-pik": [
    { var: "Finish", options: "black / white", def: "black", writes: "fieldValues.pik-finish" },
    { var: "Install mode", options: "surface / grout-in / core-drill (kit)", def: "surface", writes: "fieldValues.pik-mount" },
    { var: "Substrate (surface)", options: "concrete / timber", def: "concrete", writes: "fieldValues.pik-substrate" },
    { var: "Corners (curved panel)", options: "count", def: "0", writes: "fieldValues.pik-corners" },
    { var: "Gates", options: "count", def: "0", writes: "fieldValues.pik-gates" },
  ],
  "alu-bal-barr": [
    { var: "Finish", options: "black / white", def: "black", writes: "balBarrFinish" },
    { var: "Substrate", options: "core-drilled / base-plated / face-mounted", def: "base-plated", writes: "fieldValues.bal-substrate" },
    { var: "Fixing material", options: "timber / concrete / steel", def: "timber", writes: "fieldValues.bal-material" },
    { var: "Fall height", options: "<1m (full panel) / ≥1m (1365 cap)", def: "≥1m", writes: "fieldValues.bal-fall-height" },
    { var: "Corners", options: "count", def: "0", writes: "fieldValues.bal-corners" },
  ],
  "alu-bal-blade": [
    { var: "Finish", options: "black only", def: "black", writes: "—" },
    { var: "Substrate", options: "core-drilled / base-plated / face-mounted", def: "base-plated", writes: "fieldValues.bal-substrate" },
    { var: "Fixing material", options: "timber / concrete / steel", def: "timber", writes: "fieldValues.bal-material" },
    { var: "Corners", options: "count", def: "0", writes: "fieldValues.bal-corners" },
  ],
  "alu-bal-premium-perf": [
    { var: "Finish", options: "black / mill-natural", def: "black", writes: "fieldValues.perf-finish" },
    { var: "Panel method", options: "full perf / visible gap", def: "full perf", writes: "fieldValues.perf-method" },
    { var: "Rail profile", options: "rectangular / oval", def: "rectangular", writes: "fieldValues.perf-rail" },
    { var: "Wall tie", options: "internal (A50-WP) / offset (A50-BRACKET)", def: "internal", writes: "fieldValues.perf-walltie" },
    { var: "Mount", options: "top base-plate / top core-drill / side-mount (face)", def: "base-plated", writes: "fieldValues.perf-substrate" },
  ],
  "alu-bal-visor": [
    { var: "Finish", options: "black / white / mill", def: "black", writes: "fieldValues.visor-finish" },
    { var: "Mount", options: "deck (\"T\") / face (\"L\")", def: "deck", writes: "fieldValues.visor-mount" },
    { var: "Substrate", options: "concrete / timber / steel", def: "concrete", writes: "fieldValues.visor-substrate" },
    { var: "Handrail terminations (start/end)", options: "end-plate / wall-bracket / offset-bracket", def: "end-plate", writes: "fieldValues.visor-term-start/end" },
  ],
};

type Row = { sku: string; description: string; category_slug: string; price: number | null; image: string | null };
type Cat = { parent_slug: string | null; display_name: string };

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toFullImageUrl(path: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  if (!IMAGE_BASE) return path;
  return `${IMAGE_BASE}${path}`;
}

type Img = { buffer: Buffer; ext: "jpeg" | "png" };

// Small thumbnail via the storefront's Next.js image optimizer (~1–3KB vs ~275KB full-size),
// so the embedded workbook stays a few MB instead of ~100MB. Falls back to the raw image if
// no IMAGE_BASE is configured. Accept header avoids webp/avif (exceljs only embeds jpeg/png).
function thumbUrl(path: string | null): string {
  if (!path) return "";
  if (!IMAGE_BASE || /^https?:\/\//.test(path)) return toFullImageUrl(path);
  return `${IMAGE_BASE}/_next/image?url=${encodeURIComponent(path)}&w=128&q=75`;
}

// Download every primary thumbnail into a buffer (for physical embedding). Bounded concurrency;
// failures are skipped (cell left blank) rather than aborting the run.
async function downloadImages(rows: Row[], concurrency = 16): Promise<Map<string, Img>> {
  const out = new Map<string, Img>();
  const jobs = rows.map((r) => ({ sku: r.sku, url: thumbUrl(r.image) })).filter((j) => j.url);
  let i = 0;
  let ok = 0;
  async function worker() {
    while (i < jobs.length) {
      const job = jobs[i++];
      try {
        const res = await fetch(job.url, { headers: { Accept: "image/png,image/jpeg" } });
        if (!res.ok) continue;
        const ct = res.headers.get("content-type") || "";
        const ext = ct.includes("png") ? "png" : ct.includes("jpeg") || ct.includes("jpg") ? "jpeg" : null;
        if (!ext) continue; // skip webp/avif/unknown — exceljs can't embed it
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0) {
          out.set(job.sku, { buffer: buf, ext });
          ok++;
        }
      } catch {
        /* skip — leave thumbnail blank */
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`     fetched ${ok}/${jobs.length} thumbnails`);
  return out;
}

// Load the full category tree once: slug → { parent_slug, display_name }.
async function loadCategories(client: pg.Client): Promise<Map<string, Cat>> {
  const { rows } = await client.query(
    `SELECT slug, parent_slug, display_name FROM bh_storefront.categories`,
  );
  const m = new Map<string, Cat>();
  for (const r of rows as any[]) m.set(r.slug, { parent_slug: r.parent_slug, display_name: r.display_name });
  return m;
}

// Named sub-category path BELOW the style root (top-down), e.g. ["Clamps", "D", "Flat Back"].
// Walks parent_slug from the leaf up to (and excluding) the style root. Falls back to a
// hyphen-split of the slug remainder if a slug is missing from the categories table.
function subcatPath(slug: string, rootSlug: string, cats: Map<string, Cat>): string[] {
  if (slug === rootSlug) return [];
  const names: string[] = [];
  let cur: string | null = slug;
  const guard = new Set<string>();
  while (cur && cur !== rootSlug && !guard.has(cur)) {
    guard.add(cur);
    const c = cats.get(cur);
    if (!c) {
      const tail = cur.startsWith(rootSlug + "-") ? cur.slice(rootSlug.length + 1) : cur;
      return tail.split("-").map((s) => s.replace(/\b\w/g, (ch) => ch.toUpperCase()));
    }
    names.push(c.display_name);
    cur = c.parent_slug;
  }
  return names.reverse();
}

// Orphans: products with NO placement (not on the storefront). category_slug/subcats are blank
// by definition — same column layout as the style sheets so it drops into the same workflow.
async function fetchOrphans(client: pg.Client): Promise<Row[]> {
  const { rows } = await client.query(
    `SELECT p.sku,
            p.name AS description,
            NULL::text AS category_slug,
            p.retail_price_inc_gst::float AS price,
            (SELECT i.url FROM bh_storefront.product_images i
               WHERE i.sku = p.sku
               ORDER BY i.is_primary DESC NULLS LAST, i.sort_order ASC
               LIMIT 1) AS image
       FROM bh_storefront.products p
      WHERE NOT EXISTS (SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku = p.sku)
      ORDER BY p.sku`,
  );
  return rows as Row[];
}

async function fetchStyle(client: pg.Client, prefix: string): Promise<Row[]> {
  const { rows } = await client.query(
    `SELECT DISTINCT p.sku,
            p.name AS description,
            pp.category_slug,
            p.retail_price_inc_gst::float AS price,
            (SELECT i.url FROM bh_storefront.product_images i
               WHERE i.sku = p.sku
               ORDER BY i.is_primary DESC NULLS LAST, i.sort_order ASC
               LIMIT 1) AS image
       FROM bh_storefront.product_placements pp
       JOIN bh_storefront.products p ON p.sku = pp.sku
      WHERE pp.category_slug LIKE $1
      ORDER BY pp.category_slug, p.sku`,
    [prefix + "%"],
  );
  return rows as Row[];
}

const MIN_SUBCATS = 6; // always emit subcat_1..subcat_6 (pad empties beyond actual depth)
const ANNOTATION_COLS = ["calc_include", "calslot_1", "calslot_2", "calslot_3"]; // operator-filled
const NOTES_COL = "Notes"; // trailing free-text column (matches the operator's filled layout)

// Operator-entered, style-independent annotations carried across sheets by SKU. subcat_* and
// the DB columns are NEVER carried — they are style-specific.
type Ann = { calc_include: unknown; calslot_1: unknown; calslot_2: unknown; calslot_3: unknown; notes: unknown };

function subcatCount(depth: number): number {
  return Math.max(MIN_SUBCATS, depth);
}

// exceljs cell value → plain scalar (unwrap rich text / hyperlink / formula result).
function cellVal(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "object") {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text).join("");
    if ("text" in o) return o.text;
    if ("result" in o) return o.result;
    if ("hyperlink" in o) return o.text ?? o.hyperlink;
  }
  return v;
}

// Read operator annotations from one or more filled workbooks, keyed by SKU. First seed wins
// on conflict (conflicts are logged). Only SKUs present in a seed are returned.
async function loadAnnotations(paths: string[]): Promise<Map<string, Ann>> {
  const map = new Map<string, Ann>();
  for (const p of paths) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    const ws = wb.worksheets[0];
    const header = (ws.getRow(1).values as any[]).slice(1).map((h) => String(cellVal(h) ?? ""));
    const idx: Record<string, number> = {};
    header.forEach((h, i) => (idx[h] = i + 1));
    const skuCol = idx["sku"];
    if (!skuCol) throw new Error(`${p}: no 'sku' column`);
    let added = 0, conflicts = 0;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const sku = String(cellVal(row.getCell(skuCol).value) ?? "").trim();
      if (!sku) return;
      const ann: Ann = {
        calc_include: idx["calc_include"] ? cellVal(row.getCell(idx["calc_include"]).value) : null,
        calslot_1: idx["calslot_1"] ? cellVal(row.getCell(idx["calslot_1"]).value) : null,
        calslot_2: idx["calslot_2"] ? cellVal(row.getCell(idx["calslot_2"]).value) : null,
        calslot_3: idx["calslot_3"] ? cellVal(row.getCell(idx["calslot_3"]).value) : null,
        notes: idx[NOTES_COL] ? cellVal(row.getCell(idx[NOTES_COL]).value) : null,
      };
      if (map.has(sku)) { conflicts++; return; }
      map.set(sku, ann);
      added++;
    });
    console.log(`     seed ${p.split("/").pop()}: ${added} SKUs${conflicts ? `, ${conflicts} dup(s) ignored` : ""}`);
  }
  return map;
}

function boolToCsv(v: unknown): string {
  return v === true ? "TRUE" : v === false ? "FALSE" : "";
}

// Quote-aware CSV parser (fields may contain commas/newlines/escaped quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Seed operator annotations from the curated catalogue-by-style .CSV twins (the .xlsx have
// embedded images that crash exceljs's reader). Keyed by SKU; first seed wins on conflict.
function loadAnnotationsCsv(paths: string[]): Map<string, Ann> {
  const map = new Map<string, Ann>();
  for (const p of paths) {
    const rows = parseCsv(readFileSync(p, "utf8"));
    if (rows.length < 2) continue;
    const idx: Record<string, number> = {};
    rows[0].forEach((h, i) => (idx[h.trim()] = i));
    const skuCol = idx["sku"];
    if (skuCol == null) continue;
    let added = 0;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const sku = (cells[skuCol] ?? "").trim();
      if (!sku || map.has(sku)) continue;
      const ci = idx["calc_include"] != null ? (cells[idx["calc_include"]] ?? "").trim() : "";
      map.set(sku, {
        calc_include: ci === "TRUE" ? true : ci === "FALSE" ? false : ci || null,
        calslot_1: idx["calslot_1"] != null ? cells[idx["calslot_1"]] || null : null,
        calslot_2: idx["calslot_2"] != null ? cells[idx["calslot_2"]] || null : null,
        calslot_3: idx["calslot_3"] != null ? cells[idx["calslot_3"]] || null : null,
        notes: idx["Notes"] != null ? cells[idx["Notes"]] || null : null,
      });
      added++;
    }
    if (added) console.log(`     seed ${p.split("/").pop()}: ${added} SKUs`);
  }
  return map;
}

function writeCsv(outDir: string, style: string, rows: Row[], paths: string[][], depth: number, ann: Map<string, Ann>) {
  const n = subcatCount(depth);
  const subcatCols = Array.from({ length: n }, (_, i) => `subcat_${i + 1}`);
  const header = ["sku", "description", ...subcatCols, ...ANNOTATION_COLS, "retail_price_inc_gst", "category_slug", "image_url", NOTES_COL];
  const lines = [header.join(",")];
  rows.forEach((r, i) => {
    const a = ann.get(r.sku);
    lines.push([
      csvCell(r.sku),
      csvCell(r.description),
      ...Array.from({ length: n }, (_, j) => csvCell(paths[i][j] ?? "")),
      a ? boolToCsv(a.calc_include) : "",
      csvCell(a ? a.calslot_1 ?? "" : ""),
      csvCell(a ? a.calslot_2 ?? "" : ""),
      csvCell(a ? a.calslot_3 ?? "" : ""),
      csvCell(r.price),
      csvCell(r.category_slug),
      csvCell(toFullImageUrl(r.image)),
      csvCell(a ? a.notes ?? "" : ""),
    ].join(","));
  });
  writeFileSync(join(outDir, `${style}.csv`), lines.join("\n") + "\n");
}

const THUMB = 56; // px — square thumbnail box

// Real .xlsx with thumbnails PHYSICALLY embedded (no IMAGE() proxy → no #BLOCKED!).
async function writeXlsx(
  outDir: string,
  style: string,
  rows: Row[],
  paths: string[][],
  depth: number,
  imgs: Map<string, Img>,
  ann: Map<string, Ann>,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(style.slice(0, 31));

  const n = subcatCount(depth);
  const subcatCols = Array.from({ length: n }, (_, i) => `subcat_${i + 1}`);
  ws.columns = [
    { header: "image", key: "image", width: THUMB / 7 + 1 },
    { header: "sku", key: "sku", width: 16 },
    { header: "description", key: "description", width: 60 },
    ...subcatCols.map((k) => ({ header: k, key: k, width: 20 })),
    ...ANNOTATION_COLS.map((k) => ({ header: k, key: k, width: 14 })),
    { header: "retail_price_inc_gst", key: "price", width: 18 },
    { header: "category_slug", key: "slug", width: 40 },
    { header: NOTES_COL, key: "notes", width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((r, i) => {
    const a = ann.get(r.sku);
    const rowObj: Record<string, unknown> = {
      image: "",
      sku: r.sku,
      description: r.description,
      price: r.price,
      slug: r.category_slug,
      calc_include: a ? (typeof a.calc_include === "boolean" ? a.calc_include : a.calc_include ?? "") : "",
      calslot_1: a ? a.calslot_1 ?? "" : "",
      calslot_2: a ? a.calslot_2 ?? "" : "",
      calslot_3: a ? a.calslot_3 ?? "" : "",
      notes: a ? a.notes ?? "" : "",
    };
    subcatCols.forEach((k, j) => (rowObj[k] = paths[i][j] ?? ""));
    const row = ws.addRow(rowObj);
    row.alignment = { vertical: "middle", wrapText: true };

    const img = imgs.get(r.sku);
    if (img) {
      row.height = THUMB * 0.78; // points ≈ px*0.75, +pad
      const id = wb.addImage({ buffer: img.buffer as any, extension: img.ext });
      // tl is zero-based; data row i is worksheet row i+2 → zero-based top = i + 1
      ws.addImage(id, {
        tl: { col: 0.15, row: i + 1 + 0.12 } as any,
        ext: { width: THUMB, height: THUMB },
        editAs: "oneCell",
      });
    }
  });

  // Second worksheet: the style's SOLVER VARIABLES + date stamp (human-review context).
  const sv = SOLVER_VARS[style];
  if (sv) {
    const sw = wb.addWorksheet("Solver");
    sw.addRow([`${style} — solver variables`]);
    sw.addRow([`generated ${STAMP} · source of truth: bh_storefront (Neon)`]);
    sw.addRow([]);
    const hdr = sw.addRow(["variable", "options", "default", "writes to (span field)"]);
    hdr.font = { bold: true };
    for (const v of sv) sw.addRow([v.var, v.options, v.def, v.writes]);
    sw.getColumn(1).width = 32; sw.getColumn(2).width = 54; sw.getColumn(3).width = 18; sw.getColumn(4).width = 36;
    sw.getRow(1).font = { bold: true, size: 13 };
  }

  await wb.xlsx.writeFile(join(outDir, `${style}.xlsx`));
}

async function main() {
  // Args: [style] plus optional --seed=<path>[,<path>]. --seed overlays operator annotations
  // (calc_include, calslot_1..3, Notes) onto matching SKUs by SKU; never adds new SKUs.
  const argv = process.argv.slice(2);
  const orphansMode = argv.includes("--orphans");
  const seedPaths = argv
    .filter((a) => a.startsWith("--seed="))
    .flatMap((a) => a.slice("--seed=".length).split(",").map((s) => s.trim()).filter(Boolean));
  const only = argv.find((a) => !a.startsWith("--"));

  const targets = only ? STYLES.filter((s) => s.style === only) : STYLES;
  if (only && targets.length === 0) {
    console.error(`Unknown style "${only}". Known: ${STYLES.map((s) => s.style).join(", ")}`);
    process.exit(1);
  }

  const outDir = join(process.cwd(), "_reports", "slot-sheets", STAMP); // date-stamped deliverable
  mkdirSync(outDir, { recursive: true });

  // Auto-seed operator annotations (calc_include / calslot_1..3 / Notes) so they carry forward.
  // Explicit --seed=<xlsx> still uses the workbook reader; the default seeds from the curated
  // catalogue-by-style .CSV twins (the .xlsx embed images that crash exceljs's reader).
  let ann: Map<string, Ann>;
  if (seedPaths.length) {
    ann = await loadAnnotations(seedPaths);
  } else {
    const seedDir = join(process.cwd(), "_reports", "catalogue-by-style");
    const csvs = existsSync(seedDir)
      ? readdirSync(seedDir).filter((f) => f.endsWith(".csv")).map((f) => join(seedDir, f))
      : [];
    ann = csvs.length ? loadAnnotationsCsv(csvs) : new Map<string, Ann>();
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  if (orphansMode) {
    try {
      const rows = await fetchOrphans(client);
      const paths = rows.map(() => [] as string[]); // no placement → no hierarchy
      console.log(`  orphaned-skus            ${String(rows.length).padStart(4)} SKUs   (in products, NOT on storefront)`);
      const imgs = await downloadImages(rows);
      writeCsv(outDir, "orphaned-skus", rows, paths, 0, ann);
      await writeXlsx(outDir, "orphaned-skus", rows, paths, 0, imgs, ann);
    } finally {
      await client.end();
    }
    return;
  }

  const cats = await loadCategories(client);
  const counts: { style: string; prefix: string; count: number }[] = [];
  try {
    for (const { style, prefix } of targets) {
      const rows = await fetchStyle(client, prefix);
      const paths = rows.map((r) => subcatPath(r.category_slug, prefix, cats));
      const depth = paths.reduce((m, p) => Math.max(m, p.length), 0);
      const carried = ann.size ? rows.filter((r) => ann.has(r.sku)).length : 0;
      console.log(`  ${style.padEnd(24)} ${String(rows.length).padStart(4)} SKUs   (${prefix}%)${ann.size ? `  — ${carried} carried from seed` : ""}`);
      const imgs = await downloadImages(rows);
      writeCsv(outDir, style, rows, paths, depth, ann);
      await writeXlsx(outDir, style, rows, paths, depth, imgs, ann);
      counts.push({ style, prefix, count: rows.length });
    }
  } finally {
    await client.end();
  }

  // README index only when generating the full set (avoid clobbering counts on single-style runs)
  if (!only) {
    const readme = [
      "# Catalogue by style",
      "",
      "Every distinct storefront SKU per launch style, grouped by the style's category_slug",
      "prefix (`LIKE '<prefix>%'`). One row per SKU — NOT per size/finish permutation. Source:",
      "`bh_storefront` (product_placements ⋈ products), the live Vercel storefront data.",
      "",
      "Each style has an `.xlsx` (thumbnails physically embedded — render in Excel offline, no",
      "`IMAGE()` proxy) and a `.csv` (same data, image as a plain URL). Columns: `image, sku,",
      "description, subcat_1..N, retail_price_inc_gst, category_slug`. The `subcat_*` columns are",
      "the named hierarchy below the style root, from `bh_storefront.categories.display_name`.",
      "",
      "| Style | Category prefix | SKUs | Files |",
      "| --- | --- | ---: | --- |",
      ...counts.map((c) => `| ${c.style} | \`${c.prefix}\` | ${c.count} | [xlsx](${c.style}.xlsx) · [csv](${c.style}.csv) |`),
      "",
      `**Total: ${counts.reduce((a, c) => a + c.count, 0)} SKU rows across ${counts.length} styles.**`,
      "",
      "> Note: `glass-bal-channel` is defaulted to `balustrade-glass-channel-12mm` pending operator",
      "> confirmation (store also has `-15mm`). The store's `-pik / -premium-perf / -visor` ranges",
      "> have no calc style and are excluded.",
      "",
    ].join("\n");
    writeFileSync(join(outDir, "README.md"), readme + "\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
