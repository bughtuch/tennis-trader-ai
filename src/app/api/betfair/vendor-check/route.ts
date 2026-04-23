import { NextResponse } from "next/server";
import { setVendorSession } from "@/lib/betfair-vendor";

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STALE_MINUTES = 60;

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

    // 3. If fresh enough, skip
    if (token && ageMinutes < STALE_MINUTES) {
      console.log("[vendor-check] Token is fresh, skipping");
      return NextResponse.json({ fresh: false, age_minutes: ageMinutes });
    }

    // 4. Token stale or missing — try keepAlive first
    if (token && token.length > 0) {
      console.log("[vendor-check] Attempting keepAlive...");
      const appKey = process.env.BETFAIR_APP_KEY;
      if (!appKey) {
        console.log("[vendor-check] ERROR: BETFAIR_APP_KEY not configured");
        return NextResponse.json({ fresh: false, error: "BETFAIR_APP_KEY missing" }, { status: 500 });
      }

      const keepAliveRes = await fetch("https://identitysso.betfair.com/api/keepAlive", {
        method: "POST",
        headers: {
          "X-Application": appKey,
          "X-Authentication": token,
          Accept: "application/json",
        },
      });

      if (keepAliveRes.ok) {
        const data = await keepAliveRes.json();
        console.log("[vendor-check] keepAlive response:", JSON.stringify(data));
        if (data.status === "SUCCESS") {
          console.log("[vendor-check] keepAlive succeeded, updating timestamp in Supabase...");
          await setVendorSession(token);
          console.log("[vendor-check] Done — token kept alive");
          return NextResponse.json({ fresh: true, method: "keepalive", age_minutes: ageMinutes });
        }
      } else {
        console.log("[vendor-check] keepAlive failed HTTP", keepAliveRes.status);
      }
    }

    // 5. keepAlive failed or no token — do fresh login
    console.log("[vendor-check] Attempting fresh login...");
    const appKey = process.env.BETFAIR_APP_KEY;
    const vendorUsername = process.env.BETFAIR_VENDOR_USERNAME;
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!appKey || !vendorUsername || !vendorPassword) {
      console.log("[vendor-check] ERROR: Missing env vars — APP_KEY:", !!appKey, "USERNAME:", !!vendorUsername, "PASSWORD:", !!vendorPassword);
      return NextResponse.json({ fresh: false, error: "Missing Betfair env vars" }, { status: 500 });
    }

    const loginRes = await fetch("https://identitysso.betfair.com/api/login", {
      method: "POST",
      headers: {
        "X-Application": appKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username: vendorUsername,
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

    // 6. Save new token to Supabase
    console.log("[vendor-check] Saving new token to Supabase...");
    const saved = await setVendorSession(loginData.token);
    if (!saved) {
      console.log("[vendor-check] ERROR: Supabase save failed");
      return NextResponse.json({ fresh: false, error: "Supabase save failed" }, { status: 500 });
    }

    console.log("[vendor-check] Done — fresh login completed");
    return NextResponse.json({ fresh: true, method: "login", age_minutes: ageMinutes });
  } catch (err) {
    console.log("[vendor-check] ERROR:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { fresh: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
