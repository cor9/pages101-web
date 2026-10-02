// Aggregate analytics for the Open Call follow-up survey.
//
// PRIVACY RULES (enforced here and by tests):
//   * Only these columns are ever read for analytics. No free text
//     (signed_with, top_improvement, additional_comments, followup_contact),
//     no ids, no dates. So nothing in the admin API can be cross-referenced
//     to an invitation or submission.
//   * Breakdowns suppress small cells: a count of 1 or 2 is shown as "<3",
//     and percentages need at least MIN_PCT_BASE respondents behind them.
//   * Invitation timing (exact timestamps) is computed from invitations only.

export const SURVEY_STATS_COLUMNS =
  "is_anonymous, prior_representation, reps_contacted, meetings_count, offers_count, outcomes, prepared_submission, prepared_next_step";

export const MIN_CELL = 3;      // counts below this (but above 0) are suppressed
export const MIN_PCT_BASE = 5;  // don't print a percentage of fewer than this many

export type InviteRow = { sent_at: string | null; reminder_sent_at: string | null; completed_at: string | null };

export type ResponseRow = {
  is_anonymous: boolean;
  prior_representation: string;
  reps_contacted: string;
  meetings_count: number | null;
  offers_count: number | null;
  outcomes: string[] | null;
  prepared_submission: number;
  prepared_next_step: number | null;
};

export type Pct = number | null; // whole percent, null when the base is too small
export type Cell = number | "<3";

export type Stage = {
  key: "respondents" | "contacted" | "meeting" | "offer" | "signed";
  label: string;
  count: number;
  of_respondents: Pct;
  of_contacted: Pct; // null for the respondents row
};

export type Conversion = { label: string; count: number; base: number; pct: Pct; base_label: string };

export type RepGroupRow = {
  key: string;
  label: string;
  respondents: Cell;
  contacted: Cell;
  meeting: Cell;
  offer: Cell;
  signed: Cell;
  contacted_pct: Pct; // of this group's respondents
  suppressed: boolean; // whole row hidden: group too small
};

export type Distribution = { n: number; avg: number | null; counts: [number, number, number, number, number] };

export type SurveySummary = {
  participation: {
    invites: number;
    sent: number;
    reminded: number;
    completed: number;
    completed_pct_of_invites: Pct;
    median_hours_to_complete: number | null;
    completed_after_reminder: number;
  };
  respondents: { total: number; named: number; anonymous: number; anonymous_pct: Pct };
  stages: Stage[];
  conversions: Conversion[];
  by_representation: RepGroupRow[];
  preparedness: { submission: Distribution; next_step: Distribution };
  totals: { meetings_min: number; offers_min: number };
};

const pct = (n: number, base: number, min = 1): Pct => (base >= min && base > 0 ? Math.round((100 * n) / base) : null);
const cell = (n: number): Cell => (n > 0 && n < MIN_CELL ? "<3" : n);

const REP_GROUPS: [string, string][] = [
  ["none", "No representation"],
  ["agent_only", "Agent only"],
  ["manager_only", "Manager only"],
  ["both", "Agent and manager"],
];

function flags(r: ResponseRow) {
  const out = r.outcomes ?? [];
  const contacted = r.reps_contacted === "yes";
  const meeting = contacted && ((r.meetings_count ?? 0) > 0 || out.includes("meeting"));
  const signed = contacted && out.includes("signed");
  // A signing implies an offer, even if the parent didn't tick both boxes.
  const offer = contacted && ((r.offers_count ?? 0) > 0 || out.includes("offer") || signed);
  return { contacted, meeting, offer, signed };
}

function distribution(values: (number | null)[]): Distribution {
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (typeof v === "number" && v >= 1 && v <= 5) {
      counts[v - 1]++;
      sum += v;
      n++;
    }
  }
  return { n, avg: n ? Math.round((10 * sum) / n) / 10 : null, counts };
}

