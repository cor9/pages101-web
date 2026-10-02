// Isolated test fixture for the Open Call follow-up survey.
//
//   npx tsx scripts/opencall-survey-fixture.ts status
//   npx tsx scripts/opencall-survey-fixture.ts create  --user-email you@x.com --guardian-email you@x.com [--invite]
//   npx tsx scripts/opencall-survey-fixture.ts cleanup            (dry run: shows what would be deleted)
//   npx tsx scripts/opencall-survey-fixture.ts cleanup --yes      (actually deletes)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and
// SURVEY_LINK_SECRET if you pass --invite). Load them with:
//   set -a; source .env.local; set +a
//
// WHY A SEPARATE EVENT, NOT "Open Call 11":
//   A dummy submission inside the real event would appear in the rep gallery and
//   inflate the real counts. The fixture lives in its own event, so none of the
//   real data, gallery, or dashboard numbers can be touched or contaminated.
//   - year 2000: events.year is unique, and the PUBLIC event query returns the
//     HIGHEST year among open/reviewing/closed events, so a low year can never
//     be picked over a real event (a year-9999 fixture once could).
//   - status 'closed': the survey only accepts reviewing/closed events.
//
// BLAST RADIUS: cleanup only ever deletes rows inside the one fixture event, and
// refuses to run if that event contains anything that isn't clearly fixture data.

import { createClient } from "@supabase/supabase-js";
import { surveyUrl } from "../src/lib/opencall-survey-token";

const FIXTURE_YEAR = 2000;
const FIXTURE_EVENT_NAME = "SURVEY TEST EVENT (safe to delete)";
const ACTOR_PREFIX = "SURVEY TEST - ";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });

const [cmd, ...rest] = process.argv.slice(2);
const flag = (n: string) => rest.includes(`--${n}`);
const opt = (n: string) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };

function die(msg: string): never { console.error(`\n✗ ${msg}\n`); process.exit(1); }
function ok(msg: string) { console.log(`✓ ${msg}`); }

type Row = Record<string, unknown>;

async function fixtureEvent(): Promise<Row | null> {
  const { data, error } = await db.from("p101_opencall_events").select("*").eq("year", FIXTURE_YEAR).maybeSingle();
  if (error) die(`Could not look up the fixture event: ${error.message}`);
  if (!data) return null;
  if (data.name !== FIXTURE_EVENT_NAME) {
    die(`An event with year ${FIXTURE_YEAR} exists but is not named "${FIXTURE_EVENT_NAME}". Refusing to touch it.`);
  }
  return data;
}

async function findAuthUserId(email: string): Promise<string> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`Could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return die(`No Pages101 user with email ${email}. Sign in to Pages101 once with that address first.`);
}

async function status() {
  const ev = await fixtureEvent();
  if (!ev) return console.log("No fixture present.");
  const id = ev.id as string;
  const count = async (t: string) => (await db.from(t).select("id", { count: "exact", head: true }).eq("event_id", id)).count ?? 0;
  console.log(`Fixture event ${id}`);
  for (const t of ["p101_opencall_applications", "p101_opencall_survey_invites", "p101_opencall_survey_responses", "p101_opencall_rep_invites"]) {
    console.log(`  ${t}: ${await count(t)}`);
  }
}

async function create() {
  const userEmail = opt("user-email");
  const guardianEmail = opt("guardian-email");
  if (!userEmail || !guardianEmail) die("Pass --user-email and --guardian-email (both should be yours).");

  // The fixture must never be able to outrank a real event in the public query.
  const { data: real } = await db
    .from("p101_opencall_events").select("id, year, status").gt("year", FIXTURE_YEAR).in("status", ["open", "reviewing", "closed"]).limit(1);
  if (!real?.length) die("No real open/reviewing/closed event with a higher year exists, so the fixture could become the public event. Aborting.");

  if (await fixtureEvent()) die("A fixture already exists. Run `status`, or `cleanup --yes` first.");
  const userId = await findAuthUserId(userEmail);

  const { data: ev, error: evErr } = await db.from("p101_opencall_events").insert({
    year: FIXTURE_YEAR,
    name: FIXTURE_EVENT_NAME,
    submits_open: "2000-01-01T00:00:00Z",
    submits_close: "2000-02-01T00:00:00Z",
    review_close: "2000-03-01T00:00:00Z",
    status: "closed",
  }).select("id").single();
  if (evErr || !ev) die(`Could not create the fixture event: ${evErr?.message}`);
  ok(`Fixture event created (year ${FIXTURE_YEAR}, closed)`);

  // Two test submissions: one invitation is used up by whichever way you answer
  // (anonymous or named), so you need one for each run.
  const runs = ["Corey A (anonymous run)", "Corey B (named run)"];
  const apps: { id: string; label: string }[] = [];
  for (const label of runs) {
    const { data: app, error: appErr } = await db.from("p101_opencall_applications").insert({
      event_id: ev.id,
      user_id: userId,
      actor_name: `${ACTOR_PREFIX}${label}`,
      guardian_name: "Corey Ralston (test)",
      guardian_email: guardianEmail,
      guardian_phone: "000-000-0000",
      birth_year: new Date().getFullYear() - 12,
      birth_month: 6,
      gender: "Prefer not to say",
      city: "Test City",
      state: "CA",
      country: "US",
      union_status: "non_union",
      coogan_status: "not_required",
      work_permit: "not_required",
      has_current_rep: false,
      seeking: ["theatrical"],
      casting_profile_urls: ["https://example.com/survey-test"],
      headshots: [{ type: "commercial", url: "https://example.com/survey-test.jpg" }],
      resume_url: "https://example.com/survey-test-resume",
      slate_url: "https://example.com/survey-test-slate",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      consents: {
        guardian_consent: new Date().toISOString(),
        reviewer_visibility_consent: new Date().toISOString(),
        contact_consent: new Date().toISOString(),
      },
    }).select("id").single();
    if (appErr || !app) {
      // Don't leave a half-built fixture behind.
      await db.from("p101_opencall_applications").delete().eq("event_id", ev.id);
      await db.from("p101_opencall_events").delete().eq("id", ev.id);
      die(`Could not create test submission "${label}" (fixture rolled back): ${appErr?.message}`);
    }
    apps.push({ id: app.id as string, label });
    ok(`Test submission created: "${ACTOR_PREFIX}${label}" (guardian email: ${guardianEmail})`);
  }

  if (flag("invite")) {
    for (const app of apps) {
      const { data: inv, error } = await db.from("p101_opencall_survey_invites")
        .insert({ event_id: ev.id, application_id: app.id }).select("id").single();
      if (error || !inv) die(`Could not create the survey invitation (is the survey migration applied?): ${error?.message}`);
      ok(`Personal link for "${app.label}":`);
      console.log(`\n  ${surveyUrl(inv.id as string)}\n`);
    }
  } else {
    console.log(`
