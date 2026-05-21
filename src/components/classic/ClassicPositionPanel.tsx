"use client";

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

interface GreenUpCalc {
  greenUpStake: number;
  greenUpSide: "BACK" | "LAY";
  equalProfit: number;
  profitIfWin: number;
  profitIfLose: number;
}

interface ClassicPositionPanelProps {
  openPositions: SupabaseTrade[];
  unmatchedOrders: UnmatchedDisplayOrder[];
  player1Agg: AggregatedPosition | null;
  player2Agg: AggregatedPosition | null;
  player1Name: string;
  player2Name: string;
  player1GreenUp: GreenUpCalc | null;
  player2GreenUp: GreenUpCalc | null;
  outcomePnl: { ifPlayer1Wins: number; ifPlayer2Wins: number } | null;
  onGreenUp: (runner: "player1" | "player2") => Promise<void>;
  onCancelOrder: (betId: string) => Promise<void>;
  onCancelAll: () => Promise<void>;
  tradeLoading: boolean;
  closedTrades: SupabaseTrade[];
  sessionPnl: number;
  winRate: number;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ─── Component ─── */

export default function ClassicPositionPanel({
  openPositions,
  unmatchedOrders,
  player1Agg,
  player2Agg,
  player1Name,
  player2Name,
  player1GreenUp,
  player2GreenUp,
  outcomePnl,
  onGreenUp,
  onCancelOrder,
  onCancelAll,
  tradeLoading,
  closedTrades,
  sessionPnl,
  winRate,
}: ClassicPositionPanelProps) {
  const hasP1Position = player1Agg && player1Agg.netSide !== "FLAT";
  const hasP2Position = player2Agg && player2Agg.netSide !== "FLAT";
  const hasAnyPosition = hasP1Position || hasP2Position;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-gray-900 h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-bold tracking-wider uppercase text-gray-600">
          POSITIONS & ORDERS
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* ─── GREEN ALL / HEDGE Buttons ─── */}
        {hasAnyPosition && (
          <div className="p-3 space-y-2">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-1">
              GREEN UP
            </div>

            {hasP1Position && player1GreenUp && (
              <button
                onClick={() => onGreenUp("player1")}
                disabled={tradeLoading}
                className={`w-full py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${
                  player1GreenUp.equalProfit >= 0
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                } ${tradeLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>GREEN {player1Name.split(" ").pop()}</span>
                <span className="font-mono">
                  {player1GreenUp.equalProfit >= 0 ? "+" : ""}
                  £{player1GreenUp.equalProfit.toFixed(2)}
                </span>
              </button>
            )}

            {hasP2Position && player2GreenUp && (
              <button
                onClick={() => onGreenUp("player2")}
                disabled={tradeLoading}
                className={`w-full py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${
                  player2GreenUp.equalProfit >= 0
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                } ${tradeLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>GREEN {player2Name.split(" ").pop()}</span>
                <span className="font-mono">
                  {player2GreenUp.equalProfit >= 0 ? "+" : ""}
                  £{player2GreenUp.equalProfit.toFixed(2)}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ─── Outcome P&L ─── */}
        {outcomePnl && (
          <div className="p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
              OUTCOME P&L
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 p-2 text-center">
                <div className="text-[10px] text-gray-500 truncate">{player1Name.split(" ").pop()} wins</div>
                <div className={`text-sm font-bold font-mono ${
                  outcomePnl.ifPlayer1Wins >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {outcomePnl.ifPlayer1Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer1Wins.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-2 text-center">
                <div className="text-[10px] text-gray-500 truncate">{player2Name.split(" ").pop()} wins</div>
                <div className={`text-sm font-bold font-mono ${
                  outcomePnl.ifPlayer2Wins >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {outcomePnl.ifPlayer2Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer2Wins.toFixed(2)}
                </div>
              </div>
            </div>
            {outcomePnl.ifPlayer1Wins > 0 && outcomePnl.ifPlayer2Wins > 0 && (
              <div className="mt-1.5 text-xs font-semibold text-green-600 text-center">
                Locked: +£{Math.min(outcomePnl.ifPlayer1Wins, outcomePnl.ifPlayer2Wins).toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* ─── Open Positions ─── */}
        <div className="p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
            LIVE POSITIONS ({openPositions.length})
          </div>
          {openPositions.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">No open positions</div>
          ) : (
            <div className="space-y-1.5">
              {openPositions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                      pos.side === "BACK"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-pink-100 text-pink-700"
                    }`}>
                      {pos.side}
                    </span>
                    <span className="text-gray-700 truncate max-w-[80px]">
                      {pos.player?.split(" ").pop()}
                    </span>
                  </div>
                  <div className="font-mono text-gray-600">
                    £{pos.stake?.toFixed(0)} @ {pos.entry_price?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Unmatched Orders ─── */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">
              UNMATCHED ({unmatchedOrders.length})
            </div>
            {unmatchedOrders.length > 0 && (
              <button
                onClick={onCancelAll}
                disabled={tradeLoading}
                className="text-[10px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                CANCEL ALL
              </button>
            )}
          </div>
          {unmatchedOrders.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">No unmatched orders</div>
          ) : (
            <div className="space-y-1.5">
              {unmatchedOrders.map((order) => {
                const liability = calculateLiability(order.price, order.sizeRemaining, order.side);
                return (
                  <div key={order.displayId} className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                        order.side === "BACK"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}>
                        {order.side}
                      </span>
                      <span className="text-gray-700 truncate max-w-[60px]">
                        {order.player.split(" ").pop()}
                      </span>
                      <span className="font-mono text-gray-500">
                        £{order.sizeRemaining.toFixed(0)} @ {order.price.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onCancelOrder(order.betId)}
                      disabled={tradeLoading}
                      className="text-red-500 hover:text-red-700 font-bold text-[10px] disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Session P&L Summary ─── */}
        <div className="p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
            SESSION
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-gray-500">P&L</div>
              <div className={`text-sm font-bold font-mono ${
                sessionPnl >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {sessionPnl >= 0 ? "+" : ""}£{sessionPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">Win %</div>
              <div className="text-sm font-bold font-mono text-gray-700">
                {winRate}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">Trades</div>
              <div className="text-sm font-bold font-mono text-gray-700">
                {closedTrades.length}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Recent Closed Trades ─── */}
        {closedTrades.length > 0 && (
          <div className="p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 mb-2">
              RECENT TRADES
            </div>
            <div className="space-y-1">
              {closedTrades.slice(0, 5).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                      trade.side === "BACK"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-pink-100 text-pink-700"
                    }`}>
                      {trade.side}
                    </span>
                    <span className="text-gray-600 font-mono">
                      {trade.entry_price?.toFixed(2)} → {trade.exit_price?.toFixed(2) ?? "--"}
                    </span>
                  </div>
                  <span className={`font-mono font-semibold ${
                    (trade.pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {(trade.pnl ?? 0) >= 0 ? "+" : ""}£{(trade.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
