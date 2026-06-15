"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { buildMatchContext, formatMatchContextForPrompt, inferSurface } from "@/lib/tennisContext";

/* ─── Types ─── */

type MarketState = "BALANCED" | "BACK_PRESSURE" | "LAY_PRESSURE" | "VOLATILE" | "MOMENTUM_SHIFT";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

interface MarketViewData {
  marketState: MarketState;
  summary: string;
  risk: RiskLevel;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  dataSource: {
    scoreProvider: string;
    scoreConfidence: string;
    scoreAvailable: boolean;
    oddsSource: string;
  };
  timestamp: string;
  cached: boolean;
}

interface LiveScoreInput {
  available: boolean;
  sets?: number[][];
  gameScore?: string[];
  server?: 1 | 2;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  tiebreakScore?: string[];
  scoreConfidence?: "reliable" | "estimated" | "unavailable";
  provider?: string;
  isScoreStale?: boolean;
}

interface AIMarketViewProps {
  player1Name: string;
  player2Name: string;
  player1Odds: number;
  player2Odds: number;
  tournament: string;
  isInPlay: boolean;
  isSuspended?: boolean;
  liveScore: LiveScoreInput | null;
  /** Optional ladder context string */
  ladderContext?: string;
  /** Classic (light) theme variant */
  variant?: "dark" | "light";
}

/* ─── Market State Config ─── */

const STATE_CONFIG: Record<MarketState, { label: string; color: string; bg: string }> = {
  BALANCED: { label: "BALANCED", color: "text-gray-400", bg: "bg-gray-500/20" },
  BACK_PRESSURE: { label: "BACK PRESSURE", color: "text-blue-400", bg: "bg-blue-500/20" },
  LAY_PRESSURE: { label: "LAY PRESSURE", color: "text-pink-400", bg: "bg-pink-500/20" },
  VOLATILE: { label: "VOLATILE", color: "text-amber-400", bg: "bg-amber-500/20" },
  MOMENTUM_SHIFT: { label: "MOMENTUM SHIFT", color: "text-purple-400", bg: "bg-purple-500/20" },
};

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string }> = {
  LOW: { color: "text-green-400", bg: "bg-green-500/20" },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-500/20" },
  HIGH: { color: "text-red-400", bg: "bg-red-500/20" },
};

const CONF_CONFIG: Record<ConfidenceLevel, { color: string; bg: string }> = {
  HIGH: { color: "text-green-400", bg: "bg-green-500/20" },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-500/20" },
  LOW: { color: "text-red-400", bg: "bg-red-500/20" },
};

/* ─── Refresh intervals ─── */
const REFRESH_IN_PLAY_MS = 60_000;   // 60s when in-play
const REFRESH_PRE_MATCH_MS = 180_000; // 3min when pre-match

/* ─── Component ─── */

