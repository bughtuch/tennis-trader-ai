import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type ScoreConfidence = "reliable" | "estimated" | "unavailable";

interface ScoreResponse {
  available: boolean;
  sets?: number[][];       // [[6,4],[3,2]] — [p1,p2] per set
  gameScore?: string[];    // ["40","30"] — [p1,p2]
  server?: 1 | 2;          // 1 = player1 serving, 2 = player2
  matchStatus?: string;    // "IN_PROGRESS" | "SUSPENDED" | "FINISHED"
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  tiebreakScore?: string[];  // ["4","3"] in tiebreak
  scoreConfidence?: ScoreConfidence;
}

/* ─── Tennis Score Validation ─── */

const VALID_GAME_SCORES = new Set(["0", "15", "30", "40", "AD", "A", ""]);
const MAX_GAMES_IN_SET = 13; // 7-6 tiebreak is max in normal play

function isValidSetScore(p1: number, p2: number): boolean {
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) return false;
  if (p1 < 0 || p2 < 0) return false;
  if (p1 > MAX_GAMES_IN_SET || p2 > MAX_GAMES_IN_SET) return false;
  return true;
}

function validateAndClampSets(sets: number[][], maxSets: number): { sets: number[][]; confidence: ScoreConfidence } {
  if (sets.length === 0) return { sets: [], confidence: "unavailable" };

  let confidence: ScoreConfidence = "reliable";

  // Clamp to max sets (best-of-3 = 3, best-of-5 = 5)
  if (sets.length > maxSets) {
    sets = sets.slice(0, maxSets);
    confidence = "estimated";
  }

  // Validate individual set scores
  for (const set of sets) {
    if (!isValidSetScore(set[0], set[1])) {
      confidence = "estimated";
      // Clamp to reasonable values
      set[0] = Math.max(0, Math.min(set[0] || 0, MAX_GAMES_IN_SET));
      set[1] = Math.max(0, Math.min(set[1] || 0, MAX_GAMES_IN_SET));
    }
  }

  return { sets, confidence };
}

function isValidGameScore(score: string): boolean {
  // Accept standard game scores AND tiebreak numeric scores (0-99)
  if (VALID_GAME_SCORES.has(score.toUpperCase())) return true;
  // Accept numeric tiebreak scores
  const num = Number(score);
  if (Number.isFinite(num) && num >= 0 && num <= 99) return true;
  return false;
}

function validateGameScore(gameScore: string[]): { gameScore: string[]; valid: boolean } {
  if (!gameScore || gameScore.length !== 2) return { gameScore: ["", ""], valid: false };
  const g1 = String(gameScore[0] ?? "");
  const g2 = String(gameScore[1] ?? "");
  const valid = isValidGameScore(g1) && isValidGameScore(g2);
  return { gameScore: [g1, g2], valid };
}

/**
 * Infer best-of format. Grand Slam men's singles = best-of-5, everything else = best-of-3.
 * Without tournament context, default to best-of-3 (more common).
 */
function inferMaxSets(): number {
  // Allow up to 5 to avoid false positives; real clamping is 5
  return 5;
}

/* ─── Set score normalization ─── */

/**
 * Parse a raw set score value into an integer games count.
 * Handles tiebreak notations from score providers:
 *   "6.4"  → 6  (decimal = tiebreak score)
 *   "7.7"  → 7
 *   "7(7)" → 7  (parenthetical tiebreak)
 *   "6(4)" → 6
 *   "6"    → 6  (normal)
 */
function parseSetScore(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  const str = String(raw).trim();
  // Strip parenthetical tiebreak notation: "7(7)" → "7"
  const stripped = str.replace(/\(.*\)/, "");
  // Use Math.floor to handle decimal tiebreak notation: "6.4" → 6
  const num = Number(stripped);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

/* ─── Field name compatibility ─── */
// api-tennis.com may use either event_home_player/event_away_player
// or event_first_player/event_second_player depending on endpoint version.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPlayerNames(m: any): { home: string; away: string } {
  const home = m.event_home_player || m.event_first_player || "";
  const away = m.event_away_player || m.event_second_player || "";
  return { home, away };
}