export function summarizeSurvey(invites: InviteRow[], responses: ResponseRow[]): SurveySummary {
  // ─── Participation (invitations only) ───
  const hours = invites
    .filter((i) => i.sent_at && i.completed_at)
    .map((i) => (new Date(i.completed_at as string).getTime() - new Date(i.sent_at as string).getTime()) / 36e5)
    .sort((a, b) => a - b);
  const completed = invites.filter((i) => i.completed_at).length;

  // ─── Funnel ───
  const f = responses.map(flags);
  const total = responses.length;
  const contacted = f.filter((x) => x.contacted).length;
  const meeting = f.filter((x) => x.meeting).length;
  const offer = f.filter((x) => x.offer).length;
  const signed = f.filter((x) => x.signed).length;
  const metAndOffer = f.filter((x) => x.meeting && x.offer).length;

  const stage = (key: Stage["key"], label: string, count: number): Stage => ({
    key,
    label,
    count,
    of_respondents: pct(count, total),
    of_contacted: key === "respondents" ? null : pct(count, contacted),
  });

  // ─── By representation at submission ───
  const by_representation: RepGroupRow[] = REP_GROUPS.map(([key, label]) => {
    const idx = responses.map((r, i) => (r.prior_representation === key ? i : -1)).filter((i) => i >= 0);
    const n = idx.length;
    const c = idx.filter((i) => f[i].contacted).length;
    const row = {
      key,
      label,
      respondents: cell(n),
      contacted: cell(c),
      meeting: cell(idx.filter((i) => f[i].meeting).length),
      offer: cell(idx.filter((i) => f[i].offer).length),
      signed: cell(idx.filter((i) => f[i].signed).length),
      contacted_pct: pct(c, n, MIN_PCT_BASE),
      suppressed: n > 0 && n < MIN_CELL,
    };
    if (row.suppressed) {
      return { ...row, contacted: "<3" as Cell, meeting: "<3" as Cell, offer: "<3" as Cell, signed: "<3" as Cell, contacted_pct: null };
    }
    return row;
  });

  return {
    participation: {
      invites: invites.length,
      sent: invites.filter((i) => i.sent_at).length,
      reminded: invites.filter((i) => i.reminder_sent_at).length,
      completed,
      completed_pct_of_invites: pct(completed, invites.length),
      median_hours_to_complete: hours.length ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10 : null,
      completed_after_reminder: invites.filter(
        (i) => i.reminder_sent_at && i.completed_at && new Date(i.completed_at) > new Date(i.reminder_sent_at)
      ).length,
    },
    respondents: {
      total,
      named: responses.filter((r) => !r.is_anonymous).length,
      anonymous: responses.filter((r) => r.is_anonymous).length,
      anonymous_pct: pct(responses.filter((r) => r.is_anonymous).length, total),
    },
    stages: [
      stage("respondents", "Respondents", total),
      stage("contacted", "Heard from a rep", contacted),
      stage("meeting", "Had a meeting", meeting),
      stage("offer", "Got an offer", offer),
      stage("signed", "Signed", signed),
    ],
    conversions: [
      { label: "Heard from a rep", count: contacted, base: total, pct: pct(contacted, total), base_label: "respondents" },
      { label: "Meeting", count: meeting, base: contacted, pct: pct(meeting, contacted), base_label: "actors contacted" },
      { label: "Offer, after a meeting", count: metAndOffer, base: meeting, pct: pct(metAndOffer, meeting), base_label: "actors who met a rep" },
      { label: "Signed", count: signed, base: offer, pct: pct(signed, offer), base_label: "actors with an offer" },
    ],
    by_representation,
    preparedness: {
      submission: distribution(responses.map((r) => r.prepared_submission)),
      next_step: distribution(responses.filter((r) => r.reps_contacted === "yes").map((r) => r.prepared_next_step)),
    },
    totals: {
      meetings_min: responses.reduce((a, r) => a + (r.reps_contacted === "yes" ? r.meetings_count ?? 0 : 0), 0),
      offers_min: responses.reduce((a, r) => a + (r.reps_contacted === "yes" ? r.offers_count ?? 0 : 0), 0),
    },
  };
}
