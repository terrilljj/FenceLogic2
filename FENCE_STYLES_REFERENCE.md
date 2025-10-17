# FenceLogic - Complete Fence Styles Reference

## Product Categories (14 Fence Styles)

Use these exact values in the **`category`** column of your CSV:

1. `Frameless Pool Fence`
2. `Channel Pool Fence`
3. `Flat Top Pool Fence`
4. `BARR Pool Fence`
5. `Blade Pool Fence`
6. `Hamptons Full Privacy`
7. `Hamptons Combo`
8. `Hamptons Vertical Paling`
9. `Hamptons Semi Privacy`
10. `Hamptons 3 Rail`
11. `Frameless Balustrade`
12. `Channel Balustrade`
13. `Standoff Balustrade`
14. `Aluminium Balustrade`

---

## Product Subcategories (17 Types)

Use these exact values in the **`subcategory`** column of your CSV:

1. `Spigots`
2. `Channel`
3. `Standoffs`
4. `BARR`
5. `Blade`
6. `Tubular`
7. `PIK`
8. `Visor`
9. `Zeus`
10. `Full Privacy`
11. `Combo`
12. `Vertical Paling`
13. `Semi Privacy`
14. `3 Rail`
15. `NanoRail`
16. `NonoRail`
17. `Series 35`

---

## Product Variants (Internal Codes)

These are the technical variant codes used internally:

### Glass Pool Fencing
- `glass-pool-spigots` - Frameless glass pool fence with spigots
- `glass-pool-channel` - Glass pool fence with channel system

### Glass Balustrade
- `glass-bal-spigots` - Frameless glass balustrade with spigots
- `glass-bal-channel` - Glass balustrade with channel system
- `glass-bal-standoffs` - Glass balustrade with standoffs

### Aluminium Pool Fencing
- `alu-pool-tubular` - Aluminium pool fence - tubular style
- `alu-pool-barr` - Aluminium pool fence - BARR style
- `alu-pool-blade` - Aluminium pool fence - Blade style
- `alu-pool-pik` - Aluminium pool fence - PIK style

### Aluminium Balustrade
- `alu-bal-barr` - Aluminium balustrade - BARR style
- `alu-bal-blade` - Aluminium balustrade - Blade style
- `alu-bal-visor` - Aluminium balustrade - Visor style

### PVC Hamptons Fencing
- `pvc-hamptons-full-privacy` - Hamptons full privacy fence
- `pvc-hamptons-combo` - Hamptons combo fence
- `pvc-hamptons-vertical-paling` - Hamptons vertical paling fence
- `pvc-hamptons-semi-privacy` - Hamptons semi privacy fence
- `pvc-hamptons-3rail` - Hamptons 3 rail fence

### General/Custom
- `general-zeus` - Zeus general fencing
- `general-blade` - Blade general fencing
- `general-barr` - BARR general fencing
- `custom-panel-designer` - Custom panel designer
- `custom-glass` - Custom glass configuration
- `custom-frameless` - Custom frameless configuration

---

## CSV Import Format Example

```csv
code,description,category,subcategory,price,active
POST-100,Spigot Post 100mm,Frameless Pool Fence,Spigots,45.00,1
GLASS-12,12mm Toughened Glass Panel,Frameless Pool Fence,Spigots,250.00,1
CHANNEL-ALU,Aluminium Channel 3m,Channel Pool Fence,Channel,89.00,1
BARR-POST,BARR Aluminium Post,BARR Pool Fence,BARR,67.50,1
HAMPTONS-FP,Hamptons Full Privacy Panel,Hamptons Full Privacy,Full Privacy,320.00,1
```

---

## Common Category + Subcategory Combinations

| Category | Common Subcategories |
|----------|---------------------|
| Frameless Pool Fence | Spigots |
| Channel Pool Fence | Channel |
| Frameless Balustrade | Spigots, Standoffs |
| Channel Balustrade | Channel |
| Standoff Balustrade | Standoffs |
| BARR Pool Fence | BARR |
| Blade Pool Fence | Blade |
| Aluminium Balustrade | BARR, Blade, Visor |
| Hamptons Full Privacy | Full Privacy |
| Hamptons Combo | Combo |
| Hamptons Vertical Paling | Vertical Paling |
| Hamptons Semi Privacy | Semi Privacy |
| Hamptons 3 Rail | 3 Rail |

---

## Notes

- **Categories** are case-sensitive - use exact capitalization
- **Subcategories** are also case-sensitive
- The `active` column: use `1` for active products, `0` for inactive
- You can leave `subcategory` blank if not applicable
- Multiple category paths can be specified using semicolon separator in `categoryPaths` column
