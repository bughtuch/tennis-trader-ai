import { NextRequest, NextResponse } from "next/server";
import {
  inferSurfaceWithConfidence,
  getSurfaceContext,
  TENNIS_PROMPT_GUARDRAILS,
  PRE_MATCH_OUTPUT_FORMAT,
  IN_PLAY_OUTPUT_FORMAT,
  type StructuredAISignal,
  type ConfidenceLevel,
} from "@/lib/tennisContext";
import {
  buildDataContract,
  buildPromptRestrictions,
  buildGuardrailPromptBlock,
  buildDataContextForPrompt,
  buildFactPanel,
  getSourcesUsed,
  getSourcesNotUsed,
  selfCheckOutput,
  EXPANDED_BANNED_PHRASES,
  type FactPanel,
} from "@/lib/aiDataContract";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

type SignalType = "pre_match" | "in_play" | "edge_alert";
type EdgeSize = "none" | "mild" | "moderate" | "strong";

interface MatchContext {
  player1?: string;
  player2?: string;
  tournament?: string;
  surface?: string;
  odds1?: number;
  odds2?: number;
  score?: string;
  server?: string;
  recentAction?: string;
  ladderContext?: string;
  scoreConfidence?: "reliable" | "estimated" | "unavailable";
  matchStateContext?: string;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  finalSet?: boolean;
  isScoreStale?: boolean;
}

/* ─── Signal Configs with Trust Architecture ─── */

function getConfig(
  signalType: SignalType,
  surface: string,
  surfaceVerified: boolean,
  dataContextBlock: string,
  guardrailBlock: string,
) {
  // Only include surface context if verified
  const surfaceCtx = surfaceVerified
    ? getSurfaceContext(surface)
    : "Surface is NOT verified. Do not reference surface-specific patterns.";

  const outputFormat =
    signalType === "pre_match"
      ? PRE_MATCH_OUTPUT_FORMAT
      : IN_PLAY_OUTPUT_FORMAT;

  switch (signalType) {
    case "pre_match":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader preparing a pre-match read.",
          "You are NOT a tipster, prediction oracle, or commentator.",
          "You are a trading assistant that explains verified market and match information in plain trader language.",
          "A trader may disagree with your opinion, but they must trust the facts you present.",
          "",
          dataContextBlock,
          "",
          surfaceCtx,
          "",
          outputFormat,
          "",
          guardrailBlock,
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "in_play":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader giving a real-time read.",
          "You are NOT a tipster or prediction oracle.",
          "You explain what the verified data shows in plain trader language.",
          "",
          dataContextBlock,
          "",
          surfaceCtx,
          "",
          outputFormat,
          "",
          "Be concise. No section should exceed 2-3 sentences.",
          "",
          guardrailBlock,
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "edge_alert":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader assessing whether there is a pricing edge.",
          "Only identify an edge if verified data supports it. If data confidence is LOW, there is no edge.",
          "",
          dataContextBlock,
          "",
          surfaceCtx,
          "",
          IN_PLAY_OUTPUT_FORMAT,
          "",
          "Do NOT recommend trades, entries, exits, or timing. Describe market conditions only.",
          "",
          guardrailBlock,
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
  }
}

