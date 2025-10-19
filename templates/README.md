# Fence Configuration CSV Templates

## Overview

This directory contains CSV templates for configuring fence styles in the FenceLogic calculator. Each CSV defines the complete configuration for one fence style, including:

- Calculator input fields (section length, gaps, panel constraints)
- Product selection fields (glass thickness, finishes, hardware)
- Slot mappings for automatic product lookup
- Gate and custom panel configuration options

## Template Structure

### Core Files

1. **`fence-config-template.csv`** - Master template with all field types and instructions
2. **`glass-pool-spigots.csv`** - Complete example for Pool Fence with Spigots

## CSV Column Reference

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `fence_style_id` | Yes | Must match ProductVariant enum | `glass-pool-spigots` |
| `section_id` | Yes | Section identifier | `panels`, `hardware`, `gates` |
| `section_label` | Yes | Section display name | `Glass Panels` |
| `section_order` | Yes | Section display order (1, 2, 3...) | `1` |
| `variant_group_id` | Yes | Variant group identifier | `standard`, `raked` |
| `variant_group_label` | Yes | Variant group display name | `Standard Panels` |
| `variant_group_order` | Yes | Variant group order within section | `1` |
| `variant_id` | Yes | Specific variant identifier | `standard-1200` |
| `variant_label` | Yes | Variant display name | `Standard 1200mm` |
| `sku_prefix` | Yes | SKU prefix for this variant | `GP`, `RP`, `SP` |
| `field_name` | Yes | Field identifier (see standard names) | `section-length` |
| `field_type` | Yes | `number`, `select`, or `boolean` | `number` |
| `label` | Yes | Field display label | `Section Length` |
| `tooltip` | No | Help text for field | `Total length of fence section` |
| `unit` | No | Unit of measurement | `mm` |
| `min` | No | Minimum value (number fields) | `500` |
| `max` | No | Maximum value (number fields) | `10000` |
| `step` | No | Step increment (number fields) | `50` |
| `default_value` | No | Default value | `3000` or `12mm` |
| `options` | No | Comma-separated options (select) | `12mm,15mm,18mm` |
| `enabled` | Yes | Whether field is active | `true` or `false` |
| `required` | Yes | Whether field is required | `true` or `false` |
| `position` | Yes | Display order within variant | `1`, `2`, `3`... |
| `slot_prefix` | No | Slot ID prefix for products | `GP`, `SP` |
| `slot_count` | No | Number of product slots | `36`, `20` |
| `lookup_rule` | No | Product matching rule | `width_match`, `exact_match` |

## Standard Field Names

### Calculator Input Fields (REQUIRED for all variants)

These fields map directly to the backend `CompositionInput` interface:

- `section-length` - Total length of fence section (mm)
- `left-gap` - Gap at left end (mm)
- `right-gap` - Gap at right end (mm)
- `desired-gap` - Target gap between panels (mm)
- `max-panel-width` - Maximum panel width constraint (mm)
- `min-panel-width` - Minimum panel width constraint (mm)

### Gate Configuration Fields (Optional)

- `gate-enabled` - Boolean toggle for gate
- `gate-width` - Width of gate panel (mm)
- `hinge-panel-width` - Width of hinge panel for glass-to-glass (mm)
- `hinge-gap` - Gap at hinge side (mm)
- `latch-gap` - Gap at latch side (mm)
- `gate-mount-mode` - Options: `GLASS_TO_GLASS`, `POST`, `WALL`
- `gate-hinge-side` - Options: `LEFT`, `RIGHT`
- `gate-position` - Position along run (0-1)

### Custom Panel Fields (Optional)

- `custom-panel-enabled` - Boolean toggle
- `custom-panel-width` - Width in mm
- `custom-panel-height` - Height in mm
- `custom-panel-position` - Position along run (0-1)
- `custom-gap-before` - Extra gap before custom panel (mm)
- `custom-gap-after` - Extra gap after custom panel (mm)

### Product Selection Fields (Varies by fence type)

