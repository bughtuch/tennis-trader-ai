import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

interface BriefingRequest {
  market_id: string;
  player1: string;
  player2: string;
  tournament: string;
  surface: string;
  odds1: number;
  odds2: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BriefingRequest;
    const { market_id, player1, player2, tournament, surface, odds1, odds2 } = body;

    if (!market_id || !player1 || !player2) {
      return NextResponse.json(
        { success: false, error: "market_id, player1, and player2 are required" },
        { status: 400 }
      );
    }

    // Check Supabase for cached briefing
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: cached } = await supabase
        .from("briefings")
        .select("*")
        .eq("market_id", market_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cached?.content) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < 60 * 60 * 1000) {
          return NextResponse.json({
            success: true,
            briefing: cached.content,
            cached: true,
          });
        }
      }
    }

    // Generate new briefing via Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const userPrompt = `Pre-match briefing for: ${player1} (${odds1.toFixed(2)}) vs ${player2} (${odds2.toFixed(2)}) at ${tournament} on ${surface}.`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 250,
        system:
          "You are an expert tennis trading analyst. Generate a pre-match trading briefing in under 100 words. Include: key price levels to watch, likely odds movement patterns, when to enter, danger zones, and one specific edge if you see one. Be actionable for a Betfair trader, not a fan.",
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
    const briefing =
      data.content?.[0]?.type === "text"
        ? data.content[0].text.trim()
        : "No briefing available.";

    // Save to Supabase
    if (user) {
      await supabase.from("briefings").insert({
        user_id: user.id,
        market_id,
        player1,
        player2,
        tournament,
        surface,
        content: briefing,
      });
    }

    return NextResponse.json({ success: true, briefing, cached: false });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
