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
  { value: 1, label: "1", detail: "Not prepared at all" },
  { value: 2, label: "2", detail: "A little unsure" },
  { value: 3, label: "3", detail: "Mostly prepared" },
  { value: 4, label: "4", detail: "Very prepared" },
  { value: 5, label: "5", detail: "Completely prepared" },
] as const;

export const SUPPORT_GAP_OPTIONS = [
  { value: "knowing_ready", label: "Knowing whether my actor was ready to seek representation" },
  { value: "headshots_materials", label: "Choosing the right headshots/materials" },
  { value: "acting_sample", label: "Choosing or creating the acting sample" },
  { value: "what_reps_want", label: "Understanding what representatives are looking for" },
  { value: "strongest_submission", label: "Creating the strongest possible submission" },
  { value: "when_rep_contacts", label: "Knowing what to do when a representative contacts us" },
  { value: "rep_meeting", label: "Preparing for a representative meeting" },
  { value: "questions_to_ask", label: "Knowing what questions to ask" },
  { value: "evaluating_rep", label: "Evaluating a representative or contract" },
  { value: "comparing_offers", label: "Comparing multiple offers" },
  { value: "following_up", label: "Following up after interest or a meeting" },
  { value: "well_prepared", label: "I felt well prepared" },
  { value: "other", label: "Other" },
] as const;

export const SHARE_CONSENT_OPTIONS = [
  { value: "first_names", label: "Yes, including our first names" },
  { value: "anonymous", label: "Yes, anonymously" },
  { value: "ask_first", label: "Please ask me first" },
  { value: "no", label: "No" },
] as const;

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

// ─── Submission schema ───────────────────────────────────────────────────────
// The same rules run in the browser (to guide the parent) and on the server
// (the only copy that counts).

const trimmed = (max: number) => z.string().trim().max(max);

export const surveySchema = z
  .object({
    is_anonymous: z.boolean(),
    actor_name: trimmed(120).optional(),
    prior_representation: z.enum(values(PRIOR_REP_OPTIONS)),
    reps_contacted: z.enum(values(CONTACTED_OPTIONS)),
    rep_contact_count: z.enum(values(REP_COUNT_OPTIONS)).optional(),
    outcomes: z.array(z.enum(values(OUTCOME_OPTIONS))).max(OUTCOME_OPTIONS.length).default([]),
    meetings_count: z.number().int().min(0).max(4).optional(),
    offers_count: z.number().int().min(0).max(3).optional(),
    signed_with: trimmed(200).optional(),
    prepared_submission: z.number().int().min(1).max(5),
    // null/undefined => "No representative contacted us"
    prepared_next_step: z.number().int().min(1).max(5).nullish(),
    support_gaps: z.array(z.enum(values(SUPPORT_GAP_OPTIONS))).max(SUPPORT_GAP_OPTIONS.length).default([]),
    top_improvement: trimmed(4000).min(1, "Please tell us the one thing you'd change."),
    additional_comments: trimmed(4000).optional(),
    share_consent: z.enum(values(SHARE_CONSENT_OPTIONS)),
    // Honeypot: real people never fill this in.
    website: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.is_anonymous && !v.actor_name) {
      ctx.addIssue({ code: "custom", path: ["actor_name"], message: "Please enter your actor's name, or choose to respond anonymously." });
    }
    if (v.is_anonymous && v.share_consent === "first_names") {
      ctx.addIssue({ code: "custom", path: ["share_consent"], message: "First names can't be shared on an anonymous response." });
    }
    if (v.reps_contacted !== "no") {
      const need = (ok: boolean, path: string, message: string) => {
        if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
      };
      need(v.rep_contact_count !== undefined, "rep_contact_count", "Please tell us how many different agents or managers contacted you.");
      need(v.outcomes.length > 0, "outcomes", "Please select what resulted from that interest.");
      need(v.meetings_count !== undefined, "meetings_count", "Please tell us how many meetings resulted.");
      need(v.offers_count !== undefined, "offers_count", "Please tell us how many offers resulted.");
      need(v.prepared_next_step !== undefined, "prepared_next_step", "Please rate how prepared you felt for the next step (or choose \"No representative contacted us\").");
    }
    if (v.outcomes.includes("nothing_yet") && v.outcomes.length > 1) {
      ctx.addIssue({ code: "custom", path: ["outcomes"], message: "\"Nothing further yet\" can't be combined with other results." });
    }
    if (v.support_gaps.length === 0) {
      ctx.addIssue({ code: "custom", path: ["support_gaps"], message: "Please select where we could have supported you better, or \"I felt well prepared\"." });
    }
    if (v.support_gaps.includes("well_prepared") && v.support_gaps.length > 1) {
      ctx.addIssue({ code: "custom", path: ["support_gaps"], message: "\"I felt well prepared\" can't be combined with other gaps." });
    }
  });

export type SurveyInput = z.infer<typeof surveySchema>;

export type SurveyEvent = { id: string; name: string; year: number; status: string };
