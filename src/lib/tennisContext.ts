/* ─── Tennis Context Helpers ─── */

/**
 * Infer playing surface from tournament name.
 * Falls back to provided surface, then "hard" as default.
 */
export function inferSurface(tournament: string | undefined, providedSurface: string | undefined): string {
  const t = (tournament ?? "").toLowerCase();

  // Clay tournaments
  if (
    t.includes("french open") || t.includes("roland garros") ||
    t.includes("monte carlo") || t.includes("rome") || t.includes("internazionali") ||
    t.includes("madrid") || t.includes("barcelona") || t.includes("hamburg") ||
    t.includes("buenos aires") || t.includes("rio") || t.includes("estoril") ||
    t.includes("lyon") || t.includes("bastad") || t.includes("gstaad") ||
    t.includes("umag") || t.includes("kitzbuhel") || t.includes("kitzbühel")
  ) return "clay";

  // Grass tournaments
  if (
    t.includes("wimbledon") ||
    t.includes("queen") || t.includes("halle") ||
    t.includes("eastbourne") || t.includes("s-hertogenbosch") ||
    t.includes("mallorca") || t.includes("stuttgart") && t.includes("grass")
  ) return "grass";

  // Known hard-court grand slams
  if (t.includes("australian open") || t.includes("us open")) return "hard";

  // Use provided surface if available
  if (providedSurface && providedSurface.toLowerCase() !== "unknown") {
    return providedSurface.toLowerCase();
  }

  return "hard";
}

/**
 * Get surface-specific trading context for AI prompts.
 */
export function getSurfaceContext(surface: string): string {
  switch (surface.toLowerCase()) {
    case "clay":
      return "Clay surface: longer rallies reduce pure serve dominance. Return-game pressure and physical endurance matter more. Breaks of serve are more common, so price swings on breaks are smaller. Favourites tend to grind out wins — lay opportunities come from slow starts, not momentum collapses.";
    case "grass":
      return "Grass surface: shorter points amplify serve dominance. Hold percentages are high, so breaks are rare and cause larger price moves. Tiebreaks are more likely — prepare for compressed odds late in sets. First-strike tennis matters; rallies are less common.";
    default:
      return "Hard court: balanced surface. Serve advantage exists but rallies still develop. Standard break/hold dynamics. Price movements follow serve-game patterns predictably.";
  }
}

/**
 * Shared guardrail rules appended to all AI system prompts.
 * Prevents generic financial language, team-sport references,
 * and surface mismatches.
 */
export const TENNIS_PROMPT_GUARDRAILS = `
STRICT RULES — violating these makes the output useless to the trader:
- NEVER mention "team news", "squad", "lineup", "formation", or any team-sport concept. Tennis is an individual sport with two players.
- NEVER use generic financial jargon like "market volatility", "portfolio diversification", "risk-reward ratio", "bull/bear", "P/E ratio". You are a Betfair exchange trader, not a stockbroker.
- NEVER reference a surface that doesn't match the tournament. If the tournament is French Open or Roland Garros, the surface is CLAY — never reference hard-court records.
- NEVER use vague momentum or sentiment language: "follow the momentum", "positive momentum", "bullish", "bearish", "strong trend", "good opportunity", "attractive opportunity", "looks promising", "market likes", "market loves", "market hates". These are meaningless to a trader. Reference specific scoreboard events that explain price movement.
- Use tennis exchange trading language: hold of serve, break of serve, second serve pressure, return games, tiebreak pressure, clay-court rallies, hard-court serve dominance, grass-court short points, momentum after break, price shortening, price drifting, favourite, underdog, exchange pressure, weight of money, ladder depth.
- Think in terms of individual player form, serve/return stats, surface-specific patterns, and scoreboard pressure — not team dynamics.`.trim();

/* ─── Banned Phrases (post-processing defense-in-depth) ─── */

export const BANNED_PHRASES = [
  "follow the momentum", "positive momentum", "bullish", "bearish",
  "strong trend", "good opportunity", "attractive opportunity",
  "looks promising", "market likes", "market loves", "market hates",
];

/* ─── Structured AI Signal Types ─── */

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface StructuredAISignal {
  matchState: string;
  marketState: string;
  reason: string;
  traderFocus: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  edgeSize: "none" | "mild" | "moderate" | "strong";
  tradeSignal?: {
    entry: string;
    reason: string;
    risk: string;
    invalidation: string;
  };
}

