"use client";

import { useState } from "react";

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

  async function handleScaleOut(pct: number) {
    if (executing || tradeLoading) return;
    setExecuting(true);

    const scaleStake = r2(netStake * pct);
    if (scaleStake < 2) {
      onToast("Stake too small to scale out", "error");
      setExecuting(false);
      return;
    }

    // Place opposite trade to partially close position
    const scaleSide: "BACK" | "LAY" = netSide === "BACK" ? "LAY" : "BACK";
    const success = await onScaleOut(scaleSide, scaleOutPrice, scaleStake);

    if (success) {
      setExecutedPct(pct);
      const remaining = r2(netStake - scaleStake);
      // Max loss on remaining: if BACK position, remaining exposure is the remaining stake
      // More precisely: if we backed at avgEntry and partially laid off, max loss on remaining
      // is roughly remaining stake if the selection loses
      const maxLoss = netSide === "BACK"
        ? r2(remaining) // lose the remaining stake
        : r2(remaining * (avgEntry - 1)); // lay liability on remaining
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
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[10px] text-gray-500 shrink-0">Scale out:</span>
      <div className="flex gap-1.5 flex-1">
        {SCALE_OPTIONS.map((pct) => {
          const isExecuted = executedPct === pct;
          const isDisabled = executing || tradeLoading || (executedPct !== null && !isExecuted);
          return (
            <button
              key={pct}
              onClick={() => handleScaleOut(pct)}
              disabled={isDisabled}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                isExecuted
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : isDisabled
                    ? "bg-gray-800/30 text-gray-600 border border-gray-800/30 cursor-not-allowed"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
              }`}
            >
              {Math.round(pct * 100)}%
            </button>
          );
        })}
      </div>
    </div>
  );
}
