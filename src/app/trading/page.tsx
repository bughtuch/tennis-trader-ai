"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore, type PriceSize, type PendingOrder } from "@/lib/store";
import { calculateGreenUp, moveByTicks, roundToTick } from "@/lib/tradingMaths";
import { createClient } from "@/lib/supabase";
import { useBetfairToken } from "@/hooks/useBetfairToken";
import { useBetfairStream } from "@/hooks/useBetfairStream";
import RiskRewardPanel from "@/components/RiskRewardPanel";
import ServeHoldStats from "@/components/ServeHoldStats";
import SetWinningPrice from "@/components/SetWinningPrice";


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

interface LadderRow {
  price: number;
  backSize: number;
  laySize: number;
  isLastTraded: boolean;
  isBestBack: boolean;
  isBestLay: boolean;
}

interface LiveScore {
  available: boolean;
  sets?: number[][];
  gameScore?: string[];
  server?: 1 | 2;
  matchStatus?: string;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  tiebreakScore?: string[];
}

const STAKES = [5, 10, 25, 50, 100];

/* ─── Helpers ─── */

function formatVolume(v: number) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
  return `£${Math.round(v)}`;
}

function MarketCountdown({ startTime }: { startTime: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    function update() {
      const diff = new Date(startTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Starting..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span>{remaining}</span>;
}

function PendingOrderCountdown({ order, onExpire }: { order: PendingOrder; onExpire: (id: string) => void }) {
  const [remaining, setRemaining] = useState(order.delaySeconds);
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          onExpire(order.id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [order.id, order.delaySeconds, onExpire]);

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          order.side === "BACK" ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
        }`}>{order.side}</span>
        <span className="text-xs text-gray-300 font-mono">
          £{order.size} @ {order.price.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-1000"
            style={{ width: `${(remaining / order.delaySeconds) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-amber-400 font-mono font-semibold w-5 text-right">{remaining}s</span>
      </div>
    </div>
  );
}

/* ─── Breakpoints: mobile <768  |  tablet 768-1919  |  desktop 1920+ ─── */

export default function TradingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      }
    >
      <TradingPage />
    </Suspense>
  );
}

function TradingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const marketId = searchParams.get("marketId");
  const p1Name = searchParams.get("p1");
  const p2Name = searchParams.get("p2");
  const p1Flag = searchParams.get("p1Flag") ?? "";
  const p2Flag = searchParams.get("p2Flag") ?? "";
  const tournament = searchParams.get("tournament") ?? "Tennis";

  /* ─── Restore last market from localStorage if no URL params ─── */
  const [noMarket, setNoMarket] = useState(false);
  useEffect(() => {
    if (!marketId) {
      try {
        const saved = localStorage.getItem("lastMarket");
        if (saved) {
          const m = JSON.parse(saved);
          const params = new URLSearchParams();
          if (m.marketId) params.set("marketId", m.marketId);
          if (m.p1) params.set("p1", m.p1);
          if (m.p2) params.set("p2", m.p2);
          if (m.p1Flag) params.set("p1Flag", m.p1Flag);
          if (m.p2Flag) params.set("p2Flag", m.p2Flag);
          if (m.tournament) params.set("tournament", m.tournament);
          router.replace(`/trading?${params.toString()}`);
          return;
        }
      } catch { /* invalid JSON or SSR */ }
      setNoMarket(true);
    }
  }, [marketId, router]);

  /* ─── Save market to localStorage when market data is present ─── */
  useEffect(() => {
    if (marketId && p1Name && p2Name) {
      try {
        localStorage.setItem(
          "lastMarket",
          JSON.stringify({ marketId, p1: p1Name, p2: p2Name, p1Flag, p2Flag, tournament })
        );
      } catch { /* SSR guard */ }
    }
  }, [marketId, p1Name, p2Name, p1Flag, p2Flag, tournament]);

  const [selectedStake, setSelectedStake] = useState<number | null>(25);
  const [customStakeInput, setCustomStakeInput] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<"player1" | "player2">("player1");
  const [activeTab, setActiveTab] = useState<"ladder" | "ai" | "positions">("ladder");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Shadow Mode ─── */
  const [isShadowMode, setIsShadowMode] = useState(false);

  /* ─── Streak Protection Settings ─── */
  const [streakProtectionEnabled, setStreakProtectionEnabled] = useState(true);
  const [streakThreshold, setStreakThreshold] = useState(3);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState("");
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);

  useEffect(() => {
    async function loadProfileSettings() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("shadow_mode, streak_protection_enabled, streak_threshold")
        .eq("id", user.id)
        .single();
      if (data) {
        setIsShadowMode(data.shadow_mode ?? true);
        setStreakProtectionEnabled(data.streak_protection_enabled ?? true);
        setStreakThreshold(data.streak_threshold ?? 3);
      }
    }
    loadProfileSettings();
    // Restore cooldown from sessionStorage
    try {
      const saved = sessionStorage.getItem("streakCooldownUntil");
      if (saved) {
        const ts = Number(saved);
        if (ts > Date.now()) setCooldownUntil(ts);
        else sessionStorage.removeItem("streakCooldownUntil");
      }
    } catch { /* SSR guard */ }
  }, []);

  // Resolve active stake: custom input takes priority over quick buttons
  const activeStake = customStakeInput
    ? Math.max(2, Number(customStakeInput) || 0)
    : selectedStake ?? 25;

  /* ─── Session timer state ─── */
  const [sessionStart] = useState(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);

  /* AI Signals state */
  const [aiSignal, setAiSignal] = useState<{
    type: string;
    confidence: number;
    edgeSize: string;
    analysis: string;
    model: string;
    timestamp: string;
  } | null>(null);
  const [aiSignalLoading, setAiSignalLoading] = useState(false);
  const [aiSignalHistory, setAiSignalHistory] = useState<
    Array<{
      type: string;
      confidence: number;
      edgeSize: string;
      analysis: string;
      timestamp: string;
    }>
  >([]);
  const [signalType, setSignalType] = useState<"pre_match" | "in_play" | "edge_alert">("in_play");

  /* Pre-Match Briefing state */
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingCached, setBriefingCached] = useState(false);

  /* AI Guardian state */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [guardianData, setGuardianData] = useState<any>(null);
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianExecuting, setGuardianExecuting] = useState(false);

  /* Supabase trades state */
  const [openPositions, setOpenPositions] = useState<SupabaseTrade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<SupabaseTrade[]>([]);

  const fetchTrades = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: open } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .eq("is_shadow", isShadowMode)
      .order("created_at", { ascending: false });
    if (open) setOpenPositions(open);

    const { data: closed } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "closed")
      .eq("is_shadow", isShadowMode)
      .order("closed_at", { ascending: false })
      .limit(20);
    if (closed) setTradeHistory(closed);
  }, [isShadowMode]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  /* ─── AI Coach: fetch insight for a closed trade ─── */
  const [coachInsights, setCoachInsights] = useState<Record<string, string>>({});
  const [fadingInsightId, setFadingInsightId] = useState<string | null>(null);

  async function fetchCoachInsight(trade: {
    id: string;
    side: string | null;
    entry_price: number | null;
    exit_price: number | null;
    stake: number | null;
    pnl: number | null;
    player: string | null;
    greened_up: boolean;
  }) {
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: trade.side,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          stake: trade.stake,
          pnl: trade.pnl,
          player: trade.player ?? "Unknown",
          greened_up: trade.greened_up,
        }),
      });
      const data = await res.json();
      if (data.success && data.insight) {
        setCoachInsights((prev) => ({ ...prev, [trade.id]: data.insight }));
        setFadingInsightId(trade.id);
        // Save to Supabase
        const supabase = createClient();
        await supabase
          .from("trades")
          .update({ coach_insight: data.insight })
          .eq("id", trade.id);
        // Re-fetch so tradeHistory has the insight
        fetchTrades();
      }
    } catch { /* non-critical */ }
  }

  async function closeTradeAsGreenUp(tradeId: string, exitPrice: number, pnl: number) {
    const supabase = createClient();
    // Find the trade data before closing (for coach context)
    const trade = openPositions.find((p) => p.id === tradeId);
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
    fetchTrades();
    // Fire coach insight in background
    if (trade) {
      fetchCoachInsight({
        id: tradeId,
        side: trade.side,
        entry_price: trade.entry_price,
        exit_price: exitPrice,
        stake: trade.stake,
        pnl,
        player: trade.player,
        greened_up: true,
      });
    }
  }

  /* ─── Compute consecutive losses (most recent first) ─── */
  const consecutiveLosses = useMemo(() => {
    let count = 0;
    for (const t of tradeHistory) {
      if ((t.pnl ?? 0) < 0) count++;
      else break;
    }
    return count;
  }, [tradeHistory]);

  /* ─── Compute current streak (wins or losses) for display ─── */
  const currentStreak = useMemo(() => {
    if (tradeHistory.length === 0) return { count: 0, type: "none" as const };
    const first = tradeHistory[0];
    const firstIsWin = (first.pnl ?? 0) > 0;
    const firstIsLoss = (first.pnl ?? 0) < 0;
    if (!firstIsWin && !firstIsLoss) return { count: 0, type: "none" as const };
    let count = 0;
    for (const t of tradeHistory) {
      const isWin = (t.pnl ?? 0) > 0;
      const isLoss = (t.pnl ?? 0) < 0;
      if (firstIsWin && isWin) count++;
      else if (firstIsLoss && isLoss) count++;
      else break;
    }
    return { count, type: firstIsWin ? "win" as const : "loss" as const };
  }, [tradeHistory]);

  /* ─── Auto-trigger cooldown at threshold+2 ─── */
  const cooldownActive = cooldownUntil !== null && Date.now() < cooldownUntil;
  useEffect(() => {
    if (!streakProtectionEnabled) return;
    if (consecutiveLosses >= streakThreshold + 2 && !cooldownActive) {
      const until = Date.now() + 10 * 60 * 1000; // 10 minutes
      setCooldownUntil(until);
      try { sessionStorage.setItem("streakCooldownUntil", String(until)); } catch { /* SSR guard */ }
    }
  }, [consecutiveLosses, streakThreshold, streakProtectionEnabled, cooldownActive]);

  /* ─── Cooldown countdown timer ─── */
  useEffect(() => {
    if (!cooldownUntil) return;
    function tick() {
      const ms = cooldownUntil! - Date.now();
      if (ms <= 0) {
        setCooldownUntil(null);
        setCooldownRemaining("");
        try { sessionStorage.removeItem("streakCooldownUntil"); } catch { /* SSR guard */ }
        return;
      }
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setCooldownRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const {
    marketBook,
    fetchMarketBook,
    placeTrade,
    placeShadowTrade,
    tradeLoading,
    tradeError,
    lastTradeSuccess,
    clearTradeMessages,
    unmatchedOrders,
    fetchUnmatchedOrders,
    cancelOrder,
    pendingOrders,
    addPendingOrder,
    removePendingOrder,
  } = useAppStore();

  /* ─── Betfair connection: read from shared hook ─── */
  const { isConnected: betfairHookConnected } = useBetfairToken();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (betfairHookConnected) {
      setIsConnected(true);
      useAppStore.setState({ isConnected: true });
    }
  }, [betfairHookConnected]);

  const isLive = isConnected && !!marketId && !!marketBook;

  /* ─── Betfair Streaming (real-time prices via SSE) ─── */
  const { streamStatus, isStreaming, suspensionDetected, clearSuspension } = useBetfairStream(
    isConnected ? marketId : null,
  );

  /* ─── Fetch live prices on 2-second interval (fallback when not streaming) ─── */
  const fetchPrices = useCallback(() => {
    if (isConnected && marketId) {
      fetchMarketBook([marketId]);
    }
  }, [isConnected, marketId, fetchMarketBook]);

  useEffect(() => {
    if (isStreaming) {
      // Streaming is active — skip polling
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrices, isStreaming]);

  /* ─── Poll unmatched orders every 3 seconds (offset from price poll) ─── */
  const unmatchedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isConnected || !marketId) return;
    const timer = setTimeout(() => {
      fetchUnmatchedOrders(marketId);
      unmatchedIntervalRef.current = setInterval(() => {
        fetchUnmatchedOrders(marketId);
      }, 3000);
    }, 1500);
    return () => {
      clearTimeout(timer);
      if (unmatchedIntervalRef.current) clearInterval(unmatchedIntervalRef.current);
    };
  }, [isConnected, marketId, fetchUnmatchedOrders]);

  /* ─── Show toast on trade success/error ─── */
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
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastTradeSuccess, tradeError, clearTradeMessages, fetchTrades]);

  /* ─── Build ladder from live data only ─── */
  const selectedRunner = isLive ? marketBook.runners?.[selectedPlayer === "player1" ? 0 : 1] : null;

  let liveLadder: LadderRow[] | null = null;
  let livePlayerOdds = { player1: 0, player2: 0 };

  if (isLive && marketBook.runners) {
    const r0 = marketBook.runners[0];
    const r1 = marketBook.runners[1];
    const bestBack0 = r0?.ex?.availableToBack?.[0]?.price ?? 0;
    const bestBack1 = r1?.ex?.availableToBack?.[0]?.price ?? 0;
    livePlayerOdds = { player1: bestBack0, player2: bestBack1 };

    if (selectedRunner?.ex) {
      // Index all available back/lay volume by price
      const backMap = new Map<number, number>();
      const layMap = new Map<number, number>();
      const backs = selectedRunner.ex.availableToBack ?? [];
      const lays = selectedRunner.ex.availableToLay ?? [];

      backs.forEach((ps: PriceSize) => {
        backMap.set(ps.price, (backMap.get(ps.price) ?? 0) + ps.size);
      });
      lays.forEach((ps: PriceSize) => {
        layMap.set(ps.price, (layMap.get(ps.price) ?? 0) + ps.size);
      });

      const bestBackPrice = backs[0]?.price ?? 0;
      const bestLayPrice = lays[0]?.price ?? 0;
      const lastTradedPrice = (selectedRunner as { lastTradedPrice?: number }).lastTradedPrice ?? 0;

      // Center the ladder on the midpoint between best back and best lay
      const centerPrice = roundToTick(
        bestBackPrice && bestLayPrice
          ? (bestBackPrice + bestLayPrice) / 2
          : bestBackPrice || bestLayPrice || 2.0,
      );

      // Generate a continuous tick range: 8 ticks below center, center, 8 ticks above
      // This gives 17+ rows. Any Betfair data outside this range extends it further.
      const TICKS_EACH_SIDE = 8;
      const ladderLow = moveByTicks(centerPrice, -TICKS_EACH_SIDE);
      const ladderHigh = moveByTicks(centerPrice, TICKS_EACH_SIDE);

      // Also include every price that has volume (extends range if needed)
      const allDataPrices = new Set([...backMap.keys(), ...layMap.keys()]);
      const absoluteLow = Math.min(ladderLow, ...(allDataPrices.size > 0 ? allDataPrices : [ladderLow]));
      const absoluteHigh = Math.max(ladderHigh, ...(allDataPrices.size > 0 ? allDataPrices : [ladderHigh]));

      // Walk every tick from absoluteLow to absoluteHigh
      const rows: LadderRow[] = [];
      let tick = roundToTick(absoluteLow);
      while (tick <= absoluteHigh) {
        rows.push({
          price: tick,
          backSize: Math.round(backMap.get(tick) ?? 0),
          laySize: Math.round(layMap.get(tick) ?? 0),
          isLastTraded: lastTradedPrice > 0
            ? tick === roundToTick(lastTradedPrice)
            : tick === bestBackPrice,
          isBestBack: tick === bestBackPrice,
          isBestLay: tick === bestLayPrice,
        });
        const next = moveByTicks(tick, 1);
        if (next <= tick) break; // safety
        tick = next;
      }

      liveLadder = rows;
    }
  }

  const ladderData = liveLadder;

  const displayPlayers = {
    player1: {
      name: p1Name ?? "Player 1",
      short: p1Name?.split(" ").pop() ?? "P1",
      odds: livePlayerOdds.player1,
      flag: p1Flag,
    },
    player2: {
      name: p2Name ?? "Player 2",
      short: p2Name?.split(" ").pop() ?? "P2",
      odds: livePlayerOdds.player2,
      flag: p2Flag,
    },
  };

  /* ─── Unrealized P&L per player (from open positions) ─── */
  function getUnrealizedPnl(playerKey: "player1" | "player2"): number | null {
    const playerName = displayPlayers[playerKey].name;
    const playerPositions = openPositions.filter((p) => p.player === playerName);
    if (playerPositions.length === 0) return null;
    const currentOddsForPlayer = displayPlayers[playerKey].odds;
    if (!currentOddsForPlayer || currentOddsForPlayer <= 0) return null;
    let total = 0;
    for (const pos of playerPositions) {
      if (!pos.entry_price || !pos.stake) continue;
      if (pos.side === "BACK") {
        const greenStake = (pos.stake * pos.entry_price) / currentOddsForPlayer;
        total += (greenStake - pos.stake);
      } else {
        const greenStake = (pos.stake * pos.entry_price) / currentOddsForPlayer;
        total += (pos.stake - greenStake);
      }
    }
    return Math.round(total * 100) / 100;
  }

  /* ─── Selected runner positions & aggregated position (Feature 2) ─── */
  const selectedRunnerPositions = openPositions.filter((p) => {
    if (!selectedRunner) return false;
    return p.selection_id === String(selectedRunner.selectionId);
  });

  function getAggregatedPosition() {
    if (selectedRunnerPositions.length === 0) return null;
    let backTotal = 0, backWeighted = 0, layTotal = 0, layWeighted = 0;
    for (const pos of selectedRunnerPositions) {
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
    return {
      netSide,
      netStake: Math.abs(netStake),
      avgEntry,
      count: selectedRunnerPositions.length,
      backTotal: Math.round(backTotal * 100) / 100,
      layTotal: Math.round(layTotal * 100) / 100,
    };
  }
  const aggregatedPos = getAggregatedPosition();

  /* ─── P&L per runner outcome (Feature 5) ─── */
  function getOutcomePnl() {
    if (openPositions.length === 0) return null;
    const r0Id = marketBook?.runners?.[0]?.selectionId;
    const r1Id = marketBook?.runners?.[1]?.selectionId;
    if (!r0Id || !r1Id) return null;
    let ifP1Wins = 0, ifP2Wins = 0;
    for (const pos of openPositions) {
      if (!pos.stake || !pos.entry_price || !pos.selection_id) continue;
      const selId = Number(pos.selection_id);
      const stake = pos.stake;
      const price = pos.entry_price;
      if (pos.side === "BACK") {
        // BACK wins: +stake*(price-1), loses: -stake
        if (selId === r0Id) {
          ifP1Wins += stake * (price - 1);
          ifP2Wins -= stake;
        } else if (selId === r1Id) {
          ifP1Wins -= stake;
          ifP2Wins += stake * (price - 1);
        }
      } else {
        // LAY wins: -stake*(price-1), loses: +stake
        if (selId === r0Id) {
          ifP1Wins -= stake * (price - 1);
          ifP2Wins += stake;
        } else if (selId === r1Id) {
          ifP1Wins += stake;
          ifP2Wins -= stake * (price - 1);
        }
      }
    }
    return {
      ifPlayer1Wins: Math.round(ifP1Wins * 100) / 100,
      ifPlayer2Wins: Math.round(ifP2Wins * 100) / 100,
    };
  }
  const outcomePnl = getOutcomePnl();

  /* ─── Unmatched orders by price for ladder overlay (Feature 3) ─── */
  const unmatchedByPrice = new Map<number, { backSize: number; laySize: number }>();
  for (const order of unmatchedOrders) {
    if (!selectedRunner || order.selectionId !== selectedRunner.selectionId) continue;
    const entry = unmatchedByPrice.get(order.price) ?? { backSize: 0, laySize: 0 };
    if (order.side === "BACK") entry.backSize += order.sizeRemaining as number;
    else entry.laySize += order.sizeRemaining as number;
    unmatchedByPrice.set(order.price, entry);
  }

  /* ─── Handle trade click ─── */
  async function handleTradeClick(price: number, side: "BACK" | "LAY") {
    if (!marketId || !selectedRunner) return;

    // Streak protection cooldown block
    if (cooldownUntil && Date.now() < cooldownUntil) {
      setToast({ message: "Trading paused — cooldown active", type: "error" });
      return;
    }

    if (isShadowMode) {
      const playerName = displayPlayers[selectedPlayer].name;
      await placeShadowTrade({
        marketId,
        selectionId: selectedRunner.selectionId,
        side,
        price,
        size: activeStake,
        player: playerName,
      });
      fetchTrades();
      return;
    }

    if (!isConnected) return;
    // Add pending order indicator for in-play bet delay
    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side, price, size: activeStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    await placeTrade({
      marketId,
      selectionId: selectedRunner.selectionId,
      side,
      price,
      size: activeStake,
    });
  }

  /* ─── Live Scores ─── */
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);

  useEffect(() => {
    if (!p1Name || !p2Name) return;

    async function fetchScore() {
      try {
        const res = await fetch("/api/tennis-scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player1: p1Name, player2: p2Name }),
        });
        const data: LiveScore = await res.json();
        setLiveScore(data.available ? data : null);
      } catch {
        setLiveScore(null);
      }
    }

    fetchScore();
    const id = setInterval(fetchScore, 15_000);
    return () => clearInterval(id);
  }, [p1Name, p2Name]);

  /* ─── Suspension-triggered instant score refresh ─── */
  useEffect(() => {
    if (!suspensionDetected || !p1Name || !p2Name) return;
    clearSuspension();
    (async () => {
      try {
        const res = await fetch("/api/tennis-scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player1: p1Name, player2: p2Name }),
        });
        const data: LiveScore = await res.json();
        setLiveScore(data.available ? data : null);
      } catch {
        /* non-critical */
      }
    })();
  }, [suspensionDetected, clearSuspension, p1Name, p2Name]);

  /* ─── Pre-Match Briefing: auto-fetch on market open ─── */
  useEffect(() => {
    if (!marketId || !p1Name || !p2Name) return;
    let cancelled = false;
    async function loadBriefing() {
      setBriefingLoading(true);
      try {
        const res = await fetch("/api/ai/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market_id: marketId,
            player1: p1Name,
            player2: p2Name,
            tournament,
            surface: "Hard",
            odds1: livePlayerOdds.player1 || 2.0,
            odds2: livePlayerOdds.player2 || 2.0,
          }),
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setBriefing(data.briefing);
          setBriefingCached(data.cached ?? false);
        }
      } catch { /* non-critical */ }
      if (!cancelled) setBriefingLoading(false);
    }
    loadBriefing();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, p1Name, p2Name]);

  /* ─── AI Signals fetch ─── */
  async function fetchAiSignal() {
    setAiSignalLoading(true);
    try {
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
            surface: "Hard",
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.signal) {
        setAiSignal(data.signal);
        setAiSignalHistory((prev) => [data.signal, ...prev].slice(0, 5));
      }
    } catch {
      /* network error */
    } finally {
      setAiSignalLoading(false);
    }
  }

  /* ─── AI Guardian fetch ─── */
  async function fetchGuardianAssessment() {
    setGuardianLoading(true);
    try {
      const bestBack = displayPlayers[selectedPlayer].odds;
      const bestLay =
        isLive && selectedRunner?.ex?.availableToLay?.[0]?.price
          ? selectedRunner.ex.availableToLay[0].price
          : bestBack + 0.02;

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
            player: displayPlayers[selectedPlayer].name,
            surface: "Hard",
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGuardianData(data);
      }
    } catch {
      /* network error */
    } finally {
      setGuardianLoading(false);
    }
  }

  async function executeGuardianOption(option: { hedgeSide: string; hedgePrice: number; hedgeStake: number }) {
    if (!marketId || !selectedRunner) return;
    setGuardianExecuting(true);
    try {
      const res = await fetch("/api/ai-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "executeOption",
          marketId,
          selectionId: selectedRunner.selectionId,
          hedgeSide: option.hedgeSide,
          hedgePrice: option.hedgePrice,
          hedgeStake: option.hedgeStake,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          message: `Hedge placed: ${option.hedgeSide} £${option.hedgeStake} @ ${option.hedgePrice}`,
          type: "success",
        });
        setGuardianData(null);
      } else {
        setToast({ message: data.error ?? "Failed to execute", type: "error" });
      }
    } catch {
      setToast({ message: "Network error executing hedge", type: "error" });
    } finally {
      setGuardianExecuting(false);
    }
  }

  /* ─── WOM calculation from real ladder data ─── */
  let womBack = 50;
  if (isLive && selectedRunner?.ex) {
    const totalBack = (selectedRunner.ex.availableToBack ?? []).reduce(
      (s: number, p: PriceSize) => s + p.size,
      0
    );
    const totalLay = (selectedRunner.ex.availableToLay ?? []).reduce(
      (s: number, p: PriceSize) => s + p.size,
      0
    );
    const total = totalBack + totalLay;
    womBack = total > 0 ? Math.round((totalBack / total) * 100) : 50;
  }

  /* ─── Session timer tick ─── */
  useEffect(() => {
    const id = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  /* ─── Computed: best back/lay prices ─── */
  const currentBackPrice =
    isLive && selectedRunner?.ex?.availableToBack?.[0]?.price
      ? selectedRunner.ex.availableToBack[0].price
      : ladderData?.find((r: LadderRow) => r.isBestBack)?.price ?? 0;
  const currentLayPrice =
    isLive && selectedRunner?.ex?.availableToLay?.[0]?.price
      ? selectedRunner.ex.availableToLay[0].price
      : ladderData?.find((r: LadderRow) => r.isBestLay)?.price ?? 0;
  const greenUpResult = aggregatedPos && aggregatedPos.netSide !== "FLAT" && aggregatedPos.avgEntry > 0
    ? calculateGreenUp(
        aggregatedPos.avgEntry,
        aggregatedPos.netStake,
        aggregatedPos.netSide as "BACK" | "LAY",
        currentLayPrice > 0 ? currentLayPrice : aggregatedPos.avgEntry
      )
    : null;

  /* ─── Computed: session P&L from real closed trades ─── */
  const sessionPnl = tradeHistory.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winCount = tradeHistory.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = tradeHistory.length > 0 ? Math.round((winCount / tradeHistory.length) * 100) : 0;
  const bestTrade = tradeHistory.length > 0 ? Math.max(...tradeHistory.map((t) => t.pnl ?? 0)) : 0;
  const worstTrade = tradeHistory.length > 0 ? Math.min(...tradeHistory.map((t) => t.pnl ?? 0)) : 0;

  /* ─── Computed: session display strings ─── */
  const sessionMinutes = Math.floor(sessionElapsed / 60);
  const sessionSeconds = sessionElapsed % 60;
  const sessionTimeStr = `${sessionMinutes}m ${sessionSeconds.toString().padStart(2, "0")}s`;
  const sessionRate =
    sessionMinutes > 0 ? (sessionPnl / (sessionElapsed / 3600)).toFixed(2) : "--";

  /* ─── Computed: max size for depth bars ─── */
  const maxSize = ladderData
    ? Math.max(...ladderData.map((r) => Math.max(r.backSize, r.laySize)), 1)
    : 1;

  /* ─── Keyboard shortcuts ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateRef = useRef<any>(null);
  stateRef.current = {
    activeStake,
    selectedPlayer,
    isLive,
    marketId,
    selectedRunner,
    ladderData,
    placeTrade,
    placeShadowTrade,
    isShadowMode,
    displayPlayers,
    setToast,
    setSelectedStake,
    setCustomStakeInput,
    greenUpResult,
    currentLayPrice,
    openPositions,
    closeTradeAsGreenUp,
    cancelOrder,
    unmatchedOrders,
    marketBook,
    addPendingOrder,
    fetchTrades,
    cooldownUntil,
    fetchCoachInsight,
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = stateRef.current;
      if (!s.ladderData) return;
      const bestBack = s.ladderData.find((r: LadderRow) => r.isBestBack);
      const bestLay = s.ladderData.find((r: LadderRow) => r.isBestLay);

      switch (e.key.toLowerCase()) {
        case "b":
          if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
            s.setToast({ message: "Trading paused — cooldown active", type: "error" });
            return;
          }
          if (bestBack && s.marketId && s.selectedRunner) {
            if (s.isShadowMode) {
              s.placeShadowTrade({
                marketId: s.marketId,
                selectionId: s.selectedRunner.selectionId,
                side: "BACK",
                price: bestBack.price,
                size: s.activeStake,
                player: s.displayPlayers[s.selectedPlayer].name,
              }).then(() => s.fetchTrades());
            } else if (s.isLive) {
              if (s.marketBook?.inplay) {
                s.addPendingOrder({ id: `${Date.now()}-kb`, side: "BACK", price: bestBack.price, size: s.activeStake, placedAt: Date.now(), delaySeconds: 5 });
              }
              s.placeTrade({
                marketId: s.marketId,
                selectionId: s.selectedRunner.selectionId,
                side: "BACK",
                price: bestBack.price,
                size: s.activeStake,
              });
            } else {
              s.setToast({
                message: `Demo: BACK £${s.activeStake} @ ${bestBack.price.toFixed(2)}`,
                type: "success",
              });
            }
          }
          break;
        case "l":
          if (s.cooldownUntil && Date.now() < s.cooldownUntil) {
            s.setToast({ message: "Trading paused — cooldown active", type: "error" });
            return;
          }
          if (bestLay && s.marketId && s.selectedRunner) {
            if (s.isShadowMode) {
              s.placeShadowTrade({
                marketId: s.marketId,
                selectionId: s.selectedRunner.selectionId,
                side: "LAY",
                price: bestLay.price,
                size: s.activeStake,
                player: s.displayPlayers[s.selectedPlayer].name,
              }).then(() => s.fetchTrades());
            } else if (s.isLive) {
              if (s.marketBook?.inplay) {
                s.addPendingOrder({ id: `${Date.now()}-kb`, side: "LAY", price: bestLay.price, size: s.activeStake, placedAt: Date.now(), delaySeconds: 5 });
              }
              s.placeTrade({
                marketId: s.marketId,
                selectionId: s.selectedRunner.selectionId,
                side: "LAY",
                price: bestLay.price,
                size: s.activeStake,
              });
            } else {
              s.setToast({
                message: `Demo: LAY £${s.activeStake} @ ${bestLay.price.toFixed(2)}`,
                type: "success",
              });
            }
          }
          break;
        case "c":
          if (s.isLive && s.marketId && s.unmatchedOrders.length > 0) {
            s.cancelOrder({ marketId: s.marketId });
            s.setToast({ message: "Cancelling all unmatched orders...", type: "success" });
          }
          break;
        case "g":
          if (s.greenUpResult && s.marketId && s.selectedRunner) {
            if (s.isShadowMode) {
              // Shadow green-up
              const runnerPositions = s.openPositions.filter(
                (p: SupabaseTrade) =>
                  p.selection_id === String(s.selectedRunner.selectionId)
              );
              Promise.all(
                runnerPositions.map((pos: SupabaseTrade) =>
                  fetch("/api/trades/shadow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "closeShadowTrade",
                      tradeId: pos.id,
                      exitPrice: s.currentLayPrice,
                      pnl: s.greenUpResult!.equalProfit,
                    }),
                  }).then(() => {
                    s.fetchCoachInsight({
                      id: pos.id,
                      side: pos.side,
                      entry_price: pos.entry_price,
                      exit_price: s.currentLayPrice,
                      stake: pos.stake,
                      pnl: s.greenUpResult!.equalProfit,
                      player: pos.player,
                      greened_up: true,
                    });
                  })
                )
              ).then(() => {
                s.setToast({
                  message: `SHADOW green-up: lock £${s.greenUpResult!.equalProfit.toFixed(2)}`,
                  type: "success",
                });
                s.fetchTrades();
              });
            } else if (s.isLive) {
              s.placeTrade({
                marketId: s.marketId,
                selectionId: s.selectedRunner.selectionId,
                side: s.greenUpResult.greenUpSide,
                price: s.currentLayPrice,
                size: s.greenUpResult.greenUpStake,
              }).then((ok: boolean) => {
                if (ok) {
                  const runnerPositions = s.openPositions.filter(
                    (p: SupabaseTrade) =>
                      p.selection_id === String(s.selectedRunner.selectionId)
                  );
                  for (const pos of runnerPositions) {
                    s.closeTradeAsGreenUp(pos.id, s.currentLayPrice, s.greenUpResult!.equalProfit);
                  }
                }
              });
            }
          }
          break;
        case "1":
          s.setSelectedStake(STAKES[0]); s.setCustomStakeInput("");
          break;
        case "2":
          s.setSelectedStake(STAKES[1]); s.setCustomStakeInput("");
          break;
        case "3":
          s.setSelectedStake(STAKES[2]); s.setCustomStakeInput("");
          break;
        case "4":
          s.setSelectedStake(STAKES[3]); s.setCustomStakeInput("");
          break;
        case "5":
          s.setSelectedStake(STAKES[4]); s.setCustomStakeInput("");
          break;
        case "escape":
          setShortcutsExpanded(false);
          break;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─────────────────────────────────────────────────────────── */
  /* ─── LADDER PANEL ─── */
  /* ─────────────────────────────────────────────────────────── */

  const ladderPanel = (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      {/* Ladder Header */}
      <div className="px-3 md:px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {displayPlayers[selectedPlayer].flag}{" "}
              {displayPlayers[selectedPlayer].name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLive && marketBook?.totalMatched
                ? `Matched: ${formatVolume(marketBook.totalMatched)}`
                : "Awaiting connection"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl md:text-2xl font-bold font-mono text-white">
              {displayPlayers[selectedPlayer].odds > 0
                ? displayPlayers[selectedPlayer].odds.toFixed(2)
                : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* Stake Selector */}
      <div className="px-3 md:px-4 py-2.5 border-b border-gray-800/50 overflow-x-auto">
        <div className="flex items-center gap-2 flex-nowrap">
          <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium shrink-0">
            STAKE
          </span>
          {STAKES.map((stake) => (
            <button
              key={stake}
              onClick={() => { setSelectedStake(stake); setCustomStakeInput(""); }}
              className={`shrink-0 min-h-[48px] md:min-h-0 px-4 md:px-3 py-2.5 md:py-1.5 rounded-lg text-sm md:text-xs font-medium transition-all ${
                selectedStake === stake && !customStakeInput
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
              }`}
            >
              £{stake}
            </button>
          ))}
          <div className="relative shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">£</span>
            <input
              type="number"
              min={2}
              step="any"
              value={customStakeInput}
              onChange={(e) => {
                setCustomStakeInput(e.target.value);
                if (e.target.value) setSelectedStake(null);
              }}
              placeholder="Custom"
              className="w-[90px] min-h-[48px] md:min-h-0 pl-6 pr-2 py-2.5 md:py-1.5 rounded-lg text-sm md:text-xs font-medium bg-gray-800/50 text-white placeholder-gray-500 border border-gray-700/50 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Pending Orders (bet delay) */}
      {pendingOrders.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-800/50 space-y-1.5">
          <div className="text-[10px] tracking-[0.15em] uppercase text-amber-400 font-medium">PENDING ({pendingOrders.length})</div>
          {pendingOrders.map((po) => (
            <PendingOrderCountdown key={po.id} order={po} onExpire={removePendingOrder} />
          ))}
        </div>
      )}

      {/* Grid Header */}
      <div className="grid grid-cols-3 py-2 border-b border-gray-800/50">
        <div className="text-[11px] tracking-[0.15em] uppercase text-blue-400 font-medium pl-3">
          BACK
        </div>
        <div className="text-[11px] tracking-[0.15em] uppercase text-gray-400 font-medium text-center">
          PRICE
        </div>
        <div className="text-[11px] tracking-[0.15em] uppercase text-pink-400 font-medium text-right pr-3">
          LAY
        </div>
      </div>

      {/* Ladder Body */}
      <div className="max-h-[640px] overflow-y-auto">
        {ladderData && ladderData.length > 0 ? (
          ladderData.map((row) => {
            const unmatched = unmatchedByPrice.get(row.price);
            return (
            <div
              key={row.price}
              className={`grid grid-cols-3 items-center border-b border-gray-800/20 min-h-[48px] md:min-h-0 transition-colors hover:brightness-125 ${
                row.isLastTraded ? "bg-green-400/10 border-l-2 border-l-green-400" : ""
              }`}
            >
              {/* Back cell */}
              <button
                onClick={() => handleTradeClick(row.price, "BACK")}
                disabled={tradeLoading || cooldownActive}
                className={`relative py-1.5 px-3 text-right text-sm font-mono transition-all overflow-hidden ${
                  cooldownActive
                    ? "opacity-40 cursor-not-allowed text-gray-700"
                    : row.isBestBack
                      ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 active:bg-blue-500/40"
                      : row.backSize > 0
                        ? "bg-blue-500/8 text-blue-400/80 hover:bg-blue-500/15 active:bg-blue-500/25"
                        : "text-gray-700 hover:bg-blue-500/5"
                }`}
              >
                {/* Depth bar */}
                {row.backSize > 0 && (
                  <div
                    className="absolute inset-y-0 right-0 bg-blue-400 opacity-20 pointer-events-none"
                    style={{ width: `${Math.min((row.backSize / maxSize) * 100, 100)}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-end gap-1">
                  {unmatched && unmatched.backSize > 0 && (
                    <span className="px-1 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-semibold">
                      £{Math.round(unmatched.backSize)}
                    </span>
                  )}
                  {row.backSize > 0 ? `£${row.backSize.toLocaleString()}` : ""}
                </span>
              </button>

              {/* Price cell */}
              <div
                className={`py-1.5 flex items-center justify-center font-mono font-bold text-sm ${
                  row.isLastTraded ? "text-green-400" : "text-white"
                }`}
              >
                {row.price.toFixed(2)}
                {row.isLastTraded && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>

              {/* Lay cell */}
              <button
                onClick={() => handleTradeClick(row.price, "LAY")}
                disabled={tradeLoading || cooldownActive}
                className={`relative py-1.5 px-3 text-left text-sm font-mono transition-all overflow-hidden ${
                  cooldownActive
                    ? "opacity-40 cursor-not-allowed text-gray-700"
                    : row.isBestLay
                      ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 active:bg-pink-500/40"
                      : row.laySize > 0
                        ? "bg-pink-500/8 text-pink-400/80 hover:bg-pink-500/15 active:bg-pink-500/25"
                        : "text-gray-700 hover:bg-pink-500/5"
                }`}
              >
                {/* Depth bar */}
                {row.laySize > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-pink-400 opacity-20 pointer-events-none"
                    style={{ width: `${Math.min((row.laySize / maxSize) * 100, 100)}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {row.laySize > 0 ? `£${row.laySize.toLocaleString()}` : ""}
                  {unmatched && unmatched.laySize > 0 && (
                    <span className="px-1 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-400 font-semibold">
                      £{Math.round(unmatched.laySize)}
                    </span>
                  )}
                </span>
              </button>
            </div>
            );
          })
        ) : (
          /* Empty state when no live data */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400 font-medium mb-1">
              Connect Betfair to see live prices
            </p>
            <p className="text-xs text-gray-600">
              Go to Settings to link your Betfair account
            </p>
          </div>
        )}
      </div>

      {/* Position Summary (aggregated) */}
      <div className="px-3 md:px-4 py-2.5 border-t border-gray-800/50 bg-gray-900/30 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-500">Position: </span>
            {aggregatedPos && aggregatedPos.netSide !== "FLAT" ? (
              <span className={`font-semibold ${aggregatedPos.netSide === "BACK" ? "text-blue-400" : "text-pink-400"}`}>
                Net {aggregatedPos.netSide} £{aggregatedPos.netStake.toFixed(2)} @ {aggregatedPos.avgEntry.toFixed(2)}
                {aggregatedPos.count > 1 && (
                  <span className="text-gray-500 font-normal"> ({aggregatedPos.count} entries)</span>
                )}
              </span>
            ) : (
              <span className="text-gray-600">No position</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Open: </span>
            <span className="text-gray-300 font-mono font-semibold">
              {selectedRunnerPositions.length}
            </span>
          </div>
        </div>
        {/* P&L per runner outcome */}
        {outcomePnl && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-gray-500">If</span>
            <span className={`font-mono font-semibold ${outcomePnl.ifPlayer1Wins >= 0 ? "text-green-400" : "text-red-400"}`}>
              {displayPlayers.player1.short} wins: {outcomePnl.ifPlayer1Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer1Wins.toFixed(2)}
            </span>
            <span className="text-gray-600">|</span>
            <span className={`font-mono font-semibold ${outcomePnl.ifPlayer2Wins >= 0 ? "text-green-400" : "text-red-400"}`}>
              {displayPlayers.player2.short} wins: {outcomePnl.ifPlayer2Wins >= 0 ? "+" : ""}£{outcomePnl.ifPlayer2Wins.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Unmatched Orders List */}
      {unmatchedOrders.filter(o => !selectedRunner || o.selectionId === selectedRunner.selectionId).length > 0 && (
        <div className="px-3 md:px-4 py-2 border-t border-gray-800/50 bg-gray-900/20">
          <div className="text-[10px] tracking-[0.15em] uppercase text-amber-400 font-medium mb-1.5">
            UNMATCHED ORDERS
          </div>
          <div className="space-y-1">
            {unmatchedOrders
              .filter(o => !selectedRunner || o.selectionId === selectedRunner.selectionId)
              .map((order) => (
              <div key={order.betId} className="flex items-center justify-between py-1 px-2 rounded bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${
                    order.side === "BACK" ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
                  }`}>{order.side}</span>
                  <span className="text-gray-300 font-mono">£{(order.sizeRemaining as number).toFixed(2)} @ {order.price.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => marketId && cancelOrder({ marketId, betId: order.betId })}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel All Button */}
      {unmatchedOrders.length > 0 && marketId && (
        <div className="px-3 md:px-4 py-2 border-t border-gray-800/50">
          <button
            onClick={() => cancelOrder({ marketId })}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all"
          >
            CANCEL ALL ({unmatchedOrders.length} unmatched)
          </button>
        </div>
      )}

      {/* Green Up Button — only shown when a position exists */}
      {greenUpResult && currentLayPrice > 0 && (
        <div className="px-3 md:px-4 py-3 border-t border-gray-800/50">
          <button
            onClick={async () => {
              if (!marketId || !selectedRunner) return;

              if (isShadowMode) {
                // Shadow green-up: close all open positions via API
                for (const pos of selectedRunnerPositions) {
                  await fetch("/api/trades/shadow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "closeShadowTrade",
                      tradeId: pos.id,
                      exitPrice: currentLayPrice,
                      pnl: greenUpResult.equalProfit,
                    }),
                  });
                  // Fire coach insight in background
                  fetchCoachInsight({
                    id: pos.id,
                    side: pos.side,
                    entry_price: pos.entry_price,
                    exit_price: currentLayPrice,
                    stake: pos.stake,
                    pnl: greenUpResult.equalProfit,
                    player: pos.player,
                    greened_up: true,
                  });
                }
                setToast({
                  message: `SHADOW green-up: lock £${greenUpResult.equalProfit.toFixed(2)}`,
                  type: "success",
                });
                setTimeout(() => setToast(null), 4000);
                fetchTrades();
                return;
              }

              if (isLive) {
                const success = await placeTrade({
                  marketId,
                  selectionId: selectedRunner.selectionId,
                  side: greenUpResult.greenUpSide,
                  price: currentLayPrice,
                  size: greenUpResult.greenUpStake,
                });
                if (success) {
                  for (const pos of selectedRunnerPositions) {
                    await closeTradeAsGreenUp(
                      pos.id,
                      currentLayPrice,
                      greenUpResult.equalProfit
                    );
                  }
                }
              }
            }}
            disabled={tradeLoading}
            className={`w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              greenUpResult.equalProfit >= 0
                ? "bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] animate-pulse-subtle"
                : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            }`}
          >
            {isShadowMode && <span className="mr-1">SHADOW</span>}
            {greenUpResult.greenUpSide} £{greenUpResult.greenUpStake.toFixed(2)} @{" "}
            {currentLayPrice.toFixed(2)} → Lock{" "}
            {greenUpResult.equalProfit >= 0 ? "+" : ""}£
            {greenUpResult.equalProfit.toFixed(2)}
          </button>
          <div className="mt-1.5 text-center text-[10px] text-gray-500 font-mono">
            Win: £{greenUpResult.profitIfWin.toFixed(2)} / Lose: £
            {greenUpResult.profitIfLose.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────── */
  /* ─── AI PANEL ─── */
  /* ─────────────────────────────────────────────────────────── */

  const aiPanel = (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              AI SIGNALS
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
            CLAUDE
          </span>
        </div>
      </div>

      {/* Pre-Match Briefing */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="rounded-xl p-3 border" style={{ borderColor: "rgba(200, 184, 154, 0.3)", background: "rgba(200, 184, 154, 0.05)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] tracking-[0.15em] uppercase font-semibold" style={{ color: "#C8B89A" }}>
              PRE-MATCH BRIEFING
            </span>
            {briefingCached && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-500">cached</span>
            )}
          </div>
          {briefingLoading ? (
            <div className="flex items-center gap-2 py-2">
              <svg className="w-3.5 h-3.5 animate-spin" style={{ color: "#C8B89A" }} viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-500">Generating briefing...</span>
            </div>
          ) : briefing ? (
            <p className="text-xs leading-relaxed" style={{ color: "#C8B89A" }}>{briefing}</p>
          ) : (
            <p className="text-xs text-gray-600">No briefing available — open a market to generate.</p>
          )}
        </div>
      </div>

      {/* Signal type selector + Get Signal button */}
      <div className="p-4 border-b border-gray-800/50 space-y-3">
        <div className="flex gap-1.5">
          {[
            { id: "pre_match" as const, label: "Pre-Match" },
            { id: "in_play" as const, label: "In-Play" },
            { id: "edge_alert" as const, label: "Edge" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSignalType(t.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                signalType === t.id
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  : "bg-gray-800/30 text-gray-500 border border-transparent hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchAiSignal}
          disabled={aiSignalLoading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {aiSignalLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analysing...
            </span>
          ) : (
            "Get AI Signal"
          )}
        </button>
      </div>

      {/* Current signal display */}
      {aiSignal && (
        <div className="p-4 border-b border-gray-800/50">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    aiSignal.edgeSize === "strong"
                      ? "bg-green-500/20 text-green-400"
                      : aiSignal.edgeSize === "moderate"
                        ? "bg-blue-500/20 text-blue-400"
                        : aiSignal.edgeSize === "mild"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {aiSignal.edgeSize.toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-500 uppercase">
                  {aiSignal.type.replace("_", " ")}
                </span>
              </div>
              <span className="text-[10px] text-gray-600">
                {aiSignal.model.split("-").slice(1, 3).join(" ")}
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{aiSignal.analysis}</p>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-500">Confidence</span>
                <span className="text-green-400 font-mono font-medium">
                  {aiSignal.confidence}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-500"
                  style={{ width: `${aiSignal.confidence}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent signals history */}
      <div className="p-4">
        {aiSignalHistory.length > 0 ? (
          <>
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-3">
              RECENT SIGNALS
            </h3>
            <div className="space-y-2">
              {aiSignalHistory.map((sig, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        sig.edgeSize === "strong"
                          ? "bg-green-500/20 text-green-400"
                          : sig.edgeSize === "moderate"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {sig.edgeSize.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-300 uppercase">
                      {sig.type.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">
                    {sig.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-gray-600 text-sm mb-1">No signals yet</div>
            <div className="text-gray-700 text-xs">
              Click &quot;Get AI Signal&quot; to analyse this match
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────── */
  /* ─── POSITIONS PANEL ─── */
  /* ─────────────────────────────────────────────────────────── */

  const positionsPanel = (
    <div className="space-y-3 max-w-md mx-auto">
      {/* Session P&L */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            SESSION P&amp;L
          </h2>
        </div>
        <div className="p-4">
          <div
            className={`text-2xl font-bold font-mono mb-1 ${
              sessionPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {sessionPnl >= 0 ? "+" : "-"}£{Math.abs(sessionPnl).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Profit from closed trades</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "TRADES", value: String(tradeHistory.length), color: "text-white" },
              { label: "WIN RATE", value: `${winRate}%`, color: "text-green-400" },
              {
                label: "BEST",
                value: bestTrade > 0 ? `+£${bestTrade.toFixed(2)}` : "--",
                color: "text-green-400 font-mono",
              },
              {
                label: "STREAK",
                value: currentStreak.count === 0
                  ? "—"
                  : currentStreak.type === "win"
                    ? `${currentStreak.count}W`
                    : `${currentStreak.count}L`,
                color: currentStreak.type === "win"
                  ? "text-green-400"
                  : currentStreak.type === "loss"
                    ? "text-red-400"
                    : "text-gray-500",
              },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800/30 rounded-lg p-2.5">
                <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-0.5">
                  {s.label}
                </div>
                <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              OPEN POSITIONS
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
              {openPositions.length} OPEN
            </span>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {openPositions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">No open positions</p>
          ) : (
            openPositions.map((pos) => (
              <div
                key={pos.id}
                className={`rounded-xl p-3 ${
                  isShadowMode
                    ? "bg-purple-500/5 border border-purple-500/20"
                    : "bg-blue-500/5 border border-blue-500/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isShadowMode && <span className="text-sm">👻</span>}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        pos.side === "BACK"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-pink-500/20 text-pink-400"
                      }`}
                    >
                      {pos.side}
                    </span>
                    <span className="text-xs text-white font-medium">
                      {pos.player ?? pos.selection_id}
                    </span>
                  </div>
                  <span className={`font-mono text-xs ${isShadowMode ? "text-purple-400" : "text-gray-500"}`}>
                    {isShadowMode ? "Shadow" : "Open"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    £{pos.stake} @ {pos.entry_price}
                  </span>
                  <span className="text-gray-600">
                    {new Date(pos.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            TRADE HISTORY
          </h2>
        </div>
        <div className="divide-y divide-gray-800/30">
          {tradeHistory.length === 0 ? (
            <div className="px-4 py-4 text-xs text-gray-500 text-center">
              No closed trades yet
            </div>
          ) : (
            tradeHistory.map((trade) => {
              const insight = coachInsights[trade.id] ?? trade.coach_insight;
              return (
              <div key={trade.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
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
                      <div className="text-[11px] text-gray-300 font-mono">
                        {trade.entry_price} → {trade.exit_price ?? "--"} x £{trade.stake}
                      </div>
                      <div className="text-[10px] text-gray-600">
                        {trade.closed_at
                          ? new Date(trade.closed_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--"}
                        {trade.greened_up && (
                          <span className="ml-1 text-green-500">● green</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      (trade.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(trade.pnl ?? 0) >= 0 ? "+" : "-"}£
                    {Math.abs(trade.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
                {insight && (
                  <div className={`mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed ${
                    fadingInsightId === trade.id ? "animate-fade-in" : ""
                  }`}>
                    <span className="shrink-0 mt-px">🧠</span>
                    <span style={{ color: "#C8B89A" }}>{insight}</span>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* AI Guardian */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              AI GUARDIAN
            </h2>
            {guardianData ? (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  guardianData.urgency === "high"
                    ? "bg-red-500/10 text-red-400"
                    : guardianData.urgency === "medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : guardianData.urgency === "low"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-green-500/10 text-green-400"
                }`}
              >
                {guardianData.urgency === "none" ? "SAFE" : guardianData.urgency.toUpperCase()}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                <span className="text-[10px] text-gray-500">Ready</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {!guardianData ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Assess your current position for AI-powered exit strategies.
              </p>
              <button
                onClick={fetchGuardianAssessment}
                disabled={guardianLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {guardianLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Assessing...
                  </span>
                ) : (
                  "Assess Position"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-300">{guardianData.statusMessage}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Current P&amp;L</span>
                <span
                  className={`font-mono font-semibold ${
                    guardianData.currentPnl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {guardianData.currentPnl >= 0 ? "+" : ""}£
                  {guardianData.currentPnl.toFixed(2)}
                </span>
              </div>
              {(["A", "B", "C", "D"] as const).map((key) => {
                const opt = guardianData.options?.[key];
                if (!opt) return null;
                const isRecommended = guardianData.aiRecommendation === key;
                const canExecute =
                  key !== "D" &&
                  (key === "A" || key === "C" || (key === "B" && opt.canBreakEven));
                return (
                  <div
                    key={key}
                    className={`rounded-xl p-3 border ${
                      isRecommended
                        ? "border-blue-500/40 bg-blue-500/5"
                        : "border-gray-800/50 bg-gray-800/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-500">{key}</span>
                      <span className="text-xs font-medium text-white">{opt.label}</span>
                      {isRecommended && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                          AI PICK
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2">{opt.description}</p>
                    {key === "A" && opt.equalProfit !== undefined && (
                      <div className="text-[11px] text-gray-500">
                        Lock in:{" "}
                        <span
                          className={`font-mono ${
                            opt.equalProfit >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {opt.equalProfit >= 0 ? "+" : ""}£{opt.equalProfit.toFixed(2)}
                        </span>{" "}
                        ({opt.greenUpSide} £{opt.greenUpStake?.toFixed(2)} @{" "}
                        {opt.greenUpPrice?.toFixed(2)})
                      </div>
                    )}
                    {key === "C" && (
                      <div className="text-[11px] text-gray-500">
                        Best:{" "}
                        <span className="text-green-400 font-mono">
                          +£{opt.bestCase?.toFixed(2)}
                        </span>
                        {" / "}Worst:{" "}
                        <span className="text-red-400 font-mono">
                          -£{Math.abs(opt.worstCase ?? 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {key === "D" && opt.available && (
                      <div className="text-[11px] text-gray-500">
                        Recovery:{" "}
                        <span className="text-blue-400 font-mono">
                          {opt.recoveryChance}%
                        </span>
                        {opt.waitGames !== undefined && (
                          <span> · Wait {opt.waitGames} games</span>
                        )}
                      </div>
                    )}
                    {canExecute && isConnected && marketId && (
                      <button
                        onClick={() =>
                          executeGuardianOption({
                            hedgeSide: opt.greenUpSide ?? opt.hedgeSide,
                            hedgePrice: opt.greenUpPrice ?? opt.hedgePrice,
                            hedgeStake: opt.greenUpStake ?? opt.hedgeStake,
                          })
                        }
                        disabled={guardianExecuting}
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-medium text-white bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 transition-all"
                      >
                        {guardianExecuting ? "Placing..." : "Execute"}
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => {
                  setGuardianData(null);
                  fetchGuardianAssessment();
                }}
                disabled={guardianLoading}
                className="w-full py-2 rounded-xl text-xs font-medium text-gray-400 bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50 hover:text-gray-300 disabled:opacity-40 transition-all"
              >
                Re-assess Position
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────── */
  /* ─── MAIN RENDER ─── */
  /* ─────────────────────────────────────────────────────────── */

  const p1Pnl = getUnrealizedPnl("player1");
  const p2Pnl = getUnrealizedPnl("player2");

  /* ─── No market selected ─── */
  if (noMarket) {
    return (
      <main className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-500 text-sm">No market selected</div>
          <Link
            href="/markets"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            Browse Markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.type === "success" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Shadow Mode Banner */}
      {isShadowMode && (
        <div className="border-b border-purple-500/20 bg-purple-500/5">
          <div className="px-2 md:px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
              SHADOW MODE
            </span>
            <span className="text-xs text-purple-400/80">
              Practice trading with real odds. No money moves.
            </span>
          </div>
        </div>
      )}

      {/* Demo Mode Banner */}
      {!isLive && !isShadowMode && (
        <div className="border-b border-amber-500/20 bg-amber-500/5">
          <div className="px-2 md:px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              DEMO
            </span>
            <span className="text-xs text-amber-400/80">
              Demo mode -- connect Betfair in Settings for live trading
            </span>
          </div>
        </div>
      )}

      {/* Streak Alert Banner (amber, 3+ losses) */}
      {streakProtectionEnabled && consecutiveLosses >= streakThreshold && !streakBannerDismissed && !cooldownActive && (
        <div className="border-b border-amber-500/20 bg-amber-500/10">
          <div className="px-2 md:px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">⚠️</span>
              <span className="text-xs text-amber-400 font-medium">
                STREAK ALERT — {consecutiveLosses} losses in a row. Traders who pause here recover faster. Consider a break.
              </span>
            </div>
            <button
              onClick={() => setStreakBannerDismissed(true)}
              className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Cooldown Modal Overlay (red, 5+ losses) */}
      {cooldownActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-8 max-w-sm mx-4 text-center space-y-4">
            <div className="text-4xl">🛑</div>
            <h2 className="text-xl font-bold text-white">TRADING PAUSED</h2>
            <p className="text-sm text-gray-400">
              You&apos;ve hit {consecutiveLosses} consecutive losses. Trading is disabled for 10 minutes.
            </p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold font-mono text-red-400">
                {cooldownRemaining}
              </div>
              <div className="text-[10px] text-red-400/60 uppercase tracking-wider mt-1">remaining</div>
            </div>
            <p className="text-xs text-gray-500">
              Traders who cool down after losing streaks average better results in their next session.
            </p>
          </div>
        </div>
      )}

      {/* ─── Market Status Bar ─── */}
      <div className="border-b border-gray-800/50 bg-gray-900/30">
        <div className="px-2 md:px-4 py-2 flex items-center justify-center gap-2 md:gap-3 flex-wrap text-xs">
          <span className="text-gray-400 font-medium">{tournament}</span>
          <span className="text-gray-700">|</span>
          {isLive && marketBook ? (
            <>
              {marketBook.status === "SUSPENDED" ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 animate-pulse">
                  SUSPENDED
                </span>
              ) : marketBook.status === "CLOSED" ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-500/15 text-gray-400">
                  CLOSED
                </span>
              ) : marketBook.inplay ? (
                <>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400">
                    IN-PLAY
                  </span>
                  <span className="text-[10px] font-medium text-amber-400">~5s delay</span>
                </>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400">
                    PRE-MATCH
                  </span>
                  {searchParams.get("startTime") && (
                    <span className="text-[10px] text-gray-400">
                      Starts in <MarketCountdown startTime={searchParams.get("startTime")!} />
                    </span>
                  )}
                </>
              )}
              <span className="text-gray-700">|</span>
              <span className="text-gray-400 font-mono">
                {formatVolume(marketBook.totalMatched)} matched
              </span>
            </>
          ) : (
            <span className="text-gray-500">Awaiting connection</span>
          )}
          {isConnected && marketId && (
            <>
              <span className="text-gray-700">|</span>
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-gray-500">Stream:</span>
                {streamStatus === "connected" ? (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    <span className="text-[10px] font-semibold text-green-400">Connected</span>
                  </span>
                ) : streamStatus === "connecting" ? (
                  <span className="text-[10px] font-semibold text-yellow-400 animate-pulse">Connecting...</span>
                ) : streamStatus === "fallback" ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
                    <span className="text-[10px] font-semibold text-red-400">Disconnected</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
                    <span className="text-[10px] font-semibold text-red-400">Disconnected</span>
                  </span>
                )}
              </span>
            </>
          )}
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1 text-gray-400">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {sessionTimeStr}
          </span>
        </div>
      </div>

      {/* ─── Session Timer Bar ─── */}
      <div className="border-b border-gray-800/50 bg-gray-900/20">
        <div className="px-2 md:px-4 py-1.5 flex items-center justify-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-gray-400">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {sessionTimeStr}
          </span>
          <span className="text-gray-700">|</span>
          <span
            className={`font-mono font-semibold ${
              sessionPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {sessionPnl >= 0 ? "+" : ""}£{sessionPnl.toFixed(2)}
          </span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-500 font-mono">£{sessionRate}/hr</span>
        </div>
      </div>

      {/* ─── Player Selector (segmented tabs) ─── */}
      <div className="bg-gray-900/30 max-w-full overflow-hidden">
        <div className="flex">
          {(["player1", "player2"] as const).map((key) => {
            const player = displayPlayers[key];
            const pnl = key === "player1" ? p1Pnl : p2Pnl;
            const isActive = selectedPlayer === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedPlayer(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 min-h-[52px] md:min-h-[44px] px-3 py-2.5 text-xs md:text-sm font-medium transition-all border-b-2 ${
                  isActive
                    ? "border-blue-500 text-white bg-blue-500/5"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
                }`}
              >
                {player.flag && <span>{player.flag}</span>}
                <span className="hidden md:inline">{player.name}</span>
                <span className="md:hidden">{player.short}</span>
                <span className="font-mono font-bold text-white">
                  {player.odds > 0 ? player.odds.toFixed(2) : "--"}
                </span>
                {pnl !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                    pnl >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {pnl >= 0 ? "+" : ""}£{pnl.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Live Score Bar ─── */}
      {liveScore?.available && (
        <div className="border-b border-gray-800/50 bg-gray-900/40">
          <div className="px-2 md:px-4 py-2 flex items-center justify-center gap-2 text-xs flex-wrap">
            {/* Player 1 name + server dot */}
            <span className="flex items-center gap-1 font-medium text-white">
              {liveScore.server === 1 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              )}
              {displayPlayers.player1.short}
            </span>

            {/* Set scores */}
            <span className="font-mono font-bold text-white tracking-wide">
              [{liveScore.sets?.map((s) => `${s[0]}-${s[1]}`).join(", ")}]
            </span>

            {/* Player 2 name + server dot */}
            <span className="flex items-center gap-1 font-medium text-white">
              {displayPlayers.player2.short}
              {liveScore.server === 2 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              )}
            </span>

            <span className="text-gray-600">|</span>

            {/* Game score or tiebreak score */}
            <span className="font-mono font-semibold text-yellow-400">
              {liveScore.tiebreak && liveScore.tiebreakScore
                ? `TB ${liveScore.tiebreakScore[0]}-${liveScore.tiebreakScore[1]}`
                : `${liveScore.gameScore?.[0]}-${liveScore.gameScore?.[1]}`}
            </span>

            <span className="text-gray-600">|</span>

            {/* Server indicator */}
            <span className="flex items-center gap-1 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {liveScore.server === 1
                ? displayPlayers.player1.short
                : displayPlayers.player2.short}{" "}
              serving
            </span>

            {/* Situation badges */}
            {liveScore.matchPoint && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 animate-pulse">
                MATCH PT
              </span>
            )}
            {liveScore.setPoint && !liveScore.matchPoint && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 animate-pulse">
                SET PT
              </span>
            )}
            {liveScore.breakPoint && !liveScore.setPoint && !liveScore.matchPoint && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 animate-pulse">
                BREAK PT
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Set Winning Price Bar ─── */}
      {displayPlayers.player1.odds > 1.01 && (
        <SetWinningPrice
          player1Name={displayPlayers.player1.name}
          player2Name={displayPlayers.player2.name}
          player1Odds={displayPlayers.player1.odds}
          player2Odds={displayPlayers.player2.odds}
        />
      )}

      {/* ─── Weight of Money Bar ─── */}
      <div className="border-b border-gray-800/50 bg-gray-900/20 max-w-full">
        <div className="px-2 md:px-4 py-1.5 md:py-2">
          <div className="flex items-center gap-2 md:gap-3 max-w-full">
            <span className="text-[10px] text-blue-400 font-mono font-medium shrink-0">
              {womBack}% BACK
            </span>
            <div className="flex-1 h-2 md:h-2.5 rounded-full overflow-hidden bg-gray-800 flex min-w-0">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                style={{ width: `${womBack}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-500"
                style={{ width: `${100 - womBack}%` }}
              />
            </div>
            <span className="text-[10px] text-pink-400 font-mono font-medium shrink-0">
              {100 - womBack}% LAY
            </span>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar (mobile + tablet, hidden on desktop 1920+) ─── */}
      <div className="min-[1920px]:hidden sticky top-14 z-40 border-b border-gray-800/50 bg-gray-900/95 backdrop-blur-sm max-w-full">
        <div className="flex">
          {[
            { id: "ladder" as const, label: "Ladder" },
            { id: "ai" as const, label: "AI Signals" },
            { id: "positions" as const, label: "Positions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-h-[48px] md:min-h-[44px] text-sm font-medium text-center transition-all duration-200 border-b-2 ${
                activeTab === tab.id
                  ? "text-white border-blue-500 bg-blue-500/5"
                  : "text-gray-500 border-transparent hover:text-gray-300 active:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="max-w-full overflow-x-hidden">
        {/* DESKTOP ONLY: Three-column grid (1920px+) */}
        <div className="hidden min-[1920px]:block px-6 py-4 max-w-[1920px] mx-auto">
          <div className="flex gap-4">
            <div className="w-1/4 min-w-0">{aiPanel}</div>
            <div className="w-1/2 min-w-0 space-y-4">
              {ladderPanel}
              <RiskRewardPanel bestBackPrice={currentBackPrice} bestLayPrice={currentLayPrice} stake={activeStake} />
              <ServeHoldStats
                player1Name={displayPlayers.player1.name}
                player2Name={displayPlayers.player2.name}
                player1Odds={displayPlayers.player1.odds}
                player2Odds={displayPlayers.player2.odds}
                isInPlay={!!marketBook?.inplay}
                server={liveScore?.server}
              />
            </div>
            <div className="w-1/4 min-w-0">{positionsPanel}</div>
          </div>
        </div>

        {/* MOBILE + TABLET: Single panel with tab switching (<1920px) */}
        <div className="min-[1920px]:hidden px-2 md:px-4 py-3 md:py-4 max-w-full">
          <div className="transition-opacity duration-200 ease-in-out space-y-4">
            {activeTab === "ladder" && (
              <>
                {ladderPanel}
                <RiskRewardPanel bestBackPrice={currentBackPrice} bestLayPrice={currentLayPrice} stake={activeStake} />
                <ServeHoldStats
                  player1Name={displayPlayers.player1.name}
                  player2Name={displayPlayers.player2.name}
                  player1Odds={displayPlayers.player1.odds}
                  player2Odds={displayPlayers.player2.odds}
                  isInPlay={!!marketBook?.inplay}
                  server={liveScore?.server}
                />
              </>
            )}
            {activeTab === "ai" && aiPanel}
            {activeTab === "positions" && positionsPanel}
          </div>
        </div>
      </div>

      {/* ─── Keyboard Shortcuts Tooltip ─── */}
      <div
        className="fixed bottom-4 right-4 z-50"
        onMouseEnter={() => setShortcutsExpanded(true)}
        onMouseLeave={() => setShortcutsExpanded(false)}
      >
        {shortcutsExpanded ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl min-w-[180px]">
            <div className="text-[10px] tracking-[0.15em] uppercase text-gray-400 font-medium mb-2">
              SHORTCUTS
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { key: "B", desc: "Back best price" },
                { key: "L", desc: "Lay best price" },
                { key: "G", desc: "Green up" },
                { key: "C", desc: "Cancel all" },
                { key: "1-5", desc: "Select stake" },
                { key: "Esc", desc: "Close" },
              ].map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-mono text-gray-300 min-w-[28px] text-center">
                    {s.key}
                  </kbd>
                  <span className="text-gray-400">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900/90 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-gray-400 cursor-default shadow-lg">
            Shortcuts
          </div>
        )}
      </div>
    </main>
  );
}
