import { createHmac, timingSafeEqual } from "crypto";

// Personal survey links are `<invite_id>.<hmac>`. Deriving the token from the
// invite id (rather than storing a random one) lets an admin re-send the SAME
// link in a reminder without us ever storing a raw token. SURVEY_LINK_SECRET
// is server-only.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  const s = process.env.SURVEY_LINK_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

function sign(inviteId: string, key: string): string {
  return createHmac("sha256", key).update(`oc-survey:${inviteId}`).digest("base64url");
}

export function surveyTokenConfigured(): boolean {
  return secret() !== null;
}

export function makeSurveyToken(inviteId: string): string {
  const key = secret();
  if (!key) throw new Error("SURVEY_LINK_SECRET is not set (min 32 chars).");
  return `${inviteId}.${sign(inviteId, key)}`;
}

// Returns the invite id if the token is authentic, else null.
export function verifySurveyToken(token: string): string | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 120) return null;
  const [inviteId, mac, extra] = token.split(".");
  if (extra !== undefined || !inviteId || !mac || !UUID_RE.test(inviteId)) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(inviteId, key));
  return a.length === b.length && timingSafeEqual(a, b) ? inviteId : null;
}

export function surveyUrl(inviteId: string): string {
  const base = (process.env.SURVEY_BASE_URL ?? "https://pages.childactor101.com").replace(/\/$/, "");
  return `${base}/opencall/survey?t=${encodeURIComponent(makeSurveyToken(inviteId))}`;
}
