"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBetfairToken } from "@/hooks/useBetfairToken";
import { useAppStore } from "@/lib/store";
import MatchSelectionGuide from "@/components/MatchSelectionGuide";
import SubscribeGate from "@/components/SubscribeGate";

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

interface ScannerAlert {
  id: string;
  marketId: string;
  players: string;
  alertType: "momentum" | "wom_flip" | "volume_spike";
  description: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
}

const ALERT_ICONS: Record<string, string> = {
  momentum: "🔥",
  wom_flip: "⚡",
  volume_spike: "💰",
};

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
  const { isConnected: betfairConnected, token: betfairToken } = useBetfairToken();
  const { subscriptionStatus, subscriptionLoaded, fetchSubscriptionStatus } = useAppStore();
  const tradePath = subscriptionLoaded && subscriptionStatus === "active" ? "/trading" : "/paper";
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastMarket, setLastMarket] = useState<LastMarket | null>(null);

  /* ─── Scanner State ─── */
  const [scannerAlerts, setScannerAlerts] = useState<ScannerAlert[]>([]);
  const [scannerMarketCount, setScannerMarketCount] = useState(0);
  const [scannerRunning, setScannerRunning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshotRef = useRef<Record<string, any> | null>(null);
  const scannerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ensure subscription status is loaded
  useEffect(() => {
    if (!subscriptionLoaded) fetchSubscriptionStatus();
  }, [subscriptionLoaded, fetchSubscriptionStatus]);

  const runScan = useCallback(async () => {
    try {
      const res = await fetch("/api/betfair/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousSnapshot: snapshotRef.current,
        }),
      });
      const data = await res.json();
      if (data.success) {
        snapshotRef.current = data.snapshot;
        setScannerMarketCount(data.marketCount ?? 0);
        if (data.alerts?.length > 0) {
          setScannerAlerts((prev) => {
            const merged = [...data.alerts, ...prev].slice(0, 20);
            try { localStorage.setItem("scannerAlerts", JSON.stringify(merged)); } catch { /* ignore */ }
            return merged;
          });
        }
        setScannerRunning(true);
      }
    } catch { /* non-critical */ }
  }, []);

  // Load cached alerts + start scanner polling
  useEffect(() => {
    try {
      const cached = localStorage.getItem("scannerAlerts");
      if (cached) setScannerAlerts(JSON.parse(cached));
    } catch { /* ignore */ }

    // First scan is snapshot-only (no previous data to compare), second scan starts producing alerts
    runScan();
    scannerIntervalRef.current = setInterval(runScan, 30_000);
    return () => {
      if (scannerIntervalRef.current) clearInterval(scannerIntervalRef.current);
    };
  }, [runScan]);

  // Expose alert count globally for navbar badge
  useEffect(() => {
    try {
      const recentCount = scannerAlerts.filter(
        (a) => Date.now() - a.timestamp < 5 * 60 * 1000
      ).length;
      localStorage.setItem("scannerAlertCount", String(recentCount));
      window.dispatchEvent(new Event("scannerAlertUpdate"));
    } catch { /* ignore */ }
  }, [scannerAlerts]);

  // Check for saved market on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastMarket");
      if (saved) setLastMarket(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch real Betfair markets (API falls back to vendor session if user not connected)
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (betfairToken) headers["x-betfair-token"] = betfairToken;

      const catRes = await fetch("/api/betfair/markets", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "listMarkets" }),
      });
      const catData = await catRes.json();

      if (!catData.success || !catData.markets?.length) {
        setMarkets([]);
        setLoading(false);
        return;
      }

      // Fetch market books for odds (batch in groups of 5 to stay within Betfair API limits)
      const allMarketIds: string[] = catData.markets.map((m: { marketId: string }) => m.marketId);
      const bookMap = new Map();
      const BATCH_SIZE = 5;
      try {
        const batches: string[][] = [];
        for (let i = 0; i < allMarketIds.length; i += BATCH_SIZE) {
          batches.push(allMarketIds.slice(i, i + BATCH_SIZE));
        }
        const results = await Promise.all(
          batches.map(async (batchIds) => {
            const bookRes = await fetch("/api/betfair/markets", {
              method: "POST",
              headers,
              body: JSON.stringify({ action: "getMarketBook", marketIds: batchIds }),
            });
            const json = await bookRes.json();
            return json;
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
        // Non-critical: markets still show, just without odds
      }

      // Merge catalogue + books
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
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [betfairToken]);

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
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-6">
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

      {/* Not Connected Banner */}
      {!betfairConnected && (
        <div className="border-b border-blue-500/20 bg-blue-500/5">
          <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-blue-400/80">
              Connect your Betfair account in Settings to trade
            </span>
          </div>
        </div>
      )}

      {/* Upgrade Banner for non-subscribers */}
      {subscriptionLoaded && subscriptionStatus !== "active" && !upgradeBannerDismissed && (
        <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10">
          <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-300">
              You&apos;re paper trading. Ready to go live?{" "}
              <Link href="/settings#subscribe" className="font-bold text-amber-200 underline underline-offset-2 hover:text-white transition-colors">
                Subscribe — £37/month →
              </Link>
            </span>
            <button
              onClick={() => setUpgradeBannerDismissed(true)}
              className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Resume Last Market */}
      {lastMarket && (
        <div className="border-b border-gray-800/50 bg-gray-900/20">
          <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-2">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                params.set("marketId", lastMarket.marketId);
                params.set("p1", lastMarket.p1);
                params.set("p2", lastMarket.p2);
                if (lastMarket.p1Flag) params.set("p1Flag", lastMarket.p1Flag);
                if (lastMarket.p2Flag) params.set("p2Flag", lastMarket.p2Flag);
                if (lastMarket.tournament) params.set("tournament", lastMarket.tournament);
                router.push(`${tradePath}?${params.toString()}`);
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

      {/* Market Scanner */}
      <div className="border-b border-gray-800/50 bg-gray-900/20">
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
                MARKET SCANNER
              </h2>
            </div>
            <span className="text-[10px] text-gray-600">
              {scannerRunning
                ? `Scanning ${scannerMarketCount} live market${scannerMarketCount !== 1 ? "s" : ""}...`
                : "Starting scanner..."}
            </span>
          </div>
          <SubscribeGate feature="Market Scanner" description="Real-time alerts for momentum shifts, WOM flips, and volume spikes">
          {scannerAlerts.length > 0 ? (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {scannerAlerts.slice(0, 5).map((alert) => {
                // Find market data for linking
                const market = markets.find((m) => m.id === alert.marketId);
                const linkHref = market
                  ? `${tradePath}?marketId=${alert.marketId}&p1=${encodeURIComponent(market.player1.name)}&p2=${encodeURIComponent(market.player2.name)}&tournament=${encodeURIComponent(market.tournament)}${market.player1.odds ? `&p1Odds=${market.player1.odds}` : ""}${market.player2.odds ? `&p2Odds=${market.player2.odds}` : ""}`
                  : `${tradePath}?marketId=${alert.marketId}`;

                return (
                  <Link
                    key={alert.id}
                    href={linkHref}
                    className={`block px-3 py-2 rounded-xl border transition-all hover:brightness-125 ${
                      alert.severity === "high"
                        ? "bg-red-500/5 border-red-500/20"
                        : alert.severity === "medium"
                          ? "bg-orange-500/5 border-orange-500/20"
                          : "bg-gray-800/30 border-gray-700/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0 mt-px">
                        {ALERT_ICONS[alert.alertType] ?? "📊"}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs text-white font-medium">{alert.players}</span>
                        <span className="text-[10px] text-gray-500 ml-1.5">
                          {Math.round((Date.now() - alert.timestamp) / 60000)}m ago
                        </span>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{alert.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {scannerAlerts.length > 5 && (
                <button
                  onClick={() => setScannerAlerts((prev) => prev.slice(0, 20))}
                  className="w-full text-center text-[10px] text-gray-600 py-1 hover:text-gray-400 transition-colors"
                >
                  {scannerAlerts.length - 5} more alert{scannerAlerts.length - 5 !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              {scannerRunning
                ? `Scanning ${scannerMarketCount} live markets... No alerts yet`
                : "Connecting to scanner..."}
            </p>
          )}
          </SubscribeGate>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="border-b border-gray-800/50 bg-gray-900/20">
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-3 space-y-3">
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
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 mt-3">Loading markets...</p>
        </div>
      )}

      {/* Match Selection Guide */}
      {!loading && markets.length > 0 && (
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 pt-4">
          <MatchSelectionGuide markets={markets} />
        </div>
      )}

      {/* Market Cards Grid */}
      {!loading && (
        <div className="max-w-2xl md:max-w-4xl min-[1920px]:max-w-6xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 min-[1920px]:grid-cols-3 gap-3">
            {filtered.map((market) => (
              <Link
                key={market.id}
                href={`${tradePath}?marketId=${market.id}&p1=${encodeURIComponent(market.player1.name)}&p2=${encodeURIComponent(market.player2.name)}&tournament=${encodeURIComponent(market.tournament)}${market.player1.odds ? `&p1Odds=${market.player1.odds}` : ""}${market.player2.odds ? `&p2Odds=${market.player2.odds}` : ""}`}
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
