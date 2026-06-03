import type { SpanConfig } from "@shared/schema";

/**
 * Generic cut-length planning for stock-length linear materials (VersaTilt channel,
 * 35-Series handrail, ...). Sections are processed IN ORDER and offcuts from earlier
 * sections are reused AUTOMATICALLY before any new full stock length is cut — the
 * user configures all the glass runs freely and the optimiser does the rest
 * (operator design, 2026-06-03). Built once, reused per material.
 */

export interface CutSectionInput {
  /** Stable id (span id). */
  id: string;
  /** Display label ("Section A"). */
  label: string;
  /** Continuous runs of material this section needs, in mm (e.g. channel runs split by a gate). */
  runsMm: number[];
}

export interface OffcutRef {
  fromId: string;
  fromLabel: string;
  lengthMm: number;
}

export interface SectionCutPlan {
  id: string;
  /** Offcuts that were available to this section before optimisation assigned them. */
  availableOffcuts: OffcutRef[];
  /** Offcuts the optimiser assigned to this section (consumed before new full lengths). */
  claimedOffcuts: OffcutRef[];
  /** New full stock lengths cut for this section. */
  fullLengths: number;
  /** Piece-to-piece joins within this section's runs. */
  joins: number;
  /** Leftover from this section's last cut, available to later sections. */
  offcutOutMm: number;
}

/** Offcuts shorter than this aren't worth keeping (can't span between fixing points). */
const MIN_USABLE_OFFCUT_MM = 300;

/**
 * AUTO-OPTIMISED planning (operator design, 2026-06-03): the user configures all the
 * glass runs freely; the optimiser then assigns offcuts across sections automatically —
 * each section reuses the largest available offcuts from earlier sections before any
 * new full stock length is cut. No manual claiming.
 */
export function computeSectionCutPlans(
  sections: CutSectionInput[],
  stockLengthMm: number,
): Map<string, SectionCutPlan> {
  const plans = new Map<string, SectionCutPlan>();
  // Pool of offcuts from sections processed so far (auto-consumed, largest first).
  let pool: OffcutRef[] = [];

  for (const section of sections) {
    const availableOffcuts = [...pool];
    // Auto-claim: take available offcuts (largest first) that can contribute to this
    // section's runs. An offcut contributes if it's at least MIN_USABLE long.
    const totalNeed = section.runsMm.reduce((s, r) => s + r, 0);
    const claimedOffcuts: OffcutRef[] = [];
    let claimedTotal = 0;
    for (const o of [...pool].sort((a, b) => b.lengthMm - a.lengthMm)) {
      if (claimedTotal >= totalNeed) break;
      claimedOffcuts.push(o);
      claimedTotal += o.lengthMm;
    }
    pool = pool.filter((o) => !claimedOffcuts.includes(o));

    // Greedy plan: claimed offcut pieces first (longest first), then full lengths.
    const pieces = claimedOffcuts.map((o) => o.lengthMm).sort((a, b) => b - a);
    let fullLengths = 0;
    let joins = 0;
    let leftover = 0;
    for (const runMm of section.runsMm) {
      let remaining = runMm;
      let piecesInRun = 0;
      // Use claimed offcut pieces.
      while (remaining > 0 && pieces.length) {
        const piece = pieces.shift()!;
        const use = Math.min(piece, remaining);
        remaining -= use;
        if (piece - use >= MIN_USABLE_OFFCUT_MM) leftover += 0; // partial offcut remainders are scrap (one keep per cut)
        piecesInRun++;
      }
      // Then new full lengths.
      while (remaining > 0) {
        fullLengths++;
        const use = Math.min(stockLengthMm, remaining);
        remaining -= use;
        if (use < stockLengthMm) leftover += stockLengthMm - use;
        piecesInRun++;
      }
      joins += Math.max(0, piecesInRun - 1);
    }

    const offcutOutMm = Math.round(leftover);
    plans.set(section.id, {
      id: section.id,
      availableOffcuts,
      claimedOffcuts,
      fullLengths,
      joins,
      offcutOutMm,
    });

    if (offcutOutMm >= MIN_USABLE_OFFCUT_MM) {
      pool.push({ fromId: section.id, fromLabel: section.label, lengthMm: offcutOutMm });
    }
  }

  return plans;
}

