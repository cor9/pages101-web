"use client";

import { REPRESENTATION_TYPE_OPTIONS, PRONOUN_OPTIONS, CONSENT_COPY, getOpenCallAge, getOpenCallEligibilityError, looksLikeValidUrl } from "@/lib/opencall";
import type { HeadshotEntry, RepresentativeEntry, AdditionalLinkEntry } from "@/lib/opencall";

// ─── Shape this component reads from — a plain snapshot of the current form
//     state, typed loosely enough to cover both mid-edit drafts and the
//     server's OpenCallApplication shape. ─────────────────────────────────

export type ReviewSnapshot = {
  actor_name: string;
  birth_year: string;
  birth_month: string;
  gender: string;
  pronouns: string;
  ethnicity: string[];
  city: string;
  state: string;
  country: string;
  local_hire_cities: string;
  union_status: string;
  coogan_status: string;
  work_permit: string;
  passport: boolean;
  has_current_rep: boolean | null;
  representatives: RepresentativeEntry[];
  seeking_representation: string[];
  representation_notes: string;
  casting_platforms: string[];
  casting_profile_url_0: string;
  casting_profile_url_1: string;
  headshots: HeadshotEntry[];
  additional_links: AdditionalLinkEntry[];
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  resume_url: string;
  slate_url: string;
  reel_url: string;
  other_video_url: string;
  supplemental_notes: string;
};

type ConsentState = {
  guardian_consent: boolean;
  reviewer_visibility_consent: boolean;
  contact_consent: boolean;
  anonymized_results_consent: boolean;
};

type Props = {
  form: ReviewSnapshot;
  missing: string[];
  consents: ConsentState;
  setConsents: React.Dispatch<React.SetStateAction<ConsentState>>;
  onBackToEdit: () => void;
  onSubmit: () => void;
  submitStatus: "idle" | "submitting" | "submitted" | "error";
  submitError: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  editable: boolean;
  onWithdraw: () => void;
  withdrawing: boolean;
  readOnly?: boolean;
};

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  REPRESENTATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const PRONOUN_LABELS: Record<string, string> = Object.fromEntries(
  PRONOUN_OPTIONS.map((o) => [o.value, o.label])
);

const UNION_LABELS: Record<string, string> = {
  non_union: "Non-Union",
  sag_eligible: "SAG-Eligible",
  sag_member: "SAG-AFTRA Member",
};

const LOOKUP_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_required: "Not Required",
};

const cardStyle: React.CSSProperties = {
  background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)",
  padding: "24px 28px", marginBottom: 18,
};
const rowLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--ink-soft)", marginBottom: 4,
};
const rowValueStyle: React.CSSProperties = { fontSize: "0.95rem", color: "var(--ink)", marginBottom: 14 };
const linkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, color: "var(--marquee)",
  fontWeight: 700, fontSize: "0.875rem", textDecoration: "none", marginRight: 16,
};
const warnStyle: React.CSSProperties = { color: "#c62b1c", fontSize: "0.8rem", marginLeft: 8 };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div style={rowLabelStyle}>{label}</div>
      <div style={rowValueStyle}>{value}</div>
    </div>
  );
}

function LinkField({ label, url }: { label: string; url: string }) {
  if (!url?.trim()) return null;
  const valid = looksLikeValidUrl(url);
  return (
    <div style={{ marginBottom: 10 }}>
      {valid ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{label} ↗</a>
      ) : (
        <span style={{ ...linkStyle, color: "var(--ink-soft)" }}>{label}: {url}</span>
      )}
      {!valid && <span style={warnStyle}>⚠ Link format looks invalid</span>}
    </div>
  );
}

