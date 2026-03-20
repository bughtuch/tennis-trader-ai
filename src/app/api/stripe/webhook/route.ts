import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("[Stripe Webhook] Missing required env vars");
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
    console.error("[Stripe Webhook] SUPABASE_SERVICE_ROLE_KEY not set");
  }
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
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
    console.error("[Stripe Webhook] Signature verification failed");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

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
          console.error("[Stripe Webhook] checkout.session.completed: profile update failed");
        }
      } else {
        console.error("[Stripe Webhook] checkout.session.completed: no userId in metadata");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "cancelled" })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("[Stripe Webhook] subscription.deleted: update failed");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "inactive" })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("[Stripe Webhook] payment_failed: update failed");
      break;
    }
  }

  return NextResponse.json({ received: true });
}
