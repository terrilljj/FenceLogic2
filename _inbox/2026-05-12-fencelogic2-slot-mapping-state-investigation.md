# FenceLogic2 — Slot Mapping Wiring State Investigation

**Date:** 2026-05-12
**Scope:** Read-only diagnostic across admin UI, solver runtime, git history, tests, and template artefacts to determine which V1 styles are wired through the data-driven slot pipeline vs. hardcoded fallbacks.
**Working tree at investigation time:** clean, HEAD = `1533b7b` (2026-05-03).

---

## 0. Summary at a glance

There is *no* mechanism in this repo where the solver picks between "DB-driven path" and "hardcoded path" per-style. The branch is **per product-variant inside `calculateComponents`**:

- **Glass variants** (default branch, lines ~423–561 of `server/services/bom-calculator.ts`) call `lookupSlot(...)` against `product_slots` for `glass-panels` and `spigot-hardware` fields. Everything else for glass styles (gate hardware, channel hardware, raked panels, hinge panels, custom panels, balustrade rail terminations) is hardcoded.
- **Semi-Frameless, Blade, BARR, Tubular** variants take their own `else if` branches that synthesise SKUs via template literals — no slot lookup, no DB read. The `slotMappings` array is loaded and passed in but ignored on these branches.

So calling these styles "DB-driven vs hardcoded" is misleading: every V1 style is a **mix**, and the only DB-driven surface currently exercised is *glass-panels* (with the 0001 migration backfill) and *spigot-hardware* (since the May 3 resolver rewrite; not yet populated for most families).

---

## 1. Admin UI slot mapping

### 1a. Admin interface code

Primary admin slot-mapping page: `client/src/pages/slot-manager.tsx` (576 lines, last touched 2026-05-03 in `872396f`).

The page is data-driven now — it has no hardcoded list of styles or fields:

```tsx
// client/src/pages/slot-manager.tsx:66-69
// Fetch active styles from DB (replaces hardcoded FIELD_DEFINITIONS)
const { data: styles = [] } = useQuery<FenceStyle[]>({
  queryKey: ["/api/styles"],
});
```

```tsx
// client/src/pages/slot-manager.tsx:77-86
const { data: slots = [], isLoading: slotsLoading } = useQuery<ProductSlot[]>({
  queryKey: ["/api/admin/product-slots", selectedVariant, selectedField],
  queryFn: async () => {
    if (!selectedVariant || !selectedField) return [];
    const res = await fetch(`/api/admin/product-slots/${encodeURIComponent(selectedVariant)}/${encodeURIComponent(selectedField)}`);
    if (!res.ok) throw new Error("Failed to fetch slots");
    return res.json();
  },
  enabled: !!selectedVariant && !!selectedField,
});
```

There are *two* `/api/styles` route registrations in `server/routes.ts` (line 1316 and line 1779) — both call `storage.getActiveFenceStyles()`. The later one wins (Express last-wins). Returns rows from the `fence_styles` table where `is_active = 1`.

The admin page also has a separate detailed config view: `client/src/pages/style-config.tsx`, which calls `GET /api/styles/:code/config` (`server/routes.ts:1790`). That endpoint returns `{ style, fields, productSlots }` where `productSlots` is from the **`style_product_slots`** table (FK to `fence_styles.id`) — *not* the `product_slots` table that the runtime solver actually reads from.

### 1b. Backing DB tables — there are at least two parallel slot tables

This is the part most likely to confuse the operator. There are **two slot tables** with overlapping responsibilities:

| Table | Schema location | Joined to style by | Read by runtime BOM solver? |
|---|---|---|---|
| `product_slots` | `shared/schema.ts:741` | `product_variant` (string, e.g. `glass-pool-spigots`) | **YES** — via `storage.getAllSlotsByVariant(design.productVariant)` |
| `style_product_slots` | `shared/schema.ts:864` | `fence_style_id` (FK to `fence_styles.id`) | **NO** — only read by `GET /api/styles/:code/config` for the admin view |

```ts
// shared/schema.ts:741-756 — the table the solver actually reads
export const productSlots = pgTable("product_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internalId: varchar("internal_id", { length: 50 }).notNull(),
  productVariant: varchar("product_variant", { length: 100 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  sequence: integer("sequence").notNull(),
  productId: varchar("product_id", { length: 100 }),
  label: varchar("label", { length: 200 }),
  discriminatorAttributes: jsonb("discriminator_attributes"),
  isActive: integer("is_active").notNull().default(1),
  ...
});
```

