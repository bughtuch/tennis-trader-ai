"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAppStore, type MarketCatalogue } from "@/lib/store";

/* ─── Mock Market Data ─── */

interface Market {
  id: string;
  tournament: string;
  tournamentColor: string;
  surface: string;
  surfaceColor: string;
  player1: { name: string; flag: string; odds: number };
  player2: { name: string; flag: string; odds: number };
  isLive: boolean;
  startTime: string | null;
  matchedVolume: string;
}

const MARKETS: Market[] = [
  {
    id: "1",
    tournament: "ATP Finals",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Novak Djokovic", flag: "🇷🇸", odds: 1.54 },
    player2: { name: "Carlos Alcaraz", flag: "🇪🇸", odds: 2.72 },
    isLive: true,
    startTime: null,
    matchedVolume: "£142K",
  },
  {
    id: "2",
    tournament: "ATP Finals",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Jannik Sinner", flag: "🇮🇹", odds: 1.38 },
    player2: { name: "Daniil Medvedev", flag: "🇷🇺", odds: 3.25 },
    isLive: true,
    startTime: null,
    matchedVolume: "£98K",
  },
  {
    id: "3",
    tournament: "Australian Open",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Casper Ruud", flag: "🇳🇴", odds: 2.10 },
    player2: { name: "Taylor Fritz", flag: "🇺🇸", odds: 1.82 },
    isLive: false,
    startTime: "Starts in 2h 15m",
    matchedVolume: "£34K",
  },
  {
    id: "4",
    tournament: "WTA Finals",
    tournamentColor: "bg-purple-500/15 text-purple-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Iga Swiatek", flag: "🇵🇱", odds: 1.65 },
    player2: { name: "Coco Gauff", flag: "🇺🇸", odds: 2.34 },
    isLive: false,
    startTime: "Starts in 4h 30m",
    matchedVolume: "£21K",
  },
  {
    id: "5",
    tournament: "ATP 500 Dubai",
    tournamentColor: "bg-amber-500/15 text-amber-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Andrey Rublev", flag: "🇷🇺", odds: 1.91 },
    player2: { name: "Stefanos Tsitsipas", flag: "🇬🇷", odds: 1.95 },
    isLive: false,
    startTime: "Tomorrow, 14:00",
    matchedVolume: "£8K",
  },
  {
    id: "6",
    tournament: "WTA 1000 Dubai",
    tournamentColor: "bg-pink-500/15 text-pink-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Aryna Sabalenka", flag: "🇧🇾", odds: 1.44 },
    player2: { name: "Elena Rybakina", flag: "🇰🇿", odds: 2.88 },
    isLive: false,
    startTime: "Tomorrow, 16:00",
    matchedVolume: "£12K",
  },
  {
    id: "7",
    tournament: "ATP 250 Santiago",
    tournamentColor: "bg-green-500/15 text-green-400",
    surface: "Clay",
    surfaceColor: "bg-orange-500/15 text-orange-400",
    player1: { name: "Francisco Cerundolo", flag: "🇦🇷", odds: 2.20 },
    player2: { name: "Sebastian Baez", flag: "🇦🇷", odds: 1.72 },
    isLive: false,
    startTime: "Starts in 6h 45m",
    matchedVolume: "£5K",
  },
  {
    id: "8",
    tournament: "WTA 500 Abu Dhabi",
    tournamentColor: "bg-teal-500/15 text-teal-400",
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: "Jessica Pegula", flag: "🇺🇸", odds: 2.05 },
    player2: { name: "Madison Keys", flag: "🇺🇸", odds: 1.82 },
    isLive: false,
    startTime: "Tomorrow, 12:00",
    matchedVolume: "£6K",
  },
];

/* ─── Map Betfair API data to our Market card shape ─── */

