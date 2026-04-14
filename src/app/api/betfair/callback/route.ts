import { NextRequest, NextResponse } from "next/server";
import { getVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

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

    const vendorSession = await getVendorSession();
    if (!vendorSession) {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set("message", "Vendor session unavailable");
      return NextResponse.redirect(settingsUrl);
    }

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
