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

## BARR (alu-pool-barr) — BUILT 2026-06-03 (awaiting operator hands-on round)

Vault sources (all read in full): `sf-04-alu-pool-barr-walk.md`, `alu-pool-barr-calculator-inputs-spec.md`,
`engineering/barr-pool.md` (PTS-019), `products/barr.md`.

### Facts
- **Two finishes: Satin Black (B) / Pearl White (W)** — finish picker drives EVERY hardware SKU suffix.
- BARR is **pre-fabricated picket panels** (25mm picket faces, 93mm gaps, 118mm pitch, welded to
  rails) — NOT flat/solid infill (operator-ruled 2026-05-29).
- Panel: `BR-PANEL-2205-1200-{B/W}` (2205mm stock). Posts: slimline 50×25mm —
  `BR-1280-BP-{B/W}` (decking/concrete-slab) / `BR-1800-{B/W}` (in-ground/core-drilled).
- Inline covers: `BR-DC-2P-{B/W}` domical / `BR-DR-{B/W}` dress ring / none (in-ground).
- **CROSS-RANGE corner + gate posts (50×50)**: BARR's 25mm post face can't take the 32mm
  C-brackets or D&D hardware → Black: `SS-1300-BP-B`/`SS-1800-B`; White: `XP-1300-BP-W`/
  `XP-1800-FP-W`; covers `XP-DC-2P-{B/W}`/`XP-DR-{B/W}`. Corners derived from the design
  (N sections → N−1 corners), shown on the first section. Gate posts ×2 per gate.
- **Paired brackets per panel**: `BR-BR25-{B/W}-4PK` C-bracket + `BR-BRCAP-{B/W}-4PK` cap.
- **Finish-asymmetric gate hardware**: Black = `ML-TL-TC-H-AT` (1 bundled kit); White =
  `ML-TL-W` + `TC-H-AT-2L-W` (2 SKUs — no bundled kit exists in White). Cards change with finish.
- Gate: `BR-GATE-0975-1200-{B/W}`. Fixings: decking `CSK-100-4PK` (M10×100 countersunk, ×CEIL(posts/4)
  — operator ruling 2026-06-04, supersedes the inputs-spec's `S-110LAG-4PK`);
  core-drilled grout 1:15 + spare (76mm holes); concrete-slab/in-ground customer-sourced.
- Server: `calculateBarrPanelLayout` extended with `gateCentreFromLeft` (centre mode, glass/Blade
  parity); post allowance 25mm. **Dev server restart required after pulling.**

### Storefront blockers (operator batch-apply session, NOT calc-UI blockers)
- D-014: cross-range posts + covers (8 SKUs) have no BARR-tree placements
- D-010: White gate hardware (`ML-TL-W`, `TC-H-AT-2L-W`) not placed (may need products rows)

## BOM CALCULATOR FIX — Blade + BARR (operator caught 2026-06-04)

The configure UIs showed the hardware cards, but the **server BOM calculator**
(`server/services/bom-calculator.ts`) only emitted panels + posts for both pool styles
(and read `barrPostType`/`bladePostType`, which the new wizards don't set — ignoring the
substrate). Rewrote both blocks to emit the FULL component list, driven by the wizard's
finish + `{barr,blade}-substrate` fieldValue, with the real storefront SKUs.

**SPLIT (operator ruling 2026-06-04):** the Blade BOM fix ships as its OWN hotfix PR off
main (`fix/blade-pool-bom`) — Blade was already live (PR #38) with the broken BOM, so it
merges independently/fast. The BARR branch carries only the BARR BOM block.

Both blocks emit:

- **Blade** (Black-only, single 50×50 post family — no cross-range): panels `BLA-PNL-2200-1200-B`,
  FastFit brackets `FF-BH-OPEN-4PK-B`/panel, posts `SS-1300-BP-B`/`SS-1800-B`, covers `SS-DC-B`/
  `XP-DR-B`, gate `BLA-GATE-0975-1200-B` + `ML-TL-TC-H-AT` (1 kit), fixings CSK / grout.
- **BARR** (B/W, cross-range 50×50 corner/gate posts, paired C-bracket+cap, finish-asymmetric
  gate hardware): all per the spec above.

**Operator ruling 2026-06-04: BARR/Blade decking fixing = CSK (`CSK-100-4PK`)**, not the
inputs-spec's `S-110LAG-4PK`. PTS-019/PTS-021 both say "M10×100 countersunk batten screws";
operator confirmed CSK. UI card + BOM both updated.

Tests: slot-resolver-aluminium.spec.ts — BARR timber-deck full-set, BARR White-gate-asymmetry,
Blade timber-deck full-set, Blade core-drilled-gate (8/8). SERVER change → dev server restart.

NOTE: the Blade BOM fix lands on the BARR branch (Blade wizard already merged in PR #38 with
the BOM gap). Operator to decide at merge whether to split it into its own PR off main.
