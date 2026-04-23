import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, setVendorSession } from "@/lib/betfair-vendor";

export const runtime = "nodejs";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_USERNAME = "totalis";

export async function GET(_req: NextRequest) {
  console.log("CRON HIT:", new Date().toISOString());
  try {
    console.log("[cron] Reading token from Supabase...");
    const currentToken = await getVendorSession();
    console.log("[cron] Token read:", currentToken ? `${currentToken.slice(0, 8)}...` : "EMPTY");

    // 1. Try keepAlive with current token (skip if empty)
    if (currentToken && currentToken.length > 0) {
      console.log("[cron] Attempting keepAlive...");
      const keepAliveRes = await fetch(
        "https://identitysso.betfair.com/api/keepAlive",
        {
          method: "POST",
          headers: {
            "X-Application": APP_KEY,
            "X-Authentication": currentToken,
            Accept: "application/json",
          },
        }
      );

      if (keepAliveRes.ok) {
        const data = await keepAliveRes.json();
        console.log("[cron] keepAlive response:", JSON.stringify(data));
        if (data.status === "SUCCESS") {
          // Token still valid — update timestamp
          console.log("[cron] Token valid, saving to Supabase...");
          await setVendorSession(currentToken);
          console.log("[cron] Done — token kept alive");
          return NextResponse.json({
            success: true,
            refreshed: false,
            message: "Token kept alive",
          });
        }
      } else {
        console.log("[cron] keepAlive failed HTTP", keepAliveRes.status);
      }
    }

    // 2. Token expired or missing — do fresh login
    console.log("[cron] Token expired or missing, attempting fresh login...");
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!vendorPassword) {
      console.log("[cron] ERROR: BETFAIR_VENDOR_PASSWORD not configured");
      return NextResponse.json(
        { success: false, error: "BETFAIR_VENDOR_PASSWORD not configured" },
        { status: 500 }
      );
    }

    const loginRes = await fetch(
      "https://identitysso.betfair.com/api/login",
      {
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
      }
    );

    if (!loginRes.ok) {
      console.log("[cron] Login failed HTTP", loginRes.status);
      return NextResponse.json(
        { success: false, error: `Login HTTP ${loginRes.status}` },
        { status: 502 }
      );
    }

    const loginData = await loginRes.json();
    console.log("[cron] Login response status:", loginData.status);
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      console.log("[cron] Login failed:", loginData.error ?? "no token");
      return NextResponse.json(
        { success: false, error: loginData.error ?? "Login failed" },
        { status: 502 }
      );
    }

    // 3. Save new token to Supabase
    console.log("[cron] Saving new token to Supabase...");
    const saved = await setVendorSession(loginData.token);
    if (!saved) {
      console.log("[cron] ERROR: Failed to save token to Supabase");
      return NextResponse.json(
        { success: false, error: "Failed to save token to Supabase" },
        { status: 500 }
      );
    }

    console.log("[cron] Done — fresh login completed");
    return NextResponse.json({
      success: true,
      refreshed: true,
      message: "Fresh login completed",
    });
  } catch (err) {
    console.log("[cron] ERROR:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
