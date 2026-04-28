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

  try {
    console.log("[callback] Sending code to VPS proxy...");

    const tokenRes = await fetch(
      "http://proxy.tennistraderai.com:3000/betfair-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ code }),
      }
    );

    const tokenText = await tokenRes.text();
    console.log("[callback] proxy status:", tokenRes.status);
    console.log("[callback] proxy content-type:", tokenRes.headers.get("content-type"));
    console.log("[callback] proxy raw (300):", tokenText.substring(0, 300));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set(
        "message",
        `Token exchange failed — non-JSON response (HTTP ${tokenRes.status})`
      );
      return NextResponse.redirect(settingsUrl);
    }

    const customerToken = tokenData?.access_token || tokenData?.token;
    const tokenType = tokenData?.token_type || "BEARER";
    const refreshToken = tokenData?.refresh_token || null;

    console.log("[callback] access_token present:", !!customerToken);
    console.log("[callback] token_type:", tokenType);
    console.log("[callback] refresh_token present:", !!refreshToken);
    if (customerToken) {
      console.log("[callback] token preview:", customerToken.substring(0, 10));
    }

    if (!customerToken) {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set(
        "message",
        tokenData?.error || "Token exchange failed — no access_token in response"
      );
      return NextResponse.redirect(settingsUrl);
    }

    // Pass token to settings page via URL — client-side React saves to localStorage
    settingsUrl.searchParams.set("betfair", "connected");
    settingsUrl.searchParams.set("bt", customerToken);
    settingsUrl.searchParams.set("btt", tokenType);
    if (refreshToken) settingsUrl.searchParams.set("brt", refreshToken);

    const maskedUrl = settingsUrl.toString().replace(/bt=[^&]+/, "bt=(MASKED)");
    console.log("[callback] redirect URL:", maskedUrl);
    console.log("[callback] redirect URL has bt:", settingsUrl.searchParams.has("bt"));
    console.log("[callback] redirect URL bt length:", settingsUrl.searchParams.get("bt")?.length);

    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[callback] Error:", err);
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set(
      "message",
      err instanceof Error ? err.message : "Token exchange failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
