/* ─── Tennis Context Helpers ─── */

/**
 * Infer playing surface from tournament name.
 * Falls back to provided surface, then "hard" as default.
 */
export function inferSurface(tournament: string | undefined, providedSurface: string | undefined): string {
  return inferSurfaceWithConfidence(tournament, providedSurface).surface;
}

/**
 * Infer surface with confidence tracking.
 * Returns whether the surface was confidently determined from a known tournament.
 */
export function inferSurfaceWithConfidence(
  tournament: string | undefined,
  providedSurface: string | undefined,
): { surface: string; verified: boolean; source: string } {
  const t = (tournament ?? "").toLowerCase();

  // Clay tournaments
  if (
    t.includes("french open") || t.includes("roland garros") ||
    t.includes("monte carlo") || t.includes("rome") || t.includes("internazionali") ||
    t.includes("madrid") || t.includes("barcelona") || t.includes("hamburg") ||
    t.includes("buenos aires") || t.includes("rio") || t.includes("estoril") ||
    t.includes("lyon") || t.includes("bastad") || t.includes("gstaad") ||
    t.includes("umag") || t.includes("kitzbuhel") || t.includes("kitzbühel")
  ) return { surface: "clay", verified: true, source: "Known clay tournament" };

  // Grass tournaments
  if (
    t.includes("wimbledon") ||
    t.includes("queen") || t.includes("halle") ||
    t.includes("eastbourne") || t.includes("s-hertogenbosch") ||
    t.includes("mallorca") || (t.includes("stuttgart") && t.includes("grass"))
  ) return { surface: "grass", verified: true, source: "Known grass tournament" };

  // Known hard-court grand slams
  if (t.includes("australian open") || t.includes("us open"))
    return { surface: "hard", verified: true, source: "Known hard-court slam" };

  // Use provided surface if available — but mark as unverified
  if (providedSurface && providedSurface.toLowerCase() !== "unknown") {
    return { surface: providedSurface.toLowerCase(), verified: false, source: "Provided but unverified" };
  }

  return { surface: "hard", verified: false, source: "Default fallback — not confirmed" };
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
STRICT RULES — violating these destroys trader trust:
- NEVER mention "team news", "squad", "lineup", "formation", or any team-sport concept. Tennis is individual.
- NEVER use financial jargon: "market volatility", "portfolio diversification", "risk-reward ratio", "bull/bear", "P/E ratio", "alpha", "liquidity cascade", "volatility expansion". You are a Betfair trader, not a stockbroker.
- NEVER use these banned phrases: "perfect equilibrium", "compressed favourite", "favourite heavily compressed", "market compression", "first strike environment", "first-strike environment", "surface tempo", "post-break entry", "momentum continuation", "inefficient pricing", "volatility expansion".
- NEVER use vague sentiment: "follow the momentum", "positive momentum", "bullish", "bearish", "strong trend", "good opportunity", "attractive opportunity", "looks promising", "market likes", "market loves", "market hates".
- NEVER use absolute certainty language: "guaranteed", "certain", "definitely", "must happen", "inevitable", "no doubt", "sure thing", "certainly", "surefire". Nothing in trading is guaranteed.
- ONLY reference data explicitly provided in the DATA CONTRACT above. If a field is marked [UNVERIFIED] or [UNAVAILABLE], do NOT treat it as fact.
- NEVER invent player statistics (serve %, return %, break conversion, H2H). If no stats are provided, say so.
- NEVER predict set-end prices or project future specific prices.
- NEVER reference opening odds unless explicitly provided and marked [verified].
- Use plain tennis trader language: favourite, underdog, shorter price, drifting price, hold of serve, break of serve, better server, weaker second serve, return pressure, price moved too far, no clear edge, wait for next service game, wait for confirmed break, trade only if price improves.
- Every claim must be traceable to a verified data field. If you cannot prove it from the data contract, do not state it.
- Be concise. Max 2-3 sentences per section.`.trim();

/* ─── Banned Phrases (post-processing defense-in-depth) ─── */

export const BANNED_PHRASES = [
  "follow the momentum", "positive momentum", "bullish", "bearish",
  "strong trend", "good opportunity", "attractive opportunity",
  "looks promising", "market likes", "market loves", "market hates",
  "perfect equilibrium", "compressed favourite", "favourite heavily compressed",
  "heavily compressed", "market compression", "first strike environment",
  "first-strike environment", "surface tempo", "post-break entry",
  "momentum continuation", "liquidity cascade", "inefficient pricing",
  "volatility expansion", "volatility contraction", "risk-reward ratio",
  "risk reward ratio", "portfolio diversification", "market sentiment",
];

/* ─── Structured AI Signal Types ─── */

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface StructuredAISignal {
  // Pre-match format
  whatWeKnow?: string;
  whatWeDontKnow?: string;
  tradingView?: string;
  whatToWatch?: string;

  // In-play format
  situation?: string;
  reason?: string;
  watch?: string;

  // Common
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

export const PRE_MATCH_OUTPUT_FORMAT = `
You MUST respond with valid JSON matching this exact structure:
{
  "whatWeKnow": "<state ONLY verified facts from the DATA CONTRACT — current odds, verified surface, tournament. Max 2-3 sentences.>",
  "whatWeDontKnow": "<explicitly list what data is missing or unverified — opening odds, player stats, H2H, etc. Be honest.>",
  "tradingView": "<your trading read based ONLY on verified data. If data confidence is LOW, say 'Insufficient verified data for trade suggestion.' Max 2-3 sentences.>",
  "whatToWatch": "<specific things the trader should watch for — first service games, early break, price reaction. Max 2 sentences.>",
  "confidence": "<LOW | MEDIUM | HIGH — must match the DATA CONFIDENCE level provided>",
  "confidenceReason": "<why this confidence — reference which data is verified vs missing>",
  "edgeSize": "<none | mild | moderate | strong — 'none' if data confidence is LOW>"
}

RULES:
- ONLY reference facts from the DATA CONTRACT. If a field is [UNVERIFIED] or [UNAVAILABLE], do not use it as fact.
- whatWeKnow must cite ONLY verified data fields. Never invent prices, stats, or surface info.
- whatWeDontKnow must be honest about gaps. Missing data is acceptable. Wrong data is unacceptable.
- Do NOT predict set-end prices or project specific future prices.
- Do NOT claim player statistics unless explicitly provided.
- tradeSignal is NOT included for pre-match. Omit it entirely.
- Be concise. Plain trader language. No jargon.
- Do NOT wrap in markdown code fences. Return raw JSON only.
`.trim();

export const IN_PLAY_OUTPUT_FORMAT = `
You MUST respond with valid JSON matching this exact structure:
{
  "situation": "<what is happening right now — use ONLY verified score and odds from DATA CONTRACT. If score unavailable, say so.>",
  "reason": "<why the price is where it is — reference specific verified data. If score unavailable, read price action only.>",
  "watch": "<what the trader should watch next — be specific. If data is limited, say what would need to happen before acting.>",
  "confidence": "<LOW | MEDIUM | HIGH — must match the DATA CONFIDENCE level provided>",
  "confidenceReason": "<why this confidence — reference data quality>",
  "edgeSize": "<none | mild | moderate | strong — 'none' if data confidence is LOW>",
  "tradeSignal": {
    "entry": "<specific price and direction>",
    "reason": "<why enter — reference verified data>",
    "risk": "<what could go wrong>",
    "invalidation": "<price or event that cancels>"
  }
}

RULES:
- situation MUST use the exact score and server from DATA CONTRACT. If score is unavailable, state that clearly.
- reason MUST reference verified data only. Do not guess what happened on court if score is unavailable.
- tradeSignal is optional — only include if there is a genuine edge AND data confidence is HIGH or MEDIUM. Omit entirely otherwise.
- Do NOT predict set-end prices or project specific future prices.
- Be concise. Max 2-3 sentences per field. Plain trader language.
- Do NOT wrap in markdown code fences. Return raw JSON only.
`.trim();

// Keep for backward compat — routes now use PRE_MATCH_OUTPUT_FORMAT / IN_PLAY_OUTPUT_FORMAT
export const MANDATORY_OUTPUT_FORMAT = PRE_MATCH_OUTPUT_FORMAT;

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

  if (ctx.scoreConfidence !== "reliable" || !ctx.formattedScore) {
    lines.push("Live score data is UNAVAILABLE. Base your read on price action and ladder context only. Do not guess or invent a scoreline.");
    return lines.join(" ");
  }

  lines.push(`Score: ${ctx.formattedScore}.`);

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

  if (state.scoreConfidence !== "reliable" || !state.score) {
    lines.push("Live score data is UNAVAILABLE. Base your read on price action and ladder context only. Do not guess or invent a scoreline.");
    return lines.join(" ");
  }

  lines.push(`Score: ${state.score}.`);

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
