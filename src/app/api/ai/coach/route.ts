import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

interface CoachRequest {
  side: string;
  entry_price: number;
  exit_price: number;
  stake: number;
  pnl: number;
  player: string;
  greened_up: boolean;
  market_context?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CoachRequest;
    const { side, entry_price, exit_price, stake, pnl, player, greened_up, market_context } = body;

    if (!side || !entry_price || !stake) {
      return NextResponse.json(
        { success: false, error: "Missing required trade data" },
        { status: 400 }
      );
    }

    const pnlStr = pnl >= 0 ? `+£${pnl.toFixed(2)}` : `-£${Math.abs(pnl).toFixed(2)}`;
    const userPrompt = `Trade just closed: ${side} ${player} £${stake} @ ${entry_price} → ${exit_price}. P&L: ${pnlStr}. ${greened_up ? "Greened up." : "Manual exit."}${market_context ? ` Context: ${market_context}` : ""}`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system:
          "You are a tennis trading coach. After each trade, give one specific lesson in under 25 words. Reference the actual numbers. Be honest - praise good decisions, flag mistakes. Never generic.",
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
    const insight =
      data.content?.[0]?.type === "text"
        ? data.content[0].text.trim()
        : "No insight available.";

    return NextResponse.json({ success: true, insight });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
