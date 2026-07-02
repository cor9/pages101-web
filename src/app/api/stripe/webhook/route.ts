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

        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId) break;

        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = session.customer as string;

        // Optionally update the subscription metadata in Stripe so future events have the user_id
        if (!subscription.metadata?.user_id) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: { user_id: userId },
          });
        }

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
        let userId: string | undefined = subscription.metadata?.user_id;
        const customerId = subscription.customer as string;

        if (!userId) {
          // Fallback: lookup user by customer ID
          userId = await getUserIdForCustomer(supabase, customerId);
        }
        if (!userId) break;

        const isActive = subscription.status === "active" || subscription.status === "trialing";
        await upsertSubscription(supabase, {
          userId,
          customerId,
          subscriptionId: subscription.id,
          plan: isActive ? "plus" : "free",
          status: subscription.status,
          currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString()
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        let userId: string | undefined = subscription.metadata?.user_id;
        const customerId = subscription.customer as string;

        if (!userId) {
          userId = await getUserIdForCustomer(supabase, customerId);
        }
        if (!userId) break;

        await upsertSubscription(supabase, {
          userId,
          customerId,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserIdForCustomer(supabase: any, customerId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from("p101_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.user_id;
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
    .from("p101_subscriptions")
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
