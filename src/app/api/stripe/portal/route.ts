import Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: sub } = await serviceClient
    .from("p101_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  const origin = request.headers.get("origin") ?? "https://pages.childactor101.com";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/dashboard`
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Stripe billing portal session creation failed:", err);
    const message = err instanceof Error ? err.message : "Failed to open billing portal";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
