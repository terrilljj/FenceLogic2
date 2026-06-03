# Channel-system UI build spec (pool channel + bal channel 15mm)

> Working doc for the wizard rollout. Condensed from the ECO Vault:
> `verticals/barrier-hub/calculator/style-validation/glass-bal-channel-15mm-calculator-inputs-spec.md` (complete, operator-locked)
> + `sf-10-glass-bal-channel-15mm-walk.md` (catalogue validation)
> + operator ruling 2026-06-03: "pool channel is very easy, all the same glass logic applies,
> the difference is change spigots to channel — in glass it's the closest to pool fence spigots."

## Operator ruling — pool channel (glass-pool-channel)

Pool channel = **pool spigots wizard with the spigot hardware section swapped for channel hardware**.
Everything else carries over verbatim:
- 4-step wizard (Style & Measure → Configure → Review)
- Server-side panel layout solver (POST /api/layout), same glass logic
- Gate placement (Standard | Set position, hinge panels, flip, nudge) — pool fences have gates
- Raked panels, custom panels
- Elevation rendering (fence-visualization.tsx already has `isChannelSystem` flag → draws channel
  slot along the base instead of discrete spigots)
- Joe tips structure (channel-specific text needed)

## Channel hardware (replaces spigot family / covers / spigot fixings)

VersaTilt channel system (VER- prefix), single family — NO family picker needed.

| Aspect | Pool channel (12mm) | Bal channel 15mm |
|---|---|---|
| Variant key | `glass-pool-channel` | needs wiring (launch style "Channel 15mm") |
| Glass | 12mm toughened, 1200mm pool height | 15mm toughened, 1000mm height |
| Channel kit | `VER-4200-DMK-{B,SA}` (4200mm lengths) | same |
| Channel finish enum | **{Black (B), Satin Anodised (SA)}** — Mill excluded | same, default SA |
| Friction plates | `VER-PPKIT` (12mm, "4x kits per pool panel") | `VER-PPKIT-15MM` (geometric formula) |
| Glazing rubber | `VER-12KIT-RUB-2PK` (1 per channel length) | `VER-15KIT-RUB` (1 per channel) |
| Washers | `VER-WASHER-14PK` (1 per channel) | same |
| End plates | `VER-2DMEP-{finish}` (per open channel end) | same |
| Alignment pins | `VER-PINS` 10-pack (2 per channel join) | same |
| Top infill rubber | `VER-0300-TI` (gap-driven, 80% yield) | same |
| Mounting | Deck mount only V1 (face mount = V2) | same |
| Gates | YES (pool fence) — existing gate flow | NO (balustrade) |
| Top rail | NO (pool fence has no top rail) | YES — 35 Series, auto-match finish |

## Pool channel physical proportions + clamp rule (OPERATOR SPEC 2026-06-03)

Elevation drawing + BOM-relevant geometry, operator-supplied (supersedes any derived values):
- **Channel: 128mm high.** Base of channel sits **38mm above the ground/fixing surface.**
- **The glass sits INSIDE the channel** (not above it). Glass is 1200mm; finished height
  above floor level = **1237mm** (includes the friction plate the glass rests on).
- **Pressure plate (friction clamp) centres — pool channel:** all measured to centre,
  **150mm in from each panel end, 500mm MAX between centres.** Clamps are PER PANEL
  (they grip the glass), not per channel length.
  - clamps_per_panel = 1 + max(1, CEIL((panel_width - 300) / 500))   [panels ≥ 300mm]
  - e.g. 1000mm → 3 clamps · 1650mm → 4 clamps
  - NOTE: this is the POOL (12mm) rule. The BAL 15mm spec doc says 25mm setback /
    300mm centres — different system thickness, different rule. Operator authority.
- **Raked panels: ALWAYS 4 friction clamps** (operator rule, overrides the formula).
- **Channel stock = 4200mm.** Runs longer than one stock length are JOINED:
  - **4 joining pins per join, sold in packs of 10** (pool rule; bal spec says 2/join — operator authority)
  - Elevation shows a break line at every 4200mm within a channel run
- **Channel terminations:** every open channel end (section ends + both sides of a gate
  break) is finished with an **End cap** or a **Cut mitre** (corner). User choice per end.
- **Offcut tracking:** each section shows its channel cut plan (full lengths used, joins,
  pins/packs, offcut left over) and accepts an "offcut from previous section" input that
  is consumed before new full lengths. BOM: channel qty = full lengths net of offcut reuse.

