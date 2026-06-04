/**
 * Step-1 section builder data: the launch STYLES and, per style, the ATTACHMENT options.
 * DRAFT — attachment sets are read off the existing configs/schema; the operator will correct
 * (esp. BARR / Flat Top in-ground + side-mount, which aren't fully exposed in the configs yet).
 *
 * Attachment is style-dependent and writes to different span fields per family, so each style's
 * config carries how to READ and WRITE the choice (a top-level span field, or a fieldValues key).
 */
import type { SpanConfig } from "@shared/schema";

export type StyleUse = "pool" | "balustrade";

export interface StyleOption {
  id: string;            // ProductVariant
  label: string;
  use: StyleUse;         // Pool Fence vs Balustrade — the first pick in the style picker
  group: "glass" | "aluminium";
  image?: string;        // home-page photo (glass styles); aluminium uses an icon
}

// The 12 V1 launch styles, in the home-page order. `use` separates Pool Fence from
// Balustrade so the picker can gate by application first (you can't cross-pick a bal
// style onto a pool run and have to restart the config).
export const STYLE_OPTIONS: StyleOption[] = [
  { id: "glass-pool-spigots", label: "Frameless", use: "pool", group: "glass", image: "/styles/frameless-pool-fence.png" },
  { id: "glass-pool-channel", label: "Channel", use: "pool", group: "glass", image: "/styles/channel-pool-fence.png" },
  { id: "alu-pool-tubular", label: "Flat Top", use: "pool", group: "aluminium" },
  { id: "alu-pool-barr", label: "BARR", use: "pool", group: "aluminium" },
  { id: "alu-pool-blade", label: "Blade", use: "pool", group: "aluminium" },
  { id: "glass-bal-spigots-12mm", label: "Frameless 12mm", use: "balustrade", group: "glass", image: "/styles/frameless-balustrade-12mm.png" },
  { id: "glass-bal-spigots-15mm", label: "Frameless 15mm", use: "balustrade", group: "glass", image: "/styles/frameless-balustrade-15mm.png" },
  { id: "glass-bal-channel", label: "Channel 15mm", use: "balustrade", group: "glass", image: "/styles/versatilt-channel-15mm.png" },
  { id: "glass-bal-channel-hd", label: "Channel HD 17.52", use: "balustrade", group: "glass", image: "/styles/versatilt-channel-hd-17-52mm.png" },
  { id: "glass-bal-standoffs", label: "Standoff", use: "balustrade", group: "glass", image: "/styles/standoff-balustrade.png" },
  { id: "alu-bal-barr", label: "BARR", use: "balustrade", group: "aluminium" },
  { id: "alu-bal-blade", label: "Blade", use: "balustrade", group: "aluminium" },
];

export function styleLabel(variant: string): string {
  return STYLE_OPTIONS.find((s) => s.id === variant)?.label ?? variant;
}
export function styleImage(variant: string): string | undefined {
  return STYLE_OPTIONS.find((s) => s.id === variant)?.image;
}
/** Label with its application, for the row chip / Joe where there's no use-tab for context. */
export function styleFullLabel(variant: string): string {
  const s = STYLE_OPTIONS.find((o) => o.id === variant);
  if (!s) return variant;
  return `${s.label} ${s.use === "pool" ? "Pool" : "Balustrade"}`;
}
export function styleUse(variant: string): StyleUse {
  return STYLE_OPTIONS.find((s) => s.id === variant)?.use ?? (variant.includes("-pool") ? "pool" : "balustrade");
}
export function stylesForUse(use: StyleUse): StyleOption[] {
  return STYLE_OPTIONS.filter((s) => s.use === use);
}

export type AttachmentIcon = "core-drill" | "base-plate" | "side-mount" | "deck" | "face" | "in-ground" | "concrete" | "timber" | "steel";

export interface AttachmentOption {
  value: string;
  label: string;
  blurb: string;
  icon: AttachmentIcon;
}

/** How a style reads/writes its attachment + the available options. null = no attachment step. */
export interface AttachmentConfig {
  options: AttachmentOption[];
  current: (span: SpanConfig) => string | undefined;
  write: (value: string) => Partial<SpanConfig>;
}

