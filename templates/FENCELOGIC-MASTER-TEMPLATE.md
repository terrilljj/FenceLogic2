# FenceLogic Master Configuration Template

## Excel Workbook Structure

**File Name:** `FenceLogic-Master-Config.xlsx`

### Tab Layout (11 Total Fence Styles)

| Tab # | Tab Name | Fence Style ID | Status | Notes |
|-------|----------|----------------|--------|-------|
| 1 | 📋 **Instructions** | - | - | Template guide and column reference |
| 2 | 🏊 **Pool Spigots** | `glass-pool-spigots` | ✅ Complete | Full example with all products |
| 3 | 🏊 **Pool Channel** | `glass-pool-channel` | Template | Similar to spigots, channel hardware |
| 4 | 🏊 **Pool Flat Top** | `alu-pool-tubular` | Template | Aluminium tubular panels |
| 5 | 🏊 **Pool BARR** | `alu-pool-barr` | Template | Aluminium vertical slats |
| 6 | 🏊 **Pool Blade** | `alu-pool-blade` | Template | Aluminium blade panels |
| 7 | 🏢 **Bal Spigots** | `glass-bal-spigots` | Template | Balustrade with spigots |
| 8 | 🏢 **Bal Channel** | `glass-bal-channel` | Template | Balustrade with channel |
| 9 | 🏢 **Bal Standoff** | `glass-bal-standoffs` | Template | Balustrade with standoffs |
| 10 | 🏢 **Bal BARR** | `alu-bal-barr` | Template | Aluminium balustrade slats |
| 11 | 🏢 **Bal Blade** | `alu-bal-blade` | Template | Aluminium balustrade blade |
| 12 | ⚙️ **Custom Frameless** | `custom-frameless` | Template | Calculator only, no products |

---

## Complete Checklist for Each Tab

### ✅ Required Elements (All Fence Styles)

**Calculator Fields (6 required):**
- [ ] section-length (500-10000mm, step 50, default 3000)
- [ ] left-gap (0-150mm, step 5, default 50)
- [ ] right-gap (0-150mm, step 5, default 50)
- [ ] desired-gap (30-99mm, step 5, default 50)
- [ ] max-panel-width (500-2000mm, step 50, varies by type)
- [ ] min-panel-width (200-1000mm, step 50, default 250)

**Section Structure:**
- [ ] Panels section (section_id: "panels")
- [ ] Hardware section (section_id: "hardware")
- [ ] Gates section (section_id: "gates") - if applicable

**Variant Groups:**
- [ ] At least one variant group per section
- [ ] SKU prefix defined for each variant
- [ ] Field configs populated with all required fields

### 🔧 Product-Specific Elements

**Glass Fencing (Spigots, Channel):**
- [ ] glass-thickness field (select: 12mm, 15mm)
- [ ] panel-height field (number: varies by type)
- [ ] Product SKUs for all panel widths (250mm-2000mm in 50mm increments)
- [ ] Hardware finish options (Polished, Satin, Black)
- [ ] Hardware product SKUs

**Aluminium Fencing (BARR, Blade, Flat Top):**
- [ ] panel-height field (select: 1000mm, 1200mm, 1800mm)
- [ ] finish field (select: Satin Black, Pearl White)
- [ ] layout-mode field (select: full-panels-cut-end, equally-spaced)
- [ ] post-type field (select: varies by style)
- [ ] Panel product SKUs for each height
- [ ] Post product SKUs

**Glass Balustrade (Spigots, Channel, Standoff):**
- [ ] glass-thickness field (select: 12mm, 15mm)
- [ ] panel-height field (number: 900-1200mm)
- [ ] top-rail field (boolean) - if applicable
- [ ] Product SKUs for balustrade heights

**Custom Frameless:**
- [ ] Only calculator fields (no products)
- [ ] No hardware section
- [ ] No gate section

### 🚪 Gate Configuration (Optional but Recommended)

**Gate Fields:**
- [ ] gate-enabled (boolean toggle)
- [ ] gate-width (600-1200mm, default 900)
- [ ] hinge-panel-width (900-1200mm, default 1200)
- [ ] hinge-gap (6-15mm, default 8)
- [ ] latch-gap (6-15mm, default 8)
- [ ] gate-mount-mode (GLASS_TO_GLASS, POST, WALL)
- [ ] gate-hinge-side (LEFT, RIGHT)

**Gate Product Variants:**
- [ ] Soft brand (if glass fencing)
- [ ] Gate Master brand (if glass fencing)
- [ ] Hinge panels with product SKUs
- [ ] Gate panels with product SKUs
- [ ] Hinge hardware with product SKUs

---

## Tab-by-Tab Configuration Guide

### Tab 2: Pool Spigots (COMPLETE EXAMPLE)
**Fence Style ID:** `glass-pool-spigots`

