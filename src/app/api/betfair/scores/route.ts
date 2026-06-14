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
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function getHeaders(sessionToken: string, appKey: string) {
  return {
    "X-Authentication": sessionToken,
    "X-Application": appKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { eventId, player1, player2 } = await req.json();

    if (!eventId) {
      console.warn("[Betfair Scores] REJECT: missing eventId");
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const sessionToken = await getVendorSession();
    if (!sessionToken) {
      console.warn("[Betfair Scores] REJECT: no vendor session");
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      console.warn("[Betfair Scores] REJECT: BETFAIR_APP_KEY not configured");
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const headers = getHeaders(sessionToken, appKey);

    console.log(
      `[Betfair Scores] Fetching for eventId=${eventId} "${player1}" vs "${player2}"`
    );

    // Parallel calls: listScores + listIncidents
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

    // Parse scores response
    const scoresData = await scoresRes.json();

    if (scoresData.error) {
      const errName =
        scoresData.error?.data?.exceptionname ?? scoresData.error?.message;
      console.warn("[Betfair Scores] API error:", errName);
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const scoresList: any[] = scoresData.result ?? [];
    if (scoresList.length === 0) {
      console.log("[Betfair Scores] No scores for eventId:", eventId);
      return NextResponse.json({ available: false } as ScoreResponse);
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

    // The Betfair Scores API returns data in a structured format.
    // Extract from the top-level score object.
    const homeScore = scores.score?.home;
    const awayScore = scores.score?.away;

    if (!homeScore || !awayScore) {
      // Try alternative flat format
      const p1SetsWon = scores.player1SetsWon ?? scores.score?.home?.sets;
      if (p1SetsWon === undefined) {
        console.warn("[Betfair Scores] No parseable score data");
        return NextResponse.json({ available: false } as ScoreResponse);
      }
    }

    // Parse set scores - try multiple formats
    let sets: number[][] = [];
    let p1GamesCurrentSet = 0;
    let p2GamesCurrentSet = 0;
    let gameScore: string[] = ["", ""];

    // Format 1: Structured score with home/away
    if (homeScore && awayScore) {
      // Per-set scores may be in sets array or setScores
      const homeSets = homeScore.sets;
      const awaySets = awayScore.sets;
      const homeGames = homeScore.games;
      const awayGames = awayScore.games;

      // Build set scores from individual set data if available
      if (Array.isArray(homeScore.setScores) && Array.isArray(awayScore.setScores)) {
        for (let i = 0; i < homeScore.setScores.length; i++) {
          sets.push([
            Number(homeScore.setScores[i]) || 0,
            Number(awayScore.setScores[i]) || 0,
          ]);
        }
      } else if (typeof homeSets === "number" && typeof awaySets === "number") {
        // Only total sets won, need to reconstruct from other fields
        // Check for comma-separated set scores
        const homeSetScores = scores.player1SetScores ?? homeScore.setScoreString;
        const awaySetScores = scores.player2SetScores ?? awayScore.setScoreString;
        if (typeof homeSetScores === "string" && homeSetScores) {
          const h = homeSetScores.split(",").map(Number);
          const a = (awaySetScores ?? "").split(",").map(Number);
          sets = h.map((s: number, i: number) => [s, a[i] ?? 0]);
        }
      }

      // Current set games
      p1GamesCurrentSet = Number(homeGames) || 0;
      p2GamesCurrentSet = Number(awayGames) || 0;

      // If sets array doesn't include current set, add it
      if (
        sets.length === 0 ||
        (p1GamesCurrentSet > 0 || p2GamesCurrentSet > 0)
      ) {
        const totalSetsHome = Number(homeSets) || 0;
        const totalSetsAway = Number(awaySets) || 0;
        const completedSets = sets.filter(
          (s) =>
            (s[0] >= 6 || s[1] >= 6) &&
            (Math.abs(s[0] - s[1]) >= 2 || (s[0] === 7 || s[1] === 7))
        ).length;

        if (
          sets.length === 0 ||
          completedSets === sets.length
        ) {
          // Add current set in progress
          if (p1GamesCurrentSet > 0 || p2GamesCurrentSet > 0) {
            if (completedSets < sets.length) {
              // Update last set
              sets[sets.length - 1] = [p1GamesCurrentSet, p2GamesCurrentSet];
            } else {
              sets.push([p1GamesCurrentSet, p2GamesCurrentSet]);
            }
          } else if (sets.length === 0 && (totalSetsHome > 0 || totalSetsAway > 0)) {
            // No per-set data, just push zeros for current set
            sets.push([0, 0]);
          }
        }
      }

      // Game score (points within current game)
      const homePoints = homeScore.score ?? scores.player1PointsWon;
      const awayPoints = awayScore.score ?? scores.player2PointsWon;
      if (homePoints !== undefined && awayPoints !== undefined) {
        gameScore = [String(homePoints), String(awayPoints)];
      }
    }

    // Format 2: Flat format with player1/player2 fields
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

    // If we still have no sets but have games, create a first set
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
          // Flatten if nested under event
          const allIncidents = incidents.flatMap(
            (inc: any) => inc.incidents ?? [inc]
          );
          // Find highest-sequence incident with server info
          const sorted = allIncidents
            .filter((i: any) => i.server !== undefined)
            .sort(
              (a: any, b: any) =>
                (b.updateSequence ?? b.sequence ?? 0) -
                (a.updateSequence ?? a.sequence ?? 0)
            );

          if (sorted.length > 0) {
            const serverId = sorted[0].server;
            const homeId = scores.score?.home?.id ?? scores.player1;
            // server matches home player → server = 1
            if (String(serverId) === String(homeId)) {
              server = 1;
            } else {
              server = 2;
            }
          }
        }
      } catch (err) {
        console.warn("[Betfair Scores] Failed to parse incidents:", err);
      }
    }

    // Also check for server in score data directly
    if (server === undefined) {
      if (scores.score?.serve !== undefined) {
        server = scores.score.serve === "home" ? 1 : 2;
      } else if (scores.currentServer !== undefined) {
        const homeId = scores.score?.home?.id ?? scores.player1;
        server = String(scores.currentServer) === String(homeId) ? 1 : 2;
      }
    }

    // Use current set for analysis
    const currentSet =
      sets.length > 0 ? sets[sets.length - 1] : [0, 0];
    const p1Games = currentSet[0];
    const p2Games = currentSet[1];
    const setsWonP1 = sets.filter(
      (s, i) => i < sets.length - 1 && s[0] > s[1]
    ).length;
    const setsWonP2 = sets.filter(
      (s, i) => i < sets.length - 1 && s[1] > s[0]
    ).length;

    // Tiebreak detection
    const tiebreak = p1Games >= 6 && p2Games >= 6;
    let tiebreakScore: string[] | undefined;
    if (tiebreak && gameScore[0] !== "" && gameScore[1] !== "") {
      const g1Num = Number(gameScore[0]);
      const g2Num = Number(gameScore[1]);
      if (Number.isFinite(g1Num) && Number.isFinite(g2Num)) {
        tiebreakScore = gameScore;
      }
    }

    // Point analysis: break / set / match point
    const g1 = gameScore[0];
    const g2 = gameScore[1];
    const returnerIsP1 = server === 2;
    const returnerIsP2 = server === 1;

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

    // Determine match status
    const isLive = scores.isLive ?? scores.score?.isLive;
    const matchStatus = isLive === false ? "FINISHED" : "IN_PROGRESS";

    // Score confidence
    let scoreConfidence: ScoreConfidence = "reliable";
    if (sets.length === 0) {
      scoreConfidence = "estimated";
    }

    const result: ScoreResponse = {
      available: sets.length > 0 || server !== undefined,
      sets: sets.length > 0 ? sets : undefined,
      gameScore:
        gameScore[0] !== "" || gameScore[1] !== "" ? gameScore : undefined,
      server,
      matchStatus,
      breakPoint,
      setPoint,
      matchPoint,
      tiebreak,
      tiebreakScore,
      scoreConfidence,
    };

    console.log(
      `[Betfair Scores] SUCCESS: sets=${JSON.stringify(result.sets)} game=${JSON.stringify(result.gameScore)} server=${result.server} bp=${breakPoint} sp=${setPoint} mp=${matchPoint}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Betfair Scores] Error:", error);
    return NextResponse.json({ available: false } as ScoreResponse);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
