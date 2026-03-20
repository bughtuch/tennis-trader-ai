"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface ShadowStats {
  totalTrades: number;
  totalPnl: number;
  wins: number;
  bestTrade: number;
}

interface ShadowTrade {
  id: string;
  side: string | null;
  player: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stake: number | null;
  pnl: number | null;
  created_at: string;
  closed_at: string | null;
}

export default function DashboardPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<ShadowStats | null>(null);
  const [trades, setTrades] = useState<ShadowTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/trades/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getShadowStats" }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch {
      /* network error */
    }
  }, []);

  const fetchTrades = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("trades")
      .select("id, side, player, entry_price, exit_price, stake, pnl, created_at, closed_at")
      .eq("user_id", user.id)
      .eq("is_shadow", true)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(20);

    if (data) setTrades(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchTrades()]).finally(() => setLoading(false));
  }, [fetchStats, fetchTrades]);

  const winRate =
    stats && stats.totalTrades > 0
      ? Math.round((stats.wins / stats.totalTrades) * 100)
      : 0;

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-xl font-bold text-white">Shadow Trading Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your paper trading performance with real market odds
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center text-xs text-gray-500 py-8">Loading stats...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "TOTAL TRADES",
                  value: String(stats?.totalTrades ?? 0),
                  color: "text-white",
                },
                {
                  label: "TOTAL P&L",
                  value: `${(stats?.totalPnl ?? 0) >= 0 ? "+" : ""}£${Math.abs(stats?.totalPnl ?? 0).toFixed(2)}`,
                  color: (stats?.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400",
                },
                {
                  label: "WIN RATE",
                  value: `${winRate}%`,
                  color: "text-green-400",
                },
                {
                  label: "BEST TRADE",
                  value:
                    (stats?.bestTrade ?? 0) > 0
                      ? `+£${stats!.bestTrade.toFixed(2)}`
                      : "--",
                  color: "text-green-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-4"
                >
                  <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-1">
                    {s.label}
                  </div>
                  <div className={`text-xl font-bold font-mono ${s.color}`}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Shadow Trades */}
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800/50">
                <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
                  RECENT SHADOW TRADES
                </h2>
              </div>
              <div className="divide-y divide-gray-800/30">
                {trades.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-gray-500 text-center">
                    No shadow trades yet. Go to Trading to place your first shadow trade.
                  </div>
                ) : (
                  trades.map((trade) => (
                    <div
                      key={trade.id}
                      className="px-4 py-2.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            trade.side === "BACK"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-pink-500/20 text-pink-400"
                          }`}
                        >
                          {trade.side}
                        </span>
                        <div>
                          <div className="text-[11px] text-gray-300 font-medium">
                            {trade.player ?? "Unknown"}
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono">
                            {trade.entry_price} → {trade.exit_price ?? "--"} x £
                            {trade.stake}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            (trade.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {(trade.pnl ?? 0) >= 0 ? "+" : "-"}£
                          {Math.abs(trade.pnl ?? 0).toFixed(2)}
                        </span>
                        <div className="text-[10px] text-gray-600">
                          {trade.closed_at
                            ? new Date(trade.closed_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "--"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CTA when 10+ trades */}
            {stats && stats.totalTrades >= 10 && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 text-center space-y-3">
                <p className="text-sm text-gray-300">
                  Your shadow results after{" "}
                  <span className="text-white font-semibold">
                    {stats.totalTrades} trades
                  </span>
                  :{" "}
                  <span
                    className={`font-mono font-bold ${
                      stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {stats.totalPnl >= 0 ? "+" : ""}£{stats.totalPnl.toFixed(2)}
                  </span>
                  . Ready to go live?
                </p>
                <Link
                  href="/settings"
                  className="inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                >
                  Go Live — Subscribe £37/month
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
