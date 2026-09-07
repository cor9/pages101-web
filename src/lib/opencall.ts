import { z } from "zod";

// ─── Core types ──────────────────────────────────────────────────────────────

export type HeadshotEntry = {
  type: "commercial" | "theatrical" | "other";
  url: string;
};

export type RepresentativeEntry = {
  name: string;
  type: string;
  market: string | null;
};

export type AdditionalLinkEntry = {
  label: string;
  url: string;
};

export type OpenCallEvent = {
  id: string;
  year: number;
  name: string;
  submits_open: string;
  submits_close: string;
  review_close: string;
  status: "draft" | "open" | "reviewing" | "closed";
  created_at: string;
  updated_at: string;
};

export type OpenCallApplication = {
  id: string;
  event_id: string;
  user_id: string;
  source_page_id: string | null;
  actor_name: string | null;
  birth_year: number | null;
  birth_month: number | null;
  gender: string | null;
  ethnicity: string[];
  city: string | null;
  state: string | null;
  country: string;
  local_hire_cities: string[] | null;
  union_status: "non_union" | "sag_eligible" | "sag_member" | null;
  coogan_status: "yes" | "no" | "not_required" | null;
  work_permit: "yes" | "no" | "not_required" | null;
  passport: boolean;
  has_current_rep: boolean | null;
  representatives: RepresentativeEntry[];
  seeking_representation: string[];
  representation_notes: string | null;
  pronouns: string | null;
  additional_links: AdditionalLinkEntry[];
  casting_platforms: string[];
  casting_profile_urls: string[];
  headshots: HeadshotEntry[];
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  resume_url: string | null;
  slate_url: string | null;
  reel_url: string | null;
  other_video_url: string | null;
  supplemental_notes: string | null;
  status: "draft" | "submitted" | "withdrawn";
  submitted_at: string | null;
  withdrawn_at: string | null;
  reviewed_at: string | null;
  consents: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ─── Consent copy (server side computes the sha256 hash) ─────────────────────

export const CONSENT_COPY = {
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
  anonymized_results_consent: {
    version: "2026-07-23",
    text: "I consent to anonymized data from this submission being included in aggregate reporting about this Open Call.",
  },
} as const;

export type ConsentKey = keyof typeof CONSENT_COPY;

// ─── Form option lists ────────────────────────────────────────────────────────

// Single source of truth for representation-type vocabulary — used both for
// each representative's "Type of Representation" and for "Representation
// Sought". theatrical_agent (TV & Film) and theatre_agent (stage) are
// deliberately distinct categories, not interchangeable.
export const REPRESENTATION_TYPE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "regional_agent", label: "Regional Agent" },
  { value: "theatrical_agent", label: "Theatrical Agent — Television & Film" },
  { value: "commercial_agent", label: "Commercial Agent" },
  { value: "voiceover_agent", label: "Voiceover Agent" },
  { value: "theatre_agent", label: "Theatre (Stage) Agent" },
  { value: "print_agent", label: "Print Agent" },
  { value: "hosting_agent", label: "Hosting Agent" },
  { value: "across_the_board", label: "Across-the-Board Agency Representation" },
] as const;

export type RepresentationTypeValue = (typeof REPRESENTATION_TYPE_OPTIONS)[number]["value"];

// zod's z.enum() needs a literal tuple, not a mapped array — kept in sync
// with REPRESENTATION_TYPE_OPTIONS above by construction.
const REPRESENTATION_TYPE_VALUES = REPRESENTATION_TYPE_OPTIONS.map((o) => o.value) as [
  RepresentationTypeValue,
  ...RepresentationTypeValue[]
];

// "Prefer to self-describe" is a UI-only sentinel — never stored. Selecting
// it reveals a text field, and that free text becomes the stored `gender`
// value directly (the column stays plain text, no schema change).
export const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Non-binary", label: "Non-binary" },
] as const;
export const GENDER_SELF_DESCRIBE = "__self_describe__";

