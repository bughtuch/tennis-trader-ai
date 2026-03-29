"use client";

import { useMemo } from "react";

/* ─── Types ─── */

interface MarketInput {
  id: string;
  tournament: string;
  player1: { name: string; odds: number | null };
  player2: { name: string; odds: number | null };
  isLive: boolean;
  matchedVolume: string;
}

interface RankedMatch {
  market: MarketInput;
  score: number;
  stars: number;
  liquidityOk: boolean;
  oddsInRange: boolean;
  evenness: number; // 0-1, 1 = perfectly even
  volumeNum: number;
  strategies: string[];
}

/* ─── Constants ─── */

const MIN_LIQUIDITY = 10_000; // £10K
const ODDS_LOW = 1.3;
const ODDS_HIGH = 3.5;
const TOP_N = 5;
const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];

/* ─── Helpers ─── */

function parseVolume(vol: string): number {
  const cleaned = vol.replace(/[£,]/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*(K|M)?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "M") return num * 1_000_000;
  if (suffix === "K") return num * 1_000;
  return num;
}

function calcEvenness(odds1: number, odds2: number): number {
  // Perfect evenness = both at 2.00
  // Evenness = 1 - |implied_prob1 - 0.5| * 2
  const ip1 = 1 / odds1;
  const ip2 = 1 / odds2;
  const total = ip1 + ip2;
  const normP1 = ip1 / total; // normalised probability 0-1
  return 1 - Math.abs(normP1 - 0.5) * 2;
}

function suggestStrategies(odds1: number, odds2: number, isLive: boolean): string[] {
  const strats: string[] = [];
  const fav = Math.min(odds1, odds2);
  const dog = Math.max(odds1, odds2);

  if (isLive) {
    // Live-specific strategies
    if (fav >= 1.5 && fav <= 2.5) {
      strats.push("Lay set winner on break");
    }
    if (dog >= 2.0 && dog <= 3.5) {
      strats.push("Back server at inflated odds");
    }
    if (fav >= 1.3 && fav <= 1.8) {
      strats.push("Watch for overreaction lay");
    }
  } else {
    // Pre-match
    if (fav >= 1.5 && dog <= 3.0) {
      strats.push("Back favourite pre-match, lay in-play");
    }
    if (dog >= 2.5 && dog <= 3.5) {
      strats.push("Back underdog for value");
    }
  }

  if (fav >= 1.8 && fav <= 2.2) {
    strats.push("Even match — scalp both sides");
  }

  if (strats.length === 0) {
    strats.push("Monitor for setup");
  }

  return strats;
}

function scoreMarket(m: MarketInput): RankedMatch {
  const volumeNum = parseVolume(m.matchedVolume);
  const liquidityOk = volumeNum >= MIN_LIQUIDITY;

  const odds1 = m.player1.odds;
  const odds2 = m.player2.odds;
  const hasOdds = odds1 != null && odds2 != null && odds1 > 1.01 && odds2 > 1.01;

  const oddsInRange = hasOdds
    ? odds1! >= ODDS_LOW && odds1! <= ODDS_HIGH && odds2! >= ODDS_LOW && odds2! <= ODDS_HIGH
    : false;

  const evenness = hasOdds ? calcEvenness(odds1!, odds2!) : 0;

  // Scoring: 0-100
  let score = 0;

  // Liquidity: 0-40 points
  if (liquidityOk) {
    const volScore = Math.min(volumeNum / 200_000, 1); // Max at £200K
    score += 15 + volScore * 25; // 15 base + up to 25 bonus
  }

  // Odds range: 0-30 points
  if (hasOdds && oddsInRange) {
    score += 30;
  } else if (hasOdds) {
    // Partially in range
    const fav = Math.min(odds1!, odds2!);
    const dog = Math.max(odds1!, odds2!);
    if (fav >= 1.1 && dog <= 5.0) score += 10;
  }

  // Evenness: 0-20 points
  score += evenness * 20;

  // Live bonus: 10 points
  if (m.isLive) score += 10;

  const strategies = hasOdds
    ? suggestStrategies(odds1!, odds2!, m.isLive)
    : ["Waiting for odds"];

  // Star rating: 1-5
  const stars = score >= 70 ? 5 : score >= 55 ? 4 : score >= 40 ? 3 : score >= 25 ? 2 : 1;

  return {
    market: m,
    score,
    stars,
    liquidityOk,
    oddsInRange,
    evenness,
    volumeNum,
    strategies,
  };
}

function starDisplay(count: number): string {
  return "★".repeat(count) + "☆".repeat(5 - count);
}

/* ─── Component ─── */

interface MatchSelectionGuideProps {
  markets: MarketInput[];
}

export default function MatchSelectionGuide({ markets }: MatchSelectionGuideProps) {
  const ranked = useMemo(() => {
    if (markets.length === 0) return [];
    const scored = markets.map(scoreMarket);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, TOP_N);
  }, [markets]);

  if (ranked.length === 0) return null;

  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <h2 className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">
            MATCH SELECTION GUIDE
          </h2>
          <span className="text-[10px] text-gray-600 ml-auto">
            Top {ranked.length} of {markets.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-800/30">
        {ranked.map((r, i) => {
          const p1Short = r.market.player1.name.split(" ").pop() ?? r.market.player1.name;
          const p2Short = r.market.player2.name.split(" ").pop() ?? r.market.player2.name;
          const lowLiquidity = !r.liquidityOk;

          return (
            <div
              key={r.market.id}
              className={`px-4 py-3 ${lowLiquidity ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                {/* Medal / Rank */}
                <span className="text-sm font-medium shrink-0 w-6 text-center mt-0.5">
                  {MEDALS[i]}
                </span>

                {/* Match Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Players + Stars */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">
                      {p1Short} vs {p2Short}
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        r.stars >= 4
                          ? "text-green-400"
                          : r.stars >= 3
                            ? "text-amber-400"
                            : "text-gray-500"
                      }`}
                    >
                      {starDisplay(r.stars)}
                    </span>
                    {r.market.isLive && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-green-400">LIVE</span>
                      </span>
                    )}
                  </div>

                  {/* Details row */}
                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    {r.market.player1.odds != null && r.market.player2.odds != null && (
                      <span className="font-mono text-gray-400">
                        {r.market.player1.odds.toFixed(2)} / {r.market.player2.odds.toFixed(2)}
                      </span>
                    )}
                    <span className="text-gray-700">|</span>
                    <span className={`font-mono ${r.liquidityOk ? "text-gray-400" : "text-red-400"}`}>
                      {r.market.matchedVolume}
                    </span>
                    {!r.liquidityOk && (
                      <span className="text-[10px] text-red-400/80">Low liquidity</span>
                    )}
                    <span className="text-gray-700">|</span>
                    <span className="text-gray-500">
                      Even: {Math.round(r.evenness * 100)}%
                    </span>
                  </div>

                  {/* Strategy suggestions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.strategies.map((s, si) => (
                      <span
                        key={si}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-gray-800/50">
        <p className="text-[10px] text-gray-600 text-center">
          Ranked by liquidity, odds range (1.30–3.50), and match evenness
        </p>
      </div>
    </div>
  );
}
