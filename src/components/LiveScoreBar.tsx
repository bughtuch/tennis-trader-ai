"use client";

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
  /** Real score data from API. No score = "unavailable". */
  score?: LiveScoreData;
  gameScore?: string[];
  tiebreak?: boolean;
  tiebreakScore?: string[];
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  provider?: string;
}

/* ─── Component ─── */

export default function LiveScoreBar({
  player1Name,
  player2Name,
  isInPlay,
  score,
  gameScore,
  tiebreak,
  tiebreakScore,
  breakPoint,
  setPoint,
  matchPoint,
  provider,
}: LiveScoreBarProps) {
  const displaySets = score?.sets;
  const displayServer = score?.server;

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";

  /* Per-player game/tiebreak scores */
  const isTiebreak = !!(tiebreak && tiebreakScore);
  const p1GameScore = isTiebreak ? tiebreakScore![0] : gameScore?.[0] ?? null;
  const p2GameScore = isTiebreak ? tiebreakScore![1] : gameScore?.[1] ?? null;
  const hasGameScore = p1GameScore !== null;

  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl overflow-hidden max-w-md mx-auto">
      {!isInPlay ? (
        <div className="px-5 py-6 text-center">
          <div className="text-gray-600 text-sm">Waiting for match to go in-play</div>
        </div>
      ) : !score ? (
        <div className="px-5 py-6 text-center">
          <div className="text-amber-500/70 text-sm font-medium">Score unavailable</div>
        </div>
      ) : (
        <div className="px-4 py-3.5">
          {/* Scoreboard rows */}
          <div className="space-y-1">
            {/* Player 1 row */}
            <div className="flex items-center gap-2.5 py-1">
              {/* Server indicator */}
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 1 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              {/* Player name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p1Short}
                </span>
              </div>
              {/* Set scores */}
              <div className="flex items-center gap-1.5 font-mono">
                {displaySets!.map((s, i) => {
                  const isCurrentSet = i === displaySets!.length - 1;
                  const won = s[0] > s[1] && !isCurrentSet;
                  return (
                    <span
                      key={i}
                      className={`text-base font-bold min-w-[24px] text-center ${
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
              {/* Game score */}
              {hasGameScore && (
                <div className="min-w-[56px] text-right">
                  <span className="text-base font-bold font-mono text-yellow-400">
                    {p1GameScore}
                  </span>
                </div>
              )}
              {/* Situation badge (only on P1 row) */}
              <div className="flex-shrink-0 min-w-[70px] text-right">
                {matchPoint && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 animate-pulse">
                    MATCH PT
                  </span>
                )}
                {setPoint && !matchPoint && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 animate-pulse">
                    SET PT
                  </span>
                )}
                {breakPoint && !setPoint && !matchPoint && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 animate-pulse">
                    BREAK PT
                  </span>
                )}
              </div>
            </div>

            {/* Subtle separator */}
            <div className="border-t border-gray-800/40" />

            {/* Player 2 row */}
            <div className="flex items-center gap-2.5 py-1">
              {/* Server indicator */}
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 2 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              {/* Player name */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p2Short}
                </span>
              </div>
              {/* Set scores */}
              <div className="flex items-center gap-1.5 font-mono">
                {displaySets!.map((s, i) => {
                  const isCurrentSet = i === displaySets!.length - 1;
                  const won = s[1] > s[0] && !isCurrentSet;
                  return (
                    <span
                      key={i}
                      className={`text-base font-bold min-w-[24px] text-center ${
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
              {/* Game score */}
              {hasGameScore && (
                <div className="min-w-[56px] text-right">
                  <span className="text-base font-bold font-mono text-yellow-400">
                    {p2GameScore}
                  </span>
                </div>
              )}
              {/* Empty badge space for alignment */}
              <div className="flex-shrink-0 min-w-[70px]" />
            </div>
          </div>

          {/* Tiebreak label */}
          {isTiebreak && (
            <div className="mt-2 pt-1.5 border-t border-gray-800/40 text-center">
              <span className="text-[11px] text-gray-400 font-medium">TIEBREAK</span>
            </div>
          )}

          {/* Provider label */}
          {provider && (
            <div className="mt-1 text-center">
              <span className="text-[9px] text-gray-500 font-medium">
                via {provider === "betfair" ? "Betfair" : provider === "api-tennis" ? "API-Tennis" : provider}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
