"use client";

import { useState } from "react";

/* ─── Types ─── */

interface AggregatedPosition {
  netSide: "BACK" | "LAY" | "FLAT";
  netStake: number;
  avgEntry: number;
  count: number;
  backTotal: number;
  layTotal: number;
}

export interface LiabilityReductionCalc {
  tradeSide: "BACK" | "LAY";
  tradeStake: number;
  tradePrice: number;
  tradeLiability: number;
  currentLiability: number;
  currentUpside: number;
  remainingLiability: number;
  remainingUpside: number;
  isFreeBet: boolean;
  percentage: number;
}

interface ClassicLiabilityToolsProps {
  playerName: string;
  agg: AggregatedPosition;
  currentBackPrice: number;
  currentLayPrice: number;
  marketSuspended: boolean;
  onExecute: (tradeSide: "BACK" | "LAY", tradePrice: number, tradeStake: number) => Promise<void>;
  tradeLoading: boolean;
}

/* ─── Deterministic liability reduction math ─── */

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Calculate a partial liability reduction trade.
 *
 * Unlike hedge/green-up (which equalises both outcomes), this ONLY removes
 * downside exposure while preserving as much upside as possible.
 *
 * BACK position: liability = stake (lost if player loses)
 *   → Reduce by laying a fraction of stake at current lay price
 *   → At 100%: loss if loses = £0, upside reduced but still positive = "free bet"
 *
 * LAY position: liability = stake × (price - 1) (lost if player wins)
 *   → Reduce by backing at current back price
 *   → At 100%: loss if wins = £0, upside reduced but still positive = "free bet"
 */
export function calculateLiabilityReduction(
  agg: AggregatedPosition,
  currentBackPrice: number,
  currentLayPrice: number,
  percentage: number,
): LiabilityReductionCalc | null {
  if (agg.netSide === "FLAT") return null;
  if (agg.avgEntry <= 1.01 || agg.netStake <= 0) return null;

  const pct = percentage / 100;

  if (agg.netSide === "BACK") {
    // BACK position: liability = stake lost if player loses
    const currentLiability = r2(agg.netStake);
    const currentUpside = r2(agg.netStake * (agg.avgEntry - 1));

    const tradeSide: "BACK" | "LAY" = "LAY";
    const tradePrice = currentLayPrice;

    if (!tradePrice || tradePrice <= 1.01) return null;

    // Lay stake = netStake × percentage to remove that fraction of downside
    const tradeStake = r2(agg.netStake * pct);
    if (tradeStake < 2) return null;

    // After reduction:
    // If player loses: -netStake + tradeStake = -netStake × (1 - pct)
    const remainingLiability = r2(currentLiability * (1 - pct));
    // If player wins: netStake × (avgEntry - 1) - tradeStake × (layPrice - 1)
    const remainingUpside = r2(currentUpside - tradeStake * (tradePrice - 1));
    const tradeLiability = r2((tradePrice - 1) * tradeStake);
    const isFreeBet = percentage === 100 && remainingUpside > 0;

    return {
      tradeSide,
      tradeStake,
      tradePrice,
      tradeLiability,
      currentLiability,
      currentUpside,
      remainingLiability,
      remainingUpside,
      isFreeBet,
      percentage,
    };
  } else {
    // LAY position: liability = stake × (price - 1) lost if player wins
    const currentLiability = r2(agg.netStake * (agg.avgEntry - 1));
    const currentUpside = r2(agg.netStake);

    const tradeSide: "BACK" | "LAY" = "BACK";
    const tradePrice = currentBackPrice;

    if (!tradePrice || tradePrice <= 1.01) return null;

    // Back stake = (liability × pct) / (backPrice - 1)
    const tradeStake = r2((currentLiability * pct) / (tradePrice - 1));
    if (tradeStake < 2) return null;

    // After reduction:
    // If player wins: -liability + tradeStake × (backPrice - 1) = -liability × (1 - pct)
    const remainingLiability = r2(currentLiability * (1 - pct));
    // If player loses: netStake - tradeStake
    const remainingUpside = r2(currentUpside - tradeStake);
    const tradeLiability = r2(tradeStake);
    const isFreeBet = percentage === 100 && remainingUpside > 0;

    return {
      tradeSide,
      tradeStake,
      tradePrice,
      tradeLiability,
      currentLiability,
      currentUpside,
      remainingLiability,
      remainingUpside,
      isFreeBet,
      percentage,
    };
  }
}

/* ─── Percentage buttons ─── */

const PERCENTAGES = [25, 50, 75, 100] as const;

/* ─── Component ─── */

