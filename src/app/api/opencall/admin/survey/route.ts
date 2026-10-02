import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/opencall-admin";
import { sendPages101Email } from "@/lib/email";
import { surveyUrl, surveyTokenConfigured } from "@/lib/opencall-survey-token";
import { buildSurveyEmailHtml, surveyEmailSubject } from "@/lib/opencall-survey-email";

export const dynamic = "force-dynamic";

// GET /api/opencall/admin/survey?event_id=UUID
// Participation and aggregate counts only. Never returns an individual answer,
// and nothing here can tie an anonymous response to an invitation.
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "event_id is required." }, { status: 400 });

  const [invites, responses, submitted] = await Promise.all([
    serviceClient.from("p101_opencall_survey_invites").select("sent_at, reminder_sent_at, completed_at").eq("event_id", eventId),
    serviceClient
      .from("p101_opencall_survey_responses")
      .select("is_anonymous, reps_contacted, rep_contact_count, meetings_count, offers_count, outcomes, prepared_submission, prepared_next_step, prior_representation")
      .eq("event_id", eventId),
    serviceClient.from("p101_opencall_applications").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "submitted"),
  ]);
  if (invites.error || responses.error || submitted.error) {
    return NextResponse.json({ error: "Failed to load survey stats." }, { status: 500 });
  }

  const inv = invites.data ?? [];
  const res = responses.data ?? [];
  const avg = (xs: (number | null)[]) => {
    const n = xs.filter((x): x is number => typeof x === "number");
    return n.length ? Math.round((10 * n.reduce((a, b) => a + b, 0)) / n.length) / 10 : null;
  };

  // Funnel timing comes from invitations only (exact timestamps). It never
  // touches response rows, so it can't point at an individual anonymous answer.
  const hours = inv
    .filter((i) => i.sent_at && i.completed_at)
    .map((i) => (new Date(i.completed_at as string).getTime() - new Date(i.sent_at as string).getTime()) / 36e5)
    .sort((a, b) => a - b);
  const medianHours = hours.length ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10 : null;
  const afterReminder = inv.filter(
    (i) => i.reminder_sent_at && i.completed_at && new Date(i.completed_at as string) > new Date(i.reminder_sent_at as string)
  ).length;

  const contacted = res.filter((r) => r.reps_contacted === "yes");
  return NextResponse.json({
    configured: surveyTokenConfigured(),
    submitted_applications: submitted.count ?? 0,
    invites: inv.length,
    sent: inv.filter((i) => i.sent_at).length,
    reminded: inv.filter((i) => i.reminder_sent_at).length,
    completed: inv.filter((i) => i.completed_at).length,
    completed_after_reminder: afterReminder,
    median_hours_to_complete: medianHours,
    responses: res.length,
    named_responses: res.filter((r) => !r.is_anonymous).length,
    anonymous_responses: res.filter((r) => r.is_anonymous).length,
    outcomes: {
      contacted_yes: contacted.length,
      contacted_no: res.filter((r) => r.reps_contacted === "no").length,
      contacted_unsure: res.filter((r) => r.reps_contacted === "unsure").length,
      with_meeting: contacted.filter((r) => (r.meetings_count ?? 0) > 0).length,
      with_offer: contacted.filter((r) => (r.offers_count ?? 0) > 0 || (r.outcomes as string[]).includes("offer")).length,
      signed: contacted.filter((r) => (r.outcomes as string[]).includes("signed")).length,
      meetings_total_min: contacted.reduce((a, r) => a + (r.meetings_count ?? 0), 0),
      offers_total_min: contacted.reduce((a, r) => a + (r.offers_count ?? 0), 0),
      avg_submission_prepared: avg(res.map((r) => r.prepared_submission as number)),
      avg_next_step_prepared: avg(contacted.map((r) => r.prepared_next_step as number | null)),
    },
  });
}

const actionSchema = z.object({
  event_id: z.string().uuid(),
  action: z.enum(["create", "send", "remind"]),
  // Nothing is emailed unless this is explicitly true.
  confirm: z.boolean().optional(),
});

