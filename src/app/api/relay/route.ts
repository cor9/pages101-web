import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPages101Email } from "@/lib/email";
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

  const relayPageResult = await loadPublishedRelayPage(serviceClient, parsed.data.slug);
  if ("error" in relayPageResult) {
    console.error("Relay page lookup failed:", relayPageResult.error);
    return NextResponse.json({ error: "Relay is unavailable." }, { status: 500 });
  }

  const pageRow = relayPageResult.data;

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

  const { data: ownerData, error: ownerError } = await serviceClient.auth.admin.getUserById(pageRow.user_id);
  if (ownerError) {
    console.error("Relay owner lookup failed:", ownerError);
  }

  const relayRecipient = pageRow.relay_recipient_email?.trim() || ownerData.user?.email?.trim();
  if (!relayRecipient) {
    return NextResponse.json({ error: "We saved the message, but could not deliver it." }, { status: 500 });
  }

  try {
    await sendPages101Email({
      to: relayRecipient,
      replyTo: parsed.data.senderEmail,
      subject: `New Pages101 relay message for ${pageRow.display_name}`,
      html: buildRelayEmailHtml({
        pageName: pageRow.display_name,
        pageSlug: pageRow.slug,
        senderName: parsed.data.senderName,
        senderEmail: parsed.data.senderEmail,
        body: parsed.data.body
      })
    });
  } catch (emailError) {
    console.error("Relay email delivery failed:", emailError);
    return NextResponse.json({ error: "We saved the message, but could not deliver it." }, { status: 500 });
  }

  return NextResponse.json({ message: "Message sent. The parent relay has it." }, { status: 200 });
}

type RelayPageRow = {
  id: string;
  slug: string;
  display_name: string;
  published: boolean;
  user_id: string;
  relay_recipient_email?: string | null;
};

async function loadPublishedRelayPage(serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>, slug: string) {
  const withRelayRecipient = await serviceClient
    .from("p101_actor_pages")
    .select("id, slug, display_name, published, user_id, relay_recipient_email")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<RelayPageRow>();

  if (!withRelayRecipient.error) {
    return { data: withRelayRecipient.data ?? null };
  }

  if (!(withRelayRecipient.error.code === "PGRST204" && withRelayRecipient.error.message?.includes("relay_recipient_email"))) {
    return { error: withRelayRecipient.error };
  }

  const withoutRelayRecipient = await serviceClient
    .from("p101_actor_pages")
    .select("id, slug, display_name, published, user_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<Omit<RelayPageRow, "relay_recipient_email">>();

  if (withoutRelayRecipient.error) {
    return { error: withoutRelayRecipient.error };
  }

  return {
    data: withoutRelayRecipient.data ? { ...withoutRelayRecipient.data, relay_recipient_email: null } : null
  };
}

function buildRelayEmailHtml({
  pageName,
  pageSlug,
  senderName,
  senderEmail,
  body
}: {
  pageName: string;
  pageSlug: string;
  senderName: string;
  senderEmail: string;
  body: string;
}) {
  const escapedPageName = escapeHtml(pageName);
  const escapedSenderName = escapeHtml(senderName);
  const escapedSenderEmail = escapeHtml(senderEmail);
  const escapedBody = escapeHtml(body).replace(/\n/g, "<br />");
  const pageUrl = `https://pages.childactor101.com/p/${pageSlug}`;

  return `
    <p>You received a new relay message for <b>${escapedPageName}</b>.</p>
    <p><b>From:</b> ${escapedSenderName}<br /><b>Email:</b> <a href="mailto:${escapedSenderEmail}">${escapedSenderEmail}</a></p>
    <p><b>Message:</b><br />${escapedBody}</p>
    <p><a href="${pageUrl}">View the live page</a></p>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
