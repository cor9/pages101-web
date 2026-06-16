import { NextResponse } from "next/server";
import {
  customDomainRequestSchema,
  getActiveDomainStatus,
  loadDomainRow,
  requireAuthenticatedPage,
  saveDomainRow,
  verifyVercelProjectDomain
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
  const domainRowResult = await loadDomainRow(supabase, pageRow.id, parsed.data.domain);
  if ("error" in domainRowResult) {
    return NextResponse.json({ error: domainRowResult.error }, { status: domainRowResult.status });
  }

  if (!domainRowResult.data) {
    return NextResponse.json({ error: "Save the domain first." }, { status: 404 });
  }

  const vercelDomain = await verifyVercelProjectDomain(parsed.data.domain);
  if (!vercelDomain.data) {
    return NextResponse.json({ error: vercelDomain.error ?? "Could not verify domain." }, { status: vercelDomain.status ?? 500 });
  }

  const activeStatus = await getActiveDomainStatus(vercelDomain.data, parsed.data.domain);
  const saveResult = await saveDomainRow(supabase, pageRow.id, parsed.data.domain, activeStatus.active);
  if ("error" in saveResult) {
    return NextResponse.json({ error: saveResult.error }, { status: saveResult.status });
  }

  return NextResponse.json({
    domain: vercelDomain.data.name ?? parsed.data.domain,
    verified: activeStatus.active,
    verification: vercelDomain.data.verification ?? [],
    dns: activeStatus.routingStatus,
    apexName: vercelDomain.data.apexName ?? null,
    projectId: vercelDomain.data.projectId ?? null,
    message: activeStatus.message
  });
}
