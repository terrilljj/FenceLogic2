import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Wrench, Star } from "lucide-react";

export type SpigotFamily =
  | "madrid"
  | "madrid-pool"
  | "insuluxe"
  | "lifestyle-square"
  | "lifestyle-round"
  | "rio";

export type SpigotFinish = "polished" | "satin" | "black" | "white";
export type FixingMethod = "timber" | "concrete";

export interface AccessoryItem {
  id: string;
  sku: string;
  description: string;
  qty: number;
  unitPrice: number | null;
  reason: string;
  tier: "required" | "recommended" | "optional";
}

interface AccessoriesChecklistProps {
  spigotFamily: SpigotFamily;
  spigotFinish: SpigotFinish;
  spigotMounting: "base-plate" | "core-drilled" | "side-mounted";
  as3000Required: boolean;
  fixingMethod: FixingMethod | null;
  spigotCount: number;
  onSelectionChange: (checkedItems: AccessoryItem[]) => void;
}

// Cost prices ex GST from csv_tabs (pool_fence_spigots_and_channel.csv, hinges_and_latches.csv)
const PRICES: Record<string, number> = {
  "MAD-INS-CD-B": 9.13,  "MAD-INS-CD-SG": 9.13, "MAD-INS-CD-W": 9.13,
  "MAD-INS-BP-B": 9.13,  "MAD-INS-BP-SG": 9.13, "MAD-INS-BP-W": 9.13,
  "MAD-DR-P": 3.66,  "MAD-DR-S": 3.66,  "MAD-DR-B": 4.50,  "MAD-DR-MW": 5.29,
  "INS-DR-SG": 2.06, "INS-DR-B": 1.85,  "INS-DR-W": 2.06,
  "LS-DR-P": 3.66,   "LS-DR-S": 3.66,   "LS-DR-B": 4.50,
  "LR-DR-P": 3.37,   "LR-DR-S": 3.37,
  "RIO-DR-P": 3.37,  "RIO-DR-S": 3.37,  "RIO-DR-MW": 5.09,
  "MAD-HDC-P": 5.08, "MAD-HDC-S": 5.08, "MAD-HDC-B": 6.10, "MAD-HDC-MW": 6.62,
  "MAD-SDC-P": 4.30, "MAD-SDC-S": 4.30, "MAD-SDC-B": 5.33, "MAD-SDC-MW": 6.35,
  "INS-HDC-SG": 3.19,"INS-HDC-B": 2.90, "INS-HDC-W": 3.19,
  "RIO-HDC-P": 3.68, "RIO-HDC-S": 3.68, "RIO-HDC-MW": 5.88,
  "S-110LAG-4PK": 8.00,
  "S-120ROD-4PK": 5.55,
  "S-XT": 19.77,
  "INS-XT": 19.77,
};

// Map spigot finish to SKU finish suffix, accounting for per-family finish availability
function getFinishSuffix(family: SpigotFamily, finish: SpigotFinish): string {
  if (family === "insuluxe") {
    if (finish === "black") return "B";
    if (finish === "white") return "W";
    return "SG"; // polished/satin both map to silver grey
  }
  if (family === "rio") {
    if (finish === "white") return "MW";
    if (finish === "black") return "S"; // Rio has no black — fallback to satin
    return finish === "polished" ? "P" : "S";
  }
  // Madrid, Madrid Pool, Lifestyle Square, Lifestyle Round
  if (finish === "white") return "MW";
  if (finish === "black") return "B";
  return finish === "polished" ? "P" : "S";
}

// Map spigot finish to AS-3000 insulator cover suffix (B/SG/W for black/silver/white insulator sleeve)
function getAs3000Suffix(finish: SpigotFinish): string {
  if (finish === "black") return "B";
  if (finish === "white") return "W";
  return "SG"; // polished and satin → silver grey insulator
}

function p(sku: string): number | null {
  return PRICES[sku] ?? null;
}

