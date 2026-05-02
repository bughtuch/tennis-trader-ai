import { NextResponse } from "next/server";
import { setVendorSession, isLoginCoolingDown, recordLoginAttempt } from "@/lib/betfair-vendor";

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STALE_MINUTES = 60;

export async function GET() {
  const now = new Date();
  console.log("[auth] vendor-check hit:", now.toISOString());

  try {
    // 1. Read token + updated_at from Supabase
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
      console.log("[auth] Supabase read failed HTTP", res.status);
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
    console.log("[auth] vendor token age:", ageMinutes, "min");

    // 3. If fresh enough, skip — reuse existing token
    if (token && ageMinutes < STALE_MINUTES) {
      console.log("[auth] using cached session (fresh)");
      return NextResponse.json({ fresh: false, age_minutes: ageMinutes });
    }

    // 4. Token stale or missing — try keepAlive first (not a login, so no cooldown)
    if (token && token.length > 0) {
      console.log("[auth] attempting keepAlive...");
      const appKey = process.env.BETFAIR_APP_KEY;
      if (!appKey) {
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
        if (data.status === "SUCCESS") {
          console.log("[auth] keepAlive succeeded, updating timestamp");
          await setVendorSession(token);
          return NextResponse.json({ fresh: true, method: "keepalive", age_minutes: ageMinutes });
        }
      }
      console.log("[auth] keepAlive failed, need fresh login");
    }

    // 5. Check login cooldown before attempting fresh login
    if (isLoginCoolingDown()) {
      console.log("[auth] login blocked by cooldown — waiting before retry");
      return NextResponse.json({ fresh: false, cooldown: true, error: "Login cooldown active" }, { status: 429 });
    }

    // 6. keepAlive failed or no token — do fresh login
    console.log("[auth] performing login...");
    const appKey = process.env.BETFAIR_APP_KEY;
    const vendorUsername = process.env.BETFAIR_VENDOR_USERNAME;
    const vendorPassword = process.env.BETFAIR_VENDOR_PASSWORD;
    if (!appKey || !vendorUsername || !vendorPassword) {
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
      console.log("[auth] login failed HTTP", loginRes.status);
      recordLoginAttempt(false);
      return NextResponse.json({ fresh: false, error: `Login HTTP ${loginRes.status}` }, { status: 502 });
    }

    const loginData = await loginRes.json();
    if (loginData.status !== "SUCCESS" || !loginData.token) {
      console.log("[auth] login failed:", loginData.error ?? "no token");
      recordLoginAttempt(false);
      return NextResponse.json({ fresh: false, error: loginData.error ?? "Login failed" }, { status: 502 });
    }

    // 7. Success — save and record
    recordLoginAttempt(true);
    await setVendorSession(loginData.token);
    console.log("[auth] fresh login completed");
    return NextResponse.json({ fresh: true, method: "login", age_minutes: ageMinutes });
  } catch (err) {
    console.log("[auth] vendor-check error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { fresh: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
