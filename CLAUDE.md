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

## CRITICAL SECURITY ISSUES — fix in this order
1. BOM assembly is client-side ($K function) — move to POST /api/quote
2. GET /api/products/lookup is public — DELETE this endpoint
3. POST /api/email-quote has no rate limiting — add express-rate-limit
4. Admin endpoints have no server-side auth — add requireAdminAuth middleware
5. GET /api/debug/* exists in production — delete it
6. GET /api/designs returns all designs — bind to session

## Architecture decisions — DO NOT DEVIATE
- BOM assembly MUST move server-side
- Products NEVER go to client browser
- Email gate MUST be enforced server-side
- All /api/admin/* routes need auth middleware before handlers
- POST /api/quote is the single endpoint: layout + BOM + lead capture
- Response from /api/quote contains descriptions only, NO supplier SKUs

## Git workflow
- Never commit directly to main
- Branch naming: fix/[issue], feat/[feature]
- One logical change per branch
- Open a PR after each branch — Replit auto-deploys on merge to main

## Verification commands after every server change
curl http://localhost:5000/api/products/lookup
  → Should be 404 after fix (currently 200 — CRITICAL)
curl http://localhost:5000/api/admin/products
  → Should be 401 without session
curl http://localhost:5000/api/debug/ui-config/glass-pool-spigots/coverage
  → Should be 404 after fix

## DO NOT CHANGE without explicit instruction
- Panel layout algorithm (server-side, working correctly)
- Drizzle schema migrations (destructive if wrong)
- UI component library (Radix + Tailwind)
- Replit configuration files
- reusePort setting (removed for macOS compatibility)
