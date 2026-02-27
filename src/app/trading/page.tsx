"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore, type PriceSize } from "@/lib/store";

/* ─── Mock Data ─── */

const PLAYERS = {
  player1: { name: "Novak Djokovic", short: "Djokovic", odds: 1.54, flag: "🇷🇸" },
  player2: { name: "Carlos Alcaraz", short: "Alcaraz", odds: 2.72, flag: "🇪🇸" },
};

interface LadderRow {
  price: number;
  backSize: number;
  laySize: number;
  isLastTraded: boolean;
  isBestBack: boolean;
  isBestLay: boolean;
}

function generateLadderData(): LadderRow[] {
  const rows: LadderRow[] = [];
  const bestBack = 1.54;
  const bestLay = 1.56;

  const fixedSizes: Record<number, { back?: number; lay?: number }> = {
    1.34: { back: 1820 }, 1.36: { back: 2105 }, 1.38: { back: 1540 },
    1.40: { back: 2890 }, 1.42: { back: 1675 }, 1.44: { back: 3210 },
    1.46: { back: 1950 }, 1.48: { back: 4120 }, 1.50: { back: 3198 },
    1.52: { back: 4321 }, 1.54: { back: 8547 },
    1.56: { lay: 6234 }, 1.58: { lay: 5123 }, 1.60: { lay: 2987 },
    1.62: { lay: 3456 }, 1.64: { lay: 1890 }, 1.66: { lay: 2340 },
    1.68: { lay: 1567 }, 1.70: { lay: 2120 }, 1.72: { lay: 980 },
    1.74: { lay: 1450 }, 1.76: { lay: 875 }, 1.78: { lay: 1230 },
    1.80: { lay: 640 }, 1.82: { lay: 920 }, 1.84: { lay: 510 },
  };

  for (const [priceStr, sizes] of Object.entries(fixedSizes)) {
    const price = parseFloat(priceStr);
    rows.push({
      price,
      backSize: sizes.back ?? 0,
      laySize: sizes.lay ?? 0,
      isLastTraded: price === bestBack,
      isBestBack: price === bestBack,
      isBestLay: price === bestLay,
    });
  }
  return rows.sort((a, b) => a.price - b.price);
}

const LADDER_DATA = generateLadderData();

const RECENT_TRADES = [
  { time: "14:32", type: "BACK" as const, price: 1.54, stake: 50, pnl: null as number | null },
  { time: "14:28", type: "LAY" as const, price: 2.68, stake: 25, pnl: 18.5 },
  { time: "14:15", type: "BACK" as const, price: 1.62, stake: 100, pnl: 42.3 },
  { time: "14:02", type: "LAY" as const, price: 1.48, stake: 50, pnl: -15.0 },
];

const STAKES = [5, 10, 25, 50, 100];

/* ─── Breakpoints: mobile <768  |  tablet 768-1919  |  desktop 1920+ ─── */

export default function TradingPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-14 bg-[#030712] flex items-center justify-center"><div className="text-gray-500 text-sm">Loading...</div></div>}>
      <TradingPage />
    </Suspense>
  );
}

