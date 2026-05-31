import { NextRequest, NextResponse } from "next/server";
import {
  inferSurface,
  getSurfaceContext,
  TENNIS_PROMPT_GUARDRAILS,
  MANDATORY_OUTPUT_FORMAT,
  BANNED_PHRASES,
  type StructuredAISignal,
  type ConfidenceLevel,
} from "@/lib/tennisContext";

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

/* ─── Signal Configs ─── */

function getConfig(signalType: SignalType, surface: string) {
  const surfaceCtx = getSurfaceContext(surface);

  switch (signalType) {
    case "pre_match":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader preparing a pre-match read.",
          "Speak like a trader reviewing the card — not a commentator, pundit, or financial analyst.",
          `Surface context: ${surfaceCtx}`,
          "Reference likely price movements, key levels, and where value might sit.",
          "",
          MANDATORY_OUTPUT_FORMAT,
          "",
          "For pre-match signals: matchState should be \"Pre-match\". Do not invent a scoreline. Focus reason on expected dynamics based on player form and surface.",
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "in_play":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader giving real-time structured reads.",
          "Speak like a trader on the desk, not a commentator or analyst.",
          `Surface: ${surface}.`,
          "",
          MANDATORY_OUTPUT_FORMAT,
          "",
          "Be concise. No section should exceed 2 sentences.",
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "edge_alert":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 500,
        system: [
          "You are a professional Betfair tennis exchange trader who spotted a pricing inefficiency.",
          "Explain it like you'd tell another trader on the desk.",
          `Surface: ${surface}.`,
          "",
          MANDATORY_OUTPUT_FORMAT,
          "",
          "For edge alerts: you MUST include the tradeSignal object with entry, reason, risk, and invalidation.",
          "Be concise. No section should exceed 2 sentences.",
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
  }
}

function buildUserPrompt(
  signalType: SignalType,
  ctx: MatchContext,
  surface: string,
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
  const situationalLine = situational.length > 0 ? `Situation: ${situational.join(", ")}` : "";

  switch (signalType) {
    case "pre_match":
      return [
        `Match: ${p1} vs ${p2}`,
        `Tournament: ${ctx.tournament ?? "Unknown"}`,
        `Surface: ${surface}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        "Give your pre-match trading read as structured JSON. matchState = \"Pre-match\". Focus on surface-adjusted form, serve/return matchup, key price levels.",
      ].join("\n");

    case "in_play": {
      const matchState = ctx.matchStateContext ?? (ctx.score ? `Score: ${ctx.score}. Server: ${ctx.server ?? "Unknown"}.` : "Score unavailable — read price action only.");
      return [
        `Match: ${p1} vs ${p2} (${surface})`,
        matchState,
        situationalLine,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.recentAction ? `Recent: ${ctx.recentAction}` : "",
        ctx.ladderContext ? `Ladder: ${ctx.ladderContext}` : "",
        "",
        ctx.scoreConfidence === "unavailable"
          ? "Score data unavailable. Give a price-action read only — do not guess the score. Respond with structured JSON."
          : ctx.scoreConfidence === "estimated"
            ? "Score is estimated and may be inaccurate. Caveat any scoreboard-based analysis. Respond with structured JSON."
            : "Respond with structured JSON. Reference serve-game context and ladder.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "edge_alert": {
      const scoreInfo = ctx.matchStateContext ?? (ctx.score ? `Score: ${ctx.score}.` : "Score unavailable.");
      return [
        `Match: ${p1} vs ${p2} (${surface})`,
        scoreInfo,
        situationalLine,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.ladderContext ? `Ladder: ${ctx.ladderContext}` : "",
        "",
        ctx.scoreConfidence === "unavailable"
          ? "Score unavailable. Is there a pricing edge based on price action and ladder weight alone? Respond with structured JSON including tradeSignal."
          : "Is there a pricing edge? Respond with structured JSON including tradeSignal with direction, price level, and supporting context.",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}

/* ─── Structured Response Parsing ─── */

function stripBannedPhrases(text: string): string {
  let result = text;
  for (const phrase of BANNED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    result = result.replace(regex, "");
  }
  // Clean up double spaces left behind
  return result.replace(/\s{2,}/g, " ").trim();
}

function parseStructuredResponse(rawText: string): StructuredAISignal | null {
  try {
    // Strip markdown code fences if present
    let jsonStr = rawText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.matchState || !parsed.marketState || !parsed.reason || !parsed.traderFocus || !parsed.confidence) {
      return null;
    }

    // Validate confidence level
    const validConfidence: ConfidenceLevel[] = ["LOW", "MEDIUM", "HIGH"];
    const confidence = (parsed.confidence as string).toUpperCase() as ConfidenceLevel;
    if (!validConfidence.includes(confidence)) {
      return null;
    }

    // Validate edge size
    const validEdge: EdgeSize[] = ["none", "mild", "moderate", "strong"];
    const edgeSize = (parsed.edgeSize ?? "none").toLowerCase() as EdgeSize;

    // Strip banned phrases from all text fields
    const structured: StructuredAISignal = {
      matchState: stripBannedPhrases(parsed.matchState),
      marketState: stripBannedPhrases(parsed.marketState),
      reason: stripBannedPhrases(parsed.reason),
      traderFocus: stripBannedPhrases(parsed.traderFocus),
      confidence,
      confidenceReason: stripBannedPhrases(parsed.confidenceReason ?? ""),
      edgeSize: validEdge.includes(edgeSize) ? edgeSize : "none",
    };

    // Include trade signal if present and valid
    if (parsed.tradeSignal && parsed.tradeSignal.entry && parsed.tradeSignal.reason) {
      structured.tradeSignal = {
        entry: stripBannedPhrases(parsed.tradeSignal.entry),
        reason: stripBannedPhrases(parsed.tradeSignal.reason),
        risk: stripBannedPhrases(parsed.tradeSignal.risk ?? ""),
        invalidation: stripBannedPhrases(parsed.tradeSignal.invalidation ?? ""),
      };
    }

    return structured;
  } catch {
    return null;
  }
}

function confidenceToNumber(level: ConfidenceLevel): number {
  switch (level) {
    case "LOW": return 30;
    case "MEDIUM": return 60;
    case "HIGH": return 85;
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

function buildInsufficientDataResponse(signalType: SignalType) {
  const structured: StructuredAISignal = {
    matchState: "Insufficient live data for analysis",
    marketState: "Insufficient live data for analysis",
    reason: "Insufficient live data for analysis",
    traderFocus: "Insufficient live data for analysis",
    confidence: "LOW",
    confidenceReason: "Missing required player and match data",
    edgeSize: "none",
  };

  const readableAnalysis = [
    `MATCH STATE: ${structured.matchState}`,
    `MARKET STATE: ${structured.marketState}`,
    `REASON: ${structured.reason}`,
    `TRADER FOCUS: ${structured.traderFocus}`,
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
    },
  });
}

/* ─── Route Handler ─── */

export async function POST(req: NextRequest) {
  try {
    // Auth check — prevent unauthenticated Anthropic API usage
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
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
        { status: 400 }
      );
    }

    const validTypes: SignalType[] = ["pre_match", "in_play", "edge_alert"];
    if (!validTypes.includes(signalType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid signalType. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Pre-call fact-checking: if in-play/edge_alert and players missing, return insufficient data
    if (signalType !== "pre_match" && (!matchContext.player1 || !matchContext.player2)) {
      return buildInsufficientDataResponse(signalType);
    }

    const surface = inferSurface(matchContext.tournament, matchContext.surface);
    const config = getConfig(signalType, surface);
    const userPrompt = buildUserPrompt(signalType, matchContext, surface);

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
        { success: false, error: `Anthropic API error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawAnalysis =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!rawAnalysis) {
      return NextResponse.json(
        { success: false, error: "Empty response from AI model" },
        { status: 502 }
      );
    }

    // Try structured JSON parsing first
    const structured = parseStructuredResponse(rawAnalysis);

    let confidence: number;
    let edgeSize: EdgeSize;
    let analysis: string;

    if (structured) {
      // Successful structured parse
      confidence = confidenceToNumber(structured.confidence);
      edgeSize = structured.edgeSize;

      // Build readable analysis (backward compat for Pro/Paper views)
      const sections = [
        `MATCH STATE: ${structured.matchState}`,
        `MARKET STATE: ${structured.marketState}`,
        `REASON: ${structured.reason}`,
        `TRADER FOCUS: ${structured.traderFocus}`,
      ];
      if (structured.tradeSignal) {
        sections.push(
          `TRADE SIGNAL: Entry: ${structured.tradeSignal.entry} | Reason: ${structured.tradeSignal.reason} | Risk: ${structured.tradeSignal.risk} | Invalidation: ${structured.tradeSignal.invalidation}`
        );
      }
      analysis = sections.join("\n\n");
    } else {
      // Fallback: legacy regex parsing + banned phrase strip
      analysis = stripBannedPhrases(rawAnalysis);
      confidence = parseConfidence(analysis);
      edgeSize = parseEdgeSize(analysis);
    }

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
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
