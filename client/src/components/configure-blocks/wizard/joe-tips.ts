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
  const isBalChannel = productVariant === "glass-bal-channel";
  const isChannel = productVariant === "glass-pool-channel" || isBalChannel;
  const isStandoffs = productVariant === "glass-bal-standoffs";
  const isBlade = productVariant === "alu-pool-blade";
  const isBarr = productVariant === "alu-pool-barr";
  const is15 = productVariant.includes("15mm");
  const is12 = productVariant.includes("12mm");
  const as3000 = fv["as-3000"] === "true";
  const gateOn = span.gateConfig?.required === true;
  const softClose = span.gateConfig?.hardware === "polaris";
  const railOn = span.handrail?.enabled === true;

  if (isBarr) {
    tips.push({
      title: "How BARR fencing works",
      body:
        "Pre-fabricated panels — 25mm picket faces at 93mm gaps, welded to the rails — drop onto slimline 50×25mm posts with C-brackets. It's the architectural step up from tubular, in Satin Black or Pearl White.",
    });
    tips.push({
      title: "Why corners and gates use a bigger post",
      body:
        "BARR's slimline post face is only 25mm — too narrow for brackets and gate hardware to grab. Corners and gates get a 50×50 post from our Six Star (Black) or Xpress (White) range, swapped in automatically.",
    });
    const barrFinish = span.barrFinish || "satin-black";
    if (barrFinish === "pearl-white") {
      tips.push({
        title: "White gate hardware comes as two items",
        body:
          "D&D doesn't make the bundled hinge-and-latch kit in white — so a white BARR gate gets the Magna-Latch and the TruClose hinge pair as two separate items. Same hardware, same compliance, just two boxes instead of one.",
      });
    }
    const barrSubstrate = (fv["barr-substrate"] as string) || "decking";
    if (barrSubstrate === "decking") {
      tips.push({
        title: "Decking needs real timber",
        body:
          "An aluminium pool fence on a deck needs LVL or F17 hardwood under the base plates — standard pine joists aren't rated for it. Check what's under your boards before you order.",
      });
    }
    tips.push({
      title: "Posts near the water",
      body:
        "Aluminium posts within 1.25m of the pool water need to be earthed by an electrician (AS 3000). Most fences sit outside that zone — measure from the waterline, not the coping.",
    });
    if (gateOn) {
      tips.push({
        title: "BARR gate compliance",
        body:
          "The D&D hardware is self-closing and self-latching, rated to 30kg. Hang the gate so it swings away from the pool and the latch sits at least 1500mm off the ground.",
      });
    }
  } else if (isBlade) {
    tips.push({
      title: "How Blade fencing works",
      body:
        "Welded aluminium panels — 50mm blades at 79mm gaps — drop into FastFit brackets on 50×50mm posts. Pool compliant straight out of the box, and it's Satin Black only, so there's nothing to colour-match.",
    });
    const bladeSubstrate = (fv["blade-substrate"] as string) || "decking";
    if (bladeSubstrate === "decking") {
      tips.push({
        title: "Decking needs real timber",
        body:
          "An aluminium pool fence on a deck needs LVL or F17 hardwood under the base plates — standard pine joists aren't rated for it. Check what's under your boards before you order.",
      });
    } else if (bladeSubstrate === "core-drilled") {
      tips.push({
        title: "Core-drilling for Blade",
        body:
          "Blade posts need an 83mm core hole, 100mm deep — bigger than the holes for glass spigots. Hire the right core bit and the grout we send does the rest.",
      });
    }
    tips.push({
      title: "Posts near the water",
      body:
        "Aluminium posts within 1.25m of the pool water need to be earthed by an electrician (AS 3000). Most fences sit outside that zone — measure from the waterline, not the coping.",
    });
    if (gateOn) {
      tips.push({
        title: "Blade gate compliance",
        body:
          "The gate kit ships with D&D Magna-Latch and TruClose hinges — self-closing and self-latching, rated to 30kg. Hang it so it swings away from the pool and the latch sits at least 1500mm off the ground.",
      });
    }
  } else if (isStandoffs) {
    tips.push({
      title: "How the standoff balustrade works",
      body:
        "The 15mm glass comes pre-drilled and bolts straight onto 50mm stainless standoff pins — no posts, no channel. Panels up to 750mm wide take 4 standoffs, wider panels take 6. The 35-Series top rail ties the panels together for AS 1288 compliance.",
    });
    tips.push({
      title: "Adjustable vs fixed bodies",
      body:
        "Adjustable bodies wind in and out to take up an uneven substrate — the DIY-friendly pick. Fixed bodies are cheaper but the substrate needs to be dead flat, or you'll be cutting shims.",
    });
  } else if (isBalChannel) {
    tips.push({
      title: "How the channel balustrade works",
      body:
        "The 15mm glass sits inside a continuous aluminium channel fixed flat to your deck or slab — no spigots, no drilling the glass. The VersaTilt system lets you level each panel after it's in, and the 35-Series top rail ties the run together for a graspable edge.",
    });
  } else if (isChannel) {
    tips.push({
      title: "How the channel system works",
      body:
        "The glass sits inside a continuous aluminium channel fixed flat to your slab or deck — no spigots, no drilling the glass. It gives a clean, uninterrupted line along the base and the glass can be levelled after installation.",
    });
  } else if (isPool) {
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
    // Operator-authored earthing guidance (locked-scope §3, verbatim).
    tips.push(
      {
        title: "Cheapest earthing-compliant option",
        body: "Pool Madrid spigots with insulating covers.",
      },
      {
        title: "Exposed or high-wind and unprotected?",
        body: "Step up to Madrid balustrade spigots with the insulating covers.",
      },
      {
        title: "Only part of the fence near the water?",
        body:
          "Earthing's only required within 1.25m of the water. If just one section sits in that arm's-reach zone, run Pool Madrid + covers on that section and standard Madrid on the rest — do it all in black so the covered and uncovered sections match.",
      },
    );
  }

  if (!isChannel) {
    tips.push({
      title: "Base-plate vs core-fill",
      body:
        "Base-plate suits fixing onto existing pavers or a finished slab. Core-fill needs at least 100mm of solid concrete — too shallow and the spigot won't hold under load.",
    });
  }

  // ── Spigot section: substrate / mounting (SF-1 fixings matrix) ──
  if (isPool) {
    const substrate = span.spigotSubstrate || "concrete";
    const mounting = span.spigotMounting || "base-plate";
    if (substrate === "timber") {
      tips.push({
        title: "Fixing to a timber deck",
        body:
          "Base-plated spigots on a deck need structural timber underneath — joists or solid bearers, not just decking boards. Countersunk batten screws do the holding.",
      });
    } else if (substrate === "steel") {
      tips.push({
        title: "Fixing to steel",
        body:
          "Steel takes threaded-rod fixings without a chemical anchor. Check the steel section underneath is rated for the point loads of a glass fence.",
      });
    } else if (mounting === "core-drilled") {
      tips.push({
        title: "Core-drill grout",
        body:
          "Core-drilled spigots get grouted in — allow a 10kg bag per ten spigots plus a spare. On a hot day keep the holes shaded and the mixing water cold.",
      });
    }
  }

  // ── Channel section: substrate fixings + corners (M12, 300mm centres) ──
  if (isChannel) {
    const substrate = span.spigotSubstrate || "concrete";
    if (substrate === "timber") {
      tips.push({
        title: "Channel on a timber deck",
        body:
          "The channel anchors every 300mm with M12 LAG screws, so it needs structural timber underneath the whole run — joists or bearers, not just decking boards. You supply the M12 nuts and washers.",
      });
    } else if (substrate === "steel") {
      tips.push({
        title: "Channel on steel",
        body:
          "You'll supply your own M12 stainless hardware — bolt through the steel or drill-and-tap. The M10 hardware used for spigots isn't enough for channel loads.",
      });
    } else {
      tips.push({
        title: "Channel on concrete",
        body:
          "The channel anchors every 300mm with M12 threaded rods set in chemical anchor. Make sure you've got solid concrete the full length of the run — no pavers over sand.",
      });
    }
    tips.push({
      title: "Corners are mitre-cut",
      body:
        "Where two channel runs meet at a corner, both get cut at 45° so they join cleanly. You'll need a mitre saw or a careful hand cut — it's the one bit of cutting in a channel install.",
    });
  }

  // ── Add-ons section: raked / custom panels ──
  if (span.leftRakedPanel?.enabled || span.rightRakedPanel?.enabled) {
    tips.push({
      title: "Raked panels",
      body:
        "Rakes step the fence up retaining walls and level changes. They're a fixed 1200 wide — the height you pick is the tall edge, and the top slopes down to standard panel height.",
    });
  }
  if (span.customPanel?.enabled) {
    tips.push({
      title: "Custom panels",
      body:
        "A custom panel is cut to your exact size rather than the stock 50mm steps — handy for closing an awkward gap. Expect a longer lead time than stock panels.",
    });
  }

  // Glass-gate compliance tip (the soft-close framing is glass hinge hardware —
  // Blade has its own D&D gate tip above).
  if (gateOn && !isBlade && !isBarr) {
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
  if (railOn && isBalChannel) {
    tips.push({
      title: "Top rail matches the channel",
      body:
        "The 35-Series rail comes in the same finishes as the channel, so we match them automatically — Black channel gets a Black rail, Satin gets Satin. One less thing to pick, and it always looks right.",
    });
  }
  if (isStandoffs) {
    const substrate = span.spigotSubstrate || "timber";
    if (substrate === "steel") {
      tips.push({
        title: "Fixing standoffs to steel",
        body:
          "Drill-and-tap cuts an M12 thread straight into the steel — cleanest look, needs at least 10mm of steel. Through-fixing bolts right through with a nut on the back — easier if you can reach the back side.",
      });
    } else {
      tips.push({
        title: "Cladding changes the fixing",
        body:
          "If there's decking, render or veneer between the standoff and the structure, the fixing needs to be longer to reach through it. Tell us about cladding and we'll send the right length — it's the most common thing people get wrong.",
      });
    }
    if (railOn) {
      tips.push({
        title: "The rail is structural here",
        body:
          "On a standoff balustrade the top rail isn't just for looks — it interlinks the panels so the run meets AS 1288. Keep it on unless your run has at least 3 panels, each a metre wide or more.",
      });
    }
  }

  return tips;
}
