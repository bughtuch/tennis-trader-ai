"use client";

import { useState, useMemo } from "react";
import { moveByTicks, roundToTick } from "@/lib/tradingMaths";

interface GameMatrixProps {
  playerName: string;
  currentOdds: number;
  server?: 1 | 2;
  selectedPlayer: "player1" | "player2";
  gameScore?: string[];
}

/* Tennis game score points */
const POINTS = ["0", "15", "30", "40"] as const;

interface ScoreNode {
  label: string;
  serverPts: string;
  returnerPts: string;
  winLabel: string;
  loseLabel: string;
  isHold: boolean;
  isBreak: boolean;
  isBreakPoint: boolean;
  isDeuce: boolean;
}

/* Build all possible score states in a game */
function buildScoreNodes(): ScoreNode[] {
  const nodes: ScoreNode[] = [];

  // Regular scores: 0-0 through 30-30
  for (let s = 0; s <= 3; s++) {
    for (let r = 0; r <= 3; r++) {
      if (s === 3 && r === 3) continue; // 40-40 is deuce
      const sp = POINTS[s];
      const rp = POINTS[r];
      const label = `${sp}-${rp}`;

      let winLabel: string;
      let loseLabel: string;
      let isHold = false;
      let isBreak = false;

      if (s === 3) {
        // Server at 40
        winLabel = "hold";
        isHold = true;
        if (r < 3) {
          loseLabel = `40-${POINTS[r + 1] ?? "40"}`;
          if (r + 1 === 3) loseLabel = "Deuce";
        } else {
          loseLabel = "Deuce";
        }
      } else if (r === 3) {
        // Returner at 40
        winLabel = `${POINTS[s + 1]}-40`;
        if (s + 1 === 3) winLabel = "Deuce";
        loseLabel = "break";
        isBreak = true;
      } else {
        winLabel = `${POINTS[s + 1]}-${rp}`;
        loseLabel = `${sp}-${POINTS[r + 1]}`;
      }

      const isBreakPoint = r === 3 && s < 3;

      nodes.push({ label, serverPts: sp, returnerPts: rp, winLabel, loseLabel, isHold, isBreak, isBreakPoint, isDeuce: false });
    }
  }

  // Deuce
  nodes.push({ label: "Deuce", serverPts: "40", returnerPts: "40", winLabel: "Ad-In", loseLabel: "Ad-Out", isHold: false, isBreak: false, isBreakPoint: false, isDeuce: true });

  // Ad-In (server advantage)
  nodes.push({ label: "Ad-In", serverPts: "Ad", returnerPts: "40", winLabel: "hold", loseLabel: "Deuce", isHold: false, isBreak: false, isBreakPoint: false, isDeuce: false });

  // Ad-Out (returner advantage)
  nodes.push({ label: "Ad-Out", serverPts: "40", returnerPts: "Ad", winLabel: "Deuce", loseLabel: "break", isHold: false, isBreak: false, isBreakPoint: true, isDeuce: false });

  return nodes;
}

const SCORE_NODES = buildScoreNodes();

/* Tick movements per score transition */
function getTickDelta(node: ScoreNode, win: boolean): number {
  if (win) {
    if (node.label === "0-0") return -2;
    if (node.isHold || node.label === "Ad-In") return -3; // about to hold
    if (node.isBreakPoint) return -4; // saving break point
    if (node.isDeuce) return -2;
    return -2;
  } else {
    if (node.label === "0-0") return 3;
    if (node.isBreak || node.label === "Ad-Out") return 5; // about to break
    if (node.isBreakPoint) return 4;
    if (node.isDeuce) return 3;
    if (node.serverPts === "40") return 2; // already at 40, just extending
    return 3;
  }
}

