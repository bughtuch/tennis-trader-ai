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
}

/* ─── Component ─── */

export default function LiveScoreBar({
  player1Name,
  player2Name,
  isInPlay,
  score,
}: LiveScoreBarProps) {
  const displaySets = score?.sets;
  const displayServer = score?.server;

  const p1Short = player1Name.split(" ").pop() ?? "P1";
  const p2Short = player2Name.split(" ").pop() ?? "P2";
  const serverName = displayServer === 1 ? p1Short : displayServer === 2 ? p2Short : undefined;

  const currentSet = displaySets?.[displaySets.length - 1];
  const currentSetNumber = displaySets?.length ?? 0;
  const currentSetGames = (currentSet?.[0] ?? 0) + (currentSet?.[1] ?? 0);

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
      </div>

      {!isInPlay ? (
        <div className="px-4 py-5 text-center">
          <div className="text-gray-600 text-sm">Waiting for match to go in-play</div>
        </div>
      ) : !score ? (
        <div className="px-4 py-5 text-center">
          <div className="text-amber-500/70 text-sm font-medium">Score unavailable</div>
        </div>
      ) : (
        <div className="px-4 py-3">
          {/* Scoreboard */}
          <div className="space-y-1.5">
            {/* Player 1 row */}
            <div className="flex items-center gap-3">
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 1 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p1Short}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                {displaySets!.map((s, i) => {
                  const isCurrentSet = i === displaySets!.length - 1;
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
              <div className="w-3 flex justify-center flex-shrink-0">
                {displayServer === 2 && (
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">
                  {p2Short}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                {displaySets!.map((s, i) => {
                  const isCurrentSet = i === displaySets!.length - 1;
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
            {serverName && (
              <>
                <span className="text-gray-700">|</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {serverName} serving
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
