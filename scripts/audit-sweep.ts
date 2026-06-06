/**
 * COMPREHENSIVE BOM SWEEP — the parity/completeness oracle the original audit-skus.ts could
 * not be. audit-skus.ts proves every EMITTED SKU is sellable, but only across ~12 base configs
 * and it NEVER sets span.handrail, so the entire balustrade top-rail surface (35-Series +
 * NonoRail, every finish, every termination) is untested, plus most substrate/finish/gate
 * branches. This sweep drives EVERY style across its full realistic input matrix (the exact
 * vocab the UI emits) and reports two failure classes per config:
 *
 *   [UNMAPPED]      — a slot the emitter tried to resolve but couldn't (no match, ambiguous
 *                     >1-SKU match, or resolved-but-UNPLACED). Surfaces as sku:"UNMAPPED".
 *   non-sellable    — an emitted real SKU that is PHANTOM / UNPLACED / NO-PRICE in bh_storefront.
 *
 * A green sweep = "every realistic customer configuration emits only real, buyable SKUs, with
 * nothing silently dropped." That is the gate the native port must hold to.
 *
 *   export $(cat .env | xargs) && npx tsx scripts/audit-sweep.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import pg from "pg";
import { calculateComponents } from "../server/services/bom-calculator";
import { computeSpanLayout } from "../server/services/layout/layout-service";

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// ---- per-style scaffolding ----------------------------------------------------------------
const PRODUCT_TYPE: Record<string, string> = {
  "glass-pool-spigots": "glass-pool", "glass-pool-channel": "glass-pool",
  "glass-bal-spigots-12mm": "glass-balustrade", "glass-bal-spigots-15mm": "glass-balustrade",
  "glass-bal-channel": "glass-balustrade", "glass-bal-channel-hd": "glass-balustrade",
  "glass-bal-standoffs": "glass-balustrade",
  "alu-pool-tubular": "aluminium-pool", "alu-pool-barr": "aluminium-pool", "alu-pool-blade": "aluminium-pool",
  "alu-bal-barr": "aluminium-balustrade", "alu-bal-blade": "aluminium-balustrade",
};
const gatesAllowed = (variant: string) => !variant.includes("bal-");

function baseSpan(length: number, maxPanelWidth: number): any {
  return {
    spanId: "A", length, maxPanelWidth, desiredGap: 50,
    leftGap: { enabled: true, size: 25 }, rightGap: { enabled: true, size: 25 },
    fieldValues: {},
  };
}
const GATE = (over: any = {}) => ({
  required: true, gateSize: 975, hingePanelSize: 0, autoHingePanel: true,
  position: 0, flipped: false, hingeFrom: "wall", hardware: "polaris",
  hingeType: "glass-to-glass", latchType: "glass-to-glass", ...over,
});

// one-axis-at-a-time generator: baseline + every value of every axis applied independently.
type Axis = { name: string; values: { label: string; apply: (s: any) => void }[] };
function oat(mk: () => any, axes: Axis[]): { label: string; span: any }[] {
  const out = [{ label: "baseline", span: mk() }];
  for (const ax of axes) for (const v of ax.values) {
    const s = mk(); v.apply(s); out.push({ label: `${ax.name}=${v.label}`, span: s });
  }
  return out;
}
// balustrade rail matrix: type × finish × termination (start=end=term) + one mixed + disabled.
function railMatrix(mk: () => any, byType: { type: string; finishes: string[] }[], terms: string[]): { label: string; span: any }[] {
  const out: { label: string; span: any }[] = [];
  for (const t of byType) for (const f of t.finishes) for (const term of terms) {
    const s = mk();
    s.handrail = { enabled: true, type: t.type, finish: f, startTermination: term, endTermination: term };
    out.push({ label: `rail ${t.type}/${f}/${term}`, span: s });
  }
  // mixed terminations + rail disabled
  const m = mk(); m.handrail = { enabled: true, type: byType[0].type, finish: byType[0].finishes[0], startTermination: "wall-tie", endTermination: "90-degree" };
  out.push({ label: "rail mixed-term", span: m });
  const d = mk(); d.handrail = { enabled: false }; out.push({ label: "rail disabled", span: d });
  return out;
}

// ---- per-style config sets ----------------------------------------------------------------
function configsFor(variant: string): { label: string; span: any }[] {
  switch (variant) {
    case "glass-pool-spigots": {
      const mk = () => { const s = baseSpan(6000, 2000); Object.assign(s, { spigotMounting: "base-plate", spigotColor: "polished", spigotSubstrate: "concrete" }); s.fieldValues = { "spigot-family": "madrid-pool", "as-3000": "false" }; return s; };
      const cfgs = oat(mk, [
        { name: "family", values: ["madrid-pool", "madrid", "insuluxe", "rio", "lifestyle"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["spigot-family"] = f })) },
        { name: "color", values: ["polished", "satin", "black", "white"].map(c => ({ label: c, apply: (s: any) => s.spigotColor = c })) },
        { name: "mounting", values: ["base-plate", "core-drilled"].map(m => ({ label: m, apply: (s: any) => s.spigotMounting = m })) },
        { name: "cover", values: ["dress-flat", "dress-raised", "dome-slim", "dome-high"].map(c => ({ label: c, apply: (s: any) => s.fieldValues["spigot-cover"] = c })) },
        { name: "fix", values: [
          { label: "core-grout", apply: (s: any) => s.spigotMounting = "core-drilled" },
          { label: "base-concrete", apply: (s: any) => { s.spigotMounting = "base-plate"; s.spigotSubstrate = "concrete"; } },
          { label: "base-timber-lag", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "lag"; } },
          { label: "base-timber-csk", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "csk"; } },
          { label: "base-steel", apply: (s: any) => s.spigotSubstrate = "steel" },
        ] },
        { name: "as3000", values: [
          { label: "insuluxe", apply: (s: any) => { s.fieldValues["as-3000"] = "true"; s.fieldValues["spigot-family"] = "insuluxe"; } },
          { label: "madrid-pool-hidden", apply: (s: any) => { s.fieldValues["as-3000"] = "true"; s.fieldValues["spigot-family"] = "madrid-pool"; } },
          { label: "madrid-hidden", apply: (s: any) => { s.fieldValues["as-3000"] = "true"; s.fieldValues["spigot-family"] = "madrid"; } },
        ] },
        { name: "gate", values: [
          { label: "polaris-g2g", apply: (s: any) => s.gateConfig = GATE() },
          { label: "polaris-wall", apply: (s: any) => s.gateConfig = GATE({ hingeType: "glass-to-wall", latchType: "glass-to-wall" }) },
          { label: "polaris-white", apply: (s: any) => { s.spigotColor = "white"; s.gateConfig = GATE(); } },
          { label: "master", apply: (s: any) => s.gateConfig = GATE({ hardware: "master" }) },
          { label: "master-black", apply: (s: any) => { s.spigotColor = "black"; s.gateConfig = GATE({ hardware: "master" }); } },
        ] },
        { name: "raked", values: [
          { label: "right", apply: (s: any) => s.rightRakedPanel = { enabled: true, height: 1500 } },
          { label: "left", apply: (s: any) => s.leftRakedPanel = { enabled: true, height: 1600 } },
        ] },
      ]);
      // silver-grey only valid on insuluxe
      const sg = mk(); sg.fieldValues["spigot-family"] = "insuluxe"; sg.spigotColor = "silver-grey"; cfgs.push({ label: "insuluxe/silver-grey", span: sg });
      // FULL gate-hardware matrix: hardware × hingeType × latchType × finish — the surface that
      // hid the latch-mapping + finish-code bugs (OAT alone only tested the default latch).
      for (const hardware of ["polaris", "master"]) {
        for (const hingeType of ["glass-to-glass", "glass-to-wall"]) {
          for (const latchType of ["glass-to-glass", "glass-to-wall", "corner-out", "corner-in"]) {
            for (const color of ["black", "white", "satin"]) {
              const g = mk(); g.spigotColor = color;
              g.gateConfig = GATE({
                hardware, hingeType, latchType,
                hingeFrom: hingeType === "glass-to-glass" ? "glass" : "wall",
                latchTo: latchType === "glass-to-glass" ? "glass" : "wall",
              });
              cfgs.push({ label: `gate ${hardware}/${hingeType}/${latchType}/${color}`, span: g });
            }
          }
        }
      }
      const cust = mk(); cust.customPanel = { enabled: true, width: 900, height: 1200, position: 1 };
      cfgs.push({ label: "custom-panel", span: cust });
      return cfgs;
    }
    case "glass-pool-channel": {
      const mk = () => { const s = baseSpan(5000, 2000); Object.assign(s, { channelMounting: "ground", spigotSubstrate: "concrete", spigotColor: "satin" }); s.fieldValues = { "channel-finish": "satin-anodised" }; return s; };
      return oat(mk, [
        { name: "channel-finish", values: ["satin-anodised", "satin", "black"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["channel-finish"] = f })) },
        { name: "substrate", values: ["concrete", "timber", "steel"].map(x => ({ label: x, apply: (s: any) => s.spigotSubstrate = x })) },
        { name: "term", values: ["end-cap", "mitre"].map(t => ({ label: t, apply: (s: any) => { s.fieldValues["channel-term-lhs"] = t; s.fieldValues["channel-term-rhs"] = t; } })) },
        { name: "gate", values: [
          { label: "polaris", apply: (s: any) => s.gateConfig = GATE() },
          { label: "master", apply: (s: any) => s.gateConfig = GATE({ hardware: "master" }) },
        ] },
      ]);
    }
    case "glass-bal-spigots-12mm": {
      const mk = () => { const s = baseSpan(5000, 1500); Object.assign(s, { spigotMounting: "base-plate", spigotColor: "polished", spigotSubstrate: "concrete" }); s.fieldValues = { "spigot-family": "madrid", "glass-bal-fall-height": "1m-5m" }; s.handrail = { enabled: true, type: "nonorail-25x21", finish: "polished", startTermination: "end-cap", endTermination: "end-cap" }; return s; };
      const cfgs = oat(mk, [
        { name: "family", values: ["madrid", "nova"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["spigot-family"] = f })) },
        { name: "color", values: ["polished", "satin", "black", "white"].map(c => ({ label: c, apply: (s: any) => s.spigotColor = c })) },
        { name: "fix", values: [
          { label: "core", apply: (s: any) => s.spigotMounting = "core-drilled" },
          { label: "concrete", apply: (s: any) => s.spigotSubstrate = "concrete" },
          { label: "timber-lag", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "lag"; } },
          { label: "timber-csk", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "csk"; } },
          { label: "steel", apply: (s: any) => s.spigotSubstrate = "steel" },
        ] },
        { name: "fall", values: ["under-1m", "1m-5m", "over-5m"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["glass-bal-fall-height"] = f })) },
      ]);
      return cfgs.concat(railMatrix(mk, [
        { type: "nonorail-25x21", finishes: ["polished", "satin", "black", "white"] },
        { type: "series-35x35", finishes: ["satin", "black", "white"] },
      ], ["end-cap", "wall-tie", "90-degree", "adjustable-corner"]));
    }
    case "glass-bal-spigots-15mm": {
      const mk = () => { const s = baseSpan(5000, 1400); Object.assign(s, { spigotMounting: "base-plate", spigotColor: "satin", spigotSubstrate: "concrete" }); s.fieldValues = { "spigot-family": "madrid-deluxe", "glass-bal-fall-height": "1m-5m" }; s.handrail = { enabled: true, type: "series-35x35", finish: "satin", startTermination: "end-cap", endTermination: "end-cap" }; return s; };
      const cfgs = oat(mk, [
        { name: "color", values: ["polished", "satin", "black", "white"].map(c => ({ label: c, apply: (s: any) => s.spigotColor = c })) },
        { name: "fix", values: [
          { label: "core", apply: (s: any) => s.spigotMounting = "core-drilled" },
          { label: "concrete", apply: (s: any) => s.spigotSubstrate = "concrete" },
          { label: "timber-lag", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "lag"; } },
          { label: "timber-csk", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["fixing-method"] = "csk"; } },
          { label: "steel", apply: (s: any) => s.spigotSubstrate = "steel" },
        ] },
        { name: "fall", values: ["under-1m", "1m-5m", "over-5m"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["glass-bal-fall-height"] = f })) },
      ]);
      return cfgs.concat(railMatrix(mk, [{ type: "series-35x35", finishes: ["satin", "black", "white"] }], ["end-cap", "wall-tie", "90-degree", "adjustable-corner"]));
    }
    case "glass-bal-channel":
    case "glass-bal-channel-hd": {
      const mpw = variant === "glass-bal-channel-hd" ? 1200 : 1400;
      const mk = () => { const s = baseSpan(5000, mpw); Object.assign(s, { channelMounting: "ground", spigotSubstrate: "concrete" }); s.fieldValues = { "channel-finish": "satin-anodised" }; s.handrail = { enabled: true, type: "series-35x35", finish: "satin", startTermination: "end-cap", endTermination: "end-cap" }; return s; };
      const cfgs = oat(mk, [
        { name: "channel-finish", values: ["satin-anodised", "satin", "black"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["channel-finish"] = f })) },
        { name: "substrate", values: ["concrete", "timber", "steel"].map(x => ({ label: x, apply: (s: any) => s.spigotSubstrate = x })) },
      ]);
      return cfgs.concat(railMatrix(mk, [{ type: "series-35x35", finishes: ["satin", "black"] }], ["end-cap", "wall-tie", "90-degree", "adjustable-corner"]));
    }
    case "glass-bal-standoffs": {
      const mk = () => { const s = baseSpan(5000, 1200); Object.assign(s, { spigotColor: "polished", spigotSubstrate: "timber" }); s.fieldValues = { "standoff-body": "adjustable", "standoff-depth": "30", "standoff-cladding": "direct", "rail-finish-match": "true" }; s.handrail = { enabled: true, type: "series-35x35", finish: "satin", startTermination: "end-cap", endTermination: "end-cap" }; return s; };
      const cfgs = oat(mk, [
        { name: "body", values: [
          { label: "adj-30", apply: (s: any) => { s.fieldValues["standoff-body"] = "adjustable"; s.fieldValues["standoff-depth"] = "30"; } },
          { label: "adj-45", apply: (s: any) => { s.fieldValues["standoff-body"] = "adjustable"; s.fieldValues["standoff-depth"] = "45"; } },
          { label: "fixed-20", apply: (s: any) => { s.fieldValues["standoff-body"] = "fixed"; s.fieldValues["standoff-depth"] = "20"; s.spigotColor = "black"; } },
          { label: "fixed-30", apply: (s: any) => { s.fieldValues["standoff-body"] = "fixed"; s.fieldValues["standoff-depth"] = "30"; } },
          { label: "fixed-50", apply: (s: any) => { s.fieldValues["standoff-body"] = "fixed"; s.fieldValues["standoff-depth"] = "50"; s.spigotColor = "black"; } },
        ] },
        { name: "color", values: ["polished", "satin", "black"].map(c => ({ label: c, apply: (s: any) => s.spigotColor = c })) },
        { name: "substrate", values: [
          { label: "timber-direct", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["standoff-cladding"] = "direct"; } },
          { label: "timber-cladding", apply: (s: any) => { s.spigotSubstrate = "timber"; s.fieldValues["standoff-cladding"] = "cladding"; } },
          { label: "concrete-direct", apply: (s: any) => { s.spigotSubstrate = "concrete"; s.fieldValues["standoff-cladding"] = "direct"; } },
          { label: "concrete-cladding", apply: (s: any) => { s.spigotSubstrate = "concrete"; s.fieldValues["standoff-cladding"] = "cladding"; } },
          { label: "steel-drill-tap", apply: (s: any) => { s.spigotSubstrate = "steel"; s.fieldValues["standoff-steel-method"] = "drill-tap"; } },
          { label: "steel-through", apply: (s: any) => { s.spigotSubstrate = "steel"; s.fieldValues["standoff-steel-method"] = "through"; } },
        ] },
      ]);
      return cfgs.concat(railMatrix(mk, [{ type: "series-35x35", finishes: ["satin", "black", "white"] }], ["end-cap", "wall-tie", "90-degree", "adjustable-corner"]));
    }
    case "alu-pool-tubular": {
      const mk = () => { const s = baseSpan(6000, 2450); Object.assign(s, { tubularFinish: "black", tubularPanelWidth: "2450mm" }); s.fieldValues = { "tubular-substrate": "decking", "tubular-angled-corners": "0" }; return s; };
      return oat(mk, [
        { name: "finish", values: ["black", "white", "monument"].map(f => ({ label: f, apply: (s: any) => s.tubularFinish = f })) },
        { name: "panel-3000", values: [{ label: "black-3000", apply: (s: any) => { s.tubularFinish = "black"; s.tubularPanelWidth = "3000mm"; } }] },
        { name: "substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled"].map(x => ({ label: x, apply: (s: any) => s.fieldValues["tubular-substrate"] = x })) },
        { name: "side-mount", values: ["timber", "concrete", "steel"].map(m => ({ label: m, apply: (s: any) => { s.fieldValues["tubular-substrate"] = "side-mounted"; s.fieldValues["tubular-material"] = m; } })) },
        { name: "corners", values: ["1", "2"].map(c => ({ label: c, apply: (s: any) => s.fieldValues["tubular-angled-corners"] = c })) },
        { name: "gate", values: [
          { label: "black", apply: (s: any) => { s.tubularFinish = "black"; s.gateConfig = GATE(); } },
          { label: "white", apply: (s: any) => { s.tubularFinish = "white"; s.gateConfig = GATE(); } },
          { label: "monument", apply: (s: any) => { s.tubularFinish = "monument"; s.gateConfig = GATE(); } },
        ] },
      ]);
    }
    case "alu-pool-barr": {
      const mk = () => { const s = baseSpan(6000, 2205); Object.assign(s, { barrFinish: "satin-black" }); s.fieldValues = { "barr-substrate": "decking" }; return s; };
      return oat(mk, [
        { name: "finish", values: ["satin-black", "pearl-white"].map(f => ({ label: f, apply: (s: any) => s.barrFinish = f })) },
        { name: "substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled"].map(x => ({ label: x, apply: (s: any) => s.fieldValues["barr-substrate"] = x })) },
        { name: "side-mount", values: ["timber", "concrete", "steel"].map(m => ({ label: m, apply: (s: any) => { s.fieldValues["barr-substrate"] = "side-mounted"; s.fieldValues["barr-material"] = m; } })) },
        { name: "gate", values: [
          { label: "black", apply: (s: any) => { s.barrFinish = "satin-black"; s.gateConfig = GATE(); } },
          { label: "white", apply: (s: any) => { s.barrFinish = "pearl-white"; s.gateConfig = GATE(); } },
        ] },
      ]);
    }
    case "alu-pool-blade": {
      const mk = () => { const s = baseSpan(6000, 2200); s.fieldValues = { "blade-substrate": "decking" }; return s; };
      return oat(mk, [
        { name: "substrate", values: ["decking", "concrete-slab", "in-ground", "core-drilled"].map(x => ({ label: x, apply: (s: any) => s.fieldValues["blade-substrate"] = x })) },
        { name: "side-mount", values: ["timber", "concrete", "steel"].map(m => ({ label: m, apply: (s: any) => { s.fieldValues["blade-substrate"] = "side-mounted"; s.fieldValues["blade-material"] = m; } })) },
        { name: "gate", values: [{ label: "black", apply: (s: any) => s.gateConfig = GATE() }] },
      ]);
    }
    case "alu-bal-barr": {
      const mk = () => { const s = baseSpan(6000, 1733); Object.assign(s, { balBarrFinish: "black" }); s.fieldValues = { "bal-substrate": "base-plated", "bal-fall-height": "over-1m", "bal-corners": "0" }; return s; };
      return oat(mk, [
        { name: "finish", values: ["black", "white"].map(f => ({ label: f, apply: (s: any) => s.balBarrFinish = f })) },
        { name: "substrate", values: [
          { label: "core-drilled", apply: (s: any) => s.fieldValues["bal-substrate"] = "core-drilled" },
          { label: "base-plated", apply: (s: any) => s.fieldValues["bal-substrate"] = "base-plated" },
          { label: "face-timber", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "timber"; } },
          { label: "face-concrete", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "concrete"; } },
          { label: "face-steel", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "steel"; } },
        ] },
        { name: "fall", values: ["under-1m", "over-1m"].map(f => ({ label: f, apply: (s: any) => s.fieldValues["bal-fall-height"] = f })) },
        { name: "corners", values: ["1", "2"].map(c => ({ label: c, apply: (s: any) => s.fieldValues["bal-corners"] = c })) },
      ]);
    }
    case "alu-bal-blade": {
      const mk = () => { const s = baseSpan(6000, 1700); s.fieldValues = { "bal-substrate": "base-plated", "bal-corners": "0" }; return s; };
      return oat(mk, [
        { name: "substrate", values: [
          { label: "core-drilled", apply: (s: any) => s.fieldValues["bal-substrate"] = "core-drilled" },
          { label: "base-plated", apply: (s: any) => s.fieldValues["bal-substrate"] = "base-plated" },
          { label: "face-timber", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "timber"; } },
          { label: "face-concrete", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "concrete"; } },
          { label: "face-steel", apply: (s: any) => { s.fieldValues["bal-substrate"] = "face-mounted"; s.fieldValues["bal-material"] = "steel"; } },
        ] },
        { name: "corners", values: ["1", "2"].map(c => ({ label: c, apply: (s: any) => s.fieldValues["bal-corners"] = c })) },
      ]);
    }
    default: return [];
  }
}

// ---- extended-coverage helpers ----------------------------------------------------------
const STYLE_MPW: Record<string, number> = {
  "glass-pool-spigots": 2000, "glass-pool-channel": 2000, "glass-bal-spigots-12mm": 1500,
  "glass-bal-spigots-15mm": 1400, "glass-bal-channel": 1400, "glass-bal-channel-hd": 1200,
  "glass-bal-standoffs": 1200, "alu-pool-tubular": 2450, "alu-pool-barr": 2205,
  "alu-pool-blade": 2200, "alu-bal-barr": 1733, "alu-bal-blade": 1700,
};
// Pure-defaults span: empty fieldValues, no finish/substrate/handrail → the emitter must
// produce a complete, sellable BOM from its OWN defaults alone (what a user accepting every
// UI default gets). Catches UI↔emitter default mismatches like the bal-material bug.
function unsetSpan(style: string): any { return baseSpan(5000, STYLE_MPW[style] ?? 1500); }

// 2-section L-shape designs (1 corner) — exercises corner/section-join resolution per family.
function specialDesigns(): { style: string; label: string; design: any }[] {
  const out: { style: string; label: string; design: any }[] = [];
  const corner = (style: string, mk: () => any) => {
    const a = mk(); a.spanId = "A"; const b = mk(); b.spanId = "B";
    out.push({ style, label: "L-shape 2-section", design: { shape: "l-shape", customSides: 2, spans: [a, b] } });
  };
  corner("alu-pool-barr", () => { const s = baseSpan(4000, 2205); s.barrFinish = "satin-black"; s.fieldValues = { "barr-substrate": "core-drilled" }; s.gateConfig = GATE(); return s; });
  corner("alu-bal-barr", () => { const s = baseSpan(4000, 1733); s.balBarrFinish = "black"; s.fieldValues = { "bal-substrate": "core-drilled", "bal-fall-height": "over-1m", "bal-material": "concrete" }; return s; });
  corner("alu-bal-blade", () => { const s = baseSpan(4000, 1700); s.fieldValues = { "bal-substrate": "core-drilled", "bal-material": "concrete" }; return s; });
  corner("glass-pool-spigots", () => { const s = baseSpan(4000, 2000); s.spigotColor = "black"; s.spigotMounting = "core-drilled"; s.fieldValues = { "spigot-family": "madrid-pool" }; return s; });
  return out;
}

// ---- run ----------------------------------------------------------------------------------
type Miss = { style: string; config: string; detail: string };
(async () => {
  const STYLES = Object.keys(PRODUCT_TYPE);
  const emitted = new Map<string, { styles: Set<string>; desc: string; sample: string }>();
  const unmapped: Miss[] = [];
  const layoutErrors: Miss[] = [];
  let totalConfigs = 0;
  const perStyle: Record<string, { configs: number; unmapped: number; errors: number }> = {};
  for (const s of STYLES) perStyle[s] = { configs: 0, unmapped: 0, errors: 0 };

  // Run one full design (spans pre-layout) through the REAL layout solver + BOM, record results.
  const runOne = (style: string, label: string, design: any): void => {
    totalConfigs++; perStyle[style].configs++;
    const spans: any[] = [];
    for (const sp of design.spans) {
      let layout: any;
      try { layout = computeSpanLayout({ productVariant: style, gatesAllowed: gatesAllowed(style), span: sp }); }
      catch (e: any) { layoutErrors.push({ style, config: label, detail: `layout: ${e.message}` }); perStyle[style].errors++; return; }
      if (!layout?.panelLayout) { layoutErrors.push({ style, config: label, detail: "layout: no panelLayout" }); perStyle[style].errors++; return; }
      const s2 = clone(sp); s2.panelLayout = layout.panelLayout; spans.push(s2);
    }
    let comps: any[] = [];
    try { comps = calculateComponents({ name: "sweep", shape: design.shape || "inline", productType: PRODUCT_TYPE[style], customSides: design.customSides ?? 1, productVariant: style, spans } as any); }
    catch (e: any) { layoutErrors.push({ style, config: label, detail: `bom: ${e.message}` }); perStyle[style].errors++; return; }
    for (const c of comps) {
      if (!c.sku) continue;
      if (c.sku === "UNMAPPED") { unmapped.push({ style, config: label, detail: c.description.replace(/^\[UNMAPPED\]\s*/, "") }); perStyle[style].unmapped++; continue; }
      const e = emitted.get(c.sku) ?? { styles: new Set<string>(), desc: c.description, sample: `${style}:${label}` };
      e.styles.add(style); emitted.set(c.sku, e);
    }
  };

  // PASS 1 — per-style single-span matrix (OAT + rails + gate + the full gate-hardware cross).
  // PASS 2 — UNSET-DEFAULTS: empty fieldValues → exercises the emitter's OWN defaults.
  for (const style of STYLES) {
    for (const { label, span } of configsFor(style)) runOne(style, label, { spans: [span] });
    runOne(style, "unset-defaults", { spans: [unsetSpan(style)] });
  }
  // PASS 3 — multi-span L-shape corners (resolution across a real corner / section join).
  for (const { style, label, design } of specialDesigns()) runOne(style, label, design);

  // classify every distinct emitted real SKU against the catalogue
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
    return { sku, status, price: cr?.price ?? null, styles: [...e.styles].join(" "), sample: e.sample, desc: e.desc };
  });
  const bad = rows.filter((x) => x.status !== "✅ SELLABLE");

  // ---- report -------------------------------------------------------------------------------
  const tally = (s: string) => rows.filter((x) => x.status === s).length;
  const head = `SWEEP: ${totalConfigs} configs · ${rows.length} distinct SKUs · SELLABLE ${tally("✅ SELLABLE")} · UNPLACED ${tally("🟡 UNPLACED")} · NO-PRICE ${tally("🟠 NO PRICE")} · PHANTOM ${tally("🔴 PHANTOM")} · UNMAPPED ${unmapped.length} · LAYOUT-ERR ${layoutErrors.length}`;
  console.log("\n=== BOM SWEEP (full input matrix) ===\n" + head + "\n");
  console.log("Per-style:");
  for (const st of STYLES) console.log(`  ${st.padEnd(24)} ${perStyle[st].configs} cfg · ${perStyle[st].unmapped} unmapped · ${perStyle[st].errors} err`);
  if (layoutErrors.length) { console.log("\nLAYOUT/BOM ERRORS:"); for (const m of layoutErrors) console.log(`  ${m.style} [${m.config}] ${m.detail}`); }
  if (unmapped.length) {
    console.log("\nUNMAPPED (slot the emitter could not resolve):");
    const byStyle = new Map<string, Miss[]>(); for (const m of unmapped) { (byStyle.get(m.style) ?? byStyle.set(m.style, []).get(m.style)!).push(m); }
    for (const [st, ms] of byStyle) { console.log(`  ${st}:`); for (const m of ms) console.log(`    [${m.config}] ${m.detail}`); }
  }
  if (bad.length) { console.log("\nNON-SELLABLE EMITTED SKUs:"); for (const b of bad) console.log(`  ${b.status} ${b.sku} (${b.sample}) ${b.desc.slice(0, 50)}`); }
  if (!unmapped.length && !bad.length && !layoutErrors.length) console.log("\n✅ CLEAN — every config emits only sellable SKUs, nothing unmapped.");

  // markdown + csv
  mkdirSync("_reports", { recursive: true });
  const md = [`# BOM sweep (full input matrix)\n`, `${head}\n`,
    `## Per-style`, `| Style | Configs | Unmapped | Errors |`, `|---|---|---|---|`,
    ...STYLES.map(st => `| ${st} | ${perStyle[st].configs} | ${perStyle[st].unmapped} | ${perStyle[st].errors} |`),
    unmapped.length ? `\n## UNMAPPED\n| Style | Config | Missing slot |\n|---|---|---|\n${unmapped.map(m => `| ${m.style} | ${m.config} | ${m.detail.replace(/\|/g, "/")} |`).join("\n")}` : `\n## UNMAPPED\n_none_`,
    layoutErrors.length ? `\n## Layout/BOM errors\n${layoutErrors.map(m => `- ${m.style} [${m.config}] ${m.detail}`).join("\n")}` : ``,
    bad.length ? `\n## Non-sellable SKUs\n| Status | SKU | Sample config | Description |\n|---|---|---|---|\n${bad.map(b => `| ${b.status} | \`${b.sku}\` | ${b.sample} | ${b.desc.replace(/\|/g, "/").slice(0, 70)} |`).join("\n")}` : `\n## Non-sellable SKUs\n_none_`,
  ].join("\n");
  writeFileSync("_reports/sku-sweep.md", md);
  writeFileSync("_reports/sku-sweep.csv", "kind,style,config,detail\n" +
    [...unmapped.map(m => `UNMAPPED,${m.style},"${m.config}","${m.detail.replace(/"/g, "'")}"`),
     ...bad.map(b => `${b.status.replace(/[^A-Z]/g, "")},${b.styles},"${b.sample}","${b.sku}"`)].join("\n"));
  console.log(`\nWrote _reports/sku-sweep.md + .csv`);
  process.exit(unmapped.length + bad.length + layoutErrors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
