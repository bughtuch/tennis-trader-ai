/* ─── AI Data Contract & Trust Architecture ─── */
/* Stages 1-5, 8: Data contract, confidence engine, guardrails,
   fact panel, source transparency, self-check */

export type FieldStatus = "verified" | "unverified" | "missing";
export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface DataField<T> {
  value: T | null;
  status: FieldStatus;
  source: string;
  reason?: string;
}

/* ─── Stage 1: Data Contract ─── */

export interface AIDataContract {
  playerOne: DataField<string>;
  playerTwo: DataField<string>;
  tournament: DataField<string>;
  matchStatus: DataField<"pre_match" | "in_play" | "suspended" | "unknown">;
  surface: DataField<string>;
  currentOddsPlayerOne: DataField<number>;
  currentOddsPlayerTwo: DataField<number>;
  openingOddsPlayerOne: DataField<number>;
  openingOddsPlayerTwo: DataField<number>;
  currentScore: DataField<string>;
  server: DataField<string>;
  tradedVolume: DataField<number>;
  ladderContext: DataField<string>;
  dataConfidence: DataConfidence;
  dataConfidenceReasons: string[];
}

export interface PromptRestrictions {
  canMentionSurface: boolean;
  canMentionOpeningOdds: boolean;
  canMentionScore: boolean;
  canProvideTradeAdvice: boolean;
  canProjectSetPrices: boolean;
  canClaimPlayerStats: boolean;
  restrictedMode: boolean;
  bannedTopics: string[];
}

export interface FactPanel {
  tournament: string;
  surface: string;
  surfaceVerified: boolean;
  matchStatus: string;
  score: string;
  scoreVerified: boolean;
  currentOdds: string;
  dataConfidence: DataConfidence;
  playerOne: string;
  playerTwo: string;
}

/* ─── Build Data Contract ─── */

export function buildDataContract(ctx: {
  player1?: string;
  player2?: string;
  tournament?: string;
  surface?: string;
  surfaceVerified?: boolean;
  odds1?: number;
  odds2?: number;
  score?: string;
  server?: string;
  scoreConfidence?: "reliable" | "estimated" | "unavailable";
  isScoreStale?: boolean;
  ladderContext?: string;
  matchStatus?: "pre_match" | "in_play" | "suspended";
}): AIDataContract {
  const playerOne: DataField<string> = {
    value: ctx.player1 || null,
    status: ctx.player1 ? "verified" : "missing",
    source: ctx.player1 ? "Betfair market catalogue" : "",
    reason: ctx.player1 ? undefined : "No player data from market",
  };

  const playerTwo: DataField<string> = {
    value: ctx.player2 || null,
    status: ctx.player2 ? "verified" : "missing",
    source: ctx.player2 ? "Betfair market catalogue" : "",
    reason: ctx.player2 ? undefined : "No player data from market",
  };

  const tournament: DataField<string> = {
    value: ctx.tournament || null,
    status: ctx.tournament ? "verified" : "missing",
    source: ctx.tournament ? "Betfair market catalogue" : "",
    reason: ctx.tournament ? undefined : "No tournament data",
  };

  const surface: DataField<string> = {
    value: ctx.surface || null,
    status: ctx.surfaceVerified
      ? "verified"
      : ctx.surface
        ? "unverified"
        : "missing",
    source: ctx.surfaceVerified
      ? "Known tournament mapping"
      : ctx.surface
        ? "Default/inferred — not confirmed"
        : "",
    reason: ctx.surfaceVerified
      ? undefined
      : ctx.surface
        ? "Surface inferred from default, not confirmed for this tournament"
        : "No surface data available",
  };

  const matchStatus: DataField<"pre_match" | "in_play" | "suspended" | "unknown"> = {
    value: ctx.matchStatus ?? "unknown",
    status: ctx.matchStatus ? "verified" : "missing",
    source: ctx.matchStatus ? "Betfair market status" : "",
  };

  const hasOdds1 = ctx.odds1 != null && ctx.odds1 > 0;
  const hasOdds2 = ctx.odds2 != null && ctx.odds2 > 0;

  const currentOddsPlayerOne: DataField<number> = {
    value: hasOdds1 ? ctx.odds1! : null,
    status: hasOdds1 ? "verified" : "missing",
    source: hasOdds1 ? "Betfair exchange live price" : "",
    reason: hasOdds1 ? undefined : "No live odds available",
  };

  const currentOddsPlayerTwo: DataField<number> = {
    value: hasOdds2 ? ctx.odds2! : null,
    status: hasOdds2 ? "verified" : "missing",
    source: hasOdds2 ? "Betfair exchange live price" : "",
    reason: hasOdds2 ? undefined : "No live odds available",
  };

  const openingOddsPlayerOne: DataField<number> = {
    value: null,
    status: "missing",
    source: "",
    reason: "Opening odds not tracked",
  };

  const openingOddsPlayerTwo: DataField<number> = {
    value: null,
    status: "missing",
    source: "",
    reason: "Opening odds not tracked",
  };

  const scoreReliable =
    ctx.scoreConfidence === "reliable" && !ctx.isScoreStale;
  const currentScore: DataField<string> = {
    value: ctx.score || null,
    status: scoreReliable
      ? "verified"
      : ctx.score
        ? "unverified"
        : "missing",
    source: scoreReliable
      ? "Live score feed"
      : ctx.score
        ? "Score feed (may be stale or estimated)"
        : "",
    reason: scoreReliable
      ? undefined
      : ctx.isScoreStale
        ? "Score data may be stale"
        : ctx.scoreConfidence === "estimated"
          ? "Score estimated, not confirmed"
          : "No score data available",
  };

  const server: DataField<string> = {
    value: ctx.server || null,
    status: scoreReliable && ctx.server ? "verified" : "missing",
    source: scoreReliable && ctx.server ? "Live score feed" : "",
    reason: !ctx.server ? "Server data unavailable" : undefined,
  };

  const tradedVolume: DataField<number> = {
    value: null,
    status: "missing",
    source: "",
    reason: "Traded volume not passed to AI",
  };

  const ladderContext: DataField<string> = {
    value: ctx.ladderContext || null,
    status: ctx.ladderContext ? "verified" : "missing",
    source: ctx.ladderContext ? "Betfair exchange ladder" : "",
  };

  const contract: AIDataContract = {
    playerOne,
    playerTwo,
    tournament,
    matchStatus,
    surface,
    currentOddsPlayerOne,
    currentOddsPlayerTwo,
    openingOddsPlayerOne,
    openingOddsPlayerTwo,
    currentScore,
    server,
    tradedVolume,
    ladderContext,
    dataConfidence: "HIGH",
    dataConfidenceReasons: [],
  };

  const { level, reasons } = calculateDataConfidence(
    contract,
    ctx.matchStatus ?? "pre_match",
  );
  contract.dataConfidence = level;
  contract.dataConfidenceReasons = reasons;

  return contract;
}

