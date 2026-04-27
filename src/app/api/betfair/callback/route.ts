import { NextRequest, NextResponse } from "next/server";
import { getVendorSession } from "@/lib/betfair-vendor";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const settingsUrl = new URL("/settings", req.url);

  if (!code) {
    settingsUrl.searchParams.set("betfair", "error");
    settingsUrl.searchParams.set("message", "No authorization code received");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const vendorSession = await getVendorSession();
    if (!vendorSession) {
      settingsUrl.searchParams.set("betfair", "error");
      settingsUrl.searchParams.set("message", "Vendor session unavailable");
      return NextResponse.redirect(settingsUrl);
    }

    // Redirect to client-side page that does the token exchange in the browser
    // (Betfair API blocks Vercel server IPs)
    const connectUrl = new URL("/auth/betfair-connect", req.url);
    connectUrl.searchParams.set("code", code);
    connectUrl.searchParams.set("vs", vendorSession);
    return NextResponse.redirect(connectUrl);
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
