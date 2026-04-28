import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_ID = "157798";
const VENDOR_SECRET = "a3114dca-8775-4a6b-80d3-db338edd8cf5";

async function freshVendorSession(): Promise<string> {
  const res = await fetch("https://identitysso.betfair.com/api/login", {
    method: "POST",
    headers: {
      "X-Application": APP_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: "totalis",
      password: "Poppiegirl13@",
    }),
  });
  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.token) {
    throw new Error(`Vendor login failed: ${data.error ?? data.status}`);
  }
  return data.token;
}

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

    console.log("[Betfair OAuth] Logging in as vendor for fresh session...");
    const vendorSession = await freshVendorSession();
    console.log("[Betfair OAuth] Fresh vendor session obtained, exchanging code...");

    const tokenRes = await fetch(
      "https://betfair-token-proxy-production.up.railway.app/betfair-token",
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

    // Diagnostic logging — inspect all possible token fields
    console.log("[callback] token exchange response keys:", Object.keys(tokenData));
    console.log("[callback] has access_token:", !!tokenData?.access_token);
    console.log("[callback] has result.access_token:", !!tokenData?.result?.access_token);
    console.log("[callback] has token:", !!tokenData?.token);
    console.log("[callback] has sessionToken:", !!tokenData?.sessionToken);

    const customerToken = tokenData?.access_token || tokenData?.result?.access_token || tokenData?.token;
    console.log("[callback] customer token preview:", customerToken?.substring(0, 8));

    if (!customerToken) {
      return NextResponse.json({
        error: "Token exchange failed — no token found in response",
        status: tokenRes.status,
        response: tokenText.substring(0, 500),
      }, { status: 502 });
    }

    // Immediately test the token before redirecting
    try {
      const testResponse = await fetch("https://api.betfair.com/exchange/betting/json-rpc/v1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Application": APP_KEY,
          "X-Authentication": customerToken,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "SportsAPING/v1.0/listCurrentOrders",
          params: { orderProjection: "EXECUTABLE" },
          id: 1,
        }),
      });
      const testResult = await testResponse.json();
      console.log("[callback] immediate trade test:", JSON.stringify(testResult));
    } catch (testErr) {
      console.log("[callback] trade test error:", testErr instanceof Error ? testErr.message : testErr);
    }

    const sessionToken = customerToken;
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
