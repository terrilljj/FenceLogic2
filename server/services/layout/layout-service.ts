/**
 * Server-side panel layout service — the single place span layouts are computed.
 *
 * IP PROTECTION (owner, 2026-06-03): the layout solver (panel equalisation, hinge
 * rules, gate centring, stock-size logic) is proprietary and must NEVER ship to the
 * browser. The client posts a span's raw configuration to POST /api/layout and gets
 * back only the RESULT (panel widths/gaps/types + the optimal hinge size). This file
 * and everything under server/services/layout/ is server-only by location.
 *
 * This is the logic that previously ran client-side in span-config-panel.tsx's
 * layout effect + calculateOptimalHingePanelSize, ported verbatim.
 */
import type { PanelLayout } from "@shared/schema";
import { STOCK_HINGE_PANEL_SIZES } from "@shared/schema";
import {
  calculatePanelLayout,
  calculateCentredGateLayout,
  calculateBarrPanelLayout,
  calculateBladePanelLayout,
  calculateTubularPanelLayout,
  calculateHamptonsPanelLayout,
} from "./panelCalculations";

/** The span fields the layout depends on — a subset of SpanConfig, supplied by the client. */
export interface LayoutRequestSpan {
  length: number;
  maxPanelWidth: number;
  desiredGap: number;
  layoutMode?: string;
  leftGap?: { enabled: boolean; size: number } | null;
  rightGap?: { enabled: boolean; size: number } | null;
  leftRakedPanel?: { enabled: boolean; height: number } | null;
  rightRakedPanel?: { enabled: boolean; height: number } | null;
  customPanel?: { enabled: boolean; width: number; height: number; position: number } | null;
  customLayout?: {
    panels: { widthMm: number }[];
    gaps: { beforeMm: number }[];
  } | null;
  gateConfig?: {
    required: boolean;
    gateSize: number;
    hingePanelSize: number;
    autoHingePanel?: boolean;
    position: number;
    flipped: boolean;
    hingeFrom?: "glass" | "wall";
    hingeGap?: number;
    latchGap?: number;
    centreFromLeft?: number | null;
  } | null;
  // Variant-specific fields
  bladeHeight?: string;
  bladeLayoutMode?: string;
  barrHeight?: string;
  barrLayoutMode?: string;
  tubularHeight?: string;
  tubularPanelWidth?: string;
  tubularLayoutMode?: string;
  balBarrPanelHeight?: string;
  hamptonsLayoutMode?: string;
}

export interface LayoutRequest {
  productVariant: string;
  gatesAllowed: boolean;
  span: LayoutRequestSpan;
}

export interface LayoutResponse {
  panelLayout: PanelLayout | null;
  /** Best stock hinge width for "match panel size" mode (glass-to-glass gates only). */
  optimalHingePanelSize?: number;
}

