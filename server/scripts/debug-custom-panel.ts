import { composeFenceSegments } from '../../shared/calc/compose';

const result = composeFenceSegments({
  runLengthMm: 3000,
  startGapMm: 50,
  endGapMm: 50,
  betweenGapMm: 50,
  minPanelMm: 600,
  maxPanelMm: 1200,
  customPanelConfig: {
    required: true,
    position: 0.5,
    panelWidthMm: 800,
  },
});

console.log('\n=== COMPOSITION RESULT ===');
console.log('Success:', result.success);

if (!result.success && 'errors' in result) {
  console.log('\n=== ERRORS ===');
  console.log(JSON.stringify(result.errors, null, 2));
}

console.log('\n=== VALIDATION ===');
console.log(JSON.stringify(result.validation, null, 2));

console.log('\n=== TRACE (last 10) ===');
console.log(JSON.stringify(result.trace?.slice(-10), null, 2));

console.log('\n=== SEGMENTS ===');
console.log(JSON.stringify(result.segments, null, 2));
