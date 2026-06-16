import { z } from "zod";
import { promises as dns } from "dns";
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

export type DomainRoutingStatus = {
  configured: boolean;
  requiredType: "A" | "CNAME";
  requiredName: string;
  requiredValue: string;
  foundValues: string[];
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

export async function getDomainRoutingStatus(domain: string): Promise<DomainRoutingStatus> {
  const requiredRecord = getRequiredDnsRecord(domain);

  if (requiredRecord.type === "A") {
    try {
      const records = await dns.resolve4(domain);
      return {
        configured: records.includes(requiredRecord.value),
        requiredType: requiredRecord.type,
        requiredName: requiredRecord.name,
        requiredValue: requiredRecord.value,
        foundValues: records
      };
    } catch {
      return {
        configured: false,
        requiredType: requiredRecord.type,
        requiredName: requiredRecord.name,
        requiredValue: requiredRecord.value,
        foundValues: []
      };
    }
  }

  try {
    const records = await dns.resolveCname(domain);
    const normalizedRecords = records.map((record) => record.trim().replace(/\.$/, "").toLowerCase());

    return {
      configured: normalizedRecords.includes(requiredRecord.value),
      requiredType: requiredRecord.type,
      requiredName: requiredRecord.name,
      requiredValue: requiredRecord.value,
      foundValues: normalizedRecords
    };
  } catch {
    return {
      configured: false,
      requiredType: requiredRecord.type,
      requiredName: requiredRecord.name,
      requiredValue: requiredRecord.value,
      foundValues: []
    };
  }
}

export function formatVerificationMessage(domain: string, verification?: VercelProjectDomainChallenge[]) {
  if (!verification || verification.length === 0) {
    const requiredRecord = getRequiredDnsRecord(domain);
    return `Open the DNS settings where ${domain} is managed, add ${requiredRecord.type} ${requiredRecord.name} ${requiredRecord.value}, then click Verify.`;
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

export function formatDnsNotReadyMessage(domain: string, routingStatus: DomainRoutingStatus) {
  const foundRecords = routingStatus.foundValues.length > 0
    ? ` Current value found: ${routingStatus.foundValues.join(", ")}.`
    : " No matching DNS record is visible yet.";

  return `DNS is not active yet. Add ${routingStatus.requiredType} ${routingStatus.requiredName} ${routingStatus.requiredValue} where ${domain} is managed, then click Verify.${foundRecords}`;
}

export async function getActiveDomainStatus(vercelDomain: VercelProjectDomain, domain: string) {
  const routingStatus = await getDomainRoutingStatus(domain);
  const active = Boolean(vercelDomain.verified) && routingStatus.configured;

  return {
    active,
    routingStatus,
    message: active ? "Connected and active." : formatDnsNotReadyMessage(domain, routingStatus)
  };
}

function getVercelConfig() {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_API_TOKEN;

  if (!projectId || !token) {
    return { error: "Vercel project configuration is missing." as const };
  }

  return { projectId, token };
}

function getRequiredDnsRecord(domain: string) {
  const labels = domain.split(".");
  const isApex = labels.length === 2;

  return isApex
    ? { type: "A" as const, name: domain, value: "76.76.21.21" }
    : { type: "CNAME" as const, name: domain, value: "cname.vercel-dns.com" };
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
