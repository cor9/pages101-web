"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  SEEKING_OPTIONS,
  ETHNICITY_OPTIONS,
  CASTING_PLATFORM_OPTIONS,
  MONTHS,
  CONSENT_COPY,
  formatDeadline,
  isWindowOpen,
} from "@/lib/opencall";
import type { OpenCallApplication, OpenCallEvent, HeadshotEntry } from "@/lib/opencall";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  actor_name: string;
  birth_year: string;
  birth_month: string;
  gender: string;
  ethnicity: string[];
  city: string;
  state: string;
  country: string;
  local_hire_cities: string;
  union_status: string;
  coogan_status: string;
  work_permit: string;
  passport: boolean;
  has_current_rep: boolean;
  current_rep_name: string;
  rep_context: string;
  seeking: string[];
  casting_platforms: string[];
  casting_profile_url_0: string;
  casting_profile_url_1: string;
  headshots: HeadshotEntry[];
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

function blankForm(): FormState {
  return {
    actor_name: "", birth_year: "", birth_month: "", gender: "", ethnicity: [],
    city: "", state: "", country: "US", local_hire_cities: "",
    union_status: "", coogan_status: "", work_permit: "", passport: false,
    has_current_rep: false, current_rep_name: "", rep_context: "", seeking: [],
    casting_platforms: [], casting_profile_url_0: "", casting_profile_url_1: "",
    headshots: [], guardian_name: "", guardian_email: "", guardian_phone: "",
    resume_url: "", slate_url: "", reel_url: "", other_video_url: "", supplemental_notes: "",
  };
}

function hydrate(app: OpenCallApplication): FormState {
  const urls = app.casting_profile_urls ?? [];
  return {
    actor_name: app.actor_name ?? "",
    birth_year: app.birth_year ? String(app.birth_year) : "",
    birth_month: app.birth_month ? String(app.birth_month) : "",
    gender: app.gender ?? "",
    ethnicity: app.ethnicity ?? [],
    city: app.city ?? "",
    state: app.state ?? "",
    country: app.country ?? "US",
    local_hire_cities: (app.local_hire_cities ?? []).join(", "),
    union_status: app.union_status ?? "",
    coogan_status: app.coogan_status ?? "",
    work_permit: app.work_permit ?? "",
    passport: app.passport ?? false,
    has_current_rep: app.has_current_rep ?? false,
    current_rep_name: app.current_rep_name ?? "",
    rep_context: app.rep_context ?? "",
    seeking: app.seeking ?? [],
    casting_platforms: app.casting_platforms ?? [],
    casting_profile_url_0: urls[0] ?? "",
    casting_profile_url_1: urls[1] ?? "",
    headshots: Array.isArray(app.headshots) ? (app.headshots as HeadshotEntry[]) : [],
    guardian_name: app.guardian_name ?? "",
    guardian_email: app.guardian_email ?? "",
    guardian_phone: app.guardian_phone ?? "",
    resume_url: app.resume_url ?? "",
    slate_url: app.slate_url ?? "",
    reel_url: app.reel_url ?? "",
    other_video_url: app.other_video_url ?? "",
    supplemental_notes: app.supplemental_notes ?? "",
  };
}

function toSavePayload(form: FormState): Record<string, unknown> {
  const castingUrls = [form.casting_profile_url_0, form.casting_profile_url_1]
    .map((u) => u.trim())
    .filter(Boolean);

  const localHireCities = form.local_hire_cities
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    actor_name: form.actor_name.trim() || null,
    birth_year: form.birth_year ? parseInt(form.birth_year) : null,
    birth_month: form.birth_month ? parseInt(form.birth_month) : null,
    gender: form.gender.trim() || null,
    ethnicity: form.ethnicity,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country || "US",
    local_hire_cities: localHireCities.length ? localHireCities : null,
    union_status: form.union_status || null,
    coogan_status: form.coogan_status || null,
    work_permit: form.work_permit || null,
    passport: form.passport,
    has_current_rep: form.has_current_rep,
    current_rep_name: form.current_rep_name.trim() || null,
    rep_context: form.rep_context.trim() || null,
    seeking: form.seeking,
    casting_platforms: form.casting_platforms,
    casting_profile_urls: castingUrls,
    headshots: form.headshots,
    guardian_name: form.guardian_name.trim() || null,
    guardian_email: form.guardian_email.trim() || null,
    guardian_phone: form.guardian_phone.trim() || null,
    resume_url: form.resume_url.trim() || null,
    slate_url: form.slate_url.trim() || null,
    reel_url: form.reel_url.trim() || null,
    other_video_url: form.other_video_url.trim() || null,
    supplemental_notes: form.supplemental_notes.trim() || null,
  };
}

