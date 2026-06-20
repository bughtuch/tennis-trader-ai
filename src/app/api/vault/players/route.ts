import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/* GET /api/vault/players — distinct player names for autocomplete */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { data, error } = await supabase
      .from("player_notes")
      .select("player_name")
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Deduplicate and sort
    const unique = [...new Set((data ?? []).map(r => r.player_name))].sort();

    return NextResponse.json({ success: true, players: unique });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
