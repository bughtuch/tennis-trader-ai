import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  /* ─── 1. Validate admin secret ─── */
  const adminSecret = process.env.ADMIN_GRANT_SECRET;
  if (!adminSecret) {
    console.error("[Admin Grant] ADMIN_GRANT_SECRET env var not configured");
    return NextResponse.json(
      { granted: false, reason: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const headerSecret = req.headers.get("x-admin-secret");
  if (!headerSecret || headerSecret !== adminSecret) {
    return NextResponse.json(
      { granted: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }

  /* ─── 2. Parse and validate body ─── */
  let body: { email?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { granted: false, reason: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase();
  const tier = body.tier?.trim() || "founding_member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { granted: false, reason: "Invalid or missing email" },
      { status: 400 },
    );
  }

  /* ─── 3. Supabase service role client (bypasses RLS) ─── */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    console.error("[Admin Grant] SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.json(
      { granted: false, reason: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  /* ─── 4. Find profile by email (case-insensitive) ─── */
  const { data: profiles, error: selectError } = await supabase
    .from("profiles")
    .select("id, email, subscription_status, subscription_tier")
    .ilike("email", email)
    .limit(1);

  if (selectError) {
    console.error("[Admin Grant] Profile lookup error:", selectError.message);
    return NextResponse.json(
      { granted: false, reason: "Database error during lookup" },
      { status: 500 },
    );
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json(
      {
        granted: false,
        reason: `No profile found for ${email}. User must sign up at the app first.`,
      },
      { status: 404 },
    );
  }

  const profile = profiles[0];

  /* ─── 5. Update subscription status ─── */
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      subscription_status: "active",
      subscription_tier: tier,
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("[Admin Grant] Update error:", updateError.message);
    return NextResponse.json(
      { granted: false, reason: "Database error during update" },
      { status: 500 },
    );
  }

  console.log(
    `[Admin Grant] Granted ${tier} access to ${email} (profile ${profile.id})`,
  );

  return NextResponse.json({
    granted: true,
    email: profile.email,
    tier,
    previousStatus: profile.subscription_status,
  });
}
