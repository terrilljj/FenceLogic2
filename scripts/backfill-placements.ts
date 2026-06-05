/**
 * Backfill category_slug in the generated slot tables from DB-truth. Operator-added rows often
 * leave category_slug blank even though the SKU is placed; the resolver gates on category_slug,
 * so a blank wrongly reads as unplaced. This patches category_slug (only where null) to the
 * actual placement, so placement reflects the DB, not incomplete sheet entry.
 *
 * Run: export $(cat .env | xargs) && npx tsx scripts/backfill-placements.ts [<style> ...]
 * (no args = all slot tables in server/data/slots)
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import pg from "pg";

const DIR = "server/data/slots";
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => `${DIR}/${s}.slots.ts`)
  : readdirSync(DIR).filter((f) => f.endsWith(".slots.ts")).map((f) => `${DIR}/${f}`);

(async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const path of files) {
    const src = readFileSync(path, "utf8");
    const arrStart = src.indexOf("[", src.indexOf("= "));
    const arrEnd = src.lastIndexOf("]");
    if (arrStart < 0 || arrEnd < 0) { console.log(`skip ${path} (no array)`); continue; }
    const rows = JSON.parse(src.slice(arrStart, arrEnd + 1));
    const need = [...new Set(rows.filter((r: any) => !r.category_slug).map((r: any) => r.sku))];
    if (!need.length) { console.log(`${path}: nothing to backfill`); continue; }
    const r = await client.query(
      `SELECT pp.sku, MIN(pp.category_slug) AS cat FROM bh_storefront.product_placements pp WHERE pp.sku = ANY($1) GROUP BY pp.sku`,
      [need]);
    const cat = new Map(r.rows.map((x: any) => [x.sku, x.cat]));
    let filled = 0;
    for (const row of rows) if (!row.category_slug && cat.get(row.sku)) { row.category_slug = cat.get(row.sku); filled++; }
    const body = rows.map((x: any) => "  " + JSON.stringify(x)).join(",\n");
    writeFileSync(path, src.slice(0, arrStart) + "[\n" + body + "\n]" + src.slice(arrEnd + 1));
    const stillBlank = rows.filter((x: any) => !x.category_slug).map((x: any) => x.sku);
    console.log(`${path}: backfilled ${filled}${stillBlank.length ? `  STILL-UNPLACED: ${stillBlank.join(", ")}` : ""}`);
  }
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
