import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { surveySchema, type SurveyInput, type SurveyLinkInfo } from "@/lib/opencall-survey";
import { verifySurveyToken, surveyTokenConfigured } from "@/lib/opencall-survey-token";

export const dynamic = "force-dynamic";

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type InviteRow = {
  id: string;
  event_id: string;
  application_id: string;
  completed_at: string | null;
};

type EventRow = { id: string; name: string; status: string };

// Resolve a personal link to its invite + event, or an HTTP error.
async function resolveLink(service: Service, token: string) {
  if (!surveyTokenConfigured()) {
    return { error: NextResponse.json({ error: "Survey isn't configured yet." }, { status: 503 }) };
  }
  const inviteId = verifySurveyToken(token);
  if (!inviteId) {
    return { error: NextResponse.json({ error: "This survey link isn't valid. Please use the exact link from your email." }, { status: 404 }) };
  }
  const { data: invite } = await service
    .from("p101_opencall_survey_invites")
    .select("id, event_id, application_id, completed_at")
    .eq("id", inviteId)
    .maybeSingle<InviteRow>();
  if (!invite) {
    return { error: NextResponse.json({ error: "This survey link isn't valid. Please use the exact link from your email." }, { status: 404 }) };
  }
  const { data: event } = await service
    .from("p101_opencall_events")
    .select("id, name, status")
    .eq("id", invite.event_id)
    .maybeSingle<EventRow>();
  if (!event || !["reviewing", "closed"].includes(event.status)) {
    return { error: NextResponse.json({ error: "This survey isn't open right now." }, { status: 409 }) };
  }
  return { invite, event };
}

// GET /api/opencall/survey?t=<token> — what the page needs to render
export async function GET(request: Request) {
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const token = new URL(request.url).searchParams.get("t") ?? "";
  const link = await resolveLink(service, token);
  if ("error" in link) return link.error;
  const { invite, event } = link;

  const { data: app } = await service
    .from("p101_opencall_applications")
    .select("actor_name")
    .eq("id", invite.application_id)
    .maybeSingle<{ actor_name: string }>();

  // Only named responses are linked to the invite, so only they can be returned.
  let existing: SurveyLinkInfo["existing"] = null;
  if (invite.completed_at) {
    const { data: r } = await service
      .from("p101_opencall_survey_responses")
      .select("prior_representation, reps_contacted, rep_contact_count, outcomes, meetings_count, offers_count, signed_with, prepared_submission, prepared_next_step, support_gaps, top_improvement, additional_comments, share_consent, followup_contact")
      .eq("invite_id", invite.id)
      .maybeSingle<Record<string, unknown>>();
    if (r) {
      existing = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)) as SurveyLinkInfo["existing"];
    }
  }

  const info: SurveyLinkInfo = {
    event: { id: event.id, name: event.name },
    actor_name: app?.actor_name ?? "",
    completed: !!invite.completed_at,
    existing,
  };
  return NextResponse.json(info);
}

// POST /api/opencall/survey — { t, ...answers }
//
// Named (or anonymous-but-left-contact): the response is linked to the
// application and invite, and can be updated later through the same link.
// Anonymous: the invite is marked completed, then a response row is written
// with no application, invite, name, email, token, IP or user agent. Nothing
// afterwards joins the two.
export async function POST(request: Request) {
  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const raw = await request.text();
  if (raw.length > 32_000) return NextResponse.json({ error: "Response too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { t, ...answers } = body;
  const parsed = surveySchema.safeParse(answers);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  }
  const v = parsed.data;

  // Honeypot filled → pretend success, store nothing.
  if (v.website) return NextResponse.json({ ok: true });

  const link = await resolveLink(service, typeof t === "string" ? t : "");
  if ("error" in link) return link.error;
  const { invite, event } = link;

  const stillAnonymous = v.is_anonymous && !v.followup_contact;
  const fields = normalize(v);

  // ─── Anonymous ─────────────────────────────────────────────────────────────
  if (stillAnonymous) {
    if (invite.completed_at) {
      return NextResponse.json({ error: "This survey has already been completed. Thank you!" }, { status: 409 });
    }
    // Claim the invitation first so a double-click can't produce two responses.
    const { data: claimed } = await service
      .from("p101_opencall_survey_invites")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("completed_at", null)
      .select("id");
    if (!claimed?.length) {
      return NextResponse.json({ error: "This survey has already been completed. Thank you!" }, { status: 409 });
    }

    const { error } = await service.from("p101_opencall_survey_responses").insert({
      ...fields,
      event_id: event.id,
      is_anonymous: true,
      submitted_on: weekStart(new Date()),
      share_consent: v.share_consent,
    });
    if (error) {
      console.error("Anonymous survey insert failed:", error.message);
      await service.from("p101_opencall_survey_invites").update({ completed_at: null }).eq("id", invite.id);
      return NextResponse.json({ error: "We couldn't save your response. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Named ─────────────────────────────────────────────────────────────────
  const { data: existing } = await service
    .from("p101_opencall_survey_responses")
    .select("id")
    .eq("invite_id", invite.id)
    .maybeSingle<{ id: string }>();

  if (invite.completed_at && !existing) {
    // Completed, but there's no linked response: it was submitted anonymously.
    return NextResponse.json({ error: "This survey was already completed anonymously, so it can't be edited. Thank you!" }, { status: 409 });
  }

  const row = {
    ...fields,
    event_id: event.id,
    application_id: invite.application_id,
    invite_id: invite.id,
    is_anonymous: false,
    followup_contact: v.followup_contact || null,
    share_consent: v.share_consent,
  };

  if (existing) {
    const { error } = await service
      .from("p101_opencall_survey_responses")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      console.error("Survey update failed:", error.message);
      return NextResponse.json({ error: "We couldn't save your changes. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: true });
  }

  const { data: claimed } = await service
    .from("p101_opencall_survey_invites")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("completed_at", null)
    .select("id");
  if (!claimed?.length) {
    return NextResponse.json({ error: "This survey has already been completed. Thank you!" }, { status: 409 });
  }
  const { error } = await service
    .from("p101_opencall_survey_responses")
    .insert({ ...row, submitted_on: new Date().toISOString().slice(0, 10) });
  if (error) {
    console.error("Named survey insert failed:", error.message);
    await service.from("p101_opencall_survey_invites").update({ completed_at: null }).eq("id", invite.id);
    return NextResponse.json({ error: "We couldn't save your response. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: false });
}

// Rep-response answers are only kept when a representative definitely made
// contact; "no" and "not sure" skip them (matches what the parent was shown).
function normalize(v: SurveyInput) {
  const contacted = v.reps_contacted === "yes";
  return {
    prior_representation: v.prior_representation,
    reps_contacted: v.reps_contacted,
    rep_contact_count: contacted ? v.rep_contact_count ?? null : null,
    outcomes: contacted ? v.outcomes : [],
    meetings_count: contacted ? v.meetings_count ?? null : null,
    offers_count: contacted ? v.offers_count ?? null : null,
    signed_with: contacted && v.outcomes.includes("signed") ? v.signed_with || null : null,
    prepared_submission: v.prepared_submission,
    prepared_next_step: contacted ? v.prepared_next_step ?? null : null,
    support_gaps: v.support_gaps,
    top_improvement: v.top_improvement || null,
    additional_comments: v.additional_comments || null,
  };
}

// Monday of the current week (UTC). Anonymous responses only carry the week so a
// timestamp can't be matched against an invitation's completed_at.
function weekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}
