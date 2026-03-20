import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    // Use authenticated user's email — never trust client-supplied email
    const { createServerClient } = await import("@/lib/supabase-server");
    const authSupabase = await createServerClient();
    const { data: { user: authUser } } = await authSupabase.auth.getUser();
    if (!authUser?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const email = authUser.email;

    console.log("[Stripe Sync] Looking up customer for email:", email);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2026-02-25.clover",
    });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      console.log("[Stripe Sync] No Stripe customer found for:", email);
      return NextResponse.json({ synced: false, reason: "No Stripe customer found for this email" });
    }

    const customer = customers.data[0];
    console.log("[Stripe Sync] Found customer:", customer.id);

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    // Also check trialing
    const trialingSubs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "trialing",
      limit: 1,
    });

    const activeSub = subscriptions.data[0] || trialingSubs.data[0];

    if (!activeSub) {
      console.log("[Stripe Sync] No active subscription for customer:", customer.id);
      return NextResponse.json({ synced: false, reason: "No active subscription found" });
    }

    console.log("[Stripe Sync] Active subscription found:", activeSub.id, "status:", activeSub.status);

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      console.error("[Stripe Sync] SUPABASE_SERVICE_ROLE_KEY not set");
    }
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Find user by email in auth.users via profiles
    const { data: profiles, error: findError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .limit(1);

    // If no profile found by email, try matching via the customer metadata
    let userId: string | null = profiles?.[0]?.id ?? null;

    if (!userId) {
      // Try via subscription metadata
      userId = activeSub.metadata?.userId ?? null;
    }

    if (!userId) {
      console.error("[Stripe Sync] Could not find user for email:", email);
      return NextResponse.json({ synced: false, reason: "Could not find user profile" });
    }

    const tier = activeSub.metadata?.tier ?? "founding_member";

    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_tier: tier,
        stripe_customer_id: customer.id,
      })
      .eq("id", userId);

    if (error) {
      console.error("[Stripe Sync] Failed to update profile:", error);
      return NextResponse.json({ synced: false, reason: error.message });
    }

    console.log("[Stripe Sync] Profile updated successfully for user:", userId);
    return NextResponse.json({ synced: true, subscriptionStatus: "active", tier });
  } catch (error) {
    console.error("[Stripe Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
