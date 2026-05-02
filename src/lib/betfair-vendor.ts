/**
 * Vendor session management via Supabase app_config table.
 * Uses raw fetch against Supabase REST API so it works in edge runtime.
 *
 * Includes in-memory cache to avoid repeated Supabase reads,
 * and a login cooldown to prevent rapid login retries that
 * trigger Betfair's rate limiting / account lockout.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* ─── In-memory cache (per serverless instance) ─── */

let cachedToken = "";
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — reuse without hitting Supabase

/* ─── Login cooldown ─── */

let lastLoginAttempt = 0;
let lastLoginFailed = false;
const LOGIN_COOLDOWN_MS = 60 * 1000; // 60 seconds after a failed login

/** Check if login is blocked by cooldown */
export function isLoginCoolingDown(): boolean {
  if (!lastLoginFailed) return false;
  return Date.now() - lastLoginAttempt < LOGIN_COOLDOWN_MS;
}

/** Record a login attempt result */
export function recordLoginAttempt(success: boolean): void {
  lastLoginAttempt = Date.now();
  lastLoginFailed = !success;
}

/** Read vendor_session from cache or Supabase. Returns empty string if missing. */
export async function getVendorSession(): Promise<string> {
  // Check in-memory cache first
  if (cachedToken && Date.now() - cachedAt < CACHE_TTL_MS) {
    console.log("[auth] using cached vendor session");
    return cachedToken;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.vendor_session&select=value`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return cachedToken || "";
    const rows = await res.json();
    const token = rows?.[0]?.value ?? "";

    // Update cache
    if (token) {
      cachedToken = token;
      cachedAt = Date.now();
    }

    return token;
  } catch {
    return cachedToken || "";
  }
}

/** Write vendor_session to Supabase app_config via UPSERT + update cache */
export async function setVendorSession(token: string): Promise<boolean> {
  // Always update in-memory cache immediately
  cachedToken = token;
  cachedAt = Date.now();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          key: "vendor_session",
          value: token,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
