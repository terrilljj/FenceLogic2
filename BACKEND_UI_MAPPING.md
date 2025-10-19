# Backend Calculation Logic → UI Configuration Mapping

## Overview

This document maps the backend calculation logic (`CompositionInput` interface) to the Fence Style UI Configuration system for all fence types.

---

## Backend Calculation Interface

```typescript
export interface CompositionInput {
  runLengthMm: number;           // Total section length
  startGapMm: number;            // Left end gap
  endGapMm: number;              // Right end gap
  betweenGapMm: number;          // Gap between panels
  maxPanelMm: number;            // Maximum panel width constraint
  minPanelMm: number;            // Minimum panel width constraint
  endGapPolicy?: EndGapPolicy;   // 'LOCKED_STRICT' | 'LOCKED_OR_RESIDUAL'
  
  gateConfig?: {
    required: boolean;
    gateWidthMm: number;
    hingePanelWidthMm?: number;
    hingeGapMm: number;
    latchGapMm: number;
    mountMode: 'GLASS_TO_GLASS' | 'POST' | 'WALL';
    hingeSide: 'LEFT' | 'RIGHT';
    position?: number;           // 0-1, where to place gate
  };
  
  customPanelConfig?: {
    required: boolean;
    panelWidthMm: number;
    panelHeightMm?: number;
    position?: number;           // 0-1 fraction along the run
    gapBeforeMm?: number;
    gapAfterMm?: number;
  };
}
```

---

## Pool Fence with Spigots - Complete Mapping

### 1. Core Calculator Inputs (All Variants)

| Backend Field | UI Field Config | Type | Unit | Default | Min | Max | Step | Purpose |
|---------------|-----------------|------|------|---------|-----|-----|------|---------|
| `runLengthMm` | `section-length` | number | mm | 3000 | 500 | 10000 | 50 | Total length of fence section to calculate |
| `startGapMm` | `left-gap` | number | mm | 50 | 0 | 150 | 5 | Gap at left end of section |
| `endGapMm` | `right-gap` | number | mm | 50 | 0 | 150 | 5 | Gap at right end of section |
| `betweenGapMm` | `desired-gap` | number | mm | 50 | 30 | 99 | 5 | Target gap between all panels |
| `maxPanelMm` | `max-panel-width` | number | mm | 1200 | 500 | 2000 | 50 | Maximum allowed panel width |
| `minPanelMm` | `min-panel-width` | number | mm | 250 | 200 | 1000 | 50 | Minimum allowed panel width |

**Flow:**
1. User enters section-length (e.g., 6000mm)
2. User sets left-gap and right-gap (e.g., 50mm each)
3. User sets desired-gap between panels (e.g., 50mm)
4. User sets max-panel-width constraint (e.g., 1200mm)
5. Backend calculates optimal panel layout using these constraints

---

### 2. Product Selection Fields (Standard Panels)

These fields determine **WHICH PRODUCTS** to use, not calculation inputs:

| UI Field Config | Type | Options | Default | Purpose | Maps To |
|----------------|------|---------|---------|---------|---------|
| `glass-thickness` | standard | ['12mm', '15mm'] | '12mm' | Select glass thickness | Product SKU lookup via slot system |
| `panel-height` | number | 1200-1500mm | 1200 | Glass panel height | Product SKU lookup via slot system |
| `spigot-hardware` | standard | ['Polished', 'Satin', 'Black'] | 'Satin' | Spigot finish | Product SKU lookup via slot system |

**Flow:**
1. Backend calculates panel layout (e.g., [1150mm, 1200mm, 1150mm])
2. User selects glass-thickness = '12mm'
3. Slot system looks up: "GP-0023" → Product "Glass Panel 12mm 1150W"
4. Component list shows correct product codes

---

### 3. Gate Configuration (Optional)

| Backend Field | UI Field Config | Type | Options/Range | Purpose |
|---------------|-----------------|------|---------------|---------|
| `gateConfig.required` | `gate-enabled` | boolean | - | Whether gate is required |
| `gateConfig.gateWidthMm` | `gate-width` | number | 600-1200mm | Width of gate panel |
| `gateConfig.hingePanelWidthMm` | `hinge-panel-width` | number | 900-1200mm | Width of hinge panel (glass-to-glass) |
| `gateConfig.hingeGapMm` | `hinge-gap` | number | 6-12mm | Gap at hinge side |
| `gateConfig.latchGapMm` | `latch-gap` | number | 6-12mm | Gap at latch side |
| `gateConfig.mountMode` | `gate-mount-mode` | standard | ['GLASS_TO_GLASS', 'POST', 'WALL'] | How gate is mounted |
| `gateConfig.hingeSide` | `gate-hinge-side` | standard | ['LEFT', 'RIGHT'] | Which side has hinge |
| `gateConfig.position` | `gate-position` | number | 0-1 | Position along run (0=left, 1=right) |

**Flow (with gate):**
1. User enables gate-enabled checkbox
2. User sets gate-width = 900mm
3. User selects gate-mount-mode = 'GLASS_TO_GLASS'
4. User sets hinge-gap = 8mm, latch-gap = 8mm
5. Backend reserves gate space in calculation: `gateSpace = 900 + hingePanel + 8 + 8`
6. Backend distributes remaining panels around gate

---

### 4. Custom Panel Configuration (Optional)

