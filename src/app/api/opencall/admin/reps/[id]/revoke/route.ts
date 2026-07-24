import { NextResponse } from "next/server";
import { requireAdminAuth, logRepAction } from "@/lib/opencall-admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/opencall/admin/reps/[id]/revoke
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;
  const { id } = await context.params;

  const { data: invite, error: fetchError } = await serviceClient
    .from("p101_opencall_rep_invites")
    .select("id, event_id, revoked_at")
    .eq("id", id)
    .maybeSingle<{ id: string; event_id: string; revoked_at: string | null }>();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  // Idempotent — already revoked is fine
  if (!invite.revoked_at) {
    const { error: updateError } = await serviceClient
      .from("p101_opencall_rep_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Revoke update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to revoke invite." }, { status: 500 });
    }

    await logRepAction(serviceClient, {
      invite_id: id,
      event_id: invite.event_id,
      action: "invite_revoked",
    });
  }

  return NextResponse.json({ revoked: true });
}
