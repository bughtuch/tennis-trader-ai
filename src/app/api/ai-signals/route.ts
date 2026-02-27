import { NextRequest, NextResponse } from "next/server";

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
}

/* ─── Signal Configs ─── */

function getConfig(signalType: SignalType) {
  switch (signalType) {
    case "pre_match":
      return {
        model: "claude-sonnet-4-5-20250929",
        maxTokens: 400,
        system:
          "You are an expert tennis trading analyst for Betfair Exchange. Provide concise, actionable trading analysis. Focus on: H2H records, surface form, fatigue, market pricing efficiency. Always specify if you see value and which side (back or lay). Be specific about odds levels. Keep response under 200 words.",
      };
    case "in_play":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 150,
        system:
          "You are a real-time tennis trading analyst. Analyse the current match state and identify momentum shifts, break opportunities, and market mispricings. Be extremely concise - max 50 words. Focus on what's actionable RIGHT NOW.",
      };
    case "edge_alert":
      return {
        model: "claude-haiku-4-5-20251001",
        maxTokens: 200,
        system:
          "You are a tennis trading edge detector. When you identify a gap between market price and fair value, explain it clearly. Max 80 words. State: edge direction, player, current odds vs fair odds, confidence, reasoning.",
      };
  }
}

function buildUserPrompt(
  signalType: SignalType,
  ctx: MatchContext
): string {
  const p1 = ctx.player1 ?? "Player 1";
  const p2 = ctx.player2 ?? "Player 2";

  switch (signalType) {
    case "pre_match":
      return [
        `Match: ${p1} vs ${p2}`,
        `Tournament: ${ctx.tournament ?? "Unknown"}`,
        `Surface: ${ctx.surface ?? "Unknown"}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        "Provide: H2H assessment, surface form analysis, fatigue check, edge rating (none/mild/moderate/strong), and confidence (0-100%).",
      ].join("\n");

    case "in_play":
      return [
        `Match: ${p1} vs ${p2}`,
        `Score: ${ctx.score ?? "Unknown"}`,
        `Server: ${ctx.server ?? "Unknown"}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        ctx.recentAction ? `Recent: ${ctx.recentAction}` : "",
        "",
        "What's the actionable play right now?",
      ]
        .filter(Boolean)
        .join("\n");

    case "edge_alert":
      return [
        `Match: ${p1} vs ${p2}`,
        `Score: ${ctx.score ?? "Pre-match"}`,
        `Surface: ${ctx.surface ?? "Unknown"}`,
        `Current odds: ${p1} ${ctx.odds1 ?? "?"} / ${p2} ${ctx.odds2 ?? "?"}`,
        "",
        "Is there a pricing edge? State direction, fair odds, confidence, and reasoning.",
      ].join("\n");
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

    const config = getConfig(signalType);
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
