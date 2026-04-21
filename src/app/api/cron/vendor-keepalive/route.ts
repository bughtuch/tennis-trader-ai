import { NextRequest, NextResponse } from "next/server";
import { getVendorSession, setVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_USERNAME = "totalis";

export async function GET(_req: NextRequest) {
  try {
    const currentToken = await getVendorSession();

    // 1. Try keepAlive with current token
    if (currentToken) {
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
          // Token still valid — update timestamp
          await setVendorSession(currentToken);
          return NextResponse.json({
            success: true,
            refreshed: false,
            message: "Token kept alive",
          });
        }
      }
    }

    // 2. Token expired or missing — do fresh login
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
      return NextResponse.json(
        { success: false, error: `Login HTTP ${loginRes.status}` },
        { status: 502 }
      );
    }

    const loginData = await loginRes.json();
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      return NextResponse.json(
        { success: false, error: loginData.error ?? "Login failed" },
        { status: 502 }
      );
    }

    // 3. Save new token to Supabase
    const saved = await setVendorSession(loginData.token);
    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Failed to save token to Supabase" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refreshed: true,
      message: "Fresh login completed",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
