# Glass Balustrade — AS1288 fall-height band (build spec)

> Operator ruling 2026-06-04: add the `<1m | 1–5m | >5m` band to ALL glass balustrade
> styles (it's a GLASS-selection concept per AS1288 §7 — wrongly removed from the metal
> styles, where it does not belong). "Do all of them" — spec + compliance note + run cap +
> laminated BOM swap. `>5m` = laminated spec + proceed (engineering-cert note).
> Grounded in: ECO Vault `as-1288.md` §7, `madrid-standard.md` (PTS-007), and the Deluxe /
> VersaTilt / Standoff PTS extractions.

## What the band drives (AS1288 §7)

| Band | NCC status | Glass build | Run-length cap |
| --- | --- | --- | --- |
| `<1m` | not a fall-prevention barrier | toughened monolithic | **lifted** (Madrid only) |
| `1m–5m` (default) | standard barrier | toughened monolithic | applies (Madrid only) |
| `>5m` | barrier | toughened **LAMINATED** (mandatory, no exceptions) | applies + engineering cert |

Frameless spigot/channel/standoff systems have **no Deemed-to-Satisfy pathway** (AS1288
§7.4.6) — site-specific engineering certification is always required. At `>5m` we set the
laminated spec and proceed, surfacing an engineering-cert note (operator decision).

## Per-system glass build (from the PTS extractions)

| Variant | System (PTS) | `<5m` mono | `≥5m` laminated | Glass H |
| --- | --- | --- | --- | --- |
| glass-bal-spigots-12mm | Madrid Standard (PTS-007) | 12mm | 11.52mm | 970 |
| glass-bal-spigots-15mm | Madrid Deluxe (PTS-002) | 15mm | 16mm | 1000 |
| glass-bal-channel | VersaTilt (PTS-003) | 15mm | 15mm | 1000 |
| glass-bal-standoffs | Standoff Point-Fix (PTS-006) | 15mm | 15mm | 1280 (pre-drilled) |

## Run-length cap — Madrid Standard ONLY

The 4.88m (4880mm) max-run limit is stated **only** in `madrid-standard.md` (PTS-007 §5).
Madrid Deluxe, VersaTilt, Standoff, and Nova have **no stated per-run cap** (they cap by
per-panel width). So the run cap binds only for `glass-bal-spigots-12mm` + family=`madrid`,
and only at `≥1m` fall (lifted `<1m`). Implemented as a **compliance gate**: when a section
exceeds 4.88m, a warning offers "movement joint / split run, or switch to Nova (no per-run
cap)". Auto-splitting geometry was NOT built — the spigot run-split is a movement joint with
no specified joiner SKU (follow-up if the operator wants auto-split).

## Implementation

- **UI** (shared): `client/src/components/configure-blocks/glass-bal-fall-band.tsx` — 3-band
  `IconOptionPicker` + per-band glass spec + AS1288 compliance note. Writes
  `fieldValues["glass-bal-fall-height"]`. Wired into glass-bal-spigots-config (12/15mm),
  glass-spigots-config (`isBalChannel` only), glass-bal-standoffs-config. Pool variants do
  NOT show it. Madrid run-cap warning lives in glass-bal-spigots-config.
- **BOM**: `server/services/bom-calculator.ts` — new `balGlassLine(variant, fallBand, width)`
  emits the correct family/height/thickness + laminated swap; the standard-panel branch uses
  it for glass-bal (was wrongly emitting the pool `GP-{w}-1200-12` line). Pool path unchanged.

## FLAGGED for operator ratification

- **Laminated SKUs do not exist in the catalogue.** The `-LAM` suffix on the bal glass SKU
  (`1000FBG-{w}-LAM`, `970NTG-{w}-LAM`, `1280S-{w}-LAM`) is **derived** — operator to seed
  real laminated SKUs / confirm the code format. Mono families (`1000FBG`/`970NTG`/`1280S`)
  are the calc's existing catalogue bal-glass families; widths are made-to-size (equalised),
  mirroring the existing `GP-` made-to-size convention.
- **Channel glass family**: glass-bal-channel reuses `1000FBG` (15mm/1000H) — no separate
  channel glass family exists in the catalogue. Confirm whether channel glass is a distinct
  product (channel edgework differs).
- **Run-split**: compliance warning only, no auto-geometry-split (needs the movement-joint
  detail/SKU if auto-split is wanted).

## Verification
- tsc 79 (branch baseline) · vitest: 7 pre-existing fails (pdf-layout, frameless-custom),
  +3 new glass-bal glass-line tests (slot-resolver-balustrade 9/9).
- Browser: band on all 4 styles (24/24, pool excluded); BOM glass line mono↔laminated swap
  on all 4 + pool unregressed (8/8). `/tmp/fl2-browser/` scripts.
