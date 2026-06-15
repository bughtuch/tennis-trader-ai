/**
 * Lay Liability Mode — unit tests
 * Run: npx tsx src/lib/__tests__/layLiability.test.ts
 */
import { calculateLayStakeFromLiability, calculateLiability } from "../tradingMaths";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

console.log("\n=== Lay Liability Tests ===\n");

// Core conversions
assert(calculateLayStakeFromLiability(200, 3.0) === 100, "odds 3.0, liability 200 → stake 100");
assert(calculateLayStakeFromLiability(200, 5.0) === 50, "odds 5.0, liability 200 → stake 50");
assert(calculateLayStakeFromLiability(100, 2.5) === 66.67, "odds 2.5, liability 100 → stake 66.67");

// Existing calculateLiability cross-check
assert(calculateLiability(3.0, 25, "LAY") === 50, "stake 25, odds 3.0 → liability 50");

// Edge cases
assert(calculateLayStakeFromLiability(100, 1.0) === 0, "odds = 1 → stake 0");
assert(calculateLayStakeFromLiability(100, 0.5) === 0, "odds < 1 → stake 0");
assert(calculateLayStakeFromLiability(-50, 3.0) === 0, "negative liability → stake 0");
assert(calculateLayStakeFromLiability(0, 3.0) === 0, "zero liability → stake 0");
assert(calculateLayStakeFromLiability(100, Infinity) === 0, "Infinity odds → stake 0");
assert(calculateLayStakeFromLiability(100, NaN) === 0, "NaN odds → stake 0");

// Round-trip: liability → stake → back to liability
const liability = 100;
const odds = 3.5;
const stake = calculateLayStakeFromLiability(liability, odds);
const backToLiability = calculateLiability(odds, stake, "LAY");
assert(Math.abs(backToLiability - liability) < 0.02, `round-trip: ${liability} → stake ${stake} → liability ${backToLiability}`);

console.log("\n=== All tests passed ===\n");
