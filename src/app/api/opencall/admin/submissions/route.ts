import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/opencall-admin";
import { getOpenCallEligibilityError } from "@/lib/opencall";

export const dynamic = "force-dynamic";

type EventSummary = {
  id: string;
  name: string;
  year: number;
  status: string;
};

// This endpoint deliberately reads the same privacy-safe view used by the
// representative gallery. It never returns guardian fields to the browser.
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const { serviceClient } = auth;
  const requestedEventId = new URL(request.url).searchParams.get("event_id");

  let event: EventSummary | null = null;
  if (requestedEventId) {
    const { data, error } = await serviceClient
      .from("p101_opencall_events")
      .select("id, name, year, status")
      .eq("id", requestedEventId)
      .eq("is_test", false)
      .maybeSingle<EventSummary>();
    if (error || !data) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    event = data;
  } else {
    const { data, error } = await serviceClient
      .from("p101_opencall_events")
      .select("id, name, year, status")
      .eq("is_test", false)
      .in("status", ["open", "reviewing", "closed"])
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle<EventSummary>();
    if (error) return NextResponse.json({ error: "Failed to load the active event." }, { status: 500 });
    event = data;
  }

  if (!event) return NextResponse.json({ event: null, submissions: [] });

  const { data: submissions, error: submissionsError } = await serviceClient
    .from("p101_opencall_gallery_v")
    .select("*")
    .eq("event_id", event.id)
    .order("submitted_at", { ascending: false });

  if (submissionsError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  // Keep ineligible applications out of any reviewer-facing payload, including
  // older records submitted before server-side age validation was added.
  const eligibleSubmissions = (submissions ?? []).filter((submission) =>
    !getOpenCallEligibilityError(submission.birth_month, submission.birth_year)
  );

  return NextResponse.json({ event, submissions: eligibleSubmissions });
}
