"use client";

import { useMemo } from "react";
import { roundToTick } from "@/lib/tradingMaths";

const WIN_SET_MULTIPLIER = 0.78; // odds compress ~22% on set win
const LOSE_SET_MULTIPLIER = 1.35; // odds expand ~35% on set loss

interface SetWinningPriceProps {
  player1Name: string;
  player2Name: string;
  player1Odds: number;
  player2Odds: number;
}

interface PlayerSetPrices {
  short: string;
  current: number;
  winSet: number;
  loseSet: number;
  overreacted: boolean;
}

function calcSetPrices(name: string, odds: number): PlayerSetPrices {
  const short = name.split(" ").pop() ?? name;
  if (odds <= 1.01) {
    return { short, current: odds, winSet: 0, loseSet: 0, overreacted: false };
  }
  const winSet = roundToTick(odds * WIN_SET_MULTIPLIER);
  const loseSet = roundToTick(odds * LOSE_SET_MULTIPLIER);
  // Overreacted: current odds have dropped to or below the set winning price
  // This means the market has priced in more than a set win — potential lay opportunity
  const overreacted = odds > 1.01 && odds <= winSet;
  return { short, current: odds, winSet, loseSet, overreacted };
}

function PlayerRow({ data }: { data: PlayerSetPrices }) {
  if (data.current <= 1.01) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${data.overreacted ? "" : ""}`}>
      <span className="text-xs text-gray-500 shrink-0">If</span>
      <span className="text-xs font-medium text-white shrink-0">{data.short}</span>
      <span className="text-xs text-gray-500 shrink-0">wins set</span>
      <span className="text-xs font-mono font-semibold text-green-400 shrink-0">
        {data.winSet.toFixed(2)}
      </span>
      <span className="text-gray-700 shrink-0">|</span>
      <span className="text-xs text-gray-500 shrink-0">loses</span>
      <span className="text-xs font-mono font-semibold text-red-400 shrink-0">
        {data.loseSet.toFixed(2)}
      </span>
      {data.overreacted && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse shrink-0">
          OVERREACTED — lay opportunity
        </span>
      )}
    </div>
  );
}

export default function SetWinningPrice({
  player1Name,
  player2Name,
  player1Odds,
  player2Odds,
}: SetWinningPriceProps) {
  const data = useMemo(() => {
    if (player1Odds <= 1.01 && player2Odds <= 1.01) return null;
    return {
      p1: calcSetPrices(player1Name, player1Odds),
      p2: calcSetPrices(player2Name, player2Odds),
    };
  }, [player1Name, player2Name, player1Odds, player2Odds]);

  if (!data) return null;

  return (
    <div className="border-b border-gray-800/50 bg-gray-900/20">
      <div className="px-2 md:px-4 py-1.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] tracking-[0.15em] uppercase text-gray-500 font-medium">
            SET PRICES
          </span>
        </div>
        <div className="space-y-1">
          <PlayerRow data={data.p1} />
          <PlayerRow data={data.p2} />
        </div>
      </div>
    </div>
  );
}
