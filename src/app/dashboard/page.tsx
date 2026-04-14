"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useBetfairToken } from "@/hooks/useBetfairToken";
import DailyPnLDashboard from "@/components/DailyPnLDashboard";

export default function DashboardPage() {
  const { isConnected, username } = useBetfairToken();
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    async function fetchMarketCount() {
      try {
        const res = await fetch("/api/betfair/markets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listMarkets" }),
        });
        const data = await res.json();
        if (data.success && data.markets) {
          const now = new Date();
          const live = data.markets.filter(
            (m: { marketStartTime?: string }) =>
              m.marketStartTime && new Date(m.marketStartTime) <= now
          ).length;
          setLiveCount(live);
          setTotalCount(data.markets.length);
        }
      } catch {
        /* non-critical */
      }
    }
    fetchMarketCount();
  }, []);

  return (
    <main className="min-h-screen pt-14 bg-[#030712]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-white">Tennis Trader AI</h1>
          <p className="text-sm text-gray-400 mt-1">
            {liveCount !== null ? (
              <>
                <span className="text-green-400 font-medium">{liveCount} live</span>
                {" "}market{liveCount !== 1 ? "s" : ""} right now
                {totalCount > liveCount && (
                  <span className="text-gray-500"> &middot; {totalCount} total</span>
                )}
              </>
            ) : (
              "Loading markets..."
            )}
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/markets"
            className="flex items-center justify-between bg-gray-900/50 border border-gray-800/50 rounded-2xl px-5 py-4 hover:border-blue-500/30 hover:bg-gray-900/80 transition-all group"
          >
            <span className="text-sm font-medium text-white">Go to Markets</span>
            <span className="text-gray-500 group-hover:text-blue-400 transition-colors">&rarr;</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center justify-between bg-gray-900/50 border border-gray-800/50 rounded-2xl px-5 py-4 hover:border-blue-500/30 hover:bg-gray-900/80 transition-all group"
          >
            <span className="text-sm font-medium text-white">Open Settings</span>
            <span className="text-gray-500 group-hover:text-blue-400 transition-colors">&rarr;</span>
          </Link>
        </div>

        {/* Today's Session */}
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800/50">
            <h2 className="text-sm font-semibold text-white">Today&apos;s Session</h2>
          </div>
          <div className="p-4">
            <DailyPnLDashboard localClosedTrades={[]} />
          </div>
        </div>

        {/* Trading DNA Link */}
        <Link
          href="/trading-dna"
          className="flex items-center justify-between bg-gray-900/50 border border-gray-800/50 rounded-2xl px-5 py-4 hover:border-purple-500/30 hover:bg-gray-900/80 transition-all group"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Trading DNA</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Analyse your trading patterns and performance
            </p>
          </div>
          <span className="text-gray-500 group-hover:text-purple-400 transition-colors">&rarr;</span>
        </Link>

        {/* Betfair Connection Status */}
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? "bg-green-400" : "bg-gray-600"
                }`}
              />
              <div>
                <p className="text-sm font-medium text-white">
                  Betfair {isConnected ? "Connected" : "Not Connected"}
                </p>
                {isConnected && username && (
                  <p className="text-xs text-gray-500">{username}</p>
                )}
              </div>
            </div>
            {!isConnected && (
              <Link
                href="/settings"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Connect &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
