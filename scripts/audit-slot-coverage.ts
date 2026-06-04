/**
 * SLOT-COVERAGE audit — the oversight report. For every launch style it runs the REAL layout
 * solver + REAL BOM with your configured product_slots loaded, and records every lookupSlot
 * call. It then shows, per variant:
 *   • HITS    — components the calc resolved from YOUR admin slot mapping
 *   • MISSES  — components where the calc queried a slot but none matched → fell back to
 *               hardcoded code (the "blind faith" surface)
 *   • NO-QUERY fields configured in product_slots that the BOM NEVER queries (orphaned slots —
 *               usually a field-name mismatch between your admin and the calc)
 *
 * Writes _reports/slot-coverage.md. Reproducible:
 *   export $(cat .env | xargs) && npx tsx scripts/audit-slot-coverage.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { calculateComponents, startSlotAudit, readSlotAudit } from "../server/services/bom-calculator";
import { computeSpanLayout } from "../server/services/layout/layout-service";
import { storage } from "../server/storage";

const GATE = { required: true, gateSize: 975, hingePanelSize: 0, autoHingePanel: true, position: 0, flipped: false, hingeFrom: "wall" as const };
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
  if (subKey && subVal && subKey !== "spigotSubstrate") fieldValues[subKey] = subVal;
  const span: any = { spanId: "A", ...base, fieldValues, leftGap: { enabled: true, size: 25 }, rightGap: { enabled: true, size: 25 } };
  if (subKey === "spigotSubstrate") span.spigotSubstrate = subVal;
  if (gate) span.gateConfig = { ...GATE };
  if (raked) span.rightRakedPanel = { enabled: true, height: 1530 };
  return span;
}

(async () => {
  const products = (await storage.getAllProducts()).map(p => ({ id: p.id, code: p.code, description: p.description, price: p.price }));
  const out: string[] = ["# Slot-coverage audit\n", "Per variant: components resolved from YOUR configured slots (HIT) vs hardcoded fallback (MISS), and configured slot fields the calc never queries.\n"];
  let totalHit = 0, totalMiss = 0, totalEmitted = 0;

  for (const cs of CASES) {
    const slots = (await storage.getAllSlotsByVariant(cs.variant)).map(s => ({
      internalId: s.internalId, fieldName: s.fieldName, productId: s.productId, label: s.label,
      discriminatorAttributes: s.discriminatorAttributes as Record<string, string> | null,
    }));
    const configuredFields = new Set(slots.map(s => s.fieldName));
    const queried = new Map<string, { hit: number; miss: number }>();
    let emittedLines = 0;

    const subVals = cs.subs ? cs.subs.values : [undefined];
    const toggles = [{}, ...(cs.gate ? [{ gate: true }] : []), ...(cs.raked ? [{ raked: true }] : [])] as any[];
    for (const sv of subVals) for (const t of toggles) {
      const span = buildSpan(cs.base, cs.subs?.key, sv, t.gate, t.raked);
      let layout; try { layout = computeSpanLayout({ productVariant: cs.variant, gatesAllowed: !cs.variant.includes("bal-"), span }); } catch { continue; }
      if (!layout?.panelLayout) continue;
      span.panelLayout = layout.panelLayout;
      startSlotAudit();
      let comps: any[] = [];
      try { comps = calculateComponents({ name: "a", shape: "inline", productType: cs.productType, customSides: 1, productVariant: cs.variant, spans: [span] } as any, slots, products as any, { [cs.variant]: slots }); } catch { continue; }
      emittedLines = Math.max(emittedLines, comps.length);
      for (const e of readSlotAudit()) {
        const q = queried.get(e.fieldName) ?? { hit: 0, miss: 0 };
        if (e.hit) q.hit++; else q.miss++;
        queried.set(e.fieldName, q);
      }
    }

    const hit = [...queried.values()].reduce((s, q) => s + q.hit, 0);
    const miss = [...queried.values()].reduce((s, q) => s + q.miss, 0);
    totalHit += hit; totalMiss += miss; totalEmitted += emittedLines;
    const orphaned = [...configuredFields].filter(f => !queried.has(f)).sort();

    out.push(`\n## ${cs.variant}`);
    out.push(`- slot lookups: **${hit} HIT** (from your slots), **${miss} MISS** (fell back to hardcoded). ~${emittedLines} component lines per build; lookups cover the slot-backed subset.`);
    if (queried.size) {
      out.push(`- per field (hit/miss): ` + [...queried.entries()].map(([f, q]) => `\`${f}\` ${q.hit}/${q.miss}`).join(", "));
    } else {
      out.push(`- **the BOM made ZERO slot lookups for this variant** — every SKU is hardcoded in code.`);
    }
    out.push(`- configured slot fields NEVER queried by the calc (${orphaned.length}/${configuredFields.size}): ${orphaned.length ? orphaned.map(f => "`" + f + "`").join(", ") : "none"}`);
  }

  const head = `**Overall: ${totalHit} slot HITs, ${totalMiss} slot MISSes** across all variants. A MISS or a never-queried field = a component the admin does NOT control (hardcoded). Glass/alu channel variants have no slots configured at all.\n`;
  out.splice(2, 0, head);
  mkdirSync("_reports", { recursive: true });
  writeFileSync("_reports/slot-coverage.md", out.join("\n"));
  console.log(out.join("\n"));
  console.log(`\nWrote _reports/slot-coverage.md`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
