// Run with: npx tsx --test tests/opencall-survey-stats.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSurvey, SURVEY_STATS_COLUMNS, type ResponseRow, type InviteRow } from "../src/lib/opencall-survey-stats";

const r = (o: Partial<ResponseRow> = {}): ResponseRow => ({
  is_anonymous: false, prior_representation: "none", reps_contacted: "no", meetings_count: null,
  offers_count: null, outcomes: [], prepared_submission: 3, prepared_next_step: null, ...o,
});
const contacted = (o: Partial<ResponseRow> = {}) => r({ reps_contacted: "yes", outcomes: [], meetings_count: 0, offers_count: 0, prepared_next_step: 3, ...o });

test("funnel counts and explicit denominators", () => {
  const rows = [
    ...Array(10).fill(0).map(() => r()),                                                   // 10 no contact
    ...Array(4).fill(0).map(() => contacted()),                                             // 4 contacted, nothing further
    contacted({ meetings_count: 1, outcomes: ["meeting"] }),                                // meeting only
    contacted({ meetings_count: 2, offers_count: 1, outcomes: ["meeting", "offer"] }),      // meeting + offer
    contacted({ meetings_count: 1, offers_count: 1, outcomes: ["meeting", "offer", "signed"] }), // signed
  ];
  const s = summarizeSurvey([], rows);
  const by = Object.fromEntries(s.stages.map((x) => [x.key, x]));
  assert.equal(by.respondents.count, 17);
  assert.equal(by.contacted.count, 7);
  assert.equal(by.contacted.of_respondents, 41);          // 7/17
  assert.equal(by.meeting.count, 3);
  assert.equal(by.meeting.of_contacted, 43);              // 3/7
  assert.equal(by.offer.count, 2);
  assert.equal(by.signed.count, 1);
  const conv = Object.fromEntries(s.conversions.map((c) => [c.label, c]));
  assert.deepEqual([conv["Offer, after a meeting"].count, conv["Offer, after a meeting"].base], [2, 3]);
  assert.deepEqual([conv["Signed"].count, conv["Signed"].base], [1, 2]);
  assert.equal(s.totals.meetings_min, 4);
});

test("a signing counts as an offer even if the box wasn't ticked", () => {
  const s = summarizeSurvey([], [contacted({ outcomes: ["signed"] })]);
  assert.equal(s.stages.find((x) => x.key === "offer")!.count, 1);
});

test("'no' and 'unsure' never contribute to rep stages, even with stray values", () => {
  const s = summarizeSurvey([], [r({ reps_contacted: "unsure", meetings_count: 3, offers_count: 2, outcomes: ["offer", "signed"] })]);
  assert.deepEqual(s.stages.map((x) => x.count), [1, 0, 0, 0, 0]);
  assert.equal(s.totals.meetings_min, 0);
});

test("small cells are suppressed in the representation breakdown", () => {
  const rows = [
    contacted({ prior_representation: "both", meetings_count: 1, outcomes: ["meeting"] }),   // group of 2
    r({ prior_representation: "both" }),
    ...Array(6).fill(0).map(() => r({ prior_representation: "none" })),                     // group of 6
    contacted({ prior_representation: "none" }),                                              // ...with 1 contacted
    contacted({ prior_representation: "none" }),                                              // ...and a 2nd
    r({ prior_representation: "agent_only" }),                                                // group of 1
  ];
  const g = Object.fromEntries(summarizeSurvey([], rows).by_representation.map((x) => [x.key, x]));
  assert.equal(g.both.suppressed, true);                 // n=2: whole row hidden
  assert.equal(g.both.respondents, "<3");
  assert.equal(g.both.meeting, "<3");
  assert.equal(g.both.contacted_pct, null);
  assert.equal(g.agent_only.suppressed, true);           // n=1
  assert.equal(g.manager_only.respondents, 0);           // truly empty is shown as 0, not hidden
  assert.equal(g.none.respondents, 8);
  assert.equal(g.none.contacted, "<3");                  // 2 contacted -> suppressed cell
  assert.equal(g.none.contacted_pct, 25);                // but n=8 >= 5, so a pct is allowed
});

test("preparedness keeps the whole distribution, not only the average", () => {
  const a = summarizeSurvey([], [4, 4, 4, 4].map((v) => r({ prepared_submission: v })));
  const b = summarizeSurvey([], [2, 2, 5, 5].map((v) => r({ prepared_submission: v })));
  assert.deepEqual(a.preparedness.submission.counts, [0, 0, 0, 4, 0]);
  assert.deepEqual(b.preparedness.submission.counts, [0, 2, 0, 0, 2]);
  assert.notDeepEqual(a.preparedness.submission.counts, b.preparedness.submission.counts);
  assert.equal(b.preparedness.submission.avg, 3.5);
});

test("next-step readiness only counts people who were contacted", () => {
  const s = summarizeSurvey([], [contacted({ prepared_next_step: 5 }), r({ prepared_next_step: 1 })]);
  assert.equal(s.preparedness.next_step.n, 1);
});

test("invitation timing comes from invitations only", () => {
  const inv: InviteRow[] = [
    { sent_at: "2026-10-02T10:00:00Z", reminder_sent_at: null, completed_at: "2026-10-02T14:00:00Z" },
    { sent_at: "2026-10-02T10:00:00Z", reminder_sent_at: "2026-10-09T10:00:00Z", completed_at: "2026-10-09T12:00:00Z" },
    { sent_at: "2026-10-02T10:00:00Z", reminder_sent_at: null, completed_at: null },
  ];
  const s = summarizeSurvey(inv, []);
  assert.equal(s.participation.completed, 2);
  assert.equal(s.participation.completed_pct_of_invites, 67);
  assert.equal(s.participation.completed_after_reminder, 1);
});

// ─── Privacy: the admin analytics can't leak identity or free text ───

test("the columns read for analytics contain no free text, ids, contact info or dates", () => {
  const cols = SURVEY_STATS_COLUMNS.split(",").map((c) => c.trim());
  for (const forbidden of ["signed_with", "top_improvement", "additional_comments", "followup_contact", "application_id", "invite_id", "id", "submitted_on", "updated_at", "event_id"]) {
    assert.ok(!cols.includes(forbidden), `${forbidden} must not be read for analytics`);
  }
});

test("output contains no free text or identifiers even if rows carry them", () => {
  const poisoned = {
    ...contacted({ meetings_count: 1, outcomes: ["meeting"] }),
    signed_with: "XYZ Talent", top_improvement: "My daughter Chloe met XYZ on Tuesday",
    additional_comments: "chloe@example.com", followup_contact: "chloe@example.com",
    application_id: "app-123", invite_id: "inv-456", submitted_on: "2026-10-02",
  } as unknown as ResponseRow;
  const out = JSON.stringify(summarizeSurvey([], [poisoned, poisoned, poisoned]));
  for (const needle of ["XYZ", "Chloe", "chloe", "app-123", "inv-456", "2026-10-02", "followup"]) {
    assert.ok(!out.includes(needle), `output leaked ${needle}`);
  }
});
