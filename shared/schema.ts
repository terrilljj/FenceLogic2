import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Product types
export type ProductType = "glass-pool" | "glass-balustrade" | "aluminium-pool" | "aluminium-balustrade" | "pvc" | "general";

// Product variants
export type ProductVariant = 
  | "glass-pool-spigots" 
  | "glass-pool-channel"
  | "glass-bal-spigots"
  | "glass-bal-channel"
  | "glass-bal-standoffs"
  | "alu-pool-tubular"
  | "alu-pool-barr"
  | "alu-pool-blade"
  | "alu-pool-pik"
  | "alu-bal-barr"
  | "alu-bal-blade"
  | "alu-bal-visor"
  | "pvc-privacy"
  | "general-zeus"
  | "general-blade"
  | "general-barr";

// Channel mounting types (for glass channel systems)
export type ChannelMounting = "wall" | "ground";

// Fence shape types
export type FenceShape = "inline" | "l-shape" | "u-shape" | "enclosed" | "custom";

// Gap position types
export type GapPosition = "inside" | "outside";

// Gate hardware types
export type GateHardware = "master" | "polaris";

// Spigot mounting types
export type SpigotMounting = "base-plate" | "core-drilled" | "side-mounted";

// Spigot color/finish types
export type SpigotColor = "polished" | "satin" | "black" | "white";

// Glass thickness types
export type GlassThickness = "12mm" | "15mm";

// Handrail types
export type HandrailType = "nonorail-25x21" | "nanorail-30x21" | "series-35x35";

// Handrail material types
export type HandrailMaterial = "stainless-steel" | "anodised-aluminium";

// Handrail finish types
export type HandrailFinish = "polished" | "satin" | "black" | "white";

// Glass size constraints by thickness
export const GLASS_CONSTRAINTS = {
  "12mm": {
    minWidth: 300,
    maxWidth: 1500,
    height: 970,
  },
  "15mm": {
    minWidth: 300,
    maxWidth: 1400,
    height: 1000,
  },
};

// Standoff-specific glass constraints (15mm glass with standoff mounting)
export const STANDOFF_GLASS_CONSTRAINTS = {
  minWidth: 400,
  maxWidth: 1200,
  height: 1000,
};

// Helper function to get glass constraints based on variant and thickness
export function getGlassConstraints(variant: ProductVariant, thickness?: GlassThickness) {
  // For standoff balustrades, always use standoff constraints (standoff glass is always 15mm, 400-1200mm)
  if (variant === "glass-bal-standoffs") {
    return STANDOFF_GLASS_CONSTRAINTS;
  }
  
  // For other variants, use standard constraints based on thickness
  if (thickness && GLASS_CONSTRAINTS[thickness]) {
    return GLASS_CONSTRAINTS[thickness];
  }
  
  // Default to 12mm constraints
  return GLASS_CONSTRAINTS["12mm"];
}

// Standoff diameter options
export type StandoffDiameter = "50mm";

// Standoff finish types
export type StandoffFinish = "polished" | "satin" | "black" | "white";

// BARR fencing height options
export type BarrHeight = "1000mm" | "1200mm" | "1800mm";

// BARR fencing finish types
export type BarrFinish = "satin-black" | "pearl-white";

// BARR panel layout modes
export type BarrLayoutMode = "full-panels-cut-end" | "equally-spaced";

// BARR post types
export type BarrPostType = "welded-base-plate" | "standard";

// BARR post mounting for standard posts
export type BarrPostMounting = "inground" | "wall" | "core-drilled";

