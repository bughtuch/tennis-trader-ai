"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

/* ─── Types ─── */

interface Market {
  id: string;
  tournament: string;
  tournamentColor: string;
  player1: { name: string; odds: number | null };
  player2: { name: string; odds: number | null };
  isLive: boolean;
  startTime: string | null;
  matchedVolume: string;
}

/* ─── Mock data (fallback when not connected) ─── */

const MOCK_MARKETS: Market[] = [
  {
    id: "demo-1",
    tournament: "ATP Finals",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    player1: { name: "Novak Djokovic", odds: 1.54 },
    player2: { name: "Carlos Alcaraz", odds: 2.72 },
    isLive: true,
    startTime: null,
    matchedVolume: "£142K",
  },
  {
    id: "demo-2",
    tournament: "ATP Finals",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    player1: { name: "Jannik Sinner", odds: 1.38 },
    player2: { name: "Daniil Medvedev", odds: 3.25 },
    isLive: true,
    startTime: null,
    matchedVolume: "£98K",
  },
  {
    id: "demo-3",
    tournament: "Australian Open",
    tournamentColor: "bg-blue-500/15 text-blue-400",
    player1: { name: "Casper Ruud", odds: 2.1 },
    player2: { name: "Taylor Fritz", odds: 1.82 },
    isLive: false,
    startTime: "Starts in 2h 15m",
    matchedVolume: "£34K",
  },
  {
    id: "demo-4",
    tournament: "WTA Finals",
    tournamentColor: "bg-purple-500/15 text-purple-400",
    player1: { name: "Iga Swiatek", odds: 1.65 },
    player2: { name: "Coco Gauff", odds: 2.34 },
    isLive: false,
    startTime: "Starts in 4h 30m",
    matchedVolume: "£21K",
  },
];

/* ─── Helpers ─── */

function formatVolume(v: number) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
  return `£${Math.round(v)}`;
}

function timeUntil(date: string) {
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hrs = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 1) return `In ${days} days`;
  if (days === 1) return `Tomorrow`;
  if (hrs > 0) return `Starts in ${hrs}h ${mins}m`;
  return `Starts in ${mins}m`;
}

