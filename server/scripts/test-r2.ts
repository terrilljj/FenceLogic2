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
    hingeSide: "RIGHT",
    gateWidthMm: 900,
    hingePanelWidthMm: 1200,
    hingeGapMm: 20,
    latchGapMm: 20,
    position: 0.7,
  },
};

console.log("R2: Gate on RIGHT (hingeSide=RIGHT, position=0.7)\n");
const result = composeFenceSegments(input);

console.log("Success:", result.success);
console.log("\nSegments:");
result.segments.forEach((s, i) => {
  console.log(`  ${i}. ${s.kind}: ${s.widthMm}mm`);
});

const total = result.segments.reduce((sum, s) => sum + (s.widthMm || 0), 0);
console.log("\nTotal:", total, "mm (expected 5000mm, delta:", total - 5000, "mm)");
console.log("\nGate count:", result.segments.filter(s => s.kind === 'gate').length);
console.log("Hinge panel count:", result.segments.filter(s => s.kind === 'hinge-panel').length);
