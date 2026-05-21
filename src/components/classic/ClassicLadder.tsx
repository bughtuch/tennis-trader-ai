"use client";

import { useMemo } from "react";
import { type PriceSize } from "@/lib/store";
import { type BetfairRunner } from "@/lib/store";
import { roundToTick, moveByTicks } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface LadderRow {
  price: number;
  backSize: number;
  laySize: number;
  isLastTraded: boolean;
  isBestBack: boolean;
  isBestLay: boolean;
}

interface ClassicLadderProps {
  runner: BetfairRunner | null;
  playerName: string;
  playerOdds: number;
  isConnected: boolean;
  isInPlay: boolean;
  unmatchedByPrice: Map<number, { backSize: number; laySize: number }>;
  onTrade: (price: number, side: "BACK" | "LAY") => void;
  activeStake: number;
  tradeLoading: boolean;
  netPosition?: { side: "BACK" | "LAY" | "FLAT"; stake: number; avgEntry: number } | null;
  unrealisedPnl?: number | null;
}

/* ─── Component ─── */

export default function ClassicLadder({
  runner,
  playerName,
  playerOdds,
  isConnected,
  isInPlay,
  unmatchedByPrice,
  onTrade,
  activeStake,
  tradeLoading,
  netPosition,
  unrealisedPnl,
}: ClassicLadderProps) {
  /* Build ladder rows from runner exchange data */
  const ladderRows = useMemo((): LadderRow[] => {
    if (!runner?.ex) {
      // Fallback: build from playerOdds if available
      if (!playerOdds || playerOdds <= 1.01) return [];
      const center = roundToTick(playerOdds);
      const TICKS = 8;
      const low = moveByTicks(center, -TICKS);
      const high = moveByTicks(center, TICKS);
      const rows: LadderRow[] = [];
      let tick = roundToTick(low);
      while (tick <= high) {
        rows.push({
          price: tick,
          backSize: 0,
          laySize: 0,
          isLastTraded: tick === center,
          isBestBack: false,
          isBestLay: false,
        });
        const next = moveByTicks(tick, 1);
        if (next <= tick) break;
        tick = next;
      }
      return rows;
    }

    const backMap = new Map<number, number>();
    const layMap = new Map<number, number>();
    const backs = runner.ex.availableToBack ?? [];
    const lays = runner.ex.availableToLay ?? [];

    backs.forEach((ps: PriceSize) => {
      backMap.set(ps.price, (backMap.get(ps.price) ?? 0) + ps.size);
    });
    lays.forEach((ps: PriceSize) => {
      layMap.set(ps.price, (layMap.get(ps.price) ?? 0) + ps.size);
    });

    const bestBackPrice = backs[0]?.price ?? 0;
    const bestLayPrice = lays[0]?.price ?? 0;
    const lastTradedPrice = (runner as { lastTradedPrice?: number }).lastTradedPrice ?? 0;

    const centerPrice = roundToTick(
      bestBackPrice && bestLayPrice
        ? (bestBackPrice + bestLayPrice) / 2
        : bestBackPrice || bestLayPrice || 2.0,
    );

    const TICKS_EACH_SIDE = 8;
    const ladderLow = moveByTicks(centerPrice, -TICKS_EACH_SIDE);
    const ladderHigh = moveByTicks(centerPrice, TICKS_EACH_SIDE);

    const rows: LadderRow[] = [];
    let tick = roundToTick(ladderLow);
    while (tick <= ladderHigh) {
      rows.push({
        price: tick,
        backSize: Math.round(backMap.get(tick) ?? 0),
        laySize: Math.round(layMap.get(tick) ?? 0),
        isLastTraded: lastTradedPrice > 0
          ? tick === roundToTick(lastTradedPrice)
          : tick === bestBackPrice,
        isBestBack: tick === bestBackPrice,
        isBestLay: tick === bestLayPrice,
      });
      const next = moveByTicks(tick, 1);
      if (next <= tick) break;
      tick = next;
    }
    return rows;
  }, [runner, playerOdds]);

  const maxSize = ladderRows.length > 0
    ? Math.max(...ladderRows.map((r) => Math.max(r.backSize, r.laySize)), 1)
    : 1;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 truncate max-w-[140px]">
            {playerName}
          </span>
          {netPosition && netPosition.side !== "FLAT" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              netPosition.side === "BACK"
                ? "bg-blue-100 text-blue-700"
                : "bg-pink-100 text-pink-700"
            }`}>
              {netPosition.side} £{netPosition.stake.toFixed(0)}
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-lg font-bold font-mono text-gray-900">
            {playerOdds > 0 ? playerOdds.toFixed(2) : "--"}
          </span>
          {unrealisedPnl != null && unrealisedPnl !== 0 && (
            <div className={`text-[10px] font-mono font-semibold ${
              unrealisedPnl >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {unrealisedPnl >= 0 ? "+" : ""}£{unrealisedPnl.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 text-center text-[10px] font-semibold tracking-wider uppercase border-b border-gray-200 bg-gray-50">
        <div className="py-1 text-blue-600">BACK</div>
        <div className="py-1 text-gray-500">PRICE</div>
        <div className="py-1 text-pink-600">LAY</div>
      </div>

      {/* Ladder rows */}
      <div className="divide-y divide-gray-100">
        {ladderRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {isConnected ? "Awaiting prices..." : "No connection"}
          </div>
        ) : (
          [...ladderRows].reverse().map((row) => {
            const unmatchedAtPrice = unmatchedByPrice.get(row.price);
            const hasUnmatchedBack = (unmatchedAtPrice?.backSize ?? 0) > 0;
            const hasUnmatchedLay = (unmatchedAtPrice?.laySize ?? 0) > 0;

            return (
              <div
                key={row.price}
                className="grid grid-cols-3 items-center"
                style={{ height: "26px" }}
              >
                {/* BACK cell */}
                <button
                  onClick={() => onTrade(row.price, "BACK")}
                  disabled={tradeLoading || !isConnected}
                  className={`h-full relative text-right pr-2 font-mono text-[11px] transition-colors ${
                    row.isBestBack
                      ? "bg-blue-200 hover:bg-blue-300 font-semibold text-blue-900"
                      : row.backSize > 0
                        ? "bg-blue-50 hover:bg-blue-100 text-blue-800"
                        : "hover:bg-blue-50 text-gray-400"
                  } ${tradeLoading || !isConnected ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  {/* Depth bar */}
                  {row.backSize > 0 && (
                    <div
                      className="absolute inset-y-0 right-0 bg-blue-200/40"
                      style={{ width: `${Math.min((row.backSize / maxSize) * 100, 100)}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {row.backSize > 0 ? `£${row.backSize}` : ""}
                  </span>
                  {/* Unmatched indicator */}
                  {hasUnmatchedBack && (
                    <span className="absolute top-0.5 left-1 w-1.5 h-1.5 rounded-full bg-amber-500 z-10" />
                  )}
                </button>

                {/* PRICE cell */}
                <div
                  className={`h-full flex items-center justify-center font-mono text-xs font-bold ${
                    row.isLastTraded
                      ? "bg-green-100 text-green-800 ring-1 ring-inset ring-green-300"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {row.price.toFixed(2)}
                </div>

                {/* LAY cell */}
                <button
                  onClick={() => onTrade(row.price, "LAY")}
                  disabled={tradeLoading || !isConnected}
                  className={`h-full relative text-left pl-2 font-mono text-[11px] transition-colors ${
                    row.isBestLay
                      ? "bg-pink-200 hover:bg-pink-300 font-semibold text-pink-900"
                      : row.laySize > 0
                        ? "bg-pink-50 hover:bg-pink-100 text-pink-800"
                        : "hover:bg-pink-50 text-gray-400"
                  } ${tradeLoading || !isConnected ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  {row.laySize > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-pink-200/40"
                      style={{ width: `${Math.min((row.laySize / maxSize) * 100, 100)}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {row.laySize > 0 ? `£${row.laySize}` : ""}
                  </span>
                  {hasUnmatchedLay && (
                    <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 z-10" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: status */}
      <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[10px] text-gray-500">
        <span>
          {isInPlay ? (
            <span className="text-green-600 font-semibold">IN-PLAY</span>
          ) : (
            <span className="text-blue-600">PRE-MATCH</span>
          )}
        </span>
        <span className="font-mono">Stake: £{activeStake}</span>
      </div>
    </div>
  );
}
