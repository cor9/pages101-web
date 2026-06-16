import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const customDomainRequestSchema = z.object({
  pageSlug: z.string().trim().min(3).max(40),
  domain: z.string().trim().toLowerCase().regex(domainPattern, "Enter a valid domain")
});

export type VercelProjectDomainChallenge = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  projectId: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  customEnvironmentId?: string | null;
  updatedAt?: number;
  createdAt?: number;
  verified: boolean;
  verification?: VercelProjectDomainChallenge[];
};

export type CustomDomainActionResult = {
  domain: string;
  verified: boolean;
  message: string;
  verification?: VercelProjectDomainChallenge[];
  apexName?: string | null;
  projectId?: string | null;
};

type PageRow = {
  id: string;
  slug: string;
  user_id: string;
};

type DomainRow = {
  domain: string;
  page_id: string;
  verified: boolean;
};

type AuthenticatedContext = {
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
  pageRow: PageRow;
};

type VercelApiError = {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

export async function requireAuthenticatedPage(pageSlug: string, authHeader: string): Promise<AuthenticatedContext | { error: string; status: number }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { error: "Domain management is unavailable.", status: 503 };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: "Not authenticated", status: 401 };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: "Not authenticated", status: 401 };
  }

  const { data: pageRow, error: pageError } = await supabase
    .from("p101_actor_pages")
    .select("id, slug, user_id")
    .eq("slug", pageSlug)
    .eq("user_id", user.id)
    .maybeSingle<PageRow>();

  if (pageError) {
    console.error("Custom domain page lookup failed:", pageError);
    return { error: "Could not load page.", status: 500 };
  }

  if (!pageRow) {
    return { error: "Page not found.", status: 404 };
  }

  return { supabase, pageRow };
}

export async function loadDomainRow(supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>, pageId: string, domain: string) {
  const { data, error } = await supabase
    .from("p101_custom_domains")
    .select("domain, page_id, verified")
    .eq("page_id", pageId)
    .eq("domain", domain)
    .maybeSingle<DomainRow>();

  if (error) {
    console.error("Custom domain row lookup failed:", error);
    return { error: "Could not read domain state.", status: 500 as const };
  }

  return { data: data ?? null };
}

export async function loadExistingDomainRow(supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>, domain: string) {
  const { data, error } = await supabase
    .from("p101_custom_domains")
    .select("domain, page_id, verified")
    .eq("domain", domain)
    .maybeSingle<DomainRow>();

  if (error) {
    console.error("Custom domain lookup failed:", error);
    return { error: "Could not connect domain.", status: 500 as const };
  }

  return { data: data ?? null };
}

export async function saveDomainRow(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  pageId: string,
  domain: string,
  verified: boolean
) {
  const { error } = await supabase
    .from("p101_custom_domains")
    .upsert(
      {
        domain,
        page_id: pageId,
        verified,
        created_at: new Date().toISOString()
      },
      { onConflict: "domain" }
    );

  if (error) {
    console.error("Custom domain upsert failed:", error);
    return { error: "Could not save domain.", status: 500 as const };
  }

  const { error: cleanupError } = await supabase
    .from("p101_custom_domains")
    .delete()
    .eq("page_id", pageId)
    .neq("domain", domain);

  if (cleanupError) {
    console.error("Custom domain cleanup failed:", cleanupError);
  }

  return { ok: true as const };
}

export async function removeDomainRow(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  pageId: string,
  domain: string
) {
  const { error } = await supabase
    .from("p101_custom_domains")
    .delete()
    .eq("page_id", pageId)
    .eq("domain", domain);

  if (error) {
    console.error("Custom domain delete failed:", error);
    return { error: "Could not remove domain.", status: 500 as const };
  }

  return { ok: true as const };
}

export async function getVercelProjectDomain(domain: string): Promise<{ data: VercelProjectDomain | null; error?: string; status?: number }> {
  const config = getVercelConfig();
  if ("error" in config) {
    return { data: null, error: config.error, status: 503 };
  }

  const response = await fetch(`https://api.vercel.com/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json"
    }
  });

  return parseVercelJson<VercelProjectDomain>(response);
}

export async function addVercelProjectDomain(domain: string): Promise<{ data: VercelProjectDomain | null; error?: string; status?: number }> {
  const config = getVercelConfig();
  if ("error" in config) {
    return { data: null, error: config.error, status: 503 };
  }

  const response = await fetch(`https://api.vercel.com/v10/projects/${config.projectId}/domains`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ name: domain })
  });

  return parseVercelJson<VercelProjectDomain>(response);
}

export async function verifyVercelProjectDomain(domain: string): Promise<{ data: VercelProjectDomain | null; error?: string; status?: number }> {
  const config = getVercelConfig();
  if ("error" in config) {
    return { data: null, error: config.error, status: 503 };
  }

  const response = await fetch(`https://api.vercel.com/v9/projects/${config.projectId}/domains/${encodeURIComponent(domain)}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  });

  return parseVercelJson<VercelProjectDomain>(response);
}

export function formatVerificationMessage(domain: string, verification?: VercelProjectDomainChallenge[]) {
  if (!verification || verification.length === 0) {
    return `Open the DNS settings where ${domain} is managed, add the record Vercel returned, then click Verify.`;
  }

  const intro = `Open the DNS settings where ${domain} is managed, then add the record Vercel returned:`;
  const lines = verification.map((challenge) => {
    const target = challenge.domain || domain;
    const kind = challenge.type.toUpperCase();

    if (kind === "TXT") {
      return `TXT record at ${target} with value ${challenge.value}`;
    }

    if (kind === "CNAME") {
      return `CNAME record at ${target} pointing to ${challenge.value}`;
    }

    return `${challenge.type} record at ${target} with value ${challenge.value}`;
  });

  return `${intro} ${lines.join("; ")}.`;
}

function getVercelConfig() {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_API_TOKEN;

  if (!projectId || !token) {
    return { error: "Vercel project configuration is missing." as const };
  }

  return { projectId, token };
}

async function parseVercelJson<T>(response: Response): Promise<{ data: T | null; error?: string; status: number }> {
  const text = await response.text();
  const body = text ? safeJsonParse<VercelApiError | T>(text) : null;

  if (!response.ok) {
    const errorMessage =
      body && typeof body === "object" && "error" in body && body.error?.message
        ? body.error.message
        : body && typeof body === "object" && "message" in body && body.message
          ? body.message
          : text || `Vercel API request failed with status ${response.status}.`;

    return { data: null, error: errorMessage, status: response.status };
  }

  if (!body || typeof body !== "object") {
    return { data: null, error: "Vercel API returned an empty response.", status: response.status };
  }

  return { data: body as T, status: response.status };
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
