/**
 * Side-mount BOM check — pool FT/BARR/Blade with substrate "side-mounted" must emit the
 * shared AIRE face-mount posts (AR-1500-FM*) + dome nuts, and NOT the normal pool posts.
 * Run: export $(cat .env | xargs) && npx tsx scripts/test-sidemount-bom.ts
 */
import { calculateComponents } from "../server/services/bom-calculator";
import type { FenceDesign } from "../shared/schema";

const layout = (panels: number[]) => ({
  panels, gaps: panels.map(() => 50),
  totalPanelWidth: panels.reduce((a, b) => a + b, 0), totalGapWidth: panels.length * 50,
  averageGap: 50, panelTypes: panels.map(() => "standard"),
});

const base = { name: "T", shape: "inline", productType: "aluminium-pool", customSides: 1 } as any;

function run(variant: string, family: string) {
  const span: any = {
    spanId: "A", length: 4000, maxPanelWidth: 2000, desiredGap: 50,
    panelLayout: layout([2000, 1800]),
    fieldValues: { [`${family}-substrate`]: "side-mounted" },
    barrFinish: "satin-black", tubularFinish: "black",
  };
  const design: FenceDesign = { ...base, productVariant: variant, spans: [span] };
  const comps = calculateComponents(design);
  const skus = comps.map((c) => c.sku || "");
  const hasAire = skus.some((s) => s.startsWith("AR-1500-FM"));
  const hasDome = skus.some((s) => s.startsWith("GS-DN-4PK"));
  const hasNormalPost = skus.some((s) => /^(SS-1\d00|BR-1\d80|BR-1800|XP-1\d00)/.test(s));
  const ok = hasAire && hasDome && !hasNormalPost;
  console.log(`${ok ? "✅" : "❌"} ${variant}: AIRE=${hasAire} dome=${hasDome} normalPost=${hasNormalPost}`);
  console.log(`    posts: ${comps.filter(c => /post|AR-1500|GS-DN/i.test(c.description) || /AR-1500|GS-DN/.test(c.sku||"")).map(c => `${c.qty}×${c.sku}`).join(", ")}`);
  return ok;
}

const r1 = run("alu-pool-tubular", "tubular");
const r2 = run("alu-pool-barr", "barr");
const r3 = run("alu-pool-blade", "blade");

if (r1 && r2 && r3) { console.log("\n✅ PASS — side-mount emits AIRE face-mount posts for all 3 pool styles."); process.exit(0); }
else { console.log("\n❌ FAIL"); process.exit(1); }
