#!/usr/bin/env node
// Deterministic seed generator for the Open Call Gallery Preview test event.
//
// Inserts exactly 30 fictional applications (dataset seed:
// "opencall-gallery-preview-v1", see src/lib/opencall-seed-profiles.json)
// into the year=9998 "Open Call Gallery Preview" test event so the real
// TalentSearch gallery can be exercised under realistic, difficult UI
// conditions (long names, broken media, edge-case notes, etc).
//
// Usage:
//   npm run opencall:seed-gallery                # insert 30 (refuses if seed data already exists)
//   npm run opencall:seed-gallery -- --reset     # clear existing seed data for the event, then insert 30
//   npm run opencall:clear-seed-gallery          # delete all seed data for the event
//
// Safety:
//   - Refuses to run against any event where is_test is not true.
//   - Every inserted row has is_seed = true AND consents.import_source.source =
//     FICTIONAL_SOURCE_ID ("seed-opencall-gallery-v1"). This event can also
//     hold real prior-year data (see scripts/import-opencall-2025-gallery.mjs,
//     tagged with a different import_source), so every existence-check,
//     duplicate-guard, and clear/--reset delete in this script filters on
//     THIS script's own import_source tag — never a blanket is_seed = true —
//     so it can never see, count, or delete rows imported by a different
//     source. The two datasets can be cleared independently.
//   - The insert is a single PostgREST INSERT statement covering all 30 rows,
//     so it is atomic: either all 30 commit or none do. No manual rollback
//     or partial-row cleanup is needed on failure.
//   - Consents and guardian fields are entirely fictional and deterministic
//     (same input -> same output every run); guardian emails resolve under
//     the IANA-reserved example.com domain and are never sent to.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    })
);

const MODE = args.clear ? "clear" : "seed";
const RESET = Boolean(args.reset);
const TEST_EVENT_YEAR = parseInt(args["event-year"] ?? "9998", 10);
const SEED_DATASET_ID = "opencall-gallery-preview-v1";
// Tags every row this script writes so it never gets confused with rows
// written by scripts/import-opencall-2025-gallery.mjs (or any other source)
// sharing the same is_seed=true / event_id.
const FICTIONAL_SOURCE_ID = "seed-opencall-gallery-v1";

// ─── Supabase client (service role — bypasses RLS) ──────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  console.error("Copy from your Supabase project settings > API > service_role key.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Consent copy — must mirror CONSENT_COPY in src/lib/opencall.ts ─────────
// Duplicated here (rather than imported) because this script runs as a plain
// Node ESM process outside the Next/TypeScript build; the real submit route
// builds consents the same way, so seed rows are indistinguishable in shape
// from a genuine submission.

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

// Deterministic (not wall-clock) — every run produces the same timestamps.
const DETERMINISTIC_ACCEPTED_AT = "2026-07-23T12:00:00.000Z";

function buildConsents(rowIndex) {
  const consents = {};
  for (const key of Object.keys(CONSENT_COPY)) {
    const { version, text } = CONSENT_COPY[key];
    consents[key] = {
      accepted: true,
      accepted_at: DETERMINISTIC_ACCEPTED_AT,
      version,
      copy_hash: "sha256-" + createHash("sha256").update(text, "utf8").digest("hex"),
    };
  }
  consents.import_source = { source: FICTIONAL_SOURCE_ID, row_index: rowIndex };
  return consents;
}

// ─── Seed user management ────────────────────────────────────────────────────
// Seed applications need a valid auth.users.id. We create a dedicated
// seed-agent account if it doesn't exist, using the service-role admin API.

const SEED_USER_EMAIL = "seed-agent@pages101.invalid";

async function getSeedUserId() {
  const provided = process.env.SEED_USER_ID;
  if (provided) {
    console.log(`Using provided SEED_USER_ID: ${provided.slice(0, 8)}…`);
    return provided;
  }

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`Could not list users: ${listErr.message}`);

  const existing = listData?.users?.find((u) => u.email === SEED_USER_EMAIL);
  if (existing) {
    console.log(`Reusing existing seed user: ${existing.id.slice(0, 8)}…`);
    return existing.id;
  }

  console.log("Creating seed service account…");
  const { randomBytes } = await import("node:crypto");
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: SEED_USER_EMAIL,
    password: randomBytes(32).toString("hex"),
    email_confirm: true,
    user_metadata: { is_seed_agent: true },
  });
  if (createErr) throw new Error(`Could not create seed user: ${createErr.message}`);
  console.log(`Seed user created: ${newUser.user.id.slice(0, 8)}…`);
  return newUser.user.id;
}

