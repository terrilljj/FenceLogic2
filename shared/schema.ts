import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Product types
export type ProductType = "glass-pool" | "glass-balustrade" | "aluminium-pool" | "aluminium-balustrade" | "pvc" | "general" | "custom";

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
  | "pvc-hamptons-full-privacy"
  | "pvc-hamptons-combo"
  | "pvc-hamptons-vertical-paling"
  | "pvc-hamptons-semi-privacy"
  | "pvc-hamptons-3rail"
  | "general-zeus"
  | "general-blade"
  | "general-barr"
  | "custom-panel-designer"
  | "custom-glass"
  | "custom-frameless";

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

// Rail termination types (for top-mounted rails on balustrades)
export type RailTerminationType = "end-cap" | "wall-tie" | "90-degree" | "adjustable-corner";

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

// Blade fencing height options
export type BladeHeight = "1000mm" | "1200mm";

// Blade fencing finish types
export type BladeFinish = "satin-black" | "pearl-white";

// Blade panel layout modes
export type BladeLayoutMode = "full-panels-cut-end" | "equally-spaced";

// Blade post types
export type BladePostType = "welded-base-plate" | "standard";

// Blade post mounting for standard posts
export type BladePostMounting = "inground" | "wall" | "core-drilled";

// Tubular Flat Top fencing height options
export type TubularHeight = "1200mm" | "900mm";

// Tubular fencing finish types
export type TubularFinish = "black" | "white" | "monument";

// Tubular panel width options
export type TubularPanelWidth = "2450mm" | "3000mm";

// Tubular panel layout modes
export type TubularLayoutMode = "full-panels-cut-end" | "equally-spaced";

// Tubular post types
export type TubularPostType = "welded-base-plate" | "standard";

// Tubular post mounting for standard posts
export type TubularPostMounting = "inground" | "wall" | "core-drilled";

// Tubular panel specifications by height and width
export const TUBULAR_PANEL_SPECS = {
  "1200mm": {
    height: 1200,
    widths: {
      "2450mm": 2450,
      "3000mm": 3000,
    },
    picketDiameter: "16mm",
    railSize: "38x25mm",
    postSize: "50mm",
    postAllowance: 50, // 50mm gap for 50mm posts
    type: "pool" as const,
  },
  "900mm": {
    height: 900,
    widths: {
      "2450mm": 2450,
      "3000mm": 3000,
    },
    picketDiameter: "16mm",
    railSize: "38x25mm",
    postSize: "50mm",
    postAllowance: 50, // 50mm gap for 50mm posts
    type: "non-pool" as const,
  },
};

// Blade panel specifications by height
export const BLADE_PANEL_SPECS = {
  "1000mm": {
    height: 1000,
    panelWidth: 1700,
    bladeSize: "50x16mm",
    postSize: "50x50mm",
    railSize: "40x40mm",
    postAllowance: 50, // 50mm gap for 50x50mm posts
    type: "pool" as const,
  },
  "1200mm": {
    height: 1200,
    panelWidth: 2200,
    bladeSize: "50x16mm",
    postSize: "50x50mm",
    railSize: "40x40mm",
    postAllowance: 50, // 50mm gap for 50x50mm posts
    type: "pool" as const,
  },
};

// Hamptons PVC style types
export type HamptonsStyle = 
  | "full-privacy" 
  | "combo" 
  | "vertical-paling" 
  | "semi-privacy" 
  | "3rail";

// Hamptons PVC finish types
export type HamptonsFinish = "white" | "almond" | "clay";

// Hamptons PVC layout modes
export type HamptonsLayoutMode = "full-panels-cut-end" | "equally-spaced";

// Hamptons PVC post types
export type HamptonsPostType = "1-way" | "2-way" | "90-degree" | "gate-post";