/* ─── Stage 2: Data Confidence Engine ─── */

function calculateDataConfidence(
  contract: AIDataContract,
  signalType: string,
): { level: DataConfidence; reasons: string[] } {
  const reasons: string[] = [];

  // Critical → LOW
  if (
    contract.playerOne.status !== "verified" ||
    contract.playerTwo.status !== "verified"
  ) {
    reasons.push("Player identity not verified");
    return { level: "LOW", reasons };
  }

  if (
    contract.currentOddsPlayerOne.status !== "verified" ||
    contract.currentOddsPlayerTwo.status !== "verified"
  ) {
    reasons.push("Current odds not available");
    return { level: "LOW", reasons };
  }

  if (signalType === "pre_match" && contract.surface.status === "missing") {
    reasons.push("Surface unknown for pre-match analysis");
    return { level: "LOW", reasons };
  }

  if (
    (signalType === "in_play" || signalType === "edge_alert") &&
    contract.currentScore.status === "missing"
  ) {
    reasons.push("Score unavailable for in-play analysis");
    return { level: "LOW", reasons };
  }

  // Count missing important fields for MEDIUM
  let missingCount = 0;

  if (contract.surface.status !== "verified") {
    reasons.push("Surface not verified");
    missingCount++;
  }

  if (
    signalType !== "pre_match" &&
    contract.currentScore.status !== "verified"
  ) {
    reasons.push("Score not reliably verified");
    missingCount++;
  }

  if (contract.openingOddsPlayerOne.status === "missing") {
    // Opening odds are never available currently — don't count as missing for MEDIUM
    // because this is a known limitation, not a data quality issue
  }

  if (missingCount >= 1) {
    return { level: "MEDIUM", reasons };
  }

  reasons.push("All critical data verified");
  return { level: "HIGH", reasons };
}

/* ─── Stage 3: Hard Guardrail Rules ─── */