// ── Discrete panel cutting (aluminium panels: Blade / BARR) ─────────────────────
// Unlike linear stock (channel/rail), aluminium panels are welded units: a cut panel
// is cut DOWN from one stock panel (or from a big-enough offcut) — pieces cannot be
// joined. Offcuts from earlier cuts are reused automatically for later, narrower
// panels (best-fit), in design order — same auto-optimise philosophy as the channel.

export interface PanelCutPlan {
  id: string;
  /** Stock panels used whole (no cut). */
  fullPanels: number;
  /** New stock panels cut down (one cut each). */
  cutPanels: number;
  /** The cut widths produced from new stock panels. */
  cutWidthsMm: number[];
  /** Cuts served from earlier sections' offcuts instead of new stock. */
  claimedOffcuts: OffcutRef[];
  /** Usable offcuts this section leaves for later sections. */
  offcutsOutMm: number[];
}

export function panelCutPlans(
  sections: Array<{ id: string; label: string; panelWidthsMm: number[] }>,
  stockWidthMm: number,
): Map<string, PanelCutPlan> {
  const plans = new Map<string, PanelCutPlan>();
  let pool: OffcutRef[] = [];

  for (const section of sections) {
    const plan: PanelCutPlan = {
      id: section.id,
      fullPanels: 0,
      cutPanels: 0,
      cutWidthsMm: [],
      claimedOffcuts: [],
      offcutsOutMm: [],
    };

    for (const w of section.panelWidthsMm) {
      if (w >= stockWidthMm) {
        plan.fullPanels++;
        continue;
      }
      // Best fit: the smallest available offcut that can still serve this cut.
      const candidates = pool.filter((o) => o.lengthMm >= w).sort((a, b) => a.lengthMm - b.lengthMm);
      if (candidates.length) {
        const used = candidates[0];
        pool = pool.filter((o) => o !== used);
        plan.claimedOffcuts.push(used);
        const remainder = used.lengthMm - w;
        if (remainder >= MIN_USABLE_OFFCUT_MM) {
          pool.push({ fromId: section.id, fromLabel: section.label, lengthMm: remainder });
          plan.offcutsOutMm.push(remainder);
        }
      } else {
        plan.cutPanels++;
        plan.cutWidthsMm.push(w);
        const remainder = stockWidthMm - w;
        if (remainder >= MIN_USABLE_OFFCUT_MM) {
          pool.push({ fromId: section.id, fromLabel: section.label, lengthMm: remainder });
          plan.offcutsOutMm.push(remainder);
        }
      }
    }

    plans.set(section.id, plan);
  }

  return plans;
}

// ── Channel-specific wrapper ─────────────────────────────────────────────────────

export const CHANNEL_STOCK_MM = 4200;
export const CHANNEL_PINS_PER_JOIN = 4; // operator rule (pool channel); sold in packs of 10
export const CHANNEL_PIN_PACK_SIZE = 10;

/** A span's continuous channel runs: glass panels + gaps between glass, split by the gate. */
export function channelRunsForSpan(span: SpanConfig): number[] {
  const panels = span.panelLayout?.panels ?? [];
  const gaps = span.panelLayout?.gaps ?? [];
  const types = span.panelLayout?.panelTypes ?? [];
  const runs: number[] = [];
  let run = 0;
  let prevWasGlass = false;
  for (let i = 0; i < panels.length; i++) {
    if (types[i] === "gate") {
      if (run > 0) runs.push(run);
      run = 0;
      prevWasGlass = false;
    } else {
      if (prevWasGlass) run += gaps[i - 1] ?? 0;
      run += panels[i];
      prevWasGlass = true;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

/** Compute channel cut plans for every span in the design (in span order). */
export function channelCutPlans(spans: SpanConfig[]): Map<string, SectionCutPlan> {
  const sections: CutSectionInput[] = spans.map((s) => ({
    id: s.spanId,
    label: s.name?.trim() || `Section ${s.spanId}`,
    runsMm: channelRunsForSpan(s),
  }));
  return computeSectionCutPlans(sections, CHANNEL_STOCK_MM);
}
