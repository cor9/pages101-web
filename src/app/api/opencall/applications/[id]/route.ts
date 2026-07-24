import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { draftSaveSchema, submitConsentSchema, CONSENT_COPY } from "@/lib/opencall";
import type { OpenCallApplication } from "@/lib/opencall";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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

// GET — load application for the form
export async function GET(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;
  const { id } = await context.params;

  const { data: application, error } = await serviceClient
    .from("p101_opencall_applications")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<OpenCallApplication>();

  if (error) {
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
  }
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json({ application });
}

// PATCH — autosave draft fields
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;
  const { id } = await context.params;

  const { data: existing, error: fetchError } = await serviceClient
    .from("p101_opencall_applications")
    .select("id, status, event_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; status: string; event_id: string }>();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (existing.status === "withdrawn") {
    return NextResponse.json({ error: "This application has been withdrawn." }, { status: 409 });
  }

  const { data: event } = await serviceClient
    .from("p101_opencall_events")
    .select("submits_close")
    .eq("id", existing.event_id)
    .maybeSingle<{ submits_close: string }>();

  if (!event || new Date(event.submits_close) <= new Date()) {
    return NextResponse.json({ error: "The submission window has closed." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = draftSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  // Reject requests where all fields were stripped (unknown keys only — nothing to save)
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("p101_opencall_applications")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("updated_at")
    .single<{ updated_at: string }>();

  if (updateError) {
    return NextResponse.json({ error: "Failed to save application." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated_at: updated.updated_at });
}

// POST — action dispatch: "submit" | "withdraw"
export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedRequestUser(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;
  const { id } = await context.params;

  const body = await request.json().catch(() => ({})) as { action?: string; consents?: unknown };

  if (body.action === "submit") {
    // Validate consents
    const consentParsed = submitConsentSchema.safeParse(body.consents);
    if (!consentParsed.success) {
      return NextResponse.json(
        { error: consentParsed.error.issues[0]?.message ?? "Missing required consent." },
        { status: 400 }
      );
    }

    // Load application with all fields needed for completeness check
    const { data: app, error: fetchError } = await serviceClient
      .from("p101_opencall_applications")
      .select(
        "id, status, event_id, actor_name, guardian_name, guardian_email, guardian_phone, " +
        "birth_year, birth_month, gender, city, state, country, " +
        "union_status, coogan_status, work_permit, has_current_rep, current_rep_name, " +
        "seeking, casting_profile_urls, headshots, resume_url, slate_url"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle<Pick<OpenCallApplication,
        "id" | "status" | "event_id" | "actor_name" | "guardian_name" | "guardian_email" | "guardian_phone" |
        "birth_year" | "birth_month" | "gender" | "city" | "state" | "country" |
        "union_status" | "coogan_status" | "work_permit" | "has_current_rep" | "current_rep_name" |
        "seeking" | "casting_profile_urls" | "headshots" | "resume_url" | "slate_url"
      >>();

    if (fetchError) return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
    if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (app.status === "withdrawn") {
      return NextResponse.json({ error: "This application has been withdrawn." }, { status: 409 });
    }

    const { data: event } = await serviceClient
      .from("p101_opencall_events")
      .select("submits_close")
      .eq("id", app.event_id)
      .maybeSingle<{ submits_close: string }>();

    if (!event || new Date(event.submits_close) <= new Date()) {
      return NextResponse.json({ error: "The submission window has closed." }, { status: 409 });
    }

    // Mirror the DB check constraint — give a friendly message before hitting the DB
    const missing: string[] = [];
    if (!app.actor_name?.trim()) missing.push("Performer name");
    if (!app.guardian_name?.trim()) missing.push("Guardian name");
    if (!app.guardian_email?.trim()) missing.push("Guardian email");
    if (!app.guardian_phone?.trim()) missing.push("Guardian phone");
    if (!app.birth_year) missing.push("Birth year");
    if (!app.birth_month) missing.push("Birth month");
    if (!app.gender?.trim()) missing.push("Gender");
    if (!app.city?.trim()) missing.push("City");
    if (!app.state?.trim()) missing.push("State");
    if (!app.country?.trim()) missing.push("Country");
    if (!app.union_status) missing.push("Union status");
    if (!app.coogan_status) missing.push("Coogan status");
    if (!app.work_permit) missing.push("Work permit status");
    if (app.has_current_rep && !app.current_rep_name?.trim()) missing.push("Current rep name");
    if (!app.seeking?.length) missing.push("Seeking (at least one category)");
    if (!app.casting_profile_urls?.length) missing.push("At least one casting profile URL");
    if (!Array.isArray(app.headshots) || app.headshots.length === 0) missing.push("At least one headshot");
    if (!app.resume_url?.trim()) missing.push("Resume");
    if (!app.slate_url?.trim()) missing.push("Slate video");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Application is incomplete. Missing: ${missing.join(", ")}.` },
        { status: 422 }
      );
    }

    // Build consents JSONB — timestamps and copy hashes are server-generated
    const submittedAt = new Date().toISOString();
    const consentData = consentParsed.data;
    const consentsJSONB: Record<string, unknown> = {};

    for (const key of ["guardian_consent", "reviewer_visibility_consent", "contact_consent"] as const) {
      consentsJSONB[key] = {
        accepted: true,
        accepted_at: submittedAt,
        version: CONSENT_COPY[key].version,
        copy_hash: "sha256-" + createHash("sha256").update(CONSENT_COPY[key].text, "utf8").digest("hex"),
      };
    }
    if (consentData.anonymized_results_consent !== undefined) {
      consentsJSONB.anonymized_results_consent = {
        accepted: consentData.anonymized_results_consent,
        accepted_at: submittedAt,
        version: CONSENT_COPY.anonymized_results_consent.version,
        copy_hash: "sha256-" + createHash("sha256").update(CONSENT_COPY.anonymized_results_consent.text, "utf8").digest("hex"),
      };
    }

    // Service role bypasses the guard trigger for status transitions
    const { data: updated, error: updateError } = await serviceClient
      .from("p101_opencall_applications")
      .update({ status: "submitted", submitted_at: submittedAt, consents: consentsJSONB })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, status, submitted_at")
      .single<{ id: string; status: string; submitted_at: string }>();

    if (updateError) {
      return NextResponse.json({ error: "Failed to submit application." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, submitted_at: updated.submitted_at });
  }

  if (body.action === "withdraw") {
    const { data: existing, error: fetchError } = await serviceClient
      .from("p101_opencall_applications")
      .select("id, status, event_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; status: string; event_id: string }>();

    if (fetchError) return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (existing.status === "withdrawn") {
      return NextResponse.json({ error: "Application is already withdrawn." }, { status: 409 });
    }

    const { data: event } = await serviceClient
      .from("p101_opencall_events")
      .select("submits_close")
      .eq("id", existing.event_id)
      .maybeSingle<{ submits_close: string }>();

    if (!event || new Date(event.submits_close) <= new Date()) {
      return NextResponse.json({ error: "The submission window has closed." }, { status: 409 });
    }

    const withdrawnAt = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from("p101_opencall_applications")
      .update({ status: "withdrawn", withdrawn_at: withdrawnAt })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to withdraw application." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, withdrawn_at: withdrawnAt });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
