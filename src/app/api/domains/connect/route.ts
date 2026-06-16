import { NextResponse } from "next/server";
import {
  addVercelProjectDomain,
  customDomainRequestSchema,
  formatVerificationMessage,
  getVercelProjectDomain,
  loadExistingDomainRow,
  requireAuthenticatedPage,
  saveDomainRow
} from "@/lib/domains/vercel";

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = customDomainRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid domain." }, { status: 400 });
  }

  const authResult = await requireAuthenticatedPage(parsed.data.pageSlug, request.headers.get("authorization") ?? "");
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { supabase, pageRow } = authResult;

  const existingDomainResult = await loadExistingDomainRow(supabase, parsed.data.domain);
  if ("error" in existingDomainResult) {
    return NextResponse.json({ error: existingDomainResult.error }, { status: existingDomainResult.status });
  }

  if (existingDomainResult.data && existingDomainResult.data.page_id !== pageRow.id) {
    return NextResponse.json({ error: "That domain is already connected to another page." }, { status: 409 });
  }

  const currentDomain = await getVercelProjectDomain(parsed.data.domain);
  let vercelDomain = null;

  if (currentDomain.data) {
    vercelDomain = currentDomain.data;
  } else if (currentDomain.status === 404) {
    const createdDomain = await addVercelProjectDomain(parsed.data.domain);
    if (createdDomain.data) {
      vercelDomain = createdDomain.data;
    } else if (createdDomain.status === 400) {
      const refetched = await getVercelProjectDomain(parsed.data.domain);
      if (refetched.data) {
        vercelDomain = refetched.data;
      } else {
        return NextResponse.json({ error: createdDomain.error ?? "Could not connect domain." }, { status: createdDomain.status ?? 500 });
      }
    } else {
      return NextResponse.json({ error: createdDomain.error ?? "Could not connect domain." }, { status: createdDomain.status ?? 500 });
    }
  } else {
    return NextResponse.json({ error: currentDomain.error ?? "Could not connect domain." }, { status: currentDomain.status ?? 500 });
  }

  if (!vercelDomain) {
    return NextResponse.json({ error: "Could not connect domain." }, { status: 500 });
  }

  const saveResult = await saveDomainRow(supabase, pageRow.id, parsed.data.domain, Boolean(vercelDomain.verified));
  if ("error" in saveResult) {
    return NextResponse.json({ error: saveResult.error }, { status: saveResult.status });
  }

  const message = vercelDomain.verified
    ? "Connected and active."
    : formatVerificationMessage(parsed.data.domain, vercelDomain.verification);

  return NextResponse.json({
    domain: vercelDomain.name ?? parsed.data.domain,
    verified: Boolean(vercelDomain.verified),
    verification: vercelDomain.verification ?? [],
    apexName: vercelDomain.apexName ?? null,
    projectId: vercelDomain.projectId ?? null,
    message
  });
}
