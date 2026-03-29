"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";

/* ─── Types ─── */

interface ClosedTrade {
  id: string;
  pnl: number | null;
  closed_at: string | null;
  created_at: string;
  is_shadow?: boolean;
}

interface DailyStats {
  totalPnl: number;
  tradeCount: number;
  winners: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  firstTradeAt: number | null;
}

/* ─── Constants ─── */

const DEFAULT_LOSS_LIMIT = 100;

/* ─── Helpers ─── */

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
}

function calcStats(trades: ClosedTrade[]): DailyStats {
  if (trades.length === 0) {
    return { totalPnl: 0, tradeCount: 0, winners: 0, winRate: 0, bestTrade: 0, worstTrade: 0, firstTradeAt: null };
  }

  let totalPnl = 0;
  let winners = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;
  let firstTradeAt: number | null = null;

  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;
    if (pnl > 0) winners++;
    if (pnl > bestTrade) bestTrade = pnl;
    if (pnl < worstTrade) worstTrade = pnl;

    const ts = new Date(t.created_at).getTime();
    if (firstTradeAt === null || ts < firstTradeAt) firstTradeAt = ts;
  }

  return {
    totalPnl: r2(totalPnl),
    tradeCount: trades.length,
    winners,
    winRate: trades.length > 0 ? Math.round((winners / trades.length) * 100) : 0,
    bestTrade: bestTrade === -Infinity ? 0 : r2(bestTrade),
    worstTrade: worstTrade === Infinity ? 0 : r2(worstTrade),
    firstTradeAt,
  };
}

/* ─── Component ─── */

interface DailyPnLDashboardProps {
  /** Locally tracked closed trades for instant updates */
  localClosedTrades: { id: string; pnl: number | null; closed_at: string | null; created_at: string }[];
  /** Daily loss limit from settings (default £100) */
  lossLimit?: number;
}