/* ─── Score extraction with field compatibility ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSetScores(match: any, p1IsHome: boolean): number[][] {
  const sets: number[][] = [];

  // Strategy 1: Try event_home_player_set1..5 fields (legacy format)
  for (let i = 1; i <= 5; i++) {
    const homeSet = match[`event_home_player_set${i}`] ?? match[`event_first_player_set${i}`];
    const awaySet = match[`event_away_player_set${i}`] ?? match[`event_second_player_set${i}`];
    if (homeSet !== undefined && homeSet !== "" && homeSet !== null) {
      const h = parseSetScore(homeSet);
      const a = parseSetScore(awaySet);
      if (p1IsHome) {
        sets.push([h, a]);
      } else {
        sets.push([a, h]);
      }
    }
  }

  // Strategy 2: If no sets found, try scores[] array format
  if (sets.length === 0 && Array.isArray(match.scores)) {
    for (const s of match.scores) {
      const first = parseSetScore(s.score_first ?? s.score_home ?? 0);
      const second = parseSetScore(s.score_second ?? s.score_away ?? 0);
      if (p1IsHome) {
        sets.push([first, second]);
      } else {
        sets.push([second, first]);
      }
    }
  }

  return sets;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGameScore(match: any, p1IsHome: boolean): string[] {
  // Strategy 1: Separate fields
  const homeGame = match.event_home_player_game ?? match.event_first_player_game ?? null;
  const awayGame = match.event_away_player_game ?? match.event_second_player_game ?? null;
  if (homeGame !== null || awayGame !== null) {
    const hg = String(homeGame ?? "");
    const ag = String(awayGame ?? "");
    return p1IsHome ? [hg, ag] : [ag, hg];
  }

  // Strategy 2: Combined event_game_result field (e.g. "40 - 30")
  if (match.event_game_result) {
    const parts = String(match.event_game_result).split(/\s*-\s*/);
    if (parts.length === 2) {
      return p1IsHome ? [parts[0].trim(), parts[1].trim()] : [parts[1].trim(), parts[0].trim()];
    }
  }

  return ["", ""];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractServer(match: any, p1IsHome: boolean): 1 | 2 | undefined {
  if (!match.event_serve) return undefined;
  // event_serve can be "home"/"away" or "first_player"/"second_player" or player name
  const serve = String(match.event_serve).toLowerCase();
  const homeServing = serve === "home" || serve === "first_player" || serve === "1";
  const awayServing = serve === "away" || serve === "second_player" || serve === "2";

  if (homeServing) return p1IsHome ? 1 : 2;
  if (awayServing) return p1IsHome ? 2 : 1;

  // If event_serve contains a player name, try matching
  const { home } = getPlayerNames(match);
  if (home && serve.includes(home.toLowerCase().split(" ").pop() || "___")) {
    return p1IsHome ? 1 : 2;
  }
  return p1IsHome ? 2 : 1; // default to away serving if unrecognised
}

