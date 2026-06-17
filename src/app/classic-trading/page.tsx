"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase";
import { useBetfairToken } from "@/hooks/useBetfairToken";
import { useBetfairStream } from "@/hooks/useBetfairStream";
import { validateAndExecute, type TradeActionParams } from "@/lib/tradeActions";
import { BETFAIR_MIN_STAKE, moveByTicks, calculateLayStakeFromLiability } from "@/lib/tradingMaths";
import ClassicLadder from "@/components/classic/ClassicLadder";
import ClassicPositionPanel from "@/components/classic/ClassicPositionPanel";
import ClassicTrustPanel from "@/components/classic/ClassicTrustPanel";
import ClassicAIPanel from "@/components/classic/ClassicAIPanel";
import AIMarketView from "@/components/AIMarketView";
import ClassicTradeTools from "@/components/classic/ClassicTradeTools";
import { calculateLiabilityReduction } from "@/components/classic/ClassicLiabilityTools";
import { calculateMarketHedge } from "@/components/classic/ClassicMarketHedge";
import RealTradeConfirmModal from "@/components/RealTradeConfirmModal";
import ClassicMatchState from "@/components/classic/ClassicMatchState";
import { inferSurface, buildMatchContext, formatMatchContextForPrompt, type ScoreConfidence } from "@/lib/tennisContext";

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

interface RecentMarket {
  marketId: string;
  p1: string;
  p2: string;
  p1Flag: string;
  p2Flag: string;
  tournament: string;
  visitedAt: number;
}

interface PendingTickOffsetTrade {
  side: "BACK" | "LAY";
  price: number;
  stake: number;
  selectionId: number;
}

const STAKES = [5, 10, 25, 50, 100];

function formatVolume(v: number) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
  return `£${Math.round(v)}`;
}

function calcPressure(runner: { ex?: { availableToBack?: { price: number; size: number }[]; availableToLay?: { price: number; size: number }[] } } | null) {
  if (!runner?.ex) return { direction: "balanced" as const, strength: 0 };
  const backs = runner.ex.availableToBack ?? [];
  const lays = runner.ex.availableToLay ?? [];
  const backDepth = backs.reduce((sum, ps, i) => sum + ps.size * (1 / (i + 1)), 0);
  const layDepth = lays.reduce((sum, ps, i) => sum + ps.size * (1 / (i + 1)), 0);
  const total = backDepth + layDepth;
  if (total === 0) return { direction: "balanced" as const, strength: 0 };
  const imbalance = (layDepth - backDepth) / total;
  if (Math.abs(imbalance) < 0.15) return { direction: "balanced" as const, strength: 0 };
  return { direction: imbalance > 0 ? "back" as const : "lay" as const, strength: Math.min(Math.abs(imbalance), 1) };
}

/* ─── Recent markets helpers ─── */

