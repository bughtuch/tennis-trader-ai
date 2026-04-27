import { NextRequest, NextResponse } from "next/server";
import { getVendorSession } from "@/lib/betfair-vendor";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_ID = "157798";
const VENDOR_SECRET = "a3114dca-8775-4a6b-80d3-db338edd8cf5";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const settingsUrl = new URL("/settings", req.url);

  if (!code) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "No authorization code received");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const requestBody = {
      client_id: VENDOR_ID,
      grant_type: "AUTHORIZATION_CODE",
      code,
      client_secret: VENDOR_SECRET,
    };

    const vendorSession = await getVendorSession();

    const tokenRes = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": vendorSession,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const tokenText = await tokenRes.text();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return NextResponse.json({
        error: "Token exchange failed — non-JSON response",
        status: tokenRes.status,
        response: tokenText.substring(0, 500),
      }, { status: 502 });
    }

    if (!tokenData.access_token) {
      return NextResponse.json({
        error: "Token exchange failed — no access_token",
        status: tokenRes.status,
        response: tokenText.substring(0, 500),
      }, { status: 502 });
    }

    const sessionToken = tokenData.access_token;

    // Save token to Supabase profile so it persists across sessions
    try {
      const { createServerClient } = await import("@/lib/supabase-server");
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          betfair_session_token: sessionToken,
          betfair_connected: true,
          betfair_connected_at: new Date().toISOString(),
        }).eq("id", user.id);
      }
    } catch {
      // Non-critical — client-side will also save to localStorage
    }

    // Pass token to settings page via URL — client-side React saves to localStorage
    settingsUrl.searchParams.set("betfair", "connected");
    settingsUrl.searchParams.set("bt", sessionToken);
    const response = NextResponse.redirect(settingsUrl);
    // Set httpOnly cookie so keep-alive route can refresh the token
    response.cookies.set("betfair_session", sessionToken, {
      httpOnly: true,
      secure: true,
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
