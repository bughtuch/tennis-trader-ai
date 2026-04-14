import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Hardcoded to prove OAuth works — edge runtime can't read env vars
const VENDOR_SESSION = "UzQJUeW2N2THhqeLD4R5GbKXa/MgxOOjuLoz44f3w5s=";
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

    console.log("[Betfair OAuth] Token exchange...");
    console.log("[Betfair OAuth] Request body:", JSON.stringify(requestBody));

    const tokenRes = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": VENDOR_SESSION,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const tokenText = await tokenRes.text();
    console.log("[Betfair OAuth] Response status:", tokenRes.status);
    console.log("[Betfair OAuth] Response:", tokenText);

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
    console.log("[Betfair OAuth] Access token obtained");

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

    // Redirect to settings with token in URL so client can save to localStorage
    settingsUrl.searchParams.set("betfair", "connected");
    settingsUrl.searchParams.set("token", sessionToken);
    return NextResponse.redirect(settingsUrl);
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
