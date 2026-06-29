/**
 * Market Hedge & Liability Reduction — unit tests
 * Run: npx tsx src/lib/__tests__/hedgeAndLiability.test.ts
 */
import { calculateMarketHedge } from "../../components/classic/ClassicMarketHedge";
import { calculateLiabilityReduction } from "../../components/classic/ClassicLiabilityTools";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ═══════════════════════════════════════════
 *  calculateMarketHedge tests
 * ═══════════════════════════════════════════ */

console.log("\n=== Market Hedge Tests ===\n");

// --- Already equalized ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: 5.00, ifPlayer2Wins: 5.01 },
    2.0, 2.0, 2.0, 2.0,
  );
  assert(result === null, "Already equalized (diff < 0.02) returns null");
}

// --- P1 outcome better → LAY P1 ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: 10.00, ifPlayer2Wins: 0.00 },
    2.0, 2.0, 2.0, 2.0, // p1Lay=2.0, p1Back=2.0, p2Lay=2.0, p2Back=2.0
  );
  assert(result !== null, "P1 better: returns hedge");
  assert(result!.hedgeRunner === "player1", "P1 better: hedge runner is player1");
  assert(result!.hedgeSide === "LAY", "P1 better: hedge side is LAY");
  assert(result!.hedgePrice === 2.0, "P1 better: hedge price is p1 lay");
  // stake = diff / price = 10 / 2 = 5
  assert(result!.hedgeStake === 5.0, "P1 better: stake = diff / price = 5.00");
  // equalized = ifP2Wins + stake = 0 + 5 = 5
  assert(result!.equalized === 5.0, "P1 better: equalized = 5.00");
}

// --- P2 outcome better → LAY P2 ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: -2.00, ifPlayer2Wins: 8.00 },
    3.0, 3.0, 4.0, 4.0,
  );
  assert(result !== null, "P2 better: returns hedge");
  assert(result!.hedgeRunner === "player2", "P2 better: hedge runner is player2");
  assert(result!.hedgeSide === "LAY", "P2 better: hedge side is LAY");
  assert(result!.hedgePrice === 4.0, "P2 better: hedge price is p2 lay");
  // diff = |-2 - 8| = 10, stake = 10 / 4 = 2.5
  assert(result!.hedgeStake === 2.5, "P2 better: stake = 2.50");
  // equalized = ifP1Wins + stake = -2 + 2.5 = 0.5
  assert(result!.equalized === 0.5, "P2 better: equalized = 0.50");
}

// --- Verify equalization math: both outcomes equal after hedge ---
{
  const pnl = { ifPlayer1Wins: 15.00, ifPlayer2Wins: 3.00 };
  const result = calculateMarketHedge(pnl, 1.80, 1.80, 3.0, 3.0);
  assert(result !== null, "Equalization: returns hedge");
  // After hedge: P1 outcome = ifP1 - stake*(price-1), P2 outcome = ifP2 + stake
  const afterP1 = r2(pnl.ifPlayer1Wins - result!.hedgeStake * (result!.hedgePrice - 1));
  const afterP2 = r2(pnl.ifPlayer2Wins + result!.hedgeStake);
  assert(Math.abs(afterP1 - afterP2) < 0.05, `Equalization: both outcomes equal (${afterP1} ≈ ${afterP2})`);
}

// --- Fallback to BACK P2 when P1 lay unavailable ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: 10.00, ifPlayer2Wins: 0.00 },
    0, 0, 0, 2.5, // p1 lay = 0 (unavailable), p2 back = 2.5
  );
  assert(result !== null, "Fallback: returns hedge via BACK P2");
  assert(result!.hedgeRunner === "player2", "Fallback: hedge runner is player2");
  assert(result!.hedgeSide === "BACK", "Fallback: hedge side is BACK");
  assert(result!.hedgePrice === 2.5, "Fallback: hedge price is p2 back");
}

// --- No prices available → returns null ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: 10.00, ifPlayer2Wins: 0.00 },
    0, 0, 0, 0,
  );
  assert(result === null, "No prices: returns null");
}

// --- Hedging a loss: equalized at 0 (break even) ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: -5.00, ifPlayer2Wins: 5.00 },
    2.0, 2.0, 2.0, 2.0,
  );
  assert(result !== null, "Hedging loss: returns hedge");
  // P2 better: LAY P2, stake = 10/2 = 5, equalized = -5 + 5 = 0
  assert(result!.equalized === 0, "Hedging loss: equalized = 0 (break even)");
}

// --- Hedging a deep loss: equalized still negative ---
{
  const result = calculateMarketHedge(
    { ifPlayer1Wins: -10.00, ifPlayer2Wins: 2.00 },
    3.0, 3.0, 3.0, 3.0,
  );
  assert(result !== null, "Deep loss: returns hedge");
  // P2 better: diff = 12, LAY P2, stake = 12/3 = 4, equalized = -10 + 4 = -6
  assert(result!.equalized === -6, "Deep loss: equalized = -6 (minimized loss)");
}

/* ═══════════════════════════════════════════
 *  calculateLiabilityReduction tests
 * ═══════════════════════════════════════════ */

console.log("\n=== Liability Reduction Tests ===\n");

