import { NextResponse } from "next/server";
import { auditionPayloadSchema } from "@/lib/career-tracker";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AuditionRecord } from "@/lib/career-tracker";

type RouteContext = {
  params: Promise<{ auditionId: string }>;
};

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { serviceClient, user } = auth;
  const { auditionId } = await context.params;
  const parsed = auditionPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const payload = parsed.data;

  const [existingResult, performerResult] = await Promise.all([
    serviceClient
      .from("p101_auditions")
      .select("id")
      .eq("id", auditionId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>(),
    serviceClient
      .from("p101_actor_pages")
      .select("id, display_name")
      .eq("id", payload.page_id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; display_name: string }>()
  ]);

  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 400 });
  }

  if (!existingResult.data) {
    return NextResponse.json({ error: "Audition not found." }, { status: 404 });
  }

  if (performerResult.error) {
    return NextResponse.json({ error: performerResult.error.message }, { status: 400 });
  }

  if (!performerResult.data) {
    return NextResponse.json({ error: "Selected performer could not be found." }, { status: 404 });
  }

  const { data, error } = await serviceClient
    .from("p101_auditions")
    .update(payload)
    .eq("id", auditionId)
    .eq("user_id", user.id)
    .select("*")
    .single<Omit<AuditionRecord, "performer_name">>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ...data,
    performer_name: performerResult.data.display_name
  } satisfies AuditionRecord);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { serviceClient, user } = auth;
  const { auditionId } = await context.params;

  const { data, error } = await serviceClient
    .from("p101_auditions")
    .delete()
    .eq("id", auditionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Audition not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
