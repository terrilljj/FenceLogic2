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
