import { NextRequest, NextResponse } from "next/server";
import {
  inferSurfaceWithConfidence,
  TENNIS_PROMPT_GUARDRAILS,
} from "@/lib/tennisContext";
import {
  buildDataContract,
  buildPromptRestrictions,
  buildGuardrailPromptBlock,
  buildDataContextForPrompt,
  buildFactPanel,
  selfCheckOutput,
  EXPANDED_BANNED_PHRASES,
} from "@/lib/aiDataContract";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/* ─── Cache: 30s per match ─── */
const viewCache = new Map<string, { data: MarketViewResponse; at: number }>();
const CACHE_TTL_MS = 30_000;

type MarketState = "BALANCED" | "FAVOURITE_SUPPORTED" | "DRIFT_DETECTED" | "VOLATILE" | "LATE_STEAM";
type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

interface MarketViewResponse {
  success: true;
  marketView: {
    marketState: MarketState;
    summary: string;
    confidence: ConfidenceLevel;
    confidenceReason: string;
    dataSource: {
      scoreProvider: string;
      scoreConfidence: string;
      scoreAvailable: boolean;
      oddsSource: string;
    };
    timestamp: string;
    cached: boolean;
  };
}

const MARKET_VIEW_OUTPUT_FORMAT = `
You MUST respond with valid JSON matching this exact structure:
{
  "marketState": "<BALANCED | FAVOURITE_SUPPORTED | DRIFT_DETECTED | VOLATILE | LATE_STEAM>",
  "summary": "<One concise paragraph (2-3 sentences max) describing current market conditions in plain trader language. State what the market is telling you, not what will happen.>",
  "confidence": "<LOW | MEDIUM | HIGH — must match data confidence level>",
  "confidenceReason": "<One sentence explaining confidence — reference data quality>"
}

MARKET STATE DEFINITIONS:
- BALANCED: Normal spread, no unusual weight on either side, odds stable
- FAVOURITE_SUPPORTED: Significant backing activity, odds shortening for one player
- DRIFT_DETECTED: Favourite drifting, underdog attracting money
- VOLATILE: Large price swings, uncertain market, frequent suspensions
- LATE_STEAM: Recent sharp odds movement in one direction

RULES:
- summary MUST reference ONLY verified data from the DATA CONTRACT
- If score is unavailable, give a price-action read only
- Do NOT predict outcomes or project future prices
- Do NOT claim player statistics unless provided
- If data confidence is LOW, marketState should be BALANCED
- Do NOT recommend trades, entries, exits, or timing
- Describe what the market is doing. The trader decides.
- Plain trader language. No jargon. No filler.
- Do NOT wrap in markdown code fences. Return raw JSON only.
`.trim();

