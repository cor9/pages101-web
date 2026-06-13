import Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the Plus yearly subscription.
 * The user's access token must be sent in the Authorization header.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       — Stripe secret key
 *   STRIPE_PLUS_PRICE_ID    — price_1ThmmxDALb4OhZMWZ31ZyU09
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_dummy", {
  apiVersion: "2025-08-27.basil"
});

export async function POST(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError
  } = await serviceClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PLUS_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe price not configured" }, { status: 500 });
  }

  // Reuse an existing Stripe customer if one exists
  const { data: sub } = await serviceClient
    .schema("pages101")
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  const customerId = sub?.stripe_customer_id ?? undefined;
  const origin = request.headers.get("origin") ?? "https://pages.childactor101.com";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app?upgraded=1`,
    cancel_url: `${origin}/app`,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } }
  });

  return NextResponse.json({ url: session.url });
}
