"use client";

import { useState } from "react";
import { calculateLiability } from "@/lib/tradingMaths";

const SCALE_OPTIONS = [0.25, 0.40, 0.50, 0.75] as const;

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

interface ScaleOutButtonsProps {
  /** The aggregated net stake of the current position */
  netStake: number;
  /** The aggregated net side: "BACK" or "LAY" */
  netSide: "BACK" | "LAY";
  /** The aggregated average entry price */
  avgEntry: number;
  /** Current best price for scale-out (lay price if BACK position, back price if LAY) */
  scaleOutPrice: number;
  /** Whether a trade is in progress */
  tradeLoading: boolean;
  /** Execute the scale-out trade */
  onScaleOut: (side: "BACK" | "LAY", price: number, size: number) => Promise<boolean>;
  /** Show a toast message */
  onToast: (message: string, type: "success" | "error") => void;
}

export default function ScaleOutButtons({
  netStake,
  netSide,
  avgEntry,
  scaleOutPrice,
  tradeLoading,
  onScaleOut,
  onToast,
}: ScaleOutButtonsProps) {
  const [executedPct, setExecutedPct] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);

  if (netStake <= 0 || scaleOutPrice <= 1.01 || avgEntry <= 1.01) return null;

  const scaleSide: "BACK" | "LAY" = netSide === "BACK" ? "LAY" : "BACK";

  async function handleScaleOut(pct: number) {
    if (executing || tradeLoading) return;
    setExecuting(true);

    const scaleStake = r2(netStake * pct);
    if (scaleStake < 2) {
      onToast(`Betfair minimum stake is £2. ${Math.round(pct * 100)}% scale would place £${scaleStake.toFixed(2)}.`, "error");
      setExecuting(false);
      return;
    }

    const success = await onScaleOut(scaleSide, scaleOutPrice, scaleStake);

    if (success) {
      setExecutedPct(pct);
      const remaining = r2(netStake - scaleStake);
      const maxLoss = netSide === "BACK"
        ? r2(remaining)
        : r2(remaining * (avgEntry - 1));
      onToast(
        `Scaled out ${Math.round(pct * 100)}%. Remaining: £${remaining.toFixed(2)}. Max loss capped at -£${maxLoss.toFixed(2)}`,
        "success"
      );
    } else {
      onToast("Scale-out failed", "error");
    }
    setExecuting(false);
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0">Scale out:</span>
        <div className="flex gap-1.5 flex-1">
          {SCALE_OPTIONS.map((pct) => {
            const scaleSize = r2(netStake * pct);
            const belowMin = scaleSize < 2;
            const liability = !belowMin ? calculateLiability(scaleOutPrice, scaleSize, scaleSide) : 0;
            const isExecuted = executedPct === pct;
            const isDisabled = executing || tradeLoading || belowMin || (executedPct !== null && !isExecuted);
            return (
              <button
                key={pct}
                onClick={() => handleScaleOut(pct)}
                disabled={isDisabled}
                title={
                  belowMin
                    ? `£${scaleSize.toFixed(2)} below £2 minimum`
                    : `${scaleSide} £${scaleSize.toFixed(2)} @ ${scaleOutPrice.toFixed(2)} · Liability £${liability.toFixed(2)}`
                }
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  isExecuted
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : isDisabled
                      ? "bg-gray-800/30 text-gray-600 border border-gray-800/30 cursor-not-allowed"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                }`}
              >
                {belowMin ? (
                  <span className="line-through">{Math.round(pct * 100)}%</span>
                ) : (
                  `${Math.round(pct * 100)}%`
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* Liability summary for the first valid scale option */}
      {(() => {
        const firstValid = SCALE_OPTIONS.find((pct) => r2(netStake * pct) >= 2);
        if (!firstValid) return (
          <div className="mt-1 text-[9px] font-mono text-gray-600 px-1">
            All scale options below £2 minimum
          </div>
        );
        const fStake = r2(netStake * firstValid);
        const fLiab = calculateLiability(scaleOutPrice, fStake, scaleSide);
        return (
          <div className={`mt-1 text-[9px] font-mono px-1 ${fLiab > 50 ? "text-amber-400" : "text-gray-600"}`}>
            {scaleSide} @ {scaleOutPrice.toFixed(2)} · {Math.round(firstValid * 100)}% = £{fStake.toFixed(2)} · liability £{fLiab.toFixed(2)}
          </div>
        );
      })()}
    </div>
  );
}