export function buildPromptRestrictions(
  contract: AIDataContract,
): PromptRestrictions {
  const restrictions: PromptRestrictions = {
    canMentionSurface: contract.surface.status === "verified",
    canMentionOpeningOdds: false, // Never — not tracked
    canMentionScore: contract.currentScore.status === "verified",
    canProvideTradeAdvice: contract.dataConfidence !== "LOW",
    canProjectSetPrices: false, // Stage 9: removed entirely
    canClaimPlayerStats: false, // Never — no player stats data
    restrictedMode: contract.dataConfidence === "LOW",
    bannedTopics: [],
  };

  if (!restrictions.canMentionSurface) {
    restrictions.bannedTopics.push(
      "SURFACE RULE: Do NOT mention clay, grass, hard court, surface speed, rally length, serve/volley style, bounce, movement patterns, or surface suitability. Surface data is not verified.",
    );
  }

  if (!restrictions.canMentionOpeningOdds) {
    restrictions.bannedTopics.push(
      "OPENING ODDS RULE: Do NOT say 'opened at', 'started at', 'from evens', or any reference to opening prices. Opening odds are not available.",
    );
  }

  if (!restrictions.canMentionScore) {
    restrictions.bannedTopics.push(
      "SCORE RULE: Do NOT discuss current set dynamics, break point situations, set pressure, momentum from score, or in-play situation based on score. Score data is not verified.",
    );
  }

  if (!restrictions.canProvideTradeAdvice) {
    restrictions.bannedTopics.push(
      "TRADE ADVICE RULE: Do NOT recommend specific trades. Say: 'Insufficient verified data for trade suggestion.'",
    );
  }

  // Always-on rules
  restrictions.bannedTopics.push(
    "SET PRICE RULE: Do NOT predict set-end prices or project future prices. No price projections of any kind.",
    "PLAYER STATS RULE: Do NOT claim serve %, return %, break conversion %, H2H record, or any player statistics. Say: 'No verified player-stat data available.' if relevant.",
  );

  return restrictions;
}

/* ─── Build Guardrail Prompt Block ─── */

export function buildGuardrailPromptBlock(
  restrictions: PromptRestrictions,
): string {
  if (restrictions.bannedTopics.length === 0) return "";

  return [
    "HARD GUARDRAILS — violating these destroys trader trust:",
    ...restrictions.bannedTopics.map((t) => `- ${t}`),
  ].join("\n");
}

/* ─── Build Data Context for Prompt ─── */

export function buildDataContextForPrompt(
  contract: AIDataContract,
): string {
  const lines: string[] = [];
  lines.push("DATA CONTRACT — these are the verified facts available to you:");
  lines.push("");

  // Players
  lines.push(
    `Players: ${contract.playerOne.value ?? "Unknown"} vs ${contract.playerTwo.value ?? "Unknown"} [${contract.playerOne.status}]`,
  );

  // Tournament
  lines.push(
    `Tournament: ${contract.tournament.value ?? "Unknown"} [${contract.tournament.status}]`,
  );

  // Surface
  if (contract.surface.status === "verified") {
    lines.push(`Surface: ${contract.surface.value} [verified]`);
  } else if (contract.surface.status === "unverified") {
    lines.push(
      `Surface: ${contract.surface.value} [UNVERIFIED — do not use in analysis]`,
    );
  } else {
    lines.push("Surface: UNAVAILABLE [do not reference any surface]");
  }

  // Odds
  if (contract.currentOddsPlayerOne.status === "verified") {
    lines.push(
      `Current odds: ${contract.playerOne.value} ${contract.currentOddsPlayerOne.value!.toFixed(2)} / ${contract.playerTwo.value} ${contract.currentOddsPlayerTwo.value!.toFixed(2)} [verified — Betfair live]`,
    );
  } else {
    lines.push("Current odds: UNAVAILABLE");
  }

  // Opening odds
  lines.push("Opening odds: NOT AVAILABLE [do not reference]");

  // Score
  if (contract.currentScore.status === "verified") {
    lines.push(
      `Score: ${contract.currentScore.value}${contract.server.value ? `. Server: ${contract.server.value}` : ""} [verified]`,
    );
  } else if (contract.currentScore.status === "unverified") {
    lines.push(
      `Score: ${contract.currentScore.value} [UNVERIFIED — ${contract.currentScore.reason}]`,
    );
  } else {
    lines.push("Score: UNAVAILABLE");
  }

  // Match status
  lines.push(
    `Match status: ${contract.matchStatus.value ?? "unknown"} [${contract.matchStatus.status}]`,
  );

  // Ladder
  if (contract.ladderContext.status === "verified") {
    lines.push(`Ladder: ${contract.ladderContext.value} [verified]`);
  }

  // Player stats
  lines.push("Player stats: NONE AVAILABLE [do not invent]");

  // Data confidence
  lines.push("");
  lines.push(
    `DATA CONFIDENCE: ${contract.dataConfidence}`,
  );
  if (contract.dataConfidenceReasons.length > 0) {
    lines.push(`Reasons: ${contract.dataConfidenceReasons.join("; ")}`);
  }

  if (contract.dataConfidence === "LOW") {
    lines.push(
      "RESTRICTED MODE: Only state what is known. Do not provide tactical trading advice.",
    );
  }

  return lines.join("\n");
}

/* ─── Stage 4: Fact Panel ─── */

