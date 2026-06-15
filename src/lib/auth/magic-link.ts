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