// Hamptons PVC panel specifications by style
export const HAMPTONS_PANEL_SPECS = {
  "full-privacy": {
    height: 1800,
    panelWidth: 2388,
    postSize: "127mm",
    postAllowance: 127, // 127mm square posts
    gateWidth: 1000,
    description: "Full Privacy Fencing - solid vertical slats",
  },
  "combo": {
    height: 1800,
    panelWidth: 2388,
    postSize: "127mm",
    postAllowance: 127,
    gateWidth: 1000,
    description: "Combo Fencing - Cowgirl/Slat Topper style",
  },
  "vertical-paling": {
    height: 1800,
    panelWidth: 2388,
    postSize: "127mm",
    postAllowance: 127,
    gateWidth: 1000,
    description: "Vertical Paling - ideal for front/boundary fencing",
  },
  "semi-privacy": {
    height: 1000,
    panelWidth: 2388,
    postSize: "127mm",
    postAllowance: 127,
    gateWidth: 1000,
    description: "Semi Privacy - ideal for front/boundary fencing",
  },
  "3rail": {
    height: 1525, // Adjustable 1000-1500mm
    panelWidth: 2388,
    postSize: "127mm",
    postAllowance: 127,
    gateWidth: 1000,
    description: "3 Rail Fencing - ideal for front/boundary fencing",
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
    startTermination: z.enum(["end-cap", "wall-tie", "90-degree", "adjustable-corner"]).optional(),
    endTermination: z.enum(["end-cap", "wall-tie", "90-degree", "adjustable-corner"]).optional(),
  }).optional(), // Top-mounted handrail options
  standoffDiameter: z.enum(["50mm"]).optional(), // Standoff diameter for standoff systems (50mm)
  standoffFinish: z.enum(["polished", "satin", "black", "white"]).optional(), // Standoff finish
  barrHeight: z.enum(["1000mm", "1200mm", "1800mm"]).optional(), // BARR fencing height selection
  barrFinish: z.enum(["satin-black", "pearl-white"]).optional(), // BARR fencing finish
  barrLayoutMode: z.enum(["full-panels-cut-end", "equally-spaced"]).optional(), // BARR panel layout mode
  barrPostType: z.enum(["welded-base-plate", "standard"]).optional(), // BARR post type
  barrPostMounting: z.enum(["inground", "wall", "core-drilled"]).optional(), // BARR post mounting (for standard posts)
  bladeHeight: z.enum(["1000mm", "1200mm"]).optional(), // Blade fencing height selection
  bladeFinish: z.enum(["satin-black", "pearl-white"]).optional(), // Blade fencing finish
  bladeLayoutMode: z.enum(["full-panels-cut-end", "equally-spaced"]).optional(), // Blade panel layout mode
  bladePostType: z.enum(["welded-base-plate", "standard"]).optional(), // Blade post type
  bladePostMounting: z.enum(["inground", "wall", "core-drilled"]).optional(), // Blade post mounting (for standard posts)
  tubularHeight: z.enum(["1200mm", "900mm"]).optional(), // Tubular fencing height selection
  tubularFinish: z.enum(["black", "white", "monument"]).optional(), // Tubular fencing finish
  tubularPanelWidth: z.enum(["2450mm", "3000mm"]).optional(), // Tubular panel width selection
  tubularLayoutMode: z.enum(["full-panels-cut-end", "equally-spaced"]).optional(), // Tubular panel layout mode
  tubularPostType: z.enum(["welded-base-plate", "standard"]).optional(), // Tubular post type
  tubularPostMounting: z.enum(["inground", "wall", "core-drilled"]).optional(), // Tubular post mounting (for standard posts)
  hamptonsStyle: z.enum(["full-privacy", "combo", "vertical-paling", "semi-privacy", "3rail"]).optional(), // Hamptons PVC style selection
  hamptonsFinish: z.enum(["white", "almond", "clay"]).optional(), // Hamptons PVC finish
  hamptonsLayoutMode: z.enum(["full-panels-cut-end", "equally-spaced"]).optional(), // Hamptons panel layout mode
  hamptonsPostType: z.enum(["1-way", "2-way", "90-degree", "gate-post"]).optional(), // Hamptons post type
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
  layoutMode: z.enum(["auto-equalize", "fully-custom", "auto-calc"]).default("auto-equalize"), // Layout calculation mode
  customLayout: z.object({
    panels: z.array(z.object({
      widthMm: z.number().min(200).max(2000),
      heightMm: z.number().min(1200).max(1800).optional(),
    })),
    gaps: z.array(z.object({
      beforeMm: z.number().min(6).max(30),
    })),
    enforceExactFit: z.boolean().default(true),
  }).optional(), // Fully custom panel layout (user specifies each panel individually)
  autoCalcConfig: z.object({
    maxPanelWidth: z.number().min(500).max(2000),
    panelHeight: z.number().min(1200).max(1800).default(1500), // Standard panel height
    glassType: z.enum(["12mm", "15mm"]).default("12mm"), // Glass thickness
    interPanelGaps: z.array(z.number().min(6).max(30)), // Exact gap values between panels
    panelTypes: z.array(z.enum(["standard", "gate", "hinge", "raked"])), // Type for each panel position
    panelWidthOverrides: z.record(z.number()).optional(), // Optional width overrides for specific panels (index -> width)
    gateConfigs: z.array(z.object({
      position: z.number(), // Index of the gate panel
      widthMm: z.number().optional(), // Fixed width if specified
      hardwareType: z.string().optional(),
    })).optional(),
    hingeConfigs: z.array(z.object({
      position: z.number(), // Index of the hinge panel
      widthMm: z.number().optional(), // Fixed width if specified
    })).optional(),
  }).optional(), // Auto-calc configuration (custom-frameless variant)
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
    "pvc-hamptons-full-privacy",
    "pvc-hamptons-combo",
    "pvc-hamptons-vertical-paling",
    "pvc-hamptons-semi-privacy",
    "pvc-hamptons-3rail",
    "general-zeus",
    "general-blade",
    "general-barr",
    "custom-panel-designer",
    "custom-glass",
    "custom-frameless"
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

