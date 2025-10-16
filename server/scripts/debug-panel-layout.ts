import { calculatePanelLayout } from "../../shared/panelCalculations";

const result = calculatePanelLayout(
  5000, // spanLength
  50,   // endGaps (25+25)
  50,   // desiredGap
  1400, // maxPanelWidth
  false, // hasLeftRaked
  false, // hasRightRaked
  {
    required: true,
    gateSize: 900,
    hingePanelSize: 1300,
    position: 0,
    flipped: false,
    hingeFrom: "glass",
    hingeGap: 20,
    latchGap: 20,
  }
);

console.log("\n=== PANEL LAYOUT RESULT ===");
console.log("Panels:", result.panels);
console.log("Panel types:", result.panelTypes);
console.log("Gaps:", result.gaps);
console.log("Total panel width:", result.totalPanelWidth);
console.log("Total gap width:", result.totalGapWidth);
console.log("Average gap:", result.averageGap);
console.log("\nExpected effective length: 4950mm");
console.log("Actual total: ", result.totalPanelWidth + result.totalGapWidth);
