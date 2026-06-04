# Aluminium Balustrade — UI build spec (BARR + Blade)

> Working doc. Condensed from the ECO Vault: alu-bal-barr (SF-12 / chat 6) +
> alu-bal-blade (SF-13 / chat 7) inputs specs, both read in full. Operator authority wins.

## Shared engine (both styles)

A single `AluBalConfig` component (style="barr"|"blade") + a shared `emitBalHardware`
BOM helper, because BARR Bal and Blade Bal use the SAME AIRE post family + XP covers +
3D fixings matrix. Only panels + brackets + finish availability differ.

- **No gates, no in-ground, no AS 3000** (balustrade, not pool).
- **3-value substrate**: Core-drilled / Base-plated / Face-mounted.
- **AIRE post family (AR-)** — universal HD 50×50 balustrade posts:
  - Core-drilled → `AR-5800-FP-{code}` (cut to length on site) + `XP-TP` top plate + `XP-DR` dress ring + grout (CEIL/15 +spare)
  - Base-plated → `AR-1050-FPBP-{code}` + `XP-DC-2P` domical cover
  - Face-mounted → `AR-1500-FMID-{code}` mid posts + `AR-1500-FMLR-{code}-2PK` L+R end pack + dome nuts
- **Substrate-driven corner topology**: face-mount corners = 2 posts back-to-back; core/base share. Corners stepper in the config.
- **3D fixings matrix** (substrate × material): base timber `S-110LAG-4PK` / concrete `S-120ROD-4PK`+`SOUD-CA1400`÷20 / steel customer; face timber `GS160LAG`×4 / concrete `GS150ROD`×4+`SOUD`÷15 / steel customer; dome nuts on all face-mount (Black `GS-DN-4PK-B`, Silver `GS-DN-4PK` for White).
- **Fall-height band** (<1m / 1m-5m default / >5m): >5m shows a manual-quote notice (no BOM).
- Material question conditional: shown for base-plated + face-mounted; hidden for core-drilled (uniform chemical bond).
- BOM emitted ONCE at span 0 with design-level totals (corner topology is cross-section).

## BARR Bal (alu-bal-barr)
- 2 finishes (Satin Black / Pearl White) — finish picker drives every SKU.
- Panel `BR-PANEL-1733-1000-{B/W}` (1733 stock). Brackets `BR-BR60-{B/W}-4PK` + `BR-BRCAP` cap (paired, per panel).
- **Fall-height c-to-c ceiling**: 1m-5m → panels capped 1365mm (1425mm post centres);
  <1m → 1733 stock. SOLVER change: `calculateBarrPanelLayout` gains `maxPanelOverride`;
  layout-service passes 1365 at 1m-5m. `balFallHeight` plumbed through the layout request.

## Blade Bal (alu-bal-blade)
- **Black only** (no finish picker). Panel `BLA-PNL-1700-1000-B` (1700 stock).
- Brackets `FF-BH-OPEN-4PK-B` (FastFit, NO cap).
- **No c-to-c ceiling** — the 40×40 SHS rail + enclosed bracket spans the full stock width at all fall bands (operator Q2).

## Deviations from the inputs spec (operator to ratify)
- Corners: derived from design shape as the default, with a manual stepper override (spec field #2).
- "Number of height changes" (plan-view only, no emission) — omitted from the V1 UI.
- Multi-run / odd end-termination L+R surplus: V1 assumes one connected run (1 L+R pack); fine for the common case.

## Storefront blockers (operator batch-apply session)
- SF-12/13: AR- + XP- + fixings placements under `balustrade-aluminium-{barr,blade}-*` L4 (SKUs exist).
- `GS150ROD` SKU code verify.

## Verification
- tsc ≤79; vitest 7 pre-existing fails / 139 passed (+5 bal BOM tests; slot-resolver-balustrade 6/6).
- Browser: /tmp/fl2-browser/verify-alu-bal.mjs (38/38 + regressions). BOM via /api/quote both styles + ceiling.
- SERVER change → dev server restart required after pulling.
