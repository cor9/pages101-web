import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const domainSchema = z.object({
  pageSlug: z.string().trim().min(3).max(40),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a valid domain"),
  action: z.enum(["attach", "detach"])
});

export async function POST(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Domain management is unavailable." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError
  } = await serviceClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = domainSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid domain." }, { status: 400 });
  }

  const { data: pageRow, error: pageError } = await serviceClient
    .from("p101_actor_pages")
    .select("id, slug, user_id")
    .eq("slug", parsed.data.pageSlug)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; slug: string; user_id: string }>();

  if (pageError) {
    console.error("Custom domain page lookup failed:", pageError);
    return NextResponse.json({ error: "Could not load page." }, { status: 500 });
  }

  if (!pageRow) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }

  if (parsed.data.action === "detach") {
    const { error: deleteError } = await serviceClient
      .from("p101_custom_domains")
      .delete()
      .eq("page_id", pageRow.id)
      .eq("domain", parsed.data.domain);

    if (deleteError) {
      console.error("Custom domain detach failed:", deleteError);
      return NextResponse.json({ error: "Could not remove domain." }, { status: 500 });
    }

    return NextResponse.json({ domain: null, verified: false }, { status: 200 });
  }

  const { data: existingDomain, error: existingError } = await serviceClient
    .from("p101_custom_domains")
    .select("domain, page_id")
    .eq("domain", parsed.data.domain)
    .maybeSingle<{ domain: string; page_id: string }>();

  if (existingError) {
    console.error("Custom domain lookup failed:", existingError);
    return NextResponse.json({ error: "Could not connect domain." }, { status: 500 });
  }

  if (existingDomain && existingDomain.page_id !== pageRow.id) {
    return NextResponse.json({ error: "That domain is already connected to another page." }, { status: 409 });
  }

  const { error: upsertError } = await serviceClient
    .from("p101_custom_domains")
    .upsert({
      domain: parsed.data.domain,
      page_id: pageRow.id,
      verified: true,
      created_at: new Date().toISOString()
    }, { onConflict: "domain" });

  if (upsertError) {
    console.error("Custom domain attach failed:", upsertError);
    return NextResponse.json({ error: "Could not connect domain." }, { status: 500 });
  }

  const { error: cleanupError } = await serviceClient
    .from("p101_custom_domains")
    .delete()
    .eq("page_id", pageRow.id)
    .neq("domain", parsed.data.domain);

  if (cleanupError) {
    console.error("Custom domain cleanup failed:", cleanupError);
  }

  return NextResponse.json({ domain: parsed.data.domain, verified: true }, { status: 200 });
}