// BARR panel specifications by height
export const BARR_PANEL_SPECS = {
  "1000mm": {
    height: 1000,
    panelWidth: 1733,
    picketSize: "50x25mm",
    postSize: "50mm", // 50mm posts for balustrade
    postAllowance: 50, // 50mm gap for 50mm posts
    type: "balustrade" as const,
  },
  "1200mm": {
    height: 1200,
    panelWidth: 2205,
    picketSize: "50x25mm",
    postSize: "50x25mm", // 50x25mm posts for pool
    postAllowance: 25, // 25mm gap for 50x25mm posts
    type: "pool" as const,
  },
  "1800mm": {
    height: 1800,
    panelWidth: 1969,
    picketSize: "50x25mm",
    postSize: "50mm", // 50mm posts for 1800 high
    postAllowance: 50, // 50mm gap for 50mm posts
    type: "balustrade" as const,
  },
};

// Hinge types (mounting configurations)
export type HingeType = "glass-to-glass" | "glass-to-wall" | "wall-to-glass";

// Latch types (universal mounting configurations)
export type LatchType = "glass-to-glass" | "glass-to-wall" | "corner-out" | "corner-in";

// Panel size constraints (custom cut in 50mm increments)
export const PANEL_SIZE_MIN = 200; // mm
export const PANEL_SIZE_MAX = 2000; // mm
export const PANEL_SIZE_INCREMENT = 50; // mm
export const MAX_GAP_SIZE = 99; // mm

// Panel type enumeration
export type PanelType = "standard" | "raked" | "gate" | "hinge" | "custom";

// Panel layout calculation result
export type PanelLayout = {
  panels: number[]; // Array of panel widths in mm
  gaps: number[]; // Array of gap sizes in mm (length = panels.length - 1)
  totalPanelWidth: number; // Sum of all panel widths
  totalGapWidth: number; // Sum of all gaps
  averageGap: number; // Average gap size
  panelTypes?: PanelType[]; // Type of each panel (same length as panels array)
};

