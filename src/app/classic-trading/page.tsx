"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppStore, type PriceSize } from "@/lib/store";
import { calculateGreenUp, calculateLiability, moveByTicks, roundToTick } from "@/lib/tradingMaths";
import { createClient } from "@/lib/supabase";
import { useBetfairToken } from "@/hooks/useBetfairToken";
import { useBetfairStream } from "@/hooks/useBetfairStream";
import { validateAndExecute, type ActionName, type TradeActionParams } from "@/lib/tradeActions";
import ClassicLadder from "@/components/classic/ClassicLadder";
import ClassicPositionPanel from "@/components/classic/ClassicPositionPanel";
import ClassicAIPanel from "@/components/classic/ClassicAIPanel";
import { calculateLiabilityReduction } from "@/components/classic/ClassicLiabilityTools";
import RealTradeConfirmModal from "@/components/RealTradeConfirmModal";

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

const STAKES = [5, 10, 25, 50, 100];

function formatVolume(v: number) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${Math.round(v / 1_000)}K`;
  return `£${Math.round(v)}`;
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

  /* ─── Save market to localStorage ─── */
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
  const [pendingRealTrade, setPendingRealTrade] = useState<{
    price: number; side: "BACK" | "LAY"; selectionId: number; playerName: string;
  } | null>(null);

  const activeStake = customStakeInput
    ? Math.max(2, Number(customStakeInput) || 0)
    : selectedStake ?? 25;

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

  /* ─── Live positions ─── */
  const [livePositions, setLivePositions] = useState<SupabaseTrade[]>([]);
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
      if (p1Name) params.set("p1", p1Name);
      if (p2Name) params.set("p2", p2Name);
      if (p1Flag) params.set("p1Flag", p1Flag);
      if (p2Flag) params.set("p2Flag", p2Flag);
      if (tournament !== "Tennis") params.set("tournament", tournament);
      const qs = params.toString();
      router.replace(`/paper${qs ? `?${qs}` : ""}`);
    }
  }, [subscriptionLoaded, subscriptionStatus, marketId, p1Name, p2Name, p1Flag, p2Flag, tournament, router]);

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
      if (order.selectionId !== runner0.selectionId) continue;
      const entry = map.get(order.price) ?? { backSize: 0, laySize: 0 };
      if (order.side === "BACK") entry.backSize += order.sizeRemaining as number;
      else entry.laySize += order.sizeRemaining as number;
      map.set(order.price, entry);
    }
    return map;
  }, [unmatchedOrders, runner0]);

  const unmatchedByPriceP2 = useMemo(() => {
    const map = new Map<number, { backSize: number; laySize: number }>();
    if (!runner1) return map;
    for (const order of unmatchedOrders) {
      if (order.selectionId !== runner1.selectionId) continue;
      const entry = map.get(order.price) ?? { backSize: 0, laySize: 0 };
      if (order.side === "BACK") entry.backSize += order.sizeRemaining as number;
      else entry.laySize += order.sizeRemaining as number;
      map.set(order.price, entry);
    }
    return map;
  }, [unmatchedOrders, runner1]);

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

  /* ─── Green-up calculations ─── */
  function getGreenUpForRunner(agg: ReturnType<typeof getAggregatedPositionForRunner>, currentLayPrice: number) {
    if (!agg || agg.netSide === "FLAT" || agg.avgEntry <= 0) return null;
    return calculateGreenUp(
      agg.avgEntry, agg.netStake, agg.netSide as "BACK" | "LAY",
      currentLayPrice > 0 ? currentLayPrice : agg.avgEntry,
    );
  }

  const p1LayPrice = runner0?.ex?.availableToLay?.[0]?.price ?? 0;
  const p1BackPrice = runner0?.ex?.availableToBack?.[0]?.price ?? 0;
  const p2LayPrice = runner1?.ex?.availableToLay?.[0]?.price ?? 0;
  const p2BackPrice = runner1?.ex?.availableToBack?.[0]?.price ?? 0;

  const p1GreenUp = getGreenUpForRunner(p1Agg, p1LayPrice);
  const p2GreenUp = getGreenUpForRunner(p2Agg, p2LayPrice);

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

    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side, price, size: activeStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    const result = await execAction({
      actionName: "PLACE_TRADE", marketId, selectionId, side, price, size: activeStake,
    });
    if (result.success) {
      addLivePosition({ marketId, selectionId, side, price, size: activeStake, betId: result.betId });
    }
  }

  /* ─── Confirmed trade (from Safe Mode modal) ─── */
  async function executeConfirmedRealTrade(selectionId: number, price: number, side: "BACK" | "LAY") {
    if (!marketId) return;
    if (marketBook?.inplay) {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPendingOrder({ id: pendingId, side, price, size: activeStake, placedAt: Date.now(), delaySeconds: 5 });
    }
    const result = await execAction({
      actionName: "PLACE_TRADE", marketId, selectionId, side, price, size: activeStake,
    });
    if (result.success) {
      addLivePosition({ marketId, selectionId, side, price, size: activeStake, betId: result.betId });
    }
  }

  /* ─── Green-up handlers ─── */
  async function handleGreenUp(runner: "player1" | "player2") {
    if (!marketId) return;
    const selId = runner === "player1" ? runner0?.selectionId : runner1?.selectionId;
    const greenUp = runner === "player1" ? p1GreenUp : p2GreenUp;
    const layPrice = runner === "player1" ? p1LayPrice : p2LayPrice;
    const backPrice = runner === "player1" ? p1BackPrice : p2BackPrice;
    if (!selId || !greenUp) return;

    const gPrice = greenUp.greenUpSide === "LAY" ? layPrice : backPrice;
    const result = await execAction({
      actionName: "GREEN_UP", marketId, selectionId: selId,
      side: greenUp.greenUpSide, price: gPrice, size: greenUp.greenUpStake,
    });
    if (result.success) {
      const runnerPositions = openPositions.filter((p) => p.selection_id === String(selId));
      for (const pos of runnerPositions) {
        await closeTradeAsGreenUp(pos.id, gPrice, greenUp.equalProfit);
      }
    }
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

  /* ─── AI Signals ─── */
  async function fetchAiSignal() {
    setAiSignalLoading(true);
    try {
      const res = await fetch("/api/ai-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalType: "in_play",
          matchContext: {
            player1: displayPlayers.player1.name,
            player2: displayPlayers.player2.name,
            odds1: displayPlayers.player1.odds,
            odds2: displayPlayers.player2.odds,
            tournament, surface: "Hard",
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
          matchContext: { player: displayPlayers[lastClickedRunner].name, surface: "Hard" },
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

  /* ─── Keyboard shortcuts ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateRef = useRef<any>(null);
  stateRef.current = {
    activeStake, lastClickedRunner, isLive, marketId, runner0, runner1,
    placeTrade, isConnected, displayPlayers, setToast, setSelectedStake,
    setCustomStakeInput, p1GreenUp, p2GreenUp, p1BackPrice, p1LayPrice,
    p2BackPrice, p2LayPrice, openPositions, cancelOrder, unmatchedOrders,
    marketBook, addPendingOrder, addLivePosition, execAction, closeTradeAsGreenUp,
    tradingMode, setPendingRealTrade,
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = stateRef.current;

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
          // Green up on last-clicked runner
          const greenUp = s.lastClickedRunner === "player1" ? s.p1GreenUp : s.p2GreenUp;
          const runner = s.lastClickedRunner === "player1" ? s.runner0 : s.runner1;
          const layPrice = s.lastClickedRunner === "player1" ? s.p1LayPrice : s.p2LayPrice;
          const backPrice = s.lastClickedRunner === "player1" ? s.p1BackPrice : s.p2BackPrice;
          if (greenUp && s.marketId && runner && s.isLive) {
            const gPrice = greenUp.greenUpSide === "LAY" ? layPrice : backPrice;
            s.execAction({
              actionName: "KEYBOARD_GREEN_UP", marketId: s.marketId, selectionId: runner.selectionId,
              side: greenUp.greenUpSide, price: gPrice, size: greenUp.greenUpStake,
            }).then((result: { success: boolean; betId?: string }) => {
              if (result.success) {
                const runnerPositions = s.openPositions.filter(
                  (p: SupabaseTrade) => p.selection_id === String(runner.selectionId)
                );
                for (const pos of runnerPositions) {
                  s.closeTradeAsGreenUp(pos.id, gPrice, greenUp.equalProfit);
                }
              }
            });
          }
          break;
        }
        case "1": s.setSelectedStake(STAKES[0]); s.setCustomStakeInput(""); break;
        case "2": s.setSelectedStake(STAKES[1]); s.setCustomStakeInput(""); break;
        case "3": s.setSelectedStake(STAKES[2]); s.setCustomStakeInput(""); break;
        case "4": s.setSelectedStake(STAKES[3]); s.setCustomStakeInput(""); break;
        case "5": s.setSelectedStake(STAKES[4]); s.setCustomStakeInput(""); break;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      openPositions={openPositions}
      unmatchedOrders={unmatchedDisplayOrders}
      player1Agg={p1Agg}
      player2Agg={p2Agg}
      player1Name={displayPlayers.player1.name}
      player2Name={displayPlayers.player2.name}
      player1GreenUp={p1GreenUp}
      player2GreenUp={p2GreenUp}
      outcomePnl={outcomePnl}
      onGreenUp={handleGreenUp}
      onCancelOrder={async (betId) => {
        if (marketId) await cancelOrder({ marketId, betId });
      }}
      onCancelAll={async () => {
        if (marketId) await cancelOrder({ marketId });
      }}
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

  const aiPanel = (
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
    />
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
        {/* GREEN ALL */}
        {p1GreenUp && p1Agg && p1Agg.netSide !== "FLAT" ? (
          <button
            onClick={() => handleGreenUp("player1")}
            disabled={tradeLoading || isSuspended}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              p1GreenUp.equalProfit >= 0
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-200"
                : "bg-red-500 hover:bg-red-600 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            GREEN {displayPlayers.player1.short} {p1GreenUp.equalProfit >= 0 ? "+" : ""}£{p1GreenUp.equalProfit.toFixed(2)}
          </button>
        ) : (
          <button disabled className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-400 border border-emerald-200 cursor-not-allowed">
            GREEN P1
          </button>
        )}
        {p2GreenUp && p2Agg && p2Agg.netSide !== "FLAT" ? (
          <button
            onClick={() => handleGreenUp("player2")}
            disabled={tradeLoading || isSuspended}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              p2GreenUp.equalProfit >= 0
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-200"
                : "bg-red-500 hover:bg-red-600 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            GREEN {displayPlayers.player2.short} {p2GreenUp.equalProfit >= 0 ? "+" : ""}£{p2GreenUp.equalProfit.toFixed(2)}
          </button>
        ) : (
          <button disabled className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-400 border border-emerald-200 cursor-not-allowed">
            GREEN P2
          </button>
        )}

        <span className="w-px h-5 bg-gray-300 mx-1" />

        {/* LIABILITY REDUCTION BUTTONS */}
        {(() => {
          // Pick the runner with a position for liability buttons
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
        </div>
      )}

      {/* ─── Trade Confirmation Modal ─── */}
      {pendingRealTrade && (
        <RealTradeConfirmModal
          side={pendingRealTrade.side}
          price={pendingRealTrade.price}
          stake={activeStake}
          runner={pendingRealTrade.playerName}
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
              className="px-2 py-0.5 rounded text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all hidden sm:inline-block"
            >
              Modern &rarr;
            </Link>
          </div>
        </div>

        {/* Row 2: Stake controls */}
        <div className="px-3 sm:px-4 py-1.5 border-t border-gray-100 flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-500">STAKE</span>
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
              className="w-16 sm:w-20 px-2 py-1 sm:py-1.5 rounded border border-gray-300 text-[11px] sm:text-xs font-mono text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
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
        <div className="max-w-[1800px] mx-auto mb-3">
          {tradeControlsStrip}
        </div>
        <div className="flex gap-3 2xl:gap-4 max-w-[1800px] mx-auto">
          {/* AI Panel — narrow sidebar */}
          <div className="w-[200px] 2xl:w-[220px] shrink-0 min-w-0 overflow-hidden self-start">
            {aiPanel}
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
            />
          </div>

          {/* Positions Panel — narrow sidebar */}
          <div className="w-[260px] 2xl:w-[280px] shrink-0 min-w-0 overflow-hidden self-start">
            {positionPanel}
          </div>
        </div>
      </div>

      {/* Mid desktop (1024-1279px): ladders top, panels below */}
      <div className="hidden lg:block xl:hidden px-4 pt-4 pb-6">
        {/* Trade Controls Strip */}
        <div className="mb-3">
          {tradeControlsStrip}
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
          />
        </div>
        {/* AI + Positions row below ladders */}
        <div className="grid grid-cols-2 gap-3 mx-auto mt-4">
          <div>{aiPanel}</div>
          <div>{positionPanel}</div>
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
              />
              </div>
            </div>
          )}
          {activeTab === "positions" && <div className="max-w-[600px] mx-auto">{positionPanel}</div>}
          {activeTab === "ai" && <div className="max-w-[600px] mx-auto">{aiPanel}</div>}
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
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-gray-600">1-5</kbd><span>Stake</span>
        </div>
      </div>
    </main>
  );
}
