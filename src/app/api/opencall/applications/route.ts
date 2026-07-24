import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAuthenticatedRequestUser(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return { error: NextResponse.json({ error: "Auth unavailable" }, { status: 503 }) };
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { serviceClient, user };
}

// GET /api/opencall/applications — fetch user's applications for current event
export async function GET(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Find the most recent open/reviewing/closed event, optionally filtered by year
  const eventQuery = serviceClient
    .from("p101_opencall_events")
    .select("id, year, name, submits_open, submits_close, status")
    .in("status", ["open", "reviewing", "closed"])
    .order("year", { ascending: false })
    .limit(1);

  const { data: event, error: eventError } = yearParam
    ? await eventQuery.eq("year", parseInt(yearParam)).maybeSingle<{ id: string; year: number; name: string; submits_open: string; submits_close: string; status: string }>()
    : await eventQuery.maybeSingle<{ id: string; year: number; name: string; submits_open: string; submits_close: string; status: string }>();

  if (eventError) {
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ applications: [], event: null });
  }

  const { data: applications, error: appsError } = await serviceClient
    .from("p101_opencall_applications")
    .select("id, event_id, status, actor_name, submitted_at, withdrawn_at, updated_at, created_at")
    .eq("user_id", user.id)
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (appsError) {
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }

  return NextResponse.json({ applications: applications ?? [], event });
}

// POST /api/opencall/applications — create a new draft
export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;

  const body = await request.json().catch(() => ({})) as {
    year?: number;
    source_page_id?: string;
  };

  // Find the open event
  const eventQuery = serviceClient
    .from("p101_opencall_events")
    .select("id, year, submits_open, submits_close")
    .eq("status", "open")
    .order("year", { ascending: false })
    .limit(1);

  const { data: event, error: eventError } = body.year
    ? await eventQuery.eq("year", body.year).maybeSingle<{ id: string; year: number; submits_open: string; submits_close: string }>()
    : await eventQuery.maybeSingle<{ id: string; year: number; submits_open: string; submits_close: string }>();

  if (eventError) {
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "No open event found." }, { status: 404 });
  }

  const now = new Date();
  if (new Date(event.submits_open) > now || new Date(event.submits_close) <= now) {
    return NextResponse.json({ error: "Submissions are not currently open." }, { status: 409 });
  }

  // If source_page_id provided, verify ownership and pre-fill actor_name
  let prefillActorName: string | null = null;
  if (body.source_page_id) {
    const { data: page } = await serviceClient
      .from("p101_actor_pages")
      .select("id, display_name")
      .eq("id", body.source_page_id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; display_name: string }>();

    if (!page) {
      return NextResponse.json({ error: "Performer page not found." }, { status: 404 });
    }
    prefillActorName = page.display_name ?? null;
  }

  const insertPayload: Record<string, unknown> = {
    event_id: event.id,
    user_id: user.id,
    status: "draft",
  };
  if (body.source_page_id) insertPayload.source_page_id = body.source_page_id;
  if (prefillActorName) insertPayload.actor_name = prefillActorName;

  const { data: application, error: insertError } = await serviceClient
    .from("p101_opencall_applications")
    .insert(insertPayload)
    .select("id, event_id, status")
    .single<{ id: string; event_id: string; status: string }>();

  if (insertError) {
    return NextResponse.json({ error: "Failed to create application." }, { status: 400 });
  }

  return NextResponse.json({ application, event: { year: event.year } }, { status: 201 });
}