/* ─── Mandatory Output Format for AI ─── */

export const MANDATORY_OUTPUT_FORMAT = `
You MUST respond with valid JSON matching this exact structure:
{
  "matchState": "<exact score and server from context — never invent data>",
  "marketState": "<current prices and movement using ONLY provided odds — never invent prices>",
  "reason": "<specific tennis event explaining the price movement — reference scoreboard>",
  "traderFocus": "<what the trader should watch next — specific game/point situation>",
  "confidence": "<LOW | MEDIUM | HIGH>",
  "confidenceReason": "<why this confidence level — reference data quality/situation>",
  "edgeSize": "<none | mild | moderate | strong>",
  "tradeSignal": {
    "entry": "<specific price and direction>",
    "reason": "<why enter here — reference scoreboard event>",
    "risk": "<what could go wrong — specific tennis scenario>",
    "invalidation": "<price level or event that cancels this trade>"
  }
}

RULES:
- matchState MUST use the exact score and server provided in context. If no score provided, state "Pre-match" or "Score unavailable".
- marketState MUST use ONLY the prices provided. Never invent or assume prices.
- reason MUST reference a specific tennis event (break of serve, hold, tiebreak point, etc).
- If any required data is missing, set ALL text fields to "Insufficient live data for analysis" and confidence to "LOW".
- tradeSignal is optional — only include if there is a genuine edge. Omit the field entirely if no edge exists.
- Be concise. No section should exceed 2 sentences.
- Do NOT wrap the JSON in markdown code fences. Return raw JSON only.
`.trim();

/* ─── Format Match Context for Prompt ─── */

/**
 * Rich match context formatter that includes ALL Sprint 4 fields.
 * Used in system/user prompts for maximum AI grounding.
 */
export function formatMatchContextForPrompt(ctx: MatchContext): string {
  const lines: string[] = [];

  lines.push(`Market status: ${ctx.marketStatus.replace("_", "-")}.`);

  if (ctx.isScoreStale) {
    lines.push("WARNING: Score data may be STALE (not updated recently). Treat with caution.");
  }

  if (ctx.scoreConfidence === "unavailable" || !ctx.formattedScore) {
    lines.push("Live score data is UNAVAILABLE. Base your read on price action and ladder context only. Do not guess or invent a scoreline.");
    return lines.join(" ");
  }

  if (ctx.scoreConfidence === "estimated") {
    lines.push(`Score (ESTIMATED — may not be accurate): ${ctx.formattedScore}.`);
    lines.push("This score is estimated from price movement and may be wrong. Caveat any scoreboard-based analysis.");
  } else {
    lines.push(`Score: ${ctx.formattedScore}.`);
  }

  if (ctx.serverName) lines.push(`Server: ${ctx.serverName}.`);

  const situational: string[] = [];
  if (ctx.matchPoint) situational.push("MATCH POINT");
  else if (ctx.setPoint) situational.push("SET POINT");
  if (ctx.breakPoint) situational.push("BREAK POINT");
  if (ctx.tiebreak) situational.push("TIEBREAK");
  if (ctx.finalSet) situational.push("FINAL SET");
  if (situational.length > 0) lines.push(`Situation: ${situational.join(", ")}.`);

  if (ctx.player1Odds && ctx.player2Odds) {
    lines.push(`Odds: ${ctx.player1} ${ctx.player1Odds.toFixed(2)} / ${ctx.player2} ${ctx.player2Odds.toFixed(2)}.`);
  }

  return lines.join(" ");
}

/* ─── Match State for AI Context ─── */

export type ScoreConfidence = "reliable" | "estimated" | "unavailable";

export interface MatchStateForAI {
  score?: string;
  server?: string;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  scoreConfidence: ScoreConfidence;
  marketStatus: "pre_match" | "in_play" | "suspended";
}

/**
 * Build a match-state context block for AI prompts.
 * Clearly labels confidence so AI knows when to caveat its reads.
 */
