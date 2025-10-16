import { composeFenceSegments, CompositionInput } from "../../shared/calc/compose";

// Test gate at far right (position = 2, after both panels)
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
    position: 2, // Far right - after both panels
  },
};

console.log("Testing gate at far right (position=2)...\n");
const result = composeFenceSegments(input);

console.log("Success:", result.success);
console.log("\nSegments:");
result.segments.forEach(s => {
  console.log(`  ${s.kind}: ${s.widthMm}mm`);
});

console.log("\nPanel split trace:");
const splitTrace = result.trace?.find(t => t.step === 'panel-split');
console.log(JSON.stringify(splitTrace?.data, null, 2));

console.log("\nGate segments:", result.segments.filter(s => s.kind === 'gate').length);
console.log("Total segments:", result.segments.length);
console.log("Total length:", result.segments.reduce((sum, s) => sum + (s.widthMm || 0), 0));
