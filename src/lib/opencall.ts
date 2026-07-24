import { z } from "zod";

// ─── Core types ──────────────────────────────────────────────────────────────

export type HeadshotEntry = {
  type: "commercial" | "theatrical" | "other";
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
  has_current_rep: boolean;
  current_rep_name: string | null;
  rep_context: string | null;
  seeking: string[];
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

export const SEEKING_OPTIONS = [
  { value: "theatrical", label: "Theatrical (Film & TV)" },
  { value: "commercial", label: "Commercial" },
  { value: "voiceover", label: "Voiceover" },
  { value: "print", label: "Print / Modeling" },
  { value: "musical_theater", label: "Musical Theater" },
  { value: "hosting", label: "Hosting / MCing" },
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
  has_current_rep: z.boolean().optional(),
  current_rep_name: z.string().max(160).nullish(),
  rep_context: z.string().max(2000).nullish(),
  seeking: z.array(z.string()).optional(),
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
