import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("[Stripe Webhook] Missing env vars:", {
      hasStripeKey: !!stripeKey,
      hasWebhookSecret: !!webhookSecret,
    });
    return NextResponse.json(
      { error: "Stripe environment variables not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2026-02-25.clover",
  });

  // Use service role key to bypass RLS — webhook runs server-side, not as a user
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceKey) {
    console.error("[Stripe Webhook] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to anon key");
  }
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("[Stripe Webhook] Event received:", event.type, event.id);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      console.log("[Stripe Webhook] checkout.session.completed:", {
        sessionId: session.id,
        userId,
        customer: session.customer,
        tier: session.metadata?.tier,
        paymentStatus: session.payment_status,
      });

      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            subscription_tier: session.metadata?.tier ?? "founding_member",
            stripe_customer_id: session.customer as string,
          })
          .eq("id", userId);

        if (error) {
          console.error("[Stripe Webhook] Failed to update profile:", error);
        } else {
          console.log("[Stripe Webhook] Profile updated successfully for user:", userId);
        }
      } else {
        console.error("[Stripe Webhook] No userId in session metadata");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      console.log("[Stripe Webhook] subscription.deleted:", { customerId });
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "cancelled" })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("[Stripe Webhook] Failed to update:", error);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      console.log("[Stripe Webhook] payment_failed:", { customerId });
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "inactive" })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("[Stripe Webhook] Failed to update:", error);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
