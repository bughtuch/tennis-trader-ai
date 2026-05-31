"use client";

import { useState, useEffect } from "react";
import { calculateLiability } from "@/lib/tradingMaths";

/* ─── Types ─── */

interface SupabaseTrade {
  id: string;
  user_id: string;
  market_id: string | null;
  selection_id: string | null;
  player: string | null;
  side: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stake: number | null;
  pnl: number | null;
  status: string;
  greened_up: boolean;
  is_shadow: boolean;
  ai_signal_used: boolean;
  notes: string | null;
  coach_insight: string | null;
  created_at: string;
  closed_at: string | null;
}

interface UnmatchedDisplayOrder {
  betId: string;
  displayId: string;
  marketId: string;
  selectionId: number;
  player: string;
  side: "BACK" | "LAY";
  price: number;
  sizeRemaining: number;
  sizeMatched: number;
  placedDate: string;
  isPartial: boolean;
}

interface AggregatedPosition {
  netSide: "BACK" | "LAY" | "FLAT";
  netStake: number;
  avgEntry: number;
  count: number;
  backTotal: number;
  layTotal: number;
}

interface ClassicTrustPanelProps {
  matchedPositions: SupabaseTrade[];
  unmatchedOrders: UnmatchedDisplayOrder[];
  player1Agg: AggregatedPosition | null;
  player2Agg: AggregatedPosition | null;
  player1Name: string;
  player2Name: string;
  outcomePnl: { ifPlayer1Wins: number; ifPlayer2Wins: number } | null;
  onCancelOrder: (betId: string) => Promise<void>;
  onCancelAll: () => Promise<void>;
  tradeLoading: boolean;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatAge(ms: number): { text: string; color: string } {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    const color = seconds > 45 ? "text-amber-600" : "text-gray-400";
    return { text: `${seconds}s`, color };
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return { text: `${minutes}m ${secs.toString().padStart(2, "0")}s`, color: "text-red-500" };
}

/* ─── Component ─── */

export default function ClassicTrustPanel({
  matchedPositions,
  unmatchedOrders,
  player1Agg,
  player2Agg,
  player1Name,
  player2Name,
  outcomePnl,
  onCancelOrder,
  onCancelAll,
  tradeLoading,
}: ClassicTrustPanelProps) {
  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  /* ─── Order age timer: force re-render every 1s ─── */
  const [, setTick] = useState(0);
  useEffect(() => {
    if (unmatchedOrders.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [unmatchedOrders.length]);

  /* ─── Cancel by side ─── */
  const backOrders = unmatchedOrders.filter((o) => o.side === "BACK");
  const layOrders = unmatchedOrders.filter((o) => o.side === "LAY");

  async function cancelBySide(side: "BACK" | "LAY") {
    const orders = side === "BACK" ? backOrders : layOrders;
    for (const o of orders) {
      await onCancelOrder(o.betId);
    }
  }

  /* ─── Unmatched liability held ─── */
  const unmatchedLiabilityHeld = unmatchedOrders.reduce((sum, o) => {
    if (o.side === "BACK") return sum + o.sizeRemaining;
    return sum + r2(o.sizeRemaining * (o.price - 1));
  }, 0);

  /* ─── Exposure calculations ─── */
  const maxLoss = outcomePnl
    ? Math.min(outcomePnl.ifPlayer1Wins, outcomePnl.ifPlayer2Wins)
    : 0;
  const guaranteedProfit = outcomePnl && outcomePnl.ifPlayer1Wins >= 0 && outcomePnl.ifPlayer2Wins >= 0
    ? Math.min(outcomePnl.ifPlayer1Wins, outcomePnl.ifPlayer2Wins)
    : null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-gray-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-bold tracking-wider uppercase text-gray-600">
          TRADING STATE
        </h2>
      </div>

      <div className="divide-y divide-gray-100">
        {/* ─── 1. MATCHED BETS ─── */}
        <div className="p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
            MATCHED ({matchedPositions.length})
          </div>
          {matchedPositions.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-1.5">No matched bets</div>
          ) : (
            <div className="space-y-1">
              {matchedPositions.map((pos) => {
                const liability = pos.stake && pos.entry_price
                  ? calculateLiability(pos.entry_price, pos.stake, (pos.side as "BACK" | "LAY") ?? "BACK")
                  : 0;
                return (
                  <div key={pos.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        pos.side === "BACK"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}>
                        {pos.side}
                      </span>
                      <span className="text-gray-700 truncate">
                        {pos.player?.split(" ").pop()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-gray-600">
                        £{pos.stake?.toFixed(0)} @ {pos.entry_price?.toFixed(2)}
                      </span>
                      <span className="font-mono text-gray-400 text-[10px]">
                        L:£{liability.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── 2. UNMATCHED BETS ─── */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
              UNMATCHED ({unmatchedOrders.length})
            </div>
            {unmatchedOrders.length > 0 && (
              <div className="flex items-center gap-1.5">
                {backOrders.length > 0 && (
                  <button
                    onClick={() => cancelBySide("BACK")}
                    disabled={tradeLoading}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    CANCEL BACKS
                  </button>
                )}
                {layOrders.length > 0 && (
                  <button
                    onClick={() => cancelBySide("LAY")}
                    disabled={tradeLoading}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 disabled:opacity-50 transition-colors"
                  >
                    CANCEL LAYS
                  </button>
                )}
                <button
                  onClick={onCancelAll}
                  disabled={tradeLoading}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
                >
                  CANCEL ALL
                </button>
              </div>
            )}
          </div>
          {unmatchedOrders.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-1.5">No unmatched orders</div>
          ) : (
            <div className="space-y-1">
              {unmatchedOrders.map((order) => {
                const liability = calculateLiability(order.price, order.sizeRemaining, order.side);
                const age = Date.now() - new Date(order.placedDate).getTime();
                const { text: ageText, color: ageColor } = formatAge(age);
                return (
                  <div key={order.displayId} className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        order.side === "BACK"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}>
                        {order.side}
                      </span>
                      <span className="text-gray-700 truncate">
                        {order.player.split(" ").pop()}
                      </span>
                      <span className="font-mono text-gray-500 text-[10px]">
                        £{order.sizeRemaining.toFixed(0)} @ {order.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`font-mono text-[10px] font-semibold ${ageColor}`}>
                        {ageText}
                      </span>
                      <span className="font-mono text-amber-600 text-[10px]">
                        L:£{liability.toFixed(2)}
                      </span>
                      <button
                        onClick={() => onCancelOrder(order.betId)}
                        disabled={tradeLoading}
                        className="text-red-500 hover:text-red-700 font-bold text-[10px] disabled:opacity-50"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── 3. POSITION (aggregated) ─── */}
        <div className="p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
            POSITION
          </div>
          <div className="space-y-1.5">
            {/* Player 1 */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">{p1Short}</span>
              {player1Agg && player1Agg.netSide !== "FLAT" ? (
                <div className="flex items-center gap-1.5">
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                    player1Agg.netSide === "BACK"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-pink-100 text-pink-700"
                  }`}>
                    NET {player1Agg.netSide}
                  </span>
                  <span className="font-mono text-gray-700">
                    £{player1Agg.netStake.toFixed(2)} @ {player1Agg.avgEntry.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-[10px] font-semibold">FLAT</span>
              )}
            </div>
            {/* Player 2 */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">{p2Short}</span>
              {player2Agg && player2Agg.netSide !== "FLAT" ? (
                <div className="flex items-center gap-1.5">
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                    player2Agg.netSide === "BACK"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-pink-100 text-pink-700"
                  }`}>
                    NET {player2Agg.netSide}
                  </span>
                  <span className="font-mono text-gray-700">
                    £{player2Agg.netStake.toFixed(2)} @ {player2Agg.avgEntry.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-[10px] font-semibold">FLAT</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── 4. EXPOSURE ─── */}
        <div className="p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
            EXPOSURE
          </div>
          {outcomePnl ? (
            <div className="space-y-1.5">
              {/* Outcome P&L */}
              <div className="grid grid-cols-2 gap-2 text-xs">
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
              {/* Max loss / Guaranteed */}
              <div className="flex items-center justify-between text-[11px]">
                {guaranteedProfit !== null ? (
                  <>
                    <span className="text-gray-500">Guaranteed</span>
                    <span className="font-mono font-bold text-green-600">+£{guaranteedProfit.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">Max loss</span>
                    <span className="font-mono font-bold text-red-600">£{Math.abs(maxLoss).toFixed(2)}</span>
                  </>
                )}
              </div>
              {/* Unmatched liability held */}
              {unmatchedOrders.length > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">Unmatched held</span>
                  <span className="font-mono text-amber-600">£{r2(unmatchedLiabilityHeld).toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-1.5">No exposure</div>
          )}
        </div>
      </div>
    </div>
  );
}
