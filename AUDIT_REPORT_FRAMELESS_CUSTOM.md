# Audit Report: Gate Logic for Frameless Custom Integration

**Date:** October 16, 2025  
**Scope:** Read-only analysis of current gate calculation paths before frameless_custom implementation  
**Status:** ✅ Complete

---

## 1. Files Scanned (7 files, 1,763 LOC)

### Core Calculation Layer
| File | LOC | Status | Git Status |
|------|-----|--------|------------|
| `shared/calc/compose.ts` | 536 | ✅ Scanned | Modified (recent fixes) |
| `shared/calc/equalize.ts` | 270 | ✅ Scanned | Stable |
| `shared/calc/lengthAccounting.ts` | 180 | ✅ Scanned | Stable |
| `shared/calc/gaps.ts` | 173 | ✅ Scanned | Modified (gate fixes) |
| `shared/calc/gateAnchor.ts` | - | ⚠️ NOT FOUND | N/A |

### Service Layer
| File | LOC | Status | Git Status |
|------|-----|--------|------------|
| `server/services/resolve.ts` | 308 | ✅ Scanned | Stable |
| `server/services/gate-mode-shim.ts` | 137 | ✅ Scanned | Stable |
| `server/services/sku-selector.ts` | 159 | ✅ Scanned | Stable |

### Test Coverage
| Test File | Tests | Status |
|-----------|-------|--------|
| `server/tests/resolve.spec.ts` | 6 | ✅ PASS |
| `server/tests/gate-mode-shim.spec.ts` | 7 | ✅ PASS |
| `server/tests/regression-gate-bugs.spec.ts` | 4 | ✅ PASS |
| **TOTAL** | **17** | **✅ 17/17 PASS** |

---

## 2. Exported Functions & Types

### `shared/calc/compose.ts`
```typescript
export type EndGapPolicy = 'LOCKED_STRICT' | 'LOCKED_OR_RESIDUAL';

export interface CompositionInput {
  runLengthMm: number;
  startGapMm: number;
  endGapMm: number;
  betweenGapMm: number;
  maxPanelMm: number;
  minPanelMm: number;
  endGapPolicy?: EndGapPolicy;
  gateConfig?: {
    required: boolean;
    gateWidthMm: number;
    hingePanelWidthMm?: number;
    hingeGapMm: number;
    latchGapMm: number;
    mountMode: 'GLASS_TO_GLASS' | 'POST' | 'WALL';
    hingeSide: 'LEFT' | 'RIGHT';
    position?: number;
  };
}

export interface CompositionResult {
  success: boolean;
  segments: Segment[];
  panelLayout: PanelLayout;
  validation: {
    sumMm: number;
    expectedMm: number;
    deltaMm: number;
    gatePresent: boolean;
    lengthConserved: boolean;
  };
  actualEndGapMm?: number;
  residualEndGapMm?: number;
  varianceEndGapMm?: number;
  endGapPolicy?: EndGapPolicy;
  errors?: Array<{ code: string; message: string; details?: any }>;
}

export function composeFenceSegments(input: CompositionInput): CompositionResult
```

### `shared/calc/equalize.ts`
```typescript
export function equalizePanelsExact(
  targetMm: number,
  N: number,
  stepMm: number,
  minPanelMm: number,
  maxPanelMm: number
): { widthsMm: number[] } | { error: string }

export function findFeasibleN(...)

export function equalizePanels({ targetMm, stepMm, maxPanelMm, minPanelMm })
```

### `shared/calc/lengthAccounting.ts`
```typescript
export interface FixedLeftRight {
  startGapMm: number;
  endGapRequestedMm: number;
  hingeGapMm: number;
  latchGapMm: number;
  gateWidthMm?: number;
  hingePanelWidthMm?: number;
  fixedLeftMm: number;
  fixedRightMm: number;
}

export interface GateConfig {
  required: boolean;
  mountMode?: 'GLASS_TO_GLASS' | 'POST';
  hingeSide?: 'LEFT' | 'RIGHT';
  gateWidthMm?: number;
  hingePanelWidthMm?: number;
  hingeGapMm?: number;
  latchGapMm?: number;
  position?: number;
}

export function computeFixedLeftRight(
  gateConfig: GateConfig | undefined,
  systemSpec: SystemSpec
): FixedLeftRight

export function equalizePanelsForTarget(input: EqualizePanelsInput): EqualizePanelsResult
```

