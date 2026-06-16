import { type NextRequest, NextResponse } from "next/server";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "pages.childactor101.com";
const previewHosts = new Set(["vercel.app", "vercel.sh"]);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (host === rootDomain) {
    return NextResponse.next();
  }

  if (isPreviewHost(host) || isLocalHost(host)) {
    return NextResponse.next();
  }

  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.replace(`.${rootDomain}`, "");
    const url = request.nextUrl.clone();
    url.pathname = `/p/${slug}`;
    return NextResponse.rewrite(url);
  }

  if (host.includes(".")) {
    const slug = await getSlugForDomain(host);
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/p/${slug}` : `/p/${host}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function isPreviewHost(host: string) {
  return Array.from(previewHosts).some((suffix) => host.endsWith(`.${suffix}`) || host === suffix);
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

async function getSlugForDomain(domain: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/p101_custom_domains`);
  url.searchParams.set("select", "verified,p101_actor_pages!inner(slug)");
  url.searchParams.set("domain", `eq.${domain.toLowerCase()}`);
  url.searchParams.set("verified", "eq.true");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{
    verified?: boolean;
    p101_actor_pages?: { slug?: string } | null;
  }>;

  return rows[0]?.verified && rows[0].p101_actor_pages?.slug ? rows[0].p101_actor_pages.slug : null;
}
