import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    /* ─── Place Shadow Trade ─── */
    if (action === "placeShadowTrade") {
      const { marketId, selectionId, side, price, size, player } = body;

      if (!marketId || !selectionId || !side || !price || !size) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      if (side !== "BACK" && side !== "LAY") {
        return NextResponse.json({ error: "Invalid side" }, { status: 400 });
      }
      if (!Number.isFinite(price) || price < 1.01 || price > 1000) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }
      if (!Number.isFinite(size) || size <= 0) {
        return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
      }

      const { error } = await supabase.from("trades").insert({
        user_id: user.id,
        market_id: marketId,
        selection_id: String(selectionId),
        side,
        entry_price: price,
        stake: size,
        player,
        status: "open",
        is_shadow: true,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    /* ─── Close Shadow Trade (green-up) ─── */
    if (action === "closeShadowTrade") {
      const { tradeId, exitPrice, pnl } = body;

      if (!tradeId || !Number.isFinite(exitPrice) || !Number.isFinite(pnl)) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Verify ownership before updating
      const { data: trade } = await supabase
        .from("trades")
        .select("id")
        .eq("id", tradeId)
        .eq("user_id", user.id)
        .single();

      if (!trade) {
        return NextResponse.json({ error: "Trade not found" }, { status: 404 });
      }

      const { error } = await supabase
        .from("trades")
        .update({
          exit_price: exitPrice,
          pnl,
          status: "closed",
          greened_up: true,
          closed_at: new Date().toISOString(),
        })
        .eq("id", tradeId)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    /* ─── Get Shadow Stats ─── */
    if (action === "getShadowStats") {
      const { data: trades } = await supabase
        .from("trades")
        .select("pnl")
        .eq("user_id", user.id)
        .eq("is_shadow", true)
        .eq("status", "closed");

      if (!trades || trades.length === 0) {
        return NextResponse.json({
          success: true,
          stats: { totalTrades: 0, totalPnl: 0, wins: 0, bestTrade: 0 },
        });
      }

      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const bestTrade = Math.max(...trades.map((t) => t.pnl ?? 0));

      return NextResponse.json({
        success: true,
        stats: {
          totalTrades: trades.length,
          totalPnl: Math.round(totalPnl * 100) / 100,
          wins,
          bestTrade: Math.round(bestTrade * 100) / 100,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