// ─── Load canonical profile dataset ─────────────────────────────────────────

async function loadProfiles() {
  const jsonPath = path.join(__dirname, "..", "src", "lib", "opencall-seed-profiles.json");
  const raw = await readFile(jsonPath, "utf8");
  const profiles = JSON.parse(raw);
  if (profiles.length !== 30) {
    throw new Error(`Expected exactly 30 seed profiles in opencall-seed-profiles.json, found ${profiles.length}.`);
  }
  return profiles;
}

function buildRows(profiles, eventId, seedUserId) {
  return profiles.map((p, i) => {
    const idx = i + 1;
    const padded = String(idx).padStart(3, "0");
    const fields = { ...p };
    delete fields._meta;
    // Deterministic, spread-out submission times (not wall-clock).
    const submittedAt = new Date(Date.UTC(2026, 6, 20, 9, 0, 0) + idx * 17 * 60 * 1000).toISOString();
    return {
      ...fields,
      event_id: eventId,
      user_id: seedUserId,
      is_seed: true,
      status: "submitted",
      submitted_at: submittedAt,
      guardian_name: `Seed Guardian ${padded}`,
      guardian_email: `seed+${padded}@example.com`,
      guardian_phone: `555-010-${padded}`,
      consents: buildConsents(i),
    };
  });
}

// ─── Distribution summary ───────────────────────────────────────────────────