function loadRecentMarkets(): RecentMarket[] {
  try {
    const raw = localStorage.getItem("recentMarkets");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentMarket(market: Omit<RecentMarket, "visitedAt">) {
  try {
    const existing = loadRecentMarkets().filter((m) => m.marketId !== market.marketId);
    const updated = [{ ...market, visitedAt: Date.now() }, ...existing].slice(0, 5);
    localStorage.setItem("recentMarkets", JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

/* ─── Page wrapper ─── */

export default function ClassicTradingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading Classic View...</div>
        </div>
      }
    >
      <ClassicTradingPage />
    </Suspense>
  );
}

/* ─── Main Page ─── */

function ClassicTradingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const marketId = searchParams.get("marketId");
  const eventId = searchParams.get("eventId");
  const p1Name = searchParams.get("p1");
  const p2Name = searchParams.get("p2");
  const p1Flag = searchParams.get("p1Flag") ?? "";
  const p2Flag = searchParams.get("p2Flag") ?? "";
  const tournament = searchParams.get("tournament") ?? "Tennis";

  /* ─── Restore last market ─── */
  const [noMarket, setNoMarket] = useState(false);
  useEffect(() => {
    if (!marketId) {
      try {
        const saved = localStorage.getItem("lastMarket");
        if (saved) {
          const m = JSON.parse(saved);
          const params = new URLSearchParams();
          if (m.marketId) params.set("marketId", m.marketId);
          if (m.eventId) params.set("eventId", m.eventId);
          if (m.p1) params.set("p1", m.p1);
          if (m.p2) params.set("p2", m.p2);
          if (m.p1Flag) params.set("p1Flag", m.p1Flag);
          if (m.p2Flag) params.set("p2Flag", m.p2Flag);
          if (m.tournament) params.set("tournament", m.tournament);
          router.replace(`/classic-trading?${params.toString()}`);
          return;
        }
      } catch { /* invalid JSON or SSR */ }
      setNoMarket(true);
    }
  }, [marketId, router]);

  /* ─── Save market to localStorage + recent markets ─── */
  const [recentMarkets, setRecentMarkets] = useState<RecentMarket[]>([]);
  useEffect(() => {
    if (marketId && p1Name && p2Name) {
      try {
        localStorage.setItem(
          "lastMarket",
          JSON.stringify({ marketId, eventId, p1: p1Name, p2: p2Name, p1Flag, p2Flag, tournament })
        );
        const updated = saveRecentMarket({ marketId, p1: p1Name, p2: p2Name, p1Flag, p2Flag, tournament });
        setRecentMarkets(updated);
      } catch { /* SSR guard */ }
    } else {
      setRecentMarkets(loadRecentMarkets());
    }
  }, [marketId, eventId, p1Name, p2Name, p1Flag, p2Flag, tournament]);

  /* ─── UI state ─── */
  const [selectedStake, setSelectedStake] = useState<number | null>(25);
  const [customStakeInput, setCustomStakeInput] = useState("");
  const [activeTab, setActiveTab] = useState<"ladders" | "positions" | "ai">("ladders");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastClickedRunner, setLastClickedRunner] = useState<"player1" | "player2">("player1");

  /* ─── Safe Mode / Pro Mode ─── */
  const [tradingMode, setTradingMode] = useState<"safe" | "pro">(() => {
    try { return (localStorage.getItem("trading_mode") as "safe" | "pro") || "safe"; } catch { return "safe"; }
  });
  const [layInputMode, setLayInputMode] = useState<"stake" | "liability">(() => {
    try { return (localStorage.getItem("layInputMode") as "stake" | "liability") || "stake"; } catch { return "stake"; }
  });
  const [pendingRealTrade, setPendingRealTrade] = useState<{
    price: number; side: "BACK" | "LAY"; selectionId: number; playerName: string;
  } | null>(null);

  const rawInputAmount = customStakeInput
    ? (Number(customStakeInput) || 0)
    : selectedStake ?? 25;
  const activeStake = rawInputAmount;
  const stakeBelowMin = activeStake > 0 && activeStake < BETFAIR_MIN_STAKE;

  /* ─── Session timer ─── */
  const [sessionStart] = useState(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState(0);

  /* ─── AI state ─── */
  const [aiSignal, setAiSignal] = useState<{
    type: string; confidence: number; edgeSize: string;
    analysis: string; model: string; timestamp: string;
  } | null>(null);
  const [aiSignalLoading, setAiSignalLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [guardianData, setGuardianData] = useState<any>(null);
  const [guardianLoading, setGuardianLoading] = useState(false);

  /* ─── Trade Tools state ─── */
  const [tickOffsetEnabled, setTickOffsetEnabled] = useState(false);
  const [tickOffsetTicks, setTickOffsetTicks] = useState(2);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState<number | null>(null);
  const [stopLossTriggered, setStopLossTriggered] = useState(false);
  const [fokEnabled, setFokEnabled] = useState(false);
  const [fokSeconds, setFokSeconds] = useState(15);
  const [pendingTickOffset, setPendingTickOffset] = useState<PendingTickOffsetTrade | null>(null);

  /* ─── Market search ─── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ─── Session notes ─── */
  const [sessionNotes, setSessionNotes] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(`notes_${marketId}`) ?? ""; } catch { return ""; }
  });

  /* ─── Recent markets dropdown ─── */
  const [recentOpen, setRecentOpen] = useState(false);

  /* ─── Live Scores ─── */
  const [liveScore, setLiveScore] = useState<{
    available: boolean; sets?: number[][]; gameScore?: string[];
    server?: 1 | 2; matchStatus?: string; breakPoint?: boolean;
    setPoint?: boolean; matchPoint?: boolean; tiebreak?: boolean;
    tiebreakScore?: string[]; scoreConfidence?: ScoreConfidence;
    provider?: "betfair" | "api-tennis" | "unavailable"; reason?: string;
  } | null>(null);

  useEffect(() => {
    if (!p1Name || !p2Name) return;
    async function fetchScore() {
      try {
        const res = await fetch("/api/betfair/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, player1: p1Name, player2: p2Name }),
        });
        const data = await res.json();
        setLiveScore(data.available ? data : null);
      } catch { setLiveScore(null); }
    }
    fetchScore();
    const id = setInterval(fetchScore, 5_000);
    return () => clearInterval(id);
  }, [eventId, p1Name, p2Name]);

  /* ─── Stale score detection ─── */
  const [isScoreStale, setIsScoreStale] = useState(false);
  const lastScoreUpdateRef = useRef(Date.now());
  const lastScoreJsonRef = useRef("");

  useEffect(() => {
    const json = JSON.stringify(liveScore);
    if (json !== lastScoreJsonRef.current) {
      lastScoreJsonRef.current = json;
      lastScoreUpdateRef.current = Date.now();
      setIsScoreStale(false);
    }
  }, [liveScore]);

  /* ─── Live positions ─── */
  const [livePositions, setLivePositions] = useState<SupabaseTrade[]>([]);

  /* Clear local positions when switching markets to prevent stale display */
  const prevMarketIdRef = useRef(marketId);
  useEffect(() => {
    if (marketId !== prevMarketIdRef.current) {
      prevMarketIdRef.current = marketId;
      setLivePositions([]);
    }
  }, [marketId]);

  const [tradeHistory, setTradeHistory] = useState<SupabaseTrade[]>([]);

  const fetchTrades = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: closed } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .eq("is_shadow", false)
      .order("closed_at", { ascending: false })
      .limit(20);
    if (closed) setTradeHistory(closed);
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  /* ─── Close trade as green-up ─── */
  function removeLivePosition(posId: string) {
    setLivePositions((prev) => prev.filter((p) => p.id !== posId));
  }

  async function closeTradeAsGreenUp(tradeId: string, exitPrice: number, pnl: number) {
    const supabase = createClient();
    if (!tradeId.startsWith("local-")) {
      await supabase
        .from("trades")
        .update({
          exit_price: exitPrice,
          pnl,
          status: "closed",
          greened_up: true,
          closed_at: new Date().toISOString(),
        })
        .eq("id", tradeId);
    }
    removeLivePosition(tradeId);
    fetchTrades();
  }

  /* ─── Consecutive losses ─── */
  const consecutiveLosses = useMemo(() => {
    let count = 0;
    for (const t of tradeHistory) {
      if ((t.pnl ?? 0) < 0) count++;
      else break;
    }
    return count;
  }, [tradeHistory]);

  /* ─── Recenter trigger ─── */
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  /* ─── Store ─── */
  const {
    marketBook,
    fetchMarketBook,
    placeTrade,
    tradeLoading,
    tradeError,
    lastTradeSuccess,
    clearTradeMessages,
    unmatchedOrders,
    fetchUnmatchedOrders,
    cancelOrder,
    addPendingOrder,
    subscriptionStatus,
    subscriptionLoaded,
    fetchSubscriptionStatus,
  } = useAppStore();

  /* ─── Stale score interval (needs marketBook) ─── */
  useEffect(() => {
    const id = setInterval(() => {
      if (marketBook?.inplay && Date.now() - lastScoreUpdateRef.current > 20_000) {
        setIsScoreStale(true);
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [marketBook?.inplay]);

  /* ─── Unified trade-action executor ─── */
  const execAction = useCallback(
    (params: TradeActionParams) =>
      validateAndExecute(params, {
        placeTrade,
        cancelOrder,
        onError: (msg) => {
          setToast({ message: msg, type: "error" });
          setTimeout(() => setToast(null), 8000);
        },
      }),
    [placeTrade, cancelOrder]
  );

  /* ─── Subscription gate ─── */
  useEffect(() => {
    if (!subscriptionLoaded) fetchSubscriptionStatus();
  }, [subscriptionLoaded, fetchSubscriptionStatus]);

  useEffect(() => {
    if (subscriptionLoaded && subscriptionStatus !== "active") {
      const params = new URLSearchParams();
      if (marketId) params.set("marketId", marketId);
      if (eventId) params.set("eventId", eventId);
      if (p1Name) params.set("p1", p1Name);
      if (p2Name) params.set("p2", p2Name);
      if (p1Flag) params.set("p1Flag", p1Flag);
      if (p2Flag) params.set("p2Flag", p2Flag);
      if (tournament !== "Tennis") params.set("tournament", tournament);
      const qs = params.toString();
      router.replace(`/paper${qs ? `?${qs}` : ""}`);
    }
  }, [subscriptionLoaded, subscriptionStatus, marketId, eventId, p1Name, p2Name, p1Flag, p2Flag, tournament, router]);

  /* ─── Betfair connection ─── */
  const { isConnected: betfairHookConnected } = useBetfairToken();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (betfairHookConnected) {
      setIsConnected(true);
      useAppStore.setState({ isConnected: true });
    }
  }, [betfairHookConnected]);

  const isLive = isConnected && !!marketId && !!marketBook;

  /* ─── Matched positions vs unmatched orders ─── */
  const { matchedPositions, unmatchedDisplayOrders, openPositions } = useMemo(() => {
    const nameMap = new Map<number, string>();
    if (marketBook?.runners) {
      const r0 = marketBook.runners[0];
      const r1 = marketBook.runners[1];
      if (r0) nameMap.set(r0.selectionId, r0.runnerName || p1Name || "Player 1");
      if (r1) nameMap.set(r1.selectionId, r1.runnerName || p2Name || "Player 2");
    }

    const matched: SupabaseTrade[] = [];
    const unmatched: UnmatchedDisplayOrder[] = [];
    const seenBetIds = new Set<string>();

    function orderToTrade(o: typeof unmatchedOrders[0], stake: number): SupabaseTrade {
      return {
        id: o.betId, user_id: "", market_id: o.marketId,
        selection_id: String(o.selectionId),
        player: nameMap.get(o.selectionId) || `Selection ${o.selectionId}`,
        side: o.side, entry_price: o.price, exit_price: null, stake,
        pnl: null, status: "open", greened_up: false, is_shadow: false,
        ai_signal_used: false, notes: null, coach_insight: null,
        created_at: o.placedDate, closed_at: null,
      };
    }

    function orderToUnmatched(o: typeof unmatchedOrders[0], isPartial: boolean): UnmatchedDisplayOrder {
      return {
        betId: o.betId, displayId: isPartial ? `${o.betId}-unmatched` : o.betId,
        marketId: o.marketId, selectionId: o.selectionId,
        player: nameMap.get(o.selectionId) || `Selection ${o.selectionId}`,
        side: o.side as "BACK" | "LAY", price: o.price,
        sizeRemaining: o.sizeRemaining as number, sizeMatched: o.sizeMatched as number,
        placedDate: o.placedDate, isPartial,
      };
    }

    for (const pos of livePositions) {
      if (pos.market_id !== marketId) continue;
      const order = unmatchedOrders.find((o) => o.betId === pos.id);
      if (!order) {
        matched.push(pos);
      } else if (order.sizeMatched > 0 && order.sizeRemaining > 0) {
        matched.push({ ...pos, stake: order.sizeMatched as number });
        unmatched.push(orderToUnmatched(order, true));
      } else {
        unmatched.push(orderToUnmatched(order, false));
      }
      seenBetIds.add(pos.id);
    }

    for (const o of unmatchedOrders) {
      if (seenBetIds.has(o.betId)) continue;
      if (o.marketId !== marketId) continue;
      const isPartial = (o.sizeMatched as number) > 0;
      if (isPartial) matched.push(orderToTrade(o, o.sizeMatched as number));
      if ((o.sizeRemaining as number) > 0) unmatched.push(orderToUnmatched(o, isPartial));
    }

    return { matchedPositions: matched, unmatchedDisplayOrders: unmatched, openPositions: matched };
  }, [livePositions, unmatchedOrders, marketBook, p1Name, p2Name, marketId]);

  /* ─── Streaming ─── */
  const { streamStatus, isStreaming } = useBetfairStream(isConnected ? marketId : null);

  /* ─── Polling fallback ─── */
  const fetchPrices = useCallback(() => {
    if (isConnected && marketId) fetchMarketBook([marketId]);
  }, [isConnected, marketId, fetchMarketBook]);

  useEffect(() => {
    if (isStreaming) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchPrices, isStreaming]);

  /* ─── Poll unmatched orders ─── */
  const unmatchedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isConnected || !marketId) return;
    const timer = setTimeout(() => {
      fetchUnmatchedOrders(marketId);
      unmatchedIntervalRef.current = setInterval(() => fetchUnmatchedOrders(marketId), 3000);
    }, 1500);
    return () => {
      clearTimeout(timer);
      if (unmatchedIntervalRef.current) clearInterval(unmatchedIntervalRef.current);
    };
  }, [isConnected, marketId, fetchUnmatchedOrders]);

  /* ─── Toast on trade success/error ─── */
  useEffect(() => {
    if (lastTradeSuccess) {
      setToast({ message: lastTradeSuccess, type: "success" });
      clearTradeMessages();
      fetchTrades();
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
    if (tradeError) {
      setToast({ message: tradeError, type: "error" });
      clearTradeMessages();
      const t = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(t);
    }
  }, [lastTradeSuccess, tradeError, clearTradeMessages, fetchTrades]);

  /* ─── Runners and player odds ─── */
  const runner0 = isLive ? marketBook.runners?.[0] ?? null : null;
  const runner1 = isLive ? marketBook.runners?.[1] ?? null : null;

  const playerOdds = {
    player1: runner0?.ex?.availableToBack?.[0]?.price ?? 0,
    player2: runner1?.ex?.availableToBack?.[0]?.price ?? 0,
  };

  const displayPlayers = {
    player1: {
      name: p1Name ?? "Player 1",
      short: p1Name?.split(" ").pop() ?? "P1",
      odds: playerOdds.player1,
      flag: p1Flag,
    },
    player2: {
      name: p2Name ?? "Player 2",
      short: p2Name?.split(" ").pop() ?? "P2",
      odds: playerOdds.player2,
      flag: p2Flag,
    },
  };

  /* ─── Unmatched by price for each runner ─── */
  const unmatchedByPriceP1 = useMemo(() => {
    const map = new Map<number, { backSize: number; laySize: number }>();
    if (!runner0) return map;
    for (const order of unmatchedOrders) {
      if (order.marketId !== marketId) continue;
      if (order.selectionId !== runner0.selectionId) continue;
      const entry = map.get(order.price) ?? { backSize: 0, laySize: 0 };
      if (order.side === "BACK") entry.backSize += order.sizeRemaining as number;
      else entry.laySize += order.sizeRemaining as number;
      map.set(order.price, entry);
    }
    return map;
  }, [unmatchedOrders, runner0, marketId]);

  const unmatchedByPriceP2 = useMemo(() => {
    const map = new Map<number, { backSize: number; laySize: number }>();
    if (!runner1) return map;
    for (const order of unmatchedOrders) {
      if (order.marketId !== marketId) continue;
      if (order.selectionId !== runner1.selectionId) continue;
      const entry = map.get(order.price) ?? { backSize: 0, laySize: 0 };
      if (order.side === "BACK") entry.backSize += order.sizeRemaining as number;
      else entry.laySize += order.sizeRemaining as number;
      map.set(order.price, entry);
    }
    return map;
  }, [unmatchedOrders, runner1, marketId]);

  /* ─── Position aggregation per runner ─── */
  function getAggregatedPositionForRunner(selectionId: number | undefined) {
    if (!selectionId) return null;
    const positions = openPositions.filter((p) => p.selection_id === String(selectionId));
    if (positions.length === 0) return null;
    let backTotal = 0, backWeighted = 0, layTotal = 0, layWeighted = 0;
    for (const pos of positions) {
      if (!pos.stake || !pos.entry_price) continue;
      if (pos.side === "BACK") {
        backTotal += pos.stake;
        backWeighted += pos.stake * pos.entry_price;
      } else {
        layTotal += pos.stake;
        layWeighted += pos.stake * pos.entry_price;
      }
    }
    const netStake = Math.round((backTotal - layTotal) * 100) / 100;
    const netSide: "BACK" | "LAY" | "FLAT" = netStake > 0 ? "BACK" : netStake < 0 ? "LAY" : "FLAT";
    const avgEntry = netSide === "BACK" && backTotal > 0
      ? Math.round((backWeighted / backTotal) * 100) / 100
      : netSide === "LAY" && layTotal > 0
        ? Math.round((layWeighted / layTotal) * 100) / 100
        : 0;
    return { netSide, netStake: Math.abs(netStake), avgEntry, count: positions.length, backTotal: Math.round(backTotal * 100) / 100, layTotal: Math.round(layTotal * 100) / 100 };
  }

  const p1Agg = getAggregatedPositionForRunner(runner0?.selectionId);
  const p2Agg = getAggregatedPositionForRunner(runner1?.selectionId);

  const p1LayPrice = runner0?.ex?.availableToLay?.[0]?.price ?? 0;
  const p1BackPrice = runner0?.ex?.availableToBack?.[0]?.price ?? 0;
  const p2LayPrice = runner1?.ex?.availableToLay?.[0]?.price ?? 0;
  const p2BackPrice = runner1?.ex?.availableToBack?.[0]?.price ?? 0;

  // Pure deterministic: liability → stake at current best lay odds (updates every tick)
  const previewLayPrice = lastClickedRunner === "player1" ? p1LayPrice : p2LayPrice;
  const effectiveStakeAtBestLay = useMemo(() => {
    if (layInputMode !== "liability") return rawInputAmount;
    if (previewLayPrice <= 1) return 0;
    return calculateLayStakeFromLiability(rawInputAmount, previewLayPrice);
  }, [layInputMode, rawInputAmount, previewLayPrice]);

  /* ─── Pressure per runner ─── */
  const p1Pressure = useMemo(() => calcPressure(runner0), [runner0]);
  const p2Pressure = useMemo(() => calcPressure(runner1), [runner1]);

  /* ─── Dual ladder relationship ─── */
  const p1Short = displayPlayers.player1.short;
  const p2Short = displayPlayers.player2.short;
  const ladderRelationship = useMemo(() => {
    const p1 = p1Pressure;
    const p2 = p2Pressure;
    if (p1.direction === "back" && p2.direction === "lay")
      return `${p1Short} shortening, ${p2Short} drifting`;
    if (p1.direction === "lay" && p2.direction === "back")
      return `${p2Short} shortening, ${p1Short} drifting`;
    if (p1.direction === "back" && p2.direction === "back")
      return "Both ladders under back pressure";
    if (p1.direction === "lay" && p2.direction === "lay")
      return "Both ladders under lay pressure";
    return null;
  }, [p1Pressure, p2Pressure, p1Short, p2Short]);

  /* ─── Unrealized P&L per runner ─── */
  function getUnrealizedPnl(playerKey: "player1" | "player2"): number | null {
    const playerName = displayPlayers[playerKey].name;
    const currentOdds = displayPlayers[playerKey].odds;
    const positions = openPositions.filter((p) => p.player === playerName);
    if (positions.length === 0 || !currentOdds || currentOdds <= 0) return null;
    let total = 0;
    for (const pos of positions) {
      if (!pos.entry_price || !pos.stake) continue;
      const greenStake = (pos.stake * pos.entry_price) / currentOdds;
      total += pos.side === "BACK" ? (greenStake - pos.stake) : (pos.stake - greenStake);
    }
    return Math.round(total * 100) / 100;
  }

  /* ─── Outcome P&L ─── */
  const outcomePnl = useMemo(() => {
    if (openPositions.length === 0) return null;
    const r0Id = runner0?.selectionId;
    const r1Id = runner1?.selectionId;
    if (!r0Id || !r1Id) return null;
    let ifP1Wins = 0, ifP2Wins = 0;
    for (const pos of openPositions) {
      if (!pos.stake || !pos.entry_price || !pos.selection_id) continue;
      const selId = Number(pos.selection_id);
      const stake = pos.stake;
      const price = pos.entry_price;
      if (pos.side === "BACK") {
        if (selId === r0Id) { ifP1Wins += stake * (price - 1); ifP2Wins -= stake; }
        else if (selId === r1Id) { ifP1Wins -= stake; ifP2Wins += stake * (price - 1); }
      } else {
        if (selId === r0Id) { ifP1Wins -= stake * (price - 1); ifP2Wins += stake; }
        else if (selId === r1Id) { ifP1Wins += stake; ifP2Wins -= stake * (price - 1); }
      }
    }
    return {
      ifPlayer1Wins: Math.round(ifP1Wins * 100) / 100,
      ifPlayer2Wins: Math.round(ifP2Wins * 100) / 100,
    };
  }, [openPositions, runner0, runner1]);

  /* ─── Add live position ─── */
  function addLivePosition(params: { marketId: string; selectionId: number; side: "BACK" | "LAY"; price: number; size: number; betId?: string }) {
    const nameMap = new Map<number, string>();
    if (marketBook?.runners) {
      const r0 = marketBook.runners[0];
      const r1 = marketBook.runners[1];
      if (r0) nameMap.set(r0.selectionId, r0.runnerName || p1Name || "Player 1");
      if (r1) nameMap.set(r1.selectionId, r1.runnerName || p2Name || "Player 2");
    }
    const posId = params.betId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pos: SupabaseTrade = {
      id: posId, user_id: "", market_id: params.marketId,
      selection_id: String(params.selectionId),
      player: nameMap.get(params.selectionId) || `Selection ${params.selectionId}`,
      side: params.side, entry_price: params.price, exit_price: null, stake: params.size,
      pnl: null, status: "open", greened_up: false, is_shadow: false,
      ai_signal_used: false, notes: null, coach_insight: null,
      created_at: new Date().toISOString(), closed_at: null,
    };
    setLivePositions((prev) => [...prev, pos]);
  }

  /* ─── Handle trade click (takes selectionId for dual ladders) ─── */
  async function handleTradeClick(selectionId: number, price: number, side: "BACK" | "LAY", playerKey: "player1" | "player2") {
    if (!marketId) return;
    setLastClickedRunner(playerKey);

    if (!isConnected) {
      setToast({ message: "Connect Betfair to place live trades", type: "error" });
      return;
    }

    if (tradingMode === "safe") {
      setPendingRealTrade({ price, side, selectionId, playerName: displayPlayers[playerKey].name });
      return;
    }

    const effectiveStake = (side === "LAY" && layInputMode === "liability")
      ? calculateLayStakeFromLiability(rawInputAmount, price)
      : rawInputAmount;
    if (side === "LAY" && layInputMode === "liability") {
      console.log(`[trade] LIABILITY MODE: input=£${rawInputAmount} → stake=£${effectiveStake} @ ${price}`);
    }

    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side, price, size: effectiveStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    const result = await execAction({
      actionName: "PLACE_TRADE", marketId, selectionId, side, price, size: effectiveStake,
    });
    if (result.success) {
      addLivePosition({ marketId, selectionId, side, price, size: effectiveStake, betId: result.betId });
    }
  }

  /* ─── Confirmed trade (from Safe Mode modal) ─── */
  async function executeConfirmedRealTrade(selectionId: number, price: number, side: "BACK" | "LAY") {
    if (!marketId) return;
    const effectiveStake = (side === "LAY" && layInputMode === "liability")
      ? calculateLayStakeFromLiability(rawInputAmount, price)
      : rawInputAmount;
    if (side === "LAY" && layInputMode === "liability") {
      console.log(`[trade] LIABILITY MODE: input=£${rawInputAmount} → stake=£${effectiveStake} @ ${price}`);
    }
    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side, price, size: effectiveStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    const result = await execAction({
      actionName: "PLACE_TRADE", marketId, selectionId, side, price, size: effectiveStake,
    });
    if (result.success) {
      addLivePosition({ marketId, selectionId, side, price, size: effectiveStake, betId: result.betId });
    }
  }

  /* ─── Market hedge handler ─── */
  async function handleMarketHedge(runner: "player1" | "player2", side: "BACK" | "LAY", price: number, stake: number) {
    await handleReduceLiability(runner, side, price, stake);
  }

  /* ─── Liability reduction handler ─── */
  async function handleReduceLiability(runner: "player1" | "player2", tradeSide: "BACK" | "LAY", tradePrice: number, tradeStake: number) {
    if (!marketId) return;
    const selId = runner === "player1" ? runner0?.selectionId : runner1?.selectionId;
    if (!selId) return;

    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side: tradeSide, price: tradePrice, size: tradeStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    const result = await execAction({
      actionName: "PLACE_TRADE", marketId, selectionId: selId,
      side: tradeSide, price: tradePrice, size: tradeStake,
    });
    if (result.success) {
      addLivePosition({ marketId, selectionId: selId, side: tradeSide, price: tradePrice, size: tradeStake, betId: result.betId });
    }
  }

  const resolvedSurface = inferSurface(tournament, undefined);

  /* ─── AI Signals ─── */
  async function fetchAiSignal() {
    setAiSignalLoading(true);
    try {
      const p1Backs = runner0?.ex?.availableToBack ?? [];
      const p1Lays = runner0?.ex?.availableToLay ?? [];
      const p2Backs = runner1?.ex?.availableToBack ?? [];
      const p2Lays = runner1?.ex?.availableToLay ?? [];
      const sum3 = (arr: { size: number }[]) => arr.slice(0, 3).reduce((s, ps) => s + ps.size, 0);
      const ladderContext = `${displayPlayers.player1.short} back depth £${Math.round(sum3(p1Backs))} / lay depth £${Math.round(sum3(p1Lays))}. ${displayPlayers.player2.short} back depth £${Math.round(sum3(p2Backs))} / lay depth £${Math.round(sum3(p2Lays))}.`;

      const isSusp = marketBook?.status === "SUSPENDED";
      const inPlay = !!marketBook?.inplay;
      const marketStatus = isSusp ? "suspended" as const : inPlay ? "in_play" as const : "pre_match" as const;

      const matchCtx = buildMatchContext({
        player1: displayPlayers.player1.name,
        player2: displayPlayers.player2.name,
        liveScore: liveScore ?? null,
        marketStatus,
        isScoreStale: !!(liveScore && (liveScore as { isScoreStale?: boolean }).isScoreStale),
        player1Odds: displayPlayers.player1.odds,
        player2Odds: displayPlayers.player2.odds,
        surface: resolvedSurface,
      });

      const matchStateContext = formatMatchContextForPrompt(matchCtx);
      const signalType = marketBook?.inplay ? "in_play" : "pre_match";

      const res = await fetch("/api/ai-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalType,
          matchContext: {
            player1: displayPlayers.player1.name,
            player2: displayPlayers.player2.name,
            odds1: displayPlayers.player1.odds,
            odds2: displayPlayers.player2.odds,
            tournament,
            surface: resolvedSurface,
            score: matchCtx.formattedScore,
            server: matchCtx.serverName,
            scoreConfidence: matchCtx.scoreConfidence,
            matchStateContext,
            ladderContext,
            breakPoint: matchCtx.breakPoint,
            setPoint: matchCtx.setPoint,
            matchPoint: matchCtx.matchPoint,
            tiebreak: matchCtx.tiebreak,
            finalSet: matchCtx.finalSet,
            isScoreStale: matchCtx.isScoreStale,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.signal) setAiSignal(data.signal);
    } catch { /* non-critical */ }
    setAiSignalLoading(false);
  }

  /* ─── AI Guardian ─── */
  async function fetchGuardianAssessment() {
    setGuardianLoading(true);
    try {
      const bestBack = displayPlayers[lastClickedRunner].odds;
      const runner = lastClickedRunner === "player1" ? runner0 : runner1;
      const bestLay = runner?.ex?.availableToLay?.[0]?.price ?? bestBack + 0.02;

      const isSusp = marketBook?.status === "SUSPENDED";
      const inPlay = !!marketBook?.inplay;
      const marketStatus = isSusp ? "suspended" as const : inPlay ? "in_play" as const : "pre_match" as const;

      const matchCtx = buildMatchContext({
        player1: displayPlayers.player1.name,
        player2: displayPlayers.player2.name,
        liveScore: liveScore ?? null,
        marketStatus,
        isScoreStale: !!(liveScore && (liveScore as { isScoreStale?: boolean }).isScoreStale),
        player1Odds: displayPlayers.player1.odds,
        player2Odds: displayPlayers.player2.odds,
        surface: resolvedSurface,
      });

      const res = await fetch("/api/ai-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assessPosition",
          entryPrice: openPositions[0]?.entry_price ?? 0,
          entryStake: openPositions[0]?.stake ?? 0,
          entrySide: openPositions[0]?.side ?? "BACK",
          currentBackPrice: bestBack,
          currentLayPrice: bestLay,
          matchContext: {
            player: displayPlayers[lastClickedRunner].name,
            surface: resolvedSurface,
            score: matchCtx.formattedScore,
            server: matchCtx.serverName,
            scoreConfidence: matchCtx.scoreConfidence,
          },
        }),
      });
      const data = await res.json();
      if (data.success) setGuardianData(data);
    } catch { /* network error */ }
    setGuardianLoading(false);
  }

  /* ─── Session stats ─── */
  const sessionPnl = tradeHistory.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winCount = tradeHistory.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = tradeHistory.length > 0 ? Math.round((winCount / tradeHistory.length) * 100) : 0;

  /* ─── Session timer ─── */
  useEffect(() => {
    const id = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  const sessionMinutes = Math.floor(sessionElapsed / 60);
  const sessionSeconds = sessionElapsed % 60;
  const sessionTimeStr = `${sessionMinutes}m ${sessionSeconds.toString().padStart(2, "0")}s`;

  /* ─── Fill-or-Kill timer ─── */
  useEffect(() => {
    if (!fokEnabled || !marketId) return;
    const interval = setInterval(() => {
      const now = Date.now();
      for (const order of unmatchedOrders) {
        const age = now - new Date(order.placedDate).getTime();
        if (age > fokSeconds * 1000 && (order.sizeRemaining as number) > 0) {
          cancelOrder({ marketId, betId: order.betId });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fokEnabled, fokSeconds, unmatchedOrders, marketId, cancelOrder]);

  /* ─── Stop Loss monitor ─── */
  useEffect(() => {
    if (!stopLossEnabled || !stopLossPrice) return;
    // Find active net position
    const activeAgg = (p1Agg && p1Agg.netSide !== "FLAT") ? p1Agg : (p2Agg && p2Agg.netSide !== "FLAT") ? p2Agg : null;
    if (!activeAgg || activeAgg.netSide === "FLAT") return;

    const activeRunner = (p1Agg && p1Agg.netSide !== "FLAT") ? runner0 : runner1;
    const ltp = (activeRunner as { lastTradedPrice?: number } | null)?.lastTradedPrice;
    if (!ltp || ltp <= 0) return;

    // BACK position: triggers when LTP >= stopPrice (drifting = price going up = bad for backer)
    // LAY position: triggers when LTP <= stopPrice (shortening = price going down = bad for layer)
    const triggered = activeAgg.netSide === "BACK" ? ltp >= stopLossPrice : ltp <= stopLossPrice;
    if (triggered && !stopLossTriggered) {
      setStopLossTriggered(true);
      setToast({ message: `STOP LOSS: Price hit ${ltp.toFixed(2)}. Close position now!`, type: "error" });
    }
  }, [stopLossEnabled, stopLossPrice, stopLossTriggered, p1Agg, p2Agg, runner0, runner1]);

  // Reset stop loss trigger when stop is disabled
  useEffect(() => {
    if (!stopLossEnabled) setStopLossTriggered(false);
  }, [stopLossEnabled]);

  /* ─── Tick Offset detection ─── */
  const prevUnmatchedRef = useRef<typeof unmatchedOrders>([]);
  useEffect(() => {
    if (!tickOffsetEnabled) {
      prevUnmatchedRef.current = unmatchedOrders;
      return;
    }
    // Find orders that disappeared (matched)
    const currIds = new Set(unmatchedOrders.map((o) => o.betId));
    const matched = prevUnmatchedRef.current.filter(
      (o) => !currIds.has(o.betId) && (o.sizeRemaining as number) > 0
    );
    for (const order of matched) {
      const opposingPrice = order.side === "BACK"
        ? moveByTicks(order.price, -tickOffsetTicks)
        : moveByTicks(order.price, tickOffsetTicks);
      setPendingTickOffset({
        side: order.side === "BACK" ? "LAY" : "BACK",
        price: opposingPrice,
        stake: order.sizeMatched as number || activeStake,
        selectionId: order.selectionId,
      });
    }
    prevUnmatchedRef.current = unmatchedOrders;
  }, [unmatchedOrders, tickOffsetEnabled, tickOffsetTicks, activeStake]);

  /* ─── Session notes persistence ─── */
  useEffect(() => {
    if (marketId && sessionNotes !== undefined) {
      try { localStorage.setItem(`notes_${marketId}`, sessionNotes); } catch { /* SSR */ }
    }
  }, [sessionNotes, marketId]);

  // Load notes when market changes
  useEffect(() => {
    if (marketId) {
      try { setSessionNotes(localStorage.getItem(`notes_${marketId}`) ?? ""); } catch { /* SSR */ }
    }
  }, [marketId]);

  /* ─── Market Search ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchCacheRef = useRef<{ markets: any[]; fetchedAt: number } | null>(null);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      // Use cached markets if fetched within last 30s
      let markets: any[] = searchCacheRef.current?.markets ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (markets.length === 0 || Date.now() - (searchCacheRef.current?.fetchedAt ?? 0) > 30_000) {
        const token = typeof window !== "undefined" ? localStorage.getItem("betfair_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["x-betfair-token"] = token;
        const res = await fetch("/api/betfair/scanner", {
          method: "POST",
          headers,
          body: JSON.stringify({ previousSnapshot: {} }),
        });
        const data = await res.json();
        markets = data.markets ?? [];
        searchCacheRef.current = { markets, fetchedAt: Date.now() };
      }
      // Filter by player name
      const q = query.toLowerCase();
      const filtered = markets.filter((m: { players: string; event: string }) =>
        m.players.toLowerCase().includes(q) || m.event.toLowerCase().includes(q)
      );
      setSearchResults(filtered);
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  /* ─── Keyboard shortcuts ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateRef = useRef<any>(null);
  stateRef.current = {
    activeStake, lastClickedRunner, isLive, marketId, runner0, runner1,
    placeTrade, isConnected, displayPlayers, setToast, setSelectedStake,
    setCustomStakeInput, p1BackPrice, p1LayPrice,
    p2BackPrice, p2LayPrice, openPositions, cancelOrder, unmatchedOrders,
    marketBook, addPendingOrder, addLivePosition, execAction,
    tradingMode, setPendingRealTrade, outcomePnl, handleMarketHedge,
    searchOpen, setSearchOpen, setRecenterTrigger,
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        // Only handle Escape in inputs
        if (e.key === "Escape" && stateRef.current.searchOpen) {
          stateRef.current.setSearchOpen(false);
          e.preventDefault();
        }
        return;
      }

      const s = stateRef.current;

      // Cmd/Ctrl+K → open search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setSearchOpen(!s.searchOpen);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "b": {
          const runner = s.lastClickedRunner === "player1" ? s.runner0 : s.runner1;
          const bestBack = s.lastClickedRunner === "player1" ? s.p1BackPrice : s.p2BackPrice;
          if (bestBack && s.marketId && runner && s.isConnected) {
            if (s.tradingMode === "safe") {
              s.setPendingRealTrade({ price: bestBack, side: "BACK", selectionId: runner.selectionId, playerName: s.displayPlayers[s.lastClickedRunner].name });
              break;
            }
            if (s.marketBook?.inplay) {
              s.addPendingOrder({ id: `${Date.now()}-kb`, side: "BACK", price: bestBack, size: s.activeStake, placedAt: Date.now(), delaySeconds: 5 });
            }
            s.execAction({
              actionName: "KEYBOARD_TRADE", marketId: s.marketId, selectionId: runner.selectionId,
              side: "BACK", price: bestBack, size: s.activeStake,
            }).then((result: { success: boolean; betId?: string }) => {
              if (result.success) {
                s.addLivePosition({ marketId: s.marketId, selectionId: runner.selectionId, side: "BACK", price: bestBack, size: s.activeStake, betId: result.betId });
              }
            });
          }
          break;
        }
        case "l": {
          const runner = s.lastClickedRunner === "player1" ? s.runner0 : s.runner1;
          const bestLay = s.lastClickedRunner === "player1" ? s.p1LayPrice : s.p2LayPrice;
          if (bestLay && s.marketId && runner && s.isConnected) {
            if (s.tradingMode === "safe") {
              s.setPendingRealTrade({ price: bestLay, side: "LAY", selectionId: runner.selectionId, playerName: s.displayPlayers[s.lastClickedRunner].name });
              break;
            }
            if (s.marketBook?.inplay) {
              s.addPendingOrder({ id: `${Date.now()}-kb`, side: "LAY", price: bestLay, size: s.activeStake, placedAt: Date.now(), delaySeconds: 5 });
            }
            s.execAction({
              actionName: "KEYBOARD_TRADE", marketId: s.marketId, selectionId: runner.selectionId,
              side: "LAY", price: bestLay, size: s.activeStake,
            }).then((result: { success: boolean; betId?: string }) => {
              if (result.success) {
                s.addLivePosition({ marketId: s.marketId, selectionId: runner.selectionId, side: "LAY", price: bestLay, size: s.activeStake, betId: result.betId });
              }
            });
          }
          break;
        }
        case "c":
          if (s.isLive && s.marketId && s.unmatchedOrders.length > 0) {
            s.cancelOrder({ marketId: s.marketId });
            s.setToast({ message: "Cancelling all unmatched orders...", type: "success" });
          }
          break;
        case "g": {
          if (!s.outcomePnl || !s.isLive) break;
          const mh = calculateMarketHedge(s.outcomePnl, s.p1LayPrice, s.p1BackPrice, s.p2LayPrice, s.p2BackPrice);
          if (mh && mh.hedgeStake >= BETFAIR_MIN_STAKE) {
            s.handleMarketHedge(mh.hedgeRunner, mh.hedgeSide, mh.hedgePrice, mh.hedgeStake);
          }
          break;
        }
        case "r":
          s.setRecenterTrigger((prev: number) => prev + 1);
          break;
        case "1": s.setSelectedStake(STAKES[0]); s.setCustomStakeInput(""); break;
        case "2": s.setSelectedStake(STAKES[1]); s.setCustomStakeInput(""); break;
        case "3": s.setSelectedStake(STAKES[2]); s.setCustomStakeInput(""); break;
        case "4": s.setSelectedStake(STAKES[3]); s.setCustomStakeInput(""); break;
        case "5": s.setSelectedStake(STAKES[4]); s.setCustomStakeInput(""); break;
        case "enter":
          setRecenterTrigger((prev) => prev + 1);
          break;
        case "escape":
          if (s.searchOpen) s.setSearchOpen(false);
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── Active position info for trade tools ─── */
  const activeAgg = (p1Agg && p1Agg.netSide !== "FLAT") ? p1Agg : (p2Agg && p2Agg.netSide !== "FLAT") ? p2Agg : null;
  const activeRunnerForTools = (p1Agg && p1Agg.netSide !== "FLAT") ? runner0 : runner1;
  const currentLTP = (activeRunnerForTools as { lastTradedPrice?: number } | null)?.lastTradedPrice ?? 0;

  /* ─── No market selected ─── */
  if (noMarket) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Classic Trader</h1>
        <p className="text-sm text-gray-600 mb-4">No market selected</p>
        <Link
          href="/markets"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Select a Match
        </Link>
      </main>
    );
  }

  /* ─── Build props for position panel ─── */
  const positionPanel = (
    <ClassicPositionPanel
      player1Agg={p1Agg}
      player2Agg={p2Agg}
      player1Name={displayPlayers.player1.name}
      player2Name={displayPlayers.player2.name}
      outcomePnl={outcomePnl}
      onMarketHedge={handleMarketHedge}
      tradeLoading={tradeLoading}
      closedTrades={tradeHistory}
      sessionPnl={sessionPnl}
      winRate={winRate}
      p1BackPrice={p1BackPrice}
      p1LayPrice={p1LayPrice}
      p2BackPrice={p2BackPrice}
      p2LayPrice={p2LayPrice}
      marketSuspended={marketBook?.status === "SUSPENDED"}
      onReduceLiability={handleReduceLiability}
    />
  );

  const trustPanel = (
    <ClassicTrustPanel
      matchedPositions={openPositions}
      unmatchedOrders={unmatchedDisplayOrders}
      player1Agg={p1Agg}
      player2Agg={p2Agg}
      player1Name={displayPlayers.player1.name}
      player2Name={displayPlayers.player2.name}
      outcomePnl={outcomePnl}
      onCancelOrder={async (betId) => {
        if (marketId) await cancelOrder({ marketId, betId });
      }}
      onCancelAll={async () => {
        if (marketId) await cancelOrder({ marketId });
      }}
      tradeLoading={tradeLoading}
    />
  );

  const aiPanel = (
    <div className="space-y-3">
      <AIMarketView
        player1Name={displayPlayers.player1.name}
        player2Name={displayPlayers.player2.name}
        player1Odds={displayPlayers.player1.odds}
        player2Odds={displayPlayers.player2.odds}
        tournament={tournament}
        isInPlay={!!marketBook?.inplay}
        isSuspended={marketBook?.status === "SUSPENDED"}
        liveScore={liveScore}
        variant="light"
      />
      <ClassicAIPanel
        aiSignal={aiSignal}
        aiSignalLoading={aiSignalLoading}
        guardianData={guardianData}
        guardianLoading={guardianLoading}
        onFetchSignal={fetchAiSignal}
        onFetchGuardian={fetchGuardianAssessment}
        player1Name={displayPlayers.player1.name}
        player2Name={displayPlayers.player2.name}
        player1Odds={displayPlayers.player1.odds}
        player2Odds={displayPlayers.player2.odds}
        isInPlay={!!marketBook?.inplay}
        sessionPnl={sessionPnl}
        consecutiveLosses={consecutiveLosses}
        ladderRelationship={ladderRelationship}
      />
    </div>
  );

  const tradeToolsPanel = (
    <ClassicTradeTools
      tickOffsetEnabled={tickOffsetEnabled}
      tickOffsetTicks={tickOffsetTicks}
      onTickOffsetToggle={setTickOffsetEnabled}
      onTickOffsetChange={setTickOffsetTicks}
      stopLossEnabled={stopLossEnabled}
      stopLossPrice={stopLossPrice}
      stopLossTriggered={stopLossTriggered}
      onStopLossToggle={setStopLossEnabled}
      onStopLossChange={setStopLossPrice}
      avgEntry={activeAgg?.avgEntry ?? null}
      positionSide={activeAgg?.netSide ?? null}
      currentLTP={currentLTP}
      fokEnabled={fokEnabled}
      fokSeconds={fokSeconds}
      onFokToggle={setFokEnabled}
      onFokSecondsChange={setFokSeconds}
      unmatchedCount={unmatchedDisplayOrders.length}
    />
  );

  /* ─── Session notes panel ─── */
  const sessionNotesPanel = (
    <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-bold tracking-wider uppercase text-gray-600">NOTES</span>
      </div>
      <textarea
        value={sessionNotes}
        onChange={(e) => setSessionNotes(e.target.value)}
        placeholder="Trading notes..."
        className="w-full px-3 py-2 text-xs text-gray-700 resize-none focus:outline-none"
        rows={3}
      />
    </div>
  );

  /* ─── Trade Controls Strip ─── */
  const hasAnyPosition = (p1Agg && p1Agg.netSide !== "FLAT") || (p2Agg && p2Agg.netSide !== "FLAT");
  const isSuspended = marketBook?.status === "SUSPENDED";

  const tradeControlsStrip = (
    <div className="border border-gray-300 rounded-lg bg-white px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold tracking-wider uppercase text-gray-500">
          TRADE CONTROLS
        </span>
        {!hasAnyPosition && (
          <span className="text-[10px] text-gray-400 italic">
            Open a position to use hedge/liability tools
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {/* MARKET GREEN */}
        {(() => {
          if (!hasAnyPosition || !outcomePnl) {
            return (
              <button disabled className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-400 border border-emerald-200 cursor-not-allowed">
                MARKET GREEN
              </button>
            );
          }
          const mh = calculateMarketHedge(outcomePnl, p1LayPrice, p1BackPrice, p2LayPrice, p2BackPrice);
          const diff = Math.abs(outcomePnl.ifPlayer1Wins - outcomePnl.ifPlayer2Wins);
          const isGreened = diff < 0.02;
          const isFreeBet = !isGreened && (
            (outcomePnl.ifPlayer1Wins > 0.50 && outcomePnl.ifPlayer2Wins >= -0.50) ||
            (outcomePnl.ifPlayer2Wins > 0.50 && outcomePnl.ifPlayer1Wins >= -0.50)
          );

          if (isGreened) {
            return (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                GREENED +£{outcomePnl.ifPlayer1Wins.toFixed(2)}
              </span>
            );
          }
          if (!mh) {
            return (
              <span className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                HEDGE N/A
              </span>
            );
          }
          if (mh.hedgeStake < BETFAIR_MIN_STAKE) {
            return (
              <span className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                HEDGE &lt; £{BETFAIR_MIN_STAKE} MIN
              </span>
            );
          }
          if (isFreeBet) {
            return (
              <button
                onClick={() => handleMarketHedge(mh.hedgeRunner, mh.hedgeSide, mh.hedgePrice, mh.hedgeStake)}
                disabled={tradeLoading || isSuspended}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                LOCK +£{mh.equalized.toFixed(2)}
              </button>
            );
          }
          return (
            <button
              onClick={() => handleMarketHedge(mh.hedgeRunner, mh.hedgeSide, mh.hedgePrice, mh.hedgeStake)}
              disabled={tradeLoading || isSuspended}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                mh.equalized >= 0
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-200"
                  : "bg-red-500 hover:bg-red-600 text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {mh.equalized >= 0 ? "GREEN UP" : "HEDGE"} {mh.equalized >= 0 ? "+" : ""}£{mh.equalized.toFixed(2)}
            </button>
          );
        })()}

        <span className="w-px h-5 bg-gray-300 mx-1" />

        {/* LIABILITY REDUCTION BUTTONS */}
        {(() => {
          const activeAgg = (p1Agg && p1Agg.netSide !== "FLAT") ? p1Agg : (p2Agg && p2Agg.netSide !== "FLAT") ? p2Agg : null;
          const activeRunner: "player1" | "player2" = (p1Agg && p1Agg.netSide !== "FLAT") ? "player1" : "player2";
          const backPrice = activeRunner === "player1" ? p1BackPrice : p2BackPrice;
          const layPrice = activeRunner === "player1" ? p1LayPrice : p2LayPrice;

          const pcts = [25, 50, 75, 100] as const;

          return pcts.map((pct) => {
            const calc = activeAgg ? calculateLiabilityReduction(activeAgg, backPrice, layPrice, pct) : null;
            const canExecute = !!calc && !tradeLoading && !isSuspended;
            const label = pct === 100 ? "FREE BET" : `−${pct}%`;

            return (
              <button
                key={pct}
                onClick={async () => {
                  if (!calc) return;
                  await handleReduceLiability(activeRunner, calc.tradeSide, calc.tradePrice, calc.tradeStake);
                }}
                disabled={!canExecute}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  canExecute
                    ? pct === 100
                      ? "bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-500 shadow-sm shadow-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                    : pct === 100
                      ? "bg-emerald-100 text-emerald-400 border-emerald-200 cursor-not-allowed"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                }`}
              >
                {label}
              </button>
            );
          });
        })()}
      </div>
    </div>
  );

  /* ─── Ladder props ─── */
  const desktopTicks = 12;
  const mobileTicks = 8;

  /* ─── RENDER ─── */
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 pt-14 pb-4 xl:pb-14">
      {/* ─── Toast ─── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}>
          {toast.message}
          {/* Stop loss close button */}
          {stopLossTriggered && toast.type === "error" && (
            <button
              onClick={() => {
                // Execute green-up via market hedge
                if (outcomePnl) {
                  const mh = calculateMarketHedge(outcomePnl, p1LayPrice, p1BackPrice, p2LayPrice, p2BackPrice);
                  if (mh && mh.hedgeStake >= BETFAIR_MIN_STAKE) {
                    handleMarketHedge(mh.hedgeRunner, mh.hedgeSide, mh.hedgePrice, mh.hedgeStake);
                  }
                }
                setToast(null);
                setStopLossTriggered(false);
              }}
              className="ml-3 px-2 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700"
            >
              CLOSE NOW
            </button>
          )}
        </div>
      )}

      {/* ─── Tick Offset Confirmation Toast ─── */}
      {pendingTickOffset && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-amber-50 border border-amber-300 shadow-lg max-w-sm">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            Order matched — Place {pendingTickOffset.side} at {pendingTickOffset.price.toFixed(2)} for £{pendingTickOffset.stake.toFixed(0)}?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (!marketId) return;
                const result = await execAction({
                  actionName: "PLACE_TRADE", marketId,
                  selectionId: pendingTickOffset.selectionId,
                  side: pendingTickOffset.side,
                  price: pendingTickOffset.price,
                  size: pendingTickOffset.stake,
                });
                if (result.success) {
                  addLivePosition({
                    marketId, selectionId: pendingTickOffset.selectionId,
                    side: pendingTickOffset.side, price: pendingTickOffset.price,
                    size: pendingTickOffset.stake, betId: result.betId,
                  });
                }
                setPendingTickOffset(null);
              }}
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setPendingTickOffset(null)}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Market Search Overlay ─── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24" onClick={() => setSearchOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search markets by player name..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1 text-sm text-gray-900 focus:outline-none"
                />
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-mono text-gray-500">ESC</kbd>
              </div>
            </div>
            {/* Recent markets */}
            {searchQuery.length < 2 && recentMarkets.length > 0 && (
              <div className="p-2">
                <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 px-2 py-1">RECENT MARKETS</div>
                {recentMarkets.map((m) => (
                  <button
                    key={m.marketId}
                    onClick={() => {
                      const params = new URLSearchParams({
                        marketId: m.marketId, p1: m.p1, p2: m.p2,
                        p1Flag: m.p1Flag, p2Flag: m.p2Flag, tournament: m.tournament,
                      });
                      router.push(`/classic-trading?${params.toString()}`);
                      setSearchOpen(false);
                    }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs font-semibold text-gray-900">
                      {m.p1Flag} {m.p1.split(" ").pop()} vs {m.p2.split(" ").pop()} {m.p2Flag}
                    </div>
                    <div className="text-[10px] text-gray-500">{m.tournament}</div>
                  </button>
                ))}
              </div>
            )}
            {searchLoading && (
              <div className="p-4 text-center text-xs text-gray-400">Searching...</div>
            )}
            {searchQuery.length >= 2 && !searchLoading && searchResults.length > 0 && (
              <div className="p-2 max-h-64 overflow-y-auto">
                {searchResults.map((m: { marketId: string; eventId?: string; runner1: string; runner2: string; event: string }) => (
                  <button
                    key={m.marketId}
                    onClick={() => {
                      const params = new URLSearchParams({
                        marketId: m.marketId,
                        ...(m.eventId ? { eventId: m.eventId } : {}),
                        p1: m.runner1,
                        p2: m.runner2,
                        tournament: m.event,
                      });
                      router.push(`/classic-trading?${params.toString()}`);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs font-semibold text-gray-900">
                      {m.runner1.split(" ").pop()} vs {m.runner2.split(" ").pop()}
                    </div>
                    <div className="text-[10px] text-gray-500">{m.event}</div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                No live markets found — try the Markets page
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Trade Confirmation Modal ─── */}
      {pendingRealTrade && (
        <RealTradeConfirmModal
          side={pendingRealTrade.side}
          price={pendingRealTrade.price}
          stake={(pendingRealTrade.side === "LAY" && layInputMode === "liability")
            ? calculateLayStakeFromLiability(rawInputAmount, pendingRealTrade.price)
            : rawInputAmount}
          runner={pendingRealTrade.playerName}
          inputMode={pendingRealTrade.side === "LAY" ? layInputMode : undefined}
          inputAmount={pendingRealTrade.side === "LAY" && layInputMode === "liability" ? rawInputAmount : undefined}
          onConfirm={() => {
            executeConfirmedRealTrade(pendingRealTrade.selectionId, pendingRealTrade.price, pendingRealTrade.side);
            setPendingRealTrade(null);
          }}
          onCancel={() => setPendingRealTrade(null)}
        />
      )}

      {/* ─── Gap below global navbar ─── */}
      <div className="h-12" aria-hidden="true" />

      {/* ─── Header ─── */}
      <header className="border-b border-gray-200 bg-white sticky top-14 z-40 shadow-sm">
        {/* Row 1: Nav + match + status */}
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-x-3 gap-y-1 flex-wrap">
          {/* Left: navigation + match info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/markets"
              className="text-xs font-medium text-blue-600 hover:text-blue-800 shrink-0"
            >
              &larr; Markets
            </Link>

            {/* Recent markets dropdown */}
            {recentMarkets.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setRecentOpen(!recentOpen)}
                  className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Recent ▾
                </button>
                {recentOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setRecentOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 z-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px]">
                      {recentMarkets.filter((m) => m.marketId !== marketId).map((m) => (
                        <button
                          key={m.marketId}
                          onClick={() => {
                            const params = new URLSearchParams({
                              marketId: m.marketId, p1: m.p1, p2: m.p2,
                              p1Flag: m.p1Flag, p2Flag: m.p2Flag, tournament: m.tournament,
                            });
                            router.push(`/classic-trading?${params.toString()}`);
                            setRecentOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="text-xs font-semibold text-gray-900">
                            {m.p1Flag} {m.p1.split(" ").pop()} vs {m.p2.split(" ").pop()} {m.p2Flag}
                          </div>
                          <div className="text-[10px] text-gray-400">{m.tournament}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-xs text-gray-500 hidden sm:inline">{tournament}</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm font-bold text-gray-900 truncate">
              {p1Flag} {displayPlayers.player1.short}
              <span className="mx-1 text-gray-400">vs</span>
              {displayPlayers.player2.short} {p2Flag}
            </span>
          </div>

          {/* Right: Status + stream + view toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Search markets (Ctrl+K)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </button>

            {/* Market status badge */}
            {marketBook ? (
              <>
                {marketBook.status === "SUSPENDED" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 animate-pulse">SUSPENDED</span>
                ) : marketBook.status === "CLOSED" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-500">CLOSED</span>
                ) : marketBook.inplay ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">IN-PLAY</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">PRE-MATCH</span>
                )}
                <span className="text-gray-500 font-mono hidden md:inline">{formatVolume(marketBook.totalMatched)} matched</span>
              </>
            ) : (
              <span className="text-gray-400 text-[10px]">Connecting</span>
            )}
            {/* Stream indicator */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              streamStatus === "connected" ? "bg-green-500" :
              streamStatus === "connecting" ? "bg-amber-400 animate-pulse" :
              "bg-gray-400"
            }`} />
            {/* Session P&L */}
            <span className={`font-mono font-semibold text-[11px] ${sessionPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
              {sessionPnl >= 0 ? "+" : ""}£{sessionPnl.toFixed(2)}
            </span>
            <span className="text-gray-400 text-[10px] hidden lg:inline">{sessionTimeStr}</span>
            {/* View toggle */}
            <Link
              href={`/trading?${searchParams.toString()}`}
              className="px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-300 transition-all hidden sm:inline-block"
            >
              Legacy view
            </Link>
          </div>
        </div>

        {/* Row 2: Match state */}
        <ClassicMatchState
          player1Name={displayPlayers.player1.name}
          player2Name={displayPlayers.player2.name}
          sets={liveScore?.sets}
          gameScore={liveScore?.gameScore}
          server={liveScore?.server}
          tiebreak={liveScore?.tiebreak}
          tiebreakScore={liveScore?.tiebreakScore}
          breakPoint={liveScore?.breakPoint}
          setPoint={liveScore?.setPoint}
          matchPoint={liveScore?.matchPoint}
          isInPlay={!!marketBook?.inplay}
          isSuspended={marketBook?.status === "SUSPENDED"}
          scoreConfidence={liveScore?.scoreConfidence ?? "unavailable"}
          isScoreStale={isScoreStale}
          scoreAvailable={!!liveScore?.available}
          provider={liveScore?.provider}
        />

        {/* Row 3: Stake controls */}
        <div className="px-3 sm:px-4 py-1.5 border-t border-gray-100 flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">STAKE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Lay</span>
            <div className="flex rounded overflow-hidden border border-gray-300">
              <button
                onClick={() => { setLayInputMode("stake"); try { localStorage.setItem("layInputMode","stake"); } catch {} }}
                className={`px-2 py-0.5 text-[10px] font-medium transition-all ${
                  layInputMode === "stake" ? "bg-pink-100 text-pink-600" : "bg-white text-gray-400 hover:text-gray-600"
                }`}
              >Stake</button>
              <button
                onClick={() => { setLayInputMode("liability"); try { localStorage.setItem("layInputMode","liability"); } catch {} }}
                className={`px-2 py-0.5 text-[10px] font-medium transition-all ${
                  layInputMode === "liability" ? "bg-pink-100 text-pink-600" : "bg-white text-gray-400 hover:text-gray-600"
                }`}
              >Liability</button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {STAKES.map((stake) => (
              <button
                key={stake}
                onClick={() => { setSelectedStake(stake); setCustomStakeInput(""); }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold transition-all border ${
                  selectedStake === stake && !customStakeInput
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                £{stake}
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom"
              value={customStakeInput}
              onChange={(e) => { setCustomStakeInput(e.target.value); setSelectedStake(null); }}
              className={`w-16 sm:w-20 px-2 py-1 sm:py-1.5 rounded border text-[11px] sm:text-xs font-mono text-gray-700 bg-white focus:outline-none focus:ring-1 ${
                stakeBelowMin && customStakeInput
                  ? "border-amber-400 focus:ring-amber-400"
                  : "border-gray-300 focus:ring-blue-400"
              }`}
            />
          </div>
          {stakeBelowMin && customStakeInput && (
            <span className="text-[10px] text-amber-600 font-medium">
              Below Betfair £{BETFAIR_MIN_STAKE} min
            </span>
          )}
          {layInputMode === "liability" && (
            <span className="text-[9px] text-pink-500/70 font-mono">
              £{rawInputAmount} liability → £{effectiveStakeAtBestLay.toFixed(2)} stake @ {previewLayPrice.toFixed(2)}
            </span>
          )}
          <button
            onClick={() => {
              if (tradingMode === "safe") {
                setTradingMode("pro");
                try { localStorage.setItem("trading_mode", "pro"); } catch { /* SSR */ }
                setToast({ message: "Pro Mode — one-click trading", type: "success" });
                setTimeout(() => setToast(null), 3000);
              } else {
                setTradingMode("safe");
                try { localStorage.setItem("trading_mode", "safe"); } catch { /* SSR */ }
                setToast({ message: "Safe Mode — trades require confirmation", type: "success" });
                setTimeout(() => setToast(null), 3000);
              }
            }}
            className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-all border ${
              tradingMode === "safe"
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-red-50 text-red-600 border-red-200 animate-pulse"
            }`}
          >
            {tradingMode === "safe" ? "SAFE" : "PRO"}
          </button>
        </div>
      </header>

      {/* ─── Desktop layout: ladders dominant ─── */}
      {/* Wide desktop (≥1280px): 4-column with side panels */}
      <div className="hidden xl:block px-3 2xl:px-4 pt-4 pb-6">
        {/* Trade Controls Strip — above ladders */}
        <div className="max-w-[1800px] mx-auto mb-3 space-y-2">
          {tradeControlsStrip}
          {tradeToolsPanel}
        </div>
        <div className="flex gap-3 2xl:gap-4 max-w-[1800px] mx-auto">
          {/* AI Panel — narrow sidebar */}
          <div className="w-[200px] 2xl:w-[220px] shrink-0 min-w-0 overflow-hidden self-start space-y-3">
            {aiPanel}
            {sessionNotesPanel}
          </div>

          {/* Player 1 Ladder — dominant */}
          <div className="flex-1 min-w-0">
            <ClassicLadder
              runner={runner0}
              playerName={displayPlayers.player1.name}
              playerOdds={playerOdds.player1}
              isConnected={isConnected}
              isInPlay={!!marketBook?.inplay}
              unmatchedByPrice={unmatchedByPriceP1}
              onTrade={(price, side) => {
                if (runner0) handleTradeClick(runner0.selectionId, price, side, "player1");
              }}
              activeStake={activeStake}
              tradeLoading={tradeLoading}
              netPosition={p1Agg ? { side: p1Agg.netSide, stake: p1Agg.netStake, avgEntry: p1Agg.avgEntry } : null}
              unrealisedPnl={getUnrealizedPnl("player1")}
              pressure={p1Pressure}
              recenterTrigger={recenterTrigger}
              ticksEachSide={desktopTicks}
              stopLossPrice={stopLossEnabled && (p1Agg && p1Agg.netSide !== "FLAT") ? stopLossPrice : null}
            />
          </div>

          {/* Player 2 Ladder — dominant */}
          <div className="flex-1 min-w-0">
            <ClassicLadder
              runner={runner1}
              playerName={displayPlayers.player2.name}
              playerOdds={playerOdds.player2}
              isConnected={isConnected}
              isInPlay={!!marketBook?.inplay}
              unmatchedByPrice={unmatchedByPriceP2}
              onTrade={(price, side) => {
                if (runner1) handleTradeClick(runner1.selectionId, price, side, "player2");
              }}
              activeStake={activeStake}
              tradeLoading={tradeLoading}
              netPosition={p2Agg ? { side: p2Agg.netSide, stake: p2Agg.netStake, avgEntry: p2Agg.avgEntry } : null}
              unrealisedPnl={getUnrealizedPnl("player2")}
              pressure={p2Pressure}
              recenterTrigger={recenterTrigger}
              ticksEachSide={desktopTicks}
              stopLossPrice={stopLossEnabled && (p2Agg && p2Agg.netSide !== "FLAT") ? stopLossPrice : null}
            />
          </div>

          {/* Positions + Trust Panel — narrow sidebar */}
          <div className="w-[260px] 2xl:w-[280px] shrink-0 min-w-0 overflow-hidden self-start space-y-3">
            {positionPanel}
            {trustPanel}
          </div>
        </div>
      </div>

      {/* Mid desktop (1024-1279px): ladders top, panels below */}
      <div className="hidden lg:block xl:hidden px-4 pt-4 pb-6">
        {/* Trade Controls Strip */}
        <div className="mb-3 space-y-2">
          {tradeControlsStrip}
          {tradeToolsPanel}
        </div>
        {/* Ladders row — full width, side by side */}
        <div className="grid grid-cols-2 gap-3 mx-auto">
          <ClassicLadder
            runner={runner0}
            playerName={displayPlayers.player1.name}
            playerOdds={playerOdds.player1}
            isConnected={isConnected}
            isInPlay={!!marketBook?.inplay}
            unmatchedByPrice={unmatchedByPriceP1}
            onTrade={(price, side) => {
              if (runner0) handleTradeClick(runner0.selectionId, price, side, "player1");
            }}
            activeStake={activeStake}
            tradeLoading={tradeLoading}
            netPosition={p1Agg ? { side: p1Agg.netSide, stake: p1Agg.netStake, avgEntry: p1Agg.avgEntry } : null}
            unrealisedPnl={getUnrealizedPnl("player1")}
            pressure={p1Pressure}
            recenterTrigger={recenterTrigger}
            ticksEachSide={desktopTicks}
            stopLossPrice={stopLossEnabled && (p1Agg && p1Agg.netSide !== "FLAT") ? stopLossPrice : null}
          />
          <ClassicLadder
            runner={runner1}
            playerName={displayPlayers.player2.name}
            playerOdds={playerOdds.player2}
            isConnected={isConnected}
            isInPlay={!!marketBook?.inplay}
            unmatchedByPrice={unmatchedByPriceP2}
            onTrade={(price, side) => {
              if (runner1) handleTradeClick(runner1.selectionId, price, side, "player2");
            }}
            activeStake={activeStake}
            tradeLoading={tradeLoading}
            netPosition={p2Agg ? { side: p2Agg.netSide, stake: p2Agg.netStake, avgEntry: p2Agg.avgEntry } : null}
            unrealisedPnl={getUnrealizedPnl("player2")}
            pressure={p2Pressure}
            recenterTrigger={recenterTrigger}
            ticksEachSide={desktopTicks}
            stopLossPrice={stopLossEnabled && (p2Agg && p2Agg.netSide !== "FLAT") ? stopLossPrice : null}
          />
        </div>
        {/* AI + Positions + Trust row below ladders */}
        <div className="grid grid-cols-3 gap-3 mx-auto mt-4">
          <div className="space-y-3">{aiPanel}{sessionNotesPanel}</div>
          <div>{positionPanel}</div>
          <div>{trustPanel}</div>
        </div>
      </div>

      {/* ─── Tablet/Mobile layout (<1024px) ─── */}
      <div className="lg:hidden">
        {/* Tab bar — not sticky (header already is) */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex">
            {[
              { id: "ladders" as const, label: "Ladders" },
              { id: "positions" as const, label: "Positions" },
              { id: "ai" as const, label: "AI" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-all border-b-2 ${
                  activeTab === tab.id
                    ? "text-blue-600 border-blue-500 bg-blue-50/50"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-2 sm:px-3 pt-4 pb-4">
          {activeTab === "ladders" && (
            <div className="max-w-[700px] mx-auto space-y-3">
              {tradeControlsStrip}
              {tradeToolsPanel}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <ClassicLadder
                runner={runner0}
                playerName={displayPlayers.player1.name}
                playerOdds={playerOdds.player1}
                isConnected={isConnected}
                isInPlay={!!marketBook?.inplay}
                unmatchedByPrice={unmatchedByPriceP1}
                onTrade={(price, side) => {
                  if (runner0) handleTradeClick(runner0.selectionId, price, side, "player1");
                }}
                activeStake={activeStake}
                tradeLoading={tradeLoading}
                netPosition={p1Agg ? { side: p1Agg.netSide, stake: p1Agg.netStake, avgEntry: p1Agg.avgEntry } : null}
                unrealisedPnl={getUnrealizedPnl("player1")}
                pressure={p1Pressure}
                recenterTrigger={recenterTrigger}
                ticksEachSide={mobileTicks}
                stopLossPrice={stopLossEnabled && (p1Agg && p1Agg.netSide !== "FLAT") ? stopLossPrice : null}
              />
              <ClassicLadder
                runner={runner1}
                playerName={displayPlayers.player2.name}
                playerOdds={playerOdds.player2}
                isConnected={isConnected}
                isInPlay={!!marketBook?.inplay}
                unmatchedByPrice={unmatchedByPriceP2}
                onTrade={(price, side) => {
                  if (runner1) handleTradeClick(runner1.selectionId, price, side, "player2");
                }}
                activeStake={activeStake}
                tradeLoading={tradeLoading}
                netPosition={p2Agg ? { side: p2Agg.netSide, stake: p2Agg.netStake, avgEntry: p2Agg.avgEntry } : null}
                unrealisedPnl={getUnrealizedPnl("player2")}
                pressure={p2Pressure}
                recenterTrigger={recenterTrigger}
                ticksEachSide={mobileTicks}
                stopLossPrice={stopLossEnabled && (p2Agg && p2Agg.netSide !== "FLAT") ? stopLossPrice : null}
              />
              </div>
            </div>
          )}
          {activeTab === "positions" && <div className="max-w-[600px] mx-auto space-y-3">{positionPanel}{trustPanel}</div>}
          {activeTab === "ai" && <div className="max-w-[600px] mx-auto space-y-3">{aiPanel}{sessionNotesPanel}</div>}
        </div>
      </div>

      {/* ─── Keyboard Shortcuts Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 hidden xl:block border-t border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-center gap-4 text-[10px] text-gray-500">
          <span className="font-semibold text-gray-600">Shortcuts</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">B</kbd><span>Back</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">L</kbd><span>Lay</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">G</kbd><span>Green</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">C</kbd><span>Cancel</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">R</kbd><span>Recenter</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">1-5</kbd><span>Stake</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">⌘K</kbd><span>Search</span>
        </div>
      </div>
    </main>
  );
}
