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
    sku: laminated ? `${family}-${width}-LAM` : `${family}-${width}`,
    description: `${thick}mm ${buildWord} ${label} ${width}W × ${height}H${drilled}`,
  };
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
    design.productVariant === "glass-bal-standoffs";
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
    else if (isBalBarr && span.panelLayout && span.panelLayout.panels.length > 0) {
      const panelHeight = (span.balBarrPanelHeight || "1000mm") as "1000mm" | "1200mm";
      const finishKey = (span.balBarrFinish || "black") as "black" | "white";
      const postMounting = (span.balBarrPostMounting || "face-mount") as "face-mount" | "base-plated" | "full-post-core-drill";

      const panelSpecs: Record<string, { width: number; height: number }> = {
        "1000mm": { width: 1733, height: 1000 },
        "1200mm": { width: 2205, height: 1200 },
      };
      const spec = panelSpecs[panelHeight];
      const finishLetter = finishKey === "black" ? "B" : "W";

      const panelTypes = span.panelLayout.panelTypes || [];

      // Panels
      span.panelLayout.panels.forEach((_panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";
        if (panelType === "raked") {
          pushSlotOrFallback(
            1,
            'rake-panel',
            { width: '1380', height: '1000', finish: finishKey },
            {
              description: `Bal BARR Rake Panel 1380×1000 (${finishKey})`,
              sku: `BR-RAKE-1380-1000-${finishLetter}`,
            },
          );
        } else {
          pushSlotOrFallback(
            1,
            'panel',
            { width: String(spec.width), height: String(spec.height), finish: finishKey },
            {
              description: `Bal BARR Panel ${spec.width}×${spec.height} (${finishKey})`,
              sku: `BR-PANEL-${spec.width}-${spec.height}-${finishLetter}`,
            },
          );
        }
      });

      const numPanels = span.panelLayout.panels.length;
      // For BARR-style fencing, panel junctions = mid posts; span ends = end posts (one 2-pack covers L+R).
      const midPostCount = Math.max(0, numPanels - 1);
      const endPostPackCount = 1; // one 2-pack per span termination set

      if (postMounting === "full-post-core-drill") {
        // Full posts at each junction + ends (numPanels + 1 total positions, but full-post is one piece per position)
        const fullPostCount = numPanels + 1;
        pushSlotOrFallback(
          fullPostCount,
          'full-post',
          { length: '5800', mounting: 'core-drill', finish: finishKey },
          {
            description: `Bal BARR Full Post 5800mm core-drill (${finishKey})`,
            sku: `AR-5800-FP-${finishLetter}`,
          },
        );
      } else {
        // Mid posts (intermediate junctions)
        if (midPostCount > 0) {
          const midPostHeight = postMounting === "face-mount" ? "1500" : "1050";
          const midPostType = postMounting === "face-mount" ? "face-mount" : "base-plated";
          const midPostSkuMid = postMounting === "face-mount" ? "FMID" : "FPBP";
          pushSlotOrFallback(
            midPostCount,
            'mid-post',
            { type: midPostType, height: midPostHeight, finish: finishKey },
            {
              description: `Bal BARR Mid Post ${midPostHeight}mm ${midPostType} (${finishKey})`,
              sku: `AR-${midPostHeight}-${midPostSkuMid}-${finishLetter}`,
            },
          );
        }
        // End posts (2-pack covers L+R)
        pushSlotOrFallback(
          endPostPackCount,
          'end-post',
          { type: 'face-mount', height: '1500', finish: finishKey },
          {
            description: `Bal BARR End Post 1500mm face-mount 2-pack (${finishKey})`,
            sku: `AR-1500-FMLR-${finishLetter}-2PK`,
          },
        );
      }

      const totalPostCount = postMounting === "full-post-core-drill" ? (numPanels + 1) : (midPostCount + 2);

      // C-brackets: 2 per post, packaged in 4-packs. qty = ceil(2 × postCount / 4)
      const cBracketPacks = Math.ceil((2 * totalPostCount) / 4);
      pushSlotOrFallback(
        cBracketPacks,
        'c-bracket',
        { type: 'standard', finish: finishKey },
        {
          description: `Bal BARR C-Bracket 4-pack (${finishKey})`,
          sku: `BR-BR60-${finishLetter}-4PK`,
        },
      );

      // Bracket caps match c-bracket quantity
      pushSlotOrFallback(
        cBracketPacks,
        'bracket-cap',
        { finish: finishKey },
        {
          description: `Bal BARR Bracket Cap 4-pack (${finishKey})`,
          sku: `BR-BRCAP-${finishLetter}-4PK`,
        },
      );

      // Top cap — 1 per panel
      pushSlotOrFallback(
        numPanels,
        'top-cap',
        { finish: finishKey },
        {
          description: `Bal BARR Top Cap (${finishKey})`,
          sku: `BR-TCA-${finishLetter}`,
        },
      );

      // Per-post hardware: dress-ring, top-plate, domical-cover
      pushSlotOrFallback(
        totalPostCount,
        'dress-ring',
        { finish: finishKey },
        {
          description: `Dress Ring (${finishKey})`,
          sku: `XP-DR-${finishLetter}`,
        },
      );
      pushSlotOrFallback(
        totalPostCount,
        'top-plate',
        { finish: finishKey },
        {
          description: `Top Plate (${finishKey})`,
          sku: `XP-TP-${finishLetter}`,
        },
      );
      pushSlotOrFallback(
        totalPostCount,
        'domical-cover',
        { finish: finishKey },
        {
          description: `Domical Cover 2-piece (${finishKey})`,
          sku: `XP-DC-2P-${finishLetter}`,
        },
      );

      return;
    }
    // Aluminium Balustrade — Blade (black only)
    else if (isBalBlade && span.panelLayout && span.panelLayout.panels.length > 0) {
      const postMounting = (span.balBladePostMounting || "face-mount") as "face-mount" | "full-post";
      const fullPostLen = (span.balBladeFullPostLength || "2400") as "2400" | "6000";

      const numPanels = span.panelLayout.panels.length;
      const midPostCount = Math.max(0, numPanels - 1);

      // Panels — 1700×1000 fixed, black only
      span.panelLayout.panels.forEach(() => {
        pushSlotOrFallback(
          1,
          'panel',
          { width: '1700', height: '1000' },
          {
            description: `Bal Blade Panel 1700×1000 (Black)`,
            sku: `BLA-PNL-1700-1000-B`,
          },
        );
      });

      if (postMounting === "full-post") {
        const fullPostCount = numPanels + 1;
        pushSlotOrFallback(
          fullPostCount,
          'full-post',
          { length: fullPostLen },
          {
            description: `Bal Blade Full Post ${fullPostLen}mm (Black)`,
            sku: `XP-${fullPostLen}-FP-B`,
          },
        );
        // Base plate per full post
        pushSlotOrFallback(
          fullPostCount,
          'base-plate',
          {},
          {
            description: `Bal Blade Base Plate Set (Black)`,
            sku: `XP-BP-SET-B`,
          },
        );
      } else {
        // Face-mount: mid posts + end-post 2-pack
        if (midPostCount > 0) {
          pushSlotOrFallback(
            midPostCount,
            'mid-post',
            { type: 'face-mount', height: '1500' },
            {
              description: `Bal Blade Mid Post 1500mm face-mount (Black)`,
              sku: `AR-1500-FMID-B`,
            },
          );
        }
        pushSlotOrFallback(
          1,
          'end-post',
          { type: 'face-mount', height: '1500' },
          {
            description: `Bal Blade End Post 1500mm face-mount 2-pack (Black)`,
            sku: `AR-1500-FMLR-B-2PK`,
          },
        );
      }

      const totalPostCount = postMounting === "full-post" ? (numPanels + 1) : (midPostCount + 2);

      // Brackets: fastfit-open, 4-pack
      const bracketPacks = Math.ceil((2 * totalPostCount) / 4);
      pushSlotOrFallback(
        bracketPacks,
        'bracket',
        { type: 'fastfit-open' },
        {
          description: `Bal Blade FastFit Bracket 4-pack (Black)`,
          sku: `FF-BH-OPEN-4PK-B`,
        },
      );

      // Top cap — 1 per panel
      pushSlotOrFallback(
        numPanels,
        'top-cap',
        {},
        {
          description: `Bal Blade Top Cap (Black)`,
          sku: `BLA-TCA-B`,
        },
      );

      // Per-post hardware
      pushSlotOrFallback(
        totalPostCount,
        'top-plate',
        {},
        {
          description: `Top Plate (Black)`,
          sku: `XP-TP-B`,
        },
      );
      pushSlotOrFallback(
        totalPostCount,
        'dress-ring',
        {},
        {
          description: `Dress Ring (Black)`,
          sku: `XP-DR-B`,
        },
      );
      pushSlotOrFallback(
        totalPostCount,
        'domical-cover',
        {},
        {
          description: `Domical Cover 2-piece (Black)`,
          sku: `XP-DC-2P-B`,
        },
      );

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
              components.push({
                qty: 1,
                description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
                sku: `GP-${panelWidth}-1200-12`,
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
        if (!isChannelSystem && !isStandoffSystem) {
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
            // Fallback: generic description until operator maps spigot-hardware slots
            const fallback = getSpigotDetails(mounting as SpigotMounting, finish as SpigotColor);
            components.push({ qty: 2, description: fallback.description, sku: fallback.sku });
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
          description: `Glass Panel ${fallbackPanelWidth}mm x 1200mm (12mm thick) [provisional]`,
          sku: `GP-${fallbackPanelWidth}-1200-12`,
        });

        if (!isChannelSystem && !isStandoffSystem) {
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
                           design.productVariant === "glass-bal-standoffs";

  if (isGlassBalustrade) {
    // Standoff hardware: emit 4 × 50mm standoffs per panel. Standoff balustrade is fixed
    // at 1280mm height per operator data — count is panel-based, not height-based.
    if (isStandoffSystem) {
      (design.spans as any[]).forEach((span: any) => {
        const numPanels = span.panelLayout?.panels?.length || 0;
        if (numPanels === 0) return;
        const fieldValues = (span as any).fieldValues || {};
        const finish = fieldValues['standoff-finish'] || fieldValues['spigot-color'] || (span as any).spigotColor || 'polished';
        pushSlotOrFallback(
          numPanels * 4,
          'standoff-hardware',
          { finish },
          {
            description: `50mm Glass Standoff ${finish}`,
            sku: `STANDOFF-50-${String(finish).toUpperCase()}`,
          },
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

      const materialNames: Record<string, string> = {
        "stainless-steel": "Stainless Steel",
        "anodised-aluminium": "Anodised Aluminium",
      };

      const finishNamesMap: Record<string, string> = {
        "polished": "Polished",
        "satin": "Satin",
        "black": "Black",
        "white": "White",
      };

      const railTypeName = railTypeNames[group.config.type];
      const materialName = materialNames[group.config.material];
      const finishName = finishNamesMap[group.config.finish];

      if (optimization.standardLengths > 0) {
        components.push({
          qty: optimization.standardLengths,
          description: `Top Rail ${railTypeName} 5800mm (${materialName}, ${finishName})`,
          sku: `RAIL-${group.config.type.toUpperCase()}-5800-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
        });

        if (optimization.wastage > 0) {
          components.push({
            qty: 1,
            description: `Rail Optimization: ${optimization.totalLength}mm total required, ${optimization.wastage}mm wastage from ${optimization.standardLengths} × 5800mm lengths`,
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
        if (count > 0) {
          const terminationName = terminationNames[termination];
          components.push({
            qty: count,
            description: `${railTypeName} ${terminationName} (${materialName}, ${finishName})`,
            sku: `RAIL-${group.config.type.toUpperCase()}-${termination.toUpperCase()}-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
          });
        }
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
