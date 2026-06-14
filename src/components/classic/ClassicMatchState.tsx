"use client";

import type { ScoreConfidence } from "@/lib/tennisContext";

interface ClassicMatchStateProps {
  player1Name: string;
  player2Name: string;
  sets?: number[][];
  gameScore?: string[];
  server?: 1 | 2;
  tiebreak?: boolean;
  tiebreakScore?: string[];
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  isInPlay: boolean;
  isSuspended: boolean;
  scoreConfidence: ScoreConfidence;
  isScoreStale: boolean;
  scoreAvailable: boolean;
  provider?: string;
}

export default function ClassicMatchState({
  player1Name,
  player2Name,
  sets,
  gameScore,
  server,
  tiebreak,
  tiebreakScore,
  breakPoint,
  setPoint,
  matchPoint,
  isInPlay,
  isSuspended,
  scoreConfidence,
  isScoreStale,
  scoreAvailable,
  provider,
}: ClassicMatchStateProps) {
  // --- Pre-match ---
  if (!isInPlay && !isSuspended) {
    return (
      <div className="px-3 sm:px-4 py-1.5 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">Waiting for match to start</span>
      </div>
    );
  }

  // --- No score at all ---
  if (scoreConfidence === "unavailable" || !scoreAvailable) {
    return (
      <div className="px-3 sm:px-4 py-1.5 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">No reliable score available</span>
      </div>
    );
  }

  // --- Final set detection ---
  const completedSets = (sets ?? []).slice(0, -1);
  const setsWonP1 = completedSets.filter(s => s[0] > s[1]).length;
  const setsWonP2 = completedSets.filter(s => s[1] > s[0]).length;
  const isFinalSet = setsWonP1 > 0 && setsWonP2 > 0 && setsWonP1 === setsWonP2;

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  // --- Set score styling ---
  function setClass(setIndex: number, playerIndex: 0 | 1): string {
    const s = sets?.[setIndex];
    if (!s) return "text-gray-900 font-bold";
    const isCurrentSet = setIndex === (sets?.length ?? 1) - 1;
    if (isCurrentSet) return "text-gray-900 font-bold";
    // Completed set
    const won = playerIndex === 0 ? s[0] > s[1] : s[1] > s[0];
    return won ? "text-green-700" : "text-gray-400";
  }

  // --- Game score display ---
  function renderGameScore() {
    if (tiebreak && tiebreakScore && tiebreakScore.length === 2) {
      return (
        <div className="text-xs font-mono text-blue-700 font-semibold ml-2">
          <div>TB: {tiebreakScore[0]}</div>
          <div>TB: {tiebreakScore[1]}</div>
        </div>
      );
    }
    if (gameScore && gameScore.length === 2) {
      return (
        <div className="text-xs font-mono text-blue-700 font-semibold ml-2">
          <div>{gameScore[0]}</div>
          <div>{gameScore[1]}</div>
        </div>
      );
    }
    return null;
  }

  // --- Flags ---
  const flags: { label: string; style: string; pulse: boolean }[] = [];
  if (isSuspended) flags.push({ label: "SUSPENDED", style: "bg-red-100 text-red-600 border-red-200", pulse: true });
  if (matchPoint) flags.push({ label: "MATCH POINT", style: "bg-red-100 text-red-700 border-red-200", pulse: true });
  if (setPoint) flags.push({ label: "SET POINT", style: "bg-amber-100 text-amber-700 border-amber-200", pulse: true });
  if (breakPoint) flags.push({ label: "BREAK POINT", style: "bg-purple-100 text-purple-700 border-purple-200", pulse: false });
  if (tiebreak) flags.push({ label: "TIE BREAK", style: "bg-blue-100 text-blue-700 border-blue-200", pulse: false });
  if (isFinalSet) flags.push({ label: "FINAL SET", style: "bg-orange-100 text-orange-700 border-orange-200", pulse: false });

  return (
    <div className="px-3 sm:px-4 py-1.5 border-t border-gray-100">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* ─── Scoreboard (left) ─── */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Player names + serve dots */}
          <div className="flex flex-col text-xs leading-snug min-w-0">
            <div className="flex items-center gap-1">
              {server === 1 && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
              {server !== 1 && <span className="w-2 h-2 shrink-0" />}
              <span className="font-semibold text-gray-900 truncate">{p1Short}</span>
            </div>
            <div className="flex items-center gap-1">
              {server === 2 && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
              {server !== 2 && <span className="w-2 h-2 shrink-0" />}
              <span className="font-semibold text-gray-900 truncate">{p2Short}</span>
            </div>
          </div>

          {/* Set scores */}
          {sets && sets.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2">
              {sets.map((s, i) => (
                <div key={i} className="flex flex-col text-xs font-mono leading-snug text-center">
                  <span className={setClass(i, 0)}>{s[0]}</span>
                  <span className={setClass(i, 1)}>{s[1]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Game score */}
          {renderGameScore()}
        </div>

        {/* ─── Match State Flags (center) ─── */}
        {flags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {flags.map((f) => (
              <span
                key={f.label}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${f.style} ${f.pulse ? "animate-pulse" : ""}`}
              >
                {f.label}
              </span>
            ))}
          </div>
        )}

        {/* ─── Confidence (right) ─── */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {isScoreStale ? (
            <span className="text-[10px] font-medium text-amber-600">Score feed delayed</span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] font-semibold text-green-700">HIGH</span>
            </>
          )}
          {provider && (
            <span className="text-[9px] text-gray-400 ml-1">
              via {provider === "betfair" ? "Betfair" : provider === "api-tennis" ? "API-Tennis" : provider}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
