import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ResumeCredit } from "@/lib/types";

/**
 * GET /api/resume101/import
 *
 * Fetches the authenticated user's resume credits from the Resume101 Airtable base
 * and returns them in the Pages101 internal format.
 *
 * Required env vars:
 *   AIRTABLE_API_KEY       — personal access token with read access on the Resume101 base
 *   AIRTABLE_BASE_ID       — the base ID (e.g. "appXXXXXXXXXX")
 *   AIRTABLE_CREDITS_TABLE — table name / ID for credits (default: "Credits")
 *
 * The Airtable record is looked up by the user's email address stored in a "Email" field.
 * Adjust field names below to match your actual Airtable schema.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY ?? "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID ?? "";
const AIRTABLE_CREDITS_TABLE = process.env.AIRTABLE_CREDITS_TABLE ?? "Credits";

export async function GET(request: Request) {
  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
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

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return NextResponse.json({ error: "Resume101 import is not configured" }, { status: 503 });
  }

  // Filter Airtable credits by the user's email
  // Adjust the filterByFormula field names to match your actual Airtable schema
  const filterFormula = encodeURIComponent(`{Email} = "${user.email}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CREDITS_TABLE)}?filterByFormula=${filterFormula}&fields[]=Project&fields[]=Role&fields[]=Company&fields[]=Category`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    next: { revalidate: 0 } // Always fresh
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Airtable fetch failed:", response.status, text);
    return NextResponse.json({ error: "Resume101 fetch failed" }, { status: 502 });
  }

  const data = (await response.json()) as {
    records: Array<{
      id: string;
      fields: {
        Project?: string;
        Role?: string;
        Company?: string;
        Category?: string;
      };
    }>;
  };

  const credits: ResumeCredit[] = data.records
    .filter((record) => record.fields.Project)
    .map((record) => ({
      project: record.fields.Project ?? "",
      role: record.fields.Role ?? "",
      company: record.fields.Company ?? ""
    }));

  return NextResponse.json({ credits, updatedAt: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
}