### `shared/calc/gaps.ts`
```typescript
export type SegmentKind = 'panel' | 'hinge-panel' | 'gate' | 'post-anchor' | 'gap';

export interface Segment {
  kind: SegmentKind;
  widthMm?: number;
  gapType?: 'start' | 'end' | 'between' | 'hinge' | 'latch';
}

export function computeBetweenGapCount(sequence: SegmentKind[]): number

export function validateSegmentComposition(
  segments: Segment[],
  expectedRunLength: number
): { valid: boolean; sumMm: number; delta: number; errors: string[]; segments: Segment[] }

export function buildSegmentSequence(config: {...}): Segment[]
```

### `server/services/resolve.ts`
```typescript
export interface ResolveTraceEntry {
  source: "categoryPath" | "subcategory" | "direct" | "gate-mode-shim" | "ui-config:number";
  key: string;
  codes: string[];
  note?: string;
}

export interface ResolveResult {
  trace: ResolveTraceEntry[];
  finalCodes: string[];
}

export function resolveSelectionToProductsCore(
  uiConfig: ProductUIConfig | null,
  products: Product[],
  selection: Record<string, any>,
  variantKey?: string
): ResolveResult
```

### `server/services/gate-mode-shim.ts`
```typescript
export type GateMode = 'GLASS_TO_GLASS' | 'POST' | 'WALL';
export type GateSystem = 'MASTER' | 'POLARIS';

export interface GateModeMapping {
  includeSubcats: string[];
  excludeSubcats: string[];
  includePaths?: string[];
  excludePaths?: string[];
}

export function mapGateModeToCatalog(
  variantKey: string,
  mode: GateMode,
  system: GateSystem
): GateModeMapping

export function normalizeGateSystem(system: any): GateSystem
export function normalizeGateMode(mode: any): GateMode | null
```

### `server/services/sku-selector.ts`
```typescript
export interface SkuSelectionResult {
  sku?: string;
  snappedWidthMm?: number;
  warning?: string;
  note?: string;
}

export function extractWidthFromCode(code: string): number | null

export function chooseGateSkuByNearest(
  targetMm: number,
  gateSkus: Product[],
  toleranceMm: number = 50
): SkuSelectionResult

export function chooseHingePanelWidth(...)
```

---

## 3. Gate Logic Invariants (Verified ✅)

### A. Between-Gap Policy
**Location:** `shared/calc/gaps.ts:14-38`

✅ **CONFIRMED:** Between-gaps are NOT applied at hinge/latch interfaces
```typescript
// Lines 15-19 (gaps.ts)
// Between gaps appear between adjacent glass elements (panel or hinge panel),
// NOT between:
//  - start/end gaps
//  - hingeGap/latchGap around the gate
//  - posts
```

**Implementation:** `computeBetweenGapCount()` only increments when consecutive glass elements detected, skipping gate hardware gaps.

### B. Mount Mode Hardware
**Location:** `shared/calc/gaps.ts:135-143`

✅ **CONFIRMED:** GLASS_TO_GLASS inserts exactly one hinge-panel; POST/WALL uses post anchor (0 width)
```typescript
// Lines 136-143 (gaps.ts)
if (mountMode === 'GLASS_TO_GLASS') {
  segments.push({ kind: 'hinge-panel', widthMm: hingePanelWidthMm });
  segments.push({ kind: 'gap', widthMm: hingeGapMm, gapType: 'hinge' });
} else {
  // POST or WALL mount - add post anchor
  segments.push({ kind: 'post-anchor', widthMm: 0 }); // Posts have no width
  segments.push({ kind: 'gap', widthMm: hingeGapMm, gapType: 'hinge' });
}
```

### C. Gate Presence Enforcement
**Location:** `shared/calc/compose.ts:436-447`

✅ **CONFIRMED:** Exactly one gate required when `gate_required=true`
```typescript
// Lines 436-448 (compose.ts)
if (gateConfig?.required && !gatePresent) {
  errors.push({
    code: 'GATE_REQUIRED_MISSING',
    message: 'Gate is required but no gate segment found',
  });
}

if (gateConfig?.required && gateSegments.length > 1) {
  errors.push({
    code: 'MULTIPLE_GATES',
    message: 'Only one gate segment allowed',
  });
}
```

### D. Length Conservation Check
**Location:** `shared/calc/compose.ts:469-489`

✅ **CONFIRMED:** Strict length conservation with tolerance-based validation
```typescript
// Lines 469-489 (compose.ts)
// 3. STRICT Length conservation check (±1mm for gates, ±2mm for no-gate)
let sumMm = 0;
for (const segment of segments) {
  if (segment.widthMm) {
    sumMm += segment.widthMm;
  }
}

const deltaMm = sumMm - runLengthMm;
const absDeltaMm = Math.abs(deltaMm);

// Stricter tolerance for gate scenarios (±1mm)
const tolerance = gateConfig?.required ? 1 : 2;
const lengthConserved = absDeltaMm <= tolerance;

if (!lengthConserved) {
  // HARD FAIL for length invariant violation
  errors.push({
    code: 'LENGTH_INVARIANT',
    message: `Length not conserved: expected ${runLengthMm}mm, got ${sumMm}mm (Δ${deltaMm}mm > ±${tolerance}mm)`,
    ...
  });
}
```