function tally(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function printSummary(profiles) {
  const ageCounts = tally(profiles, (p) => p._meta.age_group);
  const unionCounts = tally(profiles, (p) => p.union_status);
  const repCounts = tally(profiles, (p) => p._meta.rep_category);
  const seekingRepCounts = {};
  for (const p of profiles) {
    for (const cat of p.seeking_representation) seekingRepCounts[cat] = (seekingRepCounts[cat] ?? 0) + 1;
  }
  const headshotCounts = tally(profiles, (p) => `${p._meta.headshot_count}_headshot(s)`);
  const reelCounts = tally(profiles, (p) => p._meta.reel_type);
  const resumeCounts = tally(profiles, (p) => p._meta.resume_type);
  const slateCounts = tally(profiles, (p) => p._meta.slate_type);
  const notesCounts = tally(profiles, (p) => p._meta.notes_length);
  const imageEdgeCounts = tally(
    profiles.filter((p) => p._meta.image_edge_case),
    (p) => p._meta.image_edge_case
  );
  const castingBrokenCount = profiles.filter((p) => p._meta.casting_broken).length;
  const local3PlusCount = profiles.filter((p) => p._meta.local_market_count >= 3).length;

  const printGroup = (label, counts) => {
    console.log(`  ${label}:`);
    for (const [k, v] of Object.entries(counts).sort()) console.log(`    ${k}: ${v}`);
  };

  console.log("\n── Dataset distribution summary ──────────────────────────");
  printGroup("Age group", ageCounts);
  printGroup("Union status", unionCounts);
  printGroup("Representation status", repCounts);
  printGroup("Representation sought", seekingRepCounts);
  console.log("  Media edge cases:");
  printGroup("  Headshot count", headshotCounts);
  printGroup("  Reel", reelCounts);
  printGroup("  Resume", resumeCounts);
  printGroup("  Slate", slateCounts);
  printGroup("  Supplemental notes length", notesCounts);
  console.log(`    image edge cases: ${JSON.stringify(imageEdgeCounts)}`);
  console.log(`    broken casting-profile URL: ${castingBrokenCount}`);
  console.log(`    3+ local-hire markets: ${local3PlusCount}`);
  console.log("────────────────────────────────────────────────────────────\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nOpen Call Seed Script — mode: ${MODE}${RESET ? " (--reset)" : ""}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Dataset: ${SEED_DATASET_ID}`);

  const { data: event, error: eventErr } = await supabase
    .from("p101_opencall_events")
    .select("id, name, year, status, is_test")
    .eq("year", TEST_EVENT_YEAR)
    .maybeSingle();

  if (eventErr) {
    console.error("ERROR fetching event:", eventErr.message);
    process.exit(1);
  }
  if (!event) {
    console.error(`ERROR: No event found with year=${TEST_EVENT_YEAR}.`);
    console.error("Run migration 202607280001_p101_opencall_seed_and_test_event.sql first.");
    process.exit(1);
  }
  if (!event.is_test) {
    console.error(`ERROR: Event "${event.name}" (year=${event.year}) is not a test event (is_test=false).`);
    console.error("Seeding is only allowed for events where is_test=true. Refusing to run.");
    process.exit(1);
  }

  console.log(`Event: "${event.name}" (year=${event.year}, status=${event.status})`);
  console.log(`Event ID: ${event.id}\n`);

  if (MODE === "clear") {
    await clearSeedData(event.id);
    return;
  }

  const { count: existingCount, error: countErr } = await supabase
    .from("p101_opencall_applications")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("is_seed", true)
    .eq("consents->import_source->>source", FICTIONAL_SOURCE_ID);

  if (countErr) {
    console.error("ERROR checking existing seed data:", countErr.message);
    process.exit(1);
  }

  if ((existingCount ?? 0) > 0 && !RESET) {
    console.error(`ERROR: ${existingCount} fictional seed application(s) already exist for this event.`);
    console.error("Refusing to create duplicates. Re-run with --reset to clear and recreate,");
    console.error("or run `npm run opencall:clear-seed-gallery` first.");
    process.exit(1);
  }

  if ((existingCount ?? 0) > 0 && RESET) {
    console.log(`Found ${existingCount} existing fictional seed application(s); clearing before recreate (--reset)…\n`);
    await clearSeedData(event.id);
  }

  await createSeedData(event.id);
}

async function createSeedData(eventId) {
  const profiles = await loadProfiles();
  const seedUserId = await getSeedUserId();
  const rows = buildRows(profiles, eventId, seedUserId);

  console.log(`Inserting ${rows.length} seed application(s) as a single atomic statement…`);

  const { data, error } = await supabase
    .from("p101_opencall_applications")
    .insert(rows)
    .select("id, actor_name");

  if (error) {
    console.error("\nERROR: Insert failed — no rows were committed (single-statement insert is all-or-nothing).");
    console.error(error.message);
    process.exit(1);
  }

  console.log(`\nCreated ${data.length} seed application(s):`);
  data.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.actor_name} — ${r.id}`));

  printSummary(profiles);

  console.log(`Admin seed page: /dashboard/admin/opencall/seed`);
  console.log("Done.\n");
}

async function clearSeedData(eventId) {
  // Scoped to THIS script's own import_source tag — never a blanket
  // is_seed=true — so real prior-year data imported by
  // scripts/import-opencall-2025-gallery.mjs (or any other source) is
  // untouched no matter what else shares this event_id.
  const { data: seedApps, error: findErr } = await supabase
    .from("p101_opencall_applications")
    .select("id, actor_name")
    .eq("event_id", eventId)
    .eq("is_seed", true)
    .eq("consents->import_source->>source", FICTIONAL_SOURCE_ID);

  if (findErr) {
    console.error("ERROR finding seed apps:", findErr.message);
    process.exit(1);
  }

  if (!seedApps || seedApps.length === 0) {
    console.log("No fictional seed applications (source=" + FICTIONAL_SOURCE_ID + ") found for this event.");
    return;
  }

  const seedIds = seedApps.map((r) => r.id);
  console.log(`Found ${seedIds.length} seed application(s). Deleting…`);

  const { count: introCount } = await supabase
    .from("p101_opencall_intro_requests")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  console.log(`  intro_requests deleted: ${introCount ?? 0}`);

  const { count: favCount } = await supabase
    .from("p101_opencall_rep_favorites")
    .delete({ count: "exact" })
    .in("application_id", seedIds);
  console.log(`  favorites deleted: ${favCount ?? 0}`);

  await supabase
    .from("p101_opencall_access_log")
    .update({ application_id: null })
    .in("application_id", seedIds);
  console.log("  access_log application_id cleared");

  // Safety: this delete can only ever affect rows that are in this event's
  // fictional-seed-id list AND is_seed = true AND tagged with this script's
  // own import_source — a real or differently-sourced application can never
  // match all three predicates at once.
  const { count: appCount, error: delErr } = await supabase
    .from("p101_opencall_applications")
    .delete({ count: "exact" })
    .in("id", seedIds)
    .eq("is_seed", true)
    .eq("consents->import_source->>source", FICTIONAL_SOURCE_ID);

  if (delErr) {
    console.error("ERROR deleting apps:", delErr.message);
    process.exit(1);
  }
  console.log(`  applications deleted: ${appCount ?? 0}`);
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
