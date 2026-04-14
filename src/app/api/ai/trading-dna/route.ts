import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const runtime = "edge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MIN_TRADES = 20;

interface DnaResult {
  bestSurface: string;
  bestTournamentLevel: string;
  bestTimeOfDay: string;
  avgWinSize: number;
  avgLossSize: number;
  winRate: number;
  revengeTradeRate: number;
  bestEntryTiming: string;
  worstPattern: string;
  oneLineSummary: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;

    // Check for cached DNA (less than 24 hours old)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("trading_dna")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (cached?.dna_data) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < 24 * 60 * 60 * 1000) {
          return NextResponse.json({
            success: true,
            ready: true,
            dna: cached.dna_data,
            cached: true,
            tradeCount: cached.trade_count,
          });
        }
      }
    }

    // Fetch all closed trades
    const { data: trades, count } = await supabase
      .from("trades")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "closed")
      .order("closed_at", { ascending: false });

    const tradeCount = count ?? trades?.length ?? 0;

    if (tradeCount < MIN_TRADES) {
      return NextResponse.json({
        success: true,
        ready: false,
        tradeCount,
        tradesNeeded: MIN_TRADES - tradeCount,
      });
    }

    // Call Claude Sonnet to analyse
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Build compact trade summary for the prompt
    const tradeSummary = (trades ?? []).map((t) => ({
      side: t.side,
      player: t.player,
      entry: t.entry_price,
      exit: t.exit_price,
      stake: t.stake,
      pnl: t.pnl,
      greened_up: t.greened_up,
      paper: t.is_shadow,
      time: t.closed_at,
    }));

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        system:
          "You are a trading pattern analyst. Analyse this trader's complete history. Return ONLY valid JSON with these fields: bestSurface (hard/clay/grass), bestTournamentLevel (grand slam/masters/challenger), bestTimeOfDay (morning/afternoon/evening), avgWinSize (number), avgLossSize (number), winRate (number 0-100), revengeTradeRate (number 0-100, losses followed by immediate re-entry within 2 minutes), bestEntryTiming (one sentence), worstPattern (one sentence), oneLineSummary (one sentence). Be specific and honest. Return ONLY the JSON object, no markdown.",
        messages: [
          {
            role: "user",
            content: `Analyse these ${tradeCount} trades:\n${JSON.stringify(tradeSummary)}`,
          },
        ],
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
    const rawText =
      data.content?.[0]?.type === "text" ? data.content[0].text.trim() : "";

    let dna: DnaResult;
    try {
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
      dna = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    // Save to Supabase
    await supabase.from("trading_dna").insert({
      user_id: user.id,
      dna_data: dna,
      trade_count: tradeCount,
    });

    return NextResponse.json({
      success: true,
      ready: true,
      dna,
      cached: false,
      tradeCount,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