function TradingPage() {
  const searchParams = useSearchParams();
  const marketId = searchParams.get("marketId");
  const p1Name = searchParams.get("p1");
  const p2Name = searchParams.get("p2");

  const [selectedStake, setSelectedStake] = useState(25);
  const [selectedPlayer, setSelectedPlayer] = useState<"player1" | "player2">("player1");
  const [activeTab, setActiveTab] = useState<"ladder" | "ai" | "positions">("ladder");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* AI Signals state */
  const [aiSignal, setAiSignal] = useState<{
    type: string; confidence: number; edgeSize: string;
    analysis: string; model: string; timestamp: string;
  } | null>(null);
  const [aiSignalLoading, setAiSignalLoading] = useState(false);
  const [aiSignalHistory, setAiSignalHistory] = useState<Array<{
    type: string; confidence: number; edgeSize: string;
    analysis: string; timestamp: string;
  }>>([]);
  const [signalType, setSignalType] = useState<"pre_match" | "in_play" | "edge_alert">("in_play");

  /* AI Guardian state */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [guardianData, setGuardianData] = useState<any>(null);
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianExecuting, setGuardianExecuting] = useState(false);

  const {
    isConnected,
    marketBook,
    fetchMarketBook,
    placeTrade,
    tradeLoading,
    tradeError,
    lastTradeSuccess,
    clearTradeMessages,
  } = useAppStore();

  const isLive = isConnected && !!marketId && !!marketBook;

  /* ─── Fetch live prices on 2-second interval ─── */
  const fetchPrices = useCallback(() => {
    if (isConnected && marketId) {
      fetchMarketBook([marketId]);
    }
  }, [isConnected, marketId, fetchMarketBook]);

  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrices]);

  /* ─── Show toast on trade success/error ─── */
  useEffect(() => {
    if (lastTradeSuccess) {
      setToast({ message: lastTradeSuccess, type: "success" });
      clearTradeMessages();
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
    if (tradeError) {
      setToast({ message: tradeError, type: "error" });
      clearTradeMessages();
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastTradeSuccess, tradeError, clearTradeMessages]);

  /* ─── Build ladder from live data or mock ─── */
  const selectedRunner = isLive
    ? marketBook.runners?.[selectedPlayer === "player1" ? 0 : 1]
    : null;

  let liveLadder: LadderRow[] | null = null;
  let livePlayerOdds = { player1: PLAYERS.player1.odds, player2: PLAYERS.player2.odds };

  if (isLive && marketBook.runners) {
    const r0 = marketBook.runners[0];
    const r1 = marketBook.runners[1];
    const bestBack0 = r0?.ex?.availableToBack?.[0]?.price ?? 0;
    const bestBack1 = r1?.ex?.availableToBack?.[0]?.price ?? 0;
    livePlayerOdds = { player1: bestBack0, player2: bestBack1 };

    if (selectedRunner?.ex) {
      const priceMap = new Map<number, { back: number; lay: number }>();
      const backs = selectedRunner.ex.availableToBack ?? [];
      const lays = selectedRunner.ex.availableToLay ?? [];

      backs.forEach((ps: PriceSize) => {
        const entry = priceMap.get(ps.price) ?? { back: 0, lay: 0 };
        entry.back += ps.size;
        priceMap.set(ps.price, entry);
      });
      lays.forEach((ps: PriceSize) => {
        const entry = priceMap.get(ps.price) ?? { back: 0, lay: 0 };
        entry.lay += ps.size;
        priceMap.set(ps.price, entry);
      });

      const bestBackPrice = backs[0]?.price ?? 0;
      const bestLayPrice = lays[0]?.price ?? 0;

      liveLadder = Array.from(priceMap.entries())
        .map(([price, sizes]) => ({
          price,
          backSize: Math.round(sizes.back),
          laySize: Math.round(sizes.lay),
          isLastTraded: price === bestBackPrice,
          isBestBack: price === bestBackPrice,
          isBestLay: price === bestLayPrice,
        }))
        .sort((a, b) => a.price - b.price);
    }
  }

  const ladderData = liveLadder ?? LADDER_DATA;
  const displayPlayers = {
    player1: {
      ...PLAYERS.player1,
      name: p1Name ?? PLAYERS.player1.name,
      short: p1Name?.split(" ").pop() ?? PLAYERS.player1.short,
      odds: livePlayerOdds.player1,
    },
    player2: {
      ...PLAYERS.player2,
      name: p2Name ?? PLAYERS.player2.name,
      short: p2Name?.split(" ").pop() ?? PLAYERS.player2.short,
      odds: livePlayerOdds.player2,
    },
  };

  /* ─── Handle trade click ─── */
  async function handleTradeClick(price: number, side: "BACK" | "LAY") {
    if (!isConnected || !marketId || !selectedRunner) return;
    await placeTrade({
      marketId,
      selectionId: selectedRunner.selectionId,
      side,
      price,
      size: selectedStake,
    });
  }

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
            tournament: "ATP Tour",
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
      const bestLay = isLive && selectedRunner?.ex?.availableToLay?.[0]?.price
        ? selectedRunner.ex.availableToLay[0].price
        : bestBack + 0.02;

      const res = await fetch("/api/ai-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assessPosition",
          entryPrice: 1.54,
          entryStake: 50,
          entrySide: "BACK",
          currentBackPrice: bestBack,
          currentLayPrice: bestLay,
          matchContext: {
            player: displayPlayers[selectedPlayer].name,
            score: "6-4, 3-2",
            server: displayPlayers.player1.name,
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
        setToast({ message: `Hedge placed: ${option.hedgeSide} £${option.hedgeStake} @ ${option.hedgePrice}`, type: "success" });
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

  /* ─── WOM calculation ─── */
  let womBack = 62;
  if (isLive && selectedRunner?.ex) {
    const totalBack = (selectedRunner.ex.availableToBack ?? []).reduce((s: number, p: PriceSize) => s + p.size, 0);
    const totalLay = (selectedRunner.ex.availableToLay ?? []).reduce((s: number, p: PriceSize) => s + p.size, 0);
    const total = totalBack + totalLay;
    womBack = total > 0 ? Math.round((totalBack / total) * 100) : 50;
  }

  /* ─── Shared sub-components rendered inline ─── */

  const ladderPanel = (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      {/* Ladder Header */}
      <div className="px-3 md:px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {displayPlayers[selectedPlayer].flag} {displayPlayers[selectedPlayer].name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Matched: £142,847</p>
          </div>
          <div className="text-right">
            <div className="text-xl md:text-2xl font-bold font-mono text-white">
              {displayPlayers[selectedPlayer].odds.toFixed(2)}
            </div>
            <div className="text-[10px] text-green-400">▲ 0.04</div>
          </div>
        </div>
      </div>

      {/* Stake Selector - scrollable on mobile */}
      <div className="px-3 md:px-4 py-2.5 border-b border-gray-800/50 overflow-x-auto">
        <div className="flex items-center gap-2 flex-nowrap">
          <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium shrink-0">STAKE</span>
          {STAKES.map((stake) => (
            <button
              key={stake}
              onClick={() => setSelectedStake(stake)}
              className={`shrink-0 min-h-[44px] md:min-h-0 px-4 md:px-3 py-2 md:py-1.5 rounded-lg text-sm md:text-xs font-medium transition-all ${
                selectedStake === stake
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
              }`}
            >
              £{stake}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-3 py-2 border-b border-gray-800/50">
        <div className="text-[11px] tracking-[0.15em] uppercase text-blue-400 font-medium pl-3">BACK</div>
        <div className="text-[11px] tracking-[0.15em] uppercase text-gray-400 font-medium text-center">PRICE</div>
        <div className="text-[11px] tracking-[0.15em] uppercase text-pink-400 font-medium text-right pr-3">LAY</div>
      </div>

      {/* Ladder Body */}
      <div className="max-h-[480px] overflow-y-auto">
        {ladderData.map((row) => (
          <div
            key={row.price}
            className={`grid grid-cols-3 items-center border-b border-gray-800/20 ${
              row.isLastTraded ? "bg-green-500/5" : ""
            }`}
          >
            <button
              onClick={() => row.backSize > 0 && handleTradeClick(row.price, "BACK")}
              disabled={tradeLoading}
              className={`py-2 px-3 text-right text-sm font-mono transition-all ${
                row.backSize > 0
                  ? row.isBestBack
                    ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 active:bg-blue-500/40"
                    : "bg-blue-500/10 text-blue-400/80 hover:bg-blue-500/20 active:bg-blue-500/30"
                  : "text-gray-700 hover:bg-blue-500/5"
              }`}
            >
              {row.backSize > 0 ? `£${row.backSize.toLocaleString()}` : ""}
            </button>
            <div
              className={`py-2 flex items-center justify-center font-mono font-bold text-sm ${
                row.isLastTraded ? "text-green-400" : "text-white"
              }`}
            >
              {row.price.toFixed(2)}
              {row.isLastTraded && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>
            <button
              onClick={() => row.laySize > 0 && handleTradeClick(row.price, "LAY")}
              disabled={tradeLoading}
              className={`py-2 px-3 text-left text-sm font-mono transition-all ${
                row.laySize > 0
                  ? row.isBestLay
                    ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 active:bg-pink-500/40"
                    : "bg-pink-500/10 text-pink-400/80 hover:bg-pink-500/20 active:bg-pink-500/30"
                  : "text-gray-700 hover:bg-pink-500/5"
              }`}
            >
              {row.laySize > 0 ? `£${row.laySize.toLocaleString()}` : ""}
            </button>
          </div>
        ))}
      </div>

      {/* Position Summary */}
      <div className="px-3 md:px-4 py-2.5 border-t border-gray-800/50 bg-gray-900/30">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-500">Position: </span>
            <span className="text-blue-400 font-semibold">BACK £50 @ 1.54</span>
          </div>
          <div>
            <span className="text-gray-500">P&amp;L: </span>
            <span className="text-green-400 font-mono font-semibold">+£12.50</span>
          </div>
        </div>
      </div>
    </div>
  );

  const aiPanel = (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">AI SIGNALS</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">CLAUDE</span>
        </div>
      </div>

      {/* Signal type selector + Get Signal button */}
      <div className="p-4 border-b border-gray-800/50 space-y-3">
        <div className="flex gap-1.5">
          {([
            { id: "pre_match" as const, label: "Pre-Match" },
            { id: "in_play" as const, label: "In-Play" },
            { id: "edge_alert" as const, label: "Edge" },
          ]).map((t) => (
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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  aiSignal.edgeSize === "strong" ? "bg-green-500/20 text-green-400" :
                  aiSignal.edgeSize === "moderate" ? "bg-blue-500/20 text-blue-400" :
                  aiSignal.edgeSize === "mild" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-gray-500/20 text-gray-400"
                }`}>
                  {aiSignal.edgeSize.toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-500 uppercase">{aiSignal.type.replace("_", " ")}</span>
              </div>
              <span className="text-[10px] text-gray-600">{aiSignal.model.split("-").slice(1, 3).join(" ")}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{aiSignal.analysis}</p>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-500">Confidence</span>
                <span className="text-green-400 font-mono font-medium">{aiSignal.confidence}%</span>
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
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium mb-3">RECENT SIGNALS</h3>
            <div className="space-y-2">
              {aiSignalHistory.map((sig, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      sig.edgeSize === "strong" ? "bg-green-500/20 text-green-400" :
                      sig.edgeSize === "moderate" ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {sig.edgeSize.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-300 uppercase">{sig.type.replace("_", " ")}</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">{sig.confidence}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-gray-600 text-sm mb-1">No signals yet</div>
            <div className="text-gray-700 text-xs">Click &quot;Get AI Signal&quot; to analyse this match</div>
          </div>
        )}
      </div>
    </div>
  );

  const positionsPanel = (
    <div className="space-y-3 max-w-md mx-auto">
      {/* Session P&L */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">SESSION P&amp;L</h2>
        </div>
        <div className="p-4">
          <div className="text-2xl font-bold text-green-400 font-mono mb-1">+£127.50</div>
          <div className="text-xs text-gray-500">Today&apos;s profit across all markets</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "TRADES", value: "12", color: "text-white" },
              { label: "WIN RATE", value: "75%", color: "text-green-400" },
              { label: "BEST", value: "+£42.30", color: "text-green-400 font-mono" },
              { label: "WORST", value: "-£15.00", color: "text-red-400 font-mono" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800/30 rounded-lg p-2.5">
                <div className="text-[10px] tracking-wider uppercase text-gray-500 mb-0.5">{s.label}</div>
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
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">OPEN POSITIONS</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">1 OPEN</span>
          </div>
        </div>
        <div className="p-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400">BACK</span>
                <span className="text-xs text-white font-medium">Djokovic</span>
              </div>
              <span className="text-green-400 font-mono text-xs font-semibold">+£12.50</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>£50 @ 1.54</span>
              <span>Current: 1.50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">TRADE HISTORY</h2>
        </div>
        <div className="divide-y divide-gray-800/30">
          {RECENT_TRADES.map((trade, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${trade.type === "BACK" ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"}`}>{trade.type}</span>
                <div>
                  <div className="text-[11px] text-gray-300 font-mono">{trade.price} × £{trade.stake}</div>
                  <div className="text-[10px] text-gray-600">{trade.time}</div>
                </div>
              </div>
              <span className={`text-xs font-mono font-semibold ${trade.pnl === null ? "text-gray-500" : trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {trade.pnl === null ? "Open" : trade.pnl >= 0 ? `+£${trade.pnl.toFixed(2)}` : `-£${Math.abs(trade.pnl).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Guardian */}
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">AI GUARDIAN</h2>
            {guardianData ? (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                guardianData.urgency === "high" ? "bg-red-500/10 text-red-400" :
                guardianData.urgency === "medium" ? "bg-amber-500/10 text-amber-400" :
                guardianData.urgency === "low" ? "bg-yellow-500/10 text-yellow-400" :
                "bg-green-500/10 text-green-400"
              }`}>
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
              <p className="text-xs text-gray-500">Assess your current position for AI-powered exit strategies.</p>
              <button
                onClick={fetchGuardianAssessment}
                disabled={guardianLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {guardianLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                <span className={`font-mono font-semibold ${guardianData.currentPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {guardianData.currentPnl >= 0 ? "+" : ""}£{guardianData.currentPnl.toFixed(2)}
                </span>
              </div>
              {(["A", "B", "C", "D"] as const).map((key) => {
                const opt = guardianData.options?.[key];
                if (!opt) return null;
                const isRecommended = guardianData.aiRecommendation === key;
                const canExecute = key !== "D" && (key === "A" || key === "C" || (key === "B" && opt.canBreakEven));
                return (
                  <div
                    key={key}
                    className={`rounded-xl p-3 border ${
                      isRecommended ? "border-blue-500/40 bg-blue-500/5" : "border-gray-800/50 bg-gray-800/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-500">{key}</span>
                      <span className="text-xs font-medium text-white">{opt.label}</span>
                      {isRecommended && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">AI PICK</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mb-2">{opt.description}</p>
                    {key === "A" && opt.equalProfit !== undefined && (
                      <div className="text-[11px] text-gray-500">
                        Lock in: <span className={`font-mono ${opt.equalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {opt.equalProfit >= 0 ? "+" : ""}£{opt.equalProfit.toFixed(2)}
                        </span>
                        {" "}({opt.greenUpSide} £{opt.greenUpStake?.toFixed(2)} @ {opt.greenUpPrice?.toFixed(2)})
                      </div>
                    )}
                    {key === "C" && (
                      <div className="text-[11px] text-gray-500">
                        Best: <span className="text-green-400 font-mono">+£{opt.bestCase?.toFixed(2)}</span>
                        {" / "}Worst: <span className="text-red-400 font-mono">-£{Math.abs(opt.worstCase ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {key === "D" && opt.available && (
                      <div className="text-[11px] text-gray-500">
                        Recovery: <span className="text-blue-400 font-mono">{opt.recoveryChance}%</span>
                        {opt.waitGames !== undefined && <span> · Wait {opt.waitGames} games</span>}
                      </div>
                    )}
                    {canExecute && isConnected && marketId && (
                      <button
                        onClick={() => executeGuardianOption({
                          hedgeSide: opt.greenUpSide ?? opt.hedgeSide,
                          hedgePrice: opt.greenUpPrice ?? opt.hedgePrice,
                          hedgeStake: opt.greenUpStake ?? opt.hedgeStake,
                        })}
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
                onClick={() => { setGuardianData(null); fetchGuardianAssessment(); }}
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

  return (
    <main className="min-h-screen pt-14 bg-[#030712] max-w-[100vw] overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
          toast.type === "success"
            ? "bg-green-500/90 text-white"
            : "bg-red-500/90 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Demo Mode Banner */}
      {!isLive && (
        <div className="border-b border-amber-500/20 bg-amber-500/5">
          <div className="px-2 md:px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">DEMO</span>
            <span className="text-xs text-amber-400/80">Demo mode — connect Betfair in Settings for live trading</span>
          </div>
        </div>
      )}

      {/* ─── Top Bar: Player Selector ─── */}
      <div className="border-b border-gray-800/50 bg-gray-900/30 max-w-full overflow-hidden">
        <div className="px-2 md:px-4 py-2 md:py-3">
          <div className="flex items-center justify-between gap-2 max-w-full">
            {/* Match info - hidden on mobile, shown on tablet+ */}
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 shrink-0">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">LIVE</span>
              <span>ATP Finals</span>
              <span className="text-gray-700">·</span>
              <span>Semi-Final</span>
              <span className="text-gray-700">·</span>
              <span>Set 2, Game 4</span>
            </div>

            {/* Mobile: compact live badge */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-medium">LIVE</span>
            </div>

            {/* Players - always visible */}
            <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
              <button
                onClick={() => setSelectedPlayer("player1")}
                className={`flex items-center gap-1 md:gap-2 min-h-[44px] md:min-h-0 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  selectedPlayer === "player1"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                    : "bg-gray-900/50 text-gray-400 border border-gray-800/50"
                }`}
              >
                <span>{displayPlayers.player1.flag}</span>
                <span className="hidden md:inline">{displayPlayers.player1.name}</span>
                <span className="md:hidden">{displayPlayers.player1.short}</span>
                <span className="font-mono font-bold text-white">{displayPlayers.player1.odds.toFixed(2)}</span>
              </button>
              <span className="text-gray-600 text-[10px] md:text-xs font-medium">vs</span>
              <button
                onClick={() => setSelectedPlayer("player2")}
                className={`flex items-center gap-1 md:gap-2 min-h-[44px] md:min-h-0 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  selectedPlayer === "player2"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                    : "bg-gray-900/50 text-gray-400 border border-gray-800/50"
                }`}
              >
                <span>{displayPlayers.player2.flag}</span>
                <span className="hidden md:inline">{displayPlayers.player2.name}</span>
                <span className="md:hidden">{displayPlayers.player2.short}</span>
                <span className="font-mono font-bold text-white">{displayPlayers.player2.odds.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── WOM Bar ─── */}
      <div className="border-b border-gray-800/50 bg-gray-900/20 max-w-full">
        <div className="px-2 md:px-4 py-1.5 md:py-2">
          <div className="flex items-center gap-2 md:gap-3 max-w-full">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-medium shrink-0">WOM</span>
            <div className="flex-1 h-1.5 md:h-2 rounded-full overflow-hidden bg-gray-800 flex min-w-0">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${womBack}%` }} />
              <div className="h-full bg-gradient-to-r from-pink-400 to-pink-500 transition-all duration-500" style={{ width: `${100 - womBack}%` }} />
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs shrink-0">
              <span className="text-blue-400 font-mono">{womBack}%</span>
              <span className="text-gray-700">/</span>
              <span className="text-pink-400 font-mono">{100 - womBack}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar (mobile + tablet, hidden on desktop 1920+) ─── */}
      <div className="min-[1920px]:hidden sticky top-14 z-40 border-b border-gray-800/50 bg-gray-900/95 backdrop-blur-sm max-w-full">
        <div className="flex">
          {([
            { id: "ladder" as const, label: "Ladder" },
            { id: "ai" as const, label: "AI Signals" },
            { id: "positions" as const, label: "Positions" },
          ]).map((tab) => (
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
            <div className="w-1/2 min-w-0">{ladderPanel}</div>
            <div className="w-1/4 min-w-0">{positionsPanel}</div>
          </div>
        </div>

        {/* MOBILE + TABLET: Single panel with tab switching (<1920px) */}
        <div className="min-[1920px]:hidden px-2 md:px-4 py-3 md:py-4 max-w-full">
          <div className="transition-opacity duration-200 ease-in-out">
            {activeTab === "ladder" && ladderPanel}
            {activeTab === "ai" && aiPanel}
            {activeTab === "positions" && positionsPanel}
          </div>
        </div>
      </div>
    </main>
  );
}
