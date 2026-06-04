import type { Tip } from "./tips-panel";
import { styleFullLabel } from "@/lib/style-attachments";

/**
 * Dynamic Joe guidance for Step 1 (section builder). Reacts to the selected section's
 * style and the field the user is touching (style / a specific attachment). Help lives
 * here, not in the rows — the rows stay visual and light.
 */

// THE rule users won't know on their own — a section is one continuous run of the SAME
// style AND the SAME surface. Always surfaced.
export const SPLIT_SECTION_TIP: Tip = {
  title: "When to split into separate sections",
  body:
    "A section is one continuous run of the SAME style on the SAME surface. If an 8m run is 5m glass on concrete and 3m aluminium across a garden bed — that's TWO sections. If a flat run goes from deck onto concrete, split it where the surface changes. Same line, different build = different section.",
};

const STYLE_TIP: Tip = {
  title: "Pick the style for this section",
  body:
    "Each run can be its own style — frameless glass, channel, standoff, or aluminium (Flat Top, BARR, Blade). Mix them freely: glass along the pool, BARR down the side. You'll set finish and panel details in the next step.",
};

const ATTACH_TIPS: Record<string, Tip> = {
  "core-drilled": {
    title: "Core-drilled",
    body: "My pick on a solid concrete slab — the spigot or post grouts straight into a cored hole for the cleanest, strongest result. Needs sound concrete to core into; not for decks or thin toppings.",
  },
  "base-plate": {
    title: "Base-plated",
    body: "On a deck — or any finished surface you don't want to core — use a base-plated spigot. It bolts straight down, no coring needed, and it's my go-to for timber decks and new slabs with a tiled or paved finish.",
  },
  "base-plated": {
    title: "Base-plated",
    body: "On a deck or finished slab, base-plate the posts — they bolt straight down, no coring needed. My go-to for timber decks and tiled/paved slabs.",
  },
  "face-mounted": {
    title: "Face-mounted",
    body: "Face-mount the posts to a vertical edge (a fascia or the edge of a slab) when you want to keep the top surface clear — the run cantilevers up from the side. Best on raised decks and stair edges.",
  },
  // aluminium pool substrate
  "decking": {
    title: "Decking",
    body: "On a timber deck, base-plate the posts down to the deck framing — no coring. The everyday deck fix; the batten screws are included.",
  },
  "concrete-slab": {
    title: "Concrete slab",
    body: "On a finished concrete slab, bolt the base plates down — the standard fix where you don't want to core. Fixings into the slab are customer-sourced.",
  },
  "in-ground": {
    title: "In-ground",
    body: "Where the fence runs across dirt, grass or a garden bed with no slab, set the posts in-ground in concrete footings. That's the one to use off-slab — don't base-plate onto pavers sitting on sand.",
  },
  // channel
  "ground": {
    title: "Deck mount",
    body: "On a flat deck or slab, deck-mount the channel — it sits on top and the glass drops in. The standard, simplest channel fix; use it unless you need the surface clear.",
  },
  "wall": {
    title: "Face mount",
    body: "Face-mount the channel to a vertical edge (a fascia or slab edge) when you want to keep the deck surface completely clear — the glass cantilevers up from the side.",
  },
  // standoff substrate
  "concrete": { title: "Concrete", body: "Into concrete, core or chem-anchor the standoffs — solid and permanent. Keep clear of the slab edge for the minimum edge distance." },
  "timber": { title: "Timber", body: "Into timber, lag-screw the standoffs to a structural member (a bearer or solid blocking) — never into cladding alone." },
  "steel": { title: "Steel", body: "Onto steel, bolt the standoffs with your own M12 hardware and have the engineer confirm the member is rated for the load." },
};

/** Tips for the RHS Joe pane given the selected section's style and the active field. */
export function joeStep1Tips(variant: string | null, field: string | null): Tip[] {
  if (!variant) {
    // Nothing selected — teach the core rule + how it works.
    return [
      SPLIT_SECTION_TIP,
      { title: "Build it section by section", body: "Tap a section to set its length, style and attachment. New sections copy the one above, so a long run of the same style is just a few taps." },
    ];
  }
  if (field === "style") {
    return [STYLE_TIP, SPLIT_SECTION_TIP];
  }
  if (field && field.startsWith("attach:")) {
    const key = field.slice("attach:".length);
    const t = ATTACH_TIPS[key];
    return t ? [t, SPLIT_SECTION_TIP] : [SPLIT_SECTION_TIP];
  }
  // Row selected, no specific field — summarise + the rule.
  return [
    { title: `Section style: ${styleFullLabel(variant)}`, body: "Set the length, then tap Style or an Attachment option to change it. Joe explains each choice here." },
    SPLIT_SECTION_TIP,
  ];
}