function deriveAccessories(
  family: SpigotFamily,
  finish: SpigotFinish,
  mounting: "base-plate" | "core-drilled" | "side-mounted",
  as3000: boolean,
  fixingMethod: FixingMethod | null,
  count: number
): AccessoryItem[] {
  if (count <= 0 || mounting === "side-mounted") return [];

  const items: AccessoryItem[] = [];
  const finSuffix = getFinishSuffix(family, finish);

  // ── REQUIRED: AS-3000 insulator covers ──────────────────────────────────
  if (as3000 && (family === "madrid" || family === "madrid-pool")) {
    const prefix = mounting === "core-drilled" ? "MAD-INS-CD" : "MAD-INS-BP";
    const insSuffix = getAs3000Suffix(finish);
    const sku = `${prefix}-${insSuffix}`;
    items.push({
      id: "as3000-cover",
      sku,
      description: `Madrid Insulator Cover — ${mounting === "core-drilled" ? "Core Drill" : "Base Plate"} (${insSuffix})`,
      qty: count,
      unitPrice: p(sku),
      reason: "Required: AS/NZS 3000 equipotential bonding within 1.25m of pool water",
      tier: "required",
    });
  }

  // ── REQUIRED: Substrate fixings ─────────────────────────────────────────
  if (fixingMethod === "timber") {
    items.push({
      id: "fixing-timber",
      sku: "S-110LAG-4PK",
      description: "M10 × 110mm Lag Screws SS316 — 4-pack (Timber Substrate)",
      qty: count,
      unitPrice: p("S-110LAG-4PK"),
      reason: "Required: one pack per spigot for timber substrate installation",
      tier: "required",
    });
  } else if (fixingMethod === "concrete") {
    items.push({
      id: "fixing-concrete-rod",
      sku: "S-120ROD-4PK",
      description: "M10 × 120mm Threaded Rods SS316 — 4-pack (Concrete Substrate)",
      qty: count,
      unitPrice: p("S-120ROD-4PK"),
      reason: "Required: one pack per spigot for concrete substrate installation",
      tier: "required",
    });
    const anchors = Math.ceil(count / 10);
    items.push({
      id: "fixing-concrete-anchor",
      sku: "SOUD-CA1400",
      description: "Soudafix CA140 Chemical Anchor Cartridge",
      qty: anchors,
      unitPrice: null, // Sourcing gap — no cost in csv_tabs yet
      reason: "Required: chemical anchor for concrete core-drilled installation (1 per ~10 spigots)",
      tier: "required",
    });
  }

  // ── RECOMMENDED: Dress rings (core-drilled only) ─────────────────────────
  if (mounting === "core-drilled") {
    let sku = "";
    let desc = "";

    switch (family) {
      case "madrid":
      case "madrid-pool":
        sku = `MAD-DR-${finSuffix}`;
        desc = `Madrid Dress Ring (${finSuffix})`;
        break;
      case "insuluxe":
        sku = `INS-DR-${finSuffix}`;
        desc = `Insuluxe Dress Ring (${finSuffix})`;
        break;
      case "lifestyle-square":
        sku = `LS-DR-${finSuffix}`;
        desc = `Lifestyle Square Dress Ring (${finSuffix})`;
        break;
      case "lifestyle-round":
        sku = `LR-DR-${finSuffix}`;
        desc = `Lifestyle Round Dress Ring (${finSuffix})`;
        break;
      case "rio":
        sku = `RIO-DR-${finSuffix}`;
        desc = `Rio Dress Ring (${finSuffix})`;
        break;
    }

    if (sku) {
      items.push({
        id: "dress-ring",
        sku,
        description: desc,
        qty: count,
        unitPrice: p(sku),
        reason: "Recommended: covers the core-drilled hole for a finished look",
        tier: "recommended",
      });
    }
  }

  // ── RECOMMENDED: Domical covers (base-plate only, excl. Lifestyle Square — included) ──
  if (mounting === "base-plate" && family !== "lifestyle-square") {
    let sku = "";
    let desc = "";

    switch (family) {
      case "madrid":
      case "madrid-pool":
        sku = `MAD-HDC-${finSuffix}`;
        desc = `Madrid High Domical Cover (${finSuffix})`;
        break;
      case "insuluxe":
        sku = `INS-HDC-${finSuffix}`;
        desc = `Insuluxe Domical Cover (${finSuffix})`;
        break;
      case "lifestyle-round":
        // LR-HDC not confirmed stocked — skip for now
        break;
      case "rio":
        sku = `RIO-HDC-${finSuffix}`;
        desc = `Rio Domical Cover (${finSuffix})`;
        break;
    }

    if (sku) {
      items.push({
        id: "domical-cover",
        sku,
        description: desc,
        qty: count,
        unitPrice: p(sku),
        reason: "Recommended: covers the base plate bolt holes for a finished look",
        tier: "recommended",
      });
    }
  }

  // ── OPTIONAL: Spigot extenders ───────────────────────────────────────────
  if (mounting === "core-drilled") {
    const extSku = family === "insuluxe" ? "INS-XT" : "S-XT";
    const extDesc = family === "insuluxe"
      ? "Insuluxe Spigot Extender"
      : "Spigot Extender (Madrid / Lifestyle / Rio)";
    items.push({
      id: "extender",
      sku: extSku,
      description: extDesc,
      qty: count,
      unitPrice: p(extSku),
      reason: "Optional: adds 30mm height when substrate level is above pool coping",
      tier: "optional",
    });
  }

  // ── OPTIONAL: Madrid slimline domical covers (alternative to high) ───────
  if (mounting === "base-plate" && (family === "madrid" || family === "madrid-pool")) {
    const sku = `MAD-SDC-${finSuffix}`;
    items.push({
      id: "slimline-cover",
      sku,
      description: `Madrid Slimline Domical Cover (${finSuffix}) — alternative to high cover`,
      qty: count,
      unitPrice: p(sku),
      reason: "Optional: lower-profile alternative to the standard high domical cover",
      tier: "optional",
    });
  }

  return items;
}

