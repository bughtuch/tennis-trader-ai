import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, setVendorSession, isLoginCoolingDown, recordLoginAttempt } from "@/lib/betfair-vendor";

export const runtime = "edge";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_USERNAME = "totalis";

export async function GET(_req: NextRequest) {
  console.log("[auth] cron vendor-keepalive hit:", new Date().toISOString());
  try {
    const currentToken = await getVendorSession();

    // 1. Try keepAlive with current token (not a login, safe to retry)
    if (currentToken && currentToken.length > 0) {
      console.log("[auth] attempting keepAlive...");
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
        if (data.status === "SUCCESS") {
          console.log("[auth] using cached session — keepAlive succeeded");
          await setVendorSession(currentToken);
          return NextResponse.json({
            success: true,
            refreshed: false,
            message: "Token kept alive",
          });
        }
      }
      console.log("[auth] keepAlive failed, token may be expired");
    }

    // 2. Check login cooldown before fresh login
    if (isLoginCoolingDown()) {
      console.log("[auth] login blocked by cooldown — skipping this cycle");
      return NextResponse.json({
        success: false,
        cooldown: true,
        message: "Login cooldown active, will retry next cycle",
      });
    }

    // 3. Token expired or missing — do fresh login
    console.log("[auth] performing login...");
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!vendorPassword) {
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
      console.log("[auth] login failed HTTP", loginRes.status);
      recordLoginAttempt(false);
      return NextResponse.json(
        { success: false, error: `Login HTTP ${loginRes.status}` },
        { status: 502 }
      );
    }

    const loginData = await loginRes.json();
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      console.log("[auth] login failed:", loginData.error ?? "no token");
      recordLoginAttempt(false);
      return NextResponse.json(
        { success: false, error: loginData.error ?? "Login failed" },
        { status: 502 }
      );
    }

    // 4. Success
    recordLoginAttempt(true);
    await setVendorSession(loginData.token);
    console.log("[auth] fresh login completed");
    return NextResponse.json({
      success: true,
      refreshed: true,
      message: "Fresh login completed",
    });
  } catch (err) {
    console.log("[auth] cron error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
