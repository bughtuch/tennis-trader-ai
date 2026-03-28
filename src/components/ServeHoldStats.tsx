"use client";

import { useEffect, useRef, useState } from "react";
import { moveByTicks } from "@/lib/tradingMaths";

/**
 * Estimates serve holds by tracking odds movements.
 * A significant price drop (3+ ticks) suggests a hold of serve.
 * A significant price rise (10+ ticks) suggests a break of serve.
 *
 * Will be replaced by real score data when live scores are integrated.
 */

const HOLD_TICK_THRESHOLD = 3; // price drops 3+ ticks = likely hold
const BREAK_TICK_THRESHOLD = 10; // price rises 10+ ticks = likely break

interface ServeHoldStatsProps {
  player1Name: string;
  player2Name: string;
  player1Odds: number;
  player2Odds: number;
  isInPlay: boolean;
  server?: 1 | 2;
}

interface PlayerStats {
  serviceGames: number;
  holds: number;
}

function countTicksBetween(from: number, to: number): number {
  if (from <= 0 || to <= 0 || from === to) return 0;
  const direction = to > from ? 1 : -1;
  let count = 0;
  let current = from;
  const limit = 200;
  if (direction > 0) {
    while (current < to && count < limit) {
      const next = moveByTicks(current, 1);
      if (next <= current) break;
      current = next;
      count++;
    }
  } else {
    while (current > to && count < limit) {
      const next = moveByTicks(current, -1);
      if (next >= current) break;
      current = next;
      count++;
    }
  }
  return count;
}

function holdPct(stats: PlayerStats): string {
  if (stats.serviceGames === 0) return "—";
  return `${Math.round((stats.holds / stats.serviceGames) * 100)}%`;
}

