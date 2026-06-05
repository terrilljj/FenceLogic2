/**
 * Proves the glass-pool-spigots slot table (from the v2 catalogue sheet) resolves EVERY
 * emission scenario in the emission map to exactly one real SKU — before the solver is rewired.
 * Run: npx tsx scripts/verify-pool-spigots-slots.ts
 */
import { resolveSlot, availableSizes } from "../server/services/slots/catalogue-slots";

const STYLE = "glass-pool-spigots";
let pass = 0, fail = 0;
const misses: string[] = [];
function check(label: string, q: any, expectPrefix?: string) {
  const m = resolveSlot(STYLE, q);
  const ok = !!m && (!expectPrefix || m.sku.startsWith(expectPrefix)) && !!m.category_slug;
  if (ok) { pass++; }
  else {
    fail++;
    misses.push(`${label}  →  ${m ? (m.category_slug ? `got ${m.sku}` : `${m.sku} UNPLACED`) : "NO MATCH / ambiguous"}  [q=${JSON.stringify(q)}]`);
  }
}

// ---- Spigots (core + base) × family × finish — actual catalogue finish matrix; cs3:"" so we
//      DON'T match insulating covers. Finish availability varies by family AND mounting. ----
const SPIGOTS = [
  { cs1: "Spigot-Lifestyle-Square", core: ["B", "P", "S"], base: ["B", "P", "S"] }, // Round de-ranged 2026-06-05
  { cs1: "Spigot-Madrid Pool",      core: ["B", "MW", "P", "S"], base: ["B", "MW", "P", "S"] }, // base Black now placed
  { cs1: "Spigot-Madrid",           core: ["MW", "P", "S"], base: ["B", "MW", "P", "S"] },
  { cs1: "Spigot-Rio",              core: ["MW", "P", "S"], base: ["MW", "P", "S"] },
  { cs1: "Spigot-Insuluxe",         core: ["B", "SG", "W"], base: ["B", "SG", "W"] },
];
for (const sp of SPIGOTS) {
  for (const f of sp.core) check(`spigot ${sp.cs1} core ${f}`, { cs1: sp.cs1, cs2: "Core Drilled", cs3: "", finish: f });
  for (const f of sp.base) check(`spigot ${sp.cs1} base ${f}`, { cs1: sp.cs1, cs2: "Base Plate", cs3: "", finish: f });
}

// ---- Covers: flat dress ring (cs3:"") + raised (cs3:"Raised") + slim + high ----
const COVER_FAMS = ["Spigot-Madrid", "Spigot-Rio", "Spigot-Insuluxe"]; // MadPool borrows Madrid covers
for (const cs1 of COVER_FAMS) {
  const fin = cs1 === "Spigot-Insuluxe" ? ["B", "SG", "W"] : cs1 === "Spigot-Rio" ? ["MW", "P", "S"] : ["B", "MW", "P", "S"];
  for (const f of fin) {
    check(`flat dress ring ${cs1} ${f}`, { cs1, cs2: "Dress Ring", cs3: "", finish: f });
    check(`high domical ${cs1} ${f}`, { cs1, cs2: "Domical Cover", cs3: "", finish: f });
  }
}
// raised dress ring (Madrid + Rio domed) — cosmetic option
for (const f of ["B", "P", "S"]) check(`raised dress ring Madrid ${f}`, { cs1: "Spigot-Madrid", cs2: "Dress Ring", cs3: "Raised", finish: f });
// slim domical (Madrid) — CSK only
for (const f of ["B", "MW", "P", "S"]) check(`slim domical Madrid ${f}`, { cs1: "Spigot-Madrid", cs2: "Domical Cover Slim", cs3: "", finish: f });

// ---- AS-3000 insulating covers (Madrid family; finishes B/SG/W) ----
for (const f of ["B", "SG", "W"]) {
  check(`insul cover core ${f}`, { cs1: "Spigot-Madrid", cs2: "Core Drilled", cs3: "Insulating Cover", finish: f });
  check(`insul cover base ${f}`, { cs1: "Spigot-Madrid", cs2: "Base Plate", cs3: "Insulating Cover", finish: f });
}

// ---- Panels (size-snapped) ----
for (const w of [200, 525, 1000, 1500, 1733, 2000]) check(`standard panel ~${w}`, { cs1: "Standard Panel", size_mm: w, snapSize: true }, "12N-");
for (const h of [1400, 1530, 1800]) check(`raked panel ~${h}`, { cs1: "Raked Panel", size_mm: h, snapSize: true }, "12NRP-");

// ---- Gates + hinge panels (size-snapped) ----
check("master gate ~900", { cs1: "Master Gate", cs2: "Gate Panel", cs3: "", size_mm: 900, snapSize: true }, "08SLG-");
check("softclose gate g2g ~850", { cs1: "Soft Close Gate", cs2: "Gate Panel", cs3: "Glass to Glass", size_mm: 850, snapSize: true }, "12PGG-");
check("softclose gate wall ~850", { cs1: "Soft Close Gate", cs2: "Gate Panel", cs3: "Glass to Wall/Post", size_mm: 850, snapSize: true }, "12PWG-");
check("master hinge panel ~1000", { cs1: "Master Gate", cs2: "Hinge Panel", cs3: "", size_mm: 1000, snapSize: true }, "12NH-");
check("softclose hinge panel ~1000", { cs1: "Soft Close Gate", cs2: "Hinge Panel", cs3: "", size_mm: 1000, snapSize: true }, "12NPH-");

// ---- Hinges + latches (gate hardware) ----
check("hinge atlantic g2g P", { cs1: "Hinge", cs2: "Soft Close - Atlantic", cs3: "Glass to Glass", finish: "P" });
check("hinge polaris g2g P", { cs1: "Hinge", cs2: "Soft Close - Polaris", cs3: "Glass to Glass", finish: "P" });
check("hinge polaris post/wall P", { cs1: "Hinge", cs2: "Soft Close - Polaris", cs3: "Post/Wall", finish: "P" });
check("hinge master g2g P", { cs1: "Hinge", cs2: "Master", cs3: "Glass to Glass", finish: "P" });
check("latch atlantic g2g P", { cs1: "Latch", cs2: "Atlantic", cs3: "Glass to Glass", finish: "P" });
check("latch atlantic post/wall P", { cs1: "Latch", cs2: "Atlantic", cs3: "Post/Wall", finish: "P" });
check("latch master g2g P", { cs1: "Latch", cs2: "Master", cs3: "Glass to Glass", finish: "P" });

console.log(`\nGLASS-POOL-SPIGOTS resolver verification: ${pass} pass, ${fail} fail`);
console.log(`available standard-panel sizes: ${availableSizes(STYLE, { cs1: "Standard Panel" }).length}, gate(08SLG): ${availableSizes(STYLE, { cs1: "Master Gate", cs2: "Gate Panel" }).join("/")}`);
if (misses.length) { console.log("\nMISSES:"); for (const m of misses) console.log("  ✗ " + m); }
process.exit(fail ? 1 : 0);
