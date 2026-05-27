import { NextRequest, NextResponse } from "next/server";
import { inferSurface, getSurfaceContext, TENNIS_PROMPT_GUARDRAILS } from "@/lib/tennisContext";

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
}

/* ─── Signal Configs ─── */

function getConfig(signalType: SignalType, surface: string) {
  const surfaceCtx = getSurfaceContext(surface);

  switch (signalType) {
    case "pre_match":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 400,
        system: [
          "You are a professional Betfair tennis exchange trader preparing a pre-match read.",
          "Speak like a trader reviewing the card — not a commentator, pundit, or financial analyst.",
          `Surface context: ${surfaceCtx}`,
          "Reference likely price movements, key levels, and where value might sit.",
          "Use language like: 'Expect the favourite to shorten if holds early service games', 'Value on the lay if opener goes with serve', 'Break pressure could see price drift past X.XX'.",
          "Structure: surface-adjusted form read, serve/return matchup, key price levels, one actionable edge rating (none/mild/moderate/strong).",
          "Keep under 150 words.",
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "in_play":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 150,
        system: [
          "You are a professional Betfair tennis exchange trader giving real-time ladder reads.",
          "Speak like a trader on the desk, not a commentator or analyst.",
          `Surface: ${surface}.`,
          "Use language like: 'Favourite being backed after hold of serve', 'Move lacks follow-through on the lay side', 'Sustained buying pressure supporting this drift', 'Outer ladder thinning as price shortens', 'Break of serve — expect sharp shortening', 'Second serve pressure building on the return game'.",
          "Reference price action, order flow, and serve-game context — not abstract statistics.",
          "Max 40 words. One sentence preferred.",
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
      };
    case "edge_alert":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 200,
        system: [
          "You are a professional Betfair tennis exchange trader who spotted a pricing inefficiency.",
          "Explain it like you'd tell another trader on the desk.",
          `Surface: ${surface}.`,
          "Reference the ladder: which side has weight, where the price should be based on scoreboard and serve-game context, and what's driving the mispricing.",
          "Consider whether the move is supported by serve pressure, break momentum, or just panic money.",
          "Max 60 words.",
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

  switch (signalType) {
    case "pre_match":
      return [
        `Match: ${p1} vs ${p2}`,
        `Tournament: ${ctx.tournament ?? "Unknown"}`,
        `Surface: ${surface}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        "Give your pre-match trading read: surface-adjusted form, serve/return matchup, key price levels, and edge rating (none/mild/moderate/strong).",
      ].join("\n");

    case "in_play": {
      // Use structured match state context if available
      const matchState = ctx.matchStateContext ?? (ctx.score ? `Score: ${ctx.score}. Server: ${ctx.server ?? "Unknown"}.` : "Score unavailable — read price action only.");
      return [
        `Match: ${p1} vs ${p2} (${surface})`,
        matchState,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.recentAction ? `Recent: ${ctx.recentAction}` : "",
        ctx.ladderContext ? `Ladder: ${ctx.ladderContext}` : "",
        "",
        ctx.scoreConfidence === "unavailable"
          ? "Score data unavailable. Give a ladder/price-action read only — do not guess the score."
          : ctx.scoreConfidence === "estimated"
            ? "Score is estimated and may be inaccurate. Caveat any scoreboard-based analysis. What's the actionable play?"
            : "What's the actionable play right now? Reference serve-game context and ladder.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "edge_alert": {
      const scoreInfo = ctx.matchStateContext ?? (ctx.score ? `Score: ${ctx.score}.` : "Score unavailable.");
      return [
        `Match: ${p1} vs ${p2} (${surface})`,
        scoreInfo,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        ctx.scoreConfidence === "unavailable"
          ? "Score unavailable. Is there a pricing edge based on price action and ladder weight alone?"
          : "Is there a pricing edge? State direction, where the price should be, and what serve/scoreboard context supports it.",
      ].join("\n");
    }
  }
}

/* ─── Parse Confidence & Edge Size ─── */

function parseConfidence(text: string): number {
  // Match patterns like "confidence: 72%", "Confidence 85%", "72% confidence"
  const match =
    text.match(/confidence[:\s]*(\d+)\s*%/i) ??
    text.match(/(\d+)\s*%\s*confidence/i) ??
    text.match(/(\d+)%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) return val;
  }
  return 50; // default if not parseable
}

function parseEdgeSize(text: string): EdgeSize {
  const lower = text.toLowerCase();
  if (/\bstrong\b/.test(lower)) return "strong";
  if (/\bmoderate\b/.test(lower)) return "moderate";
  if (/\bmild\b/.test(lower) || /\bslight\b/.test(lower)) return "mild";
  if (/\bnone\b/.test(lower) || /\bno edge\b/.test(lower)) return "none";
  return "mild"; // default
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
    const analysis =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: "Empty response from AI model" },
        { status: 502 }
      );
    }

    const confidence = parseConfidence(analysis);
    const edgeSize = parseEdgeSize(analysis);

    return NextResponse.json({
      success: true,
      signal: {
        type: signalType,
        confidence,
        edgeSize,
        analysis,
        model: config.model,
        timestamp: new Date().toISOString(),
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
