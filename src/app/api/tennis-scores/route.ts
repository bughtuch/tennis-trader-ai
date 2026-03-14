import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

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
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.TENNIS_SCORES_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ available: false } as ScoreResponse);
  }

  try {
    const { player1, player2 } = await req.json();

    if (!player1 || !player2) {
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    // Search for live match by player names
    const searchRes = await fetch(
      `https://api.api-tennis.com/tennis/?method=get_events&event_live=1&APIkey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!searchRes.ok) {
      console.error("[Tennis Scores] API error:", searchRes.status);
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    const data = await searchRes.json();

    if (!data.result || !Array.isArray(data.result)) {
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    // Find match by player name substring match
    const p1Lower = player1.toLowerCase();
    const p2Lower = player2.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = data.result.find((m: any) => {
      const home = (m.event_home_player || "").toLowerCase();
      const away = (m.event_away_player || "").toLowerCase();
      return (
        (home.includes(p1Lower) || p1Lower.includes(home.split(" ").pop() || "")) &&
        (away.includes(p2Lower) || p2Lower.includes(away.split(" ").pop() || ""))
      ) || (
        (home.includes(p2Lower) || p2Lower.includes(home.split(" ").pop() || "")) &&
        (away.includes(p1Lower) || p1Lower.includes(away.split(" ").pop() || ""))
      );
    });

    if (!match) {
      return NextResponse.json({ available: false } as ScoreResponse);
    }

    // Determine player order: does p1 match home or away?
    const homeLower = (match.event_home_player || "").toLowerCase();
    const p1IsHome =
      homeLower.includes(p1Lower) ||
      p1Lower.includes((homeLower.split(" ").pop() || ""));

    // Parse set scores
    const sets: number[][] = [];
    for (let i = 1; i <= 5; i++) {
      const homeSet = match[`event_home_player_set${i}`];
      const awaySet = match[`event_away_player_set${i}`];
      if (homeSet !== undefined && homeSet !== "" && homeSet !== null) {
        const h = Number(homeSet);
        const a = Number(awaySet);
        if (p1IsHome) {
          sets.push([h, a]);
        } else {
          sets.push([a, h]);
        }
      }
    }

    // Parse game score
    const homeGame = match.event_home_player_game ?? "";
    const awayGame = match.event_away_player_game ?? "";
    const gameScore = p1IsHome
      ? [String(homeGame), String(awayGame)]
      : [String(awayGame), String(homeGame)];

    // Server: api-tennis uses event_serve for who is serving (home/away)
    let server: 1 | 2 | undefined;
    if (match.event_serve) {
      const homeServing = match.event_serve === "home";
      if (p1IsHome) {
        server = homeServing ? 1 : 2;
      } else {
        server = homeServing ? 2 : 1;
      }
    }

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
      const homeTB = match.event_home_player_tiebreak ?? "";
      const awayTB = match.event_away_player_tiebreak ?? "";
      if (homeTB !== "" || awayTB !== "") {
        tiebreakScore = p1IsHome
          ? [String(homeTB), String(awayTB)]
          : [String(awayTB), String(homeTB)];
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

    // Check if returner has a point advantage (simplified)
    const pointOrder = ["0", "15", "30", "40", "AD"];
    const p1Idx = pointOrder.indexOf(g1);
    const p2Idx = pointOrder.indexOf(g2);

    if (!tiebreak && p1Idx >= 0 && p2Idx >= 0) {
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

    const result: ScoreResponse = {
      available: true,
      sets,
      gameScore,
      server,
      matchStatus: match.event_status || "IN_PROGRESS",
      breakPoint,
      setPoint,
      matchPoint,
      tiebreak,
      tiebreakScore,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Tennis Scores] Error:", error);
    return NextResponse.json({ available: false } as ScoreResponse);
  }
}
