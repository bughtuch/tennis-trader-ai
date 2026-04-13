import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const settingsUrl = new URL("/settings", req.url);

  if (!code) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "No authorization code received");
    return NextResponse.redirect(settingsUrl);
  }

  const vendorId = "157798";
  const vendorSecret = process.env.BETFAIR_VENDOR_SECRET ?? "a3114dca-8775-4a6b-80d3-db338edd8cf5";
  const appKey = process.env.BETFAIR_APP_KEY ?? "fCsY8wIPysRCihHi";
  // Must match EXACTLY what Betfair has registered, including trailing ?
  const redirectUri = "https://tennistraderai.com/api/betfair/callback?";

  try {
    // Exchange authorization code for session token
    // Build body manually to avoid URLSearchParams double-encoding the redirect_uri
    const formBody = [
      `client_id=${vendorId}`,
      `client_secret=${vendorSecret}`,
      `grant_type=authorization_code`,
      `code=${encodeURIComponent(code)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
    ].join("&");

    console.log("[Betfair OAuth] Token exchange POST to https://identitysso.betfair.com/api/token");
    console.log("[Betfair OAuth] Body:", formBody);

    const tokenRes = await fetch(
      "https://identitysso.betfair.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "X-Application": appKey,
        },
        body: formBody,
      }
    );

    console.log("[Betfair OAuth] Response status:", tokenRes.status);
    const tokenText = await tokenRes.text();
    console.log("[Betfair OAuth] Response body (first 200):", tokenText.substring(0, 200));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set("message", `Token endpoint returned non-JSON (status ${tokenRes.status})`);
      return NextResponse.redirect(settingsUrl);
    }

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
