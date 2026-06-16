import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const relaySchema = z.object({
  slug: z.string().trim().min(3).max(40),
  senderName: z.string().trim().min(1).max(120),
  senderEmail: z.string().trim().email().max(254),
  body: z.string().trim().min(1).max(2000),
  website: z.string().trim().max(255).optional().default("")
});

export async function POST(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Relay is unavailable." }, { status: 503 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = relaySchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete the relay form." }, { status: 400 });
  }

  if (parsed.data.website) {
    return NextResponse.json({ message: "Thanks for reaching out." }, { status: 200 });
  }

  const { data: pageRow, error: pageError } = await serviceClient
    .from("p101_actor_pages")
    .select("id, slug, published")
    .eq("slug", parsed.data.slug)
    .eq("published", true)
    .maybeSingle<{ id: string; slug: string; published: boolean }>();

  if (pageError) {
    console.error("Relay page lookup failed:", pageError);
    return NextResponse.json({ error: "Relay is unavailable." }, { status: 500 });
  }

  if (!pageRow) {
    return NextResponse.json({ error: "That page is not published." }, { status: 404 });
  }

  const { error: insertError } = await serviceClient.from("p101_relay_messages").insert({
    page_id: pageRow.id,
    sender_name: parsed.data.senderName,
    sender_email: parsed.data.senderEmail,
    body: parsed.data.body
  });

  if (insertError) {
    console.error("Relay insert failed:", insertError);
    return NextResponse.json({ error: "We could not send that message." }, { status: 500 });
  }

  return NextResponse.json({ message: "Message sent. The parent relay has it." }, { status: 200 });
}
