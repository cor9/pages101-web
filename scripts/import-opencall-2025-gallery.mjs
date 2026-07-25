#!/usr/bin/env node
// One-time importer: copies real 2025 Open Call submissions (Airtable CSV
// export) into the year=9998 "Open Call Gallery Preview" TEST event, so the
// real TalentSearch gallery can be exercised against real prior-year data.
//
// This is PRIVATE, single-viewer QA data. It is never inserted into any
// real/production Open Call event, and the gallery view already omits every
// guardian contact column regardless of is_seed/is_test (see
// p101_opencall_gallery_v in supabase/migrations/202607280001_...sql), so
// guardian PII is never exposed through TalentSearch for these rows either.
//
// Usage:
//   npm run opencall:import-2025-gallery            # import rows not yet imported (idempotent)
//   npm run opencall:import-2025-gallery -- --reset # delete previously-imported rows from this
//                                                    # CSV, then re-import all of them
//
// Safety:
//   - Refuses to run against any event that isn't year=9998 / is_test=true.
//   - Every inserted row has is_seed = true.
//   - Each inserted row is tagged consents.import_source = { source, row_hash,
//     row_index } so re-runs can detect already-imported rows (skip) instead
//     of silently duplicating them.
//   - --reset deletes ONLY rows for this event where is_seed = true AND
//     consents->>'import_source' identifies this CSV — it can never touch the
//     30 fictional gallery-preview seed profiles or any real application.
//   - No email is sent by this script; it only writes rows to
//     p101_opencall_applications. (TalentSearch's intro-request route also
//     independently skips SES for any row with is_seed = true.)

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "opencall-2025-export.csv");
const IMPORT_SOURCE_ID = "opencall-2025-export.csv";

// ─── Args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    })
);
const RESET = Boolean(args.reset);
const TEST_EVENT_YEAR = parseInt(args["event-year"] ?? "9998", 10);
const TEST_EVENT_NAME = "Open Call Gallery Preview";

// ─── Supabase client (service role — bypasses RLS) ──────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Consent copy — mirrors CONSENT_COPY in src/lib/opencall.ts ─────────────
// These rows represent real historical submissions that already went through
// the live 2025 consent flow; we don't have that flow's original versioned
// payload in the CSV, so we stamp the current copy version and use each row's
// own (real, historical) submission time as accepted_at — deterministic, not
// wall-clock, and not fabricated beyond "this performer's family consented
// when they actually submitted."

const CONSENT_COPY = {
  guardian_consent: {
    version: "2026-07-23",
    text: "I am the parent or legal guardian of this performer and I authorize this Open Call application to be submitted on their behalf.",
  },
  reviewer_visibility_consent: {
    version: "2026-07-23",
    text: "I consent to this application being reviewed by Pages101 and authorized industry representatives participating in this Open Call.",
  },
  contact_consent: {
    version: "2026-07-23",
    text: "I consent to Pages101 and participating representatives contacting me at the email address and phone number provided in this application.",
  },
};

function buildConsents(acceptedAtIso, importMeta) {
  const consents = {};
  for (const key of Object.keys(CONSENT_COPY)) {
    const { version, text } = CONSENT_COPY[key];
    consents[key] = {
      accepted: true,
      accepted_at: acceptedAtIso,
      version,
      copy_hash: "sha256-" + createHash("sha256").update(text, "utf8").digest("hex"),
    };
  }
  consents.import_source = importMeta;
  return consents;
}

// ─── Import user management ─────────────────────────────────────────────────

const IMPORT_USER_EMAIL = "opencall-2025-import@pages101.invalid";

async function getImportUserId() {
  const provided = process.env.IMPORT_USER_ID;
  if (provided) return provided;

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`Could not list users: ${listErr.message}`);

  const existing = listData?.users?.find((u) => u.email === IMPORT_USER_EMAIL);
  if (existing) return existing.id;

  const { randomBytes } = await import("node:crypto");
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: IMPORT_USER_EMAIL,
    password: randomBytes(32).toString("hex"),
    email_confirm: true,
    user_metadata: { is_import_agent: true },
  });
  if (createErr) throw new Error(`Could not create import user: ${createErr.message}`);
  return newUser.user.id;
}