**Sections:**
1. **Panels** → Standard Panels (GP prefix)
   - 6 calculator fields
   - glass-thickness (12mm, 15mm)
   - panel-height (1200-1500mm)
   - Products: GP-12-0250 through GP-12-2000 (all 50mm increments)
   - Products: GP-15-0250 through GP-15-2000

2. **Panels** → Raked Panels (RP prefix)
   - 6 calculator fields
   - glass-thickness (12mm, 15mm)
   - panel-height (1200-1500mm)
   - Products: RP-12-1200, RP-15-1200 (limited sizes)

3. **Hardware** → Spigots (SP prefix)
   - spigot-hardware (Polished, Satin, Black)
   - Products: SP-POLISHED, SP-SATIN, SP-BLACK

4. **Gates** → Soft Brand
   - All gate configuration fields
   - Hinge Panels: SHP-12-0900, SHP-12-1000, SHP-12-1200
   - Gate Panels G2G: SGPG-12-0800, SGPG-12-0900, SGPG-12-1000
   - Gate Panels G2P: SGPP-12-0800, SGPP-12-0900
   - Hinges G2G: SHGG-STANDARD
   - Hinges G2W: SHGW-STANDARD

5. **Gates** → Gate Master Brand
   - All gate configuration fields
   - Hinge Panels: GMHP-12-0900, GMHP-12-1000, GMHP-12-1200
   - Gate Panels: GMGP-12-0800, GMGP-12-0900, GMGP-12-1000
   - Hinges: GMH-STANDARD

---

### Tab 3: Pool Channel
**Fence Style ID:** `glass-pool-channel`

**Differences from Spigots:**
- Hardware section uses "channel-hardware" instead of "spigot-hardware"
- Finish options: Mill Finish, Powder Coat Black, Powder Coat White
- Product prefix: CH (Channel Hardware)
- Typically 10mm or 12mm glass (not 15mm)

**Sections:**
1. Panels → Standard Panels (GP prefix) - same as spigots
2. Panels → Raked Panels (RP prefix) - same as spigots
3. Hardware → Channel (CH prefix)
4. Gates → (if applicable for channel mounting)

---

### Tab 4: Pool Flat Top
**Fence Style ID:** `alu-pool-tubular`

**Aluminium-specific fields:**
- panel-height: select (1000mm, 1200mm, 1800mm)
- finish: select (Satin Black, Pearl White)
- layout-mode: select (full-panels-cut-end, equally-spaced)
- post-type: select (varies)

**Sections:**
1. Panels → Flat Top Panels (FTP prefix)
   - 6 calculator fields
   - panel-height (select)
   - finish (select)
   - layout-mode (select)
   - Products: FTP-1000-SB, FTP-1200-SB, FTP-1800-SB (Satin Black)
   - Products: FTP-1000-PW, FTP-1200-PW, FTP-1800-PW (Pearl White)

2. Hardware → Posts (FTPOST prefix)
   - post-type (select)
   - Products: FTPOST-START, FTPOST-END, FTPOST-INTER

3. Gates → (if applicable)

---

### Tab 5: Pool BARR
**Fence Style ID:** `alu-pool-barr`

**Same structure as Flat Top, different products:**

**Sections:**
1. Panels → BARR Panels (BARR prefix)
   - Products: BARR-1000-SB, BARR-1200-SB, BARR-1800-SB
   - Products: BARR-1000-PW, BARR-1200-PW, BARR-1800-PW

2. Hardware → Posts (BARRPOST prefix)

3. Gates → Aluminium Gates (if applicable)

---

### Tab 6: Pool Blade
**Fence Style ID:** `alu-pool-blade`

**Same structure as BARR:**

**Sections:**
1. Panels → Blade Panels (BLADE prefix)
   - Products: BLADE-1000-SB, BLADE-1200-SB, BLADE-1800-SB

2. Hardware → Posts (BLADEPOST prefix)

---

### Tab 7: Bal Spigots
**Fence Style ID:** `glass-bal-spigots`

**Similar to Pool Spigots, different heights:**

**Key differences:**
- panel-height: 900-1200mm (vs 1200-1500mm for pool)
- Optional top-rail field (boolean)
- May have different spigot types

**Sections:**
1. Panels → Standard Panels (BGP prefix - Balustrade Glass Panel)
   - 6 calculator fields
   - glass-thickness (12mm, 15mm)
   - panel-height (900-1200mm)
   - top-rail (boolean)

2. Hardware → Spigots (BSP prefix)

3. Hardware → Top Rail (if enabled) (TR prefix)

4. Gates → (if applicable)

---

### Tab 8: Bal Channel
**Fence Style ID:** `glass-bal-channel`

**Same structure as Bal Spigots, channel hardware:**

**Sections:**
1. Panels → Standard Panels (BGP prefix)
2. Hardware → Channel (BCH prefix)
3. Hardware → Top Rail (TR prefix)

