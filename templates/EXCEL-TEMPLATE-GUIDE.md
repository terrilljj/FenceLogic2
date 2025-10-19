# FenceLogic Excel Configuration Template

## Overview

Use a **single Excel workbook** with multiple tabs to configure all fence styles. Each tab represents one complete fence style with fields, products, and slot mappings.

## Excel Workbook Structure

**File: `FenceLogic-Master-Config.xlsx`**

### Tab Layout:

1. **📋 Instructions** - Template guide (this document)
2. **🏊 Glass Pool Spigots** - Pool fence with spigot mounting
3. **🏊 Glass Pool Channel** - Pool fence with channel mounting
4. **🏢 Glass Balustrade Spigots** - Balustrade with spigots
5. **🏢 Glass Balustrade Standoffs** - Balustrade with standoffs
6. **⚙️ Aluminium BARR Pool** - Aluminium slat pool fence
7. **🏡 PVC Hamptons Full** - Hamptons full privacy
8. *(Add more tabs as needed)*

## Column Structure (All Tabs)

### Configuration Columns (Left Side)

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| A: fence_style_id | Yes | Must match ProductVariant enum | `glass-pool-spigots` |
| B: section_id | Yes | Section identifier | `panels`, `hardware`, `gates` |
| C: section_label | Yes | Section display name | `Glass Panels` |
| D: section_order | Yes | Section order (1, 2, 3...) | `1` |
| E: variant_group_id | Yes | Variant group ID | `standard`, `raked` |
| F: variant_group_label | Yes | Variant group label | `Standard Panels` |
| G: variant_group_order | Yes | Group order | `1` |
| H: variant_id | Yes | Specific variant ID | `standard-1200` |
| I: variant_label | Yes | Variant display name | `Standard 1200mm` |
| J: field_name | Yes | Field identifier | `section-length`, `glass-thickness` |
| K: field_type | Yes | `number`, `select`, `boolean` | `number` |
| L: label | Yes | Display label | `Section Length` |
| M: tooltip | No | Help text | `Total length of fence section` |
| N: unit | No | Unit of measurement | `mm` |
| O: min | No | Minimum value | `500` |
| P: max | No | Maximum value | `10000` |
| Q: step | No | Step increment | `50` |
| R: default_value | No | Default value | `3000` |
| S: options | No | Comma-separated (for select) | `12mm,15mm,18mm` |
| T: enabled | Yes | Is field active | `TRUE` |
| U: required | Yes | Is field required | `TRUE` |
| V: position | Yes | Display order | `1`, `2`, `3`... |

### Product/Slot Columns (Right Side)

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| W: slot_prefix | Conditional | Slot ID prefix | `GP`, `SP`, `RP` |
| X: slot_id | Conditional | Full slot ID | `GP-1200`, `SP-SATIN` |
| Y: product_sku | Conditional | Product code | `GP-12-1200-SS` |
| Z: product_description | Conditional | Product name | `Glass Panel 12mm 1200W Satin Spigots` |
| AA: product_price | Conditional | Price in dollars | `425.00` |
| AB: lookup_rule | No | `width_match`, `exact_match`, `none` | `width_match` |

### When to Use Product Columns:

**Fill in product columns when:**
- ✅ Field represents a physical product (glass panels, hardware)
- ✅ Slot mapping is needed for automatic product lookup
- ✅ You want to pre-populate product catalog

**Leave product columns empty when:**
- ❌ Field is a calculator input only (section-length, gaps)
- ❌ Field is a toggle/boolean (gate-enabled)
- ❌ Field is a constraint (max-panel-width)

## Row Structure Example

### Calculator Input Row (No Products):
```
glass-pool-spigots | panels | Glass Panels | 1 | standard | Standard | 1 | standard-1200 | Standard 1200mm | 
section-length | number | Section Length | Total fence length | mm | 500 | 10000 | 50 | 3000 | | TRUE | TRUE | 1 |
[empty] | [empty] | [empty] | [empty] | [empty] | none
```

### Product Selection Row (With Products):
```
glass-pool-spigots | panels | Glass Panels | 1 | standard | Standard | 1 | standard-1200 | Standard 1200mm |
glass-thickness | select | Glass Thickness | Select thickness | | | | | 12mm | 12mm,15mm | TRUE | TRUE | 7 |
GP | GP-1200 | GP-12-1200 | Glass Panel 12mm 1200W | 425.00 | width_match
```

## Complete Example: Glass Pool Spigots Tab