function stripBannedPhrases(text: string): string {
  let result = text;
  for (const phrase of EXPANDED_BANNED_PHRASES) {
    const regex = new RegExp(phrase, "gi");
    result = result.replace(regex, "");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

interface RequestBody {
  player1?: string;
  player2?: string;
  odds1?: number;
  odds2?: number;
  tournament?: string;
  surface?: string;
  isInPlay?: boolean;
  score?: string;
  server?: string;
  scoreConfidence?: "reliable" | "estimated" | "unavailable";
  scoreProvider?: string;
  breakPoint?: boolean;
  setPoint?: boolean;
  matchPoint?: boolean;
  tiebreak?: boolean;
  finalSet?: boolean;
  isScoreStale?: boolean;
  ladderContext?: string;
  matchStateContext?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const body: RequestBody = await req.json();
    const { player1, player2, odds1, odds2, tournament } = body;

    if (!player1 || !player2) {
      return NextResponse.json({ success: false, error: "player1 and player2 required" }, { status: 400 });
    }

    /* ─── Cache check ─── */
    const cacheKey = `${player1}:${player2}:${body.isInPlay ? "ip" : "pm"}`;
    const cached = viewCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      const cachedResponse = { ...cached.data };
      cachedResponse.marketView = { ...cachedResponse.marketView, cached: true };
      return NextResponse.json(cachedResponse);
    }

    /* ─── Build data contract ─── */
    const surfaceInfo = inferSurfaceWithConfidence(tournament, body.surface);
    const matchStatus = body.isInPlay ? "in_play" as const : "pre_match" as const;

    const dataContract = buildDataContract({
      player1, player2, tournament,
      surface: surfaceInfo.surface,
      surfaceVerified: surfaceInfo.verified,
      odds1, odds2,
      score: body.score,
      server: body.server,
      scoreConfidence: body.scoreConfidence,
      isScoreStale: body.isScoreStale,
      ladderContext: body.ladderContext,
      matchStatus,
    });

    const restrictions = buildPromptRestrictions(dataContract);
    const guardrailBlock = buildGuardrailPromptBlock(restrictions);
    const dataContextBlock = buildDataContextForPrompt(dataContract);
    const factPanel = buildFactPanel(dataContract);

    /* ─── Situational flags ─── */
    const flags: string[] = [];
    if (body.matchPoint) flags.push("MATCH POINT");
    else if (body.setPoint) flags.push("SET POINT");
    if (body.breakPoint) flags.push("BREAK POINT");
    if (body.tiebreak) flags.push("TIEBREAK");
    if (body.finalSet) flags.push("FINAL SET");
    if (body.isScoreStale) flags.push("SCORE DATA MAY BE STALE");

    const systemPrompt = [
      "You are a professional Betfair tennis exchange market analyst describing current market conditions.",
      "You give instant, concise market reads based ONLY on verified data.",
      "You are NOT a tipster, prediction oracle, or commentator.",
      "",
      dataContextBlock,
      "",
      MARKET_VIEW_OUTPUT_FORMAT,
      "",
      guardrailBlock,
      "",
      TENNIS_PROMPT_GUARDRAILS,
    ].join("\n");

    const matchState = body.matchStateContext ??
      (body.score ? `Score: ${body.score}. Server: ${body.server ?? "Unknown"}.` : "Score unavailable.");

    const userPrompt = [
      `Match: ${player1} vs ${player2}`,
      `Tournament: ${tournament ?? "Unknown"}`,
      matchState,
      flags.length > 0 ? `Situation: ${flags.join(", ")}` : "",
      `Current odds: ${player1} ${odds1 ?? "?"} / ${player2} ${odds2 ?? "?"}`,
      body.ladderContext ? `Ladder: ${body.ladderContext}` : "",
      "",
      "Give your market view as structured JSON.",
    ].filter(Boolean).join("\n");

    /* ─── Call Anthropic ─── */
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: `Anthropic API error: ${res.status} ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!rawText) {
      return NextResponse.json({ success: false, error: "Empty response from AI" }, { status: 502 });
    }

    /* ─── Parse response ─── */
    const checkedText = selfCheckOutput(rawText, restrictions);
    let parsed: { marketState?: string; summary?: string; confidence?: string; confidenceReason?: string } | null = null;

    try {
      let jsonStr = checkedText.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = null;
    }

    const validStates: MarketState[] = ["BALANCED", "FAVOURITE_SUPPORTED", "DRIFT_DETECTED", "VOLATILE", "LATE_STEAM"];
    const validConf: ConfidenceLevel[] = ["LOW", "MEDIUM", "HIGH"];

    let marketState: MarketState = "BALANCED";
    let summary = "Market view unavailable.";
    let confidence: ConfidenceLevel = dataContract.dataConfidence as ConfidenceLevel;
    let confidenceReason = "Based on available data quality";

    if (parsed) {
      const rawState = (parsed.marketState ?? "").toUpperCase() as MarketState;
      if (validStates.includes(rawState)) marketState = rawState;

      if (parsed.summary) summary = stripBannedPhrases(parsed.summary);

      const rawConf = (parsed.confidence ?? "").toUpperCase() as ConfidenceLevel;
      if (validConf.includes(rawConf)) confidence = rawConf;

      if (parsed.confidenceReason) confidenceReason = stripBannedPhrases(parsed.confidenceReason);

      // Enforce: LOW data confidence → LOW AI confidence
      if (dataContract.dataConfidence === "LOW" && confidence !== "LOW") {
        confidence = "LOW";
        confidenceReason = "Data confidence is LOW — limited analysis only";
      }
    }

    const response: MarketViewResponse = {
      success: true,
      marketView: {
        marketState,
        summary,
        confidence,
        confidenceReason,
        dataSource: {
          scoreProvider: body.scoreProvider ?? "unknown",
          scoreConfidence: body.scoreConfidence ?? "unavailable",
          scoreAvailable: body.scoreConfidence !== "unavailable" && !!body.score,
          oddsSource: "betfair",
        },
        timestamp: new Date().toISOString(),
        cached: false,
      },
    };

    /* ─── Cache result ─── */
    viewCache.set(cacheKey, { data: response, at: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
