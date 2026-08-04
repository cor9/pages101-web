import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { OpenCallEvent } from "@/lib/opencall";

export const dynamic = "force-dynamic";

export async function GET() {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await serviceClient
    .from("p101_opencall_events")
    .select("id, year, name, submits_open, submits_close, review_close, status, created_at, updated_at")
    .eq("is_test", false)
    .in("status", ["open", "reviewing", "closed"])
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle<OpenCallEvent>();

  if (error) {
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
