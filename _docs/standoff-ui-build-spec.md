# Standoff Balustrade 15mm — UI build spec (operator rulings)

> Working doc for the wizard rollout. Condensed from the ECO Vault:
> `verticals/barrier-hub/calculator/style-validation/glass-bal-standoffs-calculator-inputs-spec.md`
> + `sf-16-glass-bal-standoff-15mm-walk.md` (catalogue validation)
> + operator rulings 2026-06-03 (recorded below — operator authority overrides vault where they differ).

## Style facts (vault-confirmed, SF-16)

- **Glass: 15mm toughened, 1280mm high, pre-drilled** (`1280S-{width}` SKU family).
  14 fixed widths: 400, 500, 600, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200.
  (NOTE: shared/schema.ts STANDOFF_GLASS_CONSTRAINTS still says height 1000 — stale.)
- **Standoff count from the panel's pre-drilled holes**: ≤750mm wide = 4 standoffs; ≥800mm = 6.
- **Standoff hardware: 50mm-dia subset only** (38mm-dia is V2). 18 SKUs:
  - Adjustable body `GSA-50{30,45}-{B,MW,P,S}` (4 finishes each)
  - Fixed body `GS5020{B,P,S}` / `GS5030(-MW){B,P,S}` / `GS5050{B,P,S}` (no MW on 20/50)
  - V1 default: **GSA-5030-P** (Adjustable 50×30 Polished)
- **Rail: 35-Series ONLY** (no Nanorail leaf on this style → no STG-MECH compliance kit).
- **Substrate → fixings** (1 per standoff): Timber direct `GS115LAG` / through-cladding `GS160LAG`;
  Concrete direct `GS120ROD` + chem anchor ÷20 / through-cladding `GS150ROD` + chem ÷15;
  Steel drill-and-tap `GS120ROD` / through-bolt `MAD-TILT-M12-BALKIT` (dual-purpose kit).
- No gates, no raked panels, no AS-3000.

## OPERATOR RULING 2026-06-03 — point-fix elevation geometry (sample-matched)

The glass cantilevers UP off the slab edge / fascia:
- A **continuous fascia band (~280mm)** runs along the bottom of the run, behind/around the glass.
- **BOTH standoff rows sit inside the fascia band** (rows ~80mm and ~200mm up from the glass
  bottom) — NOT at the panel corners.
- Columns: 2 per panel (≤750mm wide) or 3 per panel (≥800mm) → 4 or 6 standoffs.
- Glass above deck level ≈ 1000mm; 35-Series rail (35mm) caps the glass top → elevation
  draws 1280mm glass + fascia + rail.

## OPERATOR RULING 2026-06-03 — rail finish matches standoffs (default + toggle)

"Match rail to standoff colour should be the default; have a toggle switch like spigots
does. For polished and satin standoffs use satin anodised rail."

- Rail finish **defaults to matching the standoff finish**:

| Standoff finish | 35-Series rail finish |
|---|---|
| Polished | Satin Anodised |
| Satin | Satin Anodised |
| Black | Black |
| White (Matt White) | Matt White |

- A **"Match standoffs" toggle** (same pattern as the pool spigots gate-hardware matcher),
  ON by default. Turning it OFF reveals a rail finish select: Black / Matt White / Satin Anodised.
- Mill is calc-excluded (storefront-only) — consistent with the channel styles' ruling.

## OPERATOR RULING 2026-06-03 — rail joins show a join line + need a joiner

"Rail joins should show a join line like we did with channel; it will also need a joiner."

- Elevation: a rail run longer than 5800mm draws a **join line at every 5800mm** on the rail
  bar — same visual treatment as the channel's 4200mm break lines (dark line + tick marks).
- Each join emits **1 × SER35-J-SA inline joiner** (already counted in the rail cut-plan box).
- Applies to every 35-Series rail across the balustrade styles (standoffs, bal channel,
  bal spigots) — the rail drawing is shared.

## UI structure (wizard accordion: Configure / Standoffs / Rail)

Section 1. **Configure** — max panel 400–1200mm, balustrade gaps, 15mm × 1280mm weight line.
Section 2. **Standoffs** — body type cards (Adjustable default / Fixed) → depth (Adj 30/45;
   Fixed 20/30/50) → finish swatches (White blocked on Fixed 20/50) → standoff count box →
   substrate → conditional cladding/steel-method → fixings-included info.
Section 3. **Rail** — 35-Series read-only, finish match toggle (ruling above), terminations,
   5800mm cut plan with cross-section offcut reuse.

## Open items (flagged, not ruled)

- "Wall — external corner" (WBEXT) rail termination: vault has it as a 3rd wall type; the shared
  Rail accordion enum doesn't. Handle at BOM phase or add an option — operator to rule.
- Panel width vs SKU mismatch: the solver can produce 450/550/650mm panels but the catalogue's
  fixed widths jump 100mm below 750 (400→500→600→700→750). Solver/BOM-phase reconciliation.
- Substrate default = Timber in the wizard (vault says "required, no default").

## Verification

- Oracles: `npx tsc --noEmit` ≤79 baseline; `npx vitest run` = 7 pre-existing failures / 125 passed.
- Browser harness: /tmp/fl2-browser/verify-bal-standoffs.mjs
- Workflow: never commit without operator approval; operator hands-on round before merge.