**Tolerance:**
- Gate scenarios: ±1mm
- Non-gate scenarios: ±2mm
- Returns `success: false` and error when violated

---

## 4. Policy & Flags

### Default EndGapPolicy
**Location:** `shared/calc/compose.ts:139-141`

```typescript
policy = process.env.STRICT_END_GAP === '1' 
  ? 'LOCKED_STRICT' 
  : (input.endGapPolicy ?? 'LOCKED_OR_RESIDUAL');
```

**Current Default:** `LOCKED_OR_RESIDUAL`
- Tries exact requested end gap first
- Falls back to computed residual gap if 50mm grid constraint prevents exact match
- Reports variance in `varianceEndGapMm` field

### STRICT_END_GAP Environment Flag
**Behavior:**
- `STRICT_END_GAP=1` → Forces `LOCKED_STRICT` policy
- `LOCKED_STRICT` → Returns `UNREACHABLE` error if exact end gap impossible on 50mm grid
- Used for QA/testing strict scenarios
- **Default:** Not set (uses `LOCKED_OR_RESIDUAL`)

**References Found:**
1. `shared/calc/compose.ts:139` - Policy selection
2. `shared/calc/compose.ts:148` - Trace logging
3. `replit.md:64` - Documentation
4. `QA_REPORT.md:136` - Test documentation

---

## 5. TODO/FIXME Comments

**Result:** ✅ **NONE FOUND**

No TODO or FIXME comments detected in any scanned files.

---

## 6. Smoke Test Results

```
✓ server/tests/resolve.spec.ts (6 tests) 13ms
✓ server/tests/gate-mode-shim.spec.ts (7 tests) 17ms
✓ server/tests/regression-gate-bugs.spec.ts (4 tests) 23ms

Test Files  3 passed (3)
     Tests  17 passed (17)
  Duration  1.31s
```

### By File:
- ✅ **resolve.spec.ts:** 6/6 passed
- ✅ **gate-mode-shim.spec.ts:** 7/7 passed  
- ✅ **regression-gate-bugs.spec.ts:** 4/4 passed (includes B1, B2, B3 gate bug fixes)

**Total:** ✅ **17/17 tests passing**

---

## 7. High-Risk Areas for Frameless Custom Integration

### 🔴 Critical Risk: compose.ts Gate Path Dependency

**Location:** `shared/calc/compose.ts:99-306`

**Risk:** The entire gate calculation path is tightly coupled to the assumption that gates exist. Frameless custom panels (no gates) would bypass this 300+ line gate-specific flow entirely.

**Current Flow:**
```
if (gateConfig?.required) {
  // 200+ lines of gate-specific logic:
  // - computeFixedLeftRight with gate components
  // - Policy selection (LOCKED vs RESIDUAL)
  // - Panel equalization accounting for hinge/latch gaps
  // - Left/right panel splitting based on gate position
  // ...
} else {
  // NON-GATE PATH (line 310+)
  // Currently handles simple panel-only scenarios
}
```

**Integration Impact:** Frameless custom will likely use the non-gate path, but may need:
1. Custom panel width handling (like hinge panels, but configurable)
2. Position-based insertion (like gates, but for custom glass)
3. Gap policy decisions without gate constraints

### 🟡 Medium Risk: equalize.ts Assumes Uniform Constraints

**Location:** `shared/calc/equalize.ts:5-98`

**Risk:** Panel equalization assumes all panels share same min/max bounds. Custom frameless panels may have different constraints (e.g., one panel fixed at 1500mm, others variable).

**Current Assumption:**
```typescript
equalizePanelsExact(targetMm, N, stepMm, minPanelMm, maxPanelMm)
// All N panels must be within [minPanelMm, maxPanelMm]
```

**Frameless Custom Need:** Hybrid equalization where some panels have fixed widths, others are equalized.

### 🟡 Medium Risk: lengthAccounting.ts Gate-Centric Design

**Location:** `shared/calc/lengthAccounting.ts:41-95`

**Risk:** `computeFixedLeftRight()` is designed specifically for gate scenarios. Custom panels would need parallel fixed component accounting.

**Current Design:**
- Accounts for gate + hinge panel + hardware gaps as "fixed"
- Splits left/right based on gate position
- Custom panels may need similar position-based splitting without gate semantics

---

## 8. Suggested Integration Points