const TIER_CONFIG = {
  required: {
    label: "Required",
    icon: ShieldCheck,
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    defaultChecked: true,
  },
  recommended: {
    label: "Recommended",
    icon: Star,
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    defaultChecked: true,
  },
  optional: {
    label: "Optional",
    icon: Wrench,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    defaultChecked: false,
  },
} as const;

export function AccessoriesChecklist({
  spigotFamily,
  spigotFinish,
  spigotMounting,
  as3000Required,
  fixingMethod,
  spigotCount,
  onSelectionChange,
}: AccessoriesChecklistProps) {
  const allItems = deriveAccessories(
    spigotFamily,
    spigotFinish,
    spigotMounting,
    as3000Required,
    fixingMethod,
    spigotCount
  );

  const [checked, setChecked] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    allItems.forEach((item) => {
      if (TIER_CONFIG[item.tier].defaultChecked) initial.add(item.id);
    });
    return initial;
  });

  // Re-initialise when derived items change (config changed)
  useEffect(() => {
    const next = new Set<string>();
    allItems.forEach((item) => {
      if (TIER_CONFIG[item.tier].defaultChecked) next.add(item.id);
    });
    setChecked(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spigotFamily, spigotFinish, spigotMounting, as3000Required, fixingMethod, spigotCount]);

  // Fire parent callback whenever checked set changes
  useEffect(() => {
    onSelectionChange(allItems.filter((item) => checked.has(item.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (allItems.length === 0) return null;

  const tiers: Array<"required" | "recommended" | "optional"> = ["required", "recommended", "optional"];

  const accessoriesTotal = allItems
    .filter((item) => checked.has(item.id) && item.unitPrice !== null)
    .reduce((sum, item) => sum + item.qty * (item.unitPrice ?? 0), 0);

  return (
    <Card data-testid="accessories-checklist">
      <CardHeader className="pb-3 border-b border-card-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Required &amp; Recommended for Your Install</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Based on {spigotCount} spigots · {spigotMounting === "core-drilled" ? "Core-drilled" : "Base-plated"} · {spigotFamily.replace(/-/g, " ")}
            </p>
          </div>
          {accessoriesTotal > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Selected accessories</p>
              <p className="text-lg font-mono font-semibold">${accessoriesTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">ex GST</p>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {tiers.map((tier) => {
          const tierItems = allItems.filter((item) => item.tier === tier);
          if (tierItems.length === 0) return null;
          const cfg = TIER_CONFIG[tier];
          const Icon = cfg.icon;

          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {cfg.label}
                </span>
                <Badge variant="outline" className={`text-xs ${cfg.badgeClass}`}>
                  {tierItems.length} item{tierItems.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-2">
                {tierItems.map((item) => {
                  const isChecked = checked.has(item.id);
                  const lineTotal =
                    item.unitPrice !== null ? item.qty * item.unitPrice : null;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                        isChecked ? "bg-muted/40 border-border" : "bg-background border-border/50 opacity-60"
                      }`}
                      data-testid={`accessory-${item.id}`}
                    >
                      <Checkbox
                        id={`acc-${item.id}`}
                        checked={isChecked}
                        onCheckedChange={() => toggle(item.id)}
                        className="mt-0.5"
                        data-testid={`checkbox-${item.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Label
                              htmlFor={`acc-${item.id}`}
                              className="text-sm font-medium cursor-pointer leading-snug"
                            >
                              {item.description}
                            </Label>
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                              {item.sku}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">
                              {item.reason}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-mono font-semibold">
                              {item.qty}×
                            </p>
                            {item.unitPrice !== null ? (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  ${item.unitPrice.toFixed(2)} ea
                                </p>
                                <p className="text-sm font-mono font-semibold text-foreground">
                                  ${lineTotal!.toFixed(2)}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-amber-600">Price TBC</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {tier !== "optional" && <Separator className="mt-4" />}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Ticked items will be included in your downloaded component list. Prices shown are cost ex GST — retail pricing applies at checkout.
        </p>
      </CardContent>
    </Card>
  );
}