function tournamentColor(name: string) {
  const n = name.toLowerCase();
  if (/wta.*1000|wta.*premier/i.test(n)) return "bg-pink-500/15 text-pink-400";
  if (/wta/i.test(n)) return "bg-purple-500/15 text-purple-400";
  if (/grand slam|open|roland|wimbledon/i.test(n)) return "bg-yellow-500/15 text-yellow-400";
  if (/masters|1000/i.test(n)) return "bg-red-500/15 text-red-400";
  if (/500/i.test(n)) return "bg-amber-500/15 text-amber-400";
  if (/250/i.test(n)) return "bg-green-500/15 text-green-400";
  if (/challenger/i.test(n)) return "bg-teal-500/15 text-teal-400";
  return "bg-blue-500/15 text-blue-400";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapBetfairToMarket(
  cat: any,
  book?: any
): Market | null {
  const runners = cat.runners;
  if (!runners || runners.length < 2) return null;

  const compName = cat.competition?.name ?? "";
  const eventName = cat.event?.name ?? "";
  const startTimeStr = cat.marketStartTime ?? cat.event?.openDate;
  const isLive = startTimeStr ? new Date(startTimeStr) <= new Date() : false;
  const matched = book?.totalMatched ?? cat.totalMatched ?? 0;

  // Get best back odds from market book
  let odds1: number | null = null;
  let odds2: number | null = null;
  if (book?.runners) {
    const r1 = book.runners.find((r: any) => r.selectionId === runners[0].selectionId);
    const r2 = book.runners.find((r: any) => r.selectionId === runners[1].selectionId);
    if (r1?.ex?.availableToBack?.[0]?.price) odds1 = r1.ex.availableToBack[0].price;
    if (r2?.ex?.availableToBack?.[0]?.price) odds2 = r2.ex.availableToBack[0].price;
  }

  return {
    id: cat.marketId,
    tournament: compName || eventName || "Tennis",
    tournamentColor: tournamentColor(compName || eventName),
    player1: { name: runners[0].runnerName, odds: odds1 },
    player2: { name: runners[1].runnerName, odds: odds2 },
    isLive,
    startTime: isLive ? null : startTimeStr ? timeUntil(startTimeStr) : null,
    matchedVolume: formatVolume(matched),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type Filter = "all" | "live" | "upcoming";

interface LastMarket {
  marketId: string;
  p1: string;
  p2: string;
  p1Flag?: string;
  p2Flag?: string;
  tournament?: string;
}

export default function MarketsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastMarket, setLastMarket] = useState<LastMarket | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Read Betfair session from Supabase profile (source of truth)
  // Uses exact same pattern as Settings page loadProfile()
  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("[Markets] No Supabase user found");
          setSessionChecked(true);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("[Markets] Profile query error:", error);
          setSessionChecked(true);
          return;
        }

        console.log("[Markets] Profile data:", {
          betfair_connected: data?.betfair_connected,
          has_token: !!data?.betfair_session_token,
          connected_at: data?.betfair_connected_at,
        });

        if (data?.betfair_connected && data?.betfair_session_token) {
          // Check if session is still valid (8h window)
          const connectedAt = data.betfair_connected_at
            ? new Date(data.betfair_connected_at).getTime()
            : 0;
          const isExpired = connectedAt > 0 && Date.now() > connectedAt + 8 * 3600000;

          if (!isExpired) {
            console.log("[Markets] Session valid, setting token");
            setSessionToken(data.betfair_session_token);
          } else {
            console.log("[Markets] Session expired");
          }
        } else {
          console.log("[Markets] Not connected or no token");
        }
      } catch (err) {
        console.error("[Markets] checkSession error:", err);
      }
      setSessionChecked(true);
    }
    checkSession();
  }, []);

  // Check for saved market on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastMarket");
      if (saved) setLastMarket(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const loadMarkets = useCallback(async () => {
    // Wait for Supabase session check to complete
    if (!sessionChecked) return;

    setLoading(true);

    if (!sessionToken) {
      setIsDemoMode(true);
      setMarkets(MOCK_MARKETS);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch market catalogue
      const catRes = await fetch("/api/betfair/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listMarkets", sessionToken }),
      });
      const catData = await catRes.json();

      if (!catData.success || !catData.markets?.length) {
        setIsDemoMode(true);
        setMarkets(MOCK_MARKETS);
        setLoading(false);
        return;
      }

      // 2. Fetch market books for odds (batch in groups of 10 to stay within Betfair limits)
      const allMarketIds: string[] = catData.markets.map((m: { marketId: string }) => m.marketId);
      const bookMap = new Map();
      const BATCH_SIZE = 10;
      try {
        const batches: string[][] = [];
        for (let i = 0; i < allMarketIds.length; i += BATCH_SIZE) {
          batches.push(allMarketIds.slice(i, i + BATCH_SIZE));
        }
        const results = await Promise.all(
          batches.map(async (batchIds) => {
            const bookRes = await fetch("/api/betfair/markets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "getMarketBook", marketIds: batchIds, sessionToken }),
            });
            return bookRes.json();
          })
        );
        for (const bookData of results) {
          if (bookData.success && bookData.marketBooks) {
            for (const book of bookData.marketBooks) {
              bookMap.set(book.marketId, book);
            }
          }
        }
      } catch {
        // Odds fetch failed — show markets without odds
      }

      // 3. Merge catalogue + books
      const mapped = catData.markets
        .map((cat: { marketId: string }) => mapBetfairToMarket(cat, bookMap.get(cat.marketId)))
        .filter((m: Market | null): m is Market => m !== null);

      // Sort: live first, then by countdown
      mapped.sort((a: Market, b: Market) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return 0;
      });

      setMarkets(mapped);
      setIsDemoMode(false);
    } catch {
      setIsDemoMode(true);
      setMarkets(MOCK_MARKETS);
    } finally {
      setLoading(false);
    }
  }, [sessionChecked, sessionToken]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const filtered = markets.filter((m) => {
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

  const liveCount = markets.filter((m) => m.isLive).length;

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">Live Markets</h1>
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">
                  {liveCount} Live
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Trade tennis matches on Betfair Exchange
          </p>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="border-b border-amber-500/20 bg-amber-500/5">
          <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              DEMO
            </span>
            <span className="text-xs text-amber-400/80">
              Connect Betfair in Settings for live markets
            </span>
          </div>
        </div>
      )}

      {/* Resume Last Market */}
      {lastMarket && (
        <div className="border-b border-gray-800/50 bg-gray-900/20">
          <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-2">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                params.set("marketId", lastMarket.marketId);
                params.set("p1", lastMarket.p1);
                params.set("p2", lastMarket.p2);
                if (lastMarket.p1Flag) params.set("p1Flag", lastMarket.p1Flag);
                if (lastMarket.p2Flag) params.set("p2Flag", lastMarket.p2Flag);
                if (lastMarket.tournament) params.set("tournament", lastMarket.tournament);
                router.push(`/trading?${params.toString()}`);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-all group"
            >
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-blue-400 font-medium">
                  Resume: {lastMarket.p1} vs {lastMarket.p2}
                </span>
              </div>
              <svg className="w-4 h-4 text-blue-400/60 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="border-b border-gray-800/50 bg-gray-900/20">
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-3 space-y-3">
          {/* Filter Tabs */}
          <div className="flex gap-1">
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "live" as const, label: "Live" },
                { id: "upcoming" as const, label: "Upcoming" },
              ] as const
            ).map((tab) => (
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
                {tab.id === "live" && liveCount > 0 && (
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
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
            <p className="text-xs text-gray-500">
              {filtered.length} market{filtered.length !== 1 ? "s" : ""}{" "}
              available
            </p>
            <button
              onClick={loadMarkets}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 mt-3">Loading markets...</p>
        </div>
      )}

      {/* Market Cards Grid */}
      {!loading && (
        <div className="max-w-2xl min-[1920px]:max-w-6xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 min-[1920px]:grid-cols-3 gap-3">
            {filtered.map((market) => (
              <Link
                key={market.id}
                href={`/trading?marketId=${market.id}&p1=${encodeURIComponent(market.player1.name)}&p2=${encodeURIComponent(market.player2.name)}&tournament=${encodeURIComponent(market.tournament)}`}
                className={`group block w-full bg-gray-900/50 border rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-600/50 ${
                  market.isLive
                    ? "border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.06)]"
                    : "border-gray-800/50"
                }`}
              >
                {/* Card Top: Tournament */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${market.tournamentColor}`}
                  >
                    {market.tournament}
                  </span>
                </div>

                {/* Players */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Player 1 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white truncate block">
                        {market.player1.name}
                      </span>
                      <div className="mt-1.5">
                        {market.player1.odds != null ? (
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                            {market.player1.odds.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-gray-600 px-2 py-0.5">
                            —
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VS */}
                    <span className="text-[10px] text-gray-600 font-medium shrink-0 px-1">
                      vs
                    </span>

                    {/* Player 2 */}
                    <div className="flex-1 min-w-0 text-right">
                      <span className="text-sm font-medium text-white truncate block">
                        {market.player2.name}
                      </span>
                      <div className="mt-1.5">
                        {market.player2.odds != null ? (
                          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                            {market.player2.odds.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-gray-600 px-2 py-0.5">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: Time + Volume */}
                <div className="px-4 py-2.5 border-t border-gray-800/30 flex items-center justify-between">
                  {market.isLive ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[11px] font-semibold text-green-400">
                        LIVE
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-500">
                      {market.startTime}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500 font-mono">
                    {market.matchedVolume} matched
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-gray-600 text-sm">No markets found</div>
              <p className="text-gray-700 text-xs mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
