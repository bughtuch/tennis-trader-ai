import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST() {
  try {
    // Authenticate user via session
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 1. Get profile to find Stripe customer info
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    // 2. Cancel any active Stripe subscription
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && profile?.stripe_customer_id) {
      try {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2026-02-25.clover",
        });
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "active",
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      } catch {
        // Continue with account deletion even if Stripe cancellation fails
      }
    }

    // 3. Delete user profile from profiles table
    await supabase.from("profiles").delete().eq("id", user.id);

    // 4. Delete Supabase auth user via admin API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseServiceKey) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      await adminClient.auth.admin.deleteUser(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete account",
      },
      { status: 500 }
    );
  }
}
