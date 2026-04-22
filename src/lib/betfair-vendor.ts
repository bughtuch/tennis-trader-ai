/**
 * Vendor session management via Supabase app_config table.
 * Uses raw fetch against Supabase REST API so it works in edge runtime.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Read vendor_session from Supabase app_config. Returns empty string if missing. */
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
    if (!res.ok) return "";
    const rows = await res.json();
    return rows?.[0]?.value ?? "";
  } catch {
    return "";
  }
}

/** Write vendor_session to Supabase app_config via UPSERT (creates row if missing) */
export async function setVendorSession(token: string): Promise<boolean> {
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
