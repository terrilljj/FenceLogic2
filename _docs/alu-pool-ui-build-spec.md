# Aluminium Pool styles — UI build spec (Blade / BARR / Flat Top Tubular)

> Working doc for the wizard rollout. Condensed from the ECO Vault walks (SF-5 Blade,
> SF-4 BARR, SF-3 Tubular) + inputs specs + PTS engineering extractions
> + operator rulings 2026-06-03 (recorded below — operator authority wins).

## OPERATOR RULINGS 2026-06-03

1. **Build order: Blade → BARR → Flat Top Tubular** (one branch per style).
   Complexity order per operator: "flat top tubular has the most complexity followed by
   barr and then blade being the simplest with the least amount of skus and only a
   single colour."
2. **Attachment hardware is per-style — NOT shared across the metal pool fences:**
   - Blade → **FastFit** open bracket (`FF-BH-OPEN-4PK-B`), 1 kit per panel
   - BARR → C-brackets (BARR family)
   - Flat Top Tubular → shroud kits (`SS-BH4`)
   No shared "bracket" concept in the UI or BOM.

## Blade Pool Fence (alu-pool-blade) — built 2026-06-03

Vault sources (all read in full before build): `sf-05-alu-pool-blade-walk.md`,
`alu-pool-blade-calculator-inputs-spec.md`, `products/blade.md`, `engineering/blade.md` (PTS-021).

### Facts
- **Black only** (Satin Black) — no finish picker. Smallest SKU count of any V1 style.
- Panel: `BLA-PNL-2200-1200-B` (2200×1200mm, 50×16mm blades @ 79mm gaps on 40×40mm rails).
  AS 1926.1 compliant by design — no compliance toggle.
- Posts: single 50×50 family — `SS-1300-BP-B` (base plated) / `SS-1800-B` (core/in-ground).
  Same SKU at corners + gates (no cross-range borrow — Blade inline IS 50×50).
- Brackets: `FF-BH-OPEN-4PK-B` × 1 per panel (Blade-specific, ruling #2).
- Gate: `BLA-GATE-0975-1200-B` (975mm) + `ML-TL-TC-H-AT` (D&D Magna-Latch + TruClose,
  Black bundled kit, rated 30kg self-close, latch ≥1500mm).
- Substrate (4-value) → post/cover/fixings:
  | Substrate | Post | Cover | Fixings |
  |---|---|---|---|
  | Decking | SS-1300-BP-B | SS-DC-B domical | CSK-100-4PK × CEIL(posts/4) — **LVL/F17 timber only** (PTS-021) |
  | Concrete slab | SS-1300-BP-B | SS-DC-B domical | customer-sourced (M10×75 screw bolts, 32 MPa) |
  | In-ground | SS-1800-B | none | customer-sourced concrete mix |
  | Core-drilled | SS-1800-B | XP-DR-B dress ring | GROUT-SETFAST-10KG × CEIL(posts/15)+1 — **83mm holes** (not 76mm) |
- AS 3000: no toggle; aluminium posts within 1.25m of pool water must be earthed → Joe tip.
- Layout: server-side `calculateBladePanelLayout` (existing). **Mode A "evenly spaced" is
  the V1 default** (inputs spec) — the old UI defaulted to Mode B; spec supersedes.
- Pool Blade is **1200mm height only** (1000mm = boundary/balustrade per compliance matrix);
  the old UI's height select is gone.

### Wizard structure (Configure / Posts & Substrate / Gate)
1. **Configure** — layout mode (Mode A default / Mode B) + fixed panel info (Black, AS 1926.1)
2. **Posts & Substrate** — substrate select → posts / covers / FastFit brackets / fixings info
3. **Gate** — toggle → 975mm gate + D&D kit info (gates were NOT exposed in the old UI's
   generic gate section; the wizard is the first UI to expose Blade gates cleanly)

### OPERATOR RULINGS 2026-06-03 (Blade hands-on round)

3. **Blade gates get the full glass-gate feature set** — same depth as the other styles:
   - **Gate position DUAL MODE** (parity with glass): Standard (solver-placed, Move
     Left/Right by bay) | **Set position** (gate CENTRE pinned to a measurement from the
     LHS, 50mm nudges + type-to-jump). Required a server solver extension:
     `calculateBladePanelLayout` now accepts `gateCentreFromLeft` — splits the run at
     the gate and solves each side independently.
   - **Move Left | Flip | Move Right** controls identical to the glass GateControls
     (solid buttons, same icons/labels/testid pattern).
   - **Panel cut plan with offcuts**: stock panels used, cut widths, offcuts left over,
     cross-section offcut reuse (`panelCutPlans` in lib/cut-plan.ts — discrete panel
     model: a cut panel comes from ONE stock panel, no joins).
   - **D&D hardware is ONE SKU**: "hinge & latch kit (1 kit)" — Magna-Latch + 2 TruClose
     hinges in one box. Never present it as separate items.
   - Live accordion summaries with the ✎ edit affordance (glass pattern).

### Implementation notes
- gateConfig uses the glass-gate schema fields (hardware: "polaris" etc. are required
  enums); Blade's REAL hardware is the D&D kit — the BOM phase maps hardware from the
  productVariant, not the enum.
- Elevation: existing isBladeFencing renderer reused unchanged (blades + rails + posts + gate).
- SERVER changed (panelCalculations.ts + layout-service.ts) → restart the dev server
  after pulling this branch (tsx does not hot-reload server files).

## BARR (alu-pool-barr) — NOT YET BUILT (next)

Key vault facts to carry in: cross-range post borrow (BARR inline is 50×25 → corners/gates
borrow SS-/XP- 50×50), White finish exists (finish-asymmetric gate hardware), C-brackets,
D-014/D-010 blockers were logged in SF-4.

## Flat Top Tubular (alu-pool-tubular) — NOT YET BUILT (last)

Key vault facts: most complex of the three; 2 panel widths (2450/3000mm); shroud kits
(SS-BH4); swivel shrouds for angles; White + Black finishes.

## Verification
- Oracles: `npx tsc --noEmit` ≤79 baseline; `npx vitest run` = 7 pre-existing failures / 125 passed.
- Browser harness: /tmp/fl2-browser/verify-alu-blade.mjs
- Workflow: never commit without operator approval; operator hands-on round before merge.