const SPIGOT_MOUNTS: AttachmentOption[] = [
  { value: "core-drilled", label: "Core-drill", blurb: "Set into a cored hole in concrete", icon: "core-drill" },
  { value: "base-plate", label: "Base-plate", blurb: "Bolt-down on a slab or deck", icon: "base-plate" },
  { value: "side-mounted", label: "Side-mount", blurb: "Fixed to a vertical fascia / edge", icon: "side-mount" },
];
const CHANNEL_MOUNTS: AttachmentOption[] = [
  { value: "ground", label: "Deck mount", blurb: "Channel sits on top of the deck / slab", icon: "deck" },
  { value: "wall", label: "Face mount", blurb: "Channel bolts to a vertical edge", icon: "face" },
];
const SUBSTRATES: AttachmentOption[] = [
  { value: "concrete", label: "Concrete", blurb: "Cored or chem-anchored into concrete", icon: "concrete" },
  { value: "timber", label: "Timber", blurb: "Lag-screwed into structural timber", icon: "timber" },
  { value: "steel", label: "Steel", blurb: "Bolted to steel (you supply fixings)", icon: "steel" },
];
// DRAFT — operator to confirm the real aluminium pool attachment set (in-ground / side-mount).
const ALU_POOL_MOUNTS: AttachmentOption[] = [
  { value: "decking", label: "Deck", blurb: "Base-plated to decking / slab", icon: "deck" },
  { value: "core-drilled", label: "Core-drill", blurb: "Posts grouted into cored concrete", icon: "core-drill" },
  { value: "inground", label: "In-ground", blurb: "Posts set into the ground / footing", icon: "in-ground" },
  { value: "side-mounted", label: "Side-mount", blurb: "Posts fixed to a vertical edge / wall", icon: "side-mount" },
];
const ALU_BAL_MOUNTS: AttachmentOption[] = [
  { value: "base-plated", label: "Base-plate", blurb: "Bolt-down on a slab / deck", icon: "base-plate" },
  { value: "core-drilled", label: "Core-drill", blurb: "Posts grouted into cored concrete", icon: "core-drill" },
  { value: "face-mounted", label: "Face-mount", blurb: "Posts fixed to a vertical edge", icon: "face" },
];

/** fieldValues substrate key for the aluminium pool families. */
function aluPoolKey(variant: string): string {
  if (variant.includes("barr")) return "barr-substrate";
  if (variant.includes("blade")) return "blade-substrate";
  return "tubular-substrate";
}

export function attachmentConfigFor(variant: string): AttachmentConfig | null {
  // Glass spigots → spigotMounting (top-level span field)
  if (variant.startsWith("glass-pool-spigots") || variant.startsWith("glass-bal-spigots")) {
    return {
      options: SPIGOT_MOUNTS,
      current: (s) => s.spigotMounting,
      write: (v) => ({ spigotMounting: v as SpanConfig["spigotMounting"] }),
    };
  }
  // Glass channel → channelMounting
  if (variant.includes("-channel")) {
    return {
      options: CHANNEL_MOUNTS,
      current: (s) => s.channelMounting,
      write: (v) => ({ channelMounting: v as SpanConfig["channelMounting"] }),
    };
  }
  // Glass standoffs → substrate (fixing surface)
  if (variant === "glass-bal-standoffs") {
    return {
      options: SUBSTRATES,
      current: (s) => s.spigotSubstrate,
      write: (v) => ({ spigotSubstrate: v as SpanConfig["spigotSubstrate"] }),
    };
  }
  // Aluminium balustrade → fieldValues['bal-substrate']
  if (variant.startsWith("alu-bal")) {
    return {
      options: ALU_BAL_MOUNTS,
      current: (s) => s.fieldValues?.["bal-substrate"] as string | undefined,
      write: (v) => ({ fieldValues: { "bal-substrate": v } } as Partial<SpanConfig>),
    };
  }
  // Aluminium pool → fieldValues['{family}-substrate']
  if (variant.startsWith("alu-pool")) {
    const key = aluPoolKey(variant);
    return {
      options: ALU_POOL_MOUNTS,
      current: (s) => s.fieldValues?.[key] as string | undefined,
      write: (v) => ({ fieldValues: { [key]: v } } as Partial<SpanConfig>),
    };
  }
  return null;
}
