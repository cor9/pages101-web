const reservedSlugs = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "dashboard",
  "help",
  "login",
  "mail",
  "pages",
  "root",
  "settings",
  "signup",
  "support",
  "www"
]);

const blockedTerms = ["fuck", "shit", "bitch", "cunt", "asshole"];

export function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateSlug(input: string) {
  const slug = normalizeSlug(input);

  if (!/^[a-z0-9](-?[a-z0-9])*$/.test(slug) || slug.length < 3 || slug.length > 40) {
    return { ok: false as const, slug, reason: "Use 3-40 lowercase letters, numbers, and single hyphens." };
  }

  if (reservedSlugs.has(slug)) {
    return { ok: false as const, slug, reason: "That URL is reserved." };
  }

  if (blockedTerms.some((term) => slug.includes(term))) {
    return { ok: false as const, slug, reason: "That URL cannot be used." };
  }

  return { ok: true as const, slug };
}
