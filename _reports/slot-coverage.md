# Slot-coverage audit

Per variant: components resolved from YOUR configured slots (HIT) vs hardcoded fallback (MISS), and configured slot fields the calc never queries.

**Overall: 9 slot HITs, 332 slot MISSes** across all variants. A MISS or a never-queried field = a component the admin does NOT control (hardcoded). Glass/alu channel variants have no slots configured at all.


## glass-pool-spigots
- slot lookups: **9 HIT** (from your slots), **12 MISS** (fell back to hardcoded). ~6 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `glass-panels` 9/0, `spigot-hardware` 0/10, `hinge-set` 0/1, `latch-set` 0/1
- configured slot fields NEVER queried by the calc (5/6): `master-gate-panels`, `master-hinge-panels`, `raked-panels`, `soft-close-gates`, `soft-close-hinge-panels`

## glass-pool-channel
- slot lookups: **0 HIT** (from your slots), **7 MISS** (fell back to hardcoded). ~9 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `glass-panels` 0/5, `hinge-set` 0/1, `latch-set` 0/1
- configured slot fields NEVER queried by the calc (0/0): none

## glass-bal-spigots-12mm
- slot lookups: **0 HIT** (from your slots), **4 MISS** (fell back to hardcoded). ~2 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `spigot-hardware` 0/4
- configured slot fields NEVER queried by the calc (11/12): `Fixing`, `Joiner`, `Nanorail`, `Nanorail Compliance`, `Nanorail Component`, `Nanorail Rubber`, `Rail`, `Rail Rubber`, `Spigot Cover`, `Wall Connector`, `glass-panels`

## glass-bal-spigots-15mm
- slot lookups: **0 HIT** (from your slots), **4 MISS** (fell back to hardcoded). ~2 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `spigot-hardware` 0/4
- configured slot fields NEVER queried by the calc (6/7): `Fixing`, `Joiner`, `Rail`, `Spigot Cover`, `Wall Connector`, `glass-panels`

## glass-bal-channel
- slot lookups: **0 HIT** (from your slots), **0 MISS** (fell back to hardcoded). ~7 component lines per build; lookups cover the slot-backed subset.
- **the BOM made ZERO slot lookups for this variant** — every SKU is hardcoded in code.
- configured slot fields NEVER queried by the calc (0/0): none

## glass-bal-channel-hd
- slot lookups: **0 HIT** (from your slots), **0 MISS** (fell back to hardcoded). ~8 component lines per build; lookups cover the slot-backed subset.
- **the BOM made ZERO slot lookups for this variant** — every SKU is hardcoded in code.
- configured slot fields NEVER queried by the calc (0/0): none

## glass-bal-standoffs
- slot lookups: **0 HIT** (from your slots), **3 MISS** (fell back to hardcoded). ~2 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `standoff-hardware` 0/3
- configured slot fields NEVER queried by the calc (7/8): `Fixing`, `Joiner`, `Rail`, `Spare`, `Spare End Cap`, `Wall Connector`, `glass-panels`

## alu-pool-tubular
- slot lookups: **0 HIT** (from your slots), **71 MISS** (fell back to hardcoded). ~9 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `panel` 0/30, `shroud-kit` 0/10, `post` 0/12, `post-cover` 0/4, `fixing` 0/4, `gate-hardware` 0/5, `grout` 0/2, `dome-nut` 0/2, `chem-anchor` 0/2
- configured slot fields NEVER queried by the calc (4/6): `Adjustable Shroud`, `Fixing`, `Gate Hardware`, `Shroud Kit`

## alu-pool-barr
- slot lookups: **0 HIT** (from your slots), **95 MISS** (fell back to hardcoded). ~10 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `panel` 0/35, `bracket` 0/10, `bracket-cap` 0/10, `post` 0/16, `post-cover` 0/9, `fixing` 0/4, `gate-hardware` 0/5, `grout` 0/2, `dome-nut` 0/2, `chem-anchor` 0/2
- configured slot fields NEVER queried by the calc (7/9): `Bracket Cap`, `C-Bracket`, `Corner/Gate Post Cover`, `Fixing`, `Gate Hardware`, `Gate Panel`, `Inline Post Cover`

## alu-pool-blade
- slot lookups: **0 HIT** (from your slots), **78 MISS** (fell back to hardcoded). ~9 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `panel` 0/35, `bracket` 0/10, `post` 0/12, `post-cover` 0/6, `fixing` 0/4, `gate-hardware` 0/5, `grout` 0/2, `dome-nut` 0/2, `chem-anchor` 0/2
- configured slot fields NEVER queried by the calc (5/7): `Bracket`, `Fixing`, `Gate Hardware`, `Gate Panel`, `Post Cover`

## alu-bal-barr
- slot lookups: **0 HIT** (from your slots), **32 MISS** (fell back to hardcoded). ~7 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `panel` 0/15, `bracket` 0/3, `bracket-cap` 0/3, `post` 0/4, `top-plate` 0/1, `post-cover` 0/2, `grout` 0/1, `fixing` 0/2, `dome-nut` 0/1
- configured slot fields NEVER queried by the calc (8/11): `Dome Nut`, `Fixing`, `c-bracket`, `domical-cover`, `dress-ring`, `end-post`, `full-post`, `mid-post`

## alu-bal-blade
- slot lookups: **0 HIT** (from your slots), **26 MISS** (fell back to hardcoded). ~6 component lines per build; lookups cover the slot-backed subset.
- per field (hit/miss): `panel` 0/12, `bracket` 0/3, `post` 0/4, `top-plate` 0/1, `post-cover` 0/2, `grout` 0/1, `fixing` 0/2, `dome-nut` 0/1
- configured slot fields NEVER queried by the calc (8/11): `Dome Nut`, `Fixing`, `Post`, `domical-cover`, `dress-ring`, `end-post`, `full-post`, `mid-post`