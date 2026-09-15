import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireAdminAuth } from "@/lib/opencall-admin";
import { generateInviteToken, buildInviteUrl } from "@/lib/opencall-admin";
import { CONSENT_COPY } from "@/lib/opencall";
import SEED_PROFILES_JSON from "@/lib/opencall-seed-profiles.json";

export const dynamic = "force-dynamic";

// ─── Seed profile definitions ─────────────────────────────────────────────────
// Canonical dataset (dataset seed: "opencall-gallery-preview-v1") lives in
// src/lib/opencall-seed-profiles.json — the same 30-profile fixture used by
// scripts/seed-opencall-gallery.mjs, so the admin "Generate" button and the
// CLI script always produce an identical gallery test set. All guardian
// fields use example.com addresses (IANA reserved, never deliverable). No
// real children, real families, or copied résumé content.

type SeedProfile = Omit<(typeof SEED_PROFILES_JSON)[number], "_meta">;
const SEED_PROFILES = SEED_PROFILES_JSON as unknown as SeedProfile[];

const DETERMINISTIC_ACCEPTED_AT = "2026-07-23T12:00:00.000Z";

function buildSeedConsents() {
  const consents: Record<string, unknown> = {};
  for (const key of ["guardian_consent", "reviewer_visibility_consent", "contact_consent"] as const) {
    const { version, text } = CONSENT_COPY[key];
    consents[key] = {
      accepted: true,
      accepted_at: DETERMINISTIC_ACCEPTED_AT,
      version,
      copy_hash: "sha256-" + createHash("sha256").update(text, "utf8").digest("hex"),
    };
  }
  return consents;
}


// ─── GET /api/opencall/admin/seed — list seed applications for an event ───────

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("p101_opencall_applications")
    .select("id, actor_name, gender, city, state, birth_year, union_status, has_current_rep, status, submitted_at, created_at")
    .eq("event_id", eventId)
    .eq("is_seed", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load seed applications." }, { status: 500 });
  }

  return NextResponse.json({ applications: data ?? [], total: (data ?? []).length });
}

// ─── POST /api/opencall/admin/seed — create seed applications ────────────────

export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;

  const body = await request.json().catch(() => ({})) as {
    event_id?: string;
    action?: "batch" | "preview_invite";
  };

  if (!body.event_id) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  // Verify the event exists and is a test event.
  const { data: event, error: eventError } = await serviceClient
    .from("p101_opencall_events")
    .select("id, name, is_test, year")
    .eq("id", body.event_id)
    .maybeSingle<{ id: string; name: string; is_test: boolean; year: number }>();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!event.is_test) {
    return NextResponse.json({
      error: "Seed data can only be created for test events (is_test = true). Use the Gallery Preview event (year 9998)."
    }, { status: 422 });
  }

  // ── Generate preview invite ───────────────────────────────────────────────
  if (body.action === "preview_invite") {
    const { rawToken, tokenHash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    const { error: inviteError } = await serviceClient
      .from("p101_opencall_rep_invites")
      .insert({
        event_id: body.event_id,
        rep_name: "Admin Preview",
        rep_email: user.email,
        rep_agency: "Child Actor 101 Admin",
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (inviteError) {
      return NextResponse.json({ error: "Failed to create preview invite." }, { status: 500 });
    }

    return NextResponse.json({ preview_url: buildInviteUrl(rawToken) });
  }

  // ── Batch seed ────────────────────────────────────────────────────────────
  // Refuse to create duplicates — mirrors the CLI script's --reset guard.
  // The seed page also disables the button once apps.length > 0, but this is
  // the authoritative check (the UI state could be stale).
  const { count: existingSeedCount } = await serviceClient
    .from("p101_opencall_applications")
    .select("id", { count: "exact", head: true })
    .eq("event_id", body.event_id)
    .eq("is_seed", true);

  if ((existingSeedCount ?? 0) > 0) {
    return NextResponse.json({
      error: `${existingSeedCount} seed application(s) already exist for this event. Delete existing seed data before regenerating.`,
    }, { status: 409 });
  }

  const consents = buildSeedConsents();
  const submittedAt = new Date().toISOString();
  const rows = SEED_PROFILES.map((p, i) => {
    const padded = String(i + 1).padStart(3, "0");
    return {
      ...p,
      event_id: body.event_id,
      user_id: user.id,
      is_seed: true,
      status: "submitted" as const,
      submitted_at: submittedAt,
      guardian_name: `Seed Guardian ${padded}`,
      guardian_email: `seed+${padded}@example.com`,
      guardian_phone: `555-010-${padded}`,
      consents,
    };
  });

  const { data: inserted, error: insertError } = await serviceClient
    .from("p101_opencall_applications")
    .insert(rows)
    .select("id, actor_name");

  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    created: (inserted ?? []).length,
    applications: inserted ?? [],
  }, { status: 201 });
}

// ─── DELETE /api/opencall/admin/seed — delete all seed data for an event ─────

export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  const confirm = url.searchParams.get("confirm");

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }
  if (confirm !== "DELETE SEED DATA") {
    return NextResponse.json({ error: "Missing confirmation. Pass confirm=DELETE+SEED+DATA." }, { status: 400 });
  }

  // Find seed application IDs for this event (for FK-safe cascade order).
  const { data: seedApps, error: findError } = await serviceClient
    .from("p101_opencall_applications")
    .select("id")
    .eq("event_id", eventId)
    .eq("is_seed", true);

  if (findError) {
    return NextResponse.json({ error: "Failed to find seed applications." }, { status: 500 });
  }

  if (!seedApps || seedApps.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No seed applications found for this event." });
  }

  const seedIds = seedApps.map((r: { id: string }) => r.id);
  const counts: Record<string, number> = {};

  // 1. Delete intro requests
  const { count: introCount } = await serviceClient
    .from("p101_opencall_intro_requests")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  counts.intro_requests = introCount ?? 0;

  // 2. Delete favorites
  const { count: favCount } = await serviceClient
    .from("p101_opencall_rep_favorites")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  counts.favorites = favCount ?? 0;

  // 3. Null out access log references (on delete set null is not on this FK;
  //    we clear manually to preserve the audit log rows).
  await serviceClient
    .from("p101_opencall_access_log")
    .update({ application_id: null })
    .in("application_id", seedIds);

  // 4. Delete seed applications.
  const { count: appCount, error: deleteError } = await serviceClient
    .from("p101_opencall_applications")
    .delete({ count: "exact" })
    .in("id", seedIds)
    .eq("is_seed", true); // safety: never touch real applications

  if (deleteError) {
    return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
  }
  counts.applications = appCount ?? 0;

  return NextResponse.json({ deleted: true, counts });
}

// ─── GET /api/opencall/admin/seed/profiles — return the profile list metadata ─

// This is handled by the same route via a query param; no separate file needed.
