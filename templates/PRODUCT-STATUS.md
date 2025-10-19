# Product Data Status - What Needs Updating

## Overview

All 11 fence style CSV files are created with **calculator fields prepopulated** and **sample product placeholders** for you to update with actual SKUs, descriptions, and prices.

---

## File Locations

All CSV files are in: **`templates/tabs/`**

```
templates/tabs/
├── 01-pool-spigots.csv          ✅ Complete example (reference this!)
├── 02-pool-channel.csv          🔧 Needs product data
├── 03-pool-flat-top.csv         🔧 Needs product data
├── 04-pool-barr.csv             🔧 Needs product data
├── 05-pool-blade.csv            🔧 Needs product data
├── 06-bal-spigots.csv           🔧 Needs product data
├── 07-bal-channel.csv           🔧 Needs product data
├── 08-bal-standoff.csv          🔧 Needs product data
├── 09-bal-barr.csv              🔧 Needs product data
├── 10-bal-blade.csv             🔧 Needs product data
└── 11-custom-frameless.csv      ✅ Complete (calculator only, no products)
```

---

## What's Prepopulated (✅ Ready to Use)

### All Files Include:

**Calculator Fields (6 required):**
- ✅ section-length (500-10000mm, step 50, default 3000)
- ✅ left-gap (0-150mm, step 5, default 50)
- ✅ right-gap (0-150mm, step 5, default 50)
- ✅ desired-gap (30-99mm, step 5, default 50)
- ✅ max-panel-width (varies by fence type)
- ✅ min-panel-width (200-1000mm, default 250)

**Product Selection Fields:**
- ✅ Field names (glass-thickness, panel-height, finish, etc.)
- ✅ Field types (select, number, boolean)
- ✅ Options (12mm,15mm / Satin Black,Pearl White / etc.)
- ✅ Min/max/step values
- ✅ Tooltips and labels

**Sample Products:**
- 🔧 **Placeholder SKUs** (e.g., GP-12-1200, BARR-1200-SB)
- 🔧 **Placeholder descriptions** (e.g., "Glass Panel 12mm 1200W Satin Spigots")
- 🔧 **Placeholder prices** (sample prices like $425.00, $285.00)

---

## What Needs Updating (🔧 Your Action Items)

### Update These Columns in Each File:

| Column | Current Status | Action Required |
|--------|---------------|-----------------|
| `product_sku` | Sample placeholder | Replace with your actual product codes |
| `product_description` | Generic description | Update with your catalog descriptions |
| `product_price` | Sample price | **Update with real prices** |

### Files That Need Product Updates:

#### 🏊 Pool Fencing (4 files need updates)

**02-pool-channel.csv**
- Update: Channel hardware SKUs and prices
- Placeholder: `GPC-10-1200` → Your actual SKU
- Placeholder: `CH-MILL` → Your channel finish SKU

**03-pool-flat-top.csv**
- Update: Flat top panel SKUs for all heights (1000/1200/1800mm)
- Update: Post SKUs (start/end/intermediate)
- Placeholder: `FTP-1200-SB` → Your actual SKU

**04-pool-barr.csv**
- Update: BARR panel SKUs for all heights
- Update: Post SKUs
- Placeholder: `BARR-1200-SB` → Your actual SKU

**05-pool-blade.csv**
- Update: Blade panel SKUs for all heights
- Update: Post SKUs
- Placeholder: `BLADE-1200-SB` → Your actual SKU

#### 🏢 Balustrade (5 files need updates)

**06-bal-spigots.csv**
- Update: Balustrade glass panel SKUs
- Update: Balustrade spigot hardware SKUs
- Update: Top rail SKUs (if used)
- Placeholder: `BGP-12-1000` → Your actual SKU

**07-bal-channel.csv**
- Update: Balustrade channel panel SKUs
- Update: Channel hardware SKUs
- Placeholder: `BGPC-10-1000` → Your actual SKU

**08-bal-standoff.csv**
- Update: Standoff panel SKUs (15mm glass only)
- Update: Standoff hardware SKUs
- Placeholder: `BSOP-15-1000` → Your actual SKU

