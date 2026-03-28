"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { roundToTick, moveByTicks } from "@/lib/tradingMaths";

/* ─── Constants ─── */
const SET_WIN_MULTIPLIER = 0.65;
const SERVE_DRIFT_TICKS = 10; // odds drifted 10+ ticks while serving
const HOLD_SERVE_TICKS = 8;
const BREAK_TICKS = 40;

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

function countTicks(from: number, to: number): number {
  if (from <= 0 || to <= 0 || from === to) return 0;
  let count = 0;
  let current = from;
  if (to > from) {
    while (current < to && count < 300) {
      const next = moveByTicks(current, 1);
      if (next <= current) break;
      current = next;
      count++;
    }
  } else {
    while (current > to && count < 300) {
      const next = moveByTicks(current, -1);
      if (next >= current) break;
      current = next;
      count++;
    }
  }
  return count;
}

/* ─── Strategy Types ─── */

type StrategyType =
  | "LAY_FIRST_SET_WINNER"
  | "BACK_SERVER"
  | "OVERREACTION"
  | "WAIT"
  | "NO_SIGNAL";

interface Strategy {
  type: StrategyType;
  title: string;
  description: string;
  side: "BACK" | "LAY" | null;
  price: number;
  risk: number;
  reward: number;
  actionable: boolean;
}

interface StrategyDetectorProps {
  playerName: string;
  playerOdds: number;
  opponentOdds: number;
  stake: number;
  isInPlay: boolean;
  server?: 1 | 2;
  selectedPlayer: "player1" | "player2";
  tradeLoading: boolean;
  onExecute: (side: "BACK" | "LAY", price: number, size: number) => void;
}