export default function DailyPnLDashboard({
  localClosedTrades,
  lossLimit = DEFAULT_LOSS_LIMIT,
}: DailyPnLDashboardProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [dbLiveTrades, setDbLiveTrades] = useState<ClosedTrade[]>([]);
  const [dbPaperTrades, setDbPaperTrades] = useState<ClosedTrade[]>([]);
  const [elapsed, setElapsed] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch today's closed trades from Supabase (both live and paper)
  const fetchTodayTrades = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [liveRes, paperRes] = await Promise.all([
        supabase
          .from("trades")
          .select("id, pnl, closed_at, created_at, is_shadow")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .eq("is_shadow", false)
          .gte("created_at", todayStart())
          .order("closed_at", { ascending: false }),
        supabase
          .from("trades")
          .select("id, pnl, closed_at, created_at, is_shadow")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .eq("is_shadow", true)
          .gte("created_at", todayStart())
          .order("closed_at", { ascending: false }),
      ]);

      if (liveRes.data) setDbLiveTrades(liveRes.data);
      if (paperRes.data) setDbPaperTrades(paperRes.data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchTodayTrades();
  }, [fetchTodayTrades]);

  // Re-fetch when local trades change
  useEffect(() => {
    if (localClosedTrades.length > 0) {
      fetchTodayTrades();
    }
  }, [localClosedTrades.length, fetchTodayTrades]);

  // Merge DB trades with local trades (dedup by id), filtering to today
  const todayFilter = (t: ClosedTrade) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return new Date(t.created_at) >= start;
  };

  const allLiveTrades = (() => {
    const idSet = new Set(dbLiveTrades.map((t) => t.id));
    const merged = [...dbLiveTrades];
    for (const lt of localClosedTrades) {
      if (!idSet.has(lt.id)) merged.push(lt);
    }
    return merged.filter(todayFilter);
  })();

  const allPaperTrades = dbPaperTrades.filter(todayFilter);

  const liveStats = calcStats(allLiveTrades);
  const paperStats = calcStats(allPaperTrades);

  // Combined stats for overall dashboard
  const allTrades = [...allLiveTrades, ...allPaperTrades];
  const combinedStats = calcStats(allTrades);

  // Timer for elapsed time
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (combinedStats.firstTradeAt) {
      const update = () => setElapsed(formatDuration(Date.now() - combinedStats.firstTradeAt!));
      update();
      timerRef.current = setInterval(update, 30_000);
    } else {
      setElapsed("0m");
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [combinedStats.firstTradeAt]);

  // Loss limit calculations (live trades only)
  const totalLoss = Math.max(0, -liveStats.totalPnl);
  const lossUsedPct = lossLimit > 0 ? Math.min((totalLoss / lossLimit) * 100, 100) : 0;
  const profitPerHour =
    combinedStats.firstTradeAt && Date.now() - combinedStats.firstTradeAt > 60_000
      ? r2(combinedStats.totalPnl / ((Date.now() - combinedStats.firstTradeAt) / 3_600_000))
      : 0;

  // Warning levels
  const isWarning = lossUsedPct >= 75 && lossUsedPct < 100;
  const isDanger = lossUsedPct >= 100;

  const barColor = isDanger
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : liveStats.totalPnl >= 0
        ? "bg-green-500"
        : "bg-red-400";

  const hasPaper = paperStats.tradeCount > 0;
  const hasLive = liveStats.tradeCount > 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 border-b border-gray-800/50 flex items-center justify-between hover:bg-gray-800/20 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${combinedStats.tradeCount > 0 ? "bg-blue-400 animate-pulse" : "bg-gray-600"}`} />
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            SESSION DASHBOARD
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {combinedStats.tradeCount > 0 && (
            <span
              className={`text-xs font-mono font-semibold ${
                combinedStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {combinedStats.totalPnl >= 0 ? "+" : "-"}£{Math.abs(combinedStats.totalPnl).toFixed(2)}
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {combinedStats.tradeCount === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">
              No closed trades today. Stats appear after your first trade.
            </p>
          ) : (
            <>
              {/* Live / Paper P&L split */}
              {(hasLive || hasPaper) && (
                <div className="text-xs leading-relaxed space-y-0.5">
                  {hasLive && (
                    <div className="text-gray-300">
                      Live P&amp;L:{" "}
                      <span className={`font-mono font-semibold ${liveStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {liveStats.totalPnl >= 0 ? "+" : "-"}£{Math.abs(liveStats.totalPnl).toFixed(2)}
                      </span>
                      <span className="text-gray-600 ml-1">({liveStats.tradeCount} trades, {liveStats.winRate}% win)</span>
                    </div>
                  )}
                  {hasPaper && (
                    <div className="text-gray-300">
                      <span className="mr-0.5">👻</span>
                      Paper P&amp;L:{" "}
                      <span className={`font-mono font-semibold ${paperStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {paperStats.totalPnl >= 0 ? "+" : "-"}£{Math.abs(paperStats.totalPnl).toFixed(2)}
                      </span>
                      <span className="text-gray-600 ml-1">({paperStats.tradeCount} trades, {paperStats.winRate}% win)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Combined summary line */}
              <div className="text-xs text-gray-300 leading-relaxed">
                Today:{" "}
                <span className={`font-mono font-semibold ${combinedStats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {combinedStats.totalPnl >= 0 ? "+" : "-"}£{Math.abs(combinedStats.totalPnl).toFixed(2)}
                </span>
                {" | "}
                <span className="text-white font-medium">{combinedStats.tradeCount}</span> trades
                {" | "}
                <span className={`font-medium ${combinedStats.winRate >= 60 ? "text-green-400" : combinedStats.winRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                  {combinedStats.winRate}% win rate
                </span>
              </div>

              {/* Second line */}
              <div className="text-xs text-gray-400">
                £/hour:{" "}
                <span className={`font-mono font-semibold ${profitPerHour >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {profitPerHour >= 0 ? "+" : "-"}£{Math.abs(profitPerHour).toFixed(2)}
                </span>
                {" | "}
                Time: <span className="text-white font-medium">{elapsed}</span>
              </div>

              {/* Loss limit progress (live trades only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">
                    Loss limit: <span className="text-white font-mono">£{lossLimit}</span>
                  </span>
                  <span className={`font-mono font-medium ${isDanger ? "text-red-400" : isWarning ? "text-amber-400" : "text-gray-400"}`}>
                    {liveStats.totalPnl < 0 ? `Used: £${totalLoss.toFixed(2)} (${lossUsedPct.toFixed(1)}%)` : "Unused"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(lossUsedPct, 100)}%` }}
                  />
                </div>
                {isWarning && !isDanger && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <span>⚠️</span>
                    <span>Approaching daily loss limit</span>
                  </div>
                )}
                {isDanger && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <span>🛑</span>
                    <span>Daily loss limit reached. Consider stopping.</span>
                  </div>
                )}
              </div>

              {/* Best / Worst */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800/30 rounded-lg p-2.5">
                  <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-0.5">BEST</div>
                  <div className={`text-sm font-bold font-mono ${combinedStats.bestTrade > 0 ? "text-green-400" : "text-gray-500"}`}>
                    {combinedStats.bestTrade > 0 ? `+£${combinedStats.bestTrade.toFixed(2)}` : "—"}
                  </div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-2.5">
                  <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-0.5">WORST</div>
                  <div className={`text-sm font-bold font-mono ${combinedStats.worstTrade < 0 ? "text-red-400" : "text-gray-500"}`}>
                    {combinedStats.worstTrade < 0 ? `-£${Math.abs(combinedStats.worstTrade).toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
