import { z } from "zod";

// ─── Option lists (values are what gets stored; labels are what parents see) ─

export const PRIOR_REP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "agent_only", label: "Agent only" },
  { value: "manager_only", label: "Manager only" },
  { value: "both", label: "Both agent and manager" },
] as const;

export const CONTACTED_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "I'm not sure" },
] as const;

export const REP_COUNT_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5_plus", label: "5+" },
  { value: "unsure", label: "I'm not sure" },
] as const;

export const OUTCOME_OPTIONS = [
  { value: "more_materials", label: "Requested additional materials/photos" },
  { value: "more_selftape", label: "Requested an additional self-tape" },
  { value: "meeting", label: "Phone/Zoom/in-person meeting" },
  { value: "stay_in_touch", label: "Asked to stay in touch" },
  { value: "offer", label: "Offer of representation" },
  { value: "signed", label: "Signed with a representative" },
  { value: "other", label: "Something else" },
  { value: "nothing_yet", label: "Nothing further yet" },
] as const;

// Stored as integers. 4 means "4 or more" for meetings; 3 means "3 or more" for offers.
export const MEETING_OPTIONS = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4+" },
] as const;

export const OFFER_OPTIONS = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3+" },
] as const;

export const PREPARED_SCALE = [
  { value: 1, label: "1", detail: "Not prepared" },
  { value: 2, label: "2", detail: "Slightly prepared" },
  { value: 3, label: "3", detail: "Fairly prepared" },
  { value: 4, label: "4", detail: "Well prepared" },
  { value: 5, label: "5", detail: "Extremely prepared" },
] as const;

export const SUPPORT_GAP_OPTIONS = [
  { value: "knowing_ready", label: "Knowing whether my actor was ready for representation" },
  { value: "headshots_materials", label: "Choosing strong headshots and materials" },
  { value: "acting_sample", label: "Choosing or creating the acting sample" },
  { value: "what_reps_want", label: "Understanding what representatives are looking for" },
  { value: "when_rep_contacts", label: "Knowing what to do when a representative contacted us" },
  { value: "rep_meeting", label: "Preparing for a representative meeting" },
  { value: "questions_evaluate", label: "Knowing what questions to ask or how to evaluate a rep" },
  { value: "contracts_offers", label: "Understanding contracts or comparing offers" },
  { value: "following_up", label: "Knowing how/when to follow up" },
  { value: "well_prepared", label: "I felt well prepared" },
  { value: "other", label: "Other" },
] as const;

export const SHARE_CONSENT_OPTIONS = [
  { value: "first_names", label: "Yes, with our names" },
  { value: "anonymous", label: "Yes, anonymously" },
  { value: "ask_first", label: "Ask me first" },
  { value: "no", label: "No" },
] as const;

// Anonymous respondents can't be named or asked first (we have no way to reach them).
export const ANON_SHARE_VALUES = ["anonymous", "no"] as const;

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

// ─── Submission schema ───────────────────────────────────────────────────────
// The same rules run in the browser (to guide the parent) and on the server
// (the only copy that counts). "Unsure" is handled like "No": the detailed
// rep-response questions are only asked when contact was definite.

const trimmed = (max: number) => z.string().trim().max(max);

export const surveySchema = z
  .object({
    is_anonymous: z.boolean(),
    // Anonymous respondents may volunteer contact info. Doing so makes the
    // response named: the server links it to their submission.
    followup_contact: trimmed(254).optional(),
    prior_representation: z.enum(values(PRIOR_REP_OPTIONS)),
    reps_contacted: z.enum(values(CONTACTED_OPTIONS)),
    rep_contact_count: z.enum(values(REP_COUNT_OPTIONS)).optional(),
    outcomes: z.array(z.enum(values(OUTCOME_OPTIONS))).max(OUTCOME_OPTIONS.length).default([]),
    meetings_count: z.number().int().min(0).max(4).optional(),
    offers_count: z.number().int().min(0).max(3).optional(),
    signed_with: trimmed(200).optional(),
    prepared_submission: z.number().int().min(1).max(5),
    prepared_next_step: z.number().int().min(1).max(5).optional(),
    support_gaps: z.array(z.enum(values(SUPPORT_GAP_OPTIONS))).max(SUPPORT_GAP_OPTIONS.length).default([]),
    top_improvement: trimmed(4000).optional(),
    additional_comments: trimmed(4000).optional(),
    share_consent: z.enum(values(SHARE_CONSENT_OPTIONS)),
    // Honeypot: real people never fill this in.
    website: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    // An anonymous response that includes contact info is not anonymous.
    const stillAnonymous = v.is_anonymous && !v.followup_contact;
    if (stillAnonymous && !(ANON_SHARE_VALUES as readonly string[]).includes(v.share_consent)) {
      issue("share_consent", "Anonymous responses can only be quoted anonymously, or not at all.");
    }

    if (v.reps_contacted === "yes") {
      if (v.rep_contact_count === undefined) issue("rep_contact_count", "Please tell us how many different agents or managers contacted you.");
      if (v.outcomes.length === 0) issue("outcomes", "Please select what resulted from that interest.");
      if (v.meetings_count === undefined) issue("meetings_count", "Please tell us how many meetings resulted.");
      if (v.offers_count === undefined) issue("offers_count", "Please tell us how many offers resulted.");
      if (v.prepared_next_step === undefined) issue("prepared_next_step", "Please rate how prepared you felt for the next step after a representative contacted you.");
    }
    if (v.outcomes.includes("nothing_yet") && v.outcomes.length > 1) {
      issue("outcomes", "\"Nothing further yet\" can't be combined with other results.");
    }
    if (v.support_gaps.length === 0) {
      issue("support_gaps", "Please select where we could have supported you better, or \"I felt well prepared\".");
    }
    if (v.support_gaps.includes("well_prepared") && v.support_gaps.length > 1) {
      issue("support_gaps", "\"I felt well prepared\" can't be combined with other gaps.");
    }
  });

export type SurveyInput = z.infer<typeof surveySchema>;

// What the page needs to know about a personal survey link.
export type SurveyLinkInfo = {
  event: { id: string; name: string };
  actor_name: string;
  // true once the family has finished. For a named response `existing` carries
  // the saved answers so they can be updated; anonymous ones can't be edited.
  completed: boolean;
  existing: Partial<SurveyInput> | null;
};
