/**
 * Trading mathematics for Betfair Exchange.
 * Every calculation must be exact — tennis traders verify these mentally.
 * All monetary values: Math.round(x * 100) / 100 to eliminate floating point errors.
 */

type Side = "BACK" | "LAY";

/* ─── Betfair Tick Table ─── */

const TICK_TABLE = [
  { min: 1.01, max: 2.0, increment: 0.01 },
  { min: 2.0, max: 3.0, increment: 0.02 },
  { min: 3.0, max: 4.0, increment: 0.05 },
  { min: 4.0, max: 6.0, increment: 0.1 },
  { min: 6.0, max: 10.0, increment: 0.2 },
  { min: 10.0, max: 20.0, increment: 0.5 },
  { min: 20.0, max: 30.0, increment: 1.0 },
  { min: 30.0, max: 50.0, increment: 2.0 },
  { min: 50.0, max: 100.0, increment: 5.0 },
  { min: 100.0, max: 1000.0, increment: 10.0 },
];

const MIN_PRICE = 1.01;
const MAX_PRICE = 1000;

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ─── 1. getTickIncrement ─── */

export function getTickIncrement(price: number): number {
  for (const range of TICK_TABLE) {
    if (price >= range.min && price < range.max) {
      return range.increment;
    }
  }
  // price === 1000 falls into the last range
  if (price === MAX_PRICE) return 10;
  return 0.01;
}

/* ─── 2. roundToTick ─── */

export function roundToTick(price: number): number {
  if (price <= MIN_PRICE) return MIN_PRICE;
  if (price >= MAX_PRICE) return MAX_PRICE;

  const range = TICK_TABLE.find(
    (t) => price >= t.min && price < t.max
  );

  if (!range) return r2(price);

  const increment = range.increment;
  // Use floor with epsilon to avoid IEEE 754 boundary errors
  // e.g. (2.03-2.0)/0.02 = 1.4999... in float, floor+eps corrects to 1
  const stepsFromMin = (price - range.min) / increment;
  const floorSteps = Math.floor(stepsFromMin + 1e-9);

  const lower = r2(range.min + floorSteps * increment);
  const upper = r2(range.min + (floorSteps + 1) * increment);
  const clampedUpper = upper >= range.max ? r2(range.max) : upper;

  // Return whichever tick is closer; ties round up (standard for trading).
  // Use epsilon to handle IEEE 754 near-ties (e.g. 2.01 - 2.0 = 0.009999... in float)
  const distLower = Math.abs(price - lower);
  const distUpper = Math.abs(clampedUpper - price);
  if (Math.abs(distLower - distUpper) < 1e-8) return clampedUpper;
  if (distLower < distUpper) return lower;
  return clampedUpper;
}

/* ─── 3. moveByTicks ─── */

export function moveByTicks(price: number, ticks: number): number {
  let current = roundToTick(price);

  if (ticks > 0) {
    for (let i = 0; i < ticks; i++) {
      const increment = getTickIncrement(current);
      const next = r2(current + increment);
      if (next > MAX_PRICE) return MAX_PRICE;
      current = next;
      // If we crossed into a new range, re-round to be safe
      current = roundToTick(current);
    }
  } else {
    for (let i = 0; i < Math.abs(ticks); i++) {
      // When moving down at a range boundary, we need the increment of the range below.
      // Do NOT r2 the testPrice — r2(1.999) snaps to 2.00 which picks the wrong range.
      const testPrice = current - 0.001;
      const increment = testPrice < MIN_PRICE ? 0.01 : getTickIncrement(testPrice);
      const next = r2(current - increment);
      if (next < MIN_PRICE) return MIN_PRICE;
      current = next;
      current = roundToTick(current);
    }
  }

  return current;
}

/* ─── 4. calculateGreenUp ─── */

export function calculateGreenUp(
  entryPrice: number,
  entryStake: number,
  entrySide: Side,
  currentPrice: number
): {
  greenUpStake: number;
  greenUpSide: Side;
  profitIfWin: number;
  profitIfLose: number;
  equalProfit: number;
} {
  const greenUpStake = r2((entryStake * entryPrice) / currentPrice);
  const greenUpSide: Side = entrySide === "BACK" ? "LAY" : "BACK";

  let profitIfWin: number;
  let profitIfLose: number;

  if (entrySide === "BACK") {
    // Entered BACK, green up by LAYing at current price
    profitIfWin = r2(entryStake * (entryPrice - 1) - greenUpStake * (currentPrice - 1));
    profitIfLose = r2(greenUpStake - entryStake);
  } else {
    // Entered LAY, green up by BACKing at current price
    profitIfWin = r2(greenUpStake * (currentPrice - 1) - entryStake * (entryPrice - 1));
    profitIfLose = r2(entryStake - greenUpStake);
  }

  // Equal profit is (profitIfWin + profitIfLose) / 2 — but since green-up
  // with exact stake ratio, profitIfWin should equal profitIfLose
  const equalProfit = r2((profitIfWin + profitIfLose) / 2);

  return { greenUpStake, greenUpSide, profitIfWin, profitIfLose, equalProfit };
}

/* ─── 5. calculatePosition ─── */

export function calculatePosition(
  entryPrice: number,
  entryStake: number,
  entrySide: Side,
  currentBackPrice: number,
  currentLayPrice: number
): {
  profitIfWin: number;
  profitIfLose: number;
  unrealisedPnl: number;
} {
  let profitIfWin: number;
  let profitIfLose: number;

  if (entrySide === "BACK") {
    // We backed: win = stake * (price - 1), lose = -stake
    // If we green up now by laying at currentLayPrice:
    const greenStake = r2((entryStake * entryPrice) / currentLayPrice);
    profitIfWin = r2(entryStake * (entryPrice - 1) - greenStake * (currentLayPrice - 1));
    profitIfLose = r2(greenStake - entryStake);
  } else {
    // We laid: win = stake, lose = -stake * (price - 1)
    // If we green up now by backing at currentBackPrice:
    const greenStake = r2((entryStake * entryPrice) / currentBackPrice);
    profitIfWin = r2(greenStake * (currentBackPrice - 1) - entryStake * (entryPrice - 1));
    profitIfLose = r2(entryStake - greenStake);
  }

  const unrealisedPnl = r2((profitIfWin + profitIfLose) / 2);

  return { profitIfWin, profitIfLose, unrealisedPnl };
}

/* ─── 6. calculateLiability ─── */

export function calculateLiability(
  price: number,
  stake: number,
  side: Side
): number {
  if (side === "LAY") {
    return r2((price - 1) * stake);
  }
  // BACK liability is simply the stake
  return r2(stake);
}
