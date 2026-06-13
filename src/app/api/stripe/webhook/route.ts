import Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_dummy", {
  apiVersion: "2025-08-27.basil"
});

// Required for raw body access in Next.js App Router
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error("Supabase service client unavailable in webhook");
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.user_id;
        if (!userId) break;

        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = session.customer as string;

        await upsertSubscription(supabase, {
          userId,
          customerId,
          subscriptionId,
          plan: "plus",
          status: subscription.status,
          currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString()
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        if (!userId) break;

        const isActive = subscription.status === "active" || subscription.status === "trialing";
        await upsertSubscription(supabase, {
          userId,
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          plan: isActive ? "plus" : "free",
          status: subscription.status,
          currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString()
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        if (!userId) break;

        await upsertSubscription(supabase, {
          userId,
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          plan: "free",
          status: "canceled",
          currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString()
        });
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  {
    userId,
    customerId,
    subscriptionId,
    plan,
    status,
    currentPeriodEnd
  }: {
    userId: string;
    customerId: string;
    subscriptionId: string;
    plan: "free" | "plus";
    status: string;
    currentPeriodEnd: string;
  }
) {
  const { error } = await supabase
    .schema("pages101")
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw error;
  }
}
