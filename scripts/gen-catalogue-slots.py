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

# Derive finish + size from the SKU when the sheet has no explicit column (most sheets
# carry only calslot tagging — finish/size are mechanical from the SKU string).
FINISHES = {"B", "MW", "P", "S", "SG", "W", "BLK", "SA", "MN"}
def derive_finish(sku):
    last = sku.split("-")[-1]
    return last if last in FINISHES else None
def derive_size(sku, cs1, cs2):
    # size lives in the SKU's LAST hyphen segment (the width/height), e.g. 970NTG-1200 -> 1200,
    # 12NRP-1800HT -> 1800. Avoids grabbing a leading family/height prefix like 970NTG or 12N.
    hay = f"{cs1 or ''} {cs2 or ''}".lower()
    if any(t in hay for t in ("panel", "glass", "gate", "hinge")):
        m = re.search(r"(\d{3,4})", sku.split("-")[-1])
        if m: return int(m.group(1))
    return None

rows = []
for r in ws.iter_rows(min_row=2):
    if not truthy(gv(r, "calc_include")): continue
    sku = clean(gv(r, "sku"))
    if not sku: continue
    cs1, cs2, cs3 = clean(gv(r, "calslot_1")), clean(gv(r, "calslot_2")), clean(gv(r, "calslot_3"))
    # Disambiguate raised/domed dress rings from flat (both share cs2="Dress Ring"): tag cs3
    # so the flat ring (blank cs3) resolves uniquely. -RAISED- (Madrid/Lifestyle) and Rio's -SDC-.
    if cs3 is None and cs2 and "dress" in cs2.lower() and ("RAISED" in sku.upper() or "SDC" in sku.upper()):
        cs3 = "Raised"
    # AH-530W is the Atlantic WALL hinge, recurrently mis-tagged "Glass to Glass" (it collides
    # with the AH-530G glass-to-glass hinge). Correct it to Post/Wall so each resolves uniquely.
    if sku.upper().startswith("AH-530W-") and cs3 == "Glass to Glass":
        cs3 = "Post/Wall"
    finish = clean(gv(r, "finish")) or derive_finish(sku)
    size = gv(r, "size_mm")
    size_mm = int(size) if isinstance(size, (int, float)) and size != "" else derive_size(sku, cs1, cs2)
    rows.append({
        "sku": sku,
        "description": clean(gv(r, "description")),
        "cs1": cs1, "cs2": cs2, "cs3": cs3,
        "finish": finish,
        "size_mm": size_mm,
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
