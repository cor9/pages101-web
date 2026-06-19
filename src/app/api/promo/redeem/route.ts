import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const redeemPromoSchema = z.object({
  code: z.string().trim().min(1, "Please enter a code.").max(80)
});

type RedeemPromoResult = {
  plan: "free" | "plus";
  status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
};

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

  const parsed = redeemPromoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const { error } = await serviceClient.rpc("p101_redeem_promo_code", {
    input_code: parsed.data.code,
    redeeming_user_id: user.id
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: subscriptionRow, error: subscriptionError } = await serviceClient
    .from("p101_subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("user_id", user.id)
    .single<RedeemPromoResult>();

  if (subscriptionError || !subscriptionRow) {
    return NextResponse.json({ error: "Code applied, but the subscription state could not be refreshed." }, { status: 500 });
  }

  return NextResponse.json({
    subscription: {
      plan: subscriptionRow.plan,
      status: subscriptionRow.status,
      current_period_end: subscriptionRow.current_period_end,
      stripe_customer_id: subscriptionRow.stripe_customer_id
    },
    message: subscriptionRow.plan === "plus"
      ? "Code applied. Your account now has Plus access."
      : "Code applied."
  });
}