---

### Tab 9: Bal Standoff
**Fence Style ID:** `glass-bal-standoffs`

**Standoff-specific:**
- Always 15mm glass (no thickness selection)
- Panel width: 400-1200mm (narrower than spigots)
- Standoff diameter field

**Sections:**
1. Panels → Standard Panels (BSOP prefix - Balustrade Standoff Panel)
   - 6 calculator fields
   - panel-height (900-1200mm)
   - standoff-diameter (50mm fixed)

2. Hardware → Standoffs (BSO prefix)
   - standoff-finish (Polished, Satin, Black, White)

---

### Tab 10: Bal BARR
**Fence Style ID:** `alu-bal-barr`

**Same structure as Pool BARR, balustrade heights:**

**Sections:**
1. Panels → BARR Balustrade (BBARR prefix)
   - Products: BBARR-1000-SB, BBARR-1200-SB

2. Hardware → Posts (BBARRPOST prefix)

---

### Tab 11: Bal Blade
**Fence Style ID:** `alu-bal-blade`

**Same structure as Pool Blade, balustrade heights:**

**Sections:**
1. Panels → Blade Balustrade (BBLADE prefix)

2. Hardware → Posts (BBLADEPOST prefix)

---

### Tab 12: Custom Frameless
**Fence Style ID:** `custom-frameless`

**Calculator-only configuration (NO PRODUCTS):**

**Sections:**
1. Panels → Custom Panels (no SKU prefix)
   - 6 calculator fields ONLY
   - NO glass-thickness field
   - NO panel-height field
   - NO product SKUs
   - NO hardware section
   - NO gates section

**Purpose:** Auto-calculator for custom layouts where user doesn't need product selection

---

## Column Reference

### Full Column List (27 columns total)

| # | Column | Type | Required | Example |
|---|--------|------|----------|---------|
| A | fence_style_id | text | Yes | `glass-pool-spigots` |
| B | section_id | text | Yes | `panels` |
| C | section_label | text | Yes | `Glass Panels` |
| D | section_order | number | Yes | `1` |
| E | variant_group_id | text | Yes | `standard` |
| F | variant_group_label | text | Yes | `Standard Panels` |
| G | variant_group_order | number | Yes | `1` |
| H | variant_id | text | Yes | `standard-1200` |
| I | variant_label | text | Yes | `Standard 1200mm` |
| J | field_name | text | Yes | `section-length` |
| K | field_type | text | Yes | `number`, `select`, `boolean` |
| L | label | text | Yes | `Section Length` |
| M | tooltip | text | No | `Total length of fence section` |
| N | unit | text | No | `mm` |
| O | min | number | No | `500` |
| P | max | number | No | `10000` |
| Q | step | number | No | `50` |
| R | default_value | text/number | No | `3000` or `12mm` |
| S | options | text | No | `12mm,15mm,18mm` |
| T | enabled | boolean | Yes | `TRUE` or `FALSE` |
| U | required | boolean | Yes | `TRUE` or `FALSE` |
| V | position | number | Yes | `1`, `2`, `3`... |
| W | slot_prefix | text | No | `GP`, `SP`, `RP` |
| X | slot_id | text | No | `GP-1200` |
| Y | product_sku | text | No | `GP-12-1200-SS` |
| Z | product_description | text | No | `Glass Panel 12mm 1200W Satin Spigots` |
| AA | product_price | number | No | `425.00` |
| AB | lookup_rule | text | No | `width_match`, `exact_match`, `none` |

---

## Quick Start Guide

### 1. Download Template
Get `FenceLogic-Master-Config.xlsx` with all 12 tabs pre-configured

### 2. Fill in Products
- Tab 2 (Pool Spigots) is complete - use as reference
- Fill in product SKUs, descriptions, and prices for other tabs
- Use Excel formulas to auto-generate SKU codes

### 3. Validate
- Ensure all 6 calculator fields present in every variant
- Check SKU prefixes are consistent
- Verify prices are numeric

### 4. Import
- Admin Panel → Configuration Import
- Upload Excel file
- Preview changes
- Apply

---

## Benefits of This Structure

✅ **One File** - All fence styles in single Excel workbook
✅ **Complete** - Every required field captured
✅ **Products Included** - SKU, description, price all together
✅ **Easy to Edit** - Familiar Excel interface
✅ **Version Control** - Save different versions as you iterate
✅ **Copy/Paste Friendly** - Duplicate tabs for similar styles
✅ **No Sync Issues** - No Google Sheets security problems
✅ **Offline** - Edit without internet connection

---

## Next Steps

1. ✅ Review Tab 2 (Pool Spigots) - complete example
2. 📝 Fill in products for other 10 fence styles
3. 🧪 Test import with one tab first
4. 🚀 Import complete configuration
5. 🎨 Test in calculator UI