See the **"Glass Pool Spigots"** tab for a fully populated example including:

1. **Standard Panels Section**
   - 6 calculator input fields (section-length through min-panel-width)
   - Glass thickness selection with product SKUs for all widths (250mm-2000mm, 12mm & 15mm)
   - Panel height configuration

2. **Raked Panels Section**
   - Same 6 calculator fields
   - Raked panel products (fewer sizes, fixed angle)

3. **Hardware Section**
   - Spigot finish selection
   - Product SKUs for each finish (Polished, Satin, Black)

4. **Gates Section**
   - Soft brand variants (hinge panels, gate panels, hinges)
   - Gate Master brand variants
   - All with gate configuration fields

## Import Process

### Step 1: Download Template
- Download `FenceLogic-Master-Config.xlsx`
- Save a backup copy

### Step 2: Edit in Excel
- Open in Microsoft Excel, LibreOffice, or Google Sheets
- Edit one tab at a time
- Use formulas to auto-fill repetitive data

### Step 3: Validate
- Check all required columns are filled
- Verify SKU prefixes match across rows
- Ensure product prices are numeric
- Confirm fence_style_id matches ProductVariant enum

### Step 4: Upload
- Go to Admin Panel → "Configuration Import"
- Upload Excel file
- System reads all tabs automatically
- Preview changes before applying

### Step 5: Review & Apply
- System shows summary of changes per tab
- Review field configurations
- Review product mappings
- Confirm to apply

## Tips & Best Practices

### 1. Use Excel Features

**Auto-fill formulas:**
```excel
=A2  // Copy fence_style_id down
=B2  // Copy section_id down
=E2+1  // Auto-increment position
```

**Concatenate SKUs:**
```excel
=W2&"-"&R2  // Combine prefix with value (GP-1200)
```

**Conditional formatting:**
- Highlight empty required fields in red
- Color-code sections (panels=blue, hardware=green, gates=yellow)

### 2. Organize Your Tab

**Group related rows:**
- All section-length fields together
- All glass-thickness products grouped by width
- Gates by brand

**Use comments:**
- Right-click → Insert Comment to add notes
- Document special rules or constraints

### 3. Product Data Management

**Pricing:**
- Keep all prices in one currency (USD)
- Use consistent decimal places (2 digits)
- Update prices in bulk using find/replace

**Descriptions:**
- Follow consistent naming: `[Component] [Spec] [Size] [Finish]`
- Example: `Glass Panel 12mm 1200W Satin Spigots`

**SKU codes:**
- Use prefix system: GP (Glass Panel), RP (Raked), SP (Spigot)
- Include specs in code: `GP-12-1200-SS` (12mm, 1200W, Satin Spigots)

### 4. Multiple Fence Styles

**Copy tabs to create new styles:**
1. Right-click tab → "Move or Copy"
2. Check "Create a copy"
3. Rename tab to new fence style
4. Update fence_style_id in column A
5. Modify products as needed

**Maintain consistency:**
- Keep calculator fields identical across all styles
- Use same field_name values
- Reuse successful patterns

## Troubleshooting

### "Missing required fields" error
- Check that all 6 calculator fields are present for EVERY variant
- Verify section-length, left-gap, right-gap, desired-gap, max-panel-width, min-panel-width

### "Invalid fence_style_id" error
- Must exactly match ProductVariant enum
- Check spelling and hyphens
- Case-sensitive

### "Product SKU not found" error
- Verify product_sku values are unique
- Check for typos in SKU codes
- Ensure products are in system before mapping

### "Slot prefix mismatch" error
- slot_prefix must match variant's sku_prefix in config
- Example: Standard panels use "GP", raked panels use "RP"

## Advanced Features

### Conditional Fields

Show/hide fields based on other selections:
- Gate fields only appear when gate-enabled = TRUE
- Hinge panel width only for glass-to-glass mounting

*Implementation: Add `conditional_on` column with parent field_name*

### Dynamic Product Lookup

Automatic product matching:
- `width_match`: Finds products matching calculated panel width
- `exact_match`: Finds products matching selected option value
- `none`: Calculator input only, no product lookup

### Multi-variant Products

Same product used in multiple contexts:
- Gate panel 900mm used in both Soft and Gate Master configs
- List product SKU in multiple rows with different slot_ids

## Support

For questions or issues:
1. Check this guide first
2. Review example tabs (Glass Pool Spigots is most complete)
3. Contact FenceLogic support with Excel file attached