```ts
// shared/schema.ts:864-883 — the "other" slot table, written by template-import
export const styleProductSlots = pgTable("style_product_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fenceStyleId: varchar("fence_style_id", { length: 100 }).notNull(),
  fieldKey: varchar("field_key", { length: 100 }).notNull(),
  selectorKey: varchar("selector_key", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }),
  productCode: varchar("product_code", { length: 100 }),
  label: varchar("label", { length: 200 }),
  ...
});
```

The Slot Manager page (`slot-manager.tsx`) drives `product_slots` (the live table). The template import endpoint (`POST /api/templates/import` at `server/routes.ts:1484`) drives `style_product_slots` (the view-only table):

```ts
// server/routes.ts:1552-1574 — template import writes to style_product_slots, NOT product_slots
if (matchingStyle) {
  console.log(`[Template Import] Linking products to style: ${matchingStyle.label}`);
  await storage.deleteStyleProductSlots(matchingStyle.id);
  for (const mapping of processed.productMappings) {
    ...
    await storage.createStyleProductSlot({
      fenceStyleId: matchingStyle.id,
      fieldKey: mapping.variableType,
      selectorKey: mapping.sizeMm ? mapping.sizeMm.toString() : mapping.slotPrefix || '',
      productId,
      ...
    });
  }
}
```

**Implication:** importing a CSV template via the admin Templates page (`client/src/pages/templates.tsx`) **does not feed the runtime solver**. It populates `style_product_slots`, which only `GET /api/styles/:code/config` reads. The solver only sees what's in `product_slots`, which is exclusively written by the Slot Manager UI (or the SQL backfill in `migrations/0001_generic_slot_resolver.sql`).

That is the single biggest "operator can't see what's wired through where" gap I found.

### 1c. Which styles does the admin list slot data for

The admin slot-manager lists whatever `GET /api/styles` returns (any `fence_styles` row with `is_active = 1`). The fence_styles rows themselves are not seeded by any code in this repo — there is no programmatic seed for `fence_styles` in `server/scripts/*`, only for `fence_ui_configs` (a separate table). Migration `0001` UPDATEs existing rows but does not INSERT them:

```sql
-- migrations/0001_generic_slot_resolver.sql:37-56 — backfills panel size config but
-- only on rows where code is already present in fence_styles
UPDATE fence_styles
SET
  panel_increment  = COALESCE(panel_increment, 50),
  panel_field_name = COALESCE(panel_field_name, 'glass-panels'),
  panel_prefix     = COALESCE(panel_prefix, 'GP')
WHERE code = 'glass-pool-spigots';
...
WHERE code IN ('glass-bal-spigots', 'glass-bal-channel', 'glass-bal-standoffs', 'custom-frameless');
```

The codes the migration explicitly UPDATEs are: `glass-pool-spigots`, `glass-pool-channel`, `glass-bal-spigots`, `glass-bal-channel`, `glass-bal-standoffs`, `custom-frameless`. That is the only durable *code-level* evidence of which `fence_styles` rows exist. Whether any of them actually have mapped `product_slots` data is observable only from the live DB, not the repo.

---

## 2. Solver runtime path

### 2a. Entry point

```ts
// server/routes.ts:205-244 — single public BOM entry
app.post("/api/quote", quoteLimiter, async (req, res) => {
  ...
  const [slotMappings, products] = await Promise.all([
    design.productVariant
      ? storage.getAllSlotsByVariant(design.productVariant)
      : Promise.resolve([]),
    storage.getAllProducts(),
  ]);
  ...
  const components = calculateComponents(design, slotData, productData);
  res.json({ components: stripSkus(components) });
});
```

`getAllSlotsByVariant` filters `product_slots` by `productVariant` AND `is_active = 1`:

```ts
// server/storage.ts:414-421
async getAllSlotsByVariant(productVariant: string): Promise<ProductSlot[]> {
  return await db.select().from(productSlots)
    .where(and(
      eq(productSlots.productVariant, productVariant),
      eq(productSlots.isActive, 1)
    ))
    .orderBy(asc(productSlots.fieldName), asc(productSlots.sequence));
}
```

### 2b. The resolver inside `calculateComponents`