export default function AIMarketView({
  player1Name,
  player2Name,
  player1Odds,
  player2Odds,
  tournament,
  isInPlay,
  isSuspended,
  liveScore,
  ladderContext,
  variant = "dark",
}: AIMarketViewProps) {
  const [viewData, setViewData] = useState<MarketViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const fetchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const isLight = variant === "light";

  const fetchMarketView = useCallback(async () => {
    if (loading) return;
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const resolvedSurface = inferSurface(tournament, undefined);
      const matchCtx = buildMatchContext({
        player1: player1Name,
        player2: player2Name,
        liveScore: liveScore ?? null,
        marketStatus: isSuspended ? "suspended" : isInPlay ? "in_play" : "pre_match",
        isScoreStale: !!liveScore?.isScoreStale,
        player1Odds,
        player2Odds,
        surface: resolvedSurface,
      });

      const matchStateContext = formatMatchContextForPrompt(matchCtx);

      const res = await fetch("/api/ai/market-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          player1: player1Name,
          player2: player2Name,
          odds1: player1Odds,
          odds2: player2Odds,
          tournament,
          surface: resolvedSurface,
          isInPlay,
          score: matchCtx.formattedScore,
          server: matchCtx.serverName,
          scoreConfidence: matchCtx.scoreConfidence,
          scoreProvider: liveScore?.provider ?? "unknown",
          breakPoint: matchCtx.breakPoint,
          setPoint: matchCtx.setPoint,
          matchPoint: matchCtx.matchPoint,
          tiebreak: matchCtx.tiebreak,
          finalSet: matchCtx.finalSet,
          isScoreStale: matchCtx.isScoreStale,
          ladderContext,
          matchStateContext,
        }),
      });

      const data = await res.json();
      if (data.success && data.marketView) {
        setViewData(data.marketView);
        lastFetchRef.current = Date.now();
        setSecondsAgo(0);
      } else {
        setError(data.error || "Unknown error");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Network error");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player1Name, player2Name, player1Odds, player2Odds, tournament, isInPlay, isSuspended, liveScore?.provider, liveScore?.scoreConfidence, ladderContext]);

  /* ─── Auto-fetch on mount + auto-refresh ─── */
  useEffect(() => {
    if (!player1Name || !player2Name) return;

    // Initial fetch
    fetchMarketView();

    // Set up refresh interval
    const interval = isInPlay ? REFRESH_IN_PLAY_MS : REFRESH_PRE_MATCH_MS;
    fetchTimerRef.current = setInterval(fetchMarketView, interval);

    return () => {
      if (fetchTimerRef.current) clearInterval(fetchTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player1Name, player2Name, isInPlay]);

  /* ─── Tick "Updated Xs ago" ─── */
  useEffect(() => {
    tickTimerRef.current = setInterval(() => {
      if (lastFetchRef.current > 0) {
        setSecondsAgo(Math.floor((Date.now() - lastFetchRef.current) / 1000));
      }
    }, 5000);
    return () => { if (tickTimerRef.current) clearInterval(tickTimerRef.current); };
  }, []);

  /* ─── Render ─── */

  const stateConf = viewData ? STATE_CONFIG[viewData.marketState] : null;
  const riskConf = viewData ? RISK_CONFIG[viewData.risk] : null;
  const confConf = viewData ? CONF_CONFIG[viewData.confidence] : null;

  const formatAge = (s: number) => {
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  /* Loading skeleton */
  const skeleton = (
    <div className="space-y-2 animate-pulse">
      <div className="flex items-center gap-3">
        <div className={`h-4 w-28 rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
        <div className={`h-4 w-16 rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
      </div>
      <div className={`h-3 w-full rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
      <div className={`h-3 w-3/4 rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
      <div className="flex gap-2 mt-1">
        <div className={`h-3 w-20 rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
        <div className={`h-3 w-20 rounded ${isLight ? "bg-gray-200" : "bg-gray-700"}`} />
      </div>
    </div>
  );

  /* Score provider label */
  const providerLabel = (p: string) => {
    if (p === "betfair") return "Betfair";
    if (p === "api-tennis") return "API-Tennis";
    return p;
  };

  if (isLight) {
    /* ─── Classic (light) variant ─── */
    return (
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-gray-900">
        {/* Header */}
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-500 animate-pulse" : viewData ? "bg-green-500" : "bg-gray-400"}`} />
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-600">
              AI MARKET VIEW
            </span>
          </div>
          {isInPlay && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">LIVE</span>
          )}
        </div>

        <div className="p-3">
          {loading && !viewData ? skeleton : error && !viewData ? (
            <div className="text-xs text-red-500">{error}</div>
          ) : viewData ? (
            <div className="space-y-2">
              {/* Row 1: State + Risk */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  viewData.marketState === "BALANCED" ? "bg-gray-100 text-gray-600" :
                  viewData.marketState === "BACK_PRESSURE" ? "bg-blue-100 text-blue-700" :
                  viewData.marketState === "LAY_PRESSURE" ? "bg-pink-100 text-pink-700" :
                  viewData.marketState === "VOLATILE" ? "bg-amber-100 text-amber-700" :
                  "bg-purple-100 text-purple-700"
                }`}>
                  {STATE_CONFIG[viewData.marketState].label}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  viewData.risk === "LOW" ? "bg-green-100 text-green-700" :
                  viewData.risk === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {viewData.risk} RISK
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  viewData.confidence === "HIGH" ? "bg-green-100 text-green-700" :
                  viewData.confidence === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {viewData.confidence}
                </span>
              </div>

              {/* Summary */}
              <p className="text-xs text-gray-700 leading-snug">{viewData.summary}</p>

              {/* Data Source */}
              <div className="flex items-center gap-3 text-[9px] text-gray-500 pt-1 border-t border-gray-100">
                <span>
                  Score: {viewData.dataSource.scoreAvailable ? (
                    <span className="text-green-600 font-medium">{providerLabel(viewData.dataSource.scoreProvider)}</span>
                  ) : (
                    <span className="text-gray-400">unavailable</span>
                  )}
                </span>
                <span>Odds: <span className="text-gray-600 font-medium">Betfair</span></span>
                {viewData.cached && <span className="text-gray-400">cached</span>}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1">
                <span>{formatAge(secondsAgo)}</span>
                <button
                  onClick={fetchMarketView}
                  disabled={loading}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-40 font-medium"
                >
                  {loading ? "..." : "Refresh"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ─── Dark variant (trading / paper) ─── */
  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-500 animate-pulse" : viewData ? "bg-green-500" : "bg-gray-600"}`} />
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400">
            AI MARKET VIEW
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isInPlay && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold">LIVE</span>
          )}
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">CLAUDE</span>
        </div>
      </div>

      <div className="p-4">
        {loading && !viewData ? skeleton : error && !viewData ? (
          <div className="text-xs text-red-400">{error}</div>
        ) : viewData ? (
          <div className="space-y-3">
            {/* State + Risk + Confidence badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {stateConf && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stateConf.bg} ${stateConf.color}`}>
                  {stateConf.label}
                </span>
              )}
              {riskConf && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskConf.bg} ${riskConf.color}`}>
                  {viewData.risk} RISK
                </span>
              )}
              {confConf && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${confConf.bg} ${confConf.color}`}>
                  {viewData.confidence}
                </span>
              )}
            </div>

            {/* Summary */}
            <p className="text-xs text-gray-300 leading-relaxed">{viewData.summary}</p>

            {/* Confidence reason */}
            {viewData.confidenceReason && (
              <p className="text-[9px] italic text-gray-500">{viewData.confidenceReason}</p>
            )}

            {/* Data Source Strip */}
            <div className="flex items-center gap-3 text-[9px] pt-2 border-t border-gray-800/40">
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${viewData.dataSource.scoreAvailable ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-gray-500">Score:</span>
                {viewData.dataSource.scoreAvailable ? (
                  <span className="text-gray-400 font-medium">{providerLabel(viewData.dataSource.scoreProvider)}</span>
                ) : (
                  <span className="text-gray-600">unavailable</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-gray-500">Odds:</span>
                <span className="text-gray-400 font-medium">Betfair</span>
              </div>
              {viewData.cached && (
                <span className="text-gray-600">cached</span>
              )}
            </div>

            {/* Footer: Updated + Refresh */}
            <div className="flex items-center justify-between text-[9px] text-gray-600">
              <span>{formatAge(secondsAgo)}</span>
              <button
                onClick={fetchMarketView}
                disabled={loading}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-40 font-medium transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    updating
                  </span>
                ) : "Refresh"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
