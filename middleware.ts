import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  
  // Skip for the main app domain, localhost, and Vercel previews
  if (
    !host ||
    host === 'pages.childactor101.com' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app')
  ) {
    return NextResponse.next()
  }

  try {
    const slug = await getSlugForDomain(host);

    if (slug) {
      return NextResponse.rewrite(
        new URL(`/p/${slug}`, request.url)
      )
    }
  } catch (error) {
    console.error("Middleware domain lookup error:", error);
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
}

async function getSlugForDomain(domain: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase credentials in middleware");
    return null;
  }

  const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/p101_custom_domains`);
  url.searchParams.set("select", "verified,p101_actor_pages!inner(slug)");
  url.searchParams.set("domain", `eq.${domain}`);
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
    console.error("Supabase API error:", response.status, response.statusText);
    return null;
  }

  const rows = (await response.json()) as Array<{
    verified?: boolean;
    p101_actor_pages?: { slug?: string } | null;
  }>;

  return rows[0]?.verified && rows[0].p101_actor_pages?.slug ? rows[0].p101_actor_pages.slug : null;
}
