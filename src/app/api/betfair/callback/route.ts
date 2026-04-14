import { NextRequest, NextResponse } from "next/server";

// Standard Node runtime — env vars work, Supabase cookies work
// Vendor login is delegated to /api/betfair/vendor-login (edge runtime)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const settingsUrl = new URL("/settings", req.url);

  if (!code) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "No authorization code received");
    return NextResponse.redirect(settingsUrl);
  }

  const vendorId = "157798";
  const vendorSecret = process.env.BETFAIR_VENDOR_SECRET || "a3114dca-8775-4a6b-80d3-db338edd8cf5";
  const appKey = process.env.BETFAIR_APP_KEY || "fCsY8wIPysRCihHi";

  try {
    // Step 1: Get vendor session via edge function (unblocked IPs)
    console.log("[Betfair OAuth] Step 1: Getting vendor session via edge...");
    const baseUrl = req.nextUrl.origin;
    const vendorRes = await fetch(`${baseUrl}/api/betfair/vendor-login`);
    const vendorData = await vendorRes.json();

    if (!vendorData.success || !vendorData.token) {
      return NextResponse.json({
        error: "Vendor login failed",
        detail: vendorData,
      }, { status: 502 });
    }

    const vendorSessionToken = vendorData.token;
    console.log("[Betfair OAuth] Vendor session obtained");

    // Step 2: Exchange authorization code for user access token
    const requestBody = {
      client_id: vendorId,
      grant_type: "AUTHORIZATION_CODE",
      code,
      client_secret: vendorSecret,
    };

    console.log("[Betfair OAuth] Step 2: Token exchange...");
    console.log("[Betfair OAuth] Request body:", JSON.stringify(requestBody));

    const tokenRes = await fetch(
      "https://api.betfair.com/exchange/account/rest/v1.0/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": appKey,
          "X-Authentication": vendorSessionToken,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const tokenText = await tokenRes.text();
    console.log("[Betfair OAuth] Token exchange status:", tokenRes.status);
    console.log("[Betfair OAuth] Token exchange response:", tokenText);

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
    console.log("[Betfair OAuth] User access token obtained");

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
