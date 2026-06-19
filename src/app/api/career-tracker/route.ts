import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { auditionPayloadSchema } from "@/lib/career-tracker";
import type {
  AuditionRecord,
  CareerTrackerPerformer,
  CareerTrackerResponse,
  CareerTrackerSubscription
} from "@/lib/career-tracker";

type SupabaseAuthUser = {
  id: string;
};

async function getAuthenticatedRequestUser(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return {
      error: NextResponse.json({ error: "Auth unavailable" }, { status: 503 })
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    };
  }

  const {
    data: { user },
    error: userError
  } = await serviceClient.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    };
  }

  return {
    serviceClient,
    user: user as SupabaseAuthUser
  };
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { serviceClient, user } = auth;

  const [performersResult, auditionsResult, subscriptionResult] = await Promise.all([
    serviceClient
      .from("p101_actor_pages")
      .select("id, display_name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    serviceClient
      .from("p101_auditions")
      .select("*")
      .eq("user_id", user.id)
      .order("audition_date", { ascending: false })
      .order("created_at", { ascending: false }),
    serviceClient
      .from("p101_subscriptions")
      .select("plan, status, current_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  if (performersResult.error) {
    return NextResponse.json({ error: performersResult.error.message }, { status: 400 });
  }

  if (auditionsResult.error) {
    return NextResponse.json({ error: auditionsResult.error.message }, { status: 400 });
  }

  if (subscriptionResult.error) {
    return NextResponse.json({ error: subscriptionResult.error.message }, { status: 400 });
  }

  const performers = (performersResult.data ?? []) as CareerTrackerPerformer[];
  const subscription = (subscriptionResult.data ?? null) as CareerTrackerSubscription;
  const performerMap = new Map(performers.map((performer) => [performer.id, performer.display_name]));

  const auditions = ((auditionsResult.data ?? []) as Omit<AuditionRecord, "performer_name">[]).map((audition) => ({
    ...audition,
    performer_name: performerMap.get(audition.page_id) ?? "Unknown Performer"
  }));

  const response: CareerTrackerResponse = {
    auditions,
    performers,
    subscription
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { serviceClient, user } = auth;
  const parsed = auditionPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const payload = parsed.data;

  const [performerResult, subscriptionResult, auditionCountResult] = await Promise.all([
    serviceClient
      .from("p101_actor_pages")
      .select("id, display_name")
      .eq("id", payload.page_id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; display_name: string }>(),
    serviceClient
      .from("p101_subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle<{ plan: "free" | "plus"; status: string | null }>(),
    serviceClient
      .from("p101_auditions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
  ]);

  if (performerResult.error) {
    return NextResponse.json({ error: performerResult.error.message }, { status: 400 });
  }

  if (!performerResult.data) {
    return NextResponse.json({ error: "Selected performer could not be found." }, { status: 404 });
  }

  if (subscriptionResult.error) {
    return NextResponse.json({ error: subscriptionResult.error.message }, { status: 400 });
  }

  if (auditionCountResult.error) {
    return NextResponse.json({ error: auditionCountResult.error.message }, { status: 400 });
  }

  const isPlus = subscriptionResult.data?.plan === "plus"
    && (subscriptionResult.data.status === "active" || subscriptionResult.data.status === "trialing");

  if (!isPlus && (auditionCountResult.count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "You’ve logged 5 of 5 auditions. Upgrade to Plus for unlimited audition tracking." },
      { status: 403 }
    );
  }

  const insertPayload = {
    user_id: user.id,
    ...payload
  };

  const { data, error } = await serviceClient
    .from("p101_auditions")
    .insert(insertPayload)
    .select("*")
    .single<Omit<AuditionRecord, "performer_name">>();

  if (error) {
    const status = error.message.includes("5 auditions") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({
    ...data,
    performer_name: performerResult.data.display_name
  } satisfies AuditionRecord);
}