## Substrate → fixings (channel uses M12, NOT the spigot M10 packs)

Per-section substrate enum {Timber, Concrete, Steel}, default Timber. Anchors at 300mm centres:
`anchor_count = CEIL(section_length / 300) + 1`

| Substrate | Fixings emitted | Customer-supplied |
|---|---|---|
| Timber | `GS160LAG` × anchors (M12×160 LAG, individual not 4-pack) | M12 nuts + working washers |
| Concrete | `GS150ROD` × anchors + `SOUD-CA1400` × CEIL(anchors/20) | M12 nuts + working washers |
| Steel | nothing (customer supplies M12 bolt/tap hardware) | all M12 hardware |

Key difference from spigots: M12 discrete components (GS* individuals), not M10 complete kits (S-*-4PK).
No core-drill path → no grout. No covers (no dress rings / domical covers in channel systems).

## Pool channel Configure UI structure (mirrors glass-spigots-config.tsx)

Section 1. **Configure** (gaps/layout — IDENTICAL to spigots, no changes)
Section 2. **Channel** (replaces "Spigots" section):
   - Channel finish: Black | Satin Anodised (visual toggle, default SA) — flows through job
   - Substrate: Timber | Concrete | Steel (default Timber) → shows fixings-included summary line
   - Mounting: deck mount (informational — single value V1, no input)
   - NO covers section, NO family picker
Section 3. **Gate, raked & custom** — IDENTICAL to spigots (gate hardware/hinges/latches unchanged;
   hinges clamp glass-to-glass, independent of base mounting system)

## Bal channel 15mm — OPERATOR RULING 2026-06-03 (supersedes details below)

"The VersaTilt channel in 15mm uses the SAME logic as the pool fence channel but adds
rail, and the friction plates are at 300mm centres."

### Bal channel 15mm physical proportions (OPERATOR RULING 2026-06-03, second ruling)

"The glass for 15mm channel is 1000mm high; when in channel, finished glass height is
1035mm, plus the rail."
- **Glass: 1000mm high**, sits INSIDE the channel, base **35mm above the floor**
  → finished glass height = **1035mm** (vs pool's 1200mm glass / 37mm base / 1237mm).
- **35-Series rail (35mm) sits on the glass top edge** → finished height = **1070mm**.
- Elevation draws all three: 1000mm panels, 35mm in-channel offset, 35mm rail bar.

Build = pool channel wizard carried over verbatim, with exactly these changes:
1. + Rail section (35-Series top rail — reuse the Rail accordion from glass-bal-spigots-config.tsx;
   rail finish auto-matches channel finish B→B / SA→SA)
2. Friction plates: 300mm CENTRES (not pool's 150mm-ends/500mm-max) — elevation + BOM
3. No gates (balustrade), no raked panels
4. Glass 15mm × 1000mm high; variant: glass-bal-channel
5. Everything else identical: finish (B/SA), substrate→M12 fixings, deck mount,
   terminations (end cap/mitre), 4200mm stock, joins (4 pins/join, packs of 10),
   automatic cut optimisation via lib/cut-plan.ts

## Bal channel 15mm extras (older notes, see ruling above)

Adds on top of the pool channel block:
- Per-section channel terminators L/R: {Mitre, Join, End cap}, default End cap
- Per-section rail terminators L/R: 2-step {Termination → Wall tie/Offset/End cap, Connection → Corner 90°/Adjustable}
- Fall-height band: {<1m, 1m–5m, >5m}, default 1m–5m (>5m = manual-review flag, never refuse)
- 35-Series top rail (finish auto-matched, no input)
- Panel rules: 23 widths 300–1400mm, gap ceiling 125mm (AS 1170) — needs solver mode
  (pool uses ≤99mm gaps; balustrade allows ≤125mm)
- No gates, no raked panels

## Verification

- Oracles: `npx tsc --noEmit` = 80 baseline; `npx vitest run` = 7 pre-existing failures / 125+ passed;
  `server/tests/centred-gate-rules.spec.ts` must stay 12/12
- Browser harness: /tmp/fl2-browser (playwright-core, channel:'chrome', headless)
- Dev server: `export $(cat .env | xargs) && PORT=5173 npm run dev` — RESTART after server-side changes (tsx doesn't hot-reload)
- Workflow: never commit without operator approval; operator hands-on round before merge
