import { NextResponse } from "next/server";
import { setVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP_KEY = "fCsY8wIPysRCihHi";
const VENDOR_USERNAME = "totalis";
const STALE_MINUTES = 15;

export async function GET() {
  const now = new Date();
  console.log("[vendor-check] HIT:", now.toISOString());

  try {
    // 1. Read token + updated_at from Supabase
    console.log("[vendor-check] Reading token + updated_at from Supabase...");
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.vendor_session&select=value,updated_at`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.log("[vendor-check] Supabase read failed HTTP", res.status);
      return NextResponse.json({ fresh: false, error: "Supabase read failed" }, { status: 500 });
    }

    const rows = await res.json();
    const token = rows?.[0]?.value ?? "";
    const updatedAt = rows?.[0]?.updated_at ?? null;

    // 2. Calculate age
    let ageMinutes = 999;
    if (updatedAt) {
      ageMinutes = Math.round((now.getTime() - new Date(updatedAt).getTime()) / 60000);
    }
    console.log("[vendor-check] Token:", token ? `${token.slice(0, 8)}...` : "EMPTY", "| Age:", ageMinutes, "min");

    // 3. If fresh enough, skip refresh
    if (token && ageMinutes < STALE_MINUTES) {
      console.log("[vendor-check] Token is fresh, skipping refresh");
      return NextResponse.json({
        fresh: false,
        age_minutes: ageMinutes,
        message: "Token is fresh",
      });
    }

    // 4. Token stale or missing — do fresh login
    console.log("[vendor-check] Token stale/missing, attempting fresh login...");
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!vendorPassword) {
      console.log("[vendor-check] ERROR: BETFAIR_VENDOR_PASSWORD not configured");
      return NextResponse.json({ fresh: false, error: "No vendor password" }, { status: 500 });
    }

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
      console.log("[vendor-check] Login failed HTTP", loginRes.status);
      return NextResponse.json({ fresh: false, age_minutes: ageMinutes, error: `Login HTTP ${loginRes.status}` }, { status: 502 });
    }

    const loginData = await loginRes.json();
    console.log("[vendor-check] Login response status:", loginData.status);
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      console.log("[vendor-check] Login failed:", loginData.error ?? "no token");
      return NextResponse.json({ fresh: false, age_minutes: ageMinutes, error: loginData.error ?? "Login failed" }, { status: 502 });
    }

    // 5. Save new token to Supabase
    console.log("[vendor-check] Saving new token to Supabase...");
    const saved = await setVendorSession(loginData.token);
    if (!saved) {
      console.log("[vendor-check] ERROR: Failed to save token");
      return NextResponse.json({ fresh: false, error: "Supabase save failed" }, { status: 500 });
    }

    console.log("[vendor-check] Done — fresh login completed");
    return NextResponse.json({
      fresh: true,
      age_minutes: ageMinutes,
      refreshed: true,
      message: "Token refreshed",
    });
  } catch (err) {
    console.log("[vendor-check] ERROR:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { fresh: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