// Span configuration
export const spanConfigSchema = z.object({
  spanId: z.string(),
  length: z.number().min(0),
  maxPanelWidth: z.number().min(200).max(2000),
  desiredGap: z.number().min(0).max(99), // Target gap - panels will adjust to accommodate
  glassThickness: z.enum(["12mm", "15mm"]).optional(), // Glass thickness selection (defaults handled in UI)
  handrail: z.object({
    enabled: z.boolean(),
    type: z.enum(["nonorail-25x21", "nanorail-30x21", "series-35x35"]),
    material: z.enum(["stainless-steel", "anodised-aluminium"]),
    finish: z.enum(["polished", "satin", "black", "white"]),
  }).optional(), // Top-mounted handrail options
  standoffDiameter: z.enum(["50mm"]).optional(), // Standoff diameter for standoff systems (50mm)
  standoffFinish: z.enum(["polished", "satin", "black", "white"]).optional(), // Standoff finish
  barrHeight: z.enum(["1000mm", "1200mm", "1800mm"]).optional(), // BARR fencing height selection
  barrFinish: z.enum(["satin-black", "pearl-white"]).optional(), // BARR fencing finish
  barrLayoutMode: z.enum(["full-panels-cut-end", "equally-spaced"]).optional(), // BARR panel layout mode
  barrPostType: z.enum(["welded-base-plate", "standard"]).optional(), // BARR post type
  barrPostMounting: z.enum(["inground", "wall", "core-drilled"]).optional(), // BARR post mounting (for standard posts)
  spigotMounting: z.enum(["base-plate", "core-drilled", "side-mounted"]).default("base-plate"),
  spigotColor: z.enum(["polished", "satin", "black", "white"]).default("polished"),
  channelMounting: z.enum(["wall", "ground"]).optional(), // For glass channel systems
  panelLayout: z.object({
    panels: z.array(z.number()),
    gaps: z.array(z.number()),
    totalPanelWidth: z.number(),
    totalGapWidth: z.number(),
    averageGap: z.number(),
    panelTypes: z.array(z.enum(["standard", "raked", "gate", "hinge", "custom"])).optional(),
  }).optional(), // Calculated panel layout
  topGap: z.object({
    enabled: z.boolean(),
    position: z.enum(["inside", "outside"]),
    size: z.number().min(0).max(150),
  }).optional(),
  bottomGap: z.object({
    enabled: z.boolean(),
    position: z.enum(["inside", "outside"]),
    size: z.number().min(0).max(150),
  }).optional(),
  leftGap: z.object({
    enabled: z.boolean(),
    position: z.enum(["inside", "outside"]),
    size: z.number().min(0).max(150),
  }).optional(),
  rightGap: z.object({
    enabled: z.boolean(),
    position: z.enum(["inside", "outside"]),
    size: z.number().min(0).max(150),
  }).optional(),
  gateConfig: z.object({
    required: z.boolean(),
    hardware: z.enum(["master", "polaris"]),
    hingeFrom: z.enum(["glass", "wall"]),
    latchTo: z.enum(["glass", "wall"]),
    hingeType: z.enum(["glass-to-glass", "glass-to-wall", "wall-to-glass"]).default("glass-to-glass"),
    latchType: z.enum(["glass-to-glass", "glass-to-wall", "corner-out", "corner-in"]).default("glass-to-glass"),
    gateSize: z.number(),
    hingePanelSize: z.number(),
    autoHingePanel: z.boolean().default(true), // Auto-match hinge panel to other panel sizes
    position: z.number(),
    flipped: z.boolean(),
    savedGlassPosition: z.number().optional(), // Preserves panel index when switching to wall mode
    hingeGap: z.number(), // Gap on hinge side (varies by hardware and mounting)
    latchGap: z.number(), // Gap on latch side (varies by hardware and mounting)
    postAdapterPlate: z.boolean().default(false), // For Polaris/Atlantic: adds post adapter plate
  }).optional(),
  leftRakedPanel: z.object({
    enabled: z.boolean(),
    height: z.number().refine((val) => [1400, 1500, 1600, 1700, 1800].includes(val), {
      message: "Height must be one of: 1400, 1500, 1600, 1700, 1800",
    }),
  }).optional(),
  rightRakedPanel: z.object({
    enabled: z.boolean(),
    height: z.number().refine((val) => [1400, 1500, 1600, 1700, 1800].includes(val), {
      message: "Height must be one of: 1400, 1500, 1600, 1700, 1800",
    }),
  }).optional(),
  customPanel: z.object({
    enabled: z.boolean(),
    width: z.number().min(200).max(2000), // Custom panel width in mm
    height: z.number().min(1200).max(1800), // Custom panel height in mm
    position: z.number().min(0), // Panel position index (like glass-to-glass gate)
  }).optional(),
});

export type SpanConfig = z.infer<typeof spanConfigSchema>;

// Main fence design configuration
export const fenceDesignSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  productType: z.enum(["glass-pool", "glass-balustrade", "aluminium-pool", "aluminium-balustrade", "pvc", "general"]).default("glass-pool"),
  productVariant: z.enum([
    "glass-pool-spigots", 
    "glass-pool-channel",
    "glass-bal-spigots",
    "glass-bal-channel",
    "glass-bal-standoffs",
    "alu-pool-tubular",
    "alu-pool-barr",
    "alu-pool-blade",
    "alu-pool-pik",
    "alu-bal-barr",
    "alu-bal-blade",
    "alu-bal-visor",
    "pvc-privacy",
    "pvc-picket",
    "pvc-ranch",
    "general-zeus",
    "general-blade",
    "general-barr"
  ]).default("glass-pool-spigots"),
  shape: z.enum(["inline", "l-shape", "u-shape", "enclosed", "custom"]),
  customSides: z.number().min(3).max(10).optional(),
  spans: z.array(spanConfigSchema),
  createdAt: z.date().optional(),
});

export type FenceDesign = z.infer<typeof fenceDesignSchema>;

