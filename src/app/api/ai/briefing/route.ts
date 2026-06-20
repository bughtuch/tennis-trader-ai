import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import {
  inferSurfaceWithConfidence,
  getSurfaceContext,
  TENNIS_PROMPT_GUARDRAILS,
} from "@/lib/tennisContext";
import {
  buildDataContract,
  buildPromptRestrictions,
  buildGuardrailPromptBlock,
  buildDataContextForPrompt,
  selfCheckOutput,
} from "@/lib/aiDataContract";

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
    const { market_id, player1, player2, tournament, surface, odds1, odds2 } =
      body;

    if (!market_id || !player1 || !player2) {
      return NextResponse.json(
        {
          success: false,
          error: "market_id, player1, and player2 are required",
        },
        { status: 400 },
      );
    }

    // Check Supabase for cached briefing
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
        { status: 500 },
      );
    }

    /* ─── Build Data Contract ─── */
    const surfaceInfo = inferSurfaceWithConfidence(tournament, surface);

    const dataContract = buildDataContract({
      player1,
      player2,
      tournament,
      surface: surfaceInfo.surface,
      surfaceVerified: surfaceInfo.verified,
      odds1,
      odds2,
      matchStatus: "pre_match",
    });

    const restrictions = buildPromptRestrictions(dataContract);
    const guardrailBlock = buildGuardrailPromptBlock(restrictions);
    const dataContextBlock = buildDataContextForPrompt(dataContract);

    const surfaceCtx = surfaceInfo.verified
      ? getSurfaceContext(surfaceInfo.surface)
      : "Surface is NOT verified. Do not reference surface-specific patterns.";

    const userPrompt = `Pre-match briefing for: ${player1} (${odds1.toFixed(2)}) vs ${player2} (${odds2.toFixed(2)}) at ${tournament}.`;

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
        system: [
          "You are a professional Betfair tennis exchange trader preparing a pre-match research briefing.",
          "You are NOT a tipster or prediction oracle. You explain verified data in plain trader language.",
          "",
          dataContextBlock,
          "",
          surfaceCtx,
          "",
          "Generate a pre-match research briefing in under 100 words. Include ONLY what verified data supports:",
          "- Surface context and what it means for match dynamics",
          "- Ranking or seeding context if relevant",
          "- Any known fitness, injury, or withdrawal notes",
          "- Historical tendencies at this event or surface",
          "- Market observation: where odds are priced and any notable spread",
          "- What data is missing",
          "Do NOT recommend trades, entries, exits, or timing.",
          "Do NOT say when to enter or what to watch for as a trading trigger.",
          "Describe the context. The trader decides.",
          "Do NOT claim player serve/return stats unless provided.",
          "Do NOT reference opening odds (not available).",
          "Do NOT predict set-end prices.",
          surfaceInfo.verified
            ? "- Surface-adjusted trading considerations"
            : "- Surface is unverified — do not reference surface dynamics.",
          "",
          guardrailBlock,
          "",
          TENNIS_PROMPT_GUARDRAILS,
        ].join("\n"),
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          success: false,
          error: `Anthropic API error: ${res.status} ${errText}`,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    let briefing =
      data.content?.[0]?.type === "text"
        ? data.content[0].text.trim()
        : "No briefing available.";

    // Self-check the output
    briefing = selfCheckOutput(briefing, restrictions);

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
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