type AppRow = { id: string; actor_name: string; guardian_email: string };

// POST /api/opencall/admin/survey
//   create → one invite per submitted application that doesn't have one
//   send   → email the first invitation to invites that haven't been sent
//   remind → email a reminder to sent-but-incomplete invites (once each)
export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  if (!surveyTokenConfigured()) {
    return NextResponse.json({ error: "SURVEY_LINK_SECRET is not set (min 32 characters)." }, { status: 503 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  const { event_id, action, confirm } = parsed.data;

  const { data: event } = await serviceClient
    .from("p101_opencall_events").select("id, status").eq("id", event_id).maybeSingle<{ id: string; status: string }>();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  // ─── create ────────────────────────────────────────────────────────────────
  if (action === "create") {
    const [{ data: apps }, { data: have }] = await Promise.all([
      serviceClient.from("p101_opencall_applications").select("id").eq("event_id", event_id).eq("status", "submitted"),
      serviceClient.from("p101_opencall_survey_invites").select("application_id").eq("event_id", event_id),
    ]);
    const haveSet = new Set((have ?? []).map((h) => h.application_id as string));
    const missing = (apps ?? []).filter((a) => !haveSet.has(a.id as string));
    if (!confirm) return NextResponse.json({ dry_run: true, would_create: missing.length });
    if (missing.length) {
      const { error } = await serviceClient
        .from("p101_opencall_survey_invites")
        .upsert(missing.map((a) => ({ event_id, application_id: a.id })), { onConflict: "application_id", ignoreDuplicates: true });
      if (error) {
        console.error("Survey invite create failed:", error.message);
        return NextResponse.json({ error: "Failed to create invites." }, { status: 500 });
      }
    }
    return NextResponse.json({ created: missing.length });
  }

  // ─── send / remind ─────────────────────────────────────────────────────────
  const kind = action === "send" ? "invite" : "reminder";
  let q = serviceClient
    .from("p101_opencall_survey_invites")
    .select("id, application_id")
    .eq("event_id", event_id)
    .is("completed_at", null);
  q = action === "send" ? q.is("sent_at", null) : q.not("sent_at", "is", null).is("reminder_sent_at", null);
  const { data: targets, error: targetError } = await q;
  if (targetError) return NextResponse.json({ error: "Failed to load invites." }, { status: 500 });

  const list = targets ?? [];
  if (!confirm) return NextResponse.json({ dry_run: true, would_email: list.length });
  if (!["reviewing", "closed"].includes(event.status)) {
    return NextResponse.json({ error: "The event must be in review or closed before surveys go out." }, { status: 409 });
  }

  const { data: apps } = await serviceClient
    .from("p101_opencall_applications")
    .select("id, actor_name, guardian_email")
    .in("id", list.map((t) => t.application_id as string));
  const appById = new Map((apps ?? []).map((a) => [a.id as string, a as AppRow]));

  let sent = 0;
  const failures: { invite_id: string; error: string }[] = [];
  for (const t of list) {
    const app = appById.get(t.application_id as string);
    if (!app?.guardian_email) {
      failures.push({ invite_id: t.id as string, error: "No guardian email." });
      continue;
    }
    try {
      await sendPages101Email({
        to: app.guardian_email,
        subject: surveyEmailSubject(kind, app.actor_name),
        html: buildSurveyEmailHtml(kind, { actorName: app.actor_name, url: surveyUrl(t.id as string) }),
        replyTo: "info@childactor101.com",
        fromName: "Corey at Child Actor 101",
      });
      await serviceClient
        .from("p101_opencall_survey_invites")
        .update(kind === "invite" ? { sent_at: new Date().toISOString() } : { reminder_sent_at: new Date().toISOString() })
        .eq("id", t.id);
      sent++;
    } catch (err) {
      console.error("Survey email failed:", (err as Error).message);
      failures.push({ invite_id: t.id as string, error: "Email send failed." });
    }
  }
  return NextResponse.json({ sent, failed: failures.length, failures });
}