export function buildFactPanel(contract: AIDataContract): FactPanel {
  const p1 = contract.playerOne.value ?? "Unknown";
  const p2 = contract.playerTwo.value ?? "Unknown";

  let currentOdds = "Unavailable";
  if (
    contract.currentOddsPlayerOne.status === "verified" &&
    contract.currentOddsPlayerTwo.status === "verified"
  ) {
    currentOdds = `${p1} ${contract.currentOddsPlayerOne.value!.toFixed(2)} / ${p2} ${contract.currentOddsPlayerTwo.value!.toFixed(2)}`;
  }

  let matchStatusLabel = "Unknown";
  switch (contract.matchStatus.value) {
    case "in_play":
      matchStatusLabel = "In-play";
      break;
    case "pre_match":
      matchStatusLabel = "Pre-match";
      break;
    case "suspended":
      matchStatusLabel = "Suspended";
      break;
  }

  return {
    tournament: contract.tournament.value ?? "Unknown",
    surface:
      contract.surface.status === "verified"
        ? contract.surface.value!
        : contract.surface.status === "unverified"
          ? `${contract.surface.value} (unverified)`
          : "Unavailable",
    surfaceVerified: contract.surface.status === "verified",
    matchStatus: matchStatusLabel,
    score:
      contract.currentScore.status === "verified"
        ? contract.currentScore.value!
        : "Unavailable",
    scoreVerified: contract.currentScore.status === "verified",
    currentOdds,
    dataConfidence: contract.dataConfidence,
    playerOne: p1,
    playerTwo: p2,
  };
}

/* ─── Stage 5: Source Transparency ─── */

export function getSourcesUsed(contract: AIDataContract): string[] {
  const sources: string[] = [];
  if (contract.currentOddsPlayerOne.status === "verified")
    sources.push("Live market odds (Betfair exchange)");
  if (contract.ladderContext.status === "verified")
    sources.push("Ladder prices and weight of money");
  if (contract.currentScore.status === "verified")
    sources.push("Verified live score feed");
  if (contract.surface.status === "verified")
    sources.push("Verified surface data");
  if (contract.currentScore.status === "unverified")
    sources.push("Score feed (unverified/stale)");
  return sources.length > 0 ? sources : ["Current market prices only"];
}

export function getSourcesNotUsed(): string[] {
  return [
    "Insider information",
    "Tipster feeds",
    "Injury reports",
    "Private prediction models",
    "Player statistics (serve %, return %, H2H)",
    "Opening odds history",
    "Set-price projections",
  ];
}

/* ─── Stage 6: Expanded Banned Phrases ─── */

export const EXPANDED_BANNED_PHRASES = [
  // Original
  "follow the momentum",
  "positive momentum",
  "bullish",
  "bearish",
  "strong trend",
  "good opportunity",
  "attractive opportunity",
  "looks promising",
  "market likes",
  "market loves",
  "market hates",
  // Stage 6 additions
  "perfect equilibrium",
  "compressed favourite",
  "favourite heavily compressed",
  "heavily compressed",
  "market compression",
  "first strike environment",
  "first-strike environment",
  "surface tempo",
  "post-break entry",
  "\\balpha\\b",
  "momentum continuation",
  "liquidity cascade",
  "inefficient pricing",
  "volatility expansion",
  "volatility contraction",
  "risk-reward ratio",
  "risk reward ratio",
  "portfolio diversification",
  "market sentiment",
  // Absolute certainty phrases — no prediction is ever guaranteed
  "\\bguaranteed\\b",
  "\\bcertain\\b",
  "\\bdefinitely\\b",
  "\\bmust happen\\b",
  "\\bwill definitely\\b",
  "\\bis guaranteed\\b",
  "\\bcertainly\\b",
  "\\bno doubt\\b",
  "\\bsure thing\\b",
  "\\binevitable\\b",
  "\\bsurefire\\b",
];

/* ─── Stage 8: Self-Check Output ─── */

export function selfCheckOutput(
  text: string,
  restrictions: PromptRestrictions,
): string {
  let cleaned = text;

  // Strip banned phrases
  for (const phrase of EXPANDED_BANNED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // If opening odds not verified, strip opening odds references
  if (!restrictions.canMentionOpeningOdds) {
    cleaned = cleaned.replace(
      /\b(opened?\s+at\s+[\d.]+|started?\s+at\s+[\d.]+|from\s+evens?|opening\s+(?:odds|price|market)\s+(?:of\s+)?[\d.]+)/gi,
      "",
    );
  }

  // If set price projections banned, strip projected prices
  if (!restrictions.canProjectSetPrices) {
    cleaned = cleaned.replace(
      /\b(projected?\s+(?:set[-\s]?end|set|end)\s*[-]?\s*(?:price|odds)|(?:set[-\s]?end|set|end)\s*[-]?\s*(?:price|odds)\s+(?:of\s+)?[\d.]+|price\s+(?:should|will|would)\s+(?:reach|hit|move\s+to)\s+[\d.]+)/gi,
      "",
    );
  }

  // Clean up whitespace
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}
