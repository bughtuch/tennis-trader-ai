import { NextRequest, NextResponse } from "next/server";
import { getVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

const SCORES_JSONRPC_URL =
  "https://api.betfair.com/exchange/scores/json-rpc/v1";

type ScoreConfidence = "reliable" | "estimated" | "unavailable";

interface ScoreResponse {
  available: boolean;
  sets?: number[][];
  gameScore?: string[];
  server?: 1 | 2;
  matchStatus?: string;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  tiebreakScore?: string[];
  scoreConfidence?: ScoreConfidence;
  provider?: "betfair" | "api-tennis" | "unavailable";
  reason?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ─── In-memory cache ─── */

const scoreCache = new Map<string, { data: ScoreResponse; at: number }>();
const CACHE_TTL_MS = 5_000;

/* ─── Betfair helpers ─── */

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/* ─── api-tennis.com helpers ─── */

function getPlayerNames(m: any): { home: string; away: string } {
  const home = m.event_home_player || m.event_first_player || "";
  const away = m.event_away_player || m.event_second_player || "";
  return { home, away };
}

function extractSetScores(match: any, p1IsHome: boolean): number[][] {
  const sets: number[][] = [];
  for (let i = 1; i <= 5; i++) {
    const homeSet = match[`event_home_player_set${i}`] ?? match[`event_first_player_set${i}`];
    const awaySet = match[`event_away_player_set${i}`] ?? match[`event_second_player_set${i}`];
    if (homeSet !== undefined && homeSet !== "" && homeSet !== null) {
      const h = Number(homeSet);
      const a = Number(awaySet);
      if (p1IsHome) { sets.push([h, a]); } else { sets.push([a, h]); }
    }
  }
  if (sets.length === 0 && Array.isArray(match.scores)) {
    for (const s of match.scores) {
      const first = Number(s.score_first ?? s.score_home ?? 0);
      const second = Number(s.score_second ?? s.score_away ?? 0);
      if (p1IsHome) { sets.push([first, second]); } else { sets.push([second, first]); }
    }
  }
  return sets;
}

function extractGameScore(match: any, p1IsHome: boolean): string[] {
  const homeGame = match.event_home_player_game ?? match.event_first_player_game ?? null;
  const awayGame = match.event_away_player_game ?? match.event_second_player_game ?? null;
  if (homeGame !== null || awayGame !== null) {
    const hg = String(homeGame ?? "");
    const ag = String(awayGame ?? "");
    return p1IsHome ? [hg, ag] : [ag, hg];
  }
  if (match.event_game_result) {
    const parts = String(match.event_game_result).split(/\s*-\s*/);
    if (parts.length === 2) {
      return p1IsHome ? [parts[0].trim(), parts[1].trim()] : [parts[1].trim(), parts[0].trim()];
    }
  }
  return ["", ""];
}

function extractServerFromMatch(match: any, p1IsHome: boolean): 1 | 2 | undefined {
  if (!match.event_serve) return undefined;
  const serve = String(match.event_serve).toLowerCase();
  const homeServing = serve === "home" || serve === "first_player" || serve === "1";
  const awayServing = serve === "away" || serve === "second_player" || serve === "2";
  if (homeServing) return p1IsHome ? 1 : 2;
  if (awayServing) return p1IsHome ? 2 : 1;
  const { home } = getPlayerNames(match);
  if (home && serve.includes(home.toLowerCase().split(" ").pop() || "___")) {
    return p1IsHome ? 1 : 2;
  }
  return p1IsHome ? 2 : 1;
}

/* ─── Validation helpers ─── */

const VALID_GAME_SCORES = new Set(["0", "15", "30", "40", "AD", "A", ""]);
const MAX_GAMES_IN_SET = 13;

function isValidSetScore(p1: number, p2: number): boolean {
  if (!Number.isFinite(p1) || !Number.isFinite(p2)) return false;
  if (p1 < 0 || p2 < 0) return false;
  if (p1 > MAX_GAMES_IN_SET || p2 > MAX_GAMES_IN_SET) return false;
  return true;
}

function validateAndClampSets(sets: number[][], maxSets: number): { sets: number[][]; confidence: ScoreConfidence } {
  if (sets.length === 0) return { sets: [], confidence: "unavailable" };
  let confidence: ScoreConfidence = "reliable";
  if (sets.length > maxSets) { sets = sets.slice(0, maxSets); confidence = "estimated"; }
  for (const set of sets) {
    if (!isValidSetScore(set[0], set[1])) {
      confidence = "estimated";
      set[0] = Math.max(0, Math.min(set[0] || 0, MAX_GAMES_IN_SET));
      set[1] = Math.max(0, Math.min(set[1] || 0, MAX_GAMES_IN_SET));
    }
  }
  return { sets, confidence };
}

function isValidGameScore(score: string): boolean {
  if (VALID_GAME_SCORES.has(score.toUpperCase())) return true;
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

/* ─── Point analysis (shared by both providers) ─── */

function analyzePoints(
  gameScore: string[],
  sets: number[][],
  server: 1 | 2 | undefined,
  tiebreak: boolean,
) {
  const g1 = gameScore[0];
  const g2 = gameScore[1];
  const returnerIsP1 = server === 2;
  const returnerIsP2 = server === 1;

  const currentSet = sets.length > 0 ? sets[sets.length - 1] : [0, 0];
  const p1Games = currentSet[0];
  const p2Games = currentSet[1];
  const completedSets = sets.slice(0, -1);
  const setsWonP1 = completedSets.filter((s) => s[0] > s[1]).length;
  const setsWonP2 = completedSets.filter((s) => s[1] > s[0]).length;

  let breakPoint = false;
  let setPoint = false;
  let matchPoint = false;

  if (tiebreak) {
    const tb1 = Number(g1);
    const tb2 = Number(g2);
    if (Number.isFinite(tb1) && Number.isFinite(tb2)) {
      if (tb1 >= 6 && tb1 - tb2 >= 1) setPoint = true;
      if (tb2 >= 6 && tb2 - tb1 >= 1) setPoint = true;
      if (setPoint) {
        if (tb1 > tb2 && setsWonP1 >= 1) matchPoint = true;
        if (tb2 > tb1 && setsWonP2 >= 1) matchPoint = true;
      }
    }
  } else {
    const pointOrder = ["0", "15", "30", "40", "AD"];
    const p1Idx = pointOrder.indexOf(g1);
    const p2Idx = pointOrder.indexOf(g2);

    if (p1Idx >= 0 && p2Idx >= 0) {
      const p1GamePt = p1Idx >= 3 && p1Idx > p2Idx;
      const p2GamePt = p2Idx >= 3 && p2Idx > p1Idx;

      if (p1GamePt && returnerIsP1) breakPoint = true;
      if (p2GamePt && returnerIsP2) breakPoint = true;

      const p1WouldWinSet = p1Games >= 5 && p1Games > p2Games;
      const p2WouldWinSet = p2Games >= 5 && p2Games > p1Games;

      if (p1GamePt && p1WouldWinSet) setPoint = true;
      if (p2GamePt && p2WouldWinSet) setPoint = true;

      const p1WouldWinMatch = p1WouldWinSet && setsWonP1 >= 1;
      const p2WouldWinMatch = p2WouldWinSet && setsWonP2 >= 1;

      if (p1GamePt && p1WouldWinMatch) matchPoint = true;
      if (p2GamePt && p2WouldWinMatch) matchPoint = true;
    }
  }

  return { breakPoint, setPoint, matchPoint };
}

/* ─── Provider 1: Betfair Scores API ─── */

async function tryBetfairScores(
  eventId: string,
  player1: string,
  player2: string,
): Promise<ScoreResponse | null> {
  const sessionToken = await getVendorSession();
  if (!sessionToken) {
    console.warn("[Betfair Scores] No vendor session");
    return null;
  }

  const appKey = process.env.BETFAIR_APP_KEY;
  if (!appKey) {
    console.warn("[Betfair Scores] BETFAIR_APP_KEY not configured");
    return null;
  }

  const headers = getHeaders(sessionToken, appKey);

  console.log(`[Betfair Scores] Fetching for eventId=${eventId} "${player1}" vs "${player2}"`);

  const [scoresRes, incidentsRes] = await Promise.all([
    fetch(SCORES_JSONRPC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ScoresAPING/v1.0/listScores",
        params: { updateKeys: [{ eventId: String(eventId) }] },
        id: 1,
      }),
    }),
    fetch(SCORES_JSONRPC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ScoresAPING/v1.0/listIncidents",
        params: { updateKeys: [{ eventId: String(eventId) }] },
        id: 2,
      }),
    }).catch((err) => {
      console.warn("[Betfair Scores] listIncidents failed:", err);
      return null;
    }),
  ]);

  const scoresData = await scoresRes.json();

  if (scoresData.error) {
    const errName = scoresData.error?.data?.exceptionname ?? scoresData.error?.message;
    console.warn("[Betfair Scores] API error:", errName);
    return null; // fall through to next provider
  }

  const scoresList: any[] = scoresData.result ?? [];
  if (scoresList.length === 0) {
    console.log("[Betfair Scores] No scores for eventId:", eventId);
    return null;
  }

  const scores = scoresList[0];
  console.log(
    "[Betfair Scores] Raw scores:",
    JSON.stringify({
      isLive: scores.isLive,
      p1Sets: scores.score?.home?.sets,
      p2Sets: scores.score?.away?.sets,
      p1Games: scores.score?.home?.games,
      p2Games: scores.score?.away?.games,
      p1Points: scores.score?.home?.score,
      p2Points: scores.score?.away?.score,
      numberOfSets: scores.score?.numberOfSets,
    })
  );

  const homeScore = scores.score?.home;
  const awayScore = scores.score?.away;

  if (!homeScore || !awayScore) {
    const p1SetsWon = scores.player1SetsWon ?? scores.score?.home?.sets;
    if (p1SetsWon === undefined) {
      console.warn("[Betfair Scores] No parseable score data");
      return null;
    }
  }

  // Parse set scores
  let sets: number[][] = [];
  let p1GamesCurrentSet = 0;
  let p2GamesCurrentSet = 0;
  let gameScore: string[] = ["", ""];

  if (homeScore && awayScore) {
    const homeSets = homeScore.sets;
    const awaySets = awayScore.sets;
    const homeGames = homeScore.games;
    const awayGames = awayScore.games;

    if (Array.isArray(homeScore.setScores) && Array.isArray(awayScore.setScores)) {
      for (let i = 0; i < homeScore.setScores.length; i++) {
        sets.push([Number(homeScore.setScores[i]) || 0, Number(awayScore.setScores[i]) || 0]);
      }
    } else if (typeof homeSets === "number" && typeof awaySets === "number") {
      const homeSetScores = scores.player1SetScores ?? homeScore.setScoreString;
      const awaySetScores = scores.player2SetScores ?? awayScore.setScoreString;
      if (typeof homeSetScores === "string" && homeSetScores) {
        const h = homeSetScores.split(",").map(Number);
        const a = (awaySetScores ?? "").split(",").map(Number);
        sets = h.map((s: number, i: number) => [s, a[i] ?? 0]);
      }
    }

    p1GamesCurrentSet = Number(homeGames) || 0;
    p2GamesCurrentSet = Number(awayGames) || 0;

    if (
      sets.length === 0 ||
      (p1GamesCurrentSet > 0 || p2GamesCurrentSet > 0)
    ) {
      const totalSetsHome = Number(homeSets) || 0;
      const totalSetsAway = Number(awaySets) || 0;
      const completedSets = sets.filter(
        (s) =>
          (s[0] >= 6 || s[1] >= 6) &&
          (Math.abs(s[0] - s[1]) >= 2 || s[0] === 7 || s[1] === 7)
      ).length;

      if (sets.length === 0 || completedSets === sets.length) {
        if (p1GamesCurrentSet > 0 || p2GamesCurrentSet > 0) {
          if (completedSets < sets.length) {
            sets[sets.length - 1] = [p1GamesCurrentSet, p2GamesCurrentSet];
          } else {
            sets.push([p1GamesCurrentSet, p2GamesCurrentSet]);
          }
        } else if (sets.length === 0 && (totalSetsHome > 0 || totalSetsAway > 0)) {
          sets.push([0, 0]);
        }
      }
    }

    const homePoints = homeScore.score ?? scores.player1PointsWon;
    const awayPoints = awayScore.score ?? scores.player2PointsWon;
    if (homePoints !== undefined && awayPoints !== undefined) {
      gameScore = [String(homePoints), String(awayPoints)];
    }
  }

  // Flat format fallback
  if (sets.length === 0) {
    const p1SetScores = scores.player1SetScores;
    const p2SetScores = scores.player2SetScores;
    if (typeof p1SetScores === "string" && p1SetScores) {
      const p1 = p1SetScores.split(",").map(Number);
      const p2 = (p2SetScores ?? "").split(",").map(Number);
      sets = p1.map((s: number, i: number) => [s, p2[i] ?? 0]);
    }
    const p1Pts = scores.player1PointsWon;
    const p2Pts = scores.player2PointsWon;
    if (p1Pts !== undefined && p2Pts !== undefined) {
      gameScore = [String(p1Pts), String(p2Pts)];
    }
    p1GamesCurrentSet = Number(scores.player1GamesWon) || 0;
    p2GamesCurrentSet = Number(scores.player2GamesWon) || 0;
  }

  if (sets.length === 0 && (p1GamesCurrentSet > 0 || p2GamesCurrentSet > 0)) {
    sets.push([p1GamesCurrentSet, p2GamesCurrentSet]);
  }

  // Parse server from incidents
  let server: 1 | 2 | undefined;
  if (incidentsRes) {
    try {
      const incidentsData = await incidentsRes.json();
      const incidents: any[] = incidentsData.result ?? [];
      if (incidents.length > 0) {
        const allIncidents = incidents.flatMap((inc: any) => inc.incidents ?? [inc]);
        const sorted = allIncidents
          .filter((i: any) => i.server !== undefined)
          .sort((a: any, b: any) => (b.updateSequence ?? b.sequence ?? 0) - (a.updateSequence ?? a.sequence ?? 0));
        if (sorted.length > 0) {
          const serverId = sorted[0].server;
          const homeId = scores.score?.home?.id ?? scores.player1;
          if (String(serverId) === String(homeId)) { server = 1; } else { server = 2; }
        }
      }
    } catch (err) {
      console.warn("[Betfair Scores] Failed to parse incidents:", err);
    }
  }

  if (server === undefined) {
    if (scores.score?.serve !== undefined) {
      server = scores.score.serve === "home" ? 1 : 2;
    } else if (scores.currentServer !== undefined) {
      const homeId = scores.score?.home?.id ?? scores.player1;
      server = String(scores.currentServer) === String(homeId) ? 1 : 2;
    }
  }

  // Tiebreak detection
  const currentSet = sets.length > 0 ? sets[sets.length - 1] : [0, 0];
  const p1Games = currentSet[0];
  const p2Games = currentSet[1];
  const tiebreak = p1Games >= 6 && p2Games >= 6;
  let tiebreakScore: string[] | undefined;
  if (tiebreak && gameScore[0] !== "" && gameScore[1] !== "") {
    const g1Num = Number(gameScore[0]);
    const g2Num = Number(gameScore[1]);
    if (Number.isFinite(g1Num) && Number.isFinite(g2Num)) {
      tiebreakScore = gameScore;
    }
  }

  // Point analysis
  const { breakPoint, setPoint, matchPoint } = analyzePoints(gameScore, sets, server, tiebreak);

  const isLive = scores.isLive ?? scores.score?.isLive;
  const matchStatus = isLive === false ? "FINISHED" : "IN_PROGRESS";
  let scoreConfidence: ScoreConfidence = "reliable";
  if (sets.length === 0) scoreConfidence = "estimated";

  const result: ScoreResponse = {
    available: sets.length > 0 || server !== undefined,
    sets: sets.length > 0 ? sets : undefined,
    gameScore: gameScore[0] !== "" || gameScore[1] !== "" ? gameScore : undefined,
    server,
    matchStatus,
    breakPoint,
    setPoint,
    matchPoint,
    tiebreak,
    tiebreakScore,
    scoreConfidence,
    provider: "betfair",
  };

  console.log(
    `[Betfair Scores] SUCCESS: sets=${JSON.stringify(result.sets)} game=${JSON.stringify(result.gameScore)} server=${result.server} bp=${breakPoint} sp=${setPoint} mp=${matchPoint}`
  );

  return result;
}