| Backend Field | UI Field Config | Type | Range | Purpose |
|---------------|-----------------|------|-------|---------|
| `customPanelConfig.required` | `custom-panel-enabled` | boolean | - | Whether custom panel is required |
| `customPanelConfig.panelWidthMm` | `custom-panel-width` | number | 250-2000mm | Width of custom panel |
| `customPanelConfig.panelHeightMm` | `custom-panel-height` | number | 900-1500mm | Height of custom panel |
| `customPanelConfig.position` | `custom-panel-position` | number | 0-1 | Position along run |
| `customPanelConfig.gapBeforeMm` | `custom-gap-before` | number | 0-99mm | Extra gap before custom panel |
| `customPanelConfig.gapAfterMm` | `custom-gap-after` | number | 0-99mm | Extra gap after custom panel |

---

## UI Configuration Structure

```typescript
{
  fenceStyleId: 'glass-pool-spigots',  // Maps to ProductVariant enum
  displayName: 'Pool Fence with Spigots',
  productVariantRefs: ['glass-pool-spigots'],
  config: {
    sections: [
      {
        id: 'panels',
        label: 'Glass Panels',
        variants: [
          {
            id: 'standard',
            label: 'Standard Panels',
            variants: [
              {
                id: 'standard-1200',        // Product type (not calculator input!)
                label: 'Standard 1200mm',
                skuPrefix: 'GP',
                fieldConfigs: [
                  // Core calculator inputs
                  { field: 'section-length', ... },
                  { field: 'left-gap', ... },
                  { field: 'right-gap', ... },
                  { field: 'desired-gap', ... },
                  { field: 'max-panel-width', ... },
                  // Product selection
                  { field: 'glass-thickness', ... },
                  { field: 'panel-height', ... },
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'hardware',
        label: 'Hardware',
        variants: [
          {
            id: 'spigots',
            label: 'Spigots',
            variants: [
              {
                id: 'spigot-config',
                label: 'Spigot Hardware',
                fieldConfigs: [
                  { field: 'spigot-hardware', type: 'standard', options: ['Polished', 'Satin', 'Black'] }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Calculation Flow Diagram

```
USER INPUT (UI Fields)
  ↓
┌─────────────────────────┐
│ section-length: 6000mm  │
│ left-gap: 50mm          │
│ right-gap: 50mm         │
│ desired-gap: 50mm       │
│ max-panel-width: 1200mm │
└──────────┬──────────────┘
           ↓
    Maps to CompositionInput
           ↓
┌─────────────────────────┐
│ runLengthMm: 6000       │
│ startGapMm: 50          │
│ endGapMm: 50            │
│ betweenGapMm: 50        │
│ maxPanelMm: 1200        │
└──────────┬──────────────┘
           ↓
   BACKEND CALCULATION
   (composeFenceSegments)
           ↓
┌─────────────────────────┐
│ Panel Layout:           │
│ [1175mm, 1200mm,        │
│  1200mm, 1175mm]        │
│ Gaps: [50, 50, 50]      │
└──────────┬──────────────┘
           ↓
    + PRODUCT SELECTION
           ↓
┌─────────────────────────┐
│ glass-thickness: 12mm   │
│ spigot-hardware: Satin  │
└──────────┬──────────────┘
           ↓
      SLOT LOOKUP
           ↓
┌─────────────────────────┐
│ GP-0023: Glass 12mm 1175W │
│ GP-0024: Glass 12mm 1200W │
│ SP-0001: Spigot Satin     │
└─────────────────────────┘
           ↓
    COMPONENT LIST (BOM)
```

---

## Key Insights

### Two Types of Fields:

1. **Calculator Input Fields** (affect layout calculation)
   - section-length, left-gap, right-gap, desired-gap, max-panel-width
   - These determine HOW MANY panels and WHAT SIZES
   - Maps directly to `CompositionInput` interface

2. **Product Selection Fields** (affect which products to use)
   - glass-thickness, panel-height, spigot-hardware, finish
   - These determine WHICH SKU to select for each calculated panel size
   - Maps to slot system for product lookup

### Hierarchical Structure:

```
Fence Style (glass-pool-spigots)
  └─ Section (Panels, Hardware, Gates)
      └─ Variant Group (Standard, Raked)
          └─ Product Variant (Standard 1200, Raked Panels)
              └─ Field Configs (calculator inputs + product selections)
```

### Variant vs Field Config:

- **Variant** (e.g., "Standard 1200") = A product TYPE
- **Field Config** (e.g., "section-length") = An input parameter

---

## Other Fence Styles (Quick Reference)

### Glass Pool Channel
- Same calculator inputs
- Different product fields: `channel-hardware` instead of `spigot-hardware`

### Glass Balustrade (Spigots/Standoffs)
- Same calculator inputs
- Different height ranges (900-1200mm vs 1200-1500mm)

### Aluminium BARR Pool Fence
- Same calculator inputs
- Panel types: Full panels vs. slats
- Product fields: `panel-height` ['1000mm', '1200mm', '1800mm'], `finish` ['Satin Black', 'Pearl White']

### PVC Hamptons
- Same calculator inputs
- Simplified product selection (mostly fixed heights)

---

## Summary

**The UI Configuration System has TWO distinct purposes:**

1. **Define calculation parameters** (section-length, gaps, constraints)
   → These map to `CompositionInput` and drive panel layout calculation

2. **Define product selection options** (thickness, finish, hardware)
   → These map to slot system for SKU lookup after calculation

Both are configured in `fieldConfigs`, but serve different purposes in the workflow.
