import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth, generateInviteToken, buildRegistrationUrl } from "@/lib/opencall-admin";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  event_id: z.string().uuid(),
  source_name: z.string().trim().min(1).max(160),
  expires_at: z.string().datetime(),
});

type LinkRow = {
  id: string;
  event_id: string;
  source_name: string;
  created_at: string;
  expires_at: string;
  disabled_at: string | null;
  created_by: string | null;
};

// GET /api/opencall/admin/registration-links?event_id=UUID
// Each link is returned with registered / redeemed / intro counts.
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "event_id is required." }, { status: 400 });

  const { data: links, error } = await serviceClient
    .from("p101_opencall_registration_links")
    .select("id, event_id, source_name, created_at, expires_at, disabled_at, created_by")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .returns<LinkRow[]>();

  if (error) {
    console.error("Registration links list failed:", error.message);
    return NextResponse.json({ error: "Failed to load registration links." }, { status: 500 });
  }

  const linkIds = (links ?? []).map((l) => l.id);
  const { data: invites } = linkIds.length
    ? await serviceClient
        .from("p101_opencall_rep_invites")
        .select("id, registered_via, redeemed_at, revoked_at")
        .in("registered_via", linkIds)
        .returns<{ id: string; registered_via: string; redeemed_at: string | null; revoked_at: string | null }[]>()
    : { data: [] as { id: string; registered_via: string; redeemed_at: string | null; revoked_at: string | null }[] };

  const inviteIds = (invites ?? []).map((i) => i.id);
  const { data: intros } = inviteIds.length
    ? await serviceClient
        .from("p101_opencall_intro_requests")
        .select("invite_id")
        .in("invite_id", inviteIds)
        .returns<{ invite_id: string }[]>()
    : { data: [] as { invite_id: string }[] };

  const introsByInvite: Record<string, number> = {};
  for (const r of intros ?? []) introsByInvite[r.invite_id] = (introsByInvite[r.invite_id] ?? 0) + 1;

  const stats: Record<string, { registered: number; redeemed: number; revoked: number; intros: number }> = {};
  for (const inv of invites ?? []) {
    const s = (stats[inv.registered_via] ??= { registered: 0, redeemed: 0, revoked: 0, intros: 0 });
    s.registered += 1;
    if (inv.redeemed_at) s.redeemed += 1;
    if (inv.revoked_at) s.revoked += 1;
    s.intros += introsByInvite[inv.id] ?? 0;
  }

  const now = Date.now();
  const enriched = (links ?? []).map((l) => ({
    ...l,
    active: !l.disabled_at && new Date(l.expires_at).getTime() > now,
    ...(stats[l.id] ?? { registered: 0, redeemed: 0, revoked: 0, intros: 0 }),
  }));

  return NextResponse.json({ links: enriched });
}

// POST /api/opencall/admin/registration-links — create a reusable link
export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient, user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  }
  const { event_id, source_name, expires_at } = parsed.data;

  const { data: event, error: eventError } = await serviceClient
    .from("p101_opencall_events")
    .select("id, review_close")
    .eq("id", event_id)
    .maybeSingle<{ id: string; review_close: string }>();
  if (eventError || !event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const expiresDate = new Date(expires_at);
  if (expiresDate <= new Date()) {
    return NextResponse.json({ error: "Expiry must be in the future." }, { status: 422 });
  }
  if (expiresDate > new Date(event.review_close)) {
    return NextResponse.json({ error: `Expiry cannot exceed the event review close (${event.review_close}).` }, { status: 422 });
  }

  const { rawToken, tokenHash } = generateInviteToken();

  const { data: link, error: insertError } = await serviceClient
    .from("p101_opencall_registration_links")
    .insert({ event_id, source_name, token_hash: tokenHash, expires_at, created_by: user.email })
    .select("id, event_id, source_name, created_at, expires_at, disabled_at")
    .single<LinkRow>();

  if (insertError || !link) {
    console.error("Registration link insert failed:", insertError?.message);
    return NextResponse.json({ error: "Failed to create registration link." }, { status: 500 });
  }

  // Shown once; never persisted.
  return NextResponse.json({ link, registration_url: buildRegistrationUrl(rawToken) }, { status: 201 });
}
