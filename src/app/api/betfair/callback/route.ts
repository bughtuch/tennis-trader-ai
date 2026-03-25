import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const settingsUrl = new URL("/settings", req.url);

  if (!code) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "No authorization code received");
    return NextResponse.redirect(settingsUrl);
  }

  const appKey = process.env.BETFAIR_APP_KEY;
  const redirectUri = process.env.BETFAIR_REDIRECT_URI;

  if (!appKey || !redirectUri) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "OAuth not configured");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Exchange authorization code for session token
    const tokenRes = await fetch(
      "https://identitysso.betfair.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Application": appKey,
        },
        body: new URLSearchParams({
          client_id: appKey,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.status !== "SUCCESS" || !tokenData.token) {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set(
        "message",
        tokenData.error ?? `Token exchange failed (${tokenData.status})`
      );
      return NextResponse.redirect(settingsUrl);
    }

    const sessionToken = tokenData.token;

    // Save to Supabase profile
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
            betfair_connected: true,
            betfair_session_token: sessionToken,
            betfair_connected_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    } catch (dbErr) {
      console.error("[Betfair OAuth Callback] Profile update failed:", dbErr);
    }

    // Set session cookie and redirect to settings
    settingsUrl.searchParams.set("betfair", "connected");
    const response = NextResponse.redirect(settingsUrl);

    response.cookies.set("betfair_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Betfair OAuth Callback] Error:", err);
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set(
      "message",
      err instanceof Error ? err.message : "Token exchange failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
