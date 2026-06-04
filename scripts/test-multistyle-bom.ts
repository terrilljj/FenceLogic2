/**
 * Phase 3 validation — the mixed-design BOM must equal the per-variant BOMs merged.
 * Run: export $(cat .env | xargs) && npx tsx scripts/test-multistyle-bom.ts
 */
import { calculateComponents } from "../server/services/bom-calculator";
import type { FenceDesign } from "../shared/schema";

const panelLayout = (panels: number[]) => ({
  panels,
  gaps: panels.slice(1).map(() => 50),
  totalPanelWidth: panels.reduce((a, b) => a + b, 0),
  totalGapWidth: (panels.length - 1) * 50,
  averageGap: 50,
  panelTypes: panels.map(() => "standard"),
});

const spanSpigots: any = {
  spanId: "A", length: 2000, maxPanelWidth: 1000, desiredGap: 50,
  spigotMounting: "core-drilled", spigotColor: "polished",
  panelLayout: panelLayout([950, 950]),
  fieldValues: {},
};
const spanBarr: any = {
  spanId: "B", length: 2400, maxPanelWidth: 1200, desiredGap: 50,
  productVariant: "alu-pool-barr",
  panelLayout: panelLayout([1200, 1100]),
  fieldValues: { "barr-substrate": "decking", "barr-finish": "black" },
};

const base = { name: "Test", shape: "custom", productType: "glass-pool", customSides: 2 } as any;

const designA: FenceDesign = { ...base, productVariant: "glass-pool-spigots", spans: [spanSpigots] };
const designB: FenceDesign = { ...base, productVariant: "alu-pool-barr", spans: [{ ...spanBarr, productVariant: undefined }] };
const designMixed: FenceDesign = { ...base, productVariant: "glass-pool-spigots", spans: [spanSpigots, spanBarr] };

const A = calculateComponents(designA);
const B = calculateComponents(designB);
const M = calculateComponents(designMixed);

// Merge A + B by key (sku || description) summing qty — what the mixed path should produce.
const key = (c: any) => c.sku || c.description;
const expected = new Map<string, number>();
for (const c of [...A, ...B]) expected.set(key(c), (expected.get(key(c)) ?? 0) + c.qty);
const got = new Map<string, number>();
for (const c of M) got.set(key(c), (got.get(key(c)) ?? 0) + c.qty);

let ok = true;
const allKeys = new Set([...expected.keys(), ...got.keys()]);
for (const k of allKeys) {
  const e = expected.get(k) ?? 0;
  const g = got.get(k) ?? 0;
  if (e !== g) { ok = false; console.log(`  MISMATCH  ${k}: expected ${e}, got ${g}`); }
}

console.log(`spigots-only lines: ${A.length}  |  barr-only lines: ${B.length}  |  mixed lines: ${M.length}`);
console.log(`distinct keys — expected ${expected.size}, got ${got.size}`);
// Sanity: mixed must contain a Spigot line (from A) AND a BARR/Post line (from B).
const hasSpigot = M.some((c) => /spigot/i.test(c.description));
const hasBarr = M.some((c) => /barr|post/i.test(c.description));
console.log(`mixed contains spigot line: ${hasSpigot}  |  contains barr/post line: ${hasBarr}`);

if (ok && hasSpigot && hasBarr) {
  console.log("\n✅ PASS — mixed BOM equals per-variant BOMs merged, and contains lines from both styles.");
  process.exit(0);
} else {
  console.log("\n❌ FAIL");
  process.exit(1);
}
