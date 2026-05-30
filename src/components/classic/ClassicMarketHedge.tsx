"use client";

import { BETFAIR_MIN_STAKE } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface ClassicMarketHedgeProps {
  player1Name: string;
  player2Name: string;
  outcomePnl: { ifPlayer1Wins: number; ifPlayer2Wins: number } | null;
  p1BackPrice: number;
  p1LayPrice: number;
  p2BackPrice: number;
  p2LayPrice: number;
  onHedge: (runner: "player1" | "player2", side: "BACK" | "LAY", price: number, stake: number) => Promise<void>;
  tradeLoading: boolean;
  marketSuspended: boolean;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ─── Market Hedge Calculation ─── */

export interface MarketHedgeCalc {
  hedgeRunner: "player1" | "player2";
  hedgeSide: "BACK" | "LAY";
  hedgePrice: number;
  hedgeStake: number;
  equalized: number;
}

/**
 * Calculate the single trade needed to equalize market-wide P&L.
 *
 * In a two-runner market, if one outcome pays more than the other,
 * a single lay (or back) on the favoured-outcome runner equalizes both.
 *
 * Math (diff > 0, P1 outcome better, LAY P1 at price p for stake s):
 *   New P1 wins = ifP1Wins - s*(p-1)
 *   New P2 wins = ifP2Wins + s
 *   Equalize: diff = s*p  →  s = diff/p
 *   Equalized = ifP2Wins + diff/p
 */
export function calculateMarketHedge(
  pnl: { ifPlayer1Wins: number; ifPlayer2Wins: number },
  p1LayPrice: number,
  p1BackPrice: number,
  p2LayPrice: number,
  p2BackPrice: number,
): MarketHedgeCalc | null {
  const diff = pnl.ifPlayer1Wins - pnl.ifPlayer2Wins;
  if (Math.abs(diff) < 0.02) return null; // Already equalized

  if (diff > 0) {
    // P1 outcome better → LAY P1 (primary) or BACK P2 (fallback)
    if (p1LayPrice > 1) {
      const stake = r2(diff / p1LayPrice);
      return {
        hedgeRunner: "player1",
        hedgeSide: "LAY",
        hedgePrice: p1LayPrice,
        hedgeStake: stake,
        equalized: r2(pnl.ifPlayer2Wins + stake),
      };
    }
    if (p2BackPrice > 1) {
      const stake = r2(diff / p2BackPrice);
      return {
        hedgeRunner: "player2",
        hedgeSide: "BACK",
        hedgePrice: p2BackPrice,
        hedgeStake: stake,
        equalized: r2(pnl.ifPlayer1Wins - stake),
      };
    }
    return null;
  } else {
    // P2 outcome better → LAY P2 (primary) or BACK P1 (fallback)
    const absDiff = Math.abs(diff);
    if (p2LayPrice > 1) {
      const stake = r2(absDiff / p2LayPrice);
      return {
        hedgeRunner: "player2",
        hedgeSide: "LAY",
        hedgePrice: p2LayPrice,
        hedgeStake: stake,
        equalized: r2(pnl.ifPlayer1Wins + stake),
      };
    }
    if (p1BackPrice > 1) {
      const stake = r2(absDiff / p1BackPrice);
      return {
        hedgeRunner: "player1",
        hedgeSide: "BACK",
        hedgePrice: p1BackPrice,
        hedgeStake: stake,
        equalized: r2(pnl.ifPlayer2Wins - stake),
      };
    }
    return null;
  }
}

/* ─── Component ─── */

export default function ClassicMarketHedge({
  player1Name,
  player2Name,
  outcomePnl,
  p1BackPrice,
  p1LayPrice,
  p2BackPrice,
  p2LayPrice,
  onHedge,
  tradeLoading,
  marketSuspended,
}: ClassicMarketHedgeProps) {
  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  /* ─── No position ─── */
  if (!outcomePnl) {
    return (
      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
          MARKET HEDGE
        </div>
        <div className="text-xs text-gray-400 text-center py-3">
          No position to hedge
        </div>
      </div>
    );
  }

  const hedge = calculateMarketHedge(outcomePnl, p1LayPrice, p1BackPrice, p2LayPrice, p2BackPrice);
  const diff = Math.abs(outcomePnl.ifPlayer1Wins - outcomePnl.ifPlayer2Wins);

  /* ─── State detection ─── */
  const isGreened = diff < 0.02;
  const isFreeBet = !isGreened && (
    (outcomePnl.ifPlayer1Wins > 0.50 && outcomePnl.ifPlayer2Wins >= -0.50) ||
    (outcomePnl.ifPlayer2Wins > 0.50 && outcomePnl.ifPlayer1Wins >= -0.50)
  );
  const pricesMissing = !hedge && !isGreened;
  const belowMinStake = hedge !== null && hedge.hedgeStake < BETFAIR_MIN_STAKE;

  const hedgeRunnerShort = hedge
    ? (hedge.hedgeRunner === "player1" ? p1Short : p2Short)
    : "";

  /* ─── Render ─── */
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
        MARKET HEDGE
      </div>

      {/* ── CURRENT P&L ── */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">
          CURRENT P&L
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-gray-200 px-2 py-1.5 text-center">
            <div className="text-[10px] text-gray-500 truncate">{p1Short} wins</div>
            <div className={`text-sm font-bold font-mono ${
              outcomePnl.ifPlayer1Wins >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {outcomePnl.ifPlayer1Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer1Wins.toFixed(2)}
            </div>
          </div>
          <div className="rounded border border-gray-200 px-2 py-1.5 text-center">
            <div className="text-[10px] text-gray-500 truncate">{p2Short} wins</div>
            <div className={`text-sm font-bold font-mono ${
              outcomePnl.ifPlayer2Wins >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {outcomePnl.ifPlayer2Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer2Wins.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATUS: Already Greened ── */}
      {isGreened && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
          <div className="text-xs font-bold text-emerald-700">ALREADY GREENED</div>
          <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
            {outcomePnl.ifPlayer1Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer1Wins.toFixed(2)} guaranteed
          </div>
        </div>
      )}

      {/* ── STATUS: Prices Missing ── */}
      {pricesMissing && !isGreened && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center">
          <div className="text-xs font-semibold text-gray-500">
            Hedge unavailable — current prices missing
          </div>
        </div>
      )}

      {/* ── Hedge Available ── */}
      {hedge && !isGreened && (
        <>
          {/* AFTER HEDGE preview */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">
              AFTER HEDGE
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-gray-500 truncate">{p1Short} wins</div>
                <div className={`text-sm font-bold font-mono ${
                  hedge.equalized >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {hedge.equalized >= 0 ? "+" : ""}£{hedge.equalized.toFixed(2)}
                </div>
              </div>
              <div className="rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-center">
                <div className="text-[10px] text-gray-500 truncate">{p2Short} wins</div>
                <div className={`text-sm font-bold font-mono ${
                  hedge.equalized >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {hedge.equalized >= 0 ? "+" : ""}£{hedge.equalized.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* EQUALISED RESULT */}
          <div className={`rounded-lg px-3 py-2 text-center border ${
            hedge.equalized >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}>
            <div className="text-[10px] font-semibold uppercase text-gray-500">
              EQUALISED {hedge.equalized >= 0 ? "PROFIT" : "LOSS"}
            </div>
            <div className={`text-lg font-bold font-mono ${
              hedge.equalized >= 0 ? "text-emerald-700" : "text-red-700"
            }`}>
              {hedge.equalized >= 0 ? "+" : ""}£{hedge.equalized.toFixed(2)}
            </div>
          </div>

          {/* Suggested hedge */}
          <div className="text-[11px] text-gray-500 text-center">
            {hedge.hedgeSide} {hedgeRunnerShort} £{hedge.hedgeStake.toFixed(2)} @ {hedge.hedgePrice.toFixed(2)}
          </div>

          {/* Free bet notice */}
          {isFreeBet && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center">
              <div className="text-[10px] font-semibold text-emerald-700">
                FREE BET ACTIVE — position is risk-free
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                Green-up is optional — locks profit but removes upside
              </div>
            </div>
          )}

          {/* Below min stake */}
          {belowMinStake && (
            <div className="text-[10px] text-amber-600 text-center italic">
              Hedge stake £{hedge.hedgeStake.toFixed(2)} — below Betfair £{BETFAIR_MIN_STAKE} minimum
            </div>
          )}

          {/* Action button */}
          {!belowMinStake && (
            <button
              onClick={() => onHedge(hedge.hedgeRunner, hedge.hedgeSide, hedge.hedgePrice, hedge.hedgeStake)}
              disabled={tradeLoading || marketSuspended}
              className={`w-full py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
                marketSuspended
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : isFreeBet
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200"
                    : hedge.equalized >= 0
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                      : "bg-red-500 hover:bg-red-600 text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {marketSuspended
                ? "SUSPENDED"
                : hedge.equalized >= 0
                  ? `GREEN UP  ${hedge.equalized >= 0 ? "+" : ""}£${hedge.equalized.toFixed(2)}`
                  : `HEDGE  £${Math.abs(hedge.equalized).toFixed(2)}`
              }
            </button>
          )}
        </>
      )}
    </div>
  );
}