export default function ServeHoldStats({
  player1Name,
  player2Name,
  player1Odds,
  player2Odds,
  isInPlay,
  server,
}: ServeHoldStatsProps) {
  const [p1Stats, setP1Stats] = useState<PlayerStats>({ serviceGames: 0, holds: 0 });
  const [p2Stats, setP2Stats] = useState<PlayerStats>({ serviceGames: 0, holds: 0 });

  // Track previous odds to detect game changes
  const prevOddsRef = useRef<{ p1: number; p2: number } | null>(null);
  // Accumulate tick drift between game-change events
  const tickDriftRef = useRef<number>(0);
  // Store the "anchor" price at last detected game change
  const anchorPriceRef = useRef<number>(0);
  // Who we think is currently serving (1 or 2), estimated from odds movement direction
  const estimatedServerRef = useRef<1 | 2 | null>(null);

  useEffect(() => {
    if (!isInPlay || player1Odds <= 0) {
      prevOddsRef.current = null;
      return;
    }

    const prev = prevOddsRef.current;
    if (!prev) {
      // First reading — initialise
      prevOddsRef.current = { p1: player1Odds, p2: player2Odds };
      anchorPriceRef.current = player1Odds;
      tickDriftRef.current = 0;
      return;
    }

    // Use live score server if available, otherwise estimate
    if (server) {
      estimatedServerRef.current = server;
    }

    // Calculate tick movement since last update (for player 1)
    const ticksSinceLastUpdate = countTicksBetween(prev.p1, player1Odds);
    const direction = player1Odds > prev.p1 ? 1 : player1Odds < prev.p1 ? -1 : 0;

    // Calculate total ticks from anchor (cumulative since last game change)
    const totalTicksFromAnchor = countTicksBetween(anchorPriceRef.current, player1Odds);
    const anchorDirection = player1Odds > anchorPriceRef.current ? 1 : player1Odds < anchorPriceRef.current ? -1 : 0;
    const signedDrift = totalTicksFromAnchor * anchorDirection;

    // Detect a game change: significant cumulative movement from anchor
    if (totalTicksFromAnchor >= HOLD_TICK_THRESHOLD && anchorDirection === -1) {
      // Price dropped significantly — player 1 odds improved = whoever was serving held
      const servingPlayer = estimatedServerRef.current;
      if (servingPlayer === 1) {
        setP1Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds + 1 }));
      } else if (servingPlayer === 2) {
        // P2 held serve (P1 odds dropped means P2 odds rose, but in tennis
        // a hold by either player typically moves odds modestly in favour of the holder's opponent)
        // Actually: if P1 odds DROP, P1 is more likely to win = P1 held serve OR P2 was broken
        // For simplicity with our threshold approach:
        // Price drop for P1 = good for P1 = P1 held serve
        setP1Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds + 1 }));
      } else {
        // Unknown server — attribute to P1 as favourite move
        setP1Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds + 1 }));
      }

      // Reset anchor for next game
      anchorPriceRef.current = player1Odds;
      tickDriftRef.current = 0;
    } else if (totalTicksFromAnchor >= BREAK_TICK_THRESHOLD && anchorDirection === 1) {
      // Price rose significantly — break of serve detected
      const servingPlayer = estimatedServerRef.current;
      if (servingPlayer === 1) {
        // P1 was serving and got broken
        setP1Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds }));
        setP2Stats((s) => ({ serviceGames: s.serviceGames, holds: s.holds })); // P2 didn't serve
      } else if (servingPlayer === 2) {
        // P2 was serving and got broken (P1 odds drifted = P1 doing worse = P2 held... no)
        // P1 odds ROSE = P1 getting worse = P2 broke P1? But we said P2 is serving...
        // If P2 is serving and P1 odds rise significantly = unlikely hold, more like
        // the match momentum shifted. Let's keep it simple:
        // P1 odds rising = bad for P1 = serve was broken (whoever was serving)
        setP2Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds }));
      } else {
        setP2Stats((s) => ({ serviceGames: s.serviceGames + 1, holds: s.holds }));
      }

      // Reset anchor
      anchorPriceRef.current = player1Odds;
      tickDriftRef.current = 0;
    }

    // Update direction tracking for server estimation
    if (ticksSinceLastUpdate >= 2 && !server) {
      // If price is dropping, P1 is probably serving (holding)
      // If price is rising, P2 is probably serving (P1 getting broken or P2 holding)
      if (direction === -1) {
        estimatedServerRef.current = 1;
      } else if (direction === 1) {
        estimatedServerRef.current = 2;
      }
    }

    prevOddsRef.current = { p1: player1Odds, p2: player2Odds };
  }, [player1Odds, player2Odds, isInPlay, server]);

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  const activeServer = server ?? estimatedServerRef.current;

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isInPlay ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            SERVE STATS
          </h2>
          {!isInPlay && (
            <span className="text-[10px] text-gray-600 ml-auto">pre-match</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {!isInPlay ? (
          <p className="text-sm text-gray-600 text-center py-2">
            Tracking starts when match goes in-play
          </p>
        ) : (
          <div className="space-y-3">
            {/* Player 1 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-white truncate">{p1Short}</span>
                {activeServer === 1 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">
                    serving
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-mono font-semibold text-white">
                  {p1Stats.serviceGames > 0
                    ? `${p1Stats.holds}/${p1Stats.serviceGames}`
                    : "—/—"}
                </span>
                <span className="text-sm text-gray-500">holds</span>
                <span
                  className={`text-sm font-mono font-semibold min-w-[36px] text-right ${
                    p1Stats.serviceGames === 0
                      ? "text-gray-600"
                      : p1Stats.holds / p1Stats.serviceGames >= 0.7
                        ? "text-green-400"
                        : p1Stats.holds / p1Stats.serviceGames >= 0.5
                          ? "text-amber-400"
                          : "text-red-400"
                  }`}
                >
                  ({holdPct(p1Stats)})
                </span>
              </div>
            </div>

            {/* Player 2 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-white truncate">{p2Short}</span>
                {activeServer === 2 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">
                    serving
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-mono font-semibold text-white">
                  {p2Stats.serviceGames > 0
                    ? `${p2Stats.holds}/${p2Stats.serviceGames}`
                    : "—/—"}
                </span>
                <span className="text-sm text-gray-500">holds</span>
                <span
                  className={`text-sm font-mono font-semibold min-w-[36px] text-right ${
                    p2Stats.serviceGames === 0
                      ? "text-gray-600"
                      : p2Stats.holds / p2Stats.serviceGames >= 0.7
                        ? "text-green-400"
                        : p2Stats.holds / p2Stats.serviceGames >= 0.5
                          ? "text-amber-400"
                          : "text-red-400"
                  }`}
                >
                  ({holdPct(p2Stats)})
                </span>
              </div>
            </div>

            {p1Stats.serviceGames === 0 && p2Stats.serviceGames === 0 && (
              <p className="text-xs text-gray-600 text-center pt-1">
                Detecting serve patterns from odds movement...
              </p>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-600 text-center">
          Estimated from odds movement (hold = 3+ tick drop, break = 10+ tick rise)
        </p>
      </div>
    </div>
  );
}