/** Glass / standoff / general layout (incl. gates, raked, custom, centred gates). */
function computeGlassLayout(span: LayoutRequestSpan, gatesAllowed: boolean): PanelLayout {
  let leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
  let rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;

  // When gate is wall-mounted, the hinge end has 0 gap (attached to wall)
  if (span.gateConfig?.required && span.gateConfig.hingeFrom === "wall") {
    if (span.gateConfig.position === 0) {
      leftEndGap = 0;
    } else if (span.gateConfig.position >= 1) {
      rightEndGap = 0;
    }
  }

  const endGaps = leftEndGap + rightEndGap;
  const effectiveHingePanelSize = span.gateConfig?.hingePanelSize || 1200;

  // GATE CENTRE OVERRIDE: split the run at the gate when a centre is pinned.
  let centredLayout: PanelLayout | null = null;
  if (
    gatesAllowed &&
    span.gateConfig?.required &&
    span.gateConfig.hingeFrom !== "wall" &&
    span.gateConfig.centreFromLeft != null
  ) {
    centredLayout = calculateCentredGateLayout({
      spanLength: span.length,
      leftEndGap,
      rightEndGap,
      desiredGap: span.desiredGap,
      maxPanelWidth: span.maxPanelWidth,
      hasLeftRaked: span.leftRakedPanel?.enabled || false,
      hasRightRaked: span.rightRakedPanel?.enabled || false,
      gateConfig: {
        gateSize: span.gateConfig.gateSize,
        hingePanelSize: effectiveHingePanelSize,
        flipped: span.gateConfig.flipped,
        hingeGap: span.gateConfig.hingeGap ?? 8,
        latchGap: span.gateConfig.latchGap ?? 9,
        autoHingePanel: span.gateConfig.autoHingePanel,
        centreFromLeft: span.gateConfig.centreFromLeft,
      },
      customPanelConfig: span.customPanel?.enabled
        ? {
            enabled: span.customPanel.enabled,
            width: span.customPanel.width,
            height: span.customPanel.height,
            position: span.customPanel.position,
          }
        : undefined,
    });
  }

  return (
    centredLayout ??
    calculatePanelLayout(
      span.length,
      endGaps,
      span.desiredGap,
      span.maxPanelWidth,
      span.leftRakedPanel?.enabled || false,
      span.rightRakedPanel?.enabled || false,
      gatesAllowed && span.gateConfig?.required
        ? {
            required: span.gateConfig.required,
            gateSize: span.gateConfig.gateSize,
            hingePanelSize: effectiveHingePanelSize,
            position: span.gateConfig.position,
            flipped: span.gateConfig.flipped,
            hingeFrom: span.gateConfig.hingeFrom,
            hingeGap: span.gateConfig.hingeGap,
            latchGap: span.gateConfig.latchGap,
            autoHingePanel: span.gateConfig.autoHingePanel,
          }
        : undefined,
      span.customPanel?.enabled
        ? {
            enabled: span.customPanel.enabled,
            width: span.customPanel.width,
            height: span.customPanel.height,
            position: span.customPanel.position,
          }
        : undefined,
    )
  );
}

/**
 * Optimal stock hinge width for "match panel size" mode: run the REAL layout for each
 * stock width and keep the one whose glass is most uniform / fewest pieces.
 */
function computeOptimalHingePanelSize(span: LayoutRequestSpan, gatesAllowed: boolean): number | undefined {
  if (!span.gateConfig?.required || span.gateConfig.hingeFrom !== "glass") {
    return undefined;
  }

  const leftEndGap = span.leftGap?.enabled ? span.leftGap.size : 0;
  const rightEndGap = span.rightGap?.enabled ? span.rightGap.size : 0;
  const endGaps = leftEndGap + rightEndGap;

  let bestHingeSize = 1200;
  let bestScore = Infinity;

  for (const hingeSize of STOCK_HINGE_PANEL_SIZES) {
    const layout = calculatePanelLayout(
      span.length,
      endGaps,
      span.desiredGap,
      span.maxPanelWidth,
      span.leftRakedPanel?.enabled || false,
      span.rightRakedPanel?.enabled || false,
      {
        required: true,
        gateSize: span.gateConfig.gateSize,
        hingePanelSize: hingeSize,
        position: span.gateConfig.position,
        flipped: span.gateConfig.flipped,
        hingeFrom: span.gateConfig.hingeFrom,
        hingeGap: span.gateConfig.hingeGap,
        latchGap: span.gateConfig.latchGap,
        autoHingePanel: true, // computing the auto-match value — rule applies
      },
      span.customPanel?.enabled
        ? {
            enabled: span.customPanel.enabled,
            width: span.customPanel.width,
            height: span.customPanel.height,
            position: span.customPanel.position,
          }
        : undefined,
    );

    if (!layout.panels.length || !layout.panelTypes) continue;

    // Score, in priority order:
    //  1. Rule compliance (hinge + standards ≤2 sizes, 50mm apart) is a HARD constraint.
    //  2. Fewer (= larger) panels.
    //  3. Tie-breaks: smaller hinge/standard difference, then gaps closest to target.
    const standards = layout.panels.filter((_, i) => layout.panelTypes![i] === "standard");
    const maxDiff = standards.length > 0
      ? Math.max(...standards.map((p) => Math.abs(p - hingeSize)))
      : 0;
    const ruleBroken = maxDiff > 50;
    const score =
      (ruleBroken ? 1_000_000 : 0) +
      layout.panels.length * 1000 +
      maxDiff +
      Math.abs(layout.averageGap - span.desiredGap) / 100;

    if (score < bestScore) {
      bestScore = score;
      bestHingeSize = hingeSize;
    }
  }

  return bestHingeSize;
}

/**
 * Compute a span's panel layout. Handles every product variant the calculator offers
 * (the dispatch that previously lived in the client's layout effect).
 */
