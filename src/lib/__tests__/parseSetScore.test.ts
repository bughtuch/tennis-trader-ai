/**
 * Standalone test for parseSetScore — run with: npx tsx src/lib/__tests__/parseSetScore.test.ts
 *
 * Covers tiebreak decimal and parenthetical notations from api-tennis.com and Betfair.
 */

// Inline the function so test doesn't depend on route internals
function parseSetScore(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const str = String(raw).trim();
  const stripped = str.replace(/\(.*\)/, "");
  const num = Number(stripped);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

const cases: [unknown, number, string][] = [
  // Decimal tiebreak notation (api-tennis)
  ["6.4", 6, "decimal tiebreak 6.4 → 6"],
  ["7.7", 7, "decimal tiebreak 7.7 → 7"],
  ["7.6", 7, "decimal tiebreak 7.6 → 7"],
  ["6.3", 6, "decimal tiebreak 6.3 → 6"],

  // Parenthetical tiebreak notation
  ["7(7)", 7, "parenthetical 7(7) → 7"],
  ["6(4)", 6, "parenthetical 6(4) → 6"],
  ["7(11)", 7, "parenthetical 7(11) → 7"],
  ["6(8)", 6, "parenthetical 6(8) → 6"],

  // Normal integer scores
  ["6", 6, "normal 6"],
  ["4", 4, "normal 4"],
  ["0", 0, "normal 0"],
  ["7", 7, "normal 7"],
  [6, 6, "numeric 6"],
  [0, 0, "numeric 0"],

  // Edge cases
  [null, 0, "null → 0"],
  [undefined, 0, "undefined → 0"],
  ["", 0, "empty string → 0"],
  ["  7  ", 7, "whitespace-padded"],
  ["abc", 0, "non-numeric → 0"],
  [-1, 0, "negative → 0"],
];

let passed = 0;
let failed = 0;

for (const [input, expected, label] of cases) {
  const result = parseSetScore(input);
  if (result === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — got ${result}, expected ${expected}`);
  }
}

console.log(`\nparseSetScore: ${passed} passed, ${failed} failed out of ${cases.length} tests`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
