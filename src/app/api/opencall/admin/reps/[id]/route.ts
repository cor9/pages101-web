import { NextResponse } from "next/server";
import { requireAdminAuth, logRepAction } from "@/lib/opencall-admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/opencall/admin/reps/[id] — full invite detail with activity
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;
  const { id } = await context.params;

  const { data: invite, error } = await serviceClient
    .from("p101_opencall_rep_invites")
    .select("id, event_id, rep_name, rep_email, rep_agency, created_at, expires_at, revoked_at, redeemed_at")
    .eq("id", id)
    .maybeSingle<{
      id: string; event_id: string; rep_name: string; rep_email: string;
      rep_agency: string | null; created_at: string; expires_at: string;
      revoked_at: string | null; redeemed_at: string | null;
    }>();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  // Fetch favorites, intro requests, and access log in parallel
  const [favs, intros, log] = await Promise.all([
    serviceClient
      .from("p101_opencall_rep_favorites")
      .select("id, application_id, created_at")
      .eq("invite_id", id)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("p101_opencall_intro_requests")
      .select("id, application_id, status, requester_name, requester_email, requester_role, requested_at, guardian_email_sent_at, rep_email_sent_at, failed_at, failure_code")
      .eq("invite_id", id)
      .order("requested_at", { ascending: false }),
    serviceClient
      .from("p101_opencall_access_log")
      .select("id, action, application_id, created_at")
      .eq("invite_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    invite,
    favorites: favs.data ?? [],
    intro_requests: intros.data ?? [],
    access_log: log.data ?? [],
  });
}

