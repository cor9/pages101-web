import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ResumeCredit } from "@/lib/types";

/**
 * GET|POST /api/resume101/import
 *
 * Fetches the authenticated user's resume credits from the Resume101 Airtable base
 * and returns them in the Pages101 internal format.
 *
 * Required env vars:
 *   AIRTABLE_API_KEY       — personal access token with read access on the Resume101 base
 *   AIRTABLE_BASE_ID       — the base ID (e.g. "appXXXXXXXXXX")
 *   AIRTABLE_CREDITS_TABLE — table name / ID for credits (default: "Credits")
 *   AIRTABLE_TABLE_NAME    — Resume101 table name / ID (often the leads table)
 *
 * The Airtable record is looked up by the user's email address stored in a "Email" field.
 * Adjust field names below to match your actual Airtable schema.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY?.trim() ?? "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID?.trim() ?? "";
const AIRTABLE_CREDITS_TABLE =
  process.env.AIRTABLE_CREDITS_TABLE?.trim() ||
  process.env.AIRTABLE_TABLE_NAME?.trim() ||
  "Credits";

async function handleImport(request: Request) {
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

  // Resume101 currently persists either:
  // 1. individual credit rows with Project/Role/Company fields, or
  // 2. a single lead row containing a serialized RESUME JSON blob.
  const filterFormula = encodeURIComponent(`{Email} = "${user.email}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CREDITS_TABLE)}?filterByFormula=${filterFormula}&fields[]=Project&fields[]=Role&fields[]=Company&fields[]=Category&fields[]=RESUME%20JSON&fields[]=Submitted%20at&pageSize=25`;

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
      createdTime?: string;
      fields: {
        Project?: string;
        Role?: string;
        Company?: string;
        Category?: string;
        "RESUME JSON"?: string;
        "Submitted at"?: string;
      };
    }>;
  };

  const directCredits = data.records
    .filter((record) => record.fields.Project)
    .map((record) => ({
      project: record.fields.Project ?? "",
      role: record.fields.Role ?? "",
      company: record.fields.Company ?? ""
    }));

  const credits = directCredits.length > 0 ? directCredits : extractCreditsFromResumeJson(data.records);

  return NextResponse.json({ credits, updatedAt: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
}

type ResumeJsonSectionItem = {
  project?: string;
  role?: string;
  studio?: string;
};

type ResumeJsonPayload = {
  television?: ResumeJsonSectionItem[];
  film?: ResumeJsonSectionItem[];
  theatre?: ResumeJsonSectionItem[];
  commercial?: ResumeJsonSectionItem[];
  newMedia?: ResumeJsonSectionItem[];
  voiceover?: ResumeJsonSectionItem[];
};

function extractCreditsFromResumeJson(
  records: Array<{
    createdTime?: string;
    fields: {
      "RESUME JSON"?: string;
      "Submitted at"?: string;
    };
  }>
): ResumeCredit[] {
  const latestRecord = [...records]
    .filter((record) => record.fields["RESUME JSON"])
    .sort((a, b) => {
      const aTime = Date.parse(a.fields["Submitted at"] ?? a.createdTime ?? "");
      const bTime = Date.parse(b.fields["Submitted at"] ?? b.createdTime ?? "");
      return bTime - aTime;
    })[0];

  const raw = latestRecord?.fields["RESUME JSON"];
  if (!raw) {
    return [];
  }

  try {
    const resume = JSON.parse(raw) as ResumeJsonPayload;
    const sections = [
      resume.television,
      resume.film,
      resume.theatre,
      resume.commercial,
      resume.newMedia,
      resume.voiceover
    ];

    return sections
      .flatMap((section) => section ?? [])
      .filter((item) => item.project)
      .map((item) => ({
        project: item.project ?? "",
        role: item.role ?? "",
        company: item.studio ?? ""
      }));
  } catch (error) {
    console.error("Resume101 JSON parse failed:", error);
    return [];
  }
}

export async function GET(request: Request) {
  return handleImport(request);
}

export async function POST(request: Request) {
  return handleImport(request);
}
