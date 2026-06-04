/**
 * Server-side BOM (Bill of Materials) calculator.
 * Moved from client/src/pages/fence-builder.tsx to keep product data server-side.
 */
import {
  FenceDesign,
  Component,
  SpigotMounting,
  SpigotColor,
  HingeType,
  LatchType,
  GateHardware,
  HandrailType,
  HandrailMaterial,
  HandrailFinish,
  RailTerminationType,
  getSpigotDetails,
  getHingeDetails,
  getLatchDetails,
  optimizeRailLengths,
} from "@shared/schema";

export type SlotMapping = {
  internalId: string;
  fieldName: string;
  productId: string | null;
  label: string | null;
  // discriminatorAttributes is set on new slots. Legacy slots (null) fall back to regex match.
  discriminatorAttributes?: Record<string, string> | null;
};

type ProductLookup = {
  id: string;
  code: string;
  description: string;
  price: string | null;
};

type ProductDetails = { sku: string; description: string };

/**
 * Glass-balustrade panel line — correct family / height / thickness per system, with the
 * AS1288 §7 laminated swap at a ≥5m fall (fallBand "over-5m"). Widths are made-to-size
 * (equalised by the solver), mirroring the existing GP-…-1200-12 made-to-size convention.
 *
 * SKU families are the calc's catalogue bal-glass families (1000FBG / 970NTG / 1280S);
 * the "-LAM" laminated suffix is DERIVED — no laminated SKU exists in the catalogue yet
 * (operator to ratify / seed). Glass builds per system are from the PTS extractions:
 *   spigots-12mm (Madrid Standard) 12mm mono / 11.52mm laminated, 970H
 *   spigots-15mm (Madrid Deluxe)   15mm mono / 16mm laminated,     1000H
 *   channel      (VersaTilt)       15mm mono / 15mm laminated,     1000H
 *   standoffs    (Standoff PF)     15mm mono / 15mm laminated,     1280H (pre-drilled)
 */
function balGlassLine(productVariant: string, fallBand: string, width: number): ProductDetails {
  // Catalogue codes are zero-padded to 4 digits (e.g. 1000FBG-0850) — pad so the emitted
  // SKU is an EXACT catalogue match, not a near-miss.
  const w4 = String(width).padStart(4, "0");
  if (productVariant === "glass-bal-channel-hd") {
    // Real storefront SGP family: 1100SGP-{width} (17.52mm SGP laminated, 1100H).
    return {
      sku: `1100SGP-${w4}`,
      description: `17.52mm SGP Laminated HD Channel Bal Glass ${width}W × 1100H`,
    };
  }
  const laminated = fallBand === "over-5m";
  let family: string, height: number, mono: number, lam: number, label: string;
  if (productVariant.includes("15mm")) {
    family = "1000FBG"; height = 1000; mono = 15; lam = 16; label = "Frameless Bal Glass";
  } else if (productVariant.includes("12mm")) {
    family = "970NTG"; height = 970; mono = 12; lam = 11.52; label = "Frameless Bal Glass";
  } else if (productVariant === "glass-bal-standoffs") {
    family = "1280S"; height = 1280; mono = 15; lam = 15; label = "Standoff Bal Glass";
  } else {
    // glass-bal-channel — shares the 15mm/1000H frameless bal glass family
    family = "1000FBG"; height = 1000; mono = 15; lam = 15; label = "Channel Bal Glass";
  }
  const thick = laminated ? lam : mono;
  const buildWord = laminated ? "Toughened Laminated" : "Toughened";
  const drilled = productVariant === "glass-bal-standoffs" ? ", pre-drilled" : "";
  return {
    sku: laminated ? `${family}-${w4}-LAM` : `${family}-${w4}`,
    description: `${thick}mm ${buildWord} ${label} ${width}W × ${height}H${drilled}`,
  };
}

/**
 * Real catalogue rail SKUs for the balustrade top rail. Two families:
 *   series-35x35   → SER35-*   (15mm / channel / standoff styles)
 *   nonorail-25x21 → STG-*2521 (12mm spigots)
 * The rail length SKU bundles glazing rubber + 2 factory-fitted end caps, so an
 * `end-cap` termination emits nothing separate (returns null). Inline joiners + the
 * other terminators (wall-tie / 90° / adjustable-corner) map to their real SKUs.
 * (Replaces the old made-up RAIL-{TYPE}-… placeholders.)
 */
function railSkus(type: string, finish: string) {
  if (type === "nonorail-25x21" || type === "nanorail-30x21") {
    const F = ({ black: "B", white: "MW", polished: "P", satin: "S" } as Record<string, string>)[finish] || "S";
    return {
      family: "Summit 25×21 NonoRail",
      rail: `STG-R5800-2521-${F}`,
      inlineJoiner: `STG-2521-J-${F}`,
      term: (t: string): string | null =>
        t === "end-cap" ? null
        : t === "wall-tie" ? `STG-2521-WP-${F}`
        : t === "90-degree" ? `STG-2521-90J-${F}`
        : t === "adjustable-corner" ? `STG-2521-VJA-${F}` : null,
    };
  }
  // series-35x35 (default). Rail/end-cap finish: B/MW/SA; wall-plate finish: B/MW/S;
  // joiners are Satin-Anodised only (catalogue stocks SER35-J*-SA only).
  const F = ({ black: "B", white: "MW", satin: "SA" } as Record<string, string>)[finish] || "SA";
  const WF = ({ black: "B", white: "MW", satin: "S" } as Record<string, string>)[finish] || "S";
  return {
    family: "35-Series",
    rail: `SER35-R5800-${F}`,
    inlineJoiner: "SER35-J-SA",
    term: (t: string): string | null =>
      t === "end-cap" ? null
      : t === "wall-tie" ? `SER35-WB-${WF}`
      : t === "90-degree" ? "SER35-J90-SA"
      : t === "adjustable-corner" ? "SER35-VJA-SA" : null,
  };
}

/**
 * Real catalogue spigot SKU from the chosen family + mounting + finish.
 * {PREFIX}-{SBP|S}-{finish}: base-plate → SBP, core-drill → S.
 *   madrid→MAD · nova→NOV · madrid-deluxe→MADDEL · madrid-pool→POOLMAD  (finish B/MW/P/S)
 *   insuluxe→INS  (polymer pool spigot — finish B/SG/W, no polish tier)
 * Returns null for an unmapped family so the caller keeps its placeholder fallback.
 */
function spigotSku(family: string, mounting: string, finish: string): { sku: string; label: string } | null {
  const PREFIX: Record<string, string> = { madrid: "MAD", nova: "NOV", "madrid-deluxe": "MADDEL", "madrid-pool": "POOLMAD", insuluxe: "INS" };
  const prefix = PREFIX[family];
  if (!prefix) return null;
  const mount = mounting === "core-drilled" ? "S" : "SBP";
  const F = prefix === "INS"
    ? (({ black: "B", white: "W", satin: "SG", polished: "SG" } as Record<string, string>)[finish] || "SG")
    : (({ black: "B", white: "MW", polished: "P", satin: "S" } as Record<string, string>)[finish] || "P");
  const famLabel: Record<string, string> = { MAD: "Madrid", NOV: "Nova", MADDEL: "Madrid Deluxe", POOLMAD: "Madrid Pool", INS: "Insuluxe" };
  return { sku: `${prefix}-${mount}-${F}`, label: `${famLabel[prefix]} Spigot ${mount === "S" ? "Core-Drill" : "Base-Plated"} (${finish})` };
}