/* ─── Provider 2: api-tennis.com fallback ─── */

async function tryApiTennis(
  player1: string,
  player2: string,
): Promise<ScoreResponse | null> {
  const apiKey = process.env.TENNIS_SCORES_API_KEY;
  if (!apiKey) {
    console.log("[API-Tennis Fallback] Skipped: TENNIS_SCORES_API_KEY not configured");
    return null;
  }

  if (!player1 || !player2) {
    console.warn("[API-Tennis Fallback] Skipped: missing player names");
    return null;
  }

  console.log(`[API-Tennis Fallback] Fetching for: "${player1}" vs "${player2}"`);

  const searchRes = await fetch(
    `https://api.api-tennis.com/tennis/?method=get_events&event_live=1&APIkey=${encodeURIComponent(apiKey)}`,
    { headers: { Accept: "application/json" } }
  );

  if (!searchRes.ok) {
    console.error("[API-Tennis Fallback] API HTTP error:", searchRes.status, searchRes.statusText);
    return null;
  }

  const data = await searchRes.json();

  if (!data.result || !Array.isArray(data.result)) {
    console.warn("[API-Tennis Fallback] API returned no results array. success:", data.success);
    return null;
  }

  console.log(`[API-Tennis Fallback] API returned ${data.result.length} live events`);

  // Match by player name — strict then last-name fallback
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

  let matches = data.result.filter((m: any) => {
    const { home, away } = getPlayerNames(m);
    return playersMatchStrict(home.toLowerCase(), away.toLowerCase());
  });

  if (matches.length === 0) {
    matches = data.result.filter((m: any) => {
      const { home, away } = getPlayerNames(m);
      return playersMatchLastName(home.toLowerCase(), away.toLowerCase());
    });
    if (matches.length > 0) {
      console.log(`[API-Tennis Fallback] Last-name fallback matched ${matches.length} events`);
    }
  }

  if (matches.length === 0) {
    const liveNames = data.result.slice(0, 5).map((m: any) => {
      const { home, away } = getPlayerNames(m);
      return `"${home}" vs "${away}"`;
    });
    console.warn(`[API-Tennis Fallback] No player match. Looking for "${player1}" vs "${player2}". Live (first 5): ${liveNames.join("; ")}`);
    return null;
  }
  if (matches.length > 1) {
    console.warn(`[API-Tennis Fallback] Ambiguous match — ${matches.length} events for "${player1}" vs "${player2}"`);
    return null;
  }

  const match = matches[0];
  console.log(`[API-Tennis Fallback] Matched event. Raw fields:`, JSON.stringify(
    Object.fromEntries(
      Object.entries(match).filter(([k]) =>
        k.includes("set") || k.includes("game") || k.includes("serve") || k.includes("score") || k.includes("status") || k.includes("tiebreak")
      )
    )
  ));

  // Determine player order
  const { home: homePlayer } = getPlayerNames(match);
  const homeLower = homePlayer.toLowerCase();
  const p1IsHome =
    homeLower.includes(p1Lower) ||
    (p1Lower.split(" ").pop()!.length >= 3 && (homeLower.split(" ").pop() || "").includes(p1Lower.split(" ").pop()!));

  const sets = extractSetScores(match, p1IsHome);
  const gameScore = extractGameScore(match, p1IsHome);
  const server = extractServerFromMatch(match, p1IsHome);

  console.log(`[API-Tennis Fallback] Parsed: sets=${JSON.stringify(sets)} game=${JSON.stringify(gameScore)} server=${server} p1IsHome=${p1IsHome}`);

  // Tiebreak detection
  const currentSet = sets.length > 0 ? sets[sets.length - 1] : [0, 0];
  const p1Games = currentSet[0];
  const p2Games = currentSet[1];
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
    if (!tiebreakScore && gameScore[0] !== "" && gameScore[1] !== "") {
      const g1Num = Number(gameScore[0]);
      const g2Num = Number(gameScore[1]);
      if (Number.isFinite(g1Num) && Number.isFinite(g2Num)) {
        tiebreakScore = gameScore;
      }
    }
  }

  // Point analysis
  const { breakPoint, setPoint, matchPoint } = analyzePoints(gameScore, sets, server, tiebreak);

  // Validate
  const validated = validateAndClampSets(sets, 5);
  const validatedGame = validateGameScore(gameScore);

  let scoreConfidence: ScoreConfidence = "reliable";
  if (validated.sets.length === 0) {
    scoreConfidence = "estimated";
  } else if (validated.confidence !== "reliable") {
    scoreConfidence = "estimated";
  }
  if (!validatedGame.valid && validatedGame.gameScore.some(g => g !== "")) {
    console.warn(`[API-Tennis Fallback] Invalid game score: ${JSON.stringify(gameScore)} — clearing`);
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
    provider: "api-tennis",
  };

  console.log(`[API-Tennis Fallback] SUCCESS: confidence=${scoreConfidence} sets=${JSON.stringify(result.sets)} game=${JSON.stringify(result.gameScore)} server=${result.server} bp=${breakPoint} sp=${setPoint} mp=${matchPoint}`);

  return result;
}

