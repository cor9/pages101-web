import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

// ─── Admin authorization ──────────────────────────────────────────────────────
// Admin emails are a server-only env var (never exposed to clients).
// The lists are comma-separated: ADMIN_EMAILS=a@b.com,c@d.com
// ADMIN_EMAILS_EXTRA is an additive production override so owner access can be
// restored without replacing an existing administrator allowlist.

export function isAdminEmail(email: string): boolean {
  const raw = [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAILS_EXTRA]
    .filter(Boolean)
    .join(",");
  const admins = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

// ─── Auth helper for admin routes ────────────────────────────────────────────

type AdminAuthSuccess = {
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
  user: { id: string; email: string };
};

export async function requireAdminAuth(
  request: Request
): Promise<AdminAuthSuccess | { error: NextResponse }> {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return { error: NextResponse.json({ error: "Service unavailable." }, { status: 503 }) };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !user || !user.email) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { serviceClient, user: { id: user.id, email: user.email } };
}

// ─── Token generation ─────────────────────────────────────────────────────────
// 32 cryptographically random bytes → base64url (43-char string).
// The raw token is only returned from this function; it is NEVER stored.

export function generateInviteToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
  return { rawToken, tokenHash };
}

// ─── Invite URL construction ──────────────────────────────────────────────────

export function buildInviteUrl(rawToken: string): string {
  const base = (process.env.TALENTSEARCH_BASE_URL ?? "https://talent.childactor101.com").replace(/\/$/, "");
  return `${base}/access?t=${encodeURIComponent(rawToken)}`;
}

// ─── Access log helper ────────────────────────────────────────────────────────

export async function logRepAction(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  opts: {
    invite_id: string;
    event_id: string;
    action: string;
    application_id?: string;
  }
) {
  const row: Record<string, string> = {
    invite_id: opts.invite_id,
    event_id: opts.event_id,
    action: opts.action,
  };
  if (opts.application_id) row.application_id = opts.application_id;

  const { error } = await serviceClient.from("p101_opencall_access_log").insert(row);
  if (error) {
    console.error("Access log insert failed:", error.message);
  }
}
