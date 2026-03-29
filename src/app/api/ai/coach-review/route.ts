import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

interface ReviewRequest {
  side: string;
  entry_price: number;
  exit_price: number;
  stake: number;
  pnl: number;
  player: string;
  greened_up: boolean;
  hold_seconds: number;
  market_context?: string;
}

export async function POST(req: NextRequest) {
  try {
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

    const body = (await req.json()) as ReviewRequest;
    const { side, entry_price, exit_price, stake, pnl, player, greened_up, hold_seconds, market_context } = body;

    if (!side || !entry_price || !stake) {
      return NextResponse.json(
        { success: false, error: "Missing required trade data" },
        { status: 400 }
      );
    }

    const pnlStr = pnl >= 0 ? `+£${pnl.toFixed(2)}` : `-£${Math.abs(pnl).toFixed(2)}`;
    const holdMin = Math.floor(hold_seconds / 60);
    const holdSec = hold_seconds % 60;
    const holdStr = holdMin > 0 ? `${holdMin}m ${holdSec}s` : `${holdSec}s`;

    // Calculate approximate R/R context
    const tickMove = Math.abs(exit_price - entry_price);
    const rrContext = tickMove > 0
      ? `Price moved ${(tickMove).toFixed(2)} from entry to exit.`
      : "";

    const userPrompt = [
      `Post-trade review for: ${side} ${player} £${stake} @ ${entry_price.toFixed(2)} → ${exit_price.toFixed(2)}.`,
      `P&L: ${pnlStr}. ${greened_up ? "Greened up." : "Manual exit."}`,
      `Position held for ${holdStr}.`,
      rrContext,
      market_context ? `Market context: ${market_context}` : "",
    ].filter(Boolean).join(" ");

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        system: [
          "You are an expert tennis trading coach reviewing a completed trade on Betfair Exchange.",
          "Give a 2-3 sentence post-trade review with this structure:",
          "1. What they did right or wrong (reference specific prices and the R/R implied by entry).",
          "2. What the optimal entry or exit would have been (suggest a specific price level).",
          "3. One concrete, actionable lesson for next time.",
          "Use Betfair tennis trading terminology. Reference actual numbers from the trade.",
          "Be direct and honest. Praise good discipline, flag impulsive entries.",
          "Keep total response under 60 words.",
        ].join(" "),
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, error: `Anthropic API error: ${res.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const review =
      data.content?.[0]?.type === "text"
        ? data.content[0].text.trim()
        : "No review available.";

    return NextResponse.json({ success: true, review });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
