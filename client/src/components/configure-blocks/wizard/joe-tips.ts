import type { Tip } from "./tips-panel";
import type { SpanConfig } from "@shared/schema";

/**
 * Joe's contextual tips — sourced from his trained corpus
 * (vault: joe-product-corpus-v1.md), surfaced per wizard step/field.
 *
 * Keep these in Joe's voice: direct, plain-language, Australian, honest about
 * trade-offs, no fluff, no "consult a professional" copout. When the live
 * /api/joe chat lands, these become Joe's opening context, not his only output.
 */

// ── Step 1 — measuring guidance ──────────────────────────────────────────────
export const STEP1_MEASURE_TIPS: Tip[] = [
  {
    title: "Measure to the centre line",
    body:
      "Take each section's length along the centre line of the fence — about 100mm in from the slab or deck edge, where the glass sits on the spigots. Too close to the edge and the spigot can let go under load.",
  },
  {
    title: "Account for end gaps",
    body:
      "Decide if you need a gap at the wall or corner at each end of a section. You'll set the exact left and right gaps in the next step.",
  },
  {
    title: "Where sections meet",
    body:
      "At a corner where two sections join, only one of them needs an end gap — don't count the junction twice.",
  },
];

export const STEP1_FOOTNOTE =
  "Before installing a pool fence, check site-specific requirements with a certifier, engineer or your local authority.";

// ── Step 3 — review / finishing upsells ──────────────────────────────────────
export const STEP3_REVIEW_TIPS: Tip[] = [
  {
    title: "Finish the spigot bases",
    body:
      "Grab a pack of dress rings — they hide the bolt heads and stop water pooling around the base. Everyone needs them, hardly anyone remembers to ask.",
  },
  {
    title: "Keep the glass clear",
    body:
      "EnduroShield on the panels cuts cleaning and keeps the glass clear near the pool. Worth it if you want it looking new in five years.",
  },
  {
    title: "Open your delivery within 7 days",
    body:
      "When the panels arrive, unpack and photograph any damage within a week — even if you're not installing yet. That's how we sort any issue fast, with both ends documented.",
  },
];

// ── Step 2 — configuration, reacts to the active section ─────────────────────
export function step2Tips(productVariant: string, span: SpanConfig): Tip[] {
  const tips: Tip[] = [];
  const fv = (span.fieldValues ?? {}) as Record<string, unknown>;
  const isPool = productVariant === "glass-pool-spigots";
  const is15 = productVariant.includes("15mm");
  const is12 = productVariant.includes("12mm");
  const as3000 = fv["as-3000"] === "true";
  const gateOn = span.gateConfig?.required === true;
  const softClose = span.gateConfig?.hardware === "polaris";
  const railOn = span.handrail?.enabled === true;

  if (isPool) {
    tips.push({
      title: "Choosing a spigot family",
      body:
        "Madrid covers about 95% of pool installs and meets AS 1926.1 across the board — it's the safe default. Reach for Insuluxe only if you want the non-conductive AS-3000 angle.",
    });
  } else if (is12) {
    tips.push({
      title: "12mm is back",
      body:
        "12mm balustrade is compliant for most residential under AS 1288 + NCC Volume 2 — you don't need 15mm for everything. It's lighter and easier to handle solo.",
    });
  } else if (is15) {
    tips.push({
      title: "When you need 15mm",
      body:
        "15mm is the premium balustrade glass — use it for taller runs, long unsupported spans, or commercial. It's heavier with tighter tolerances, so an extra pair of hands helps.",
    });
  }

  if (as3000) {
    tips.push({
      title: "AS 3000 earthing on",
      body:
        "With AS 3000 compliance on I've filtered to the non-conductive spigot families — that's the safe set around pool electrical zones.",
    });
  }

  tips.push({
    title: "Base-plate vs core-fill",
    body:
      "Base-plate suits fixing onto existing pavers or a finished slab. Core-fill needs at least 100mm of solid concrete — too shallow and the spigot won't hold under load.",
  });

  if (gateOn) {
    tips.push({
      title: "Gate compliance",
      body:
        "The gate must be self-closing and self-latching, with the latch on the pool side, and it swings away from the pool." +
        (softClose
          ? " Good call on soft-close — noisy gates are the #1 complaint after install."
          : " Worth knowing: soft-close hinges fix the most common post-install gripe — gate noise."),
    });
  }

  if (railOn && (is12 || is15)) {
    tips.push({
      title: "Top rail",
      body:
        "A top-mounted rail gives a graspable edge and a more solid look. The 35 Series runs anodised aluminium; on 12mm the 25x21 is the slimline option.",
    });
  }

  return tips;
}