export function computeSpanLayout(request: LayoutRequest): LayoutResponse {
  const { productVariant, gatesAllowed, span } = request;

  // Fully-custom layout: convert customLayout to panelLayout for visualisation.
  if (span.layoutMode === "fully-custom" && span.customLayout) {
    const customPanels = span.customLayout.panels.map((p) => p.widthMm);
    const customGaps = span.customLayout.gaps.map((g) => g.beforeMm);
    const totalPanelWidth = customPanels.reduce((sum, w) => sum + w, 0);
    const totalGapWidth = customGaps.reduce((sum, g) => sum + g, 0);
    return {
      panelLayout: {
        panels: customPanels,
        gaps: customGaps,
        totalPanelWidth,
        totalGapWidth,
        averageGap: customGaps.length > 0 ? totalGapWidth / customGaps.length : 0,
        panelTypes: customPanels.map(() => "custom" as const),
      },
    };
  }

  // auto-calc mode: layout is managed by the client's AutoCalcPanelControls.
  if (span.layoutMode === "auto-calc") {
    return { panelLayout: null };
  }

  let layout: PanelLayout;

  if (productVariant === "alu-pool-blade") {
    const hasGate = gatesAllowed && span.gateConfig?.required;
    layout = calculateBladePanelLayout(
      span.length,
      (span.bladeHeight || "1200mm") as any,
      (span.bladeLayoutMode || "full-panels-cut-end") as any,
      !!hasGate,
      hasGate ? span.gateConfig?.gateSize || 975 : undefined,
      hasGate ? span.gateConfig?.position || 0 : 0,
      // Centre mode (owner 2026-06-03): pin the gate's centre line at a measurement
      // from the left end — same dual-mode behaviour as the glass gates.
      hasGate ? span.gateConfig?.centreFromLeft : undefined,
    );
  } else if (productVariant === "alu-pool-barr") {
    const hasGate = gatesAllowed && span.gateConfig?.required;
    layout = calculateBarrPanelLayout(
      span.length,
      (span.barrHeight || "1200mm") as any,
      (span.barrLayoutMode || "full-panels-cut-end") as any,
      !!hasGate,
      hasGate ? span.gateConfig?.gateSize || 975 : undefined,
      hasGate ? span.gateConfig?.position || 0 : 0,
      // Centre mode (owner 2026-06-03): pin the gate's centre line at a measurement
      // from the left end — same dual-mode behaviour as the glass + Blade gates.
      hasGate ? span.gateConfig?.centreFromLeft : undefined,
    );
  } else if (productVariant === "alu-pool-tubular") {
    const hasGate = gatesAllowed && span.gateConfig?.required;
    layout = calculateTubularPanelLayout(
      span.length,
      (span.tubularHeight || "1200mm") as any,
      (span.tubularPanelWidth || "2450mm") as any,
      (span.tubularLayoutMode || "full-panels-cut-end") as any,
      !!hasGate,
      hasGate ? span.gateConfig?.gateSize || 975 : undefined,
      hasGate ? span.gateConfig?.position || 0 : 0,
    );
  } else if (productVariant === "alu-bal-barr") {
    layout = calculateBarrPanelLayout(
      span.length,
      (span.balBarrPanelHeight || "1000mm") as any,
      "full-panels-cut-end",
      false,
      undefined,
      0,
    );
  } else if (productVariant === "alu-bal-blade") {
    layout = calculateBladePanelLayout(span.length, "1000mm", "full-panels-cut-end", false, undefined, 0);
  } else if (productVariant.startsWith("pvc-hamptons-")) {
    const hamptonsStyle = productVariant.replace("pvc-hamptons-", "") as any;
    const hasGate = gatesAllowed && span.gateConfig?.required;
    layout = calculateHamptonsPanelLayout(
      span.length,
      hamptonsStyle,
      (span.hamptonsLayoutMode || "full-panels-cut-end") as any,
      !!hasGate,
      hasGate ? span.gateConfig?.gateSize || 1000 : undefined,
      hasGate ? span.gateConfig?.position || 0 : 0,
    );
  } else {
    layout = computeGlassLayout(span, gatesAllowed);
  }

  return {
    panelLayout: layout,
    optimalHingePanelSize: computeOptimalHingePanelSize(span, gatesAllowed),
  };
}
