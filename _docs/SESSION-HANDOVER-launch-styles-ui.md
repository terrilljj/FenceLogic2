# HANDOVER — FL2 Launch Styles UI Rollout

> Paste into a new Claude Code session: **"Read _docs/SESSION-HANDOVER-launch-styles-ui.md and continue the launch styles UI rollout from where it left off."**
> Written 2026-06-03 at the end of the pool-channel session. Everything below is current as of PR #32 merged to main.

## Mission

Bring all **11 V1 launch styles** to the same wizard-UI standard as glass-pool-spigots, THEN move to SKUs / SKU pricing / SKU images. UI first for all styles — operator ruling.

## The 11 launch styles + status

| # | Style | Variant key | Status |
|---|---|---|---|
| 1 | Pool — Glass Spigots | `glass-pool-spigots` | ✅ DONE (PR #30) |
| 2 | Pool — Glass Channel | `glass-pool-channel` | ✅ DONE (PR #32) |
| 3 | Bal — Spigots 12mm | `glass-bal-spigots-12mm` | ✅ Done (verify polish in cleanup) |
| 4 | Bal — Spigots 15mm | `glass-bal-spigots-15mm` | ✅ Done (verify polish in cleanup) |
| 5 | Bal — Channel 15mm | `glass-bal-channel` (force 15mm) | ⬜ NEXT — task #2 |
| 6 | Bal — Standoff 15mm | `glass-bal-standoffs` | ⬜ task #3 |
| 7 | Pool — Blade | `alu-pool-blade` | ⬜ task #4 |
| 8 | Pool — BARR | `alu-pool-barr` | ⬜ task #4 |
| 9 | Pool — Flat Top | `alu-pool-tubular` | ⬜ task #4 |
| 10 | Bal — BARR | `alu-bal-barr` | ⬜ task #5 |
| 11 | Bal — Blade | `alu-bal-blade` | ⬜ task #5 |

Then task #6: launch cleanup + end-to-end pass of all 11. Operator says metal (alu) styles are FAR simpler than glass.

## The proven build recipe (used for pool channel — repeat per style)

1. **Read the style's walk doc + inputs spec from the ECO Vault** (paths below) BEFORE coding
2. **Branch**: `feat/calc-<style>-wizard` from main
3. **Route the variant into the wizard**: `fence-builder.tsx` → `isWizardVariant` (~line 608)
4. **Config block**: extend an existing one (variant prop, like channel did to `glass-spigots-config.tsx`) or create one (like `glass-bal-spigots-config.tsx`); wire the dispatch in `span-config-panel.tsx` (~line 461) and exclude the variant from the old-UI blocks (`!isGlassPoolChannel`-style flags)
5. **Elevation**: check/extend `fence-visualization.tsx` (variant flags ~line 517; NOTE: file has TWO render functions — the FIRST one is the elevation)
6. **Joe tips**: `wizard/joe-tips.ts` `step2Tips()`
7. **Verify**: Playwright harness + oracles (below) → operator hands-on round → fix round(s)
8. **Commit (only after operator approval) → PR → operator says merge → merge**

## Vault spec locations (ECO Vault MCP)

`verticals/barrier-hub/calculator/style-validation/`:
- Bal channel 15mm: `sf-10-glass-bal-channel-15mm-walk.md` + `glass-bal-channel-15mm-calculator-inputs-spec.md` (COMPLETE — every input/default/formula)
- Bal standoff: `sf-16-glass-bal-standoff-15mm-walk.md` + `glass-bal-standoffs-calculator-inputs-spec.md`
- Alu pool: `sf-05-alu-pool-blade-walk.md`, `sf-04-alu-pool-barr-walk.md`, `sf-03-alu-pool-tubular-walk.md` + `alu-pool-*-calculator-inputs-spec.md`
- Alu bal: `sf-12-alu-bal-barr-walk.md`, `sf-13-alu-bal-blade-walk.md` + specs
- Channel system rules (pool + bal): `_docs/channel-ui-build-spec.md` IN THIS REPO (operator-corrected rules — overrides vault where they differ)

## Bal Channel 15mm — what's already known (next style)

- Read `_docs/channel-ui-build-spec.md` first — pool channel work carries over heavily
- Differences from pool channel: 15mm glass, 1000mm height, NO gates, 35-Series top rail
  (finish auto-matched to channel finish), fall-height band input (<1m / 1m–5m / >5m manual review),
  rail terminators (2-step: Termination→Wall tie/Offset/End cap, Connection→Corner/Adjustable),
  panel gap ceiling 125mm (AS 1170) vs pool's 99mm — MAY NEED A SOLVER MODE (server-side)
- The home page card + product selector entry already exist (`glass-bal-channel`, labelled 15mm)
- Cut optimisation: reuse `client/src/lib/cut-plan.ts` — channel 4200mm + NEW handrail 5800mm planning

## Verification harness + oracles

- **Dev server**: `export $(cat .env | xargs) && PORT=5173 npm run dev` (background). CRITICAL: tsx does NOT hot-reload server files — restart after any server/ change. Client changes hot-reload via Vite.
- **Browser**: Playwright scripts at `/tmp/fl2-browser` (playwright-core, channel:'chrome', headless). Pattern: clear localStorage → `?variant=X` → fill length → wizard-next → assert testids.
- **Oracles**: `npx tsc --noEmit` ≤ 79 errors (no new); `npx vitest run` = 7 pre-existing failures / 125 passed (`server/tests/centred-gate-rules.spec.ts` must stay 12/12)

## Workflow rules (operator's standing rules)

- NEVER commit without operator approval; never `git add -A`; never commit to main directly
- One logical change per branch → PR → operator approves merge → Replit auto-deploys
- Operator does hands-on rounds; expect iterative fix rounds with screenshots
- Operator domain authority is ground truth — never invent compliance/standards/product rules; when the vault and the operator differ, the operator wins; record corrections in `_docs/`
- Data layer is frozen (no Drizzle schema changes); solver stays server-side (IP protection)

## Deferred / parked (do not lose)

- **Tile images**: calculator cards to use storefront tile images — `~/Code/barrierhub-storefront/src/components/category/SubcategoryTileGrid.tsx` (operator: "later when we do the other image placement updates")
- **AS-3000 for channel**: not implemented (no operator ruling) — flagged, operator to decide
- **BOM emission phase** (after UI): covers/fixings per SF-1 matrix, channel components per `_docs/channel-ui-build-spec.md`, cut-plan quantities
- **stockPanelFit.ts** still client-side (custom-frameless variant — not a launch style)
- After all UI: **SKUs → SKU pricing → SKU images** phase

## Memory + tasks

Claude's memory directory has `fl2-v1-launch-styles.md`, `fl2-configure-redesign-progress.md`, `fl2-wizard-oxworks-baseline.md`, `fl2-frozen-elevation-diagnosis.md` — auto-loaded each session. The task list (6 tasks) persists in the session task system; tasks #2–#6 remain.
