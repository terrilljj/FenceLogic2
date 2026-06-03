# Barrier Hub FenceLogic2 — Claude Code Project Context

## Repository
GitHub: https://github.com/terrilljj/FenceLogic2
Replit: connected to GitHub main (auto-deploys on merge)
Live app: https://design-scraper-terrilljason.replit.app

## Local development
cd ~/FenceLogic2
export $(cat .env | xargs) && npm run dev
App runs at http://localhost:5000

## What this app is
A fence/balustrade quoting calculator for Australian glass pool
fencing and balustrade products. Users configure fence sections,
get a panel layout, and receive a component list (BOM).
Lead capture via email before BOM is revealed.
Powered by SolveLogic — a configurable BOM solver engine.

## Stack
- React 18 + Vite (client/)
- Node.js + Express (server/)
- PostgreSQL + Drizzle ORM (server/db/)
- TanStack Query, Tailwind, Radix UI

## SECURITY STATUS — audited 2026-06-03 (original critical list RESOLVED)
All six original critical issues are fixed:
1. ✅ BOM assembly server-side (POST /api/quote); layout solver server-side (POST /api/layout)
2. ✅ GET /api/products/lookup deleted
3. ✅ POST /api/email-quote rate-limited (3/hour); /api/quote and /api/layout also limited
4. ✅ All /api/admin/* and /api/products* routes behind requireAdmin (server/middleware/auth.ts)
5. ✅ GET /api/debug/* routes removed (stale refs remain in client/src/lib/adminCoverage.ts
   and server/scripts/qa-gate.ts — harmless, they just 404)
6. ✅ GET /api/designs bound to session (storage.getFenceDesignsBySession)

Fixed in the 2026-06-03 audit (fix/api-security-hardening):
7. ✅ Admin login: NO hardcoded credential fallback (was admin/admin123). ADMIN_USERNAME
   and ADMIN_PASSWORD env vars are REQUIRED for admin access — login returns 503 without
   them. Timing-safe comparison + rate limit (10 attempts / 15 min).
8. ✅ Session secret: NO hardcoded fallback. SESSION_SECRET env var, or random per-boot.
9. ✅ Personal Notion dashboard endpoints (/api/dashboard, /api/personal/:type) DELETED —
   they belonged to a different project and exposed private data with no auth.

## REQUIRED PRODUCTION ENV VARS (set in Replit Secrets)
- DATABASE_URL    (existing)
- ADMIN_USERNAME  (admin UI login — admin login is DISABLED if unset)
- ADMIN_PASSWORD  (admin UI login — admin login is DISABLED if unset)
- SESSION_SECRET  (cookie signing — random per-boot fallback if unset; sessions
                   then reset on every restart/deploy)

## Architecture decisions — DO NOT DEVIATE
- BOM assembly MUST move server-side
- Email gate MUST be enforced server-side
- All /api/admin/* routes need auth middleware before handlers
- POST /api/quote is the single endpoint: layout + BOM + lead capture

## SKU / price exposure — UPDATED 2026-05-31 (owner decision, supersedes old "no SKU to client" rule)
- SKUs and RETAIL prices are PUBLIC on the storefront (`/products/[cat]/[sub]/[sku]`
  URLs + public `products.json` feed, no auth gate). Treating them as secret in the
  calculator was redundant. The calculator MAY reference SKU-keyed assets (e.g. product
  images from the storefront) and MAY show SKU/retail price on screen.
- The retained protection is NOT secrecy — it is: never ship the full product+slot
  catalog or the BOM assembly recipe (config → kit + quantities) to the client as one
  machine-readable dump. Keep the solver server-side (correctness + defensibility).
- If a non-retail price tier (trade/cost/margin) ever exists, THAT stays server-side.

## Output & lead capture — owner policy (LEAD QUALITY, not secrecy)
- Full deliverable (design + full SKU list + prices, packaged/downloadable) is EMAIL-ONLY:
  it is SENT to the entered address so a real, deliverable inbox is required (a bounce =
  tyre-kicker, not a lead). Do NOT render the full priced SKU plan on screen just because
  an email was typed.
- On screen: design/elevation + a BOM PREVIEW (descriptions). Full priced SKU plan → email.
- The downloadable PDF is a PREVIEW — it must NOT contain the full SKU list + prices.

## Git workflow
- Never commit directly to main
- Branch naming: fix/[issue], feat/[feature]
- One logical change per branch
- Open a PR after each branch — Replit auto-deploys on merge to main

## Verification commands after every server change
(dev server may run on PORT=5173 locally; adjust as needed)
curl http://localhost:5000/api/products/lookup
  → 404 (endpoint deleted)
curl http://localhost:5000/api/admin/products
  → 401 without session
curl http://localhost:5000/api/debug/ui-config/glass-pool-spigots/coverage
  → 404 (debug routes deleted)
curl http://localhost:5000/api/dashboard
  → 404 (personal Notion endpoints deleted)
curl -X POST http://localhost:5000/api/admin/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
  → 401 or 503 — the old default credentials must NEVER work

## DO NOT CHANGE without explicit instruction
- Panel layout algorithm (server-side, working correctly)
- Drizzle schema migrations (destructive if wrong)
- UI component library (Radix + Tailwind)
- Replit configuration files
- reusePort setting (removed for macOS compatibility)