export default function StrategyDetector({
  playerName,
  playerOdds,
  opponentOdds,
  stake,
  isInPlay,
  server,
  selectedPlayer,
  tradeLoading,
  onExecute,
}: StrategyDetectorProps) {
  // Track odds history to detect big shifts (set ending)
  const oddsHistoryRef = useRef<{ price: number; ts: number }[]>([]);
  const [bigShiftDetected, setBigShiftDetected] = useState(false);
  const [shiftDirection, setShiftDirection] = useState<"drop" | "rise" | null>(null);
  // Track session-start price to detect drift from equilibrium
  const sessionStartPriceRef = useRef<number>(0);

  // Record odds history
  useEffect(() => {
    if (!isInPlay || playerOdds <= 1.01) return;
    if (sessionStartPriceRef.current === 0) {
      sessionStartPriceRef.current = playerOdds;
    }

    const now = Date.now();
    const history = oddsHistoryRef.current;
    history.push({ price: playerOdds, ts: now });
    // Keep last 60 seconds of data
    oddsHistoryRef.current = history.filter((h) => now - h.ts < 60_000);

    // Detect big shift: compare current price to price 20-40 seconds ago
    const oldEntries = history.filter((h) => now - h.ts > 20_000 && now - h.ts < 45_000);
    if (oldEntries.length > 0) {
      const oldPrice = oldEntries[0].price;
      const ticks = countTicks(oldPrice, playerOdds);
      if (ticks >= 15 && playerOdds < oldPrice) {
        // Big drop — set win likely
        setBigShiftDetected(true);
        setShiftDirection("drop");
      } else if (ticks >= 15 && playerOdds > oldPrice) {
        // Big rise — set loss likely
        setBigShiftDetected(true);
        setShiftDirection("rise");
      }
      // Reset after 30 seconds
      if (bigShiftDetected) {
        const timer = setTimeout(() => {
          setBigShiftDetected(false);
          setShiftDirection(null);
        }, 30_000);
        return () => clearTimeout(timer);
      }
    }
  }, [playerOdds, isInPlay, bigShiftDetected]);

  const strategy = useMemo((): Strategy => {
    const short = playerName.split(" ").pop() ?? playerName;
    const noSignal: Strategy = {
      type: "NO_SIGNAL",
      title: "NO SIGNAL",
      description: "Wait for a setup. No clear edge at current prices.",
      side: null,
      price: 0,
      risk: 0,
      reward: 0,
      actionable: false,
    };

    if (!isInPlay || playerOdds <= 1.01) return noSignal;

    const setWinPrice = roundToTick(playerOdds * SET_WIN_MULTIPLIER);

    // 1. OVERREACTION — odds dropped below set winning price
    if (playerOdds <= setWinPrice && playerOdds > 1.01) {
      // Lay opportunity: odds compressed beyond set win
      const layLiability = r2(stake * (playerOdds - 1));
      // If odds bounce back up by 8 ticks (hold serve by opponent = odds drift back)
      const bounceTarget = moveByTicks(playerOdds, HOLD_SERVE_TICKS);
      const bounceBackStake = r2((stake * playerOdds) / bounceTarget);
      const reward = r2(stake - bounceBackStake);
      return {
        type: "OVERREACTION",
        title: "OVERREACTION",
        description: `Market priced in more than a set win. ${short} at ${playerOdds.toFixed(2)} is below set price ${setWinPrice.toFixed(2)}. Lay for rebound.`,
        side: "LAY",
        price: playerOdds,
        risk: layLiability,
        reward: Math.abs(reward),
        actionable: true,
      };
    }

    // 2. LAY FIRST SET WINNER — big drop detected (set just ended)
    if (bigShiftDetected && shiftDirection === "drop") {
      const layLiability = r2(stake * (playerOdds - 1));
      // Second set slump: expect odds to drift back ~8 ticks
      const slumpTarget = moveByTicks(playerOdds, HOLD_SERVE_TICKS);
      const slumpBackStake = r2((stake * playerOdds) / slumpTarget);
      const reward = r2(stake - slumpBackStake);
      return {
        type: "LAY_FIRST_SET_WINNER",
        title: `LAY ${short.toUpperCase()} — SET WINNER`,
        description: `Odds compressed to ${playerOdds.toFixed(2)}. Second set slump probability ~35%. Expect bounce back.`,
        side: "LAY",
        price: playerOdds,
        risk: layLiability,
        reward: Math.abs(reward),
        actionable: true,
      };
    }

    // 3. BACK SERVER — player is serving and odds have drifted up (inflated)
    const playerNumber = selectedPlayer === "player1" ? 1 : 2;
    const isServing = server === playerNumber;
    if (isServing && sessionStartPriceRef.current > 0) {
      const driftTicks = countTicks(sessionStartPriceRef.current, playerOdds);
      const drifted = playerOdds > sessionStartPriceRef.current && driftTicks >= SERVE_DRIFT_TICKS;

      if (drifted) {
        // Back the server — odds are inflated, expect hold
        const holdTarget = moveByTicks(playerOdds, -HOLD_SERVE_TICKS);
        const holdLayStake = r2((stake * playerOdds) / holdTarget);
        const reward = r2(holdLayStake - stake);
        const breakTarget = moveByTicks(playerOdds, BREAK_TICKS);
        const breakLayStake = r2((stake * playerOdds) / breakTarget);
        const risk = r2(stake - breakLayStake);
        const rr = risk > 0 ? r2(reward / risk) : 0;
        return {
          type: "BACK_SERVER",
          title: `BACK ${short.toUpperCase()} — SERVING`,
          description: `Odds inflated at ${playerOdds.toFixed(2)} (+${driftTicks}t drift). Service hold expected. R/R: ${rr.toFixed(1)}x`,
          side: "BACK",
          price: playerOdds,
          risk: Math.abs(risk),
          reward,
          actionable: true,
        };
      }
    }

    // 4. WAIT — serving at equilibrium, no drift
    if (isServing) {
      return {
        type: "WAIT",
        title: "WAIT",
        description: `${short} serving at equilibrium. No edge at current price. Wait for 0-30 or 15-40.`,
        side: null,
        price: 0,
        risk: 0,
        reward: 0,
        actionable: false,
      };
    }

    // 5. Big rise detected — opponent won set
    if (bigShiftDetected && shiftDirection === "rise") {
      // Back opportunity: odds expanded, may compress on hold
      const holdTarget = moveByTicks(playerOdds, -HOLD_SERVE_TICKS);
      const holdLayStake = r2((stake * playerOdds) / holdTarget);
      const reward = r2(holdLayStake - stake);
      return {
        type: "BACK_SERVER",
        title: `BACK ${short.toUpperCase()} — OVERSOLD`,
        description: `Odds expanded to ${playerOdds.toFixed(2)} after set loss. Expect stabilisation. Value back.`,
        side: "BACK",
        price: playerOdds,
        risk: stake,
        reward,
        actionable: true,
      };
    }

    return noSignal;
  }, [playerOdds, opponentOdds, stake, isInPlay, server, selectedPlayer, playerName, bigShiftDetected, shiftDirection]);

  const bgClass = strategy.actionable
    ? "bg-green-500/5 border-green-500/20"
    : "bg-gray-900/50 border-gray-800/50";

  const dotClass = strategy.actionable
    ? "bg-green-400 animate-pulse"
    : "bg-gray-600";

  return (
    <div className={`border rounded-2xl overflow-hidden max-w-md mx-auto ${bgClass}`}>
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dotClass}`} />
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              STRATEGY
            </h2>
          </div>
          {!isInPlay && (
            <span className="text-[10px] text-gray-600">pre-match</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {!isInPlay ? (
          <p className="text-sm text-gray-600 text-center py-2">
            Strategy detection starts when match goes in-play
          </p>
        ) : (
          <div className="space-y-3">
            {/* Strategy title */}
            <div className="flex items-center gap-2">
              {strategy.actionable && (
                <span className="text-base">🎯</span>
              )}
              <span
                className={`text-sm font-bold ${
                  strategy.actionable ? "text-white" : "text-gray-500"
                }`}
              >
                {strategy.title}
              </span>
            </div>

            {/* Description */}
            <p className={`text-xs leading-relaxed ${strategy.actionable ? "text-gray-300" : "text-gray-600"}`}>
              {strategy.description}
            </p>

            {/* Risk/Reward breakdown */}
            {strategy.actionable && strategy.side && (
              <>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-gray-500">
                    {strategy.side} £{stake.toFixed(0)}
                  </span>
                  <span className="text-gray-700">→</span>
                  <span className="text-red-400">
                    Risk: £{strategy.risk.toFixed(2)}
                  </span>
                  <span className="text-gray-700">|</span>
                  <span className="text-green-400">
                    Reward: +£{strategy.reward.toFixed(2)}
                  </span>
                </div>

                {/* Execute button */}
                <button
                  onClick={() => {
                    if (strategy.side && strategy.price > 0) {
                      onExecute(strategy.side, strategy.price, stake);
                    }
                  }}
                  disabled={tradeLoading}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    strategy.side === "LAY"
                      ? "bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400"
                      : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  }`}
                >
                  EXECUTE {strategy.side} @ {strategy.price.toFixed(2)}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