export async function POST(req: NextRequest) {
  // Auth check — prevent unauthenticated API quota usage
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[Tennis Scores] REJECT: no auth");
    return NextResponse.json({ available: false } as ScoreResponse);
  }

  const apiKey = process.env.TENNIS_SCORES_API_KEY;

  if (!apiKey) {
    console.warn("[Tennis Scores] REJECT: TENNIS_SCORES_API_KEY not configured");
    return NextResponse.json({ available: false } as ScoreResponse);
  }

  try {
    const { player1, player2 } = await req.json();

    if (!player1 || !player2) {
      console.warn("[Tennis Scores] REJECT: missing player names");
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    console.log(`[Tennis Scores] Fetching for: "${player1}" vs "${player2}"`);

    // Search for live match by player names
    const searchRes = await fetch(
      `https://api.api-tennis.com/tennis/?method=get_events&event_live=1&APIkey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!searchRes.ok) {
      console.error("[Tennis Scores] API HTTP error:", searchRes.status, searchRes.statusText);
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const data = await searchRes.json();

    if (!data.result || !Array.isArray(data.result)) {
      console.warn("[Tennis Scores] API returned no results array. success:", data.success, "keys:", Object.keys(data));
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    console.log(`[Tennis Scores] API returned ${data.result.length} live events`);

    // Log first event's field names for diagnostics (once)
    if (data.result.length > 0) {
      const sample = data.result[0];
      const fieldKeys = Object.keys(sample).filter(k =>
        k.includes("player") || k.includes("score") || k.includes("serve") || k.includes("set") || k.includes("game")
      );
      console.log("[Tennis Scores] Sample event fields:", fieldKeys.join(", "));
      const { home, away } = getPlayerNames(sample);
      console.log(`[Tennis Scores] Sample players: "${home}" vs "${away}"`);
    }

    // Find match by player name — strict then last-name fallback
    const p1Lower = player1.toLowerCase();
    const p2Lower = player2.toLowerCase();

    function playersMatchStrict(home: string, away: string): boolean {
      return (
        (home.includes(p1Lower) && away.includes(p2Lower)) ||
        (home.includes(p2Lower) && away.includes(p1Lower))
      );
    }

    function playersMatchLastName(home: string, away: string): boolean {
      const homeLast = home.split(" ").pop() || "";
      const awayLast = away.split(" ").pop() || "";
      const p1Last = p1Lower.split(" ").pop() || "";
      const p2Last = p2Lower.split(" ").pop() || "";
      if (p1Last.length < 3 || p2Last.length < 3) return false;
      return (
        (homeLast.includes(p1Last) && awayLast.includes(p2Last)) ||
        (homeLast.includes(p2Last) && awayLast.includes(p1Last))
      );
    }

    // Step 1: Try strict full-name matching (using compatible field accessor)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matches = data.result.filter((m: any) => {
      const { home, away } = getPlayerNames(m);
      return playersMatchStrict(home.toLowerCase(), away.toLowerCase());
    });

    // Step 2: Fall back to last-name if no strict match
    if (matches.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matches = data.result.filter((m: any) => {
        const { home, away } = getPlayerNames(m);
        return playersMatchLastName(home.toLowerCase(), away.toLowerCase());
      });
      if (matches.length > 0) {
        console.log(`[Tennis Scores] Last-name fallback matched ${matches.length} events`);
      }
    }

    // Step 3: Require exactly 1 match — ambiguous = unavailable
    if (matches.length === 0) {
      // Log the first 5 live events for debugging name mismatches
      const liveNames = data.result.slice(0, 5).map((m: { event_home_player?: string; event_away_player?: string; event_first_player?: string; event_second_player?: string }) => {
        const { home, away } = getPlayerNames(m);
        return `"${home}" vs "${away}"`;
      });
      console.warn(`[Tennis Scores] REJECT: no player match. Looking for "${player1}" vs "${player2}". Live events (first 5): ${liveNames.join("; ")}`);
      return NextResponse.json({ available: false } as ScoreResponse);
    }
    if (matches.length > 1) {
      console.warn(`[Tennis Scores] REJECT: ambiguous match — ${matches.length} events matched for "${player1}" vs "${player2}"`);
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const match = matches[0];
    console.log(`[Tennis Scores] Matched event. Raw score-related fields:`, JSON.stringify(
      Object.fromEntries(
        Object.entries(match).filter(([k]) =>
          k.includes("set") || k.includes("game") || k.includes("serve") || k.includes("score") || k.includes("status") || k.includes("tiebreak")
        )
      )
    ));

    // Determine player order: does p1 match home or away?
    const { home: homePlayer } = getPlayerNames(match);
    const homeLower = homePlayer.toLowerCase();
    const p1IsHome =
      homeLower.includes(p1Lower) ||
      (p1Lower.split(" ").pop()!.length >= 3 && (homeLower.split(" ").pop() || "").includes(p1Lower.split(" ").pop()!));

    // Parse set scores (with field compatibility)
    const sets = extractSetScores(match, p1IsHome);

    // Parse game score (with field compatibility)
    const gameScore = extractGameScore(match, p1IsHome);

    // Server detection (with field compatibility)
    const server = extractServer(match, p1IsHome);

    console.log(`[Tennis Scores] Parsed: sets=${JSON.stringify(sets)} game=${JSON.stringify(gameScore)} server=${server} p1IsHome=${p1IsHome}`);

    // Detect break point, set point, match point
    const currentSet = sets.length > 0 ? sets[sets.length - 1] : [0, 0];
    const p1Games = currentSet[0];
    const p2Games = currentSet[1];
    const setsWonP1 = sets.filter((s) => s[0] > s[1]).length;
    const setsWonP2 = sets.filter((s) => s[1] > s[0]).length;

    // Tiebreak detection
    const tiebreak = p1Games >= 6 && p2Games >= 6;
    let tiebreakScore: string[] | undefined;
    if (tiebreak) {
      const homeTB = match.event_home_player_tiebreak ?? match.event_first_player_tiebreak ?? "";
      const awayTB = match.event_away_player_tiebreak ?? match.event_second_player_tiebreak ?? "";
      if (homeTB !== "" || awayTB !== "") {
        tiebreakScore = p1IsHome
          ? [String(homeTB), String(awayTB)]
          : [String(awayTB), String(homeTB)];
      }
      // If no dedicated tiebreak fields, use game score as tiebreak score
      if (!tiebreakScore && gameScore[0] !== "" && gameScore[1] !== "") {
        const g1Num = Number(gameScore[0]);
        const g2Num = Number(gameScore[1]);
        if (Number.isFinite(g1Num) && Number.isFinite(g2Num)) {
          tiebreakScore = gameScore;
        }
      }
    }

    // Point analysis for break/set/match point
    const g1 = gameScore[0];
    const g2 = gameScore[1];
    const returnerIsP1 = server === 2;
    const returnerIsP2 = server === 1;

    let breakPoint = false;
    let setPoint = false;
    let matchPoint = false;

    if (tiebreak) {
      // In tiebreak: check for set/match point based on numeric scores
      const tb1 = Number(g1);
      const tb2 = Number(g2);
      if (Number.isFinite(tb1) && Number.isFinite(tb2)) {
        const diff = tb1 - tb2;
        // Set point: player has 6+ and leads by 1+ (will win on next point)
        if (tb1 >= 6 && diff >= 1) { setPoint = true; }
        if (tb2 >= 6 && diff <= -1) { setPoint = true; }
        // Match point: set point + would win match
        if (setPoint) {
          if (tb1 > tb2 && setsWonP1 >= 1) matchPoint = true;
          if (tb2 > tb1 && setsWonP2 >= 1) matchPoint = true;
        }
      }
    } else {
      // Standard game scoring
      const pointOrder = ["0", "15", "30", "40", "AD"];
      const p1Idx = pointOrder.indexOf(g1);
      const p2Idx = pointOrder.indexOf(g2);

      if (p1Idx >= 0 && p2Idx >= 0) {
        // P1 has point to win game
        const p1GamePt = (p1Idx >= 3 && p1Idx > p2Idx);
        // P2 has point to win game
        const p2GamePt = (p2Idx >= 3 && p2Idx > p1Idx);

        if (p1GamePt && returnerIsP1) breakPoint = true;
        if (p2GamePt && returnerIsP2) breakPoint = true;

        // Set point: game point + would win set
        const p1WouldWinSet = p1Games >= 5 && p1Games > p2Games;
        const p2WouldWinSet = p2Games >= 5 && p2Games > p1Games;

        if (p1GamePt && p1WouldWinSet) setPoint = true;
        if (p2GamePt && p2WouldWinSet) setPoint = true;

        // Match point: set point + would win match
        const p1WouldWinMatch = p1WouldWinSet && setsWonP1 >= 1;
        const p2WouldWinMatch = p2WouldWinSet && setsWonP2 >= 1;

        if (p1GamePt && p1WouldWinMatch) matchPoint = true;
        if (p2GamePt && p2WouldWinMatch) matchPoint = true;
      }
    }

    // ─── Validate scores — PARTIAL display instead of binary rejection ───
    const maxSets = inferMaxSets();
    const validated = validateAndClampSets(sets, maxSets);
    const validatedGame = validateGameScore(gameScore);

    // Determine overall confidence
    let scoreConfidence: ScoreConfidence = "reliable";

    if (validated.sets.length === 0) {
      // No set scores at all — still return what we have (server, status)
      scoreConfidence = "estimated";
      console.warn("[Tennis Scores] No valid set scores parsed from API response");
    } else if (validated.confidence !== "reliable") {
      // Set scores required clamping
      scoreConfidence = "estimated";
      console.warn("[Tennis Scores] Set scores clamped, confidence: estimated");
    }

    if (!validatedGame.valid && validatedGame.gameScore.some(g => g !== "")) {
      // Game score invalid — DON'T reject entire response, just clear game score
      console.warn(`[Tennis Scores] Invalid game score: ${JSON.stringify(gameScore)} — clearing game score but keeping sets`);
      validatedGame.gameScore = ["", ""];
      if (scoreConfidence === "reliable") scoreConfidence = "estimated";
    }

    const result: ScoreResponse = {
      available: validated.sets.length > 0 || server !== undefined,
      sets: validated.sets.length > 0 ? validated.sets : undefined,
      gameScore: validatedGame.gameScore[0] !== "" || validatedGame.gameScore[1] !== "" ? validatedGame.gameScore : undefined,
      server,
      matchStatus: match.event_status || "IN_PROGRESS",
      breakPoint,
      setPoint,
      matchPoint,
      tiebreak,
      tiebreakScore,
      scoreConfidence,
    };

    console.log(`[Tennis Scores] SUCCESS: confidence=${scoreConfidence} sets=${JSON.stringify(result.sets)} game=${JSON.stringify(result.gameScore)} server=${result.server} bp=${breakPoint} sp=${setPoint} mp=${matchPoint}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Tennis Scores] Error:", error);
    return NextResponse.json({ available: false } as ScoreResponse);
  }
}
