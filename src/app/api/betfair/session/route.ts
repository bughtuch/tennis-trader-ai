import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("betfair_connected, betfair_session_token, betfair_username, betfair_connected_at")
      .eq("id", user.id)
      .single();

    if (!profile?.betfair_connected || !profile?.betfair_session_token) {
      return NextResponse.json({ connected: false });
    }

    // Check if session is expired (8 hours)
    const connectedAt = profile.betfair_connected_at
      ? new Date(profile.betfair_connected_at).getTime()
      : 0;
    const isExpired = connectedAt > 0 && Date.now() > connectedAt + 8 * 3600000;

    if (isExpired) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      sessionToken: profile.betfair_session_token,
      username: profile.betfair_username ?? null,
      connectedAt: profile.betfair_connected_at ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