### 1. **Add `customPanelConfig` to CompositionInput**
**File:** `shared/calc/compose.ts:25-34`

```typescript
// Suggested addition:
customPanelConfig?: {
  required: boolean;
  panelWidthMm: number;
  position?: number; // 0-1, where to place custom panel
  gapBefore?: number; // Custom gap before panel
  gapAfter?: number;  // Custom gap after panel
}
```

**Rationale:** Parallel structure to `gateConfig` allows reusing position logic without gate assumptions.

### 2. **Extend Non-Gate Path with Custom Panel Support**
**File:** `shared/calc/compose.ts:310-330` (current non-gate path)

**Current Code:**
```typescript
} else {
  // NON-GATE PATH
  const panelsTarget = runLengthMm - startGapMm - endGapMm;
  // Simple equalization logic...
}
```

**Suggested Integration:**
```typescript
} else {
  // NON-GATE PATH (with custom panel support)
  let fixedComponents = startGapMm + endGapMm;
  
  if (customPanelConfig?.required) {
    fixedComponents += customPanelConfig.panelWidthMm;
    fixedComponents += (customPanelConfig.gapBefore || 0);
    fixedComponents += (customPanelConfig.gapAfter || 0);
  }
  
  const panelsTarget = runLengthMm - fixedComponents;
  // Equalize remaining variable panels...
  
  // Insert custom panel at position
  if (customPanelConfig?.required) {
    // Use similar position logic as gate insertion
  }
}
```

### 3. **Create `computeFixedCustomPanel()` Helper**
**File:** `shared/calc/lengthAccounting.ts` (new function)

```typescript
export interface CustomPanelConfig {
  required: boolean;
  panelWidthMm: number;
  position?: number;
  gapBefore?: number;
  gapAfter?: number;
}

export function computeFixedCustomPanel(
  customConfig: CustomPanelConfig | undefined,
  systemSpec: SystemSpec
): {
  customPanelMm: number;
  customGapsMm: number;
  fixedLeftMm: number;
  fixedRightMm: number;
}
```

**Rationale:** Isolate custom panel accounting logic, parallel to `computeFixedLeftRight()` for gates.

---

## 9. Existing Frameless References

**Found in codebase:**
```
shared/schema.ts: selectionId: "pool_fencing_frameless_raked_panels"
shared/schema.ts: categoryPaths: ["pool_fence/frameless/glass_panels", ...]
shared/schema.ts: optionPaths: { "12mm" → ["pool_fence/frameless/glass_panels"] }
server/services/gate-mode-shim.ts: // Only apply shim for frameless glass pool fence variants
```

**Current Frameless Support:** Product catalog and UI config support frameless variants, but calculation layer is gate-focused.

---

## 10. Summary & Recommendations

### Invariants Status: ✅ ALL VERIFIED
- Between-gaps correctly excluded at gate interfaces
- GLASS_TO_GLASS enforces hinge panel, POST/WALL uses anchors
- Gate presence enforced when required (exactly one)
- Length conservation check active (±1mm gates, ±2mm non-gate)

### Policy Status: ✅ CONFIRMED
- Default: `LOCKED_OR_RESIDUAL` (tries exact, falls back to residual)
- `STRICT_END_GAP=1` flag respected (forces `LOCKED_STRICT`)
- Variance reporting functional

### Test Coverage: ✅ COMPLETE
- 17/17 tests passing
- Gate bug regressions covered (B1, B2, B3)
- Resolver and gate-mode-shim verified

### Integration Readiness: 🟡 MEDIUM RISK
**Key Challenges:**
1. Gate path dominates calculation flow (300+ lines)
2. Non-gate path is minimal (simple equalization only)
3. No custom panel hooks in current architecture

**Recommended Approach:**
1. ✅ Extend `CompositionInput` with `customPanelConfig`
2. ✅ Enhance non-gate path to handle custom panels with position logic
3. ✅ Create `computeFixedCustomPanel()` in lengthAccounting.ts
4. ✅ Reuse segment building logic from `buildSegmentSequence()` 
5. ⚠️ **DO NOT** modify gate path - keep it isolated
6. ✅ Add custom panel tests parallel to gate tests

### Next Steps:
1. Create `customPanelConfig` interface in compose.ts
2. Implement custom panel accounting in lengthAccounting.ts
3. Extend non-gate path in compose.ts for custom panel insertion
4. Add custom panel segment type to gaps.ts
5. Write comprehensive tests for custom panel scenarios
6. Update resolve.ts to handle custom panel SKU selection

---

**Report Complete** ✅  
**Files Analyzed:** 7  
**Lines Reviewed:** 1,763  
**Tests Verified:** 17/17 passing  
**Ready for Frameless Custom Implementation:** Yes, with recommended integration points