function buildUserPrompt(
  signalType: SignalType,
  ctx: MatchContext,
): string {
  const p1 = ctx.player1 ?? "Player 1";
  const p2 = ctx.player2 ?? "Player 2";

  // Build situational flags
  const situational: string[] = [];
  if (ctx.matchPoint) situational.push("MATCH POINT");
  else if (ctx.setPoint) situational.push("SET POINT");
  if (ctx.breakPoint) situational.push("BREAK POINT");
  if (ctx.tiebreak) situational.push("TIEBREAK");
  if (ctx.finalSet) situational.push("FINAL SET");
  if (ctx.isScoreStale) situational.push("SCORE DATA MAY BE STALE");
  const situationalLine =
    situational.length > 0 ? `Situation: ${situational.join(", ")}` : "";

  switch (signalType) {
    case "pre_match":
      return [
        `Match: ${p1} vs ${p2}`,
        `Tournament: ${ctx.tournament ?? "Unknown"}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        "Give your pre-match trading read as structured JSON. Reference ONLY the data provided in the DATA CONTRACT. Be honest about what you do not know.",
      ].join("\n");

    case "in_play": {
      const matchState =
        ctx.matchStateContext ??
        (ctx.score
          ? `Score: ${ctx.score}. Server: ${ctx.server ?? "Unknown"}.`
          : "Score unavailable — read price action only.");
      return [
        `Match: ${p1} vs ${p2}`,
        matchState,
        situationalLine,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.recentAction ? `Recent: ${ctx.recentAction}` : "",
        ctx.ladderContext ? `Ladder: ${ctx.ladderContext}` : "",
        "",
        ctx.scoreConfidence !== "reliable"
          ? "Score data unavailable or unverified. Give a price-action read only — do not guess the score. Respond with structured JSON."
          : "Respond with structured JSON. Reference serve-game context and ladder.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "edge_alert": {
      const scoreInfo =
        ctx.matchStateContext ??
        (ctx.score ? `Score: ${ctx.score}.` : "Score unavailable.");
      return [
        `Match: ${p1} vs ${p2}`,
        scoreInfo,
        situationalLine,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.ladderContext ? `Ladder: ${ctx.ladderContext}` : "",
        "",
        ctx.scoreConfidence === "unavailable"
          ? "Score unavailable. Is there a pricing edge based on price action and ladder weight alone? Respond with structured JSON."
          : "Is there a pricing edge? Respond with structured JSON. Only include tradeSignal if data supports it.",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}

/* ─── Structured Response Parsing ─── */

function stripBannedPhrases(text: string): string {
  let result = text;
  for (const phrase of EXPANDED_BANNED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    result = result.replace(regex, "");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

function parseStructuredResponse(
  rawText: string,
  signalType: SignalType,
): StructuredAISignal | null {
  try {
    let jsonStr = rawText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Validate confidence
    const validConfidence: ConfidenceLevel[] = ["LOW", "MEDIUM", "HIGH"];
    const confidence = (parsed.confidence as string)
      .toUpperCase() as ConfidenceLevel;
    if (!validConfidence.includes(confidence)) return null;

    // Validate edge size
    const validEdge: EdgeSize[] = ["none", "mild", "moderate", "strong"];
    const edgeSize = (parsed.edgeSize ?? "none").toLowerCase() as EdgeSize;

    if (signalType === "pre_match") {
      // Pre-match format validation
      if (!parsed.whatWeKnow || !parsed.tradingView) return null;

      const structured: StructuredAISignal = {
        whatWeKnow: stripBannedPhrases(parsed.whatWeKnow),
        whatWeDontKnow: stripBannedPhrases(parsed.whatWeDontKnow ?? ""),
        tradingView: stripBannedPhrases(parsed.tradingView),
        whatToWatch: stripBannedPhrases(parsed.whatToWatch ?? ""),
        confidence,
        confidenceReason: stripBannedPhrases(parsed.confidenceReason ?? ""),
        edgeSize: validEdge.includes(edgeSize) ? edgeSize : "none",
      };

      return structured;
    } else {
      // In-play / edge alert format validation
      if (!parsed.situation && !parsed.reason) return null;

      const structured: StructuredAISignal = {
        situation: stripBannedPhrases(parsed.situation ?? ""),
        reason: stripBannedPhrases(parsed.reason ?? ""),
        watch: stripBannedPhrases(parsed.watch ?? ""),
        confidence,
        confidenceReason: stripBannedPhrases(parsed.confidenceReason ?? ""),
        edgeSize: validEdge.includes(edgeSize) ? edgeSize : "none",
      };

      return structured;
    }
  } catch {
    return null;
  }
}

function confidenceToNumber(level: ConfidenceLevel): number {
  switch (level) {
    case "LOW":
      return 30;
    case "MEDIUM":
      return 60;
    case "HIGH":
      return 85;
  }
}

/* ─── Legacy Fallback Parsing ─── */

function parseConfidence(text: string): number {
  const match =
    text.match(/confidence[:\s]*(\d+)\s*%/i) ??
    text.match(/(\d+)\s*%\s*confidence/i) ??
    text.match(/(\d+)%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) return val;
  }
  return 50;
}

function parseEdgeSize(text: string): EdgeSize {
  const lower = text.toLowerCase();
  if (/\bstrong\b/.test(lower)) return "strong";
  if (/\bmoderate\b/.test(lower)) return "moderate";
  if (/\bmild\b/.test(lower) || /\bslight\b/.test(lower)) return "mild";
  if (/\bnone\b/.test(lower) || /\bno edge\b/.test(lower)) return "none";
  return "mild";
}

/* ─── Insufficient Data Response ─── */

function buildInsufficientDataResponse(
  signalType: SignalType,
  factPanel: FactPanel,
) {
  const structured: StructuredAISignal =
    signalType === "pre_match"
      ? {
          whatWeKnow: "Insufficient live data for analysis",
          whatWeDontKnow: "Missing required player and match data",
          tradingView: "Insufficient verified data for trade suggestion.",
          whatToWatch: "Wait for market data to become available",
          confidence: "LOW",
          confidenceReason: "Missing required player and match data",
          edgeSize: "none",
        }
      : {
          situation: "Insufficient live data for analysis",
          reason: "Missing required player and match data",
          watch: "Wait for market data to become available",
          confidence: "LOW",
          confidenceReason: "Missing required player and match data",
          edgeSize: "none",
        };

  const readableAnalysis =
    signalType === "pre_match"
      ? [
          `WHAT WE KNOW: ${structured.whatWeKnow}`,
          `WHAT WE DON'T KNOW: ${structured.whatWeDontKnow}`,
          `TRADING VIEW: ${structured.tradingView}`,
          `WHAT TO WATCH: ${structured.whatToWatch}`,
        ].join("\n\n")
      : [
          `SITUATION: ${structured.situation}`,
          `REASON: ${structured.reason}`,
          `WATCH: ${structured.watch}`,
        ].join("\n\n");

  return NextResponse.json({
    success: true,
    signal: {
      type: signalType,
      confidence: 30,
      edgeSize: "none" as EdgeSize,
      analysis: readableAnalysis,
      model: "validation",
      timestamp: new Date().toISOString(),
      structured,
      dataConfidence: "LOW" as const,
      dataConfidenceReasons: ["Missing required player and match data"],
      factPanel,
      sourcesUsed: ["Current market prices only"],
      sourcesNotUsed: getSourcesNotUsed(),
    },
  });
}

/* ─── Route Handler ─── */

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const { signalType, matchContext } = (await req.json()) as {
      matchId?: string;
      signalType: SignalType;
      matchContext: MatchContext;
    };

    if (!signalType || !matchContext) {
      return NextResponse.json(
        { success: false, error: "signalType and matchContext are required" },
        { status: 400 },
      );
    }

    const validTypes: SignalType[] = ["pre_match", "in_play", "edge_alert"];
    if (!validTypes.includes(signalType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid signalType. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    /* ─── Stage 1: Build Data Contract ─── */
    const surfaceInfo = inferSurfaceWithConfidence(
      matchContext.tournament,
      matchContext.surface,
    );

    const matchStatus =
      signalType === "pre_match"
        ? ("pre_match" as const)
        : ("in_play" as const);

    const dataContract = buildDataContract({
      player1: matchContext.player1,
      player2: matchContext.player2,
      tournament: matchContext.tournament,
      surface: surfaceInfo.surface,
      surfaceVerified: surfaceInfo.verified,
      odds1: matchContext.odds1,
      odds2: matchContext.odds2,
      score: matchContext.score,
      server: matchContext.server,
      scoreConfidence: matchContext.scoreConfidence,
      isScoreStale: matchContext.isScoreStale,
      ladderContext: matchContext.ladderContext,
      matchStatus,
    });

    /* ─── Stage 4: Build Fact Panel ─── */
    const factPanel = buildFactPanel(dataContract);

    // Pre-call fact-checking: if in-play/edge_alert and players missing
    if (
      signalType !== "pre_match" &&
      (!matchContext.player1 || !matchContext.player2)
    ) {
      return buildInsufficientDataResponse(signalType, factPanel);
    }

    /* ─── Stage 3: Build Prompt Restrictions ─── */
    const restrictions = buildPromptRestrictions(dataContract);
    const guardrailBlock = buildGuardrailPromptBlock(restrictions);
    const dataContextBlock = buildDataContextForPrompt(dataContract);

    const config = getConfig(
      signalType,
      surfaceInfo.surface,
      surfaceInfo.verified,
      dataContextBlock,
      guardrailBlock,
    );
    const userPrompt = buildUserPrompt(signalType, matchContext);

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          success: false,
          error: `Anthropic API error: ${res.status} ${text}`,
        },
        { status: res.status },
      );
    }

    const data = await res.json();
    const rawAnalysis =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!rawAnalysis) {
      return NextResponse.json(
        { success: false, error: "Empty response from AI model" },
        { status: 502 },
      );
    }

    /* ─── Stage 8: Self-Check Output ─── */
    const checkedAnalysis = selfCheckOutput(rawAnalysis, restrictions);

    // Try structured JSON parsing
    const structured = parseStructuredResponse(checkedAnalysis, signalType);

    let confidence: number;
    let edgeSize: EdgeSize;
    let analysis: string;

    if (structured) {
      // Enforce data confidence → AI confidence alignment
      if (
        dataContract.dataConfidence === "LOW" &&
        structured.confidence !== "LOW"
      ) {
        structured.confidence = "LOW";
        structured.confidenceReason =
          "Data confidence is LOW — limited analysis only";
      }
      if (
        dataContract.dataConfidence === "LOW" &&
        structured.edgeSize !== "none"
      ) {
        structured.edgeSize = "none";
      }
      confidence = confidenceToNumber(structured.confidence);
      edgeSize = structured.edgeSize ?? "none";

      // Build readable analysis for backward compat
      if (signalType === "pre_match") {
        const sections = [
          `WHAT WE KNOW: ${structured.whatWeKnow}`,
          `WHAT WE DON'T KNOW: ${structured.whatWeDontKnow}`,
          `TRADING VIEW: ${structured.tradingView}`,
          `WHAT TO WATCH: ${structured.whatToWatch}`,
        ];
        analysis = sections.join("\n\n");
      } else {
        const sections = [
          `SITUATION: ${structured.situation}`,
          `REASON: ${structured.reason}`,
          `WATCH: ${structured.watch}`,
        ];
        analysis = sections.join("\n\n");
      }
    } else {
      // Fallback: legacy parsing + banned phrase strip
      analysis = stripBannedPhrases(checkedAnalysis);
      confidence = parseConfidence(analysis);
      edgeSize = parseEdgeSize(analysis);
    }

    /* ─── Stage 5: Source Transparency ─── */
    const sourcesUsed = getSourcesUsed(dataContract);
    const sourcesNotUsed = getSourcesNotUsed();

    return NextResponse.json({
      success: true,
      signal: {
        type: signalType,
        confidence,
        edgeSize,
        analysis,
        model: config.model,
        timestamp: new Date().toISOString(),
        ...(structured ? { structured } : {}),
        dataConfidence: dataContract.dataConfidence,
        dataConfidenceReasons: dataContract.dataConfidenceReasons,
        factPanel,
        sourcesUsed,
        sourcesNotUsed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
