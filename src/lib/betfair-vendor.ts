/**
 * Vendor session management via Supabase app_config table.
 * Uses raw fetch against Supabase REST API so it works in edge runtime.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Hardcoded fallback until app_config table is created in Supabase
const FALLBACK_VENDOR_SESSION = "6gI2QVT80KvjC84XfTu4DlrbZyCaIBXKAOc3Cs8yIYs=";

/** Read vendor_session from Supabase app_config, with hardcoded fallback */
export async function getVendorSession(): Promise<string> {
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
    if (!res.ok) return FALLBACK_VENDOR_SESSION;
    const rows = await res.json();
    return rows?.[0]?.value ?? FALLBACK_VENDOR_SESSION;
  } catch {
    return FALLBACK_VENDOR_SESSION;
  }
}

/** Write vendor_session to Supabase app_config */
export async function setVendorSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.vendor_session`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
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