export const PRONOUN_OPTIONS = [
  { value: "he_him", label: "He / Him" },
  { value: "she_her", label: "She / Her" },
  { value: "they_them", label: "They / Them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const ETHNICITY_OPTIONS = [
  { value: "american_indian_alaska_native", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black_african_american", label: "Black or African American" },
  { value: "hispanic_latino", label: "Hispanic or Latino" },
  { value: "middle_eastern_north_african", label: "Middle Eastern or North African" },
  { value: "native_hawaiian_pacific_islander", label: "Native Hawaiian or Pacific Islander" },
  { value: "white", label: "White" },
  { value: "multiracial", label: "Multiracial" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const CASTING_PLATFORM_OPTIONS = [
  { value: "actors_access", label: "Actors Access" },
  { value: "casting_networks", label: "Casting Networks" },
  { value: "other", label: "Other" },
] as const;

export const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

// The Open Call accepts children and young adults who can play the published
// 6–21 casting range. Actual eligibility is 6–24 at submission time.
export const OPEN_CALL_MIN_AGE = 6;
export const OPEN_CALL_MAX_AGE = 24;

export function getOpenCallAge(birthMonth: number | null | undefined, birthYear: number | null | undefined): number | null {
  if (!birthMonth || !birthYear || birthMonth < 1 || birthMonth > 12) return null;
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < birthMonth) age -= 1;
  return age >= 0 && age <= 100 ? age : null;
}

export function getOpenCallEligibilityError(birthMonth: number | null | undefined, birthYear: number | null | undefined): string | null {
  const age = getOpenCallAge(birthMonth, birthYear);
  if (age === null) return "Enter a valid birth month and year.";
  if (age < OPEN_CALL_MIN_AGE || age > OPEN_CALL_MAX_AGE) {
    return `This Open Call is for performers ages ${OPEN_CALL_MIN_AGE}–${OPEN_CALL_MAX_AGE} at the time of submission.`;
  }
  return null;
}

export const draftSaveSchema = z.object({
  actor_name: z.string().max(120).nullish(),
  birth_year: z.number().int().min(1990).max(currentYear).nullish(),
  birth_month: z.number().int().min(1).max(12).nullish(),
  gender: z.string().max(40).nullish(),
  ethnicity: z.array(z.string()).optional(),
  city: z.string().max(120).nullish(),
  state: z.string().max(120).nullish(),
  country: z.string().max(10).optional(),
  local_hire_cities: z.array(z.string()).nullish(),
  union_status: z.enum(["non_union", "sag_eligible", "sag_member"]).nullish(),
  coogan_status: z.enum(["yes", "no", "not_required"]).nullish(),
  work_permit: z.enum(["yes", "no", "not_required"]).nullish(),
  passport: z.boolean().optional(),
  has_current_rep: z.boolean().nullish(),
  representatives: z
    .array(
      z.object({
        name: z.string().max(160),
        type: z.enum(REPRESENTATION_TYPE_VALUES),
        market: z.string().max(120).nullish(),
      })
    )
    .max(20)
    .optional(),
  seeking_representation: z.array(z.enum(REPRESENTATION_TYPE_VALUES)).optional(),
  representation_notes: z.string().max(2000).nullish(),
  pronouns: z.string().max(40).nullish(),
  additional_links: z
    .array(z.object({ label: z.string().max(80), url: z.string().max(500) }))
    .max(10)
    .optional(),
  casting_platforms: z.array(z.enum(["actors_access", "casting_networks", "other"])).optional(),
  casting_profile_urls: z.array(z.string().trim()).max(2).optional(),
  headshots: z
    .array(z.object({ type: z.enum(["commercial", "theatrical", "other"]), url: z.string() }))
    .optional(),
  guardian_name: z.string().max(120).nullish(),
  guardian_email: z.string().max(254).nullish(),
  guardian_phone: z.string().max(40).nullish(),
  resume_url: z.string().nullish(),
  slate_url: z.string().nullish(),
  reel_url: z.string().nullish(),
  other_video_url: z.string().nullish(),
  supplemental_notes: z.string().max(4000).nullish(),
});

export type DraftSavePayload = z.infer<typeof draftSaveSchema>;

export const submitConsentSchema = z.object({
  guardian_consent: z.literal(true, {
    errorMap: () => ({ message: "Guardian consent is required to submit." }),
  }),
  reviewer_visibility_consent: z.literal(true, {
    errorMap: () => ({ message: "Reviewer visibility consent is required to submit." }),
  }),
  contact_consent: z.literal(true, {
    errorMap: () => ({ message: "Contact consent is required to submit." }),
  }),
  anonymized_results_consent: z.boolean().optional(),
});

export type SubmitConsentPayload = z.infer<typeof submitConsentSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isWindowOpen(event: OpenCallEvent): boolean {
  const now = Date.now();
  return (
    event.status === "open" &&
    now >= new Date(event.submits_open).getTime() &&
    now < new Date(event.submits_close).getTime()
  );
}

export function formatDeadline(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export function applicationStatusLabel(status: OpenCallApplication["status"]): string {
  switch (status) {
    case "draft": return "Draft";
    case "submitted": return "Submitted";
    case "withdrawn": return "Withdrawn";
  }
}

// ─── Submission completeness ──────────────────────────────────────────────────
// Single source of truth for "is this application ready to submit" — used by
// both the submit route (server-authoritative) and the review screen (client
// display), so the two can't drift apart.

type CompletenessInput = Pick<
  OpenCallApplication,
  | "actor_name" | "guardian_name" | "guardian_email" | "guardian_phone"
  | "birth_year" | "birth_month" | "gender" | "city" | "state" | "country"
  | "union_status" | "coogan_status" | "work_permit"
  | "has_current_rep" | "representatives" | "seeking_representation"
  | "casting_profile_urls" | "headshots" | "resume_url" | "slate_url"
>;

export function getMissingApplicationFields(app: CompletenessInput): string[] {
  const missing: string[] = [];
  const validTypes = new Set<string>(REPRESENTATION_TYPE_OPTIONS.map((o) => o.value));

  if (!app.actor_name?.trim()) missing.push("Performer name");
  if (!app.guardian_name?.trim()) missing.push("Guardian name");
  if (!app.guardian_email?.trim()) missing.push("Guardian email");
  if (!app.guardian_phone?.trim()) missing.push("Guardian phone");
  if (!app.birth_year) missing.push("Birth year");
  if (!app.birth_month) missing.push("Birth month");
  if (!app.gender?.trim()) missing.push("Gender");
  if (!app.city?.trim()) missing.push("City");
  if (!app.state?.trim()) missing.push("State");
  if (!app.country?.trim()) missing.push("Country");
  if (!app.union_status) missing.push("Union status");
  if (!app.coogan_status) missing.push("Coogan status");
  if (!app.work_permit) missing.push("Work permit status");

  if (app.has_current_rep === null || app.has_current_rep === undefined) {
    missing.push("Are you currently represented?");
  } else if (app.has_current_rep) {
    const reps = app.representatives ?? [];
    const hasCompleteEntry = reps.some((r) => r.name?.trim() && validTypes.has(r.type));
    if (!hasCompleteEntry) missing.push("At least one current representative (name and type)");
  }

  if (!app.seeking_representation?.length) missing.push("Representation Sought (at least one)");
  if (!app.casting_profile_urls?.length) missing.push("At least one casting profile URL");
  if (!Array.isArray(app.headshots) || app.headshots.length < 2) missing.push("At least two headshots");
  if (!app.resume_url?.trim()) missing.push("Resume");
  if (!app.slate_url?.trim()) missing.push("Personality Slate video");

  return missing;
}

// Lightweight "does this look like a working link" check — format only, not
// a live reachability probe (fetching arbitrary family-supplied URLs
// server-side to test they load has SSRF exposure and isn't needed here).
export function looksLikeValidUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