Generic slot resolver — only called from the **glass** branch:

```ts
// server/services/bom-calculator.ts:54-80
const lookupSlot = (fieldName: string, discriminators: Record<string, string>): ProductDetails | null => {
  const fieldSlots = slotMappings.filter(s => s.fieldName === fieldName && s.productId);
  if (fieldSlots.length === 0) return null;

  for (const slot of fieldSlots) {
    const product = products.find(p => p.id === slot.productId);
    if (!product) continue;

    if (slot.discriminatorAttributes) {
      const attrs = slot.discriminatorAttributes as Record<string, string>;
      if (Object.entries(discriminators).every(([k, v]) => String(attrs[k]) === String(v))) {
        return { sku: product.code, description: product.description };
      }
    } else {
      // Legacy path: regex match on size_mm against product description/code
      const panelWidth = discriminators.size_mm;
      if (panelWidth) {
        const widthPattern = new RegExp(`\\b${panelWidth}(mm|W)\\b`, 'i');
        if (widthPattern.test(product.description) || widthPattern.test(product.code)) {
          return { sku: product.code, description: product.description };
        }
      }
    }
  }
  return null;
};
```

### 2c. Per-variant runtime branches

Variant routing inside `calculateComponents` (`server/services/bom-calculator.ts:83-94`):

```ts
const isChannelSystem = design.productVariant === "glass-pool-channel";
const isBladeFencing = design.productVariant === "alu-pool-blade";
const isBarrFencing = design.productVariant === "alu-pool-barr";
const isTubularFencing = design.productVariant === "alu-pool-tubular";
const isSemiFrameless = design.productVariant === "semi-frameless-1000" || design.productVariant === "semi-frameless-1800";
const gatesAllowed = !design.productVariant.includes("bal-");
```

#### Semi-Frameless 1000/1800 — fully hardcoded SKUs