export function ApplicationReview({
  form, missing, consents, setConsents, onBackToEdit, onSubmit,
  submitStatus, submitError, isSubmitted, submittedAt, editable, onWithdraw, withdrawing, readOnly,
}: Props) {
  const age = getOpenCallAge(parseInt(form.birth_month, 10), parseInt(form.birth_year, 10));
  const eligibilityError = getOpenCallEligibilityError(parseInt(form.birth_month, 10), parseInt(form.birth_year, 10));
  const location = [form.city, form.state].filter(Boolean).join(", ") + (form.country && form.country !== "US" ? `, ${form.country}` : "");
  const representationLine = form.has_current_rep === null ? "Not yet answered" : form.has_current_rep ? "Yes" : "No";
  const seekingLabels = form.seeking_representation.map((v) => TYPE_LABELS[v] ?? v).join(", ");
  const consentsComplete = consents.guardian_consent && consents.reviewer_visibility_consent && consents.contact_consent;
  const canSubmit = missing.length === 0 && !eligibilityError && consentsComplete && submitStatus !== "submitting";

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "1.4rem", margin: "0 0 4px" }}>
          {form.actor_name || "Unnamed performer"}
        </h2>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.875rem", margin: 0 }}>
          This is a representative-style preview — it shows the application the way reviewers will see it.
        </p>
      </div>

      {/* Headshots */}
      {form.headshots.length > 0 && (
        <div style={cardStyle}>
          <div style={rowLabelStyle}>Headshots</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            {form.headshots.map((h, i) => (
              <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" title={`View ${h.type} headshot full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded URL from Supabase storage */}
                <img src={h.url} alt={`${h.type} headshot`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--hairline)" }} />
                <div style={{ fontSize: "0.75rem", textAlign: "center", marginTop: 4, color: "var(--ink-soft)" }}>{h.type}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Identity, location, union */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Field label="Age" value={age !== null ? age : null} />
          <Field label="Gender" value={form.gender} />
          <Field label="Pronouns" value={form.pronouns ? (PRONOUN_LABELS[form.pronouns] ?? form.pronouns) : null} />
          <Field label="Playable Ethnicities" value={form.ethnicity.length ? form.ethnicity.join(", ") : null} />
          <Field label="Location" value={location.trim().replace(/^,\s*/, "") || null} />
          <Field label="Local Hire Cities" value={form.local_hire_cities || null} />
          <Field label="Union Status" value={form.union_status ? (UNION_LABELS[form.union_status] ?? form.union_status) : null} />
          <Field label="Coogan Account" value={form.coogan_status ? (LOOKUP_LABELS[form.coogan_status] ?? form.coogan_status) : null} />
          <Field label="Work Permit" value={form.work_permit ? (LOOKUP_LABELS[form.work_permit] ?? form.work_permit) : null} />
          <Field label="Passport" value={form.passport ? "Yes" : null} />
        </div>
      </div>

      {/* Representation — three distinct concepts, never merged */}
      <div style={cardStyle}>
        <Field label="Current Representation" value={representationLine} />
        {form.has_current_rep && form.representatives.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={rowLabelStyle}>Representative(s)</div>
            {form.representatives.map((r, i) => (
              <div key={i} style={{ fontSize: "0.95rem", color: "var(--ink)", marginBottom: 4 }}>
                {r.name || "Unnamed"} — {TYPE_LABELS[r.type] ?? r.type}{r.market ? ` (${r.market})` : ""}
              </div>
            ))}
          </div>
        )}
        <Field label="Representation Sought" value={seekingLabels || null} />
        <Field label="Representation Notes" value={form.representation_notes || null} />
      </div>

      {/* Materials */}
      <div style={cardStyle}>
        <div style={rowLabelStyle}>Materials</div>
        <div style={{ marginTop: 10 }}>
          <LinkField label="Open Résumé" url={form.resume_url} />
          <LinkField label="Watch Personality Slate" url={form.slate_url} />
          <LinkField label="Watch Acting Sample" url={form.reel_url} />
          <LinkField label="Watch Special Skill Video" url={form.other_video_url} />
          <LinkField label="Open Casting Profile" url={form.casting_profile_url_0} />
          {form.casting_profile_url_1 && <LinkField label="Open Casting Profile (2)" url={form.casting_profile_url_1} />}
        </div>
        <Field label="Casting Platforms" value={form.casting_platforms.length ? form.casting_platforms.join(", ") : null} />
        {form.additional_links.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={rowLabelStyle}>Additional Links</div>
            <div style={{ marginTop: 8 }}>
              {form.additional_links.filter((l) => l.url?.trim()).map((l, i) => (
                <LinkField key={i} label={l.label?.trim() || "Link"} url={l.url} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Field label="Supplemental Notes" value={form.supplemental_notes || null} />

      {/* Consent + submit, or post-submission confirmation */}
      {isSubmitted ? (
        <div style={{ padding: "20px 24px", marginTop: 8, background: "#e6f4ed", borderRadius: "var(--radius)", color: "#1a7a4a" }}>
          <strong>Submitted{submittedAt ? ` on ${new Date(submittedAt).toLocaleDateString("en-US")}` : ""}.</strong> This is exactly what was sent to reviewers.
        </div>
      ) : !readOnly ? (
        <div style={cardStyle}>
          <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 16px" }}>Consent & Submit</h3>

          {missing.length > 0 && (
            <div style={{ padding: "14px 16px", background: "#fff8e6", border: "1px solid #f0d98c", borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 6 }}>Before you can submit:</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.875rem", color: "var(--ink-soft)" }}>
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {eligibilityError && (
            <div style={{ padding: "14px 16px", background: "#fff0ee", border: "1px solid #ffccc7", borderRadius: 6, color: "#a52a20", fontSize: "0.875rem", marginBottom: 16 }}>
              {eligibilityError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            {(["guardian_consent", "reviewer_visibility_consent", "contact_consent"] as const).map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem", color: "var(--ink)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consents[key]}
                  onChange={(e) => setConsents((prev) => ({ ...prev, [key]: e.target.checked }))}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span><strong>Required: </strong>{CONSENT_COPY[key].text}</span>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem", color: "var(--ink-soft)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consents.anonymized_results_consent}
                onChange={(e) => setConsents((prev) => ({ ...prev, anonymized_results_consent: e.target.checked }))}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span><strong>Optional: </strong>{CONSENT_COPY.anonymized_results_consent.text}</span>
            </label>
          </div>

          {submitError && (
            <div style={{ padding: "12px 16px", background: "#fff0ee", border: "1px solid #ffccc7", borderRadius: 6, color: "#c62b1c", fontSize: "0.875rem", marginBottom: 16 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onBackToEdit}
              style={{ padding: "12px 20px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              style={{ padding: "12px 28px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "0.95rem", cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.5 }}
            >
              {submitStatus === "submitting" ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </div>
      ) : null}

      {isSubmitted && editable && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            onClick={onBackToEdit}
            style={{ padding: "12px 20px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}
          >
            Edit Application
          </button>
          <button
            type="button"
            onClick={onWithdraw}
            disabled={withdrawing}
            style={{ padding: "12px 20px", background: "var(--paper)", color: "var(--ink-soft)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", opacity: withdrawing ? 0.6 : 1 }}
          >
            {withdrawing ? "Withdrawing…" : "Withdraw Application"}
          </button>
        </div>
      )}
    </div>
  );
}