// Product categories - exactly matching the 14 calculators from home navigation
export const PRODUCT_CATEGORIES = [
  "Frameless Pool Fence",
  "Channel Pool Fence", 
  "Flat Top Pool Fence",
  "BARR Pool Fence",
  "Blade Pool Fence",
  "Hamptons Full Privacy",
  "Hamptons Combo",
  "Hamptons Vertical Paling",
  "Hamptons Semi Privacy",
  "Hamptons 3 Rail",
  "Frameless Balustrade",
  "Channel Balustrade",
  "Standoff Balustrade",
  "Aluminium Balustrade"
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

// Product subcategories for classification
export const PRODUCT_SUBCATEGORIES = [
  "Spigots",
  "Channel",
  "Standoffs",
  "BARR",
  "Blade",
  "Tubular",
  "PIK",
  "Visor",
  "Zeus",
  "Full Privacy",
  "Combo",
  "Vertical Paling",
  "Semi Privacy",
  "3 Rail",
  "NanoRail",
  "NonoRail",
  "Series 35"
] as const;

export type ProductSubcategory = typeof PRODUCT_SUBCATEGORIES[number];

// Product catalog table for managing product codes and descriptions
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 100 }).notNull().unique(),
  selectionId: varchar("selection_id", { length: 150 }).unique(), // Unique identifier for UI selection mapping (e.g., "pool_fencing_frameless_raked_panels")
  categoryPaths: text("category_paths").array(), // Hierarchical paths (e.g., ["pool_fence/frameless/glass_panels", "balustrade/frameless/glass_panels"])
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  price: text("price"), // Stored as text to allow flexible formatting
  weight: text("weight"), // Product weight (e.g., "5kg", "12.5 lbs")
  dimensions: text("dimensions"), // Product dimensions (e.g., "1200mm x 100mm x 50mm")
  units: text("units"), // Unit of measure (e.g., "each", "meter", "set")
  tags: text("tags").array(), // Product tags/keywords for categorization
  notes: text("notes"), // Internal notes/comments
  imageUrl: text("image_url"), // Product image URL
  active: integer("active").notNull().default(1), // 1 = active, 0 = inactive
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
}).extend({
  category: z.enum(PRODUCT_CATEGORIES).optional().or(z.literal("")),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

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

// Rail optimization for 5800mm standard lengths
export type RailOptimization = {
  totalLength: number; // Total length required in mm
  standardLengths: number; // Number of 5800mm lengths needed
  cuts: number[]; // Array of cut lengths from each standard length
  wastage: number; // Total wastage in mm
};

// Helper function to optimize rail lengths (5800mm standard) to minimize wastage
export function optimizeRailLengths(spanLengths: number[]): RailOptimization {
  const STANDARD_LENGTH = 5800; // mm
  const totalLength = spanLengths.reduce((sum, len) => sum + len, 0);
  
  // Simple optimization: try to fit as many spans as possible into each standard length
  const standardLengths: number[] = [];
  const cuts: number[] = [];
  let remainingSpans = [...spanLengths].sort((a, b) => b - a); // Sort descending for better packing
  
  while (remainingSpans.length > 0) {
    let currentLength = STANDARD_LENGTH;
    const currentCuts: number[] = [];
    
    // Try to fit spans into current standard length
    for (let i = remainingSpans.length - 1; i >= 0; i--) {
      if (remainingSpans[i] <= currentLength) {
        currentCuts.push(remainingSpans[i]);
        currentLength -= remainingSpans[i];
        remainingSpans.splice(i, 1);
      }
    }
    
    standardLengths.push(STANDARD_LENGTH);
    cuts.push(...currentCuts);
    
    // If no spans were added in this iteration, take the first remaining span
    if (currentCuts.length === 0 && remainingSpans.length > 0) {
      cuts.push(remainingSpans[0]);
      standardLengths.push(STANDARD_LENGTH);
      remainingSpans.shift();
    }
  }
  
  const totalStandardLength = standardLengths.reduce((sum, len) => sum + len, 0);
  const wastage = totalStandardLength - totalLength;
  
  return {
    totalLength,
    standardLengths: standardLengths.length,
    cuts,
    wastage,
  };
}

// UI Input Field Configuration Types
export type UIInputField = 
  | "section-length"
  | "left-gap"
  | "right-gap"
  | "max-panel-width"
  | "desired-gap"
  | "gate-config"
  | "raked-panels"
  | "custom-panel"
  | "glass-thickness"
  | "top-rail"
  | "spigot-hardware"
  | "channel-hardware"
  | "panel-height"
  | "finish"
  | "layout-mode"
  | "post-type"
  | "gate-width-mm"
  | "hinge-panel-width-mm";

// Base field config properties
export interface BaseUIFieldConfig {
  enabled: boolean;
  position: number;
  label?: string;
  tooltip?: string;
}

// Unified field config (backward compatible)
export interface UIFieldConfig extends BaseUIFieldConfig {
  type?: "standard" | "number"; // Optional for backward compatibility
  field: UIInputField;
  // Standard field properties
  defaultValue?: any;
  options?: string[]; // For dropdown fields
  optionPaths?: Record<string, string[]>; // Maps dropdown option to category paths (e.g., "12mm" → ["pool_fence/frameless/glass_panels"])
  categoryPaths?: string[]; // For toggle/other fields - array of associated category paths
  // Legacy fields (deprecated, use categoryPaths instead)
  optionProducts?: Record<string, string[]>; // Maps dropdown option to product codes (DEPRECATED)
  products?: string[]; // For toggle/other fields - array of associated product codes (DEPRECATED)
  // Numeric field properties (for type="number")
  unit?: "mm";
  default?: number; // For numeric fields
  min?: number;
  max?: number;
  step?: number;
  tolerance?: number; // Used to snap to nearest SKU (numeric fields only)
  context?: "gate" | "hinge"; // Informs resolver which catalog to use (numeric fields only)
  subcategory?: string; // e.g., "Gate Master", "Hinge Panels Master" (numeric fields only)
}

// Unified Zod schema for UI field config (backward compatible)
export const UIFieldConfigSchema = z.object({
  type: z.enum(["standard", "number"]).optional(),
  field: z.string(),
  enabled: z.boolean(),
  position: z.number(),
  label: z.string().optional(),
  tooltip: z.string().optional(),
  // Standard field properties
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(),
  optionPaths: z.record(z.array(z.string())).optional(),
  categoryPaths: z.array(z.string()).optional(),
  optionProducts: z.record(z.array(z.string())).optional(),
  products: z.array(z.string()).optional(),
  // Numeric field properties
  unit: z.literal("mm").optional(),
  default: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  tolerance: z.number().nonnegative().optional(),
  context: z.enum(["gate", "hinge"]).optional(),
  subcategory: z.string().optional(),
}).refine(data => {
  // Validate min <= max if both are provided
  if (data.min !== undefined && data.max !== undefined && data.min > data.max) {
    return false;
  }
  return true;
}, {
  message: "min must be less than or equal to max"
}).refine(data => {
  // Validate step > 0 if provided (for numeric fields)
  if (data.type === "number" && data.step !== undefined && data.step <= 0) {
    return false;
  }
  return true;
}, {
  message: "step must be positive for numeric fields"
}).refine(data => {
  // Validate tolerance >= 0 if provided (for numeric fields)
  if (data.type === "number" && data.tolerance !== undefined && data.tolerance < 0) {
    return false;
  }
  return true;
}, {
  message: "tolerance must be non-negative for numeric fields"
});

// Product UI Configuration table
export const productUIConfigs = pgTable("product_ui_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productVariant: varchar("product_variant").notNull().unique(),
  fieldConfigs: jsonb("field_configs").$type<UIFieldConfig[]>().notNull().default([]),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull().default([]),
  allowedSubcategories: jsonb("allowed_subcategories").$type<string[]>().notNull().default([]),
  updatedAt: varchar("updated_at").notNull().default(sql`now()::text`),
});

export const insertProductUIConfigSchema = createInsertSchema(productUIConfigs).omit({
  id: true,
  updatedAt: true,
});

export type InsertProductUIConfig = z.infer<typeof insertProductUIConfigSchema>;
export type ProductUIConfig = typeof productUIConfigs.$inferSelect;

// Categories table for dynamic category management
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: varchar("created_at").notNull().default(sql`now()::text`),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Subcategories table for dynamic subcategory management
export const subcategories = pgTable("subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: varchar("created_at").notNull().default(sql`now()::text`),
});

export const insertSubcategorySchema = createInsertSchema(subcategories).omit({
  id: true,
  createdAt: true,
});

export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
