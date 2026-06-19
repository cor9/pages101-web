import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ResumeCredit, ResumeCreditGroup, ResumeTraining } from "@/lib/types";

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
  // Do not request explicit field subsets here. Resume101 may point at a leads
  // table that stores credits inside a RESUME JSON blob rather than direct
  // Project/Role/Company columns, and Airtable rejects unknown field filters.
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CREDITS_TABLE)}?filterByFormula=${filterFormula}&pageSize=25`;

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

  const directImport = extractDirectCredits(data.records);
  const imported = directImport.credits.length > 0 ? directImport : extractResumeImportFromJson(data.records);

  return NextResponse.json({
    credits: imported.credits,
    groups: imported.groups,
    training: imported.training,
    skills: imported.skills,
    updatedAt: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  });
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
  training?: Array<{
    class?: string;
    instructor?: string;
    location?: string;
  }>;
  skills?: string | string[];
};

type ResumeImportPayload = {
  credits: ResumeCredit[];
  groups: ResumeCreditGroup[];
  training: ResumeTraining[];
  skills: string;
};

function extractDirectCredits(
  records: Array<{
    fields: {
      Project?: string;
      Role?: string;
      Company?: string;
      Category?: string;
    };
  }>
): ResumeImportPayload {
  const categoryMap = new Map<string, ResumeCredit[]>();

  for (const record of records) {
    const project = record.fields.Project?.trim();
    if (!project) continue;

    const credit = {
      project,
      role: record.fields.Role?.trim() ?? "",
      company: record.fields.Company?.trim() ?? ""
    };
    const category = record.fields.Category?.trim() || "Credits";
    categoryMap.set(category, [...(categoryMap.get(category) ?? []), credit]);
  }

  const groups = [...categoryMap.entries()].map(([title, credits]) => ({ title, credits }));

  return {
    credits: groups.flatMap((group) => group.credits),
    groups,
    training: [],
    skills: ""
  };
}

function extractResumeImportFromJson(
  records: Array<{
    createdTime?: string;
    fields: {
      "RESUME JSON"?: string;
      "Submitted at"?: string;
    };
  }>
): ResumeImportPayload {
  const latestRecord = [...records]
    .filter((record) => record.fields["RESUME JSON"])
    .sort((a, b) => {
      const aTime = Date.parse(a.fields["Submitted at"] ?? a.createdTime ?? "");
      const bTime = Date.parse(b.fields["Submitted at"] ?? b.createdTime ?? "");
      return bTime - aTime;
    })[0];

  const raw = latestRecord?.fields["RESUME JSON"];
  if (!raw) {
    return { credits: [], groups: [], training: [], skills: "" };
  }

  try {
    const resume = JSON.parse(raw) as ResumeJsonPayload;
    const groups = [
      buildGroup("Television", resume.television),
      buildGroup("Film", resume.film),
      buildGroup("Theatre", resume.theatre),
      buildGroup("Commercial", resume.commercial),
      buildGroup("New Media", resume.newMedia),
      buildGroup("Voiceover", resume.voiceover)
    ].filter((group): group is ResumeCreditGroup => Boolean(group));

    const training = (resume.training ?? [])
      .map((entry) => ({
        class: entry.class?.trim() ?? "",
        instructor: entry.instructor?.trim() ?? "",
        location: entry.location?.trim() ?? ""
      }))
      .filter((entry) => entry.class || entry.instructor || entry.location);

    const skills = Array.isArray(resume.skills)
      ? resume.skills.filter(Boolean).join(", ")
      : resume.skills?.trim() ?? "";

    return {
      credits: groups.flatMap((group) => group.credits),
      groups,
      training,
      skills
    };
  } catch (error) {
    console.error("Resume101 JSON parse failed:", error);
    return { credits: [], groups: [], training: [], skills: "" };
  }
}

function buildGroup(title: string, items?: ResumeJsonSectionItem[]): ResumeCreditGroup | null {
  const credits = (items ?? [])
    .map((item) => ({
      project: item.project?.trim() ?? "",
      role: item.role?.trim() ?? "",
      company: item.studio?.trim() ?? ""
    }))
    .filter((credit) => credit.project);

  return credits.length > 0 ? { title, credits } : null;
}

export async function GET(request: Request) {
  return handleImport(request);
}

export async function POST(request: Request) {
  return handleImport(request);
}
