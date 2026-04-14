import { NextRequest, NextResponse } from "next/server";

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

  try {
    // Exchange authorization code for access token
    console.log("[Betfair OAuth] Token exchange POST to https://api.betfair.com/exchange/account/rest/v1.0/token/");

    const tokenRes = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": appKey,
        },
        body: JSON.stringify({
          client_id: vendorId,
          grant_type: "AUTHORIZATION_CODE",
          code,
          client_secret: vendorSecret,
        }),
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

    if (!tokenData.access_token) {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set(
        "message",
        tokenData.error ?? tokenData.detail ?? `Token exchange failed (status ${tokenRes.status})`
      );
      return NextResponse.redirect(settingsUrl);
    }

    const sessionToken = tokenData.access_token;

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
      maxAge: 4 * 60 * 60, // 4 hours (expires_in: 14400)
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