export default function GameMatrix({
  playerName,
  currentOdds,
  server,
  selectedPlayer,
  gameScore,
}: GameMatrixProps) {
  const [collapsed, setCollapsed] = useState(true);

  const isServing = server === (selectedPlayer === "player1" ? 1 : 2);
  const servingLabel = isServing ? `${playerName} serving` : `${playerName} returning`;

  // Determine current game score for highlighting
  const currentScoreLabel = useMemo(() => {
    if (!gameScore || gameScore.length < 2) return null;
    const s = gameScore[0];
    const r = gameScore[1];
    if (s === "A" || r === "A") {
      if (isServing) return s === "A" ? "Ad-In" : "Ad-Out";
      return r === "A" ? "Ad-In" : "Ad-Out";
    }
    if (s === "40" && r === "40") return "Deuce";
    if (isServing) return `${s}-${r}`;
    return `${r}-${s}`;
  }, [gameScore, isServing]);

  // Calculate predicted odds at each score
  const matrix = useMemo(() => {
    if (!currentOdds || currentOdds <= 1.01) return [];

    // Build odds from 0-0 using current odds as the 0-0 baseline
    const baseOdds = roundToTick(currentOdds);

    return SCORE_NODES.map((node) => {
      // Calculate cumulative tick offset from 0-0
      // Simple heuristic: each server point won = -2 ticks, each lost = +3 ticks
      const sIdx = node.serverPts === "Ad" ? 3.5 : POINTS.indexOf(node.serverPts as typeof POINTS[number]);
      const rIdx = node.returnerPts === "Ad" ? 3.5 : POINTS.indexOf(node.returnerPts as typeof POINTS[number]);

      let offset = 0;
      if (node.isDeuce) {
        offset = 0; // Deuce ≈ 0-0 in terms of balanced
      } else if (node.label === "Ad-In") {
        offset = -2;
      } else if (node.label === "Ad-Out") {
        offset = 4;
      } else {
        offset = Math.round(((sIdx as number) * -2) + ((rIdx as number) * 3));
      }

      const scoreOdds = roundToTick(moveByTicks(baseOdds, offset));
      const winTicks = getTickDelta(node, true);
      const loseTicks = getTickDelta(node, false);
      const oddsIfWin = roundToTick(moveByTicks(scoreOdds, winTicks));
      const oddsIfLose = roundToTick(moveByTicks(scoreOdds, loseTicks));

      return {
        ...node,
        scoreOdds,
        oddsIfWin,
        oddsIfLose,
        isCurrent: node.label === currentScoreLabel,
      };
    });
  }, [currentOdds, currentScoreLabel]);

  if (!currentOdds || currentOdds <= 1.01) return null;

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden max-w-md mx-auto">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/20 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <div>
            <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
              GAME MATRIX
            </h2>
            <p className="text-[10px] text-gray-600">{servingLabel}</p>
          </div>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="border-t border-gray-800/50">
          {/* Header row */}
          <div className="grid grid-cols-[80px_1fr_1fr] gap-0 px-3 py-2 border-b border-gray-800/50 text-[9px] tracking-wider uppercase text-gray-500 font-medium">
            <span>Score</span>
            <span>Wins point</span>
            <span>Loses point</span>
          </div>

          {/* Score rows */}
          <div className="max-h-[360px] overflow-y-auto">
            {matrix.map((row) => {
              let rowBg = "";
              let rowBorder = "";
              if (row.isCurrent) {
                rowBg = "bg-green-500/8";
                rowBorder = "border-l-2 border-l-green-400";
              } else if (row.isBreakPoint) {
                rowBg = "bg-red-500/5";
                rowBorder = "border-l-2 border-l-red-400/50";
              } else if (row.isHold || row.label === "Ad-In") {
                rowBg = "bg-blue-500/5";
                rowBorder = "border-l-2 border-l-blue-400/30";
              } else {
                rowBorder = "border-l-2 border-l-transparent";
              }

              return (
                <div
                  key={row.label}
                  className={`grid grid-cols-[80px_1fr_1fr] gap-0 px-3 py-1.5 ${rowBg} ${rowBorder} border-b border-gray-800/20`}
                >
                  <span className={`text-xs font-mono font-semibold ${
                    row.isCurrent ? "text-green-400" :
                    row.isBreakPoint ? "text-red-400" :
                    row.isDeuce ? "text-amber-400" :
                    "text-gray-300"
                  }`}>
                    {row.label}
                  </span>
                  <div className="text-[11px]">
                    <span className="font-mono font-medium text-green-400">{row.oddsIfWin.toFixed(2)}</span>
                    <span className="text-gray-600 ml-1">
                      {row.winLabel === "hold"
                        ? "hold"
                        : `→${row.winLabel}`}
                    </span>
                  </div>
                  <div className="text-[11px]">
                    <span className="font-mono font-medium text-red-400">{row.oddsIfLose.toFixed(2)}</span>
                    <span className="text-gray-600 ml-1">
                      {row.loseLabel === "break"
                        ? "break"
                        : `→${row.loseLabel}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-3 py-2 text-[9px] text-gray-600 flex gap-4">
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1" />Current</span>
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />Break point</span>
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1" />Hold</span>
          </div>
        </div>
      )}
    </div>
  );
}
