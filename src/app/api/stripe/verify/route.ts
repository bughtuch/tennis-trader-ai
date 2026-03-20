import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    // Auth check — only allow verified users to confirm their own payment
    const { createServerClient } = await import("@/lib/supabase-server");
    const authSupabase = await createServerClient();
    const { data: { user: authUser } } = await authSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2026-02-25.clover",
    });

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ verified: false, reason: "Payment not completed" });
    }

    const userId = session.metadata?.userId;
    if (!userId) {
      return NextResponse.json({ verified: false, reason: "No userId in metadata" });
    }

    // Verify the authenticated user matches the session metadata
    if (userId !== authUser.id) {
      return NextResponse.json({ verified: false, reason: "Session does not belong to this user" });
    }

    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_tier: session.metadata?.tier ?? "founding_member",
        stripe_customer_id: session.customer as string,
      })
      .eq("id", userId);

    if (error) {
      console.error("[Stripe Verify] Failed to update profile:", error);
      return NextResponse.json({ verified: false, reason: error.message });
    }

    console.log("[Stripe Verify] Profile updated successfully for user:", userId);
    return NextResponse.json({ verified: true, subscriptionStatus: "active" });
  } catch (error) {
    console.error("[Stripe Verify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}