export default function ClassicLiabilityTools({
  playerName,
  agg,
  currentBackPrice,
  currentLayPrice,
  marketSuspended,
  onExecute,
  tradeLoading,
}: ClassicLiabilityToolsProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPct, setSelectedPct] = useState<number>(50);
  const [executing, setExecuting] = useState(false);

  const playerShort = playerName.split(" ").pop() ?? playerName;
  const calc = calculateLiabilityReduction(agg, currentBackPrice, currentLayPrice, selectedPct);
  const disabled = !calc || marketSuspended;

  async function handleExecute() {
    if (!calc || executing || tradeLoading) return;
    setExecuting(true);
    try {
      await onExecute(calc.tradeSide, calc.tradePrice, calc.tradeStake);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-gray-100 cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500">
            LIABILITY REDUCTION
          </span>
          <span className="text-[10px] text-gray-400">{playerShort}</span>
        </div>
        <div className="flex items-center gap-2">
          {calc && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-700">
              £{calc.currentLiability.toFixed(2)}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && calc && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200 space-y-2.5">
          {/* Position summary */}
          <div className="text-[11px] text-gray-600">
            <span className={`font-semibold ${agg.netSide === "BACK" ? "text-blue-700" : "text-pink-700"}`}>
              {agg.netSide}
            </span>
            {" "}£{agg.netStake.toFixed(2)} @ {agg.avgEntry.toFixed(2)}
          </div>

          {/* Percentage buttons */}
          <div className="flex gap-1.5">
            {PERCENTAGES.map((pct) => {
              const pctCalc = calculateLiabilityReduction(agg, currentBackPrice, currentLayPrice, pct);
              const isActive = selectedPct === pct;
              const isFreeBetPct = pct === 100 && pctCalc && pctCalc.remainingUpside > 0;

              return (
                <button
                  key={pct}
                  onClick={() => setSelectedPct(pct)}
                  disabled={!pctCalc}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold transition-all border ${
                    !pctCalc
                      ? "opacity-30 cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isActive
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-amber-50 hover:border-amber-300"
                  }`}
                >
                  {isFreeBetPct ? "FREE" : `${pct}%`}
                </button>
              );
            })}
          </div>

          {/* Preview grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Current exposure */}
            <div className="rounded border border-gray-200 bg-white p-2">
              <div className="text-[9px] text-gray-500 uppercase tracking-wide">Current</div>
              <div className="mt-0.5 space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Liability</span>
                  <span className="font-mono font-semibold text-red-600">
                    -£{calc.currentLiability.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Upside</span>
                  <span className="font-mono font-semibold text-green-600">
                    +£{calc.currentUpside.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* After reduction */}
            <div className="rounded border border-amber-200 bg-amber-50/50 p-2">
              <div className="text-[9px] text-amber-600 uppercase tracking-wide font-semibold">
                After {calc.percentage}%
              </div>
              <div className="mt-0.5 space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Liability</span>
                  <span className={`font-mono font-semibold ${
                    calc.remainingLiability <= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {calc.remainingLiability <= 0 ? "£0.00" : `-£${calc.remainingLiability.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Upside</span>
                  <span className={`font-mono font-semibold ${
                    calc.remainingUpside > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {calc.remainingUpside > 0 ? "+" : ""}£{calc.remainingUpside.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade action summary */}
          <div className="flex items-center justify-between text-[10px] bg-white rounded border border-gray-200 px-2 py-1.5">
            <span className="text-gray-500">
              Action:{" "}
              <span className={`font-semibold ${calc.tradeSide === "LAY" ? "text-pink-700" : "text-blue-700"}`}>
                {calc.tradeSide}
              </span>
              {" "}£{calc.tradeStake.toFixed(2)} @ {calc.tradePrice.toFixed(2)}
            </span>
            <span className="text-gray-400 font-mono">
              liab £{calc.tradeLiability.toFixed(2)}
            </span>
          </div>

          {/* Free bet badge */}
          {calc.isFreeBet && (
            <div className="text-center py-1.5 rounded-lg bg-green-100 border border-green-200">
              <span className="text-[11px] font-bold text-green-700">
                FREE BET — £0 risk, +£{calc.remainingUpside.toFixed(2)} if wins
              </span>
            </div>
          )}

          {/* Execute button */}
          <button
            onClick={handleExecute}
            disabled={executing || tradeLoading || marketSuspended}
            className={`w-full py-2 px-3 rounded-lg text-sm font-bold transition-all ${
              calc.isFreeBet
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            } ${executing || tradeLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {executing
              ? "Placing..."
              : calc.isFreeBet
                ? `CREATE FREE BET — ${calc.tradeSide} £${calc.tradeStake.toFixed(2)}`
                : `REDUCE ${calc.percentage}% — ${calc.tradeSide} £${calc.tradeStake.toFixed(2)}`}
          </button>

          {/* Hint */}
          <div className="text-[10px] text-gray-400 text-center italic">
            Removes downside risk while keeping upside running
          </div>
        </div>
      )}
    </div>
  );
}