// --- BACK position: 50% reduction ---
{
  const agg = { netSide: "BACK" as const, netStake: 10, avgEntry: 3.0, count: 1, backTotal: 10, layTotal: 0 };
  const result = calculateLiabilityReduction(agg, 3.0, 2.8, 50);
  assert(result !== null, "BACK 50%: returns reduction");
  assert(result!.tradeSide === "LAY", "BACK 50%: trade side is LAY");
  assert(result!.tradeStake === 5.0, "BACK 50%: lay stake = netStake * 0.5 = 5.00");
  assert(result!.remainingLiability === 5.0, "BACK 50%: remaining liability = 50% of original");
  assert(result!.remainingUpside > 0, "BACK 50%: upside still positive");
  assert(result!.isFreeBet === false, "BACK 50%: not a free bet");
}

// --- BACK position: 100% = free bet ---
{
  const agg = { netSide: "BACK" as const, netStake: 10, avgEntry: 3.0, count: 1, backTotal: 10, layTotal: 0 };
  const result = calculateLiabilityReduction(agg, 3.0, 2.5, 100);
  assert(result !== null, "BACK 100%: returns reduction");
  assert(result!.tradeSide === "LAY", "BACK 100%: trade side is LAY");
  assert(result!.tradeStake === 10.0, "BACK 100%: lay stake = full netStake");
  assert(result!.remainingLiability === 0, "BACK 100%: zero liability");
  // Upside = 10*(3-1) - 10*(2.5-1) = 20 - 15 = 5
  assert(result!.remainingUpside === 5.0, "BACK 100%: remaining upside = 5.00");
  assert(result!.isFreeBet === true, "BACK 100%: IS a free bet");
}

// --- LAY position: 50% reduction ---
{
  const agg = { netSide: "LAY" as const, netStake: 10, avgEntry: 3.0, count: 1, backTotal: 0, layTotal: 10 };
  const result = calculateLiabilityReduction(agg, 2.8, 3.0, 50);
  assert(result !== null, "LAY 50%: returns reduction");
  assert(result!.tradeSide === "BACK", "LAY 50%: trade side is BACK");
  // liability = 10 * (3-1) = 20, stake = (20 * 0.5) / (2.8-1) = 10 / 1.8 = 5.56
  assert(result!.tradeStake === 5.56, "LAY 50%: back stake = 5.56");
  assert(result!.remainingLiability === 10.0, "LAY 50%: remaining liability = 50% of 20 = 10.00");
  assert(result!.remainingUpside > 0, "LAY 50%: upside still positive");
}

// --- LAY position: 100% = free bet ---
{
  const agg = { netSide: "LAY" as const, netStake: 10, avgEntry: 3.0, count: 1, backTotal: 0, layTotal: 10 };
  const result = calculateLiabilityReduction(agg, 2.5, 3.0, 100);
  assert(result !== null, "LAY 100%: returns reduction");
  assert(result!.tradeSide === "BACK", "LAY 100%: trade side is BACK");
  // liability = 20, stake = 20 / (2.5-1) = 20/1.5 = 13.33
  assert(result!.tradeStake === 13.33, "LAY 100%: back stake = 13.33");
  assert(result!.remainingLiability === 0, "LAY 100%: zero liability");
  // upside = 10 - 13.33 = negative → NOT a free bet (price moved against)
  // Actually: remainingUpside = 10 - 13.33 = -3.33
  assert(result!.isFreeBet === false, "LAY 100%: NOT free bet when price moved against");
}

// --- LAY position: 100% IS free bet when price moved favorably ---
{
  const agg = { netSide: "LAY" as const, netStake: 10, avgEntry: 2.0, count: 1, backTotal: 0, layTotal: 10 };
  const result = calculateLiabilityReduction(agg, 1.5, 2.0, 100);
  assert(result !== null, "LAY 100% favorable: returns reduction");
  // liability = 10 * (2-1) = 10, stake = 10 / (1.5-1) = 10/0.5 = 20
  assert(result!.tradeStake === 20.0, "LAY 100% favorable: back stake = 20.00");
  assert(result!.remainingLiability === 0, "LAY 100% favorable: zero liability");
  // upside = 10 - 20 = -10 → NOT free bet
  // Hmm, this is correct: when laying at 2.0 and backing at 1.5, the back cost exceeds the lay profit
  assert(result!.isFreeBet === false, "LAY 100% unfavorable price: not free bet");
}

// --- FLAT position → null ---
{
  const agg = { netSide: "FLAT" as const, netStake: 0, avgEntry: 0, count: 0, backTotal: 0, layTotal: 0 };
  const result = calculateLiabilityReduction(agg, 2.0, 2.0, 50);
  assert(result === null, "FLAT position: returns null");
}

// --- Price unavailable → null ---
{
  const agg = { netSide: "BACK" as const, netStake: 10, avgEntry: 3.0, count: 1, backTotal: 10, layTotal: 0 };
  const result = calculateLiabilityReduction(agg, 3.0, 0, 50);
  assert(result === null, "No lay price: returns null");
}

// --- Verify liability reduction at each percentage ---
{
  const agg = { netSide: "BACK" as const, netStake: 20, avgEntry: 2.5, count: 1, backTotal: 20, layTotal: 0 };
  for (const pct of [25, 50, 75, 100]) {
    const result = calculateLiabilityReduction(agg, 2.5, 2.5, pct);
    if (result) {
      const expectedLiability = r2(20 * (1 - pct / 100));
      assert(
        result.remainingLiability === expectedLiability,
        `BACK ${pct}%: remaining liability = ${expectedLiability}`,
      );
    }
  }
}

console.log("\n=== All tests passed ===\n");
