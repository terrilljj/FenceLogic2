# Catalogue by style

Every distinct storefront SKU per launch style, grouped by the style's category_slug
prefix (`LIKE '<prefix>%'`). One row per SKU — NOT per size/finish permutation. Source:
`bh_storefront` (product_placements ⋈ products), the live Vercel storefront data.

Each style has an `.xlsx` (thumbnails physically embedded — render in Excel offline, no
`IMAGE()` proxy) and a `.csv` (same data, image as a plain URL). Columns: `image, sku,
description, subcat_1..N, retail_price_inc_gst, category_slug`. The `subcat_*` columns are
the named hierarchy below the style root, from `bh_storefront.categories.display_name`.

| Style | Category prefix | SKUs | Files |
| --- | --- | ---: | --- |
| glass-pool-spigots | `pool-fencing-glass-spigots` | 349 | [xlsx](glass-pool-spigots.xlsx) · [csv](glass-pool-spigots.csv) |
| glass-pool-channel | `pool-fencing-glass-channel` | 263 | [xlsx](glass-pool-channel.xlsx) · [csv](glass-pool-channel.csv) |
| glass-bal-spigots-12mm | `balustrade-glass-spigots-12mm` | 259 | [xlsx](glass-bal-spigots-12mm.xlsx) · [csv](glass-bal-spigots-12mm.csv) |
| glass-bal-spigots-15mm | `balustrade-glass-spigots-15mm` | 118 | [xlsx](glass-bal-spigots-15mm.xlsx) · [csv](glass-bal-spigots-15mm.csv) |
| glass-bal-channel | `balustrade-glass-channel-15mm` | 99 | [xlsx](glass-bal-channel.xlsx) · [csv](glass-bal-channel.csv) |
| glass-bal-channel-hd | `balustrade-glass-channel-17-52-hd` | 109 | [xlsx](glass-bal-channel-hd.xlsx) · [csv](glass-bal-channel-hd.csv) |
| glass-bal-standoffs | `balustrade-glass-standoff-15mm` | 82 | [xlsx](glass-bal-standoffs.xlsx) · [csv](glass-bal-standoffs.csv) |
| alu-pool-tubular | `pool-fencing-metal-flat-top-tubular` | 97 | [xlsx](alu-pool-tubular.xlsx) · [csv](alu-pool-tubular.csv) |
| alu-pool-barr | `pool-fencing-metal-barr` | 49 | [xlsx](alu-pool-barr.xlsx) · [csv](alu-pool-barr.csv) |
| alu-pool-blade | `pool-fencing-metal-blade` | 41 | [xlsx](alu-pool-blade.xlsx) · [csv](alu-pool-blade.csv) |
| alu-pool-premium-perf | `pool-fencing-metal-premium-perf` | 70 | [xlsx](alu-pool-premium-perf.xlsx) · [csv](alu-pool-premium-perf.csv) |
| alu-pool-pik | `pool-fencing-metal-pik` | 31 | [xlsx](alu-pool-pik.xlsx) · [csv](alu-pool-pik.csv) |
| alu-bal-barr | `balustrade-metal-barr` | 48 | [xlsx](alu-bal-barr.xlsx) · [csv](alu-bal-barr.csv) |
| alu-bal-blade | `balustrade-metal-blade` | 31 | [xlsx](alu-bal-blade.xlsx) · [csv](alu-bal-blade.csv) |
| alu-bal-premium-perf | `balustrade-metal-premium-perf` | 46 | [xlsx](alu-bal-premium-perf.xlsx) · [csv](alu-bal-premium-perf.csv) |
| alu-bal-visor | `balustrade-metal-visor` | 95 | [xlsx](alu-bal-visor.xlsx) · [csv](alu-bal-visor.csv) |

**Total: 1787 SKU rows across 16 styles.**

> Note: `glass-bal-channel` is defaulted to `balustrade-glass-channel-12mm` pending operator
> confirmation (store also has `-15mm`). The store's `-pik / -premium-perf / -visor` ranges
> have no calc style and are excluded.

