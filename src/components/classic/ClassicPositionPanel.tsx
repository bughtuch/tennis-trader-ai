"use client";

import ClassicMarketHedge from "@/components/classic/ClassicMarketHedge";
import ClassicLiabilityTools from "@/components/classic/ClassicLiabilityTools";

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

interface AggregatedPosition {
  netSide: "BACK" | "LAY" | "FLAT";
  netStake: number;
  avgEntry: number;
  count: number;
  backTotal: number;
  layTotal: number;
}

interface ClassicPositionPanelProps {
  player1Agg: AggregatedPosition | null;
  player2Agg: AggregatedPosition | null;
  player1Name: string;
  player2Name: string;
  outcomePnl: { ifPlayer1Wins: number; ifPlayer2Wins: number } | null;
  onMarketHedge: (runner: "player1" | "player2", side: "BACK" | "LAY", price: number, stake: number) => Promise<void>;
  tradeLoading: boolean;
  closedTrades: SupabaseTrade[];
  sessionPnl: number;
  winRate: number;
  p1BackPrice: number;
  p1LayPrice: number;
  p2BackPrice: number;
  p2LayPrice: number;
  marketSuspended: boolean;
  onReduceLiability: (runner: "player1" | "player2", tradeSide: "BACK" | "LAY", tradePrice: number, tradeStake: number) => Promise<void>;
}

/* ─── Component ─── */

export default function ClassicPositionPanel({
  player1Agg,
  player2Agg,
  player1Name,
  player2Name,
  outcomePnl,
  onMarketHedge,
  tradeLoading,
  closedTrades,
  sessionPnl,
  winRate,
  p1BackPrice,
  p1LayPrice,
  p2BackPrice,
  p2LayPrice,
  marketSuspended,
  onReduceLiability,
}: ClassicPositionPanelProps) {
  const hasP1Position = player1Agg && player1Agg.netSide !== "FLAT";
  const hasP2Position = player2Agg && player2Agg.netSide !== "FLAT";
  const hasAnyPosition = hasP1Position || hasP2Position;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-gray-900 h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-bold tracking-wider uppercase text-gray-600">
          HEDGE & TOOLS
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* ─── Market Hedge ─── */}
        <div className="p-3">
          <ClassicMarketHedge
            player1Name={player1Name}
            player2Name={player2Name}
            outcomePnl={outcomePnl}
            p1BackPrice={p1BackPrice}
            p1LayPrice={p1LayPrice}
            p2BackPrice={p2BackPrice}
            p2LayPrice={p2LayPrice}
            onHedge={onMarketHedge}
            tradeLoading={tradeLoading}
            marketSuspended={marketSuspended}
          />
        </div>

        {/* ─── Liability Reduction ─── */}
        {hasAnyPosition && (
          <div className="p-3 space-y-2">
            {hasP1Position && player1Agg && (
              <ClassicLiabilityTools
                playerName={player1Name}
                agg={player1Agg}
                currentBackPrice={p1BackPrice}
                currentLayPrice={p1LayPrice}
                marketSuspended={marketSuspended}
                onExecute={(side, price, stake) => onReduceLiability("player1", side, price, stake)}
                tradeLoading={tradeLoading}
              />
            )}
            {hasP2Position && player2Agg && (
              <ClassicLiabilityTools
                playerName={player2Name}
                agg={player2Agg}
                currentBackPrice={p2BackPrice}
                currentLayPrice={p2LayPrice}
                marketSuspended={marketSuspended}
                onExecute={(side, price, stake) => onReduceLiability("player2", side, price, stake)}
                tradeLoading={tradeLoading}
              />
            )}
          </div>
        )}

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