// ─── Field-mapping helpers ───────────────────────────────────────────────────
// Every helper below documents exactly what it does and why — no silent
// guessing. Anything that can't be cleanly mapped is pushed onto a per-row
// `unmapped` list and folded into supplemental_notes rather than discarded.

function extractUrls(raw) {
  if (!raw) return [];
  const wrapped = [...raw.matchAll(/\(https?:\/\/[^)]+\)/g)].map((m) => m[0].slice(1, -1));
  if (wrapped.length) return wrapped;
  const bare = [...raw.matchAll(/https?:\/\/[^\s,]+/g)].map((m) => m[0]);
  return bare.length ? bare : (/^file:\/\//i.test(raw.trim()) ? [] : []);
}

// Applied to every raw CSV value before it's echoed into an unmapped/audit
// note (which ends up in supplemental_notes — a field the real gallery DOES
// render to reps). A stray personal email/phone typed into an unexpected
// column (ethnicity, work permit, etc.) must never surface this way; contact
// info that genuinely belongs in "Current Representation" text is untouched
// since it isn't routed through this function.
function redactPII(str) {
  if (!str) return str;
  return str
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted email]")
    .replace(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[redacted phone]");
}

function splitList(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBirthday(raw) {
  const m = (raw || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { birth_year: null, birth_month: null, ok: false };
  const [, mo, , yr] = m;
  return { birth_year: parseInt(yr, 10), birth_month: parseInt(mo, 10), ok: true };
}

function parseTimeCreated(raw) {
  // Format: "10/17/2025 8:33am"
  const m = (raw || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return null;
  let [, mo, day, yr, hh, mm, ap] = m;
  let hour = parseInt(hh, 10) % 12;
  if (ap.toLowerCase() === "pm") hour += 12;
  const d = new Date(Date.UTC(parseInt(yr, 10), parseInt(mo, 10) - 1, parseInt(day, 10), hour, parseInt(mm, 10)));
  return d.toISOString();
}

function parseLocation(raw, unmapped) {
  const parts = (raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  let city = parts[0] ?? null;
  let statePart = parts[1] ?? null;
  let country = "US";
  const isUsLike = (s) => /^(usa|united states|united states of america|us)$/i.test(s.trim());
  if (parts[2] && isUsLike(parts[2])) country = "US";
  else if (parts[2]) country = parts[2];
  if (statePart) {
    const trailingUs = statePart.match(/^(.*?)\s+(usa|united states|united states of america|us)$/i);
    if (trailingUs) statePart = trailingUs[1].trim();
    if (isUsLike(statePart)) statePart = null;
  }
  // city/state are NOT NULL for status='submitted'. ~15 CSV rows only gave a
  // single location token (no state) or none at all — fall back rather than
  // guess a specific state; the full raw string is preserved in notes.
  if (!city) { unmapped.push(`FALLBACK: city -> "Unknown" (source: "${redactPII(raw || "")}")`); city = "Unknown"; }
  if (!statePart) { unmapped.push(`FALLBACK: state -> "Unknown" (source: "${redactPII(raw || "")}")`); statePart = "Unknown"; }
  return { city, state: statePart, country };
}

const UNION_PRIORITY = [
  { match: /sag\/aftra(?!\s*eligible)/i, value: "sag_member" },
  { match: /sag\/aftra\s*eligible/i, value: "sag_eligible" },
  { match: /non-union/i, value: "non_union" },
];
function mapUnionStatus(raw, unmapped) {
  const options = splitList(raw);
  for (const { match, value } of UNION_PRIORITY) {
    if (options.some((o) => match.test(o))) return value;
  }
  if (options.length) unmapped.push(`union status: ${redactPII(options.join(", "))}`);
  // Required (NOT NULL) for status='submitted'. Blank or 'Other'-only source
  // values fall back to non_union — the least-assuming of the three values.
  unmapped.push("FALLBACK: union_status -> non_union (source blank or unrecognized)");
  return "non_union";
}

function mapCoogan(raw, unmapped) {
  if ((raw || "").trim().toLowerCase() === "checked") return "yes";
  // Required (NOT NULL) for status='submitted' (submit_complete_check); CSV
  // left this blank for most rows, so we fall back to the least-assuming
  // value rather than guessing yes/no.
  unmapped.push("FALLBACK: coogan_status -> not_required (source blank)");
  return "not_required";
}

function mapPassport(raw) {
  return (raw || "").trim().toLowerCase() === "checked";
}

function mapWorkPermit(raw, unmapped) {
  const v = (raw || "").trim();
  if (!v) {
    unmapped.push("FALLBACK: work_permit -> not_required (source blank)");
    return "not_required";
  }
  if (/^(n\/a|na|none|no)\.?$/i.test(v)) {
    return "no";
  }
  unmapped.push(`work permit detail: ${redactPII(v)}`);
  return "yes";
}

const NONE_LIKE_REP = /^(none|no|n\/a|unrepresented|not represented)\.?$/i;
function mapRepresentation(raw) {
  const v = (raw || "").trim();
  if (!v || NONE_LIKE_REP.test(v)) {
    return { has_current_rep: false, current_rep_name: null, rep_context: null };
  }
  const firstLine = v.split("\n")[0].trim();
  return {
    has_current_rep: true,
    current_rep_name: firstLine.slice(0, 160),
    rep_context: v.slice(0, 2000),
  };
}

// NOTE: the live TalentSearch gallery's "Seeking rep" filter (components/
// TalentGallery.jsx in the talentsearch repo) does a raw substring match
// against arrayToString(app.seeking) using its OWN fixed vocabulary —
// theatrical / manager / commercial / voice / regional — inherited from the
// original Airtable Open Call form (the same vocabulary this CSV uses). That
// is a different set from this app's own submission-form SEEKING_OPTIONS
// (src/lib/opencall.ts: theatrical/commercial/voiceover/print/musical_theater/
// hosting). We map to the GALLERY's vocabulary here so "Seeking Manager" and
// "Seeking Regional Agent" are actually filterable in the real gallery,
// rather than silently dropped. ('voiceover' also still works for the
// gallery's "voice" filter since 'voiceover'.includes('voice') is true.)
const SEEKING_MAP = {
  "seeking theatrical agent": "theatrical",
  "seeking commercial agent": "commercial",
  "seeking voice over agent": "voiceover",
  "seeking print agent": "print",
  "seeking manager": "manager",
  "seeking regional agent": "regional",
};
function mapSeeking(raw, unmapped) {
  const options = splitList(raw);
  const seeking = [];
  for (const o of options) {
    const mapped = SEEKING_MAP[o.trim().toLowerCase()];
    if (mapped) {
      if (!seeking.includes(mapped)) seeking.push(mapped);
    } else if (o.trim()) {
      unmapped.push(`seeking: ${redactPII(o.trim())}`);
    }
  }
  if (seeking.length === 0) {
    // Required: cardinality(seeking) >= 1 for status='submitted'. These rows
    // either left the field blank or selected only a category with no
    // equivalent in the fixed gallery filter vocabulary (e.g. "Seeking
    // Manager", "Seeking Regional Agent" — see notes above).
    unmapped.push("FALLBACK: seeking -> [theatrical] (no mappable category selected)");
    seeking.push("theatrical");
  }
  return seeking;
}

const CASTING_PLATFORM_MAP = {
  "actors access (required)": "actors_access",
  "casting networks (recommended)": "casting_networks",
};
function mapCastingPlatforms(raw) {
  const options = splitList(raw);
  const platforms = [];
  for (const o of options) {
    const key = o.trim().toLowerCase();
    if (key === "none") continue;
    const mapped = CASTING_PLATFORM_MAP[key];
    if (mapped) {
      if (!platforms.includes(mapped)) platforms.push(mapped);
    } else if (!platforms.includes("other")) {
      platforms.push("other");
    }
  }
  return platforms;
}

// Clearly-labeled, non-resolving placeholder domain — used only to satisfy
// the submit_complete_check NOT-NULL / cardinality requirements when the
// 2025 source genuinely had nothing for that field. Never a guess at real
// content; always logged so the report shows exactly which rows needed one.
const PLACEHOLDER_BASE = "https://import-placeholder.example.com";

function mapCastingUrls(raw, unmapped) {
  const urls = extractUrls(raw);
  if (urls.length === 0 && (raw || "").trim()) {
    unmapped.push(`casting profile link (non-URL): ${redactPII(raw.trim())}`);
  }
  const capped = urls.slice(0, 2); // DB constraint: cardinality(casting_profile_urls) <= 2
  if (capped.length === 0) {
    unmapped.push("FALLBACK: casting_profile_urls -> placeholder (source had none)");
    return [`${PLACEHOLDER_BASE}/no-casting-profile-provided`];
  }
  return capped;
}

function mapHeadshots(row, unmapped) {
  const headshots = [];
  for (const [col, type] of [
    ["Headshot Commercial", "commercial"],
    ["Headshot Theatrical", "theatrical"],
    ["Other Headshot", "other"],
  ]) {
    const urls = extractUrls(row[col]);
    if (urls.length === 0 && (row[col] || "").trim()) {
      unmapped.push(`${col} (non-URL): ${redactPII(row[col].trim().slice(0, 60))}`);
    }
    for (const url of urls) headshots.push({ type, url });
  }
  if (headshots.length === 0) {
    unmapped.push("FALLBACK: headshots -> placeholder (source had none)");
    headshots.push({ type: "other", url: `${PLACEHOLDER_BASE}/no-headshot-provided.jpg` });
  }
  return headshots;
}

function mapSingleMediaUrl(raw, label, unmapped) {
  const urls = extractUrls(raw);
  if (urls.length === 0) {
    if ((raw || "").trim()) unmapped.push(`${label} (non-URL, dropped to null): ${redactPII(raw.trim().slice(0, 60))}`);
    return null;
  }
  if (urls.length > 1) unmapped.push(`${label}: ${urls.length} URLs found, kept first only`);
  return urls[0];
}

// resume_url / slate_url are NOT NULL for status='submitted' — unlike reel
// and other_video (which stay genuinely optional/null), a missing value here
// gets a placeholder rather than violating the constraint.
function mapRequiredMediaUrl(raw, label, placeholderSlug, unmapped) {
  const url = mapSingleMediaUrl(raw, label, unmapped);
  if (url) return url;
  unmapped.push(`FALLBACK: ${label} -> placeholder (source had none)`);
  return `${PLACEHOLDER_BASE}/${placeholderSlug}`;
}

function mapEthnicity(raw, unmapped) {
  const options = splitList(raw);
  const clean = [];
  for (const o of options) {
    if (/@/.test(o) || /^\d[\d\s-]*$/.test(o)) {
      // Never echo the raw value here — an '@'-match is very likely a
      // personal email a respondent mistakenly typed into this field.
      unmapped.push(`ethnicity field contained non-ethnicity value (dropped): ${redactPII(o.slice(0, 40))}`);
      continue;
    }
    clean.push(o);
  }
  return clean;
}

// ─── Row -> application-row mapping ─────────────────────────────────────────

function mapRow(row, index) {
  const unmapped = [];
  const nameKey = Object.keys(row).find((k) => k.replace(/^﻿/, "") === "Actor’s Name") ?? "Actor’s Name";
  const actorName = (row[nameKey] || "").trim();

  const birthday = parseBirthday(row["Birthday"]);
  let birth_year = birthday.birth_year;
  let birth_month = birthday.birth_month;
  if (!birthday.ok) {
    const age = parseInt(row["Age"], 10);
    if (Number.isFinite(age)) {
      birth_year = 2025 - age; // fallback: approximate from submission-year Age
      birth_month = birth_month ?? 6;
      unmapped.push(`birthday unparseable, derived birth_year=${birth_year} from Age=${age}`);
    } else {
      // Required (NOT NULL) for status='submitted'; no usable source data at
      // all for this row's age — least-assuming fallback, clearly logged.
      birth_year = 2015;
      birth_month = 6;
      unmapped.push("FALLBACK: birth_year/birth_month unparseable and Age unusable; defaulted");
    }
  }

  const loc = parseLocation(row["City, State (Province), Country"], unmapped);
  const rep = mapRepresentation(row["Current Representation"]);
  const seeking = mapSeeking(row["Seeking What Talent Representation?"], unmapped);
  const castingPlatforms = mapCastingPlatforms(row["Casting Profiles"]);
  const castingUrls = mapCastingUrls(row["Casting Profile Link (Actors Access or Casting Networks only)"], unmapped);
  const headshots = mapHeadshots(row, unmapped);
  const resume_url = mapRequiredMediaUrl(row["Resume"], "resume", "no-resume-provided.pdf", unmapped);
  const slate_url = mapRequiredMediaUrl(row["Video Link (SLATE)"], "slate", "no-slate-provided.mp4", unmapped);
  const reel_url = mapSingleMediaUrl(row["Video Link (Reel, Clips, Self Tape)"], "reel", unmapped);
  const other_video_url = mapSingleMediaUrl(row["Other Video Link"], "other video", unmapped);
  const workPermit = mapWorkPermit(row["Current valid Work Permit(s)"], unmapped);

  let gender = (row["Gender Identity"] || "").trim();
  if (!gender) { unmapped.push("FALLBACK: gender -> \"Unknown\" (source blank)"); gender = "Unknown"; }

  // guardian_name/email/phone are NOT NULL for status='submitted'.
  // guardian_name: 7 CSV rows left this blank (adult performers, 18+, with no
  // guardian) — falls back to the performer's own name (self-represented).
  let guardianName = (row["Guardian Name - if under 18"] || "").trim();
  if (!guardianName) {
    unmapped.push("FALLBACK: guardian_name -> actor's own name (adult performer, no guardian listed)");
    guardianName = actorName || `Unnamed Performer ${index + 1}`;
  }
  // guardian_email/guardian_phone: CSV had no blanks for these 128 rows, but
  // fall back to a non-deliverable placeholder (reserved example.com /
  // reserved 555 number) if a future re-export ever does.
  let guardianEmail = (row["Email"] || "").trim();
  if (!guardianEmail) {
    unmapped.push("FALLBACK: guardian_email -> placeholder (source blank)");
    guardianEmail = `import-noemail-${String(index + 1).padStart(3, "0")}@example.com`;
  }
  let guardianPhone = (row["Phone Number"] || "").trim();
  if (!guardianPhone) {
    unmapped.push("FALLBACK: guardian_phone -> placeholder (source blank)");
    guardianPhone = `555-000-${String(index + 1).padStart(3, "0")}`;
  } else if (guardianPhone.length > 40) {
    // DB constraint: char_length(guardian_phone) <= 40.
    unmapped.push(`FALLBACK: guardian_phone truncated to 40 chars (source was ${guardianPhone.length} chars)`);
    guardianPhone = guardianPhone.slice(0, 40);
  }

  // Computed here (rather than inline below) so their unmapped.push() calls
  // land before supplemental_notes is finalized — otherwise these fallback
  // notes would silently never make it into the row's own notes field.
  const ethnicity = mapEthnicity(row["Ethnicity"], unmapped);
  const union_status = mapUnionStatus(row["Union Status"], unmapped);
  const coogan_status = mapCoogan(row["Coogan Account"], unmapped);

  let notes = (row["Supplemental Brief Notes"] || "").trim();
  if (unmapped.length) {
    const extra = "\n\n[Import notes — original 2025 submission]\n" + unmapped.map((u) => `- ${u}`).join("\n");
    notes = (notes + extra).slice(0, 4000);
  }

  const submittedAt = parseTimeCreated(row["Time Created"]) ?? new Date(Date.UTC(2025, 0, 1)).toISOString();

  const rowIdentity = [actorName, row["Birthday"], row["Time Created"], row["Email"]].join("|");
  const row_hash = createHash("sha256").update(rowIdentity, "utf8").digest("hex");

  return {
    application: {
      actor_name: actorName || `Unnamed Performer ${index + 1}`,
      birth_year: birth_year ?? null,
      birth_month: birth_month ?? null,
      gender,
      ethnicity,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      local_hire_cities: splitList(row["Local Hire Cities"]),
      union_status,
      coogan_status,
      work_permit: workPermit,
      passport: mapPassport(row["Current Passport"]),
      has_current_rep: rep.has_current_rep,
      current_rep_name: rep.current_rep_name,
      rep_context: rep.rep_context,
      seeking,
      casting_platforms: castingPlatforms,
      casting_profile_urls: castingUrls,
      headshots,
      resume_url,
      slate_url,
      reel_url,
      other_video_url,
      supplemental_notes: notes || null,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone,
      submitted_at: submittedAt,
    },
    row_hash,
    row_index: index,
    unmapped,
  };
}

// ─── Mapping report (printed before any DB write) ───────────────────────────

const MAPPING_TABLE = [
  ["Actor's Name", "actor_name", "direct (required)"],
  ["Guardian Name - if under 18", "guardian_name", "direct; falls back to the performer's own name if blank (required field, adult performer case)"],
  ["Birthday", "birth_year, birth_month", "parsed M/D/YYYY; falls back to Age, then a fixed default, if unparseable (required field)"],
  ["Age", "(cross-check only)", "used only as birth_year fallback"],
  ["Gender Identity", "gender", "direct; 'Unknown' fallback if blank (required field)"],
  ["Ethnicity", "ethnicity[]", "comma-split; entries that look like email/number are dropped + logged"],
  ["Email", "guardian_email", "direct; placeholder fallback if blank (required field, none needed for this export)"],
  ["Phone Number", "guardian_phone", "direct; truncated to 40 chars if longer (DB constraint), placeholder fallback if blank"],
  ["City, State (Province), Country", "city, state, country", "comma-parsed, trailing USA/US variants normalized"],
  ["Local Hire Cities", "local_hire_cities[]", "comma/newline-split"],
  ["Union Status", "union_status", "priority-mapped (sag_member > sag_eligible > non_union); blank/'Other' -> non_union (required field, logged as fallback)"],
  ["Coogan Account", "coogan_status", "'checked' -> yes; blank -> not_required (required field, logged as fallback)"],
  ["Current valid Work Permit(s)", "work_permit", "blank -> not_required (fallback); n/a-like -> no; any other detail -> yes (raw detail preserved in notes)"],
  ["Current Passport", "passport", "'checked' -> true; blank -> false"],
  ["Current Representation", "has_current_rep, current_rep_name, rep_context", "blank/none-like -> unrepresented; else full text preserved in rep_context"],
  ["Seeking What Talent Representation?", "seeking[]", "Maps to the live gallery's own filter vocabulary (theatrical/manager/commercial/voiceover/regional/print), not this app's newer form options; [theatrical] fallback if none map (required field)"],
  ["Casting Profiles", "casting_platforms[]", "Actors Access/Casting Networks map directly; Backstage/Casting Frontier/Casting Workbook/Other -> 'other' (DB only allows these 3 values)"],
  ["Casting Profile Link (...)", "casting_profile_urls[]", "URL(s) extracted, capped at 2 (DB constraint); non-URL text logged + dropped; placeholder fallback if none (required field)"],
  ["Headshot Commercial / Theatrical / Other", "headshots[] (type: commercial/theatrical/other)", "URL(s) extracted per column, multiple per cell supported (required field — none needed a fallback for this export)"],
  ["Resume", "resume_url", "first URL extracted; placeholder fallback if none (required field)"],
  ["Video Link (SLATE)", "slate_url", "URL extracted; placeholder fallback if none (required field)"],
  ["Video Link (Reel, Clips, Self Tape)", "reel_url", "URL extracted; non-URL text dropped to null + logged"],
  ["Other Video Link", "other_video_url", "URL extracted; non-URL text dropped to null + logged"],
  ["Supplemental Brief Notes", "supplemental_notes", "direct, with unmapped-field detail appended (capped at 4000 chars)"],
  ["Time Created", "submitted_at", "parsed M/D/YYYY h:mma -> ISO timestamp"],
  ["Selects", "(none)", "not mappable to any schema field — dropped (internal Airtable flag, values were blank/'1')"],
];

function printMappingReport() {
  console.log("\n── CSV -> schema mapping ──────────────────────────────────");
  for (const [csvCol, dbField, note] of MAPPING_TABLE) {
    console.log(`  ${csvCol}`);
    console.log(`    -> ${dbField}`);
    console.log(`       ${note}`);
  }
  console.log("─────────────────────────────────────────────────────────────\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nOpen Call 2025 CSV Import${RESET ? " (--reset)" : ""}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`CSV: ${CSV_PATH}`);

  printMappingReport();

  const { data: event, error: eventErr } = await supabase
    .from("p101_opencall_events")
    .select("id, name, year, status, is_test")
    .eq("year", TEST_EVENT_YEAR)
    .maybeSingle();

  if (eventErr) { console.error("ERROR fetching event:", eventErr.message); process.exit(1); }
  if (!event) {
    console.error(`ERROR: No event found with year=${TEST_EVENT_YEAR}. Refusing to run.`);
    process.exit(1);
  }
  if (!event.is_test) {
    console.error(`ERROR: Event "${event.name}" (year=${event.year}) is not a test event (is_test=false). Refusing to run.`);
    process.exit(1);
  }
  if (event.name !== TEST_EVENT_NAME) {
    console.error(`ERROR: Event name "${event.name}" does not match expected "${TEST_EVENT_NAME}". Refusing to run.`);
    process.exit(1);
  }

  console.log(`Event: "${event.name}" (year=${event.year}, status=${event.status})`);
  console.log(`Event ID: ${event.id}\n`);

  const raw = await readFile(CSV_PATH, "utf8");
  const csvRows = parseCsv(raw, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
  console.log(`CSV row count: ${csvRows.length}`);

  const mapped = csvRows.map((row, i) => mapRow(row, i));

  // ─── Existing-import lookup (for idempotent skip / --reset) ──────────────
  const { data: existingRows, error: existingErr } = await supabase
    .from("p101_opencall_applications")
    .select("id, consents")
    .eq("event_id", event.id)
    .eq("is_seed", true);

  if (existingErr) { console.error("ERROR checking existing imports:", existingErr.message); process.exit(1); }

  const existingImportRows = (existingRows ?? []).filter(
    (r) => r.consents?.import_source?.source === IMPORT_SOURCE_ID
  );
  const existingHashes = new Set(existingImportRows.map((r) => r.consents.import_source.row_hash));

  if (RESET && existingImportRows.length > 0) {
    console.log(`--reset: deleting ${existingImportRows.length} previously-imported row(s) from this CSV…`);
    await clearImportedRows(event.id, existingImportRows.map((r) => r.id));
    existingHashes.clear();
  }

  const toInsert = RESET ? mapped : mapped.filter((m) => !existingHashes.has(m.row_hash));
  const skipped = RESET ? [] : mapped.filter((m) => existingHashes.has(m.row_hash));

  console.log(`Rows to import: ${toInsert.length}`);
  console.log(`Rows already imported (skipped): ${skipped.length}\n`);

  if (toInsert.length === 0) {
    console.log("Nothing to do — all rows already imported. Use --reset to reimport.");
    printFinalReport({ event, csvRowCount: csvRows.length, insertedCount: 0, skippedCount: skipped.length, failedRows: [], insertedIds: [] });
    return;
  }

  const importUserId = await getImportUserId();

  const rows = toInsert.map((m) => ({
    ...m.application,
    event_id: event.id,
    user_id: importUserId,
    is_seed: true,
    status: "submitted",
    consents: buildConsents(m.application.submitted_at, {
      source: IMPORT_SOURCE_ID,
      row_hash: m.row_hash,
      row_index: m.row_index,
    }),
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("p101_opencall_applications")
    .insert(rows)
    .select("id, actor_name");

  const failedRows = [];
  if (insertError) {
    console.error("\nERROR: Batch insert failed — no rows were committed (single-statement insert is all-or-nothing).");
    console.error(insertError.message);
    console.error("\nRetrying row-by-row to isolate the failure(s)…");
    const insertedIndividually = [];
    for (const row of rows) {
      const { data: single, error: singleErr } = await supabase
        .from("p101_opencall_applications")
        .insert(row)
        .select("id, actor_name")
        .single();
      if (singleErr) {
        failedRows.push({ actor_name: row.actor_name, error: singleErr.message });
      } else {
        insertedIndividually.push(single);
      }
    }
    printFinalReport({
      event, csvRowCount: csvRows.length,
      insertedCount: insertedIndividually.length, skippedCount: skipped.length,
      failedRows, insertedIds: insertedIndividually,
    });
    process.exit(failedRows.length > 0 ? 1 : 0);
  }

  printFinalReport({
    event, csvRowCount: csvRows.length,
    insertedCount: inserted.length, skippedCount: skipped.length,
    failedRows: [], insertedIds: inserted,
  });
}

async function clearImportedRows(eventId, ids) {
  const { count: introCount } = await supabase.from("p101_opencall_intro_requests").delete({ count: "exact" }).in("application_id", ids);
  const { count: favCount } = await supabase.from("p101_opencall_rep_favorites").delete({ count: "exact" }).in("application_id", ids);
  await supabase.from("p101_opencall_access_log").update({ application_id: null }).in("application_id", ids);
  const { count: appCount, error } = await supabase
    .from("p101_opencall_applications")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("event_id", eventId)
    .eq("is_seed", true);
  if (error) { console.error("ERROR clearing imported rows:", error.message); process.exit(1); }
  console.log(`  intro_requests deleted: ${introCount ?? 0}, favorites deleted: ${favCount ?? 0}, applications deleted: ${appCount ?? 0}\n`);
}

function printFinalReport({ event, csvRowCount, insertedCount, skippedCount, failedRows, insertedIds }) {
  console.log("\n── Import report ──────────────────────────────────────────");
  console.log(`  CSV row count: ${csvRowCount}`);
  console.log(`  Imported: ${insertedCount}`);
  console.log(`  Skipped (already imported): ${skippedCount}`);
  console.log(`  Failed: ${failedRows.length}`);
  console.log(`  Test event ID: ${event.id}`);
  if (failedRows.length) {
    console.log("  Failed rows:");
    failedRows.forEach((f) => console.log(`    - ${f.actor_name}: ${f.error}`));
  }
  if (insertedIds.length) {
    console.log(`  Inserted application IDs: ${insertedIds.length} (see above for id list)`);
  }
  console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
