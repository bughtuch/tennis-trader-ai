import { NextRequest, NextResponse } from "next/server";

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
    // Step 1: Get fresh vendor session via edge route
    console.log("[Betfair OAuth] Fetching fresh vendor session...");
    const vendorUrl = new URL("/api/betfair/vendor-session", req.url).toString();
    const vendorRes = await fetch(vendorUrl, { method: "POST" });
    const vendorData = await vendorRes.json();
    if (!vendorData.token) {
      throw new Error(vendorData.error ?? "Vendor session unavailable");
    }
    const vendorSession = vendorData.token;
    console.log("[Betfair OAuth] Fresh vendor session obtained, exchanging code...");

    // Step 2: Token exchange via JSON-RPC (standard Node runtime)
    const rpcBody = {
      jsonrpc: "2.0",
      method: "AccountAPING/v1.0/token",
      params: {
        client_id: VENDOR_ID,
        grant_type: "AUTHORIZATION_CODE",
        code,
        client_secret: VENDOR_SECRET,
      },
      id: 1,
    };

    const tokenRes = await fetch(
      "https://api.betfair.com/exchange/account/json-rpc/v1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": vendorSession,
        },
        body: JSON.stringify(rpcBody),
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

    if (tokenData.error) {
      return NextResponse.json({
        error: "Token exchange failed",
        detail: tokenData.error?.data?.exceptionname ?? tokenData.error?.message ?? "Unknown error",
        response: tokenText.substring(0, 500),
      }, { status: 502 });
    }

    if (!tokenData.result?.access_token) {
      return NextResponse.json({
        error: "Token exchange failed — no access_token",
        status: tokenRes.status,
        response: tokenText.substring(0, 500),
      }, { status: 502 });
    }

    const sessionToken = tokenData.result.access_token;
    console.log("[Betfair OAuth] Access token obtained");

    // Pass token to settings page via URL — client-side React saves to localStorage
    settingsUrl.searchParams.set("betfair", "connected");
    settingsUrl.searchParams.set("bt", sessionToken);
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
