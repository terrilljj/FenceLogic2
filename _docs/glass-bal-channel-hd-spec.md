# Glass Balustrade Channel HD (VersaTilt Heavy Duty 17.52 SGP) — build spec

> Operator ruling 2026-06-04: add VersaTilt Heavy Duty as a launch style — "almost identical
> to the 15mm channel, diff channel and fittings, shorter channel length, same rail 35×35 with
> 17.52 runner insert, diff friction plates". Variant `glass-bal-channel-hd`.
> Grounded in PTS-028 (`versatilt-heavy-duty.md`) + the 15mm channel inputs spec.

## What it is
VersaTilt Heavy Duty (PTS-028) — a deck-mount channel balustrade in **17.52mm SGP toughened
laminated** glass (21.52mm is the heavier engineered build). Laminated by design; rated for
high wind / high fall / C1–C2 occupancy up to 50m. Mirrors the standard 15mm VersaTilt channel
(`glass-bal-channel`) with these deltas.

## Deltas vs the 15mm channel
| | 15mm (VersaTilt, PTS-003) | HD (VersaTilt Heavy Duty, PTS-028) |
| --- | --- | --- |
| Glass | 15mm toughened monolithic | **17.52mm SGP toughened laminated** (always) |
| Channel kit | `VER-4200-DMK-{B/SA}` (4200mm) | `VER-HD-3600-DMK-{B/SA}` (**3600mm**, shorter) |
| Friction plates | `VER-PPKIT-15MM` (per plate) | `VER-HD-PPKIT-17-4PK` (**4-pack**) |
| Stabilising washers | `VER-WASHER-14PK` | `VER-HD-WASHER-18PK` |
| Glazing rubber | `VER-15KIT-RUB` | `VER-HD-17KIT-RUB` (derived) |
| End plates | `VER-2DMEP-{finish}` | `VER-HD-2DMEP-{finish}` (derived) |
| Rail | 35×35 Series, 15mm rubber | 35×35 Series + **17.52 runner insert** `SER35-17KIT-RUB` (derived) |
| Fall band | 3-band AS1288 (toughened/laminated) | none — always laminated; fixed spec note |

## Side effect — completed the 15mm channel BOM
The standard `glass-bal-channel` previously emitted **no channel hardware** (the BOM's
`isChannelSystem` was pool-only). This build adds a shared balustrade-channel hardware block
(`isBalChannel`, keyed by variant) — so the 15mm channel now correctly emits VER-4200-DMK +
VER-PPKIT-15MM + VER-WASHER-14PK + glazing rubber + end plates + alignment pins too.

## Touchpoints
schema (PANEL_SIZE_REGISTRY + z.enum) · span-config-panel (isGlassBalChannel) · glass-spigots-config
(isBalChannelHd: 17.52 thickness, 3600 stock via channelCutPlans(stockMm), HD spec note, band
suppressed) · cut-plan (CHANNEL_STOCK_HD_MM + channelCutPlans stockMm param) · bom-calculator
(balGlassLine HD branch + isBalChannel hardware block) · fence-visualization (isBalChannel) ·
fence-builder (label + isWizardVariant + ptsMaxPanelFor) · home tile · app-header · ui-config ·
product-selector · joe-tips.

## FLAGGED for operator ratification
- **Derived SKUs** (no PTS / catalogue confirmation yet): glass `1000SGP1752-{w}`, glazing rubber
  `VER-HD-17KIT-RUB`, end plate `VER-HD-2DMEP-{finish}`, rail runner `SER35-17KIT-RUB`.
  Confirmed from PTS-028: `VER-HD-3600-DMK`, `VER-HD-PPKIT-17-4PK`, `VER-HD-PPKIT-21-4PK`,
  `VER-HD-WASHER-18PK`.
- **21.52 build not surfaced** — V1 ships 17.52; 21.52 is the engineered upgrade (engineer
  confirms per wind/height/occupancy). The wind-region / C1-C2 matrices are NOT modelled (out of
  calc scope) — the HD spec note says "build confirmed by engineering".
- **Glass height** fixed at 1000H (PTS-028 also certifies 1100/1200H) — parity with 15mm channel.

## Verification
- tsc 79 (branch baseline, stacked on PR #44) · vitest 7 pre-existing fails + 2 new HD/channel
  tests (slot-resolver-balustrade 11/11).
- Browser 16/16: HD renders (17.52 note, 3600mm, no band), full HD channel BOM, home tile present;
  standard channel regression (now emits VER-4200 hardware). `/tmp/fl2-browser/`.

## NOTE — branch stacking
Built on `feat/calc-glass-bal-fall-band` (PR #44) because HD reuses `balGlassLine` + the channel
config the fall-band work introduced. Merge PR #44 first, then this.