/* ─── Main handler ─── */

export async function POST(req: NextRequest) {
  try {
    const { eventId, player1, player2 } = await req.json();

    if (!eventId) {
      console.warn("[Scores] REJECT: missing eventId");
      return NextResponse.json({ available: false, provider: "unavailable", reason: "Missing eventId" } as ScoreResponse);
    }

    // Check cache
    const cacheKey = eventId || `${player1}:${player2}`;
    const cached = scoreCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      console.log(`[Scores] Cache HIT for ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    // Try 1: Betfair Scores API
    let result: ScoreResponse | null = null;
    try {
      result = await tryBetfairScores(String(eventId), player1, player2);
    } catch (err) {
      console.warn("[Betfair Scores] Exception:", err);
    }

    // Try 2: api-tennis.com fallback
    if (!result) {
      try {
        result = await tryApiTennis(player1, player2);
      } catch (err) {
        console.warn("[API-Tennis Fallback] Exception:", err);
      }
    }

    // Final fallback
    if (!result) {
      result = {
        available: false,
        provider: "unavailable",
        reason: "No score provider available (Betfair key not entitled, no TENNIS_SCORES_API_KEY)",
      };
    }

    // Cache the result
    scoreCache.set(cacheKey, { data: result, at: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Scores] Error:", error);
    return NextResponse.json({ available: false, provider: "unavailable", reason: "Internal error" } as ScoreResponse);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
