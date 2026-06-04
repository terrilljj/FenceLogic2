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
    body: "Set into a cored hole in the concrete and grouted in. The cleanest, strongest fix — glass spigots or aluminium posts grout straight into the slab. Needs solid concrete to core.",
  },
  "base-plate": {
    title: "Base-plated",
    body: "Bolts down onto a slab or deck with a base plate — no coring. The everyday fix for new slabs and timber decks. The rod fixings sit proud, so it takes the taller cover.",
  },
  "side-mounted": {
    title: "Side-mounted",
    body: "Fixed to a vertical face — a fascia, the edge of a slab, or a wall. Frees up the top surface and suits raised decks or stair edges.",
  },
  "inground": {
    title: "In-ground",
    body: "Aluminium posts set straight into the ground or a concrete footing — no slab needed. The go-to where the fence runs across dirt, grass or a garden bed.",
  },
  // channel
  "ground": {
    title: "Deck mount",
    body: "The channel sits on top of the deck or slab and the glass drops into it. The standard channel fix on a flat surface.",
  },
  "wall": {
    title: "Face mount",
    body: "The channel bolts to a vertical edge (a fascia or slab edge), with the glass cantilevering up. Keeps the deck surface clear.",
  },
  // standoff substrate
  "concrete": { title: "Concrete", body: "Standoffs core or chem-anchor into concrete — solid and permanent. Mind the edge distance near a slab edge." },
  "timber": { title: "Timber", body: "Lag-screwed into structural timber (a bearer or solid blocking behind the cladding). Not into cladding alone." },
  "steel": { title: "Steel", body: "Bolted to a steel member — you supply the M12 hardware. The post engineer confirms the steel is rated for the load." },
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
