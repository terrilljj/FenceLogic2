# QA Report - Gate Disappearance Fix & Panel Layout Stability

**Date:** October 16, 2025  
**Status:** ✅ All Tests Passing (57/57)

## Summary

Successfully fixed critical gate disappearance bug, implemented EndGap Policy system, and resolved panel layout instability when changing gap preferences.

## Issues Fixed

### 1. Gate Disappearance Bug (Critical)

**Problem:** Gates would disappear when moved to far right position or when orientation was flipped.

**Root Causes Identified:**
1. Extra 50mm between-gap was added before hinge panel (LEFT hinge) but not accounted for in fixed components calculation
2. Missing 50mm between-gap when hingeSide=RIGHT (left panels are regular panels, need gap before gate assembly)

**Solution:**
- Removed unconditional between-gap before hinge panel when hingeSide=LEFT
- Added conditional between-gap after left panels when hingeSide=RIGHT
- Clamped gate position calculation to prevent invalid panel distributions

**Files Modified:**
- `shared/calc/gaps.ts` - Fixed segment sequencing logic
- `shared/calc/compose.ts` - Added position normalization and clamping

**Test Coverage:**
- R1: Gate on LEFT (GLASS_TO_GLASS) - ✅ Passing
- R2: Gate on RIGHT (flipped from LEFT) - ✅ Passing  
- All 43 regression tests passing with ±1mm tolerance

## New Features Implemented

### 2. EndGap Policy System

**Implementation:** LOCKED_OR_RESIDUAL policy with fallback behavior

**Policy Behavior:**
1. Try exact requested end gap first
2. If impossible on 50mm panel grid, fall back to computed residual gap
3. Report variance from requested end gap in response
4. Provisional target rounded DOWN to nearest 50mm to prevent panel overflow

**Components Added:**

#### `shared/calc/endgapAdvisor.ts`
- `adviseEndGap()` - Analyze which end gap values are feasible
- `isEndGapFeasible()` - Quick feasibility check
- `findClosestFeasibleEndGap()` - Find nearest feasible value

#### `server/routes/debug-endgap-advice.ts`
- `POST /api/debug/endgap-advice` - Analyze feasibility for multiple candidates
- `POST /api/debug/endgap-advice/closest` - Find closest feasible gap to target

**API Response Example:**
```json
{
  "config": {
    "runLength": 5000,
    "startGap": 25,
    "betweenGap": 50,
    "hasGate": false
  },
  "advice": [
    {
      "requestedEndGap": 20,
      "feasible": false,
      "reason": "Length not conserved: expected 5000mm, got 4995mm"
    },
    {
      "requestedEndGap": 25,
      "feasible": true,
      "actualEndGap": 25,
      "variance": 0
    }
  ],
  "recommendations": {
    "exactMatches": [25],
    "closestMatch": {
      "requestedEndGap": 25,
      "feasible": true,
      "actualEndGap": 25,
      "variance": 0
    }
  }
}
```

## Test Coverage

### Regression Tests (43 tests)
- ✅ resolve.spec.ts (6 tests)
- ✅ gate-mode-shim.spec.ts (7 tests)
- ✅ regression-visual-5000.spec.ts (11 tests)
- ✅ regression-gate-bugs.spec.ts (4 tests)
- ✅ ui-config-numbers.spec.ts (15 tests)

### New EndGap Advisor Tests (14 tests)
- ✅ adviseEndGap functionality
- ✅ Variance calculation
- ✅ Exact match identification
- ✅ Gate configuration handling
- ✅ Closest match recommendations
- ✅ Error reasons for infeasible gaps
- ✅ isEndGapFeasible quick checks
- ✅ findClosestFeasibleEndGap search
- ✅ LOCKED_OR_RESIDUAL policy behavior

**Total:** 57/57 tests passing

## Length Conservation

All configurations maintain strict length conservation:
- **Non-gate scenarios:** ±2mm tolerance
- **Gate scenarios:** ±1mm tolerance
- **Panel grid:** All panels on 50mm multiples
- **End gap variance:** Reported to user when residual fallback used

## API Endpoints

### New Debug Endpoints
- `POST /api/debug/endgap-advice` - Full feasibility analysis
- `POST /api/debug/endgap-advice/closest` - Find nearest feasible gap

### Existing Endpoints (Verified Working)
- `GET /api/designs` - ✅
- `GET /api/ui-configs/glass-pool-spigots` - ✅
- `GET /api/feature-flags` - ✅

## Known Limitations

1. **50mm Panel Grid Constraint:** Not all end gap values are achievable due to panel equalization on 50mm grid
2. **Residual Fallback:** Some requested end gaps may result in different actual values (variance reported)
3. **Strict Mode Option:** Environment flag `STRICT_END_GAP=1` enables LOCKED_STRICT policy (fails if exact gap impossible)

## Files Created/Modified

### New Files
- `shared/calc/endgapAdvisor.ts` - EndGap advisor helpers
- `server/routes/debug-endgap-advice.ts` - Debug API router
- `server/tests/endgap-advisor.spec.ts` - Comprehensive test suite
- `server/scripts/debug-endgap.ts` - Debug utility

### Modified Files
- `shared/calc/gaps.ts` - Fixed gate segment sequencing
- `shared/calc/compose.ts` - Added position clamping
- `server/routes.ts` - Mounted debug router
- `replit.md` - Updated documentation

### Debug Files (To be cleaned up)
- `server/scripts/test-compose-debug.ts`
- `server/scripts/test-gate-far-right.ts`
- `server/scripts/test-r2.ts`
- `server/scripts/debug-endgap.ts`

### 3. Panel Layout Stability Fix

**Problem:** Panel configuration would change from 2 panels to 3 panels when adjusting gap preferences (e.g., changing from 50mm to 33mm target gap).

**Root Cause:** 
- Panel count penalty (100 per panel) was too low compared to gap difference penalty (10 per mm)
- Gap tolerance (50mm) was too strict for panel equalization variance on 50mm grid
- For large gap differences (e.g., 65mm actual vs 33mm target = 32mm × 10 = 320 penalty), adding a 3rd panel (100 penalty) was scored better

**Solution:**
- Increased panel count penalty from 100 to 500 to strongly prefer fewer panels
- Increased gap tolerance from 50mm to 100mm to accept panel equalization variance
- Scoring now ensures 2-panel layouts remain stable regardless of gap preference changes

**Files Modified:**
- `shared/panelCalculations.ts` - Updated scoring weights and gap tolerance

**Verified Behavior:**
- 5000mm section with gate now maintains 2×1300mm standard panels
- Configuration stable when gap preference changes from 50mm to 33mm
- Actual gaps (65mm) result from 50mm grid constraint, not layout instability

## Recommendations

1. ✅ Gate disappearance bug fully resolved
2. ✅ EndGap policy implemented and tested
3. ✅ Panel layout stability fixed
4. ✅ API endpoints functional and documented
5. ✅ Architect review completed
6. 🔄 Clean up debug scripts (see list above)

## Next Steps

1. Clean up temporary debug files
2. Consider adding UI hints using endgap advice endpoint
3. Document policy behavior in user-facing documentation
