import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared completion logic for every email sign-in link.
 *
 * Two link shapes reach us and both have to work:
 *   - `?code=...`                 PKCE. Supabase's own `{{ .ConfirmationURL }}`
 *                                 template bounces through /auth/v1/verify,
 *                                 which 303s here with a code. The exchange
 *                                 needs the `code_verifier` cookie, so it only
 *                                 succeeds in the same browser that asked for
 *                                 the link.
 *   - `?token_hash=...&type=...`  Device-independent. Works when the link is
 *                                 opened on a phone after being requested on a
 *                                 laptop, which is the common real-world case.
 *
 * Whatever happens, a failure must never redirect to a protected page — that
 * bounces the visitor to a bare email form with no explanation and reads as
 * "the link did nothing".
 */

const DEFAULT_NEXT = "/dashboard";

const VALID_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email"
]);

export type AuthFailureReason = "expired" | "used" | "wrong_device" | "config" | "unknown";

/**
 * Reduce whatever arrived in `next` to a safe same-origin path.
 *
 * `next` has historically arrived as a bare path (`/opencall`), as a fully
 * qualified URL (Supabase echoes the whole `emailRedirectTo` back), and as an
 * auth route wrapping another `next`. All three collapse to a real destination
 * here so nothing loops back through /auth/* or off-origin.
 */
export function resolveNextPath(rawNext: string | null, origin: string): string {
  let candidate = rawNext;

  // Unwrap at most a few layers of nested auth URLs, then give up.
  for (let depth = 0; depth < 3; depth += 1) {
    if (!candidate) return DEFAULT_NEXT;

    let url: URL;
    try {
      url = new URL(candidate, origin);
    } catch {
      return DEFAULT_NEXT;
    }

    // Never follow a redirect off our own origin.
    if (url.origin !== origin) return DEFAULT_NEXT;

    if (url.pathname === "/auth/callback" || url.pathname === "/auth/confirm") {
      candidate = url.searchParams.get("next");
      continue;
    }

    // Other /auth/* paths are not landing pages.
    if (url.pathname.startsWith("/auth/")) return DEFAULT_NEXT;

    return `${url.pathname}${url.search}${url.hash}`;
  }

  return DEFAULT_NEXT;
}

/**
 * Where to send someone whose link failed. It has to be a page that can sign
 * them in, otherwise they land on a guarded route and get bounced again.
 */
export function signInSurfaceFor(nextPath: string, reason: AuthFailureReason): string {
  const params = `auth_error=${reason}&next=${encodeURIComponent(nextPath)}`;

  if (nextPath.startsWith("/opencall")) {
    return `/opencall?${params}#apply`;
  }

  return `/?${params}#login-section`;
}

function classifyError(message: string | undefined): AuthFailureReason {
  const text = (message ?? "").toLowerCase();

  // supabase-js refuses the exchange locally when the code_verifier cookie is
  // absent — i.e. the link was opened somewhere other than where it started.
  if (text.includes("code verifier") || text.includes("code_verifier")) return "wrong_device";
  if (text.includes("flow state") || text.includes("expired")) return "expired";
  if (text.includes("not found") || text.includes("already") || text.includes("invalid")) return "used";

  return "unknown";
}

export async function completeEmailAuth(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const nextPath = resolveNextPath(requestUrl.searchParams.get("next"), origin);

  const fail = (reason: AuthFailureReason) =>
    NextResponse.redirect(new URL(signInSurfaceFor(nextPath, reason), origin));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Auth callback: Supabase environment variables are missing.");
    return fail("config");
  }

  // Supabase can report the failure directly on the redirect it sends us.
  const providerError = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  if (providerError && !code && !tokenHash) {
    console.error("Auth callback: provider reported an error:", providerError);
    return fail(classifyError(providerError));
  }

  if (!code && !tokenHash) {
    console.error("Auth callback: link carried neither a code nor a token_hash.");
    return fail("unknown");
  }

  // Cookies are written onto the response we ultimately return, so build the
  // success response before running the exchange.
  const success = NextResponse.redirect(new URL(nextPath, origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          success.cookies.set(name, value, options);
        });
      }
    }
  });

  if (tokenHash) {
    if (!type || !VALID_OTP_TYPES.has(type)) {
      console.error("Auth callback: token_hash arrived with an unusable type:", type);
      return fail("unknown");
    }

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      console.error("Auth callback: verifyOtp failed:", error.message);
      return fail(classifyError(error.message));
    }

    return success;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code as string);

  if (error) {
    console.error("Auth callback: exchangeCodeForSession failed:", error.message);
    return fail(classifyError(error.message));
  }

  return success;
}
