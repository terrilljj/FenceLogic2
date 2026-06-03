import { describe, it, expect } from "vitest";
import { calculateCentredGateLayout } from "../services/layout/panelCalculations";

/**
 * Owner-rule regression suite for the centred-gate solver (Set position mode).
 *
 * Every test here encodes a rule the owner stated while hands-on testing, plus the
 * screenshot bug that motivated it:
 *  - Image 24:    glass must never split unnecessarily (700+750 where one 1550 fits)
 *  - Images 25/26: flipping the gate must keep the hinge panel matched to the standard
 *                  panels beside it (never a 600 hinge next to 1700s)
 *  - SS21-23:     flipping must not fragment the hinge side
 *  - 1500-skip:   nudging through positions must reach every stock hinge size
 *  - Stock rule:  hinge panels are stock widths only (600,800,1000..1800)
 *  - Slivers:     no glass piece under 500mm
 *  - Drift:       ≤25mm honoured freely; ≤100mm only to make a side whole or fix
 *                 a hinge-match violation — never for far-side panel-count savings
 */

const STOCK = [600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];

type Solved = {
  str: string;
  achieved: number;
  hinge: number | undefined;
  hingeIdx: number;
  gateIdx: number;
  leftPieces: number;
  rightPieces: number;
  panels: number[];
  types: string[];
  gaps: number[];
};

function solve(
  centre: number,
  flipped: boolean,
  spanLength = 8000,
  gateSize = 900,
): Solved | null {
  const r = calculateCentredGateLayout({
    spanLength,
    leftEndGap: 25,
    rightEndGap: 25,
    desiredGap: 50,
    maxPanelWidth: 1800,
    gateConfig: {
      gateSize,
      hingePanelSize: 1300,
      flipped,
      hingeGap: 8,
      latchGap: 9,
      autoHingePanel: true,
      centreFromLeft: centre,
    },
  });
  if (!r || !r.panelTypes) return null;
  let x = 25;
  let achieved = 0;
  for (let i = 0; i < r.panels.length; i++) {
    if (r.panelTypes[i] === "gate") {
      achieved = x + r.panels[i] / 2;
      break;
    }
    x += r.panels[i] + (r.gaps[i] ?? 0);
  }
  const gateIdx = r.panelTypes.indexOf("gate");
  const hingeIdx = r.panelTypes.indexOf("hinge");
  return {
    str: r.panels
      .map((p, i) => `${p}${r.panelTypes![i] === "gate" ? "G" : r.panelTypes![i] === "hinge" ? "H" : ""}`)
      .join("/"),
    achieved,
    hinge: hingeIdx === -1 ? undefined : r.panels[hingeIdx],
    hingeIdx,
    gateIdx,
    leftPieces: gateIdx,
    rightPieces: r.panels.length - gateIdx - 1,
    panels: r.panels,
    types: r.panelTypes,
    gaps: r.gaps,
  };
}

/** Hinge panel must be within one 50mm step of every standard panel on ITS side. */
function hingeSidePanels(s: Solved): number[] {
  return s.hingeIdx < s.gateIdx ? s.panels.slice(0, s.gateIdx) : s.panels.slice(s.gateIdx + 1);
}
function hingeMatchDeviation(s: Solved): number {
  if (s.hingeIdx === -1) return 0;
  return Math.max(...hingeSidePanels(s).map((p) => Math.abs(p - s.hinge!)));
}