export function formatMatchStateForPrompt(state: MatchStateForAI): string {
  const lines: string[] = [];

  lines.push(`Market status: ${state.marketStatus.replace("_", "-")}.`);

  if (state.scoreConfidence === "unavailable" || !state.score) {
    lines.push("Live score data is UNAVAILABLE. Base your read on price action and ladder context only. Do not guess or invent a scoreline.");
    return lines.join(" ");
  }

  if (state.scoreConfidence === "estimated") {
    lines.push(`Score (ESTIMATED — may not be accurate): ${state.score}.`);
    lines.push("This score is estimated from price movement and may be wrong. Caveat any scoreboard-based analysis.");
  } else {
    lines.push(`Score: ${state.score}.`);
  }

  if (state.server) lines.push(`Server: ${state.server}.`);

  const situational: string[] = [];
  if (state.matchPoint) situational.push("MATCH POINT");
  else if (state.setPoint) situational.push("SET POINT");
  if (state.breakPoint) situational.push("BREAK POINT");
  if (state.tiebreak) situational.push("TIEBREAK");
  if (situational.length > 0) lines.push(`Situation: ${situational.join(", ")}.`);

  return lines.join(" ");
}

/* ─── MatchContext — reusable across UI + AI ─── */

export interface MatchContext {
  player1: string;
  player2: string;
  sets?: number[][];
  gameScore?: string[];
  server?: 1 | 2;
  serverName?: string;
  breakPoint: boolean;
  setPoint: boolean;
  matchPoint: boolean;
  tiebreak: boolean;
  finalSet: boolean;
  scoreConfidence: ScoreConfidence;
  isScoreStale: boolean;
  marketStatus: "pre_match" | "in_play" | "suspended";
  player1Odds?: number;
  player2Odds?: number;
  surface?: string;
  formattedScore?: string;
}

export function buildMatchContext(params: {
  player1: string;
  player2: string;
  liveScore: {
    available: boolean;
    sets?: number[][];
    gameScore?: string[];
    server?: 1 | 2;
    breakPoint?: boolean;
    setPoint?: boolean;
    matchPoint?: boolean;
    tiebreak?: boolean;
    tiebreakScore?: string[];
    scoreConfidence?: ScoreConfidence;
  } | null;
  marketStatus: "pre_match" | "in_play" | "suspended";
  isScoreStale: boolean;
  player1Odds?: number;
  player2Odds?: number;
  surface?: string;
}): MatchContext {
  const { player1, player2, liveScore, marketStatus, isScoreStale, player1Odds, player2Odds, surface } = params;

  const sets = liveScore?.sets;
  const breakPoint = liveScore?.breakPoint ?? false;
  const setPoint = liveScore?.setPoint ?? false;
  const matchPoint = liveScore?.matchPoint ?? false;
  const tiebreak = liveScore?.tiebreak ?? false;
  const scoreConfidence = liveScore?.scoreConfidence ?? "unavailable";

  // Final set detection — auto-detects BO3/BO5
  const completedSets = (sets ?? []).slice(0, -1);
  const setsWonP1 = completedSets.filter(s => s[0] > s[1]).length;
  const setsWonP2 = completedSets.filter(s => s[1] > s[0]).length;
  const finalSet = setsWonP1 > 0 && setsWonP2 > 0 && setsWonP1 === setsWonP2;

  const serverName = liveScore?.server === 1
    ? player1.split(" ").pop()
    : liveScore?.server === 2
      ? player2.split(" ").pop()
      : undefined;

  const formattedScore = formatSetsToString(sets, liveScore?.gameScore, tiebreak, liveScore?.tiebreakScore);

  return {
    player1,
    player2,
    sets,
    gameScore: liveScore?.gameScore,
    server: liveScore?.server,
    serverName,
    breakPoint,
    setPoint,
    matchPoint,
    tiebreak,
    finalSet,
    scoreConfidence,
    isScoreStale,
    marketStatus,
    player1Odds,
    player2Odds,
    surface,
    formattedScore,
  };
}

/**
 * Format sets array into human-readable score string.
 * e.g. [[6,4],[3,2]] → "6-4, 3-2"
 */
export function formatSetsToString(
  sets: number[][] | undefined,
  gameScore?: string[],
  tiebreak?: boolean,
  tiebreakScore?: string[],
): string | undefined {
  if (!sets || sets.length === 0) return undefined;
  const setStrings = sets.map((s) => `${s[0]}-${s[1]}`);
  let result = setStrings.join(", ");

  // Append current game score
  if (gameScore && gameScore.length === 2 && (gameScore[0] || gameScore[1])) {
    if (tiebreak && tiebreakScore && tiebreakScore.length === 2) {
      result += ` (TB: ${tiebreakScore[0]}-${tiebreakScore[1]})`;
    } else {
      result += ` (${gameScore[0]}-${gameScore[1]})`;
    }
  }

  return result;
}