function sanitizeFileName(name: string) {
  const s = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "file";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--hairline)", borderRadius: 6,
  fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box", background: "var(--paper)", color: "var(--ink)",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
const sectionStyle: React.CSSProperties = { padding: "32px 0", borderBottom: "1px solid var(--hairline)" };
const sectionHeadStyle: React.CSSProperties = { fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "1.5rem", color: "var(--ink)", margin: "0 0 20px" };
const fieldStyle: React.CSSProperties = { marginBottom: 18 };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 };

// ─── Page component ───────────────────────────────────────────────────────────

export default function OpenCallApplyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [app, setApp] = useState<OpenCallApplication | null>(null);
  const [event, setEvent] = useState<OpenCallEvent | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [consents, setConsents] = useState<ConsentState>({
    guardian_consent: false,
    reviewer_visibility_consent: false,
    contact_consent: false,
    anonymized_results_consent: false,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Autosave race protection
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  // Track current form snapshot for manual save recovery
  const latestFormRef = useRef<FormState | null>(null);

  const getToken = useCallback(async () => {
    if (!supabase) return "";
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, [supabase]);

  // Load application on mount
  useEffect(() => {
    if (!supabase || !id) return;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/opencall"); return; }
      setUserId(data.user.id);

      const token = await getToken();
      const [appRes, evtRes] = await Promise.all([
        fetch(`/api/opencall/applications/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/opencall/event"),
      ]);

      if (!appRes.ok) { router.push("/opencall"); return; }

      const appBody = await appRes.json() as { application?: OpenCallApplication };
      const evtBody = await evtRes.json() as { event?: OpenCallEvent };

      if (!appBody.application) { router.push("/opencall"); return; }
      if (appBody.application.user_id !== data.user.id) { router.push("/opencall"); return; }

      setApp(appBody.application);
      setForm(hydrate(appBody.application));
      setEvent(evtBody.event ?? null);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── Autosave ──────────────────────────────────────────────────────────────

  const executeSave = useCallback(async (payload: Record<string, unknown>) => {
    if (inFlightRef.current) { pendingRef.current = payload; return; }
    inFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const token = await getToken();
      const res = await fetch(`/api/opencall/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        void executeSave(next);
      }
    }
  }, [id, getToken]);

  function scheduleSave(nextForm: FormState) {
    latestFormRef.current = nextForm;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void executeSave(toSavePayload(nextForm)), 700);
  }

  // Manual save for recovery after autosave failure
  function handleManualSave() {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const snapshot = latestFormRef.current ?? form;
    void executeSave(toSavePayload(snapshot));
  }

  // Warn before unload when a save is in-flight or failed
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === "saving" || saveStatus === "error" || debounceRef.current !== null) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      scheduleSave(next);
      return next;
    });
  }

  function toggleArrayItem(key: "ethnicity" | "seeking" | "casting_platforms", value: string) {
    setForm((prev) => {
      const arr = prev[key] as string[];
      const next = {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
      scheduleSave(next);
      return next;
    });
  }

  // ─── File uploads ──────────────────────────────────────────────────────────

  async function uploadFile(file: File, context: string): Promise<string> {
    if (!supabase || !userId) throw new Error("Not authenticated");
    const path = `${userId}/opencall/${context}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("pages101-media").upload(path, file, {
      cacheControl: "31536000", contentType: file.type, upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("pages101-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) { setUploadError("Headshot must be under 10 MB."); return; }
    setUploadingHeadshot(true);
    try {
      const url = await uploadFile(file, "headshot");
      setForm((prev) => {
        const next = { ...prev, headshots: [...prev.headshots, { type: "commercial" as const, url }] };
        scheduleSave(next);
        return next;
      });
    } catch {
      setUploadError("Headshot upload failed. Please try again.");
    } finally {
      setUploadingHeadshot(false);
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) { setUploadError("Resume must be under 10 MB."); return; }
    setUploadingResume(true);
    try {
      const url = await uploadFile(file, "resume");
      setField("resume_url", url);
    } catch {
      setUploadError("Resume upload failed. Please try again.");
    } finally {
      setUploadingResume(false);
    }
  }

  function updateHeadshotType(index: number, type: HeadshotEntry["type"]) {
    setForm((prev) => {
      const next = {
        ...prev,
        headshots: prev.headshots.map((h, i) => i === index ? { ...h, type } : h),
      };
      scheduleSave(next);
      return next;
    });
  }

  function removeHeadshot(index: number) {
    setForm((prev) => {
      const next = { ...prev, headshots: prev.headshots.filter((_, i) => i !== index) };
      scheduleSave(next);
      return next;
    });
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!consents.guardian_consent || !consents.reviewer_visibility_consent || !consents.contact_consent) {
      setSubmitError("All three required consents must be checked before submitting.");
      return;
    }

    setSubmitStatus("submitting");
    try {
      const token = await getToken();
      const res = await fetch(`/api/opencall/applications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "submit",
          consents: {
            guardian_consent: consents.guardian_consent,
            reviewer_visibility_consent: consents.reviewer_visibility_consent,
            contact_consent: consents.contact_consent,
            anonymized_results_consent: consents.anonymized_results_consent,
          },
        }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setSubmitError(body.error ?? "Submission failed. Please try again.");
        setSubmitStatus("error");
        return;
      }
      setSubmitStatus("submitted");
      setApp((prev) => prev ? { ...prev, status: "submitted" } : prev);
    } catch {
      setSubmitError("Submission failed. Please try again.");
      setSubmitStatus("error");
    }
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────

  async function handleWithdraw() {
    if (!window.confirm("Withdraw this application? It will be removed from consideration and cannot be restored.")) return;
    setWithdrawing(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/opencall/applications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "withdraw" }),
      });
      if (res.ok) {
        setApp((prev) => prev ? { ...prev, status: "withdrawn" } : prev);
        router.push("/opencall");
      }
    } catch {
      // ignore
    } finally {
      setWithdrawing(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--cream)" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading application…</p>
      </div>
    );
  }

  const isSubmitted = app?.status === "submitted";
  const isWithdrawn = app?.status === "withdrawn";
  const windowOpen = event ? isWindowOpen(event) : false;
  const editable = windowOpen && !isWithdrawn;
  const currentYear = new Date().getFullYear();

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", fontFamily: "var(--font-inter), sans-serif" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/opencall" style={{ color: "var(--ink-soft)", textDecoration: "none", fontSize: "0.875rem" }}>
            ← Open Call
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {saveStatus === "saving" && <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Saving…</span>}
            {saveStatus === "saved" && <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Saved</span>}
            {saveStatus === "error" && (
              <>
                <span style={{ fontSize: "0.8rem", color: "var(--marquee)" }}>Save failed</span>
                <button
                  onClick={handleManualSave}
                  style={{ fontSize: "0.8rem", padding: "4px 10px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  Save Draft
                </button>
              </>
            )}
            {isSubmitted && <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a7a4a", padding: "4px 10px", background: "#e6f4ed", borderRadius: 12 }}>Submitted</span>}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "2rem", color: "var(--ink)", margin: "0 0 4px" }}>
          Open Call Application
        </h1>
        {event && <p style={{ color: "var(--ink-soft)", fontSize: "0.875rem", margin: "0 0 8px" }}>Deadline: {formatDeadline(event.submits_close)}</p>}
        {isSubmitted && editable && (
          <p style={{ color: "var(--ink-soft)", fontSize: "0.875rem", marginBottom: 4 }}>
            Your application is submitted. You may still edit fields until the deadline.
          </p>
        )}
        {!windowOpen && !isSubmitted && (
          <div style={{ padding: "12px 16px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--ink-soft)", fontSize: "0.875rem", marginBottom: 16 }}>
            The submission window is closed. This application cannot be edited.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Performer */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>1. Performer</h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>Performer Name</label>
              <input style={inputStyle} type="text" value={form.actor_name} onChange={(e) => setField("actor_name", e.target.value)} maxLength={120} disabled={!editable} placeholder="Full name as it appears on materials" />
            </div>
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>Birth Year</label>
                <input style={inputStyle} type="number" value={form.birth_year} onChange={(e) => setField("birth_year", e.target.value)} min={1990} max={currentYear} disabled={!editable} placeholder="e.g. 2014" />
              </div>
              <div>
                <label style={labelStyle}>Birth Month</label>
                <select style={inputStyle} value={form.birth_month} onChange={(e) => setField("birth_month", e.target.value)} disabled={!editable}>
                  <option value="">— select —</option>
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Gender</label>
              <input style={inputStyle} type="text" value={form.gender} onChange={(e) => setField("gender", e.target.value)} maxLength={40} disabled={!editable} placeholder="Self-describe" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Ethnicity (select all that apply)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                {ETHNICITY_OPTIONS.map((o) => (
                  <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                    <input type="checkbox" checked={form.ethnicity.includes(o.value)} onChange={() => editable && toggleArrayItem("ethnicity", o.value)} disabled={!editable} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Location & Union */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>2. Location & Union</h2>
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} type="text" value={form.city} onChange={(e) => setField("city", e.target.value)} maxLength={120} disabled={!editable} />
              </div>
              <div>
                <label style={labelStyle}>State / Province</label>
                <input style={inputStyle} type="text" value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={120} disabled={!editable} placeholder="CA" />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Country</label>
              <input style={inputStyle} type="text" value={form.country} onChange={(e) => setField("country", e.target.value)} maxLength={10} disabled={!editable} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Local Hire Cities (comma-separated, optional)</label>
              <input style={inputStyle} type="text" value={form.local_hire_cities} onChange={(e) => setField("local_hire_cities", e.target.value)} disabled={!editable} placeholder="e.g. Los Angeles, San Diego" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Union Status</label>
              <select style={inputStyle} value={form.union_status} onChange={(e) => setField("union_status", e.target.value)} disabled={!editable}>
                <option value="">— select —</option>
                <option value="non_union">Non-Union</option>
                <option value="sag_eligible">SAG-Eligible</option>
                <option value="sag_member">SAG-AFTRA Member</option>
              </select>
            </div>
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>Coogan Account</label>
                <select style={inputStyle} value={form.coogan_status} onChange={(e) => setField("coogan_status", e.target.value)} disabled={!editable}>
                  <option value="">— select —</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="not_required">Not Required</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Work Permit</label>
                <select style={inputStyle} value={form.work_permit} onChange={(e) => setField("work_permit", e.target.value)} disabled={!editable}>
                  <option value="">— select —</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="not_required">Not Required</option>
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
              <input type="checkbox" checked={form.passport} onChange={(e) => setField("passport", e.target.checked)} disabled={!editable} />
              Has a valid passport
            </label>
          </div>

          {/* Section 3: Representation */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>3. Representation</h2>
            <div style={{ ...fieldStyle, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                <input type="checkbox" checked={form.has_current_rep} onChange={(e) => setField("has_current_rep", e.target.checked)} disabled={!editable} />
                Currently represented by an agent or manager
              </label>
            </div>
            {form.has_current_rep && (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Current Rep Name / Agency</label>
                  <input style={inputStyle} type="text" value={form.current_rep_name} onChange={(e) => setField("current_rep_name", e.target.value)} maxLength={160} disabled={!editable} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Why are you submitting despite having representation? (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.rep_context} onChange={(e) => setField("rep_context", e.target.value)} maxLength={2000} disabled={!editable} />
                </div>
              </>
            )}
            <div style={fieldStyle}>
              <label style={labelStyle}>Seeking (select all that apply)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                {SEEKING_OPTIONS.map((o) => (
                  <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                    <input type="checkbox" checked={form.seeking.includes(o.value)} onChange={() => editable && toggleArrayItem("seeking", o.value)} disabled={!editable} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Materials */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>4. Materials</h2>

            {/* Casting Platforms */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Casting Platforms</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                {CASTING_PLATFORM_OPTIONS.map((o) => (
                  <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                    <input type="checkbox" checked={form.casting_platforms.includes(o.value)} onChange={() => editable && toggleArrayItem("casting_platforms", o.value)} disabled={!editable} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Casting Profile URLs */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Casting Profile URLs (up to 2)</label>
              <input style={{ ...inputStyle, marginBottom: 8 }} type="url" value={form.casting_profile_url_0} onChange={(e) => setField("casting_profile_url_0", e.target.value)} disabled={!editable} placeholder="https://www.actorsaccess.com/..." />
              <input style={inputStyle} type="url" value={form.casting_profile_url_1} onChange={(e) => setField("casting_profile_url_1", e.target.value)} disabled={!editable} placeholder="Second profile URL (optional)" />
            </div>

            {/* Headshots */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Headshots</label>
              {form.headshots.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {form.headshots.map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 6 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded URL from Supabase storage; domain not statically known */}
                      <img src={h.url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      <select
                        value={h.type}
                        onChange={(e) => updateHeadshotType(i, e.target.value as HeadshotEntry["type"])}
                        disabled={!editable}
                        style={{ ...inputStyle, width: "auto", flexGrow: 1 }}
                      >
                        <option value="commercial">Commercial</option>
                        <option value="theatrical">Theatrical</option>
                        <option value="other">Other</option>
                      </select>
                      {editable && (
                        <button type="button" onClick={() => removeHeadshot(i)} style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700, padding: "4px 8px" }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editable && (
                <div>
                  <label style={{ display: "inline-block", padding: "8px 16px", background: uploadingHeadshot ? "var(--hairline)" : "var(--marquee)", color: "#fff", borderRadius: 6, cursor: uploadingHeadshot ? "default" : "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
                    {uploadingHeadshot ? "Uploading…" : "Upload Headshot"}
                    <input type="file" accept="image/*" onChange={handleHeadshotUpload} disabled={uploadingHeadshot} style={{ display: "none" }} />
                  </label>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginLeft: 10 }}>Uploaded files are publicly accessible via their link.</span>
                </div>
              )}
            </div>

            {/* Resume */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Resume</label>
              {form.resume_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <a href={form.resume_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--marquee)", fontSize: "0.875rem" }}>View resume</a>
                  {editable && <button type="button" onClick={() => setField("resume_url", "")} style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontSize: "0.875rem" }}>Remove</button>}
                </div>
              ) : (
                <input style={{ ...inputStyle, marginBottom: 6 }} type="url" value={form.resume_url} onChange={(e) => setField("resume_url", e.target.value)} disabled={!editable} placeholder="Link to resume (or upload below)" />
              )}
              {editable && (
                <label style={{ display: "inline-block", padding: "8px 16px", background: uploadingResume ? "var(--hairline)" : "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, cursor: uploadingResume ? "default" : "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
                  {uploadingResume ? "Uploading…" : "Upload Resume"}
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} disabled={uploadingResume} style={{ display: "none" }} />
                </label>
              )}
            </div>

            {/* Slate + Reel */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Slate Video URL <span style={{ color: "var(--marquee)" }}>*</span></label>
              <input style={inputStyle} type="url" value={form.slate_url} onChange={(e) => setField("slate_url", e.target.value)} disabled={!editable} placeholder="https://vimeo.com/... or https://youtu.be/..." />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Demo Reel URL (optional)</label>
              <input style={inputStyle} type="url" value={form.reel_url} onChange={(e) => setField("reel_url", e.target.value)} disabled={!editable} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Other Video URL (optional)</label>
              <input style={inputStyle} type="url" value={form.other_video_url} onChange={(e) => setField("other_video_url", e.target.value)} disabled={!editable} />
            </div>

            {uploadError && <p style={{ color: "var(--marquee)", fontSize: "0.875rem" }}>{uploadError}</p>}

            {/* Supplemental Notes */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Supplemental Notes (optional, max 4000 characters)</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={form.supplemental_notes} onChange={(e) => setField("supplemental_notes", e.target.value)} maxLength={4000} disabled={!editable} />
            </div>
          </div>

          {/* Section 5: Guardian */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>5. Guardian Information</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", marginBottom: 20 }}>
              Guardian information is kept private and only shared with authorized representatives who request it.
            </p>
            <div style={fieldStyle}>
              <label style={labelStyle}>Guardian Full Name <span style={{ color: "var(--marquee)" }}>*</span></label>
              <input style={inputStyle} type="text" value={form.guardian_name} onChange={(e) => setField("guardian_name", e.target.value)} maxLength={120} disabled={!editable} />
            </div>
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>Guardian Email <span style={{ color: "var(--marquee)" }}>*</span></label>
                <input style={inputStyle} type="email" value={form.guardian_email} onChange={(e) => setField("guardian_email", e.target.value)} maxLength={254} disabled={!editable} />
              </div>
              <div>
                <label style={labelStyle}>Guardian Phone <span style={{ color: "var(--marquee)" }}>*</span></label>
                <input style={inputStyle} type="tel" value={form.guardian_phone} onChange={(e) => setField("guardian_phone", e.target.value)} maxLength={40} disabled={!editable} />
              </div>
            </div>
          </div>

          {/* Consent & Submit */}
          {editable && (
            <div style={{ paddingTop: 32 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)", marginBottom: 20 }}>Review & {isSubmitted ? "Re-Submit" : "Submit"}</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24, padding: "20px 20px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
                {(["guardian_consent", "reviewer_visibility_consent", "contact_consent"] as const).map((key) => (
                  <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem", color: "var(--ink)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={consents[key]}
                      onChange={(e) => setConsents((prev) => ({ ...prev, [key]: e.target.checked }))}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span>
                      <strong>Required: </strong>{CONSENT_COPY[key].text}
                    </span>
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem", color: "var(--ink-soft)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={consents.anonymized_results_consent}
                    onChange={(e) => setConsents((prev) => ({ ...prev, anonymized_results_consent: e.target.checked }))}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span>
                    <strong>Optional: </strong>{CONSENT_COPY.anonymized_results_consent.text}
                  </span>
                </label>
              </div>

              {submitError && (
                <div style={{ padding: "12px 16px", background: "#fff0ee", border: "1px solid #ffccc7", borderRadius: 6, color: "#c62b1c", fontSize: "0.875rem", marginBottom: 16 }}>
                  {submitError}
                </div>
              )}

              {submitStatus === "submitted" && (
                <div style={{ padding: "12px 16px", background: "#e6f4ed", border: "1px solid #a3d9bb", borderRadius: 6, color: "#1a7a4a", fontWeight: 700, marginBottom: 16 }}>
                  Application submitted successfully.
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={submitStatus === "submitting"}
                  style={{ padding: "12px 28px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "0.95rem", cursor: "pointer", opacity: submitStatus === "submitting" ? 0.6 : 1 }}
                >
                  {submitStatus === "submitting" ? "Submitting…" : isSubmitted ? "Re-Submit Application" : "Submit Application"}
                </button>
                {isSubmitted && (
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    style={{ padding: "12px 20px", background: "var(--paper)", color: "var(--ink-soft)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", opacity: withdrawing ? 0.6 : 1 }}
                  >
                    {withdrawing ? "Withdrawing…" : "Withdraw Application"}
                  </button>
                )}
              </div>
            </div>
          )}

          {!editable && isSubmitted && (
            <div style={{ padding: "20px 24px", marginTop: 32, background: "#e6f4ed", borderRadius: "var(--radius)", fontWeight: 700, color: "#1a7a4a" }}>
              This application was submitted on {app?.submitted_at ? formatDeadline(app.submitted_at) : ""}. The submission window has closed.
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
