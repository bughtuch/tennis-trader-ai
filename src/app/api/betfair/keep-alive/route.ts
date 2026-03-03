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

    // Get session token from cookie
    const sessionToken = req.cookies.get("betfair_session")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "No Betfair session cookie" },
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

    // Refresh the httpOnly cookie with a new 8hr maxAge
    const response = NextResponse.json({
      success: true,
      token: data.token ?? sessionToken,
    });

    response.cookies.set("betfair_session", data.token ?? sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

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
          .update({ betfair_connected_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    } catch {
      // Non-critical — keep-alive still succeeded
    }

    return response;
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