**Glass Products:**
- `glass-thickness` - Options: `12mm`, `15mm`, `18mm`
- `panel-height` - Panel height in mm

**Hardware:**
- `spigot-hardware` - Options: `Polished`, `Satin`, `Black`
- `channel-hardware` - Options: `Mill Finish`, `Powder Coat Black`, `Powder Coat White`
- `standoff-hardware` - Options: `Polished`, `Satin`, `Black`, `White`
- `finish` - Generic finish field

**Aluminium:**
- `panel-height` - Options: `1000mm`, `1200mm`, `1800mm`
- `finish` - Options: `Satin Black`, `Pearl White`
- `slat-spacing` - Slat spacing in mm

**PVC:**
- `panel-height` - Panel height options
- `finish` - Color options
- `rail-count` - Number of rails (e.g., 3)

## Slot Mapping

### Product Lookup Rules

- **`width_match`** - Matches panel width from calculation
  - Example: Calculator returns 1200mm → looks up product with "1200" in description
  - Used for: Glass panels, gate panels, hinge panels

- **`exact_match`** - Matches exact selected value
  - Example: User selects "Satin" → looks up product code for Satin spigots
  - Used for: Hardware finishes, fixed-size components

- **`none`** - No automatic lookup (calculator input only)
  - Used for: section-length, gaps, constraints

### Slot Prefix Examples

- `GP` - Glass Panels (Standard)
- `RP` - Raked Panels
- `SP` - Spigots
- `SHP` - Soft Hinge Panels
- `GMHP` - Gate Master Hinge Panels
- `SGPG` - Soft Gate Panels Glass-to-Glass
- `SGPP` - Soft Gate Panels Glass-to-Post

## Creating a New Fence Style

### Step 1: Copy Template
```bash
cp fence-config-template.csv my-new-fence.csv
```

### Step 2: Fill in Required Fields

1. Replace `YOUR-FENCE-ID` with your fence style ID (must match `ProductVariant` enum)
2. Keep all 6 calculator input rows (section-length, left-gap, right-gap, desired-gap, max/min-panel-width)
3. Add product selection fields for your fence type
4. Add gate fields if gates are supported
5. Define slot prefixes and counts for product lookup

### Step 3: Validate Completeness

Ensure you have:
- ✅ All 6 calculator input fields for each variant
- ✅ Product selection fields with appropriate options
- ✅ Slot prefixes for fields that need product lookup
- ✅ Appropriate min/max/step values for number fields
- ✅ Clear labels and tooltips

### Step 4: Import CSV

Upload via admin panel CSV import tool (to be implemented).

## Example: Glass Pool Fence with Spigots

See `glass-pool-spigots.csv` for a complete working example that includes:

- Standard 1200mm panels variant
- Raked panels variant
- Spigot hardware configuration
- Soft brand gate hardware
- Gate Master brand gate hardware

## Best Practices

1. **Always include all 6 calculator fields** - These are required for calculation engine
2. **Use consistent SKU prefixes** - Match your existing product catalog structure
3. **Provide helpful tooltips** - Users appreciate guidance
4. **Set realistic constraints** - Min/max values should match real-world products
5. **Use standard field names** - Don't create new field names unless necessary
6. **Test with calculator** - Import and test with actual calculations before deploying

## Troubleshooting

**Missing calculator fields?**
- Every variant MUST have: section-length, left-gap, right-gap, desired-gap, max-panel-width, min-panel-width

**Slot lookups not working?**
- Check that `slot_prefix` matches your product codes
- Verify `lookup_rule` is appropriate (`width_match` for panels, `exact_match` for hardware)
- Ensure `slot_count` is sufficient for all possible sizes

**Gate configuration not appearing?**
- Gate fields are optional but must include `gate-enabled` as a boolean field
- All gate fields should be in a separate section with `section_id = "gates"`

## Next Steps

After creating your CSV:
1. Validate against schema
2. Import via admin panel
3. Test in calculator with sample configurations
4. Verify product lookups return correct SKUs
5. Deploy to production