**09-bal-barr.csv**
- Update: BARR balustrade panel SKUs
- Update: Post SKUs
- Placeholder: `BBARR-1000-SB` → Your actual SKU

**10-bal-blade.csv**
- Update: Blade balustrade panel SKUs
- Update: Post SKUs
- Placeholder: `BBLADE-1000-SB` → Your actual SKU

---

## How to Update Products

### Option 1: Edit in Excel (Recommended)

1. Open CSV in Excel or Google Sheets
2. Find rows with product data (columns W-AA)
3. Replace placeholder values with your actual data:
   - Column Y: `product_sku` → Your actual SKU
   - Column Z: `product_description` → Your description
   - Column AA: `product_price` → Your price (numeric only, no $)

### Option 2: Use Find & Replace

For similar products across files:
1. Open CSV in text editor
2. Find: `GP-12-1200-SS`
3. Replace with: Your actual SKU
4. Repeat for descriptions and prices

### Option 3: Leave Placeholders

If you don't have product data yet:
- ✅ Calculator will still work (uses field constraints)
- ⚠️ Component list will show placeholder SKUs
- 🔧 Update later when you have catalog data

---

## Product Placeholder Examples

### Glass Products (Spigots/Channel)
```csv
slot_id,product_sku,product_description,product_price
GP-12-1200,GP-12-1200-SS,Glass Panel 12mm 1200W Satin Spigots,425.00
```
**Update to:**
```csv
slot_id,product_sku,product_description,product_price
GP-12-1200,YOUR-SKU-HERE,Your Actual Product Name,599.99
```

### Aluminium Products (BARR/Blade)
```csv
slot_id,product_sku,product_description,product_price
BARR-1200-SB,BARR-1200-SB,BARR Panel 1200H Satin Black,295.00
```
**Update to:**
```csv
slot_id,product_sku,product_description,product_price
BARR-1200-SB,YOUR-SKU-HERE,Your Actual Panel Name,449.99
```

### Hardware Products
```csv
slot_id,product_sku,product_description,product_price
SP-SATIN,SP-316-SAT,Spigot 316 Stainless Satin,42.00
```
**Update to:**
```csv
slot_id,product_sku,product_description,product_price
SP-SATIN,YOUR-SKU-HERE,Your Actual Spigot,65.00
```

---

## Validation Checklist

Before importing, check each file:

- [ ] All calculator fields present (6 per variant)
- [ ] Product SKUs updated (or placeholders acceptable)
- [ ] Product prices are numeric (no $ symbol)
- [ ] Slot prefixes match variant SKU prefixes
- [ ] No empty required fields
- [ ] fence_style_id matches ProductVariant enum

---

## Import Process

### Step 1: Update Products (At Your Pace)
- Start with 01-pool-spigots.csv (already complete)
- Update others as you get product data
- Placeholders work for testing

### Step 2: Combine into Excel
- Create `FenceLogic-Master-Config.xlsx`
- Add each CSV as a tab
- Tab names: "Pool Spigots", "Pool Channel", etc.

### Step 3: Import via Admin Panel
- Upload Excel file
- System reads all tabs
- Preview before applying

---

## Priority Order (Suggested)

If updating gradually, do in this order:

1. ✅ **Pool Spigots** - Already complete, use as reference
2. 🔧 **Pool Channel** - Similar to spigots, quick update
3. 🔧 **Bal Spigots** - Similar to pool spigots
4. 🔧 **Pool BARR** - Most common aluminium
5. 🔧 **Bal Standoff** - Unique product specs
6. 🔧 Others as needed

---

## Next Steps

1. ✅ Review 01-pool-spigots.csv (complete example)
2. 🔧 Update product data in other CSVs as you get catalog info
3. 📊 Combine CSVs into Excel workbook (one tab each)
4. 🚀 Import via admin panel when ready
5. 🧪 Test calculator with each fence style

**No rush!** You can import with placeholders and update products later.
