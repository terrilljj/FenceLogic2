import { composeFenceSegments } from '../../shared/calc/compose.js';

const input = {
  runLengthMm: 5000,
  startGapMm: 25,
  endGapMm: 25,
  betweenGapMm: 50,
  maxPanelMm: 1400,
  minPanelMm: 300,
  gateConfig: {
    required: true,
    mountMode: "GLASS_TO_GLASS" as const,
    hingeSide: "RIGHT" as const,
    gateWidthMm: 900,
    hingePanelWidthMm: 1200,
    hingeGapMm: 20,
    latchGapMm: 20,
    position: 0.7,
  },
};

console.log("Testing R2 - RIGHT hinge");
console.log("Input:", JSON.stringify(input, null, 2));

const result = composeFenceSegments(input);

console.log("\n=== RESULT ===");
console.log("Success:", result.success);
console.log("Segments count:", result.segments.length);

if (result.trace) {
  const fixedStep = result.trace.find(t => t.step === 'fixed-left-right');
  console.log("\nFixed L/R:", JSON.stringify(fixedStep?.data, null, 2));
  
  const targetStep = result.trace.find(t => t.step === 'panels-and-gaps-target');
  console.log("\nPanels+Gaps Target:", JSON.stringify(targetStep?.data, null, 2));
  
  const trySteps = result.trace.filter(t => t.step.startsWith('try-N'));
  console.log(`\n${trySteps.length} N attempts made`);
  if (trySteps.length > 0) {
    console.log("First attempt:", JSON.stringify(trySteps[0], null, 2));
  }
}

if (!result.success) {
  console.log("\n=== ERRORS ===");
  console.log(JSON.stringify(result.errors, null, 2));
}

console.log("\nSegments:");
result.segments.forEach(s => console.log(`  ${s.kind}: ${s.widthMm}mm`));