export function calculateComponents(
  design: FenceDesign,
  slotMappings: SlotMapping[] = [],
  products: ProductLookup[] = []
): Component[] {
  const components: Component[] = [];

  /**
   * Generic slot resolver. Queries product_slots WHERE fieldName=fieldName AND
   * discriminatorAttributes @> discriminators (JSONB contains).
   * Falls back to regex match on product description/code for legacy slots without
   * discriminatorAttributes (preserves existing glass-panels behaviour).
   *
   * Returns null if no mapped slot matches — callers emit an [unmapped] BOM line.
   */
  const lookupSlot = (fieldName: string, discriminators: Record<string, string>): ProductDetails | null => {
    const fieldSlots = slotMappings.filter(s => s.fieldName === fieldName && s.productId);
    if (fieldSlots.length === 0) return null;

    for (const slot of fieldSlots) {
      const product = products.find(p => p.id === slot.productId);
      if (!product) continue;

      if (slot.discriminatorAttributes) {
        // New path: all provided discriminators must be present and match
        const attrs = slot.discriminatorAttributes as Record<string, string>;
        if (Object.entries(discriminators).every(([k, v]) => String(attrs[k]) === String(v))) {
          return { sku: product.code, description: product.description };
        }
      } else {
        // Legacy path: regex match on size_mm against product description/code
        const panelWidth = discriminators.size_mm;
        if (panelWidth) {
          const widthPattern = new RegExp(`\\b${panelWidth}(mm|W)\\b`, 'i');
          if (widthPattern.test(product.description) || widthPattern.test(product.code)) {
            return { sku: product.code, description: product.description };
          }
        }
      }
    }
    return null;
  };

  // Helper: try slot resolution first, fall through to hardcoded template-literal SKU.
  // Used by the aluminium/semi-frameless branches that historically emitted only template literals.
  // Once a style's product_slots are populated, the same call swaps in real SKUs automatically.
  const pushSlotOrFallback = (
    qty: number,
    fieldName: string,
    discriminators: Record<string, string>,
    fallback: { description: string; sku: string }
  ): void => {
    const slot = lookupSlot(fieldName, discriminators);
    if (slot) {
      components.push({ qty, description: slot.description, sku: slot.sku });
    } else {
      components.push({ qty, description: fallback.description, sku: fallback.sku });
    }
  };

  // ── Shared aluminium-balustrade hardware (SF-12/13 — BARR Bal + Blade Bal use the
  // SAME AIRE post family + XP covers + 3D fixings matrix; only panels + brackets +
  // finish availability differ). Substrate-driven post topology (face-mount corners
  // are 2 posts back-to-back; core/base share); covers + fixings per substrate × material.
  //   code: 'B' | 'W'  ·  substrate: core-drilled | base-plated | face-mounted
  //   material: timber | concrete | steel (base/face only)  ·  corners: count
  const emitBalHardware = (
    code: "B" | "W",
    finishName: string,
    substrate: string,
    material: string,
    totalPanels: number,
    corners: number,
  ): void => {
    if (substrate === "core-drilled") {
      const posts = totalPanels + 1;                 // corners are shared inline posts
      pushSlotOrFallback(posts, 'post', { type: 'core', finish: code },
        { description: `AIRE 5800mm Core-Drill Post — cut to length (${finishName})`, sku: `AR-5800-FP-${code}` });
      pushSlotOrFallback(posts, 'top-plate', { finish: code },
        { description: `Post Top Plate (${finishName})`, sku: `XP-TP-${code}` });
      pushSlotOrFallback(posts, 'post-cover', { type: 'dress-ring', finish: code },
        { description: `Dress Ring (${finishName})`, sku: `XP-DR-${code}` });
      pushSlotOrFallback(Math.ceil(posts / 15) + 1, 'grout', { type: 'setfast' },
        { description: `Setfast Non-Shrink Grout 10kg (incl. spare)`, sku: `GROUT-SETFAST-10KG` });
    } else if (substrate === "base-plated") {
      const posts = totalPanels + 1;
      pushSlotOrFallback(posts, 'post', { type: 'base-plate', finish: code },
        { description: `AIRE 1050mm Base Plate Post (${finishName})`, sku: `AR-1050-FPBP-${code}` });
      pushSlotOrFallback(posts, 'post-cover', { type: 'domical', finish: code },
        { description: `Domical Cover 2-part (${finishName})`, sku: `XP-DC-2P-${code}` });
      if (material === "timber") {
        pushSlotOrFallback(posts, 'fixing', { type: 'lag-m10', substrate: 'base-timber' },
          { description: `M10 LAG Screw 4-pack (4 per post)`, sku: `S-110LAG-4PK` });
      } else if (material === "concrete") {
        pushSlotOrFallback(posts, 'fixing', { type: 'rod-m10', substrate: 'base-concrete' },
          { description: `M10 Threaded Rod 4-pack (4 per post)`, sku: `S-120ROD-4PK` });
        pushSlotOrFallback(Math.ceil(posts / 20), 'chem-anchor', { type: 'soudal' },
          { description: `Chemical Anchor 400ml (1 per 20 posts)`, sku: `SOUD-CA1400` });
      } // steel: customer-supplied — no BH fixing SKU
    } else { // face-mounted — mid posts + 2 back-to-back per corner + L+R end pack
      const midPosts = Math.max(0, totalPanels - 1 - corners);
      const cornerPosts = corners * 2;
      const fmid = midPosts + cornerPosts;
      if (fmid > 0) {
        pushSlotOrFallback(fmid, 'post', { type: 'face-mid', finish: code },
          { description: `AIRE 1500mm Face-Mount Mid Post (${finishName})`, sku: `AR-1500-FMID-${code}` });
      }
      const endPacks = 1; // a connected run has two free ends → one L+R 2-pack
      pushSlotOrFallback(endPacks, 'post', { type: 'face-end', finish: code },
        { description: `AIRE 1500mm Face-Mount L+R End Post 2-pack (${finishName})`, sku: `AR-1500-FMLR-${code}-2PK` });
      const facePosts = fmid + endPacks * 2;
      // Dome nuts emitted for ALL face-mount materials; finish-matched (Silver SS for White).
      const domeSku = code === "W" ? `GS-DN-4PK` : `GS-DN-4PK-B`;
      pushSlotOrFallback(facePosts, 'dome-nut', { finish: code },
        { description: `M12 Dome Nut 4-pack (${code === "W" ? "Silver" : "Black"})`, sku: domeSku });
      if (material === "timber") {
        pushSlotOrFallback(facePosts * 4, 'fixing', { type: 'lag-m12', substrate: 'face-timber' },
          { description: `M12 x 160mm LAG Screw (4 per post)`, sku: `GS160LAG` });
      } else if (material === "concrete") {
        pushSlotOrFallback(facePosts * 4, 'fixing', { type: 'rod-m12', substrate: 'face-concrete' },
          { description: `M12 x 150mm Threaded Rod (4 per post)`, sku: `GS150ROD` });
        pushSlotOrFallback(Math.ceil(facePosts / 15), 'chem-anchor', { type: 'soudal' },
          { description: `Chemical Anchor 400ml (1 per 15 posts)`, sku: `SOUD-CA1400` });
      } // steel: customer-supplied main fixings (dome nuts still emitted above)
    }
  };

  // Corner count from the design shape (manual override via fieldValues['bal-corners']).
  const balCornersFromShape = (): number => {
    const s = (design as any).shape as string;
    const sections = (design.spans as any[]).length;
    if (s === "l-shape") return 1;
    if (s === "u-shape") return 2;
    if (s === "enclosed") return 4;
    if (s === "custom") return Math.max(0, sections - 1);
    return 0; // inline
  };

  const isChannelSystem = design.productVariant === "glass-pool-channel";
  const isBladeFencing = design.productVariant === "alu-pool-blade";
  const isBarrFencing = design.productVariant === "alu-pool-barr";
  const isTubularFencing = design.productVariant === "alu-pool-tubular";
  const isSemiFrameless = design.productVariant === "semi-frameless-1000" || design.productVariant === "semi-frameless-1800";
  const isStandoffSystem = design.productVariant === "glass-bal-standoffs";
  const isBalBarr = design.productVariant === "alu-bal-barr";
  const isBalBlade = design.productVariant === "alu-bal-blade";
  // Glass balustrade panel families take their own glass line (correct height/thickness +
  // AS1288 laminated swap at ≥5m), NOT the pool GP-…-1200-12 fallback.
  const isGlassBalPanel =
    design.productVariant.startsWith("glass-bal-spigots") ||
    design.productVariant === "glass-bal-channel" ||
    design.productVariant === "glass-bal-channel-hd" ||
    design.productVariant === "glass-bal-standoffs";
  // Balustrade channel hardware (channel kit + friction plates + washers + glazing rubber +
  // end plates + alignment pins). glass-bal-channel = VersaTilt (PTS-003, 4200mm);
  // glass-bal-channel-hd = VersaTilt Heavy Duty (PTS-028, 3600mm, 17.52 SGP laminated).
  const isBalChannel =
    design.productVariant === "glass-bal-channel" || design.productVariant === "glass-bal-channel-hd";
  const isBalChannelHd = design.productVariant === "glass-bal-channel-hd";
  const gatesAllowed = !design.productVariant.includes("bal-");

  // Cast spans to any — design JSON from clients may carry extra dynamic properties
  // (e.g. postFinish, bladeHeight) that aren't on the strict SpanConfig type.
  const isMultiSpanCorner = design.shape === "l-shape" || design.shape === "u-shape";
  (design.spans as any[]).forEach((span: any, spanIndex: number) => {
    // Semi-Frameless
    if (isSemiFrameless && span.panelLayout && span.panelLayout.panels.length > 0) {
      const glassHeight = design.productVariant === "semi-frameless-1000" ? 1000 : 1800;
      const glassThickness = design.productVariant === "semi-frameless-1000" ? 12 : 10;
      const postFinish = span.postFinish || "satin";
      const postMounting = span.postMounting || "core-drilled";
      const leftEndPost = span.leftEndPost || "end";
      const rightEndPost = span.rightEndPost || "end";

      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "gate") {
          pushSlotOrFallback(
            1,
            'panel',
            { type: 'gate', width: String(panelWidth), height: String(glassHeight), thickness: String(glassThickness) },
            {
              description: `Semi-Frameless Gate Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
              sku: `SF-GATE-${panelWidth}-${glassHeight}-${glassThickness}`,
            },
          );
        } else if (panelType === "hinge") {
          pushSlotOrFallback(
            1,
            'panel',
            { type: 'hinge', width: String(panelWidth), height: String(glassHeight), thickness: String(glassThickness) },
            {
              description: `Semi-Frameless Hinge Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
              sku: `SF-HINGE-${panelWidth}-${glassHeight}-${glassThickness}`,
            },
          );
        } else {
          pushSlotOrFallback(
            1,
            'panel',
            { type: 'standard', width: String(panelWidth), height: String(glassHeight), thickness: String(glassThickness) },
            {
              description: `Semi-Frameless Glass Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
              sku: `SF-PANEL-${panelWidth}-${glassHeight}-${glassThickness}`,
            },
          );
        }
      });

      // For L/U shapes, spans after the first share a corner post with the previous span
      const sharedCornerPost = isMultiSpanCorner && spanIndex > 0 ? 1 : 0;
      const numPosts = span.panelLayout.panels.length + 1 - sharedCornerPost;
      pushSlotOrFallback(
        numPosts,
        'post',
        { height: String(glassHeight + 200), finish: postFinish, mounting: postMounting },
        {
          description: `Semi-Frameless 50mm Square Post ${glassHeight + 200}mm (${postFinish} finish, ${postMounting} mounting)`,
          sku: `SF-POST-50-${glassHeight + 200}-${postFinish.toUpperCase()}-${postMounting.toUpperCase()}`,
        },
      );

      if (leftEndPost !== "end") {
        pushSlotOrFallback(
          1,
          'post',
          { side: 'left', type: leftEndPost, height: String(glassHeight + 200), finish: postFinish },
          {
            description: `Semi-Frameless Left ${leftEndPost} Post ${glassHeight + 200}mm (${postFinish} finish)`,
            sku: `SF-POST-LEFT-${leftEndPost.toUpperCase()}-${glassHeight + 200}-${postFinish.toUpperCase()}`,
          },
        );
      }

      if (rightEndPost !== "end") {
        pushSlotOrFallback(
          1,
          'post',
          { side: 'right', type: rightEndPost, height: String(glassHeight + 200), finish: postFinish },
          {
            description: `Semi-Frameless Right ${rightEndPost} Post ${glassHeight + 200}mm (${postFinish} finish)`,
            sku: `SF-POST-RIGHT-${rightEndPost.toUpperCase()}-${glassHeight + 200}-${postFinish.toUpperCase()}`,
          },
        );
      }

      if (design.productVariant === "semi-frameless-1000") {
        const railFinish = span.railFinish || "satin";
        const totalLength = span.length || 5000;
        pushSlotOrFallback(
          1,
          'top-rail',
          { length: String(totalLength), finish: railFinish },
          {
            description: `Semi-Frameless Top Rail ${totalLength}mm (${railFinish} finish)`,
            sku: `SF-RAIL-TOP-${totalLength}-${railFinish.toUpperCase()}`,
          },
        );
      } else {
        const midRailFinish = span.midRailFinish || "satin";
        const midRailHeight = span.midRailHeight || 1000;
        const totalLength = span.length || 5000;
        pushSlotOrFallback(
          1,
          'mid-rail',
          { length: String(totalLength), finish: midRailFinish, height: String(midRailHeight) },
          {
            description: `Semi-Frameless Mid-Rail @ ${midRailHeight}mm ${totalLength}mm (${midRailFinish} finish)`,
            sku: `SF-RAIL-MID-${midRailHeight}-${totalLength}-${midRailFinish.toUpperCase()}`,
          },
        );
      }

      if (gatesAllowed && span.gateConfig?.required) {
        const gateWidth = span.gateConfig.gateSize || 900;
        pushSlotOrFallback(
          1,
          'hinge-set',
          { width: String(gateWidth), height: String(glassHeight) },
          {
            description: `Semi-Frameless Gate Hinge Set for ${gateWidth}mm x ${glassHeight}mm Gate`,
            sku: `SF-HINGE-SET-${gateWidth}-${glassHeight}`,
          },
        );
        pushSlotOrFallback(
          1,
          'latch-set',
          { width: String(gateWidth), height: String(glassHeight) },
          {
            description: `Semi-Frameless Gate Latch for ${gateWidth}mm x ${glassHeight}mm Gate`,
            sku: `SF-LATCH-${gateWidth}-${glassHeight}`,
          },
        );
      }

      return;
    }
    // Blade Fencing — full component emission (SF-5 / PTS-021 / inputs spec 2026-05-26).
    // Black only (no finish picker); single 50×50 post family (no cross-range borrow —
    // Blade inline IS 50×50, so corners + gates reuse the same post); FastFit brackets
    // (no cap, no shroud); substrate drives post/cover/fixing; D&D gate kit is one SKU.
    // The configure wizard shows all of this as hardware cards; this block is what makes
    // the actual quote BOM match (the old block emitted only panels + posts).
    else if (isBladeFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const STOCK_W = 2200;
      const finishName = "Satin Black";
      const substrate = (span.fieldValues?.["blade-substrate"] as string) || "decking";
      const basePlated = substrate === "decking" || substrate === "concrete-slab";
      const coreDrilled = substrate === "core-drilled";

      const panelTypes = span.panelLayout.panelTypes || [];

      // 1. Panels (real storefront SKUs) — standard / cut. (Gate panel in the gate block.)
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";
        if (panelType === "gate") return;
        if (panelWidth === STOCK_W) {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'standard', stock_width: String(STOCK_W), height: '1200mm', cut_width: String(panelWidth), finish: 'B' },
            { description: `Blade Panel 2200 x 1200mm (${finishName})`, sku: `BLA-PNL-2200-1200-B` },
          );
        } else {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'cut', stock_width: String(STOCK_W), height: '1200mm', cut_width: String(panelWidth), finish: 'B' },
            { description: `Blade Panel 1200H, cut to ${panelWidth}mm from 2200mm (${finishName})`, sku: `BLA-PNL-2200-1200-B` },
          );
        }
      });

      const nonGatePanels = span.panelLayout.panels.filter((_: number, i: number) => (panelTypes[i] || "standard") !== "gate").length;
      const hasGate = gatesAllowed && !!span.gateConfig?.required;
      const numPosts = span.panelLayout.gaps.length;   // all posts are the same 50×50 family (incl. gate/corner)

      // 2. FastFit brackets — 1 kit per panel (Blade-specific, no cap).
      if (nonGatePanels > 0) {
        pushSlotOrFallback(
          nonGatePanels, 'bracket',
          { type: 'fastfit', finish: 'B' },
          { description: `Blade FastFit Open Bracket 4-pack (${finishName})`, sku: `FF-BH-OPEN-4PK-B` },
        );
      }

      // 3. Posts + covers (substrate-driven). One 50×50 family — same SKU at corners/gates.
      if (numPosts > 0) {
        if (basePlated) {
          pushSlotOrFallback(
            numPosts, 'post',
            { height: '1300', finish: 'B', mounting: 'base-plate' },
            { description: `Blade 50×50 1300mm Base Plate Post (${finishName})`, sku: `SS-1300-BP-B` },
          );
          pushSlotOrFallback(
            numPosts, 'post-cover',
            { type: 'domical', finish: 'B' },
            { description: `Blade 50×50 Domical Cover (${finishName})`, sku: `SS-DC-B` },
          );
        } else {
          pushSlotOrFallback(
            numPosts, 'post',
            { height: '1800', finish: 'B', mounting: 'standard' },
            { description: `Blade 50×50 1800mm Post (${finishName})`, sku: `SS-1800-B` },
          );
          if (coreDrilled) {
            pushSlotOrFallback(
              numPosts, 'post-cover',
              { type: 'dress-ring', finish: 'B' },
              { description: `Blade 50×50 Dress Ring (${finishName})`, sku: `XP-DR-B` },
            );
          }
        }
      }

      // 4. Gate — panel + D&D bundled kit (Black, single SKU). Gate posts share the
      //    inline 50×50 family (already counted in numPosts above).
      if (hasGate) {
        pushSlotOrFallback(
          1, 'panel',
          { type: 'gate', height: '1200mm', width: String(span.gateConfig.gateSize || 975), finish: 'B' },
          { description: `Blade Gate 975 x 1200mm (${finishName})`, sku: `BLA-GATE-0975-1200-B` },
        );
        pushSlotOrFallback(
          1, 'gate-hardware',
          { gate_type: 'blade', finish: 'B' },
          { description: `D&D Magna-Latch + TruClose Hinge Kit (Black, pool compliant)`, sku: `ML-TL-TC-H-AT` },
        );
      }

      // 5. Fixings (substrate-driven, PTS-021): decking CSK 1 pack / 4 posts;
      //    core-drilled Setfast grout 1 bag / 15 posts (+1 spare); else customer-sourced.
      if (substrate === "decking" && numPosts > 0) {
        pushSlotOrFallback(
          Math.ceil(numPosts / 4), 'fixing',
          { type: 'csk', substrate: 'decking' },
          { description: `M10 x 100mm Countersunk Batten Screws 4-pack`, sku: `CSK-100-4PK` },
        );
      } else if (coreDrilled && numPosts > 0) {
        pushSlotOrFallback(
          Math.ceil(numPosts / 15) + (spanIndex === 0 ? 1 : 0), 'grout',
          { type: 'setfast' },
          { description: `Setfast Non-Shrink Grout 10kg (incl. spare)`, sku: `GROUT-SETFAST-10KG` },
        );
      }

      return;
    }
    // BARR Fencing — full component emission (SF-4 / PTS-019 / inputs spec 2026-05-25).
    // Pool BARR is 1200mm; finish B/W drives every SKU; substrate drives post/cover/
    // fixing; BARR's 25mm post face can't take the 32mm C-brackets or D&D hardware, so
    // corners + gates use cross-range 50×50 posts (Black SS-, White XP-).
    else if (isBarrFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const STOCK_W = 2205;
      const barrFinish = span.barrFinish || "satin-black";
      const code = barrFinish === "satin-black" ? "B" : "W";
      const finishName = barrFinish === "satin-black" ? "Satin Black" : "Pearl White";
      const substrate = (span.fieldValues?.["barr-substrate"] as string) || "decking";
      const basePlated = substrate === "decking" || substrate === "concrete-slab";
      const coreDrilled = substrate === "core-drilled";
      const inGround = substrate === "in-ground";

      const panelTypes = span.panelLayout.panelTypes || [];

      // 1. Panels (real storefront SKUs) — standard / cut / gate.
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";
        if (panelType === "gate") return; // gate panel emitted in the gate block below
        if (panelWidth === STOCK_W) {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'standard', stock_width: String(STOCK_W), height: '1200mm', cut_width: String(panelWidth), finish: code },
            { description: `BARR Panel 2205 x 1200mm (${finishName})`, sku: `BR-PANEL-2205-1200-${code}` },
          );
        } else {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'cut', stock_width: String(STOCK_W), height: '1200mm', cut_width: String(panelWidth), finish: code },
            { description: `BARR Panel 1200H, cut to ${panelWidth}mm from 2205mm (${finishName})`, sku: `BR-PANEL-2205-1200-${code}` },
          );
        }
      });

      // Counts.
      const nonGatePanels = span.panelLayout.panels.filter((_: number, i: number) => (panelTypes[i] || "standard") !== "gate").length;
      const hasGate = gatesAllowed && !!span.gateConfig?.required;
      const totalPosts = span.panelLayout.gaps.length;          // panels + 1
      const gatePosts = hasGate ? 2 : 0;                        // gate hinge + latch posts (cross-range)
      const inlinePosts = Math.max(0, totalPosts - gatePosts);

      // 2. C-brackets + bracket caps — 1 kit each per panel (paired).
      if (nonGatePanels > 0) {
        pushSlotOrFallback(
          nonGatePanels, 'bracket',
          { type: 'c-bracket', finish: code },
          { description: `BARR 25mm C-Bracket Kit 4-pack (${finishName})`, sku: `BR-BR25-${code}-4PK` },
        );
        pushSlotOrFallback(
          nonGatePanels, 'bracket-cap',
          { type: 'bracket-cap', finish: code },
          { description: `BARR Bracket Cap 4-pack (${finishName})`, sku: `BR-BRCAP-${code}-4PK` },
        );
      }

      // 3. Inline posts (BARR 50×25) + covers, substrate-driven.
      if (inlinePosts > 0) {
        if (basePlated) {
          pushSlotOrFallback(
            inlinePosts, 'post',
            { type: 'inline', height: '1280', finish: code, mounting: 'base-plate' },
            { description: `BARR 1280mm Base Plate Post (${finishName})`, sku: `BR-1280-BP-${code}` },
          );
          pushSlotOrFallback(
            inlinePosts, 'post-cover',
            { type: 'domical', finish: code },
            { description: `BARR Domical Cover 2-pack (${finishName})`, sku: `BR-DC-2P-${code}` },
          );
        } else {
          pushSlotOrFallback(
            inlinePosts, 'post',
            { type: 'inline', height: '1800', finish: code, mounting: 'standard' },
            { description: `BARR 1800mm Post (${finishName})`, sku: `BR-1800-${code}` },
          );
          if (coreDrilled) {
            pushSlotOrFallback(
              inlinePosts, 'post-cover',
              { type: 'dress-ring', finish: code },
              { description: `BARR Dress Ring (${finishName})`, sku: `BR-DR-${code}` },
            );
          }
        }
      }

      // Cross-range 50×50 SKUs (Black SS-, White XP-) for corners + gate posts.
      const xPostSku = basePlated
        ? (code === "B" ? "SS-1300-BP-B" : "XP-1300-BP-W")
        : (code === "B" ? "SS-1800-B" : "XP-1800-FP-W");
      const xPostDesc = basePlated ? "50×50 Base Plate Post" : "50×50 Post";
      const xCoverSku = basePlated ? `XP-DC-2P-${code}` : coreDrilled ? `XP-DR-${code}` : null;
      const xCoverDesc = basePlated ? "50×50 Domical Cover" : "50×50 Dress Ring";

      // 4. Gate — panel + finish-asymmetric D&D hardware + 2 cross-range posts + covers.
      if (hasGate) {
        const gateWidth = span.gateConfig.gateSize || 975;
        pushSlotOrFallback(
          1, 'panel',
          { type: 'gate', height: '1200mm', width: String(gateWidth), finish: code },
          { description: `BARR Gate 975 x 1200mm (${finishName})`, sku: `BR-GATE-0975-1200-${code}` },
        );
        if (code === "B") {
          pushSlotOrFallback(
            1, 'gate-hardware',
            { gate_type: 'barr', finish: 'B' },
            { description: `D&D Magna-Latch + TruClose Hinge Kit (Black, pool compliant)`, sku: `ML-TL-TC-H-AT` },
          );
        } else {
          pushSlotOrFallback(
            1, 'gate-latch',
            { gate_type: 'barr', finish: 'W' },
            { description: `D&D Magna-Latch Top Pull Lockable Latch (White)`, sku: `ML-TL-W` },
          );
          pushSlotOrFallback(
            1, 'gate-hinge',
            { gate_type: 'barr', finish: 'W' },
            { description: `D&D TruClose Self-Closing Hinge Pair (White)`, sku: `TC-H-AT-2L-W` },
          );
        }
        // Two cross-range gate posts (hinge + latch side) + their covers.
        pushSlotOrFallback(
          2, 'post',
          { type: 'gate-post', finish: code, mounting: basePlated ? 'base-plate' : 'standard' },
          { description: `BARR ${xPostDesc} — gate (${finishName})`, sku: xPostSku },
        );
        if (xCoverSku) {
          pushSlotOrFallback(
            2, 'post-cover',
            { type: 'cross-range', finish: code },
            { description: `BARR ${xCoverDesc} — gate post (${finishName})`, sku: xCoverSku },
          );
        }
      }

      // 5. Corner posts (design-level) — emit once on the first span. N sections → N-1 corners.
      const cornerCount = isMultiSpanCorner ? Math.max(0, (design.spans as any[]).length - 1) : 0;
      if (cornerCount > 0 && spanIndex === 0) {
        pushSlotOrFallback(
          cornerCount, 'post',
          { type: 'corner-post', finish: code, mounting: basePlated ? 'base-plate' : 'standard' },
          { description: `BARR ${xPostDesc} — corner (${finishName})`, sku: xPostSku },
        );
        if (xCoverSku) {
          pushSlotOrFallback(
            cornerCount, 'post-cover',
            { type: 'cross-range', finish: code },
            { description: `BARR ${xCoverDesc} — corner post (${finishName})`, sku: xCoverSku },
          );
        }
      }

      // 6. Fixings — substrate-driven (PTS-019 / operator 2026-06-04).
      //   Decking: M10×100 countersunk batten screws, 1 × 4-pack per 4 posts.
      //   Core-drilled: Setfast grout, 1 bag per 15 posts (+1 spare, design-level).
      //   Concrete slab / in-ground: customer-sourced (no BH fixing).
      const basePlatedPostsThisSpan = inlinePosts + gatePosts + (spanIndex === 0 ? cornerCount : 0);
      if (substrate === "decking" && basePlatedPostsThisSpan > 0) {
        pushSlotOrFallback(
          Math.ceil(basePlatedPostsThisSpan / 4), 'fixing',
          { type: 'csk', substrate: 'decking' },
          { description: `M10 x 100mm Countersunk Batten Screws 4-pack`, sku: `CSK-100-4PK` },
        );
      } else if (coreDrilled) {
        const coreThisSpan = inlinePosts + gatePosts + (spanIndex === 0 ? cornerCount : 0);
        if (coreThisSpan > 0) {
          pushSlotOrFallback(
            Math.ceil(coreThisSpan / 15) + (spanIndex === 0 ? 1 : 0), 'grout',
            { type: 'setfast' },
            { description: `Setfast Non-Shrink Grout 10kg (incl. spare)`, sku: `GROUT-SETFAST-10KG` },
          );
        }
      }

      return;
    }
    // Tubular Flat Top — full component emission (SF-3 / PTS-024 / inputs spec 2026-05-25
    // + SF-3 Path C lock). 3 finishes {Black, White, Monument}; finish drives every SKU
    // and the range prefix (White borrows the Xpress XP- range; Black/Monument use Six
    // Star SS-). 3000mm stock is Black-only. Shrouds are the tubular bracket-equivalent
    // (SS-BH4 kit per panel); horizontal swivel shrouds at angled corners. Gate hardware
    // is finish-asymmetric: B/MN = 1 bundled D&D kit, White = 2 separate SKUs.
    else if (isTubularFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const tubularFinish = span.tubularFinish || "black";
      const code = tubularFinish === "black" ? "B" : tubularFinish === "white" ? "W" : "MN";
      const finishName = tubularFinish === "black" ? "Black" : tubularFinish === "white" ? "White" : "Monument";
      const isWhite = code === "W";
      const substrate = (span.fieldValues?.["tubular-substrate"] as string) || "decking";
      const basePlated = substrate === "decking" || substrate === "concrete-slab";
      const coreDrilled = substrate === "core-drilled";
      // Stock width: White/Monument are 2450 only; Black may use 2450 or 3000.
      const stockWidth = (code === "B" && span.tubularPanelWidth === "3000mm") ? 3000 : 2450;

      const panelTypes = span.panelLayout.panelTypes || [];

      // 1. Panels (real storefront SKUs) — standard / cut. (Gate panel in the gate block.)
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";
        if (panelType === "gate") return;
        const panelSku = stockWidth === 3000 ? `SS-FTP-3000-B` : `SS-FTP-2450-${code}`;
        if (panelWidth === stockWidth) {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'standard', stock_width: String(stockWidth), height: '1200mm', cut_width: String(panelWidth), finish: code },
            { description: `Flat Top Panel ${stockWidth} x 1200mm (${finishName})`, sku: panelSku },
          );
        } else {
          pushSlotOrFallback(
            1, 'panel',
            { type: 'cut', stock_width: String(stockWidth), height: '1200mm', cut_width: String(panelWidth), finish: code },
            { description: `Flat Top Panel 1200H, cut to ${panelWidth}mm from ${stockWidth}mm (${finishName})`, sku: panelSku },
          );
        }
      });

      const nonGatePanels = span.panelLayout.panels.filter((_: number, i: number) => (panelTypes[i] || "standard") !== "gate").length;
      const hasGate = gatesAllowed && !!span.gateConfig?.required;
      const numPosts = span.panelLayout.gaps.length;
      const angledCorners = parseInt(String(span.fieldValues?.["tubular-angled-corners"] ?? "0"), 10) || 0;

      // 2. Standard shroud kits — 1 per panel (the tubular bracket-equivalent).
      if (nonGatePanels > 0) {
        pushSlotOrFallback(
          nonGatePanels, 'shroud-kit',
          { type: 'standard', finish: code },
          { description: `Flat Top Shroud Kit 4-pack (${finishName})`, sku: `SS-BH4-${code}` },
        );
      }

      // 3. Horizontal swivel shrouds — 4 per ANGLED (non-90°) corner (single-unit SKU).
      if (angledCorners > 0) {
        pushSlotOrFallback(
          angledCorners * 4, 'shroud-swivel',
          { type: 'horizontal', finish: code },
          { description: `Flat Top Horizontal Swivel Shroud (${finishName})`, sku: `SS-BSWIV-HORIZ-${code}` },
        );
      }

      // 4. Posts (substrate-driven, cross-range White) + domical covers (base-plated only).
      if (numPosts > 0) {
        if (basePlated) {
          pushSlotOrFallback(
            numPosts, 'post',
            { height: '1300', finish: code, mounting: 'base-plate' },
            { description: `Flat Top 1300mm Base Plate Post (${finishName})`, sku: isWhite ? `XP-1300-BP-W` : `SS-1300-BP-${code}` },
          );
          pushSlotOrFallback(
            numPosts, 'post-cover',
            { type: 'domical', finish: code },
            { description: `Flat Top Domical Cover (${finishName})`, sku: isWhite ? `XP-DC-2P-W` : `SS-DC-${code}` },
          );
        } else {
          pushSlotOrFallback(
            numPosts, 'post',
            { height: '1800', finish: code, mounting: 'standard' },
            { description: `Flat Top 1800mm Post (${finishName})`, sku: isWhite ? `XP-1800-FP-W` : `SS-1800-${code}` },
          );
        }
      }

      // 5. Gate — panel + finish-asymmetric D&D hardware (Path C).
      if (hasGate) {
        pushSlotOrFallback(
          1, 'panel',
          { type: 'gate', height: '1200mm', width: String(span.gateConfig.gateSize || 975), finish: code },
          { description: `Flat Top Gate 975 x 1200mm (${finishName})`, sku: `SS-FTG-0975-${code}` },
        );
        if (isWhite) {
          pushSlotOrFallback(
            1, 'gate-latch',
            { gate_type: 'tubular', finish: 'W' },
            { description: `D&D Magna-Latch Top Pull Lockable Latch (White)`, sku: `ML-TL-W` },
          );
          pushSlotOrFallback(
            1, 'gate-hinge',
            { gate_type: 'tubular', finish: 'W' },
            { description: `D&D TruClose Self-Closing Hinge Pair (White)`, sku: `TC-H-AT-2L-W` },
          );
        } else {
          pushSlotOrFallback(
            1, 'gate-hardware',
            { gate_type: 'tubular', finish: code },
            { description: `D&D Magna-Latch + TruClose Hinge Kit (Black, pool compliant)`, sku: `ML-TL-TC-H-AT` },
          );
        }
      }

      // 6. Fixings — decking CSK 1 pack / 4 posts (operator ruling 2026-06-04, consistent
      //    with Blade + BARR); core grout 1 bag / 10 posts (+1 spare; tubular is 10/bag);
      //    concrete-slab + in-ground customer-sourced.
      if (substrate === "decking" && numPosts > 0) {
        pushSlotOrFallback(
          Math.ceil(numPosts / 4), 'fixing',
          { type: 'csk', substrate: 'decking' },
          { description: `M10 x 100mm Countersunk Batten Screws 4-pack`, sku: `CSK-100-4PK` },
        );
      } else if (coreDrilled && numPosts > 0) {
        pushSlotOrFallback(
          Math.ceil(numPosts / 10) + (spanIndex === 0 ? 1 : 0), 'grout',
          { type: 'setfast' },
          { description: `Setfast Non-Shrink Grout 10kg (incl. spare)`, sku: `GROUT-SETFAST-10KG` },
        );
      }

      return;
    }
    // Aluminium Balustrade — BARR
    // Aluminium Balustrade — BARR (SF-12 / inputs spec 2026-05-26). 1733×1000 panel,
    // 2 finishes; AIRE posts + XP covers + 3D fixings via the shared helper. No gates.
    // Emitted ONCE at span 0 with design-level totals (corner topology is cross-section).
    else if (isBalBarr && span.panelLayout && span.panelLayout.panels.length > 0) {
      if (spanIndex !== 0) return;
      const finishKey = (span.balBarrFinish || "black") as "black" | "white";
      const code: "B" | "W" = finishKey === "black" ? "B" : "W";
      const finishName = finishKey === "black" ? "Satin Black" : "Pearl White";
      const substrate = (span.fieldValues?.["bal-substrate"] as string) || "base-plated";
      const material = (span.fieldValues?.["bal-material"] as string) || "timber";
      const corners = span.fieldValues?.["bal-corners"] != null
        ? (parseInt(String(span.fieldValues["bal-corners"]), 10) || 0)
        : balCornersFromShape();

      // 1. Panels (real SKU, standard / cut) across every section.
      let totalPanels = 0;
      (design.spans as any[]).forEach((s: any) => {
        const panels: number[] = s.panelLayout?.panels ?? [];
        const types = s.panelLayout?.panelTypes ?? panels.map(() => "standard");
        panels.forEach((w: number, i: number) => {
          if ((types[i] || "standard") === "gate") return;
          totalPanels++;
          if (w === 1733) {
            pushSlotOrFallback(1, 'panel',
              { type: 'standard', width: '1733', height: '1000', finish: code },
              { description: `BARR Balustrade Panel 1733 x 1000mm (${finishName})`, sku: `BR-PANEL-1733-1000-${code}` });
          } else {
            pushSlotOrFallback(1, 'panel',
              { type: 'cut', width: String(w), height: '1000', finish: code },
              { description: `BARR Balustrade Panel 1000H, cut to ${w}mm from 1733mm (${finishName})`, sku: `BR-PANEL-1733-1000-${code}` });
          }
        });
      });

      // 2. Brackets + caps — 1 kit each per panel (BR- aesthetic tier).
      if (totalPanels > 0) {
        pushSlotOrFallback(totalPanels, 'bracket', { type: 'c-bracket-60', finish: code },
          { description: `BARR Extended C-Bracket Kit 4-pack (${finishName})`, sku: `BR-BR60-${code}-4PK` });
        pushSlotOrFallback(totalPanels, 'bracket-cap', { finish: code },
          { description: `BARR Bracket Cap 4-pack (${finishName})`, sku: `BR-BRCAP-${code}-4PK` });
      }

      // 3. Posts + covers + fixings — shared AIRE/substrate engine.
      emitBalHardware(code, finishName, substrate, material, totalPanels, corners);
      return;
    }
    // Aluminium Balustrade — Blade (SF-13 / inputs spec 2026-05-26). Black-only,
    // 1700×1000 panel, FF-BH-OPEN brackets (no cap); same AIRE/XP/fixings engine as
    // BARR Bal. No c-to-c ceiling (40×40 SHS rail spans full stock). Emitted once at span 0.
    else if (isBalBlade && span.panelLayout && span.panelLayout.panels.length > 0) {
      if (spanIndex !== 0) return;
      const substrate = (span.fieldValues?.["bal-substrate"] as string) || "base-plated";
      const material = (span.fieldValues?.["bal-material"] as string) || "timber";
      const corners = span.fieldValues?.["bal-corners"] != null
        ? (parseInt(String(span.fieldValues["bal-corners"]), 10) || 0)
        : balCornersFromShape();

      // 1. Panels (real SKU, standard / cut) — Black only.
      let totalPanels = 0;
      (design.spans as any[]).forEach((s: any) => {
        const panels: number[] = s.panelLayout?.panels ?? [];
        panels.forEach((w: number) => {
          totalPanels++;
          if (w === 1700) {
            pushSlotOrFallback(1, 'panel',
              { type: 'standard', width: '1700', height: '1000', finish: 'B' },
              { description: `Blade Balustrade Panel 1700 x 1000mm (Black)`, sku: `BLA-PNL-1700-1000-B` });
          } else {
            pushSlotOrFallback(1, 'panel',
              { type: 'cut', width: String(w), height: '1000', finish: 'B' },
              { description: `Blade Balustrade Panel 1000H, cut to ${w}mm from 1700mm (Black)`, sku: `BLA-PNL-1700-1000-B` });
          }
        });
      });

      // 2. FastFit brackets — 1 kit per panel (no cap for the FF- family).
      if (totalPanels > 0) {
        pushSlotOrFallback(totalPanels, 'bracket', { type: 'fastfit-open', finish: 'B' },
          { description: `Blade FastFit Open Bracket 4-pack (Black)`, sku: `FF-BH-OPEN-4PK-B` });
      }

      // 3. Posts + covers + fixings — shared AIRE/substrate engine (Black).
      emitBalHardware("B", "Black", substrate, material, totalPanels, corners);
      return;
    }

    // Glass and other fencing types
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      const panels = span.panelLayout.panels;
      const panelTypes = span.panelLayout.panelTypes || [];

      panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "standard") {
          if (isGlassBalPanel) {
            // Balustrade glass: correct family/height/thickness + AS1288 laminated swap at ≥5m.
            const fallBand = (span.fieldValues?.["glass-bal-fall-height"] as string) || "1m-5m";
            const line = balGlassLine(design.productVariant, fallBand, panelWidth);
            components.push({ qty: 1, description: line.description, sku: line.sku });
          } else {
            const mappedProduct = lookupSlot("glass-panels", { size_mm: String(panelWidth) });

            if (mappedProduct) {
              components.push({
                qty: 1,
                description: mappedProduct.description,
                sku: mappedProduct.sku,
              });
            } else {
              // Real 12mm frameless pool-glass family (12N-{width}, zero-padded to 4 digits).
              // Off-step equalised widths are made-to-size against this family.
              components.push({
                qty: 1,
                description: `12mm Clear Toughened Frameless Glass ${panelWidth}W × 1200H`,
                sku: `12N-${String(panelWidth).padStart(4, "0")}`,
              });
            }
          }
        } else if (panelType === "raked") {
          const isLeftRaked = index === 0 && span.leftRakedPanel?.enabled;
          const height = isLeftRaked ? span.leftRakedPanel?.height : span.rightRakedPanel?.height;

          if (isLeftRaked) {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (400mm horizontal at ${height}mm, steps down to 1200mm) 12mm thick`,
              sku: `RP-L-1200-${height}-12`,
            });
          } else {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (steps down from 1200mm to ${height}mm over 800mm, horizontal 400mm) 12mm thick`,
              sku: `RP-R-1200-${height}-12`,
            });
          }
        } else if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Gate Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-GATE-${panelWidth}-1200-12`,
          });
        } else if (panelType === "custom") {
          const customHeight = span.customPanel?.height || 1200;
          components.push({
            qty: 1,
            description: `Custom Glass Panel ${panelWidth}mm x ${customHeight}mm (12mm thick)`,
            sku: `GP-CUSTOM-${panelWidth}-${customHeight}-12`,
          });
        } else if (panelType === "hinge") {
          components.push({
            qty: 1,
            description: `Hinge Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-HINGE-${panelWidth}-1200-12`,
          });
        }

        // Add hardware per panel - either spigots OR channel clamps
        // Skip for standoff systems — standoff hardware is emitted later inside the
        // isGlassBalustrade block at 4 per panel.
        if (!isChannelSystem && !isStandoffSystem && !isBalChannel) {
          const fieldValues = (span as any).fieldValues || {};
          const mounting = fieldValues['spigot-mounting'] || (span as any).spigotMounting || 'base-plate';
          const finish = fieldValues['spigot-color'] || (span as any).spigotColor || 'polished';
          const family = fieldValues['spigot-family'] || '';
          const discriminators: Record<string, string> = { mounting, finish };
          if (family) discriminators.family = family;

          const slotResult = lookupSlot('spigot-hardware', discriminators);
          if (slotResult) {
            components.push({ qty: 2, description: slotResult.description, sku: slotResult.sku });
          } else {
            // Real catalogue spigot SKU keyed by family; placeholder only for unmapped families.
            const real = spigotSku(family, mounting, finish);
            if (real) {
              components.push({ qty: 2, description: real.label, sku: real.sku });
            } else {
              const fallback = getSpigotDetails(mounting as SpigotMounting, finish as SpigotColor);
              components.push({ qty: 2, description: fallback.description, sku: fallback.sku });
            }
          }
        }
      });

      // Channel system hardware (per span)
      if (isChannelSystem) {
        const spanLength = span.length;
        const channelLength = 4200;

        const numChannels = Math.ceil(spanLength / channelLength);
        const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";

        components.push({
          qty: numChannels,
          description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
          sku: `VC-4200-${span.channelMounting || "ground"}`,
        });

        const numClamps = Math.ceil(spanLength / 300) + 2;
        components.push({
          qty: numClamps,
          description: `Channel Friction Clamp (300mm spacing)`,
          sku: `CFC-300`,
        });

        components.push({
          qty: 2,
          description: `Channel End Cap`,
          sku: `CEC-STD`,
        });
      }

      // Gate hardware
      if (gatesAllowed && span.gateConfig?.required) {
        const hingeType = (span.gateConfig.hingeType || "glass-to-glass") as HingeType;
        const latchType = (span.gateConfig.latchType || "glass-to-glass") as LatchType;
        const hardware = (span.gateConfig.hardware || "polaris") as GateHardware;
        const hingeDetails = getHingeDetails(hingeType, hardware);
        const latchDetails = getLatchDetails(latchType);
        const gateSize = String(span.gateConfig.gateSize);

        // hinge-set discriminators: { type, finish } — "finish" carries the hardware line (e.g. polaris,
        // master-range) since the existing model has no separate finish parameter for gate hardware.
        pushSlotOrFallback(
          1,
          'hinge-set',
          { type: hingeType, finish: hardware, gate_size: gateSize },
          {
            description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
          },
        );

        pushSlotOrFallback(
          1,
          'latch-set',
          { type: latchType, finish: hardware, gate_size: gateSize },
          {
            description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
          },
        );

        if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
          components.push({
            qty: 1,
            description: `Polaris/Atlantic Post Adapter Plate`,
            sku: `PAP-POLARIS`,
          });
        }
      }
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const effectiveLength = span.length;
      const fallbackPanelWidth = span.maxPanelWidth;
      const fallbackGapSize = span.desiredGap;
      const numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));

      if (numPanels > 0) {
        components.push({
          qty: numPanels,
          description: `12mm Clear Toughened Frameless Glass ${fallbackPanelWidth}W × 1200H [provisional]`,
          sku: `12N-${String(fallbackPanelWidth).padStart(4, "0")}`,
        });

        if (!isChannelSystem && !isStandoffSystem && !isBalChannel) {
          const fieldValues = (span as any).fieldValues || {};
          const mounting = fieldValues['spigot-mounting'] || (span as any).spigotMounting || 'base-plate';
          const finish = fieldValues['spigot-color'] || (span as any).spigotColor || 'polished';
          const family = fieldValues['spigot-family'] || '';
          const discriminators: Record<string, string> = { mounting, finish };
          if (family) discriminators.family = family;
          const slotResult = lookupSlot('spigot-hardware', discriminators);
          if (slotResult) {
            components.push({ qty: numPanels * 2, description: slotResult.description, sku: slotResult.sku });
          } else {
            const fallback = getSpigotDetails(mounting as SpigotMounting, finish as SpigotColor);
            components.push({ qty: numPanels * 2, description: fallback.description, sku: fallback.sku });
          }
        } else if (isChannelSystem) {
          const spanLength = span.length;
          const channelLength = 4200;
          const numChannels = Math.ceil(spanLength / channelLength);
          const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";

          components.push({
            qty: numChannels,
            description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
            sku: `VC-4200-${span.channelMounting || "ground"}`,
          });

          const numClamps = Math.ceil(spanLength / 300) + 2;
          components.push({
            qty: numClamps,
            description: `Channel Friction Clamp (300mm spacing)`,
            sku: `CFC-300`,
          });

          components.push({
            qty: 2,
            description: `Channel End Cap`,
            sku: `CEC-STD`,
          });
        }

        if (gatesAllowed && span.gateConfig?.required) {
          const hingeType = (span.gateConfig.hingeType || "glass-to-glass") as HingeType;
          const latchType = (span.gateConfig.latchType || "glass-to-glass") as LatchType;
          const hardware = (span.gateConfig.hardware || "polaris") as GateHardware;
          const hingeDetails = getHingeDetails(hingeType, hardware);
          const latchDetails = getLatchDetails(latchType);
          const gateSize = String(span.gateConfig.gateSize);

          pushSlotOrFallback(
            1,
            'hinge-set',
            { type: hingeType, finish: hardware, gate_size: gateSize },
            {
              description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
              sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
            },
          );

          pushSlotOrFallback(
            1,
            'latch-set',
            { type: latchType, finish: hardware, gate_size: gateSize },
            {
              description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
              sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
            },
          );

          if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
            components.push({
              qty: 1,
              description: `Polaris/Atlantic Post Adapter Plate`,
              sku: `PAP-POLARIS`,
            });
          }
        }
      }
    }
  });

  // Top-mounted rail optimization for glass balustrade variants
  // Note: startsWith("glass-bal-spigots") matches both 12mm and 15mm suffixed variants
  // that home.tsx sends. The unsuffixed legacy string is also matched by startsWith.
  const isGlassBalustrade = design.productVariant.startsWith("glass-bal-spigots") ||
                           design.productVariant === "glass-bal-channel" ||
                           design.productVariant === "glass-bal-channel-hd" ||
                           design.productVariant === "glass-bal-standoffs";

  if (isGlassBalustrade) {
    // ── Channel hardware (VersaTilt deck-mount) — channel kit + glazing rubber + friction
    //    plates + stabilising washers + end plates + alignment pins. Keyed by variant:
    //    standard = VersaTilt (PTS-003, 4200mm); HD = VersaTilt Heavy Duty (PTS-028, 3600mm).
    //    NOTE: HD consumable SKUs (glazing rubber, end plates) are DERIVED — operator to seed.
    if (isBalChannel) {
      const stockMm = isBalChannelHd ? 3600 : 4200;
      const finishCode = ((design.spans as any[])[0]?.fieldValues?.["channel-finish"] === "black") ? "B" : "SA";
      const channelSku = isBalChannelHd ? `VER-HD-3600-DMK-${finishCode}` : `VER-4200-DMK-${finishCode}`;
      const plateSku = isBalChannelHd ? `VER-HD-PPKIT-17-4PK` : `VER-PPKIT-15MM`;
      const plin = isBalChannelHd ? 4 : 1; // HD friction plates ship as a 4-pack
      const washerSku = isBalChannelHd ? `VER-HD-WASHER-18PK` : `VER-WASHER-14PK`;
      const rubberSku = isBalChannelHd ? `VER-HD-17KIT-RUB-2PK` : `VER-15KIT-RUB`;
      const endPlateSku = isBalChannelHd ? `VER-HD-2DMEP-${finishCode}` : `VER-2DMEP-${finishCode}`;
      const chName = isBalChannelHd ? "VersaTilt HD Channel 3600mm Deck-Mount Kit" : "VersaTilt Channel 4200mm Deck-Mount Kit";

      let totalPlates = 0;
      let totalPins = 0;
      (design.spans as any[]).forEach((span: any) => {
        const panels: number[] = span.panelLayout?.panels ?? [];
        if (!panels.length) return;
        const runMm = span.panelLayout?.totalPanelWidth || panels.reduce((a: number, b: number) => a + b, 0);
        const channels = Math.max(1, Math.ceil(runMm / stockMm));

        // Channel kit + glazing rubber (always-substitute) + stabilising washers — 1 per channel length.
        components.push({ qty: channels, description: `${chName} (${finishCode === "B" ? "Black" : "Satin Anodised"})`, sku: channelSku });
        components.push({ qty: channels, description: `${isBalChannelHd ? "17.52mm" : "15mm"} Glass Channel Glazing Rubber Kit`, sku: rubberSku });
        components.push({ qty: channels, description: `VersaTilt${isBalChannelHd ? " HD" : ""} Stabilising Washer Pack`, sku: washerSku });

        // Friction plates — per-panel geometric formula (100mm wide, 25mm setback, 300mm max centres).
        const platesThisSpan = panels.reduce((sum, w) => sum + (Math.ceil((w - 150) / 300) + 1), 0);
        totalPlates += platesThisSpan;

        // End plates — one 2-pack caps the open ends of the section's channel run.
        components.push({ qty: 1, description: `VersaTilt${isBalChannelHd ? " HD" : ""} Channel End Plate 2-Pack (${finishCode === "B" ? "Black" : "Satin Anodised"})`, sku: endPlateSku });

        // Alignment pins — 2 per inline channel-to-channel join within the section.
        totalPins += 2 * Math.max(0, channels - 1);

        // HD only: the 35-Series rail needs a 17.52 runner insert (the bundled 15mm rubber
        // won't seat 17.52 glass) — 1 per rail stock length (5800mm). SKU derived.
        if (isBalChannelHd) {
          const rails = Math.max(1, Math.ceil(runMm / 5800));
          components.push({ qty: rails, description: `35-Series Rail 17.52 Runner Insert`, sku: `SER35-RUB-17.52MM` });
        }
      });

      if (totalPlates > 0) {
        components.push({
          qty: Math.ceil(totalPlates / plin),
          description: isBalChannelHd ? `VersaTilt HD Friction Plate (suits 17.52mm), 4-pack` : `VersaTilt Friction Plate (suits 15mm)`,
          sku: plateSku,
        });
      }
      if (totalPins > 0) {
        components.push({ qty: Math.ceil(totalPins / 10), description: `VersaTilt Channel Alignment Pins (10-pack)`, sku: `VER-PINS` });
      }
    }
    // Standoff hardware — real catalogue SKUs (was placeholder STANDOFF-50-*):
    //   Adjustable → GSA-50{30|45}-{B/MW/P/S}   Fixed → GS50{30|50}{B/P/S} (white = -MW)
    // Count per pre-drilled panel: 4 if ≤750mm wide, else 6 (SF-16 hole pattern).
    if (isStandoffSystem) {
      const F: Record<string, string> = { polished: "P", satin: "S", black: "B", white: "MW" };
      (design.spans as any[]).forEach((span: any) => {
        const panels: number[] = span.panelLayout?.panels ?? [];
        if (panels.length === 0) return;
        const fieldValues = (span as any).fieldValues || {};
        const finish = (span as any).spigotColor || fieldValues["standoff-finish"] || "polished";
        const body = fieldValues["standoff-body"] || "adjustable";
        const depth = fieldValues["standoff-depth"] || (body === "fixed" ? "30" : "30");
        const f = F[finish] || "P";
        const sku = body === "fixed"
          ? (f === "MW" ? `GS50${depth}-MW` : `GS50${depth}${f}`)
          : `GSA-50${depth}-${f}`;
        const qty = panels.reduce((sum, w) => sum + (w <= 750 ? 4 : 6), 0);
        const bodyLabel = body === "fixed" ? "Fixed" : "Adjustable";
        pushSlotOrFallback(
          qty,
          "standoff-hardware",
          { finish, body, depth },
          { description: `50mm ${bodyLabel} Glass Standoff ${depth}mm (${finish})`, sku },
        );
      });
    }

    const railGroups = new Map<string, {
      config: { type: HandrailType; material: HandrailMaterial; finish: HandrailFinish };
      spans: { length: number; startTermination: RailTerminationType; endTermination: RailTerminationType }[];
    }>();

    (design.spans as any[]).forEach((span: any) => {
      if (span.handrail?.enabled) {
        const configKey = `${span.handrail.type}-${span.handrail.material}-${span.handrail.finish}`;

        if (!railGroups.has(configKey)) {
          railGroups.set(configKey, {
            config: {
              type: span.handrail.type as HandrailType,
              material: span.handrail.material as HandrailMaterial,
              finish: span.handrail.finish as HandrailFinish,
            },
            spans: [],
          });
        }

        let actualRailLength: number;

        if (span.panelLayout && span.panelLayout.panels.length > 0) {
          actualRailLength = span.panelLayout.totalPanelWidth;
        } else {
          const leftGapSize = span.leftGap?.enabled ? span.leftGap.size : 0;
          const rightGapSize = span.rightGap?.enabled ? span.rightGap.size : 0;
          actualRailLength = span.length - leftGapSize - rightGapSize;
        }

        if (actualRailLength <= 0) {
          return;
        }

        railGroups.get(configKey)!.spans.push({
          length: actualRailLength,
          startTermination: (span.handrail.startTermination || "end-cap") as RailTerminationType,
          endTermination: (span.handrail.endTermination || "end-cap") as RailTerminationType,
        });
      }
    });

    railGroups.forEach((group) => {
      const spanLengths = group.spans.map(s => s.length);
      const optimization = optimizeRailLengths(spanLengths);

      const railTypeNames: Record<string, string> = {
        "nonorail-25x21": "25×21mm NonoRail",
        "nanorail-30x21": "30×21mm NanoRail",
        "series-35x35": "35×35mm Series 35",
      };

      const finishNamesMap: Record<string, string> = {
        "polished": "Polished",
        "satin": "Satin",
        "black": "Black",
        "white": "White",
      };

      const railTypeName = railTypeNames[group.config.type];
      const finishName = finishNamesMap[group.config.finish];
      const r = railSkus(group.config.type, group.config.finish);

      if (optimization.standardLengths > 0) {
        // Real rail length SKU — bundles glazing rubber + 2 factory-fitted end caps.
        components.push({
          qty: optimization.standardLengths,
          description: `Top Rail ${railTypeName} 5800mm (${r.family}, ${finishName})`,
          sku: r.rail,
        });

        // Inline joiners — one per join within each section (CEIL(len/5800) − 1).
        const inlineJoins = group.spans.reduce((sum, s) => sum + Math.max(0, Math.ceil(s.length / 5800) - 1), 0);
        if (inlineJoins > 0) {
          components.push({
            qty: inlineJoins,
            description: `${railTypeName} Inline Joiner (${r.family})`,
            sku: r.inlineJoiner,
          });
        }

        if (optimization.wastage > 0) {
          components.push({
            qty: 1,
            description: `Rail cut-optimisation note: ${optimization.totalLength}mm required, ${optimization.wastage}mm offcut across ${optimization.standardLengths} × 5800mm — our team reviews cut lengths before processing`,
            sku: `RAIL-OPT-NOTE`,
          });
        }
      }

      const terminationCounts = new Map<string, number>();

      group.spans.forEach((span) => {
        terminationCounts.set(span.startTermination, (terminationCounts.get(span.startTermination) || 0) + 1);
        terminationCounts.set(span.endTermination, (terminationCounts.get(span.endTermination) || 0) + 1);
      });

      const terminationNames: Record<string, string> = {
        "end-cap": "End Cap",
        "wall-tie": "Wall Tie",
        "90-degree": "90° Corner",
        "adjustable-corner": "Adjustable Corner",
      };

      terminationCounts.forEach((count, termination) => {
        if (count <= 0) return;
        // end-cap is factory-fitted to the rail length SKU → no separate emission.
        const sku = r.term(termination);
        if (!sku) return;
        components.push({
          qty: count,
          description: `${railTypeName} ${terminationNames[termination]} (${r.family}, ${finishName})`,
          sku,
        });
      });
    });
  }

  // Consolidate duplicate components by SKU (falls back to description if no SKU)
  const consolidated: Component[] = [];
  components.forEach((comp) => {
    const key = comp.sku || comp.description;
    const existing = consolidated.find((c) => (c.sku || c.description) === key);
    if (existing) {
      existing.qty += comp.qty;
    } else {
      consolidated.push({ ...comp });
    }
  });

  // Sort components
  const sorted = consolidated.sort((a, b) => {
    const extractPanelWidth = (desc: string): number => {
      const match = desc.match(/(\d+)mm/);
      return match ? parseInt(match[1]) : 0;
    };

    const getCategory = (desc: string): number => {
      if (desc.includes('Glass Panel') || desc.includes('Raked Glass Panel') ||
          desc.includes('Gate Panel') || desc.includes('Hinge Panel') || desc.includes('Custom Glass Panel')) {
        return 1;
      }
      if (desc.includes('BARR Panel') || desc.includes('BARR Gate Panel')) {
        return 1;
      }
      if (desc.includes('Spigot')) return 2;
      if (desc.includes('Channel')) return 3;
      if (desc.includes('Post')) return 4;
      if (desc.includes('Hinge Set') || desc.includes('D&D Hinge')) return 5;
      if (desc.includes('Latch') || desc.includes('D&D Latch')) return 6;
      return 7;
    };

    const categoryA = getCategory(a.description);
    const categoryB = getCategory(b.description);

    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }

    if (categoryA === 1) {
      const widthA = extractPanelWidth(a.description);
      const widthB = extractPanelWidth(b.description);
      return widthB - widthA;
    }

    return 0;
  });

  return sorted;
}

/**
 * Strip SKUs from components for the public response.
 * Per CLAUDE.md: "Response from /api/quote contains descriptions only, NO supplier SKUs"
 */
export function stripSkus(components: Component[]): Array<{ qty: number; description: string }> {
  return components.map(({ qty, description }) => ({ qty, description }));
}
