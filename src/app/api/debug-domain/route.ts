import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host') || request.headers.get('host')?.split(':')[0];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase credentials in env" }, { status: 500 });
  }

  try {
    const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/p101_custom_domains`);
    url.searchParams.set("select", "verified,p101_actor_pages!inner(slug)");
    url.searchParams.set("domain", `eq.${host}`);
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
      return NextResponse.json({ 
        error: "Supabase API error", 
        status: response.status, 
        text: response.statusText 
      }, { status: 500 });
    }

    const rows = await response.json();
    return NextResponse.json({
      host_tested: host,
      rows_returned: rows,
      extracted_slug: rows[0]?.verified && rows[0].p101_actor_pages?.slug ? rows[0].p101_actor_pages.slug : null
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