function mapBetfairToMarket(cat: MarketCatalogue): Market | null {
  const runners = cat.runners;
  if (!runners || runners.length < 2) return null;

  const eventName = cat.event?.name ?? "";
  const compName = cat.competition?.name ?? "";
  const startTime = cat.marketStartTime ?? cat.event?.openDate;
  const isLive = startTime ? new Date(startTime) <= new Date() : false;
  const matched = cat.totalMatched ?? 0;

  function formatVolume(v: number) {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
    return `£${Math.round(v)}`;
  }

  function timeUntil(date: string) {
    const ms = new Date(date).getTime() - Date.now();
    if (ms <= 0) return null;
    const hrs = Math.floor(ms / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    if (hrs > 24) return `Tomorrow`;
    if (hrs > 0) return `Starts in ${hrs}h ${mins}m`;
    return `Starts in ${mins}m`;
  }

  // Guess tournament color from competition name
  let tournamentColor = "bg-blue-500/15 text-blue-400";
  if (/wta/i.test(compName)) tournamentColor = "bg-purple-500/15 text-purple-400";
  else if (/500/i.test(compName)) tournamentColor = "bg-amber-500/15 text-amber-400";
  else if (/250/i.test(compName)) tournamentColor = "bg-green-500/15 text-green-400";
  else if (/1000/i.test(compName)) tournamentColor = "bg-pink-500/15 text-pink-400";

  return {
    id: cat.marketId,
    tournament: compName || eventName || "Tennis",
    tournamentColor,
    surface: "Hard",
    surfaceColor: "bg-sky-500/15 text-sky-400",
    player1: { name: runners[0].runnerName, flag: "", odds: 0 },
    player2: { name: runners[1].runnerName, flag: "", odds: 0 },
    isLive,
    startTime: isLive ? null : (startTime ? timeUntil(startTime) : null),
    matchedVolume: formatVolume(matched),
  };
}

type Filter = "all" | "live" | "upcoming";

export default function MarketsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const { isConnected, markets: liveMarkets, marketsLoading, fetchMarkets } = useAppStore();

  const loadMarkets = useCallback(() => {
    if (isConnected) fetchMarkets();
  }, [isConnected, fetchMarkets]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Use live data if connected and available, otherwise mock
  const useLive = isConnected && liveMarkets.length > 0;
  const displayMarkets: Market[] = useLive
    ? liveMarkets.map(mapBetfairToMarket).filter((m): m is Market => m !== null)
    : MARKETS;

  const filtered = displayMarkets.filter((m) => {
    if (filter === "live" && !m.isLive) return false;
    if (filter === "upcoming" && m.isLive) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.player1.name.toLowerCase().includes(q) ||
        m.player2.name.toLowerCase().includes(q) ||
        m.tournament.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">Live Markets</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Live</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">Trade tennis matches on Betfair Exchange</p>
        </div>
      </div>

      {/* Connection Banner */}
      {!isConnected && (
        <div className="border-b border-amber-500/20 bg-amber-500/5">
          <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">DEMO</span>
            <span className="text-xs text-amber-400/80">Connect Betfair in Settings for live markets</span>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="border-b border-gray-800/50 bg-gray-900/20">
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-3 space-y-3">
          {/* Filter Tabs */}
          <div className="flex gap-1">
            {([
              { id: "all" as const, label: "All" },
              { id: "live" as const, label: "Live" },
              { id: "upcoming" as const, label: "Upcoming" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === tab.id
                    ? "text-white bg-white/10 border border-white/10"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {tab.label}
                {tab.id === "live" && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players or tournaments..."
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Count + Refresh */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtered.length} market{filtered.length !== 1 ? "s" : ""} available</p>
            {isConnected && (
              <button
                onClick={loadMarkets}
                disabled={marketsLoading}
                className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${marketsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Market Cards Grid */}
      <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 min-[1920px]:grid-cols-3 gap-3">
          {filtered.map((market) => (
            <Link
              key={market.id}
              href={`/trading?marketId=${market.id}&p1=${encodeURIComponent(market.player1.name)}&p2=${encodeURIComponent(market.player2.name)}`}
              className={`group block w-full bg-gray-900/50 border rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-600/50 ${
                market.isLive
                  ? "border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.06)]"
                  : "border-gray-800/50"
              }`}
            >
              {/* Card Top: Tournament + Surface */}
              <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${market.tournamentColor}`}>
                  {market.tournament}
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${market.surfaceColor}`}>
                  {market.surface}
                </span>
              </div>

              {/* Players */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  {/* Player 1 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{market.player1.flag}</span>
                      <span className="text-sm font-medium text-white truncate">{market.player1.name}</span>
                    </div>
                    <div className="mt-1.5">
                      <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        {market.player1.odds.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* VS */}
                  <span className="text-[10px] text-gray-600 font-medium shrink-0 px-1">vs</span>

                  {/* Player 2 */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-medium text-white truncate">{market.player2.name}</span>
                      <span className="text-base">{market.player2.flag}</span>
                    </div>
                    <div className="mt-1.5">
                      <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        {market.player2.odds.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Time + Volume */}
              <div className="px-4 py-2.5 border-t border-gray-800/30 flex items-center justify-between">
                {market.isLive ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-green-400">LIVE</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500">{market.startTime}</span>
                )}
                <span className="text-[11px] text-gray-500 font-mono">{market.matchedVolume} matched</span>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-600 text-sm">No markets found</div>
            <p className="text-gray-700 text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </main>
  );
}
