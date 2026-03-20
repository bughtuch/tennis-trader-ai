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

    const sessionToken = req.cookies.get("betfair_session")?.value;
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
        const newToken = data.token ?? sessionToken;
        await supabase
          .from("profiles")
          .update({
            betfair_connected_at: new Date().toISOString(),
            betfair_session_token: newToken,
          })
          .eq("id", user.id);
      }
    } catch {
      // Non-critical — keep-alive still succeeded
    }

    // If Betfair rotated the token, update the cookie
    const response = NextResponse.json({ success: true });
    if (data.token && data.token !== sessionToken) {
      response.cookies.set("betfair_session", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
        path: "/",
      });
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

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("betfair_session");
  return response;
}
