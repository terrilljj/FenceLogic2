import { composeFenceSegments, CompositionInput } from "../../shared/calc/compose";

const input: CompositionInput = {
  runLengthMm: 5000,
  startGapMm: 25,
  endGapMm: 25,
  betweenGapMm: 50,
  maxPanelMm: 1400,
  minPanelMm: 300,
  gateConfig: {
    required: true,
    mountMode: "GLASS_TO_GLASS",
    hingeSide: "LEFT",
    gateWidthMm: 900,
    hingePanelWidthMm: 1200,
    hingeGapMm: 20,
    latchGapMm: 20,
    position: 0.3,
  },
};

console.log("Testing compose with R1 parameters...\n");
const result = composeFenceSegments(input);

console.log("Success:", result.success);
console.log("\nErrors:", JSON.stringify(result.errors, null, 2));
console.log("\nTrace:");
result.trace?.forEach((t, i) => {
  console.log(`  ${i}. ${t.step}:`, JSON.stringify(t.data, null, 2));
});
console.log("\nSegments:", result.segments.length);
console.log("\nPolicy info:", {
  policy: result.endGapPolicy,
  lockedTried: result.lockedTried,
  residualUsed: result.residualUsed,
  varianceEndGapMm: result.varianceEndGapMm,
});