describe("centred-gate solver — owner rules", () => {
  it("IMAGE 24: latch side is one panel when one fits (700+750 → 1550)", () => {
    const s = solve(2017, false)!;
    expect(s.leftPieces, s.str).toBe(1);
  });

  it("IMAGE 25: hinge alone on its side takes the size the space dictates", () => {
    const s = solve(1683, true)!;
    expect(s.hinge, s.str).toBe(1200);
    expect(s.leftPieces, s.str).toBe(1);
  });

  it("IMAGE 26: after flip, hinge matches the standards beside it (never 600 vs 1700s)", () => {
    const s = solve(1684, false)!;
    expect(hingeMatchDeviation(s), s.str).toBeLessThanOrEqual(50);
    expect(s.leftPieces, s.str).toBe(1); // latch side stays whole
  });

  it("flip round-trip returns to the original layout", () => {
    const a = solve(1683, true)!;
    const b = solve(a.achieved + 1, false)!;
    const c = solve(b.achieved, true)!;
    expect(Math.abs(c.achieved - 1683), `${a.str} -> ${b.str} -> ${c.str}`).toBeLessThanOrEqual(100);
  });

  it("1500-SKIP: every stock hinge size is reachable when sweeping positions", () => {
    const seen = new Set<number>();
    for (let ask = 1000; ask <= 2400; ask += 10) {
      const s = solve(ask, true);
      if (s?.hinge) seen.add(s.hinge);
    }
    const missing = STOCK.filter((w) => !seen.has(w));
    expect(missing, `missing hinge sizes: ${missing.join(",")}`).toEqual([]);
  });

  it("1500-SKIP: small drift to a clean 1500 hinge beats larger drift to 1600", () => {
    const s = solve(2000, true)!; // hinge space 1517: 1500 needs -17, 1600 needs +83
    expect(s.hinge, `${s.str} @ ${s.achieved}`).toBe(1500);
  });

  it("SS23: hinge side stays a single panel via wider drift when needed", () => {
    const s = solve(1383, true)!;
    expect(s.leftPieces, s.str).toBe(1);
  });

  it("SS21/22: flipping near an end keeps the hinge side whole", () => {
    const s = solve(933, true)!;
    expect(s.leftPieces, s.str).toBe(1);
  });

  it("latch fits whole with ≤100mm drift → it is never split (asks 2330 / 6059F)", () => {
    const a = solve(2330, false)!;
    expect(a.leftPieces, a.str).toBe(1);
    const b = solve(6059, true)!;
    expect(b.rightPieces, b.str).toBe(1);
  });

  it("nudging from the achieved centre never swallows a click", () => {
    let cur = solve(1500, true)!;
    for (let i = 0; i < 15; i++) {
      const next = solve(cur.achieved + 101, true);
      expect(next, `solve failed nudging right from ${cur.achieved}`).not.toBeNull();
      expect(next!.achieved, `click swallowed at ${cur.achieved}`).not.toBe(cur.achieved);
      cur = next!;
    }
  });

  it("SWEEP (8000mm): stock hinges, no slivers, no unnecessary splits, hinge-match", () => {
    const problems: string[] = [];
    for (let ask = 1200; ask <= 6800; ask += 113) {
      for (const flipped of [true, false]) {
        const s = solve(ask, flipped);
        if (!s) continue;
        const tag = `${ask}${flipped ? "F" : ""}: ${s.str}`;
        // Stock hinge widths only
        if (s.hinge !== undefined && !STOCK.includes(s.hinge)) problems.push(`NON-STOCK ${tag}`);
        // No slivers
        const glass = s.panels.filter((_, i) => s.types[i] !== "gate");
        if (glass.some((p) => p < 500)) problems.push(`SLIVER ${tag}`);
        if (glass.some((p) => p > 1800)) problems.push(`OVERSIZE ${tag}`);
        // No unnecessary splits: a >1-piece side whose space could be one panel within drift
        const sideSpace = (from: number, to: number) => {
          let sp = 0;
          for (let i = from; i < to; i++) sp += s.panels[i];
          for (let i = from; i < to - 1; i++) sp += s.gaps[i] ?? 50;
          return sp;
        };
        for (const side of [
          { pieces: s.gateIdx, space: sideSpace(0, s.gateIdx) },
          { pieces: s.panels.length - s.gateIdx - 1, space: sideSpace(s.gateIdx + 1, s.panels.length) },
        ]) {
          if (side.pieces > 1 && side.space - 100 <= 1800) problems.push(`SPLIT ${tag}`);
        }
        // Hinge-match: >150mm deviation is never geometry-forced
        if (s.hinge !== undefined && hingeMatchDeviation(s) > 150) problems.push(`MISMATCH ${tag}`);
      }
    }
    expect(problems, problems.slice(0, 5).join(" | ")).toEqual([]);
  });

  it("SWEEP (multi-span): invariants hold on 4000-12000mm spans", () => {
    const problems: string[] = [];
    for (const spanLength of [4000, 5500, 10000, 12000]) {
      for (let ask = 1200; ask <= spanLength - 1200; ask += 313) {
        for (const flipped of [true, false]) {
          const s = solve(ask, flipped, spanLength);
          if (!s) continue;
          const tag = `${spanLength}/${ask}${flipped ? "F" : ""}: ${s.str}`;
          if (s.hinge !== undefined && !STOCK.includes(s.hinge)) problems.push(`NON-STOCK ${tag}`);
          const glass = s.panels.filter((_, i) => s.types[i] !== "gate");
          if (glass.some((p) => p < 500)) problems.push(`SLIVER ${tag}`);
          if (glass.some((p) => p > 1800)) problems.push(`OVERSIZE ${tag}`);
          // Length conservation: panels + gaps + end gaps = span
          const sum = s.panels.reduce((a, b) => a + b, 0) + s.gaps.reduce((a, b) => a + b, 0) + 50;
          if (Math.abs(sum - spanLength) > 2) problems.push(`LENGTH ${sum} ${tag}`);
          // Gaps sane
          if (s.gaps.some((g) => g < 0 || g > 150)) problems.push(`GAP ${tag}`);
          // Hinge adjacent to gate
          if (s.hingeIdx !== -1 && Math.abs(s.hingeIdx - s.gateIdx) !== 1) problems.push(`ADJACENCY ${tag}`);
          if (s.hinge !== undefined && hingeMatchDeviation(s) > 150) problems.push(`MISMATCH ${tag}`);
        }
      }
    }
    expect(problems, problems.slice(0, 5).join(" | ")).toEqual([]);
  });
});
