"use client";

import { useMemo } from "react";
import { moveByTicks } from "@/lib/tradingMaths";

/* Fixed assumptions — will be replaced by AI later */
const HOLD_SERVE_TICKS = -8; // price drops (improves for backer)
const BROKEN_TICKS = 40; // price drifts (worsens for backer)

interface RiskRewardPanelProps {
  bestBackPrice: number;
  bestLayPrice: number;
  stake: number;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function countTicks(from: number, to: number): number {
  if (from === to) return 0;
  let count = 0;
  let current = from;
  if (to > from) {
    while (current < to) {
      const next = moveByTicks(current, 1);
      if (next <= current) break; // safety
      current = next;
      count++;
      if (count > 500) break;
    }
    return count;
  } else {
    while (current > to) {
      const next = moveByTicks(current, -1);
      if (next >= current) break;
      current = next;
      count++;
      if (count > 500) break;
    }
    return count;
  }
}

interface Scenario {
  label: string;
  targetPrice: number;
  ticks: number;
  pnl: number;
}

interface SideAnalysis {
  side: "BACK" | "LAY";
  price: number;
  holdServe: Scenario;
  broken: Scenario;
  ratio: number;
  rating: "TRADE" | "MARGINAL" | "WAIT";
  ratingColor: string;
}

function calcBackAnalysis(
  backPrice: number,
  stake: number
): SideAnalysis {
  // BACK at backPrice
  // Hold serve → price drops (good for backer)
  const holdTarget = moveByTicks(backPrice, HOLD_SERVE_TICKS);
  const holdTicks = countTicks(backPrice, holdTarget);
  // Profit from back if price drops: greenup profit ≈ stake * (backPrice / holdTarget - 1)
  // More precisely: back at backPrice, lay at holdTarget to green up
  const holdLayStake = r2((stake * backPrice) / holdTarget);
  const holdProfit = r2(holdLayStake - stake); // profit if selection loses (both sides covered)

  // Broken → price drifts up (bad for backer)
  const brokenTarget = moveByTicks(backPrice, BROKEN_TICKS);
  const brokenTicks = countTicks(backPrice, brokenTarget);
  const brokenLayStake = r2((stake * backPrice) / brokenTarget);
  const brokenLoss = r2(brokenLayStake - stake); // this will be negative

  const rewardTicks = holdTicks;
  const riskTicks = brokenTicks;
  const ratio = riskTicks > 0 ? r2(rewardTicks / riskTicks) : 0;

  return {
    side: "BACK",
    price: backPrice,
    holdServe: {
      label: "Hold serve",
      targetPrice: holdTarget,
      ticks: holdTicks,
      pnl: holdProfit,
    },
    broken: {
      label: "Broken",
      targetPrice: brokenTarget,
      ticks: brokenTicks,
      pnl: brokenLoss,
    },
    ratio,
    rating: ratio >= 1 ? "TRADE" : ratio >= 0.5 ? "MARGINAL" : "WAIT",
    ratingColor:
      ratio >= 1
        ? "text-green-400"
        : ratio >= 0.5
          ? "text-amber-400"
          : "text-red-400",
  };
}

function calcLayAnalysis(
  layPrice: number,
  stake: number
): SideAnalysis {
  // LAY at layPrice
  // Hold serve → price drops (bad for layer — they need to buy back cheaper but liability grows)
  const holdTarget = moveByTicks(layPrice, HOLD_SERVE_TICKS);
  const holdTicks = countTicks(layPrice, holdTarget);
  // Lay at layPrice, back at holdTarget to green up
  const holdBackStake = r2((stake * layPrice) / holdTarget);
  const holdLoss = r2(stake - holdBackStake); // negative — loss for layer when price drops

  // Broken → price drifts (good for layer — can buy back at higher price = profit)
  const brokenTarget = moveByTicks(layPrice, BROKEN_TICKS);
  const brokenTicks = countTicks(layPrice, brokenTarget);
  const brokenBackStake = r2((stake * layPrice) / brokenTarget);
  const brokenProfit = r2(stake - brokenBackStake); // positive — profit for layer

  const rewardTicks = brokenTicks;
  const riskTicks = holdTicks;
  const ratio = riskTicks > 0 ? r2(rewardTicks / riskTicks) : 0;

  return {
    side: "LAY",
    price: layPrice,
    holdServe: {
      label: "Hold serve",
      targetPrice: holdTarget,
      ticks: holdTicks,
      pnl: holdLoss,
    },
    broken: {
      label: "Broken",
      targetPrice: brokenTarget,
      ticks: brokenTicks,
      pnl: brokenProfit,
    },
    ratio,
    rating: ratio >= 1 ? "TRADE" : ratio >= 0.5 ? "MARGINAL" : "WAIT",
    ratingColor:
      ratio >= 1
        ? "text-green-400"
        : ratio >= 0.5
          ? "text-amber-400"
          : "text-red-400",
  };
}

function RatingDot({ color }: { color: string }) {
  const bg = color.includes("green")
    ? "bg-green-400"
    : color.includes("amber")
      ? "bg-amber-400"
      : "bg-red-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${bg}`} />;
}

function SideBlock({ analysis, stake }: { analysis: SideAnalysis; stake: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            analysis.side === "BACK"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-pink-500/20 text-pink-400"
          }`}
        >
          {analysis.side}
        </span>
        <span className="text-xs text-white font-mono font-semibold">
          {analysis.price.toFixed(2)}
        </span>
      </div>

      {/* Hold serve scenario */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{analysis.holdServe.label}</span>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-gray-400">{analysis.holdServe.targetPrice.toFixed(2)}</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">{analysis.holdServe.ticks}t</span>
          <span className="text-gray-600">|</span>
          <span
            className={`font-semibold ${
              analysis.holdServe.pnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {analysis.holdServe.pnl >= 0 ? "+" : ""}£{analysis.holdServe.pnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Broken scenario */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500">{analysis.broken.label}</span>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-gray-400">{analysis.broken.targetPrice.toFixed(2)}</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">{analysis.broken.ticks}t</span>
          <span className="text-gray-600">|</span>
          <span
            className={`font-semibold ${
              analysis.broken.pnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {analysis.broken.pnl >= 0 ? "+" : ""}£{analysis.broken.pnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* R/R ratio */}
      <div className="flex items-center justify-between text-[11px] pt-0.5">
        <span className="text-gray-500">R/R</span>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-semibold ${analysis.ratingColor}`}>
            {analysis.ratio.toFixed(1)}x
          </span>
          <span className="text-gray-600">—</span>
          <span className={`font-semibold ${analysis.ratingColor}`}>
            {analysis.rating}
          </span>
          <RatingDot color={analysis.ratingColor} />
        </div>
      </div>
    </div>
  );
}

export default function RiskRewardPanel({
  bestBackPrice,
  bestLayPrice,
  stake,
}: RiskRewardPanelProps) {
  const analysis = useMemo(() => {
    if (!bestBackPrice || !bestLayPrice || bestBackPrice <= 1.01 || bestLayPrice <= 1.01) {
      return null;
    }
    return {
      back: calcBackAnalysis(bestBackPrice, stake),
      lay: calcLayAnalysis(bestLayPrice, stake),
    };
  }, [bestBackPrice, bestLayPrice, stake]);

  if (!analysis) {
    return (
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              RISK / REWARD
            </h2>
          </div>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-600">Waiting for market prices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                analysis.back.rating === "TRADE" || analysis.lay.rating === "TRADE"
                  ? "bg-green-400 animate-pulse"
                  : "bg-gray-500"
              }`}
            />
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              RISK / REWARD
            </h2>
          </div>
          <span className="text-[10px] text-gray-600 font-mono">£{stake} stake</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <SideBlock analysis={analysis.back} stake={stake} />
        <div className="border-t border-gray-800/50" />
        <SideBlock analysis={analysis.lay} stake={stake} />
      </div>

      <div className="px-4 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-600 text-center">
          Hold = 8 ticks | Break = 40 ticks (fixed)
        </p>
      </div>
    </div>
  );
}
