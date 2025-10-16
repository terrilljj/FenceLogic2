import { adviseEndGap } from "../../shared/calc/endgapAdvisor";

const baseInput = {
  runLengthMm: 5000,
  startGapMm: 25,
  betweenGapMm: 50,
  maxPanelMm: 1400,
  minPanelMm: 300,
};

console.log("Testing end gaps: [20, 25, 30, 35, 40]\n");

const result = adviseEndGap(baseInput, [20, 25, 30, 35, 40]);

result.advice.forEach(a => {
  console.log(`End gap ${a.requestedEndGap}mm:`);
  console.log(`  Feasible: ${a.feasible}`);
  if (a.feasible) {
    console.log(`  Actual: ${a.actualEndGap}mm`);
    console.log(`  Variance: ${a.variance}mm`);
  } else {
    console.log(`  Reason: ${a.reason}`);
  }
  console.log();
});

console.log("Exact matches:", result.recommendations.exactMatches);
console.log("Closest match:", result.recommendations.closestMatch);
