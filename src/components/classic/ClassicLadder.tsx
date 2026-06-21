"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { type PriceSize } from "@/lib/store";
import { type BetfairRunner } from "@/lib/store";
import { roundToTick, moveByTicks } from "@/lib/tradingMaths";

/* ─── Helpers ─── */

function formatTradedVolume(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
  if (v > 0) return `£${Math.round(v)}`;
  return "";
}

/* ─── Types ─── */

interface LadderRow {
  price: number;
  backSize: number;
  laySize: number;
  isLastTraded: boolean;
  isBestBack: boolean;
  isBestLay: boolean;
  tradedVolume: number;
  pnl: number | null; // null = FLAT / no position
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
  pressure?: { direction: "back" | "lay" | "balanced"; strength: number };
  recenterTrigger?: number;
  ticksEachSide?: number;
  stopLossPrice?: number | null;
  autoCenter?: boolean;
  onCancelUnmatched?: (price: number, side: "BACK" | "LAY") => void;
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
  pressure,
  recenterTrigger,
  ticksEachSide = 8,
  stopLossPrice,
  autoCenter = true,
  onCancelUnmatched,
}: ClassicLadderProps) {
  /* ─── Recenter state ─── */
  const [manualCenter, setManualCenter] = useState<number | null>(null);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Price flash state ─── */
  const [flashDir, setFlashDir] = useState<"up" | "down" | null>(null);
  const prevLTPRef = useRef<number>(0);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLTP = (runner as { lastTradedPrice?: number } | null)?.lastTradedPrice ?? 0;

  useEffect(() => {
    if (currentLTP <= 0 || prevLTPRef.current <= 0) {
      prevLTPRef.current = currentLTP;
      return;
    }
    if (currentLTP !== prevLTPRef.current) {
      const dir = currentLTP < prevLTPRef.current ? "up" : "down"; // shortening = price drops = green
      setFlashDir(dir);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashDir(null), 600);
      prevLTPRef.current = currentLTP;
    }
  }, [currentLTP]);

  /* ─── Auto-center: continuously track LTP ─── */
  useEffect(() => {
    if (!autoCenter) return;
    // When autoCenter is on, clear manual center so ladder tracks LTP naturally
    setManualCenter(null);
  }, [autoCenter, currentLTP]);

  /* ─── Manual recenter ─── */
  const handleRecenter = useCallback(() => {
    const ltp = currentLTP;
    const backs = runner?.ex?.availableToBack ?? [];
    const lays = runner?.ex?.availableToLay ?? [];
    const bestBack = backs[0]?.price ?? 0;
    const bestLay = lays[0]?.price ?? 0;
    const center = ltp && ltp > 0
      ? ltp
      : bestBack && bestLay
        ? (bestBack + bestLay) / 2
        : bestBack || bestLay || 0;
    if (center > 0) {
      setManualCenter(roundToTick(center));
      if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
      recenterTimeoutRef.current = setTimeout(() => setManualCenter(null), 5000);
    }
  }, [currentLTP, runner]);

  useEffect(() => {
    if (!recenterTrigger || recenterTrigger === 0) return;
    handleRecenter();
    return () => {
      if (recenterTimeoutRef.current) clearTimeout(recenterTimeoutRef.current);
    };
  }, [recenterTrigger, handleRecenter]);

  /* ─── Build traded volume map ─── */
  const tvMap = useMemo(() => {
    const map = new Map<number, number>();
    const tv = runner?.ex?.tradedVolume;
    if (!tv) return map;
    for (const ps of tv) {
      map.set(ps.price, (map.get(ps.price) ?? 0) + ps.size);
    }
    return map;
  }, [runner?.ex?.tradedVolume]);

  /* Build ladder rows from runner exchange data */
  const ladderRows = useMemo((): LadderRow[] => {
    const calcPnl = (price: number): number | null => {
      if (!netPosition || netPosition.side === "FLAT" || netPosition.stake <= 0 || netPosition.avgEntry <= 0) return null;
      if (netPosition.side === "BACK") {
        return netPosition.stake * (netPosition.avgEntry / price - 1);
      } else {
        return netPosition.stake * (1 - netPosition.avgEntry / price);
      }
    };

    if (!runner?.ex) {
      if (!playerOdds || playerOdds <= 1.01) return [];
      const center = roundToTick(playerOdds);
      const low = moveByTicks(center, -ticksEachSide);
      const high = moveByTicks(center, ticksEachSide);
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
          tradedVolume: 0,
          pnl: calcPnl(tick),
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

    const centerPrice = manualCenter ?? roundToTick(
      lastTradedPrice > 0
        ? lastTradedPrice
        : bestBackPrice && bestLayPrice
          ? (bestBackPrice + bestLayPrice) / 2
          : bestBackPrice || bestLayPrice || 2.0,
    );

    const ladderLow = moveByTicks(centerPrice, -ticksEachSide);
    const ladderHigh = moveByTicks(centerPrice, ticksEachSide);

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
        tradedVolume: tvMap.get(tick) ?? 0,
        pnl: calcPnl(tick),
      });
      const next = moveByTicks(tick, 1);
      if (next <= tick) break;
      tick = next;
    }
    return rows;
  }, [runner, playerOdds, manualCenter, ticksEachSide, netPosition, tvMap]);

  const maxSize = ladderRows.length > 0
    ? Math.max(...ladderRows.map((r) => Math.max(r.backSize, r.laySize)), 1)
    : 1;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-gray-900 truncate max-w-[100px] sm:max-w-[160px]">
            {playerName}
          </span>
          {netPosition && netPosition.side !== "FLAT" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
              netPosition.side === "BACK"
                ? "bg-blue-100 text-blue-700"
                : "bg-pink-100 text-pink-700"
            }`}>
              {netPosition.side} £{netPosition.stake.toFixed(0)}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-xl font-bold font-mono [font-variant-numeric:tabular-nums] text-gray-900">
            {playerOdds > 0 ? playerOdds.toFixed(2) : "--"}
          </span>
          {unrealisedPnl != null && unrealisedPnl !== 0 && (
            <div className={`text-[11px] font-mono font-semibold ${
              unrealisedPnl >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {unrealisedPnl >= 0 ? "+" : ""}£{unrealisedPnl.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Pressure indicator */}
      {pressure && (
        <div className="text-[10px] font-medium tracking-[0.15em] uppercase text-center py-0.5 border-b border-gray-100">
          {pressure.direction === "back" ? (
            <span className="text-blue-500/60">&uarr; BACK PRESSURE</span>
          ) : pressure.direction === "lay" ? (
            <span className="text-pink-500/60">&darr; LAY PRESSURE</span>
          ) : (
            <span className="text-gray-400/50">&rarr; BALANCED</span>
          )}
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_1fr] text-center text-[10px] font-semibold tracking-[0.12em] uppercase border-b border-gray-200 bg-gray-50">
        <div className="py-1 text-blue-600">BACK</div>
        <div className="py-1 text-gray-500 w-[60px] sm:w-[68px]">PRICE</div>
        <div className="py-1 text-gray-500 w-[32px] hidden sm:block">P&L</div>
        <div className="py-1 text-pink-600">LAY</div>
      </div>

      {/* Ladder rows */}
      <div className="min-h-0">
        {ladderRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {isConnected ? "Awaiting prices..." : "No connection"}
          </div>
        ) : (
          [...ladderRows].reverse().map((row) => {
            const unmatchedAtPrice = unmatchedByPrice.get(row.price);
            const hasUnmatchedBack = (unmatchedAtPrice?.backSize ?? 0) > 0;
            const hasUnmatchedLay = (unmatchedAtPrice?.laySize ?? 0) > 0;
            const isStopLoss = stopLossPrice != null && row.price === roundToTick(stopLossPrice);

            // Flash: only on LTP row
            const isFlashRow = row.isLastTraded && flashDir != null;
            const flashBg = isFlashRow
              ? flashDir === "up" ? "bg-green-100" : "bg-red-100"
              : "";

            return (
              <div
                key={row.price}
                className={`grid grid-cols-[1fr_auto_auto_1fr] items-center border-b border-gray-100 last:border-b-0 transition-colors duration-300 ${flashBg} ${
                  isStopLoss ? "ring-1 ring-inset ring-red-400 ring-dashed" : ""
                }`}
                style={{ height: "30px" }}
              >
                {/* BACK cell */}
                <button
                  onClick={() => onTrade(row.price, "BACK")}
                  disabled={tradeLoading || !isConnected}
                  className={`h-full relative text-right pr-2 font-mono [font-variant-numeric:tabular-nums] text-xs transition-colors ${
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
                      className="absolute inset-y-0 right-0 bg-blue-200/40 transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min((row.backSize / maxSize) * 100, 100)}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {row.backSize > 0 ? `£${row.backSize}` : ""}
                  </span>
                  {hasUnmatchedBack && (
                    <span className="absolute top-0 left-0 z-20 flex items-center gap-0.5 px-1 py-0.5 bg-amber-400 text-[9px] font-bold text-amber-900 rounded-br leading-none">
                      £{unmatchedAtPrice!.backSize}
                      {onCancelUnmatched && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancelUnmatched(row.price, "BACK"); }}
                          className="ml-0.5 text-amber-700 hover:text-red-700 font-bold"
                          title="Cancel unmatched back"
                        >&times;</button>
                      )}
                    </span>
                  )}
                </button>

                {/* PRICE + VOLUME cell */}
                <div
                  className={`h-full flex flex-col items-center justify-center font-mono [font-variant-numeric:tabular-nums] w-[60px] sm:w-[68px] ${
                    row.isLastTraded
                      ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="text-xs font-bold leading-tight">{row.price.toFixed(2)}</span>
                  {row.tradedVolume > 0 && (
                    <span className="text-[9px] text-gray-400 font-mono leading-none">
                      {formatTradedVolume(row.tradedVolume)}
                    </span>
                  )}
                </div>

                {/* P&L cell (hidden on mobile) */}
                <div className="h-full w-[32px] hidden sm:flex items-center justify-center bg-gray-50/50">
                  {row.pnl != null && (
                    <span className={`text-[9px] font-mono font-semibold ${
                      row.pnl >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* LAY cell */}
                <button
                  onClick={() => onTrade(row.price, "LAY")}
                  disabled={tradeLoading || !isConnected}
                  className={`h-full relative text-left pl-2 font-mono [font-variant-numeric:tabular-nums] text-xs transition-colors ${
                    row.isBestLay
                      ? "bg-pink-200 hover:bg-pink-300 font-semibold text-pink-900"
                      : row.laySize > 0
                        ? "bg-pink-50 hover:bg-pink-100 text-pink-800"
                        : "hover:bg-pink-50 text-gray-400"
                  } ${tradeLoading || !isConnected ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  {row.laySize > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-pink-200/40 transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min((row.laySize / maxSize) * 100, 100)}%` }}
                    />
                  )}
                  <span className="relative z-10">
                    {row.laySize > 0 ? `£${row.laySize}` : ""}
                  </span>
                  {hasUnmatchedLay && (
                    <span className="absolute top-0 right-0 z-20 flex items-center gap-0.5 px-1 py-0.5 bg-amber-400 text-[9px] font-bold text-amber-900 rounded-bl leading-none">
                      £{unmatchedAtPrice!.laySize}
                      {onCancelUnmatched && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancelUnmatched(row.price, "LAY"); }}
                          className="ml-0.5 text-amber-700 hover:text-red-700 font-bold"
                          title="Cancel unmatched lay"
                        >&times;</button>
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: status + recenter */}
      <div className="px-2 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[10px] text-gray-500">
        <span>
          {isInPlay ? (
            <span className="text-green-600 font-semibold">IN-PLAY</span>
          ) : (
            <span className="text-blue-600">PRE-MATCH</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono">£{activeStake}</span>
          <button
            onClick={handleRecenter}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
            title="Recenter ladder (Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
