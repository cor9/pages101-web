import { z } from "zod";
import type { Plan } from "@/lib/types";

export const AUDITION_PROJECT_TYPES = [
  "film",
  "tv",
  "commercial",
  "theater",
  "voiceover",
  "industrial",
  "student_film",
  "new_media",
  "print",
  "other"
] as const;

export const AUDITION_ROLE_SIZES = [
  "series_regular",
  "recurring",
  "guest_star",
  "co_star",
  "lead",
  "supporting",
  "principal",
  "featured",
  "background",
  "ensemble",
  "other"
] as const;

export const AUDITION_FORMATS = [
  "self_tape",
  "in_person",
  "virtual"
] as const;

export const AUDITION_STAGES = [
  "initial",
  "callback",
  "producer_session",
  "chemistry_read",
  "work_session",
  "final_callback",
  "network_test"
] as const;

export const AUDITION_OUTCOMES = [
  "pending",
  "callback",
  "avail_check",
  "booked",
  "released",
  "no_word"
] as const;

export const AUDITION_RECEIVED_FROM = [
  "self_submit",
  "agency",
  "management",
  "cd_direct",
  "other"
] as const;

export type AuditionProjectType = (typeof AUDITION_PROJECT_TYPES)[number];
export type AuditionRoleSize = (typeof AUDITION_ROLE_SIZES)[number];
export type AuditionFormat = (typeof AUDITION_FORMATS)[number];
export type AuditionStage = (typeof AUDITION_STAGES)[number];
export type AuditionOutcome = (typeof AUDITION_OUTCOMES)[number];
export type AuditionReceivedFrom = (typeof AUDITION_RECEIVED_FROM)[number];

export type AuditionRecord = {
  id: string;
  user_id: string;
  page_id: string;
  project: string;
  role: string | null;
  casting_contact: string | null;
  project_type: AuditionProjectType | null;
  role_size: AuditionRoleSize | null;
  audition_date: string | null;
  format: AuditionFormat | null;
  audition_stage: AuditionStage | null;
  outcome: AuditionOutcome | null;
  received_from: AuditionReceivedFrom | null;
  received_from_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  performer_name: string;
};

export type CareerTrackerPerformer = {
  id: string;
  display_name: string;
  updated_at: string;
};

export type CareerTrackerSubscription = {
  plan: Plan;
  status: string | null;
  current_period_end: string | null;
} | null;

export type CareerTrackerResponse = {
  auditions: AuditionRecord[];
  performers: CareerTrackerPerformer[];
  subscription: CareerTrackerSubscription;
};

export type AuditionStats = {
  auditions: number;
  callbacks: number;
  availChecks: number;
  bookings: number;
  callbackRate: number;
  bookingRate: number;
};

export const AUDITION_PROJECT_TYPE_LABELS: Record<AuditionProjectType, string> = {
  film: "Film",
  tv: "TV",
  commercial: "Commercial",
  theater: "Theater",
  voiceover: "Voiceover",
  industrial: "Industrial",
  student_film: "Student Film",
  new_media: "New Media",
  print: "Print",
  other: "Other"
};

export const AUDITION_ROLE_SIZE_LABELS: Record<AuditionRoleSize, string> = {
  series_regular: "Series Regular",
  recurring: "Recurring",
  guest_star: "Guest Star",
  co_star: "Co-Star",
  lead: "Lead",
  supporting: "Supporting",
  principal: "Principal",
  featured: "Featured",
  background: "Background",
  ensemble: "Ensemble",
  other: "Other"
};

export const AUDITION_FORMAT_LABELS: Record<AuditionFormat, string> = {
  self_tape: "Self Tape",
  in_person: "In Person",
  virtual: "Virtual"
};

export const AUDITION_STAGE_LABELS: Record<AuditionStage, string> = {
  initial: "Initial",
  callback: "Callback",
  producer_session: "Producer Session",
  chemistry_read: "Chemistry Read",
  work_session: "Work Session",
  final_callback: "Final Callback",
  network_test: "Network Test"
};

export const AUDITION_OUTCOME_LABELS: Record<AuditionOutcome, string> = {
  pending: "Pending",
  callback: "Callback",
  avail_check: "Avail Check",
  booked: "Booked",
  released: "Released",
  no_word: "No Word"
};

export const AUDITION_RECEIVED_FROM_LABELS: Record<AuditionReceivedFrom, string> = {
  self_submit: "Self Submit",
  agency: "Agency",
  management: "Management",
  cd_direct: "CD Direct",
  other: "Other"
};

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      return value.length > 0 ? value : null;
    });
}

function optionalEnum<const TValues extends readonly [string, ...string[]]>(values: TValues) {
  return z
    .preprocess((value) => (value === "" ? null : value), z.enum(values).optional().nullable())
    .transform((value) => value ?? null);
}

const auditionDateSchema = z
  .preprocess((value) => (value === "" ? null : value), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable())
  .transform((value) => value ?? null);

export const auditionPayloadSchema = z.object({
  page_id: z.string().uuid(),
  project: z.string().trim().min(1, "Project is required.").max(160),
  role: optionalTrimmedString(160),
  casting_contact: optionalTrimmedString(160),
  project_type: optionalEnum(AUDITION_PROJECT_TYPES),
  role_size: optionalEnum(AUDITION_ROLE_SIZES),
  audition_date: auditionDateSchema,
  format: optionalEnum(AUDITION_FORMATS),
  audition_stage: optionalEnum(AUDITION_STAGES),
  outcome: optionalEnum(AUDITION_OUTCOMES),
  received_from: optionalEnum(AUDITION_RECEIVED_FROM),
  received_from_detail: optionalTrimmedString(160),
  notes: optionalTrimmedString(4000)
});

export type AuditionPayload = z.infer<typeof auditionPayloadSchema>;

export function isActivePlusSubscription(subscription: CareerTrackerSubscription) {
  return subscription?.plan === "plus" && (subscription.status === "active" || subscription.status === "trialing");
}

export function sortAuditionsNewestFirst(auditions: AuditionRecord[]) {
  return [...auditions].sort((left, right) => {
    const leftDate = left.audition_date ? Date.parse(left.audition_date) : 0;
    const rightDate = right.audition_date ? Date.parse(right.audition_date) : 0;

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}

export function calculateCurrentYearStats(auditions: AuditionRecord[], year = new Date().getFullYear()): AuditionStats {
  const currentYearAuditions = auditions.filter((audition) => audition.audition_date?.startsWith(`${year}-`));
  const auditionsCount = currentYearAuditions.length;
  const callbacks = currentYearAuditions.filter((audition) => audition.outcome === "callback").length;
  const availChecks = currentYearAuditions.filter((audition) => audition.outcome === "avail_check").length;
  const bookings = currentYearAuditions.filter((audition) => audition.outcome === "booked").length;

  return {
    auditions: auditionsCount,
    callbacks,
    availChecks,
    bookings,
    callbackRate: auditionsCount > 0 ? callbacks / auditionsCount : 0,
    bookingRate: auditionsCount > 0 ? bookings / auditionsCount : 0
  };
}

export function isPrep101Eligible(audition: Pick<AuditionRecord, "audition_date" | "outcome">, now = new Date()) {
  if (audition.outcome !== "pending" || !audition.audition_date) {
    return false;
  }

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const auditionDate = new Date(`${audition.audition_date}T00:00:00Z`);
  const diffMs = auditionDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= 7;
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function buildNotesPreview(notes: string | null, limit = 90) {
  if (!notes) {
    return "—";
  }

  const normalized = notes.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}
