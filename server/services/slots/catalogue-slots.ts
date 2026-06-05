/**
 * Catalogue-slot resolver — the single source of SKU truth for the slot-driven BOM.
 *
 * Each style's slot table is generated from the operator-curated catalogue sheet
 * (scripts/gen-catalogue-slots.py → server/data/slots/<style>.slots.ts). A row carries the
 * 3-tier calslot taxonomy plus the two derived axes (finish, size_mm) that pick the final SKU.
 * The solver resolves every component via `resolveSlot()` instead of constructing/hardcoding
 * SKUs. A miss returns null → the caller surfaces a visible [UNMAPPED] gap (never a guess).
 *
 * See verticals/barrier-hub/calculator/style-validation/glass-pool-spigots-emission-map.md
 * for the binding of each component group → calslot key.
 */
import { GLASS_POOL_SPIGOTS_SLOTS } from "../../data/slots/glass-pool-spigots.slots";
import { GLASS_BAL_SPIGOTS_12MM_SLOTS } from "../../data/slots/glass-bal-spigots-12mm.slots";
import { GLASS_BAL_SPIGOTS_15MM_SLOTS } from "../../data/slots/glass-bal-spigots-15mm.slots";
import { GLASS_POOL_CHANNEL_SLOTS } from "../../data/slots/glass-pool-channel.slots";
import { GLASS_BAL_CHANNEL_SLOTS } from "../../data/slots/glass-bal-channel.slots";
import { GLASS_BAL_CHANNEL_HD_SLOTS } from "../../data/slots/glass-bal-channel-hd.slots";
import { GLASS_BAL_STANDOFFS_SLOTS } from "../../data/slots/glass-bal-standoffs.slots";
import { SIDE_MOUNT_POSTS_SLOTS } from "../../data/slots/side-mount-posts.slots";
import { ALU_POOL_TUBULAR_SLOTS } from "../../data/slots/alu-pool-tubular.slots";
import { ALU_POOL_BARR_SLOTS } from "../../data/slots/alu-pool-barr.slots";
import { ALU_POOL_BLADE_SLOTS } from "../../data/slots/alu-pool-blade.slots";
import { ALU_BAL_BARR_SLOTS } from "../../data/slots/alu-bal-barr.slots";

export type CatalogueSlot = {
  sku: string;
  description: string | null;
  cs1: string | null;
  cs2: string | null;
  cs3: string | null;
  finish: string | null;
  size_mm: number | null;
  price: number | null;
  category_slug: string | null;
};

const STYLE_SLOTS: Record<string, CatalogueSlot[]> = {
  "glass-pool-spigots": GLASS_POOL_SPIGOTS_SLOTS,
  "glass-bal-spigots-12mm": GLASS_BAL_SPIGOTS_12MM_SLOTS,
  "glass-bal-spigots-15mm": GLASS_BAL_SPIGOTS_15MM_SLOTS,
  "glass-pool-channel": GLASS_POOL_CHANNEL_SLOTS,
  "glass-bal-channel": GLASS_BAL_CHANNEL_SLOTS,
  "glass-bal-channel-hd": GLASS_BAL_CHANNEL_HD_SLOTS,
  "glass-bal-standoffs": GLASS_BAL_STANDOFFS_SLOTS,
  // shared (non-dispatched) — alu emitters resolve side-mount from here
  "side-mount-posts": SIDE_MOUNT_POSTS_SLOTS,
  "alu-pool-tubular": ALU_POOL_TUBULAR_SLOTS,
  "alu-pool-barr": ALU_POOL_BARR_SLOTS,
  "alu-pool-blade": ALU_POOL_BLADE_SLOTS,
  "alu-bal-barr": ALU_BAL_BARR_SLOTS,
};

export type SlotQuery = {
  cs1: string;
  /** undefined = don't filter; any value (incl. "" / null) = exact match with null treated as "". */
  cs2?: string | null;
  cs3?: string | null;
  finish?: string | null;
  /** Requested size; when snapSize is true the nearest available size is chosen. */
  size_mm?: number | null;
  snapSize?: boolean;
};

export type SlotMatch = { sku: string; description: string | null; price: number | null; category_slug: string | null };

const norm = (v: string | null | undefined): string => (v == null ? "" : String(v));

/** Resolve a single catalogue SKU for a style. Returns null on a miss (caller surfaces [UNMAPPED]). */
export function resolveSlot(style: string, q: SlotQuery): SlotMatch | null {
  const rows = STYLE_SLOTS[style];
  if (!rows) return null;

  let cand = rows.filter((r) => norm(r.cs1) === norm(q.cs1));
  if (q.cs2 !== undefined) cand = cand.filter((r) => norm(r.cs2) === norm(q.cs2));
  if (q.cs3 !== undefined) cand = cand.filter((r) => norm(r.cs3) === norm(q.cs3));
  if (q.finish !== undefined) cand = cand.filter((r) => norm(r.finish) === norm(q.finish));

  if (q.size_mm != null) {
    const sized = cand.filter((r) => r.size_mm != null);
    if (!sized.length) return null;
    if (q.snapSize) {
      sized.sort((a, b) => Math.abs(a.size_mm! - q.size_mm!) - Math.abs(b.size_mm! - q.size_mm!));
      cand = [sized[0]];
    } else {
      cand = sized.filter((r) => r.size_mm === q.size_mm);
    }
  }

  if (cand.length === 0) return null;
  // Duplicate rows for the same SKU are fine (e.g. a SKU placed under two sub-categories); only
  // DISTINCT SKUs under one key are genuinely ambiguous (under-specified query) → surface that.
  if (new Set(cand.map((c) => c.sku)).size > 1) return null;
  const r = cand[0];
  return { sku: r.sku, description: r.description, price: r.price, category_slug: r.category_slug };
}

/** Available sizes (mm) for a family/sub-type — used by the layout snapper. */
export function availableSizes(style: string, q: Pick<SlotQuery, "cs1" | "cs2" | "cs3" | "finish">): number[] {
  const rows = STYLE_SLOTS[style];
  if (!rows) return [];
  return rows
    .filter((r) => norm(r.cs1) === norm(q.cs1)
      && (q.cs2 === undefined || norm(r.cs2) === norm(q.cs2))
      && (q.cs3 === undefined || norm(r.cs3) === norm(q.cs3))
      && (q.finish === undefined || norm(r.finish) === norm(q.finish)))
    .map((r) => r.size_mm)
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);
}

export function styleHasSlots(style: string): boolean {
  return !!STYLE_SLOTS[style];
}