// Database table for saved designs
export const fenceDesigns = pgTable("fence_designs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  productType: text("product_type").notNull().default("glass-pool"),
  productVariant: text("product_variant").notNull().default("glass-pool-spigots"),
  shape: text("shape").notNull(),
  customSides: integer("custom_sides"),
  spans: jsonb("spans").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertFenceDesignSchema = createInsertSchema(fenceDesigns).omit({
  id: true,
  createdAt: true,
});

export type InsertFenceDesign = z.infer<typeof insertFenceDesignSchema>;
export type SavedFenceDesign = typeof fenceDesigns.$inferSelect;

// Component list item
export const componentSchema = z.object({
  qty: z.number(),
  description: z.string(),
  sku: z.string().optional(),
});

export type Component = z.infer<typeof componentSchema>;

// Helper function to get gate gaps based on hardware and mounting type
export function getGateGaps(hardware: GateHardware, hingeFrom: "glass" | "wall"): { hingeGap: number; latchGap: number } {
  if (hardware === "master") {
    if (hingeFrom === "wall") {
      return { hingeGap: 22, latchGap: 9 };
    } else {
      return { hingeGap: 9, latchGap: 9 };
    }
  } else { // polaris
    if (hingeFrom === "wall") {
      return { hingeGap: 0, latchGap: 9 }; // Wall-mounted: hinge at wall (no gap), latch gap 9mm
    } else {
      return { hingeGap: 8, latchGap: 9 }; // Glass-to-glass: hinge gap 8mm, latch gap 9mm
    }
  }
}

// Helper function to get spigot details
export function getSpigotDetails(mounting: SpigotMounting, color: SpigotColor): { description: string; sku: string } {
  const mountingNames = {
    "base-plate": "Base Plate Mount",
    "core-drilled": "Core Drilled",
    "side-mounted": "Side Mounted",
  };
  
  const colorNames = {
    "polished": "Polished",
    "satin": "Satin",
    "black": "Black",
    "white": "White",
  };
  
  const description = `Spigot ${mountingNames[mounting]} (${colorNames[color]})`;
  const mountingSku = mounting ? mounting.replace(/-/g, "_").toUpperCase() : "BASE_PLATE";
  const colorSku = color ? color.toUpperCase() : "POLISHED";
  const sku = `SPIGOT-${mountingSku}-${colorSku}`;
  
  return { description, sku };
}

// Helper function to get hinge details
export function getHingeDetails(type: HingeType, hardware: GateHardware): { description: string; sku: string } {
  if (hardware === "master") {
    const hingeMap = {
      "glass-to-glass": { description: "Master Range Glass-to-Glass Hinge Set", sku: "HINGE-MASTER-G2G" },
      "glass-to-wall": { description: "Master Range Glass-to-Wall/Post Hinge Set", sku: "HINGE-MASTER-G2W" },
      "wall-to-glass": { description: "Master Range Glass-to-Wall/Post Hinge Set", sku: "HINGE-MASTER-G2W" }, // Same as glass-to-wall for Master
    };
    return hingeMap[type];
  } else {
    // Polaris/Atlantic
    const hingeMap = {
      "glass-to-glass": { description: "Polaris/Atlantic Glass-to-Glass Hinge Set", sku: "HINGE-POLARIS-G2G" },
      "wall-to-glass": { description: "Polaris/Atlantic Wall-to-Glass Hinge Set", sku: "HINGE-POLARIS-W2G" },
      "glass-to-wall": { description: "Polaris/Atlantic Glass-to-Glass Hinge Set", sku: "HINGE-POLARIS-G2G" }, // Not used for Polaris, fallback
    };
    return hingeMap[type];
  }
}

// Helper function to get latch details
export function getLatchDetails(type: LatchType): { description: string; sku: string } {
  const latchMap = {
    "glass-to-glass": { description: "Glass-to-Glass Latch", sku: "LATCH-G2G" },
    "glass-to-wall": { description: "Glass-to-Wall/Post Latch", sku: "LATCH-G2W" },
    "corner-out": { description: "Corner Out Latch", sku: "LATCH-CORNER-OUT" },
    "corner-in": { description: "Corner In Latch", sku: "LATCH-CORNER-IN" },
  };
  return latchMap[type];
}
