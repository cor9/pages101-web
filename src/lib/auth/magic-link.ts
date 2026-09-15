const STORAGE_PREFIX = "pages101:magic-link:";

export const MAGIC_LINK_SUCCESS_COOLDOWN_MS = 60 * 1000;
export const MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

function getStorageKey(email: string) {
  return `${STORAGE_PREFIX}${normalizeAuthEmail(email)}`;
}

function nowMs() {
  return Date.now();
}

export function getMagicLinkCooldownRemaining(email: string) {
  if (typeof window === "undefined") return 0;

  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return 0;

  const storedValue = window.localStorage.getItem(getStorageKey(normalizedEmail));
  const expiresAt = Number(storedValue);

  if (!Number.isFinite(expiresAt)) return 0;

  return Math.max(0, expiresAt - nowMs());
}

export function setMagicLinkCooldown(email: string, cooldownMs: number) {
  if (typeof window === "undefined") return;

  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) return;

  window.localStorage.setItem(getStorageKey(normalizedEmail), String(nowMs() + cooldownMs));
}

export function formatCooldown(remainingMs: number) {
  const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function isMagicLinkRateLimitError(error: { message?: string; status?: number } | null | undefined) {
  if (!error) return false;

  const message = (error.message ?? "").toLowerCase();
  return (
    error.status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("security purposes") ||
    message.includes("wait")
  );
}

/**
 * Copy for a sign-in link that didn't work. `/auth/callback` redirects back to
 * a page that can send a new link and names the reason in `?auth_error=`, so
 * the visitor sees what went wrong instead of an unexplained empty email form.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  expired:
    "That sign-in link has expired. Links are only good for a short window — enter your email below and we'll send a fresh one.",
  used: "That sign-in link was already used. Each link works once, so enter your email below and we'll send a new one.",
  wrong_device:
    "That link was opened in a different browser from the one that requested it. Enter your email below, then open the new link on this same device.",
  config: "Sign-in is temporarily unavailable. Please email info@childactor101.com and we'll get you in.",
  unknown: "We couldn't sign you in with that link. Enter your email below and we'll send a fresh one."
};

export function getAuthErrorMessage(reason: string | null | undefined) {
  if (!reason) return null;
  return AUTH_ERROR_MESSAGES[reason] ?? AUTH_ERROR_MESSAGES.unknown;
}

/**
 * Reads `?auth_error=` once on mount. Deliberately not `useSearchParams` — these
 * are statically rendered marketing pages and this avoids a Suspense boundary.
 */
export function readAuthErrorFromLocation() {
  if (typeof window === "undefined") return null;
  return getAuthErrorMessage(new URLSearchParams(window.location.search).get("auth_error"));
}
