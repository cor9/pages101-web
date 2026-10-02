import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { surveySchema } from "@/lib/opencall-survey";

export const dynamic = "force-dynamic";

// GET /api/opencall/survey — the event the survey is for (no auth; same event as the landing page)
export async function GET() {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  const { data, error } = await serviceClient
    .from("p101_opencall_events")
    .select("id, name, year, status")
    .in("status", ["reviewing", "closed"])
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to load event." }, { status: 500 });
  return NextResponse.json({ event: data });
}

// POST /api/opencall/survey — public submission.
// Anonymous by construction: nothing here reads the session, IP, or user agent,
// and the table has no column that could hold them.
export async function POST(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > 32_000) {
    return NextResponse.json({ error: "Response too large." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  }
  const v = parsed.data;

  // Honeypot filled → pretend success, store nothing.
  if (v.website) return NextResponse.json({ ok: true });

  const { data: event, error: eventError } = await serviceClient
    .from("p101_opencall_events")
    .select("id")
    .in("status", ["reviewing", "closed"])
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (eventError || !event) {
    return NextResponse.json({ error: "The survey isn't open right now." }, { status: 409 });
  }

  // Normalize to match the skip logic the parent saw.
  const noContact = v.reps_contacted === "no";
  const signed = !noContact && v.outcomes.includes("signed");

  const row = {
    event_id: event.id,
    is_anonymous: v.is_anonymous,
    actor_name: v.is_anonymous ? null : v.actor_name || null,
    prior_representation: v.prior_representation,
    reps_contacted: v.reps_contacted,
    rep_contact_count: noContact ? null : v.rep_contact_count ?? null,
    outcomes: noContact ? [] : v.outcomes,
    meetings_count: noContact ? null : v.meetings_count ?? null,
    offers_count: noContact ? null : v.offers_count ?? null,
    signed_with: signed ? v.signed_with || null : null,
    prepared_submission: v.prepared_submission,
    prepared_next_step: noContact ? null : v.prepared_next_step ?? null,
    next_step_not_applicable: noContact || v.prepared_next_step == null,
    support_gaps: v.support_gaps,
    top_improvement: v.top_improvement,
    additional_comments: v.additional_comments || null,
    share_consent: v.share_consent,
  };

  const { error } = await serviceClient.from("p101_opencall_survey_responses").insert(row);
  if (error) {
    console.error("Survey insert failed:", error.message);
    return NextResponse.json({ error: "We couldn't save your response. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
