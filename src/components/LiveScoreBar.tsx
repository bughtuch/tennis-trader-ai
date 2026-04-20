"use client";

import { useEffect, useRef, useState } from "react";
import { moveByTicks } from "@/lib/tradingMaths";

/* ─── Types ─── */

export interface LiveScoreData {
  sets: number[][]; // e.g. [[6,4], [3,2]]
  server?: 1 | 2;
}

interface LiveScoreBarProps {
  player1Name: string;
  player2Name: string;
  player1Odds: number;
  player2Odds: number;
  isInPlay: boolean;
  /** When provided, overrides the estimated score (for api-tennis.com later). */
  score?: LiveScoreData;
}

/* ─── Tick helpers ─── */

const GAME_TICK_THRESHOLD = 3;

function countTicksBetween(from: number, to: number): number {
  if (from <= 0 || to <= 0 || from === to) return 0;
  let count = 0;
  let current = from;
  const limit = 200;
  if (to > from) {
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

/* ─── Set logic helpers ─── */

function isSetComplete(p1Games: number, p2Games: number): boolean {
  // Standard set: first to 6 with 2-game lead
  if (p1Games >= 6 && p1Games - p2Games >= 2) return true;
  if (p2Games >= 6 && p2Games - p1Games >= 2) return true;
  // Tiebreak result: 7-6 or 6-7
  if (p1Games === 7 || p2Games === 7) return true;
  return false;
}

/* ─── Component ─── */

export default function LiveScoreBar({
  player1Name,
  player2Name,
  player1Odds,
  player2Odds,
  isInPlay,
  score,
}: LiveScoreBarProps) {
  // Estimated score state
  const [sets, setSets] = useState<number[][]>([[0, 0]]);
  const [estimatedServer, setEstimatedServer] = useState<1 | 2>(1);

  // Odds tracking refs
  const anchorRef = useRef<number>(0);
  const prevOddsRef = useRef<number>(0);
  const initialised = useRef(false);

  // Reset when match changes (odds jump to a new range pre-match)
  useEffect(() => {
    if (!isInPlay) {
      initialised.current = false;
      setSets([[0, 0]]);
      setEstimatedServer(1);
    }
  }, [isInPlay]);

  // Odds-based score estimation
  useEffect(() => {
    // Skip estimation if external score provided or not in-play
    if (score || !isInPlay || player1Odds <= 1.01) return;

    if (!initialised.current) {
      anchorRef.current = player1Odds;
      prevOddsRef.current = player1Odds;
      initialised.current = true;
      return;
    }

    const ticks = countTicksBetween(anchorRef.current, player1Odds);
    if (ticks < GAME_TICK_THRESHOLD) {
      prevOddsRef.current = player1Odds;
      return;
    }

    // Direction: price dropped → P1 won the game. Price rose → P2 won the game.
    const p1Won = player1Odds < anchorRef.current;

    setSets((prev) => {
      const updated = prev.map((s) => [...s]);
      const currentSetIdx = updated.length - 1;
      const current = updated[currentSetIdx];

      if (p1Won) {
        current[0]++;
      } else {
        current[1]++;
      }

      // Check if set is complete → start new set
      if (isSetComplete(current[0], current[1])) {
        updated.push([0, 0]);
      }

      return updated;
    });

    // Estimate server: alternate each game
    setEstimatedServer((prev) => (prev === 1 ? 2 : 1));

    // Reset anchor
    anchorRef.current = player1Odds;
    prevOddsRef.current = player1Odds;
  }, [player1Odds, player2Odds, isInPlay, score]);

  // Resolve display data: external score or estimated
  const displaySets = score?.sets ?? sets;
  const displayServer = score?.server ?? estimatedServer;

  // Derive current set info
  const completedSets = displaySets.filter(
    (s) => isSetComplete(s[0], s[1]) || (score && displaySets.indexOf(s) < displaySets.length - 1)
  );
  const currentSet = score
    ? displaySets[displaySets.length - 1]
    : displaySets[displaySets.length - 1];
  const currentSetNumber = displaySets.length;
  const currentSetGames = (currentSet?.[0] ?? 0) + (currentSet?.[1] ?? 0);

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";
  const serverName = displayServer === 1 ? p1Short : p2Short;

  const isEstimated = !score;

  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isInPlay ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            LIVE SCORE
          </span>
        </div>
        {isEstimated && isInPlay && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500/70">
            estimated
          </span>
        )}
      </div>

      {!isInPlay ? (
        <div className="px-4 py-5 text-center">
          <div className="text-gray-600 text-sm">Waiting for match to go in-play</div>
        </div>
      ) : (
        <div className="px-4 py-3">
          {/* Scoreboard */}
          <div className="space-y-1.5">
            {/* Player 1 row */}
            <div className="flex items-center gap-3">
              {/* Serving dot column */}
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 1 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              {/* Name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p1Short}
                </span>
              </div>
              {/* Set scores */}
              <div className="flex items-center gap-2 font-mono">
                {displaySets.map((s, i) => {
                  const isCurrentSet = i === displaySets.length - 1;
                  const won = s[0] > s[1] && !isCurrentSet;
                  return (
                    <span
                      key={i}
                      className={`text-lg font-bold min-w-[16px] text-center ${
                        isCurrentSet
                          ? "text-white"
                          : won
                            ? "text-green-400"
                            : "text-gray-500"
                      }`}
                    >
                      {s[0]}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Player 2 row */}
            <div className="flex items-center gap-3">
              {/* Serving dot column */}
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 2 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              {/* Name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p2Short}
                </span>
              </div>
              {/* Set scores */}
              <div className="flex items-center gap-2 font-mono">
                {displaySets.map((s, i) => {
                  const isCurrentSet = i === displaySets.length - 1;
                  const won = s[1] > s[0] && !isCurrentSet;
                  return (
                    <span
                      key={i}
                      className={`text-lg font-bold min-w-[16px] text-center ${
                        isCurrentSet
                          ? "text-white"
                          : won
                            ? "text-green-400"
                            : "text-gray-500"
                      }`}
                    >
                      {s[1]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status line */}
          <div className="mt-2.5 pt-2 border-t border-gray-800/50 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <span>Set {currentSetNumber}</span>
            <span className="text-gray-700">|</span>
            <span>Game {currentSetGames + 1}</span>
            <span className="text-gray-700">|</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {serverName} serving
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