Next: in /dashboard/admin/opencall/survey pick "${FIXTURE_EVENT_NAME}", then
Create invitations → Email invitations. That sends two real emails to ${guardianEmail}
(one per test submission): use the first for the anonymous run, the second for the named run.`);
  }
}

async function cleanup() {
  const ev = await fixtureEvent();
  if (!ev) return console.log("No fixture present. Nothing to do.");
  const id = ev.id as string;
  if ((ev.year as number) !== FIXTURE_YEAR) die("Safety check failed: unexpected event year.");

  // Everything in the fixture event must be provably fixture data.
  const { data: apps } = await db.from("p101_opencall_applications").select("id, actor_name").eq("event_id", id);
  const stray = (apps ?? []).filter((a) => !String(a.actor_name).startsWith(ACTOR_PREFIX));
  if (stray.length) die(`The fixture event contains ${stray.length} application(s) not named "${ACTOR_PREFIX}…". Refusing to delete.`);
  const { count: repInvites } = await db.from("p101_opencall_rep_invites").select("id", { count: "exact", head: true }).eq("event_id", id);
  if (repInvites) die(`The fixture event has ${repInvites} rep invite(s). That's not test data from this script. Refusing to delete.`);

  const counts: Record<string, number> = {};
  for (const t of ["p101_opencall_survey_responses", "p101_opencall_survey_invites", "p101_opencall_applications"]) {
    counts[t] = (await db.from(t).select("id", { count: "exact", head: true }).eq("event_id", id)).count ?? 0;
  }
  console.log(`Fixture event ${id} will be deleted along with:`);
  for (const [t, n] of Object.entries(counts)) console.log(`  ${n} × ${t}`);

  if (!flag("yes")) return console.log("\nDry run. Re-run with --yes to delete.");

  // Order matters: responses (incl. anonymous ones, found by event) → invites → applications → event.
  for (const t of ["p101_opencall_survey_responses", "p101_opencall_survey_invites", "p101_opencall_applications"]) {
    const { error } = await db.from(t).delete().eq("event_id", id);
    if (error) die(`Delete from ${t} failed: ${error.message}`);
    ok(`Deleted ${t}`);
  }
  const { error } = await db.from("p101_opencall_events").delete().eq("id", id).eq("year", FIXTURE_YEAR).eq("name", FIXTURE_EVENT_NAME);
  if (error) die(`Delete event failed: ${error.message}`);
  ok("Deleted the fixture event. Real data untouched.");
}

(async () => {
  if (cmd === "status") await status();
  else if (cmd === "create") await create();
  else if (cmd === "cleanup") await cleanup();
  else die("Usage: status | create --user-email … --guardian-email … [--invite] | cleanup [--yes]");
})();
