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

## Product Subcategories (21 Types)

Use these exact values in the **`subcategory`** column of your CSV:

1. `Spigots`
2. `Spigot Glass Panels`
3. `Master Hinge & Gate`
4. `Soft Hinge and Gate`
5. `Raked Panels`
6. `Channel`
7. `Standoffs`
8. `BARR`
9. `Blade`
10. `Tubular`
11. `PIK`
12. `Visor`
13. `Zeus`
14. `Full Privacy`
15. `Combo`
16. `Vertical Paling`
17. `Semi Privacy`
18. `3 Rail`
19. `NanoRail`
20. `NonoRail`
21. `Series 35`

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

## Fence Styles with Available Subcategories (Components)

### Glass Pool Fencing Styles

**1. Frameless Pool Fence (Pool Fence with Spigots)**
- `Spigots` - Spigot mounting posts
- `Spigot Glass Panels` - Glass panels for spigot system
- `Master Hinge & Gate` - Master hinge gate hardware
- `Soft Hinge and Gate` - Soft close hinge gate hardware
- `Raked Panels` - Panels for sloped/raked installations

**2. Channel Pool Fence**
- `Channel` - Channel mounting system components

**3. Flat Top Pool Fence**
- `Channel` - Channel mounting system components

**4. BARR Pool Fence**
- `BARR` - BARR system components

**5. Blade Pool Fence**
- `Blade` - Blade system components

### Glass Balustrade Styles

**6. Frameless Balustrade**
- `Spigots` - Spigot mounting posts
- `Spigot Glass Panels` - Glass panels for spigot system
- `Standoffs` - Standoff mounting hardware

**7. Channel Balustrade**
- `Channel` - Channel mounting system components

**8. Standoff Balustrade**
- `Standoffs` - Standoff mounting hardware

### Aluminium Fencing Styles

**9. Hamptons Full Privacy**
- `Full Privacy` - Full privacy panels and components

**10. Hamptons Combo**
- `Combo` - Combination style panels and components

**11. Hamptons Vertical Paling**
- `Vertical Paling` - Vertical paling panels and components

**12. Hamptons Semi Privacy**
- `Semi Privacy` - Semi privacy panels and components

**13. Hamptons 3 Rail**
- `3 Rail` - 3 rail panels and components

**14. Aluminium Balustrade**
- `BARR` - BARR aluminium components
- `Blade` - Blade aluminium components
- `Visor` - Visor aluminium components
- `NanoRail` - NanoRail components
- `NonoRail` - NonoRail components
- `Series 35` - Series 35 components

---

## Notes

- **Categories** are case-sensitive - use exact capitalization
- **Subcategories** are also case-sensitive
- The `active` column: use `1` for active products, `0` for inactive
- You can leave `subcategory` blank if not applicable
- Multiple category paths can be specified using semicolon separator in `categoryPaths` column