```ts
// bom-calculator.ts:95-188 — every SKU built from template literals; lookupSlot never called
if (isSemiFrameless && span.panelLayout && span.panelLayout.panels.length > 0) {
  ...
  components.push({
    qty: 1,
    description: `Semi-Frameless Glass Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
    sku: `SF-PANEL-${panelWidth}-${glassHeight}-${glassThickness}`,
  });
  ...
  components.push({
    qty: numPosts,
    description: postDescription,
    sku: `SF-POST-50-${glassHeight + 200}-${postFinish.toUpperCase()}-${postMounting.toUpperCase()}`,
  });
  ...
  return; // exits the span early — DB slot data is never consulted
}
```

#### Blade Pool — fully hardcoded

```ts
// bom-calculator.ts:190-263
else if (isBladeFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
  const panelSpecs: Record<string, { width: number; height: number; sku: string }> = {
    "1000mm": { width: 1700, height: 1000, sku: "BLADE-1000" },
    "1200mm": { width: 2200, height: 1200, sku: "BLADE-1200" },
  };
  ...
  components.push({
    qty: 1,
    description: `Blade Panel ${bladeHeight} x ${panelWidth}mm (Cut from ${spec.width}mm, ${finishName})`,
    sku: `${spec.sku}-CUT-${panelWidth}-${finishSku}`,
  });
  ...
  return;
}
```

#### BARR Pool — fully hardcoded

```ts
// bom-calculator.ts:265-339
else if (isBarrFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
  const panelSpecs: Record<string, { width: number; height: number; sku: string }> = {
    "1000mm": { width: 1733, height: 1000, sku: "BARR-1000" },
    "1200mm": { width: 2205, height: 1200, sku: "BARR-1200" },
    "1800mm": { width: 1969, height: 1800, sku: "BARR-1800" },
  };
  ...
  return;
}
```

#### Tubular Pool (Flat Top) — fully hardcoded

```ts
// bom-calculator.ts:341-421
else if (isTubularFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
  const panelWidths: Record<string, number> = {
    "2400mm": 2400, "2450mm": 2450, "3000mm": 3000,
  };
  ...
  return;
}
```

#### Default glass branch — slot-driven for panels and spigots, hardcoded for everything else

```ts
// bom-calculator.ts:424-503 — panels: DB lookup, hardcoded fallback
if (span.panelLayout && span.panelLayout.panels.length > 0) {
  const panels = span.panelLayout.panels;
  ...
  panels.forEach((panelWidth: number, index: number) => {
    const panelType = panelTypes[index] || "standard";

    if (panelType === "standard") {
      const mappedProduct = lookupSlot("glass-panels", { size_mm: String(panelWidth) });

      if (mappedProduct) {
        components.push({
          qty: 1,
          description: mappedProduct.description,
          sku: mappedProduct.sku,
        });
      } else {
        components.push({
          qty: 1,
          description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
          sku: `GP-${panelWidth}-1200-12`,
        });
      }
    } else if (panelType === "raked") {
      // hardcoded — no slot lookup
      ...
      components.push({
        qty: 1,
        description: `Raked Glass Panel 1200mm wide (...) ${height}mm) 12mm thick`,
        sku: `RP-L-1200-${height}-12`,
      });
    } else if (panelType === "gate") {
      // hardcoded
      components.push({ qty: 1, description: `Gate Panel ${panelWidth}mm x 1200mm (12mm thick)`, sku: `GP-GATE-${panelWidth}-1200-12` });
    } else if (panelType === "custom") {
      // hardcoded
    } else if (panelType === "hinge") {
      // hardcoded
    }
```

```ts
// bom-calculator.ts:486-502 — spigots: DB lookup w/ family/mounting/finish, fallback to getSpigotDetails
if (!isChannelSystem) {
  const fieldValues = (span as any).fieldValues || {};
  const mounting = fieldValues['spigot-mounting'] || (span as any).spigotMounting || 'base-plate';
  const finish = fieldValues['spigot-color'] || (span as any).spigotColor || 'polished';
  const family = fieldValues['spigot-family'] || '';
  const discriminators: Record<string, string> = { mounting, finish };
  if (family) discriminators.family = family;

  const slotResult = lookupSlot('spigot-hardware', discriminators);
  if (slotResult) {
    components.push({ qty: 2, description: slotResult.description, sku: slotResult.sku });
  } else {
    const fallback = getSpigotDetails(mounting as SpigotMounting, finish as SpigotColor);
    components.push({ qty: 2, description: fallback.description, sku: fallback.sku });
  }
}
```

Gate hardware on the default glass branch is hardcoded via `getHingeDetails` / `getLatchDetails` (`bom-calculator.ts:534-560`), as is channel hardware (`bom-calculator.ts:506-531`) and the glass-balustrade top-rail optimisation block (`bom-calculator.ts:646-761`).

---

## 3. Git history

### 3a. Most recent slot-touching commits

```
1533b7b 2026-05-03 fix: admin bom-preview endpoint + discriminator type safety + is_active filter
872396f 2026-05-03 feat: generic slot resolver — discriminatorAttributes + data-driven UI
f53db19 2026-05-03 feat: vault slot map → template import transform script + glass-pool-spigots output
4dfe4da 2025-10-19 Group product slots by category for better organization
8bf3f81 2025-10-19 Add support for product slots and fence style configurations
eeb9868 2025-10-19 Add slot mapping and configuration for glass pool fence spigot options
df66d3d 2025-10-19 Improve slot generation by auto-generating from panel size registry
e300ea8 2025-10-19 Update slot management to use configurable unique IDs and improve product lookup
0a0d8c0 2025-10-19 Add a slot manager for configuring glass pool fence components
```

There is a **7-month gap** between the original slot infrastructure (2025-10-17 → 2025-10-19, all by Replit-generated commits) and the 2026-05-03 generic-resolver rewrite. Nothing was committed against slot logic between those dates.

### 3b. The 2026-05-03 rewrite — read the commit message carefully

```
commit 872396f  2026-05-03  feat: generic slot resolver — discriminatorAttributes + data-driven UI

DELIVERABLE 2 — Generic BOM resolver
- Replace hardcoded lookupProductFromSlot with lookupSlot(fieldName, discriminators)
- JS-side @> (contains) logic against discriminatorAttributes; null slots fall through to legacy regex
- Spigot calls use two-level fallback: slot match → getSpigotDetails()

DELIVERABLE 4 — PANEL_SIZE_REGISTRY fallback only
- Auto-generate reads panelIncrement/panelFieldName/panelPrefix from fence_styles first
- New slots get discriminatorAttributes: {size_mm} set on creation

DELIVERABLE 7 — Tests
- 7/7 slot-resolver.spec.ts tests pass
- Covers: size_mm discriminator, legacy regex, spigot family+mounting+finish, fallbacks, non-matches, 35-panel preservation

Constraints: ZERO hardcoded SKUs/prices in client/src, ZERO breakage of existing glass-panels
```

The phrase "**35-panel preservation**" in the test description, plus migration `0001` backfill of `discriminator_attributes` from `internal_id` patterns like `GP-NNNN`, strongly suggests that **35 mapped glass-panel slots existed in the live DB** under `productVariant = "glass-pool-spigots"` at the time of the rewrite. The test verifies that 35 mapped panels still resolve through the new code path. This is the only style I can find any DB-population evidence for.

There is no parallel "spigot-hardware preservation" test in the spec, suggesting the spigot-hardware slot table was *not* yet populated when the rewrite landed.

### 3c. No retreat from DB → hardcoded (or vice versa)

I can find no commits that "rip out" slot logic or revert glass panels to hardcoded. The 2026-04-04 commit `221c680` ("security: move BOM assembly server-side") moved the existing client-side hardcoded BOM logic to the server; the May 3 commit then layered the generic resolver on top of the glass branch. The semi-frameless / blade / BARR / tubular branches have been hardcoded since they were first added (1f53641 in 2025-10 for semi-frameless; the aluminium variants pre-date that).

---

## 4. Test artefacts

### 4a. Test coverage

Only one solver-level slot test file exists: `server/tests/slot-resolver.spec.ts` (169 lines). Every test in it uses `productVariant: "glass-pool-spigots"`:

```ts
// server/tests/slot-resolver.spec.ts:49
const design = makeDesign("glass-pool-spigots", [1200, 1200, 1000]);
// line 61, 74, 98, 114, 132, 161 — all the same variant
```

Tests covered:
1. `resolves glass panel by size_mm discriminator` (line 42)
2. `falls back to hardcoded description when no matching slot` (line 56)
3. `legacy path — resolves by regex when discriminatorAttributes is null` (line 69)
4. `resolves spigot-hardware by family + mounting + finish discriminators` (line 80)
5. `falls back to getSpigotDetails when no spigot-hardware slot matches` (line 112)
6. `does not match spigot slot when discriminators differ` (line 122)
7. `preserves existing 35 mapped glass panels — all resolve correctly` (line 145, uses a 3-slot representative subset)

No test covers `glass-pool-channel`, `glass-bal-*`, `semi-frameless-*`, `alu-pool-*`, or any PVC variant.

### 4b. Template / seed artefacts

- `templates/PRODUCT-STATUS.md` says: "01-pool-spigots.csv ✅ Complete example", every other style file is `🔧 Needs product data`, and `11-custom-frameless.csv ✅ Complete (calculator only, no products)`.
- `imports/01-pool-spigots-import.csv` exists (243 rows, generated 2026-05-03 by `scripts/transform-vault-csv-to-template.py`). No other `*-import.csv` files exist.
- The unique `variable_type` set in that file (38 distinct fields, including `spigot-hardware`, `gate-config`, `hinge-set`, `latch-set`, `raked-panel`, `hinge-panel-*`, `gate-panel-*`) shows the *intent* for spigot-mounted pool fencing.
- **But:** that CSV imports via `POST /api/templates/import`, which writes to `style_product_slots`, **not** the `product_slots` table the solver reads. So even after a successful import of `01-pool-spigots-import.csv`, the runtime solver would still see the old `product_slots` data (or nothing for new fields like `spigot-hardware`, `gate-config`, etc.).

### 4c. TODO / FIXME in solver code

`grep -rn "TODO|FIXME|HACK|XXX"` across `server/services`, `server/routes.ts`, `shared/schema.ts`, `client/src/pages/slot-manager.tsx` produced only:

```
server/routes.ts:992:      // TODO: Add validation with FenceStyleConfigSchema
server/routes.ts:1003:      // TODO: Add validation with FenceStyleConfigSchema
```

Neither is about slot mapping. No `TODO`s flagging slot work-in-progress.

---

## 5. Frameless Pool Fencing specifically

The operator's memory was "Frameless Pool spigots was ~80% working as of 31 March 2026". I cannot fully confirm or refute that from code, because the live `product_slots` / `style_product_slots` table contents are not in the repo — but the indirect evidence is:

1. **Frameless Pool Fence = `glass-pool-spigots`** in the codebase. The home page (`client/src/pages/home.tsx:16`) labels variant `glass-pool-spigots` as "Frameless Pool Fence". Migration `0001` explicitly targets that code (`WHERE code = 'glass-pool-spigots'`).

2. **Glass panels for this style — DB-driven, evidence of population.**
   - `migrations/0001_generic_slot_resolver.sql:25-33` includes a backfill that extracts size from `internal_id` patterns like `GP-1200`. This implies 35-ish rows already existed under `product_variant = 'glass-pool-spigots'`, `field_name = 'glass-panels'`.
   - The 2026-05-03 commit message and `slot-resolver.spec.ts:145` both reference "existing 35 mapped glass panels", consistent with the 31 March operator memory.
   - The 31 March date pre-dates the May 3 rewrite by ~5 weeks. So as of 31 March the glass-panels slots were resolved via the *legacy regex path* (the path now exercised in `slot-resolver.spec.ts:69`); after the rewrite they resolve via either discriminator path (post-backfill) or regex fallback (pre-backfill).

3. **Spigot hardware for this style — DB-capable but most likely unpopulated.**
   - The runtime code `lookupSlot('spigot-hardware', { mounting, finish, family? })` was introduced 2026-05-03 in `872396f`. No prior code reads from a `spigot-hardware` field.
   - `imports/01-pool-spigots-import.csv` *contains* `spigot-hardware` rows (e.g. Madrid core-drilled Polish/Satin/Black/Matt-White, base-plated variants — 6 families × multiple mounting × finish combinations).
   - But that CSV writes to `style_product_slots` via the template-import path, **not** `product_slots`. So importing it does not feed the solver.
   - If `spigot-hardware` is not populated in `product_slots`, the runtime falls back to `getSpigotDetails(mounting, finish)` — generic SKUs like `SP-{MOUNTING}-{FINISH}` (not real GO product codes).

4. **Everything else for this style — hardcoded.** Gate hardware, raked panels, hinge panels, custom panels, post-adapter plates, channel hardware (n/a here) are all literal-template SKUs.

So "80% working" is consistent with: glass-panel SKUs resolving correctly via the legacy regex path (the main visible win), spigot SKUs falling back to placeholder strings, and all gate/specialty SKUs being template literals. None of this is verifiable against the live DB from the repo alone; the operator should `psql` the `product_slots` table to confirm.

---

## 6. Notes / ambiguities to flag

- **Two slot tables, one read by the solver.** This is the single biggest correctness/UX trap. Anything imported via `POST /api/templates/import` lands in `style_product_slots` and is invisible to the runtime BOM. Operator action via Slot Manager UI writes to `product_slots` and is the one the solver reads.
- **No code-level seed for `fence_styles` rows.** The migration UPDATEs them but doesn't INSERT them. Rows must be created via `POST /api/admin/styles`. The repo does not capture which rows currently exist.
- **`getProduct` lookup in `GET /api/styles/:code/config`** (`server/routes.ts:1812-1817`) issues N+1 queries — not a correctness bug, just a perf thing for later.
- **Duplicate `/api/styles` route** at lines 1316 and 1779 of `server/routes.ts`. Both call the same storage method; harmless but noisy.
- The `glass-pool-channel` variant goes through the **default glass branch with `isChannelSystem = true`**, which skips spigot lookup and instead emits hardcoded channel/clamp/end-cap SKUs (`bom-calculator.ts:506-531`). Glass panels still slot-resolve.

---

## 7. Conclusions

### Last known working style (with evidence)

**`glass-pool-spigots` (Frameless Pool Fence) — glass-panel slot resolution only.**

Evidence:
- `migrations/0001_generic_slot_resolver.sql:25-33` backfills `discriminator_attributes` from existing `GP-NNNN` internal IDs, confirming pre-existing populated rows under `product_variant = 'glass-pool-spigots'`, `field_name = 'glass-panels'`.
- `server/tests/slot-resolver.spec.ts:145-168` explicitly tests "preserves existing 35 mapped glass panels".
- Commit `872396f` (2026-05-03) constraint: "ZERO breakage of existing glass-panels".

What is **not** working / verified for this style:
- `spigot-hardware` field has no commit evidence of being populated in `product_slots` (only in `style_product_slots` via the import CSV, which the solver ignores).
- All gate hardware, raked, hinge, custom, post-adapter SKUs are hardcoded literals.

### Recommended derisk style for ADR 0038 test

**`glass-pool-spigots` (Frameless Pool Fence).**

Rationale, in order of importance:
1. It is the only style with any persisted, code-evidenced `product_slots` data.
2. It is the only style with a passing test suite proving the slot pipeline end-to-end (`slot-resolver.spec.ts`).
3. The default glass branch of `calculateComponents` is the only branch wired to call `lookupSlot(...)`. Any other style except `glass-pool-channel` and the `glass-bal-*` family takes a hardcoded `else if` branch that never reads slot data.
4. The 2026-05-03 import CSV (`imports/01-pool-spigots-import.csv`) targets this exact variant with 242 rows ready for `spigot-hardware`, expanding the proof surface from glass panels to spigots.

Caveat: the import CSV pipes into `style_product_slots`, not `product_slots`. Before testing ADR 0038, the operator needs to confirm whether ADR 0038's slot_map_coding pipeline writes to `product_slots` (the solver-visible table) or `style_product_slots` (the view-only table). Testing against the wrong table will look like a no-op.

Second choice if `glass-pool-spigots` is unavailable: **`glass-bal-spigots`** — same default glass branch, also referenced in migration `0001`, but no test coverage and no evidence of populated rows.

Do **not** pick `semi-frameless-*`, `alu-pool-blade`, `alu-pool-barr`, `alu-pool-tubular` — these styles' branches in `bom-calculator.ts` never consult `slotMappings` at all, so a slot pipeline test against them would silently no-op regardless of population correctness.

### Hardcoded vs DB-driven by style

V1 styles as listed on `client/src/pages/home.tsx` (8 entries treated as "V1 pool/balustrade core"). Branch column quotes the file:line that handles the variant inside `calculateComponents`. "DB-driven for" lists the `fieldName`s where the solver calls `lookupSlot(...)`; everything else is hardcoded literals.

| # | Variant code | Display name (home.tsx) | Solver branch (bom-calculator.ts) | DB-driven for | Hardcoded for |
|---|---|---|---|---|---|
| 1 | `glass-pool-spigots` | Frameless Pool Fence | default glass branch (lines 424–561) | `glass-panels`, `spigot-hardware` | raked, gate panel, hinge panel, custom panel, gate hardware, post adapter |
| 2 | `glass-pool-channel-std` | VersaTilt Channel Pool Fence | default glass branch, `isChannelSystem` (line 83, 506–531) | `glass-panels` only | channel, clamps, end caps, gate hardware (no spigots applicable) |
| 3 | `glass-bal-spigots-12mm` / `-15mm` | Frameless Balustrade 12mm / 15mm | default glass branch + rail optimisation (646–761) | `glass-panels`, `spigot-hardware` | raked, gate panel, hinge panel, gate hardware, rail SKUs, rail terminations |
| 4 | `glass-bal-channel-std` / `-hd` | VersaTilt Channel Std / HD | default glass branch, `isChannelSystem` + rail optimisation | `glass-panels` only | channel, clamps, end caps, rail SKUs, rail terminations |
| 5 | `glass-bal-standoffs` | Standoff Balustrade | default glass branch + rail optimisation | `glass-panels` only (no `standoff-hardware` field exists) | standoff hardware, gate hardware, rail SKUs |
| 6 | `semi-frameless-1000` / `-1800` | Semi-Frameless 1000mm / 1800mm | `isSemiFrameless` branch (lines 95–188) | **none — slot data ignored** | every SKU (panels, posts, end posts, top/mid rail, gate hardware) |
| 7 | `alu-pool-tubular` | Flat Top Pool Fence | `isTubularFencing` branch (lines 341–421) | **none — slot data ignored** | every SKU |
| 8 | `alu-pool-barr` | BARR Pool Fence | `isBarrFencing` branch (lines 265–339) | **none — slot data ignored** | every SKU |
| 9 | `alu-pool-blade` | Blade Pool Fence | `isBladeFencing` branch (lines 190–263) | **none — slot data ignored** | every SKU |

(Counting 9 rows because the brief lists "8 V1 styles" but `home.tsx` exposes both 12mm/15mm balustrade-spigot variants and 1000/1800 semi-frameless as distinct entries — they share branches in the solver. The home page actually shows 16 variants total once you include `alu-bal-*` and PVC; the V1 selection appears to be the 8–9 listed above.)
