import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth, generateInviteToken, buildInviteUrl } from "@/lib/opencall-admin";
import { sendPages101Email } from "@/lib/email";

export const dynamic = "force-dynamic";

const createInviteSchema = z.object({
  event_id: z.string().uuid(),
  rep_name: z.string().trim().min(1).max(120),
  rep_email: z.string().trim().email().max(254),
  rep_agency: z.string().trim().max(200).optional(),
  expires_at: z.string().datetime(),
});

// GET /api/opencall/admin/reps?event_id=UUID — list invites for an event
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  const { data: invites, error } = await serviceClient
    .from("p101_opencall_rep_invites")
    .select("id, event_id, rep_name, rep_email, rep_agency, created_at, expires_at, revoked_at, redeemed_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin reps list failed:", error.message);
    return NextResponse.json({ error: "Failed to load invites." }, { status: 500 });
  }

  // Augment each invite with favorite and intro counts
  const inviteIds = (invites ?? []).map((i) => i.id as string);

  const [favCounts, introCounts, lastAccess] = await Promise.all([
    inviteIds.length
      ? serviceClient
          .from("p101_opencall_rep_favorites")
          .select("invite_id")
          .in("invite_id", inviteIds)
      : { data: [] },
    inviteIds.length
      ? serviceClient
          .from("p101_opencall_intro_requests")
          .select("invite_id")
          .in("invite_id", inviteIds)
      : { data: [] },
    inviteIds.length
      ? serviceClient
          .from("p101_opencall_access_log")
          .select("invite_id, created_at")
          .in("invite_id", inviteIds)
          .order("created_at", { ascending: false })
      : { data: [] },
  ]);

  const favByInvite: Record<string, number> = {};
  const introByInvite: Record<string, number> = {};
  const lastByInvite: Record<string, string> = {};

  for (const r of (favCounts.data ?? []) as { invite_id: string }[]) {
    favByInvite[r.invite_id] = (favByInvite[r.invite_id] ?? 0) + 1;
  }
  for (const r of (introCounts.data ?? []) as { invite_id: string }[]) {
    introByInvite[r.invite_id] = (introByInvite[r.invite_id] ?? 0) + 1;
  }
  for (const r of (lastAccess.data ?? []) as { invite_id: string; created_at: string }[]) {
    if (!lastByInvite[r.invite_id]) lastByInvite[r.invite_id] = r.created_at;
  }

  const enriched = (invites ?? []).map((inv) => ({
    ...inv,
    favorite_count: favByInvite[inv.id as string] ?? 0,
    intro_count: introByInvite[inv.id as string] ?? 0,
    last_access: lastByInvite[inv.id as string] ?? null,
  }));

  return NextResponse.json({ invites: enriched });
}

// POST /api/opencall/admin/reps — create a new representative invite
export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fields." }, { status: 400 });
  }

  const { event_id, rep_name, rep_email, rep_agency, expires_at } = parsed.data;

  // Load the event to validate expiry bounds
  const { data: event, error: eventError } = await serviceClient
    .from("p101_opencall_events")
    .select("id, name, review_close, status")
    .eq("id", event_id)
    .maybeSingle<{ id: string; name: string; review_close: string; status: string }>();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const expiresDate = new Date(expires_at);
  const reviewClose = new Date(event.review_close);
  const now = new Date();

  if (expiresDate <= now) {
    return NextResponse.json({ error: "Expiry must be in the future." }, { status: 422 });
  }
  if (expiresDate > reviewClose) {
    return NextResponse.json(
      { error: `Expiry cannot exceed the event review close (${event.review_close}).` },
      { status: 422 }
    );
  }

  // Generate token — raw token is never stored
  const { rawToken, tokenHash } = generateInviteToken();

  const { data: invite, error: insertError } = await serviceClient
    .from("p101_opencall_rep_invites")
    .insert({
      event_id,
      rep_name,
      rep_email,
      rep_agency: rep_agency ?? null,
      token_hash: tokenHash,
      expires_at,
    })
    .select("id, event_id, rep_name, rep_email, rep_agency, created_at, expires_at")
    .single<{
      id: string;
      event_id: string;
      rep_name: string;
      rep_email: string;
      rep_agency: string | null;
      created_at: string;
      expires_at: string;
    }>();

  if (insertError || !invite) {
    console.error("Invite insert failed:", insertError?.message);
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }

  // Build the invite URL (one-time — not stored anywhere)
  const inviteUrl = buildInviteUrl(rawToken);

  // Send invitation email
  let emailDelivered = false;
  let emailError: string | null = null;

  try {
    await sendPages101Email({
      to: rep_email,
      subject: `Your Invitation to Review Child Actor 101 Open Call Submissions`,
      html: buildInviteEmailHtml({
        repName: rep_name,
        eventName: event.name,
        inviteUrl,
        expiresAt: expires_at,
        reviewClose: event.review_close,
      }),
    });
    emailDelivered = true;
  } catch (err) {
    console.error("Invite email delivery failed:", err);
    emailError = "Email delivery failed. Copy the invite URL below — it will not be shown again.";
  }

  // The raw invite URL is returned ONCE in this response and never persisted.
  return NextResponse.json(
    {
      invite,
      invite_url: inviteUrl,
      email_delivered: emailDelivered,
      email_error: emailError,
    },
    { status: 201 }
  );
}

// ─── Email builder ────────────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York"
  });
}

function buildInviteEmailHtml({
  repName, eventName, inviteUrl, expiresAt, reviewClose,
}: {
  repName: string; eventName: string; inviteUrl: string; expiresAt: string; reviewClose: string;
}) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1a1a2e;padding:24px 32px;">
      <p style="margin:0;color:#e5e7eb;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Child Actor 101</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">Open Call — Representative Access</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;">Hi ${esc(repName)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        You have been invited to review talent submissions for the <strong>${esc(eventName)}</strong>.
        The review window closes on <strong>${fmtDate(reviewClose)}</strong>.
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${esc(inviteUrl)}" style="display:inline-block;background:#1a1a2e;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">
          Access the Talent Gallery →
        </a>
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
        Your access link expires on <strong>${fmtDate(expiresAt)}</strong>. You may return using
        this same email link at any time before it expires.
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
        You are reviewing materials submitted by performing families who have specifically consented
        to their submissions being seen by authorized industry representatives. Please treat all
        submissions with professional discretion.
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
        <strong>This link is for your office's use only.</strong> It may be shared internally
        with agents, managers, assistants, and colleagues in your organization.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? Reply to this email or contact us at
        <a href="mailto:info@childactor101.com" style="color:#4f46e5;">info@childactor101.com</a>.
        <br>Child Actor 101 · childactor101.com
      </p>
    </div>
  </div>
</body></html>`;
}
