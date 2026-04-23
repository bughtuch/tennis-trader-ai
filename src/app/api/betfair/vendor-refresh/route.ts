import { NextResponse } from "next/server";
import { setVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_USERNAME = "totalis";

export async function GET() {
  console.log("[vendor-refresh] Manual refresh HIT:", new Date().toISOString());

  try {
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!vendorPassword) {
      console.log("[vendor-refresh] ERROR: BETFAIR_VENDOR_PASSWORD not configured");
      return NextResponse.json({ success: false, error: "No vendor password" }, { status: 500 });
    }

    console.log("[vendor-refresh] Attempting fresh login...");
    const loginRes = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: {
        "X-Application": APP_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username: VENDOR_USERNAME,
        password: vendorPassword,
      }).toString(),
    });

    if (!loginRes.ok) {
      console.log("[vendor-refresh] Login failed HTTP", loginRes.status);
      return NextResponse.json({ success: false, error: `Login HTTP ${loginRes.status}` }, { status: 502 });
    }

    const loginData = await loginRes.json();
    console.log("[vendor-refresh] Login response status:", loginData.status);
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      console.log("[vendor-refresh] Login failed:", loginData.error ?? "no token");
      return NextResponse.json({ success: false, error: loginData.error ?? "Login failed" }, { status: 502 });
    }

    console.log("[vendor-refresh] Saving new token to Supabase...");
    const saved = await setVendorSession(loginData.token);
    if (!saved) {
      console.log("[vendor-refresh] ERROR: Failed to save token");
      return NextResponse.json({ success: false, error: "Supabase save failed" }, { status: 500 });
    }

    console.log("[vendor-refresh] Done — fresh login completed");
    return NextResponse.json({
      success: true,
      refreshed: true,
      message: "Fresh login completed",
    });
  } catch (err) {
    console.log("[vendor-refresh] ERROR:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
