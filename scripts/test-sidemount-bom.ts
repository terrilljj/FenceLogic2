/**
 * Side-mount BOM check — pool FT/BARR/Blade with substrate "side-mounted" must emit the
 * shared AIRE face-mount posts (AR-1500-FM*) + dome nuts, NOT the normal pool posts, and
 * (with a gate) NO cross-range gate posts — the gate's posts are AIRE, in the run total.
 * Run: export $(cat .env | xargs) && npx tsx scripts/test-sidemount-bom.ts
 */
import { calculateComponents } from "../server/services/bom-calculator";
import type { FenceDesign } from "../shared/schema";

const layout = (panels: number[], gateIdx?: number) => ({
  panels, gaps: panels.map(() => 50),
  totalPanelWidth: panels.reduce((a, b) => a + b, 0), totalGapWidth: panels.length * 50,
  averageGap: 50, panelTypes: panels.map((_, i) => (i === gateIdx ? "gate" : "standard")),
});

const base = { name: "T", shape: "inline", productType: "aluminium-pool", customSides: 1 } as any;
const results: boolean[] = [];

function run(label: string, variant: string, family: string, opts: { finish?: string; gate?: boolean } = {}) {
  const span: any = {
    spanId: "A", length: 6000, maxPanelWidth: 2000, desiredGap: 50,
    panelLayout: layout(opts.gate ? [2000, 975, 1800] : [2000, 1800], opts.gate ? 1 : undefined),
    fieldValues: { [`${family}-substrate`]: "side-mounted" },
    barrFinish: opts.finish === "white" ? "pearl-white" : "satin-black",
    tubularFinish: opts.finish || "black",
    ...(opts.gate ? { gateConfig: { required: true, gateSize: 975 } } : {}),
  };
  const design: FenceDesign = { ...base, productVariant: variant, spans: [span] };
  const comps = calculateComponents(design);
  const skus = comps.map((c) => c.sku || "");
  const aireMid = comps.filter(c => (c.sku || "").startsWith("AR-1500-FMID")).reduce((s, c) => s + c.qty, 0);
  const hasDome = skus.some((s) => s.startsWith("GS-DN-4PK"));
  const hasNormalPost = skus.some((s) => /^(SS-1\d00|BR-1\d80|BR-1800|XP-1\d00-|XP-1800)/.test(s));
  const hasGateHw = !opts.gate || skus.some(s => s.startsWith("ML-TL"));
  const ok = aireMid > 0 && hasDome && !hasNormalPost && hasGateHw;
  results.push(ok);
  console.log(`${ok ? "✅" : "❌"} ${label}: AIRE-mid=${aireMid} dome=${hasDome} normalPost=${hasNormalPost} gateHw=${hasGateHw}`);
  console.log(`    ${comps.filter(c => /AR-1500|GS-DN|ML-TL|TC-H/.test(c.sku||"")).map(c => `${c.qty}×${c.sku}`).join(", ")}`);
}

run("FT pool", "alu-pool-tubular", "tubular");
run("BARR pool", "alu-pool-barr", "barr");
run("Blade pool", "alu-pool-blade", "blade");
run("FT Monument", "alu-pool-tubular", "tubular", { finish: "monument" });
run("BARR + gate", "alu-pool-barr", "barr", { gate: true });

// Monument must use the -MN AIRE SKU.
const mn = (() => {
  const span: any = { spanId: "A", length: 4000, maxPanelWidth: 2000, desiredGap: 50,
    panelLayout: layout([2000, 1800]), tubularFinish: "monument",
    fieldValues: { "tubular-substrate": "side-mounted" } };
  const c = calculateComponents({ ...base, productVariant: "alu-pool-tubular", spans: [span] } as any);
  return c.some(x => x.sku === "AR-1500-FMID-MN");
})();
results.push(mn);
console.log(`${mn ? "✅" : "❌"} Monument uses AR-1500-FMID-MN: ${mn}`);

if (results.every(Boolean)) { console.log("\n✅ PASS"); process.exit(0); }
else { console.log("\n❌ FAIL"); process.exit(1); }
