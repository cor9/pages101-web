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

const REPRESENTATIVE_PROFILE_COLUMNS = [
  "id", "event_id", "actor_name", "birth_month", "birth_year", "gender",
  "ethnicity", "city", "state", "country", "local_hire_cities", "union_status",
  "coogan_status", "work_permit", "passport", "has_current_rep", "representatives",
  "seeking_representation", "representation_notes", "casting_platforms",
  "casting_profile_urls", "headshots", "resume_url", "slate_url", "reel_url",
  "other_video_url", "supplemental_notes", "submitted_at", "updated_at",
].join(",");

// This endpoint deliberately returns only the privacy-safe fields used by the
// representative gallery. Draft preview is admin-only and never returns
// guardian fields, changes application status, or makes a draft rep-visible.
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const { serviceClient } = auth;
  const searchParams = new URL(request.url).searchParams;
  const requestedEventId = searchParams.get("event_id");
  const requestedStatus = searchParams.get("status") ?? "submitted";
  if (requestedStatus !== "submitted" && requestedStatus !== "draft") {
    return NextResponse.json({ error: "Invalid application status." }, { status: 400 });
  }

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

  const query = requestedStatus === "draft"
    ? serviceClient
        .from("p101_opencall_applications")
        .select(REPRESENTATIVE_PROFILE_COLUMNS)
        .eq("event_id", event.id)
        .eq("status", "draft")
        .eq("is_seed", false)
        .order("updated_at", { ascending: false })
    : serviceClient
        .from("p101_opencall_gallery_v")
        .select("*")
        .eq("event_id", event.id)
        .order("submitted_at", { ascending: false });

  const { data: submissions, error: submissionsError } = await query;

  if (submissionsError) {
    return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  }

  // Keep ineligible completed applications out of reviewer-facing payloads.
  // Draft preview intentionally includes incomplete birth data so the owner can
  // see every in-progress application and how incomplete profiles would render.
  const visibleSubmissions = requestedStatus === "draft"
    ? submissions ?? []
    : (submissions ?? []).filter((submission) =>
        !getOpenCallEligibilityError(submission.birth_month, submission.birth_year)
      );

  return NextResponse.json({ event, submissions: visibleSubmissions, status: requestedStatus });
}
