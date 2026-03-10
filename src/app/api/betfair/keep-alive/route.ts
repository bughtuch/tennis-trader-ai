import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      return NextResponse.json(
        { success: false, error: "BETFAIR_APP_KEY is not configured" },
        { status: 500 }
      );
    }

    const { sessionToken } = await req.json();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "No session token provided" },
        { status: 401 }
      );
    }

    const res = await fetch("https://identitysso.betfair.com/api/keepAlive", {
      method: "POST",
      headers: {
        "X-Authentication": sessionToken,
        "X-Application": appKey,
        Accept: "application/json",
      },
    });

    const data = await res.json();

    if (data.status !== "SUCCESS") {
      return NextResponse.json(
        { success: false, error: data.error ?? "Keep-alive failed" },
        { status: 401 }
      );
    }

    // Update betfair_connected_at in Supabase profile
    try {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            betfair_connected_at: new Date().toISOString(),
            betfair_session_token: data.token ?? sessionToken,
          })
          .eq("id", user.id);
      }
    } catch {
      // Non-critical — keep-alive still succeeded
    }

    return NextResponse.json({
      success: true,
      token: data.token ?? sessionToken,
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
