#!/usr/bin/env python3
"""
Generate the solver slot-data TS module from an operator-curated catalogue sheet.

Reads _reports/catalogue-by-style/<sheet>.xlsx (columns: sku, description,
calc_include, calslot_1/2/3, finish, size_mm, retail_price_inc_gst, category_slug)
and emits server/data/slots/<style>.slots.ts — the typed array the BOM solver
resolves against. Only calc_include=TRUE rows are exported.

Usage:
  python3 scripts/gen-catalogue-slots.py glass-pool-spigots \
      _reports/catalogue-by-style/glass-pool-spigots-June_5_v2.xlsx
"""
import sys, json, openpyxl, re

style = sys.argv[1]
xlsx  = sys.argv[2]
const_name = style.upper().replace("-", "_") + "_SLOTS"
out = f"server/data/slots/{style}.slots.ts"

wb = openpyxl.load_workbook(xlsx, data_only=True)
ws = wb.worksheets[0]
hdr = [c.value for c in ws[1]]
ix = {h: i for i, h in enumerate(hdr)}
def gv(r, k): return r[ix[k]].value if k in ix else None
def truthy(v): return str(v).strip().lower() in ("true", "1", "yes")
def clean(v):
    if v is None: return None
    s = str(v).strip()
    return s or None

rows = []
for r in ws.iter_rows(min_row=2):
    if not truthy(gv(r, "calc_include")): continue
    sku = clean(gv(r, "sku"))
    if not sku: continue
    size = gv(r, "size_mm")
    rows.append({
        "sku": sku,
        "description": clean(gv(r, "description")),
        "cs1": clean(gv(r, "calslot_1")),
        "cs2": clean(gv(r, "calslot_2")),
        "cs3": clean(gv(r, "calslot_3")),
        "finish": clean(gv(r, "finish")),
        "size_mm": int(size) if isinstance(size, (int, float)) and size != "" else None,
        "price": float(gv(r, "retail_price_inc_gst")) if gv(r, "retail_price_inc_gst") not in (None, "") else None,
        "category_slug": clean(gv(r, "category_slug")),
    })

body = ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in rows)
ts = (
    f"// AUTO-GENERATED from {xlsx.split('/')[-1]} by scripts/gen-catalogue-slots.py — DO NOT EDIT BY HAND.\n"
    f"// Regenerate: python3 scripts/gen-catalogue-slots.py {style} {xlsx}\n"
    f"import type {{ CatalogueSlot }} from \"../../services/slots/catalogue-slots\";\n\n"
    f"export const {const_name}: CatalogueSlot[] = [\n{body}\n];\n"
)
with open(out, "w") as f:
    f.write(ts)
print(f"wrote {out}: {len(rows)} rows ({const_name})")
unplaced = [x["sku"] for x in rows if not x["category_slug"]]
if unplaced: print("  WARNING — calc_include rows with no storefront placement:", unplaced)
