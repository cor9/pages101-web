import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/opencall-admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ active: z.boolean() });

// PATCH /api/opencall/admin/registration-links/:id  { active: boolean }
// Disabling stops NEW registrations only. Invites already issued through the
// link keep working; revoke those individually from the invites list.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const { serviceClient } = auth;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "active (boolean) is required." }, { status: 400 });

  const { error } = await serviceClient
    .from("p101_opencall_registration_links")
    .update({ disabled_at: parsed.data.active ? null : new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Registration link update failed:", error.message);
    return NextResponse.json({ error: "Failed to update registration link." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
