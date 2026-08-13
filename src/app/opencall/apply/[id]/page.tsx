"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  REPRESENTATION_TYPE_OPTIONS,
  ETHNICITY_OPTIONS,
  CASTING_PLATFORM_OPTIONS,
  GENDER_OPTIONS,
  GENDER_SELF_DESCRIBE,
  PRONOUN_OPTIONS,
  MONTHS,
  formatDeadline,
  isWindowOpen,
  getMissingApplicationFields,
} from "@/lib/opencall";
import type { OpenCallApplication, OpenCallEvent, HeadshotEntry, RepresentativeEntry, AdditionalLinkEntry } from "@/lib/opencall";
import { ApplicationReview } from "./ApplicationReview";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
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

function blankForm(): FormState {
  return {
    actor_name: "", birth_year: "", birth_month: "", gender: "", pronouns: "", ethnicity: [],
    city: "", state: "", country: "US", local_hire_cities: "",
    union_status: "", coogan_status: "", work_permit: "", passport: false,
    has_current_rep: null, representatives: [], seeking_representation: [], representation_notes: "",
    casting_platforms: [], casting_profile_url_0: "", casting_profile_url_1: "",
    headshots: [], additional_links: [], guardian_name: "", guardian_email: "", guardian_phone: "",
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
    pronouns: app.pronouns ?? "",
    ethnicity: app.ethnicity ?? [],
    city: app.city ?? "",
    state: app.state ?? "",
    country: app.country ?? "US",
    local_hire_cities: (app.local_hire_cities ?? []).join(", "),
    union_status: app.union_status ?? "",
    coogan_status: app.coogan_status ?? "",
    work_permit: app.work_permit ?? "",
    passport: app.passport ?? false,
    has_current_rep: app.has_current_rep ?? null,
    representatives: Array.isArray(app.representatives) ? app.representatives : [],
    seeking_representation: app.seeking_representation ?? [],
    representation_notes: app.representation_notes ?? "",
    casting_platforms: app.casting_platforms ?? [],
    casting_profile_url_0: urls[0] ?? "",
    casting_profile_url_1: urls[1] ?? "",
    headshots: Array.isArray(app.headshots) ? (app.headshots as HeadshotEntry[]) : [],
    additional_links: Array.isArray(app.additional_links) ? app.additional_links : [],
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
    pronouns: form.pronouns || null,
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
    representatives: form.has_current_rep ? form.representatives : [],
    seeking_representation: form.seeking_representation,
    representation_notes: form.representation_notes.trim() || null,
    casting_platforms: form.casting_platforms,
    casting_profile_urls: castingUrls,
    headshots: form.headshots,
    additional_links: form.additional_links,
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
const helperTextStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-soft)", margin: "-10px 0 14px" };
const helperBlockStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-soft)", lineHeight: 1.5, background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "12px 14px", margin: "0 0 12px" };
const repRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1fr auto", gap: 10, alignItems: "start", marginBottom: 12 };

// ─── Page component ───────────────────────────────────────────────────────────

export default function OpenCallApplyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [app, setApp] = useState<OpenCallApplication | null>(null);
  const [event, setEvent] = useState<OpenCallEvent | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [mode, setMode] = useState<"edit" | "review">("edit");
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
      setMode(appBody.application.status === "submitted" ? "review" : "edit");
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

  // Manual save — always available, not just for error recovery
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

  function toggleArrayItem(key: "ethnicity" | "seeking_representation" | "casting_platforms", value: string) {
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

  // ─── Representation ────────────────────────────────────────────────────────

  function setHasCurrentRep(value: boolean) {
    setForm((prev) => {
      // Switching to "No" clears any entered representatives — the DB never
      // holds representative rows alongside has_current_rep = false.
      const next = { ...prev, has_current_rep: value, representatives: value ? prev.representatives : [] };
      scheduleSave(next);
      return next;
    });
  }

  function addRepresentative() {
    setForm((prev) => {
      const next: FormState = {
        ...prev,
        representatives: [...prev.representatives, { name: "", type: REPRESENTATION_TYPE_OPTIONS[0].value, market: null }],
      };
      scheduleSave(next);
      return next;
    });
  }

  function updateRepresentative(index: number, patch: Partial<RepresentativeEntry>) {
    setForm((prev) => {
      const next = {
        ...prev,
        representatives: prev.representatives.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      };
      scheduleSave(next);
      return next;
    });
  }

  function removeRepresentative(index: number) {
    setForm((prev) => {
      const next = { ...prev, representatives: prev.representatives.filter((_, i) => i !== index) };
      scheduleSave(next);
      return next;
    });
  }

  // ─── Additional links ──────────────────────────────────────────────────────

  function addLink() {
    setForm((prev) => {
      const next: FormState = { ...prev, additional_links: [...prev.additional_links, { label: "", url: "" }] };
      scheduleSave(next);
      return next;
    });
  }

  function updateLink(index: number, patch: Partial<AdditionalLinkEntry>) {
    setForm((prev) => {
      const next = {
        ...prev,
        additional_links: prev.additional_links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
      };
      scheduleSave(next);
      return next;
    });
  }

  function removeLink(index: number) {
    setForm((prev) => {
      const next = { ...prev, additional_links: prev.additional_links.filter((_, i) => i !== index) };
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

  async function handleSubmit() {
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
      const body = await res.json() as { ok?: boolean; error?: string; submitted_at?: string };
      if (!res.ok) {
        setSubmitError(body.error ?? "Submission failed. Please try again.");
        setSubmitStatus("error");
        return;
      }
      setSubmitStatus("submitted");
      setApp((prev) => prev ? { ...prev, status: "submitted", submitted_at: body.submitted_at ?? new Date().toISOString() } : prev);
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

  // ─── Derived state ─────────────────────────────────────────────────────────

  const missing = useMemo(() => getMissingApplicationFields({
    actor_name: form.actor_name.trim() || null,
    guardian_name: form.guardian_name.trim() || null,
    guardian_email: form.guardian_email.trim() || null,
    guardian_phone: form.guardian_phone.trim() || null,
    birth_year: form.birth_year ? parseInt(form.birth_year) : null,
    birth_month: form.birth_month ? parseInt(form.birth_month) : null,
    gender: form.gender.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country || "US",
    union_status: (form.union_status || null) as OpenCallApplication["union_status"],
    coogan_status: (form.coogan_status || null) as OpenCallApplication["coogan_status"],
    work_permit: (form.work_permit || null) as OpenCallApplication["work_permit"],
    has_current_rep: form.has_current_rep,
    representatives: form.representatives,
    seeking_representation: form.seeking_representation,
    casting_profile_urls: [form.casting_profile_url_0, form.casting_profile_url_1].map((s) => s.trim()).filter(Boolean),
    headshots: form.headshots,
    resume_url: form.resume_url.trim() || null,
    slate_url: form.slate_url.trim() || null,
  }), [form]);

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
  // Gender is still stored as plain text — the select is a UI layer over it.
  // A value matching one of the fixed options selects that option; any other
  // non-empty value is treated as a self-described answer.
  const genderSelectValue = GENDER_OPTIONS.some((o) => o.value === form.gender)
    ? form.gender
    : form.gender
    ? GENDER_SELF_DESCRIBE
    : "";

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
            {saveStatus === "error" && <span style={{ fontSize: "0.8rem", color: "var(--marquee)" }}>Save failed</span>}
            {isSubmitted && <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a7a4a", padding: "4px 10px", background: "#e6f4ed", borderRadius: 12 }}>Submitted</span>}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "2rem", color: "var(--ink)", margin: "0 0 4px" }}>
          Open Call Application
        </h1>
        {event && <p style={{ color: "var(--ink-soft)", fontSize: "0.875rem", margin: "0 0 8px" }}>Deadline: {formatDeadline(event.submits_close)}</p>}
        {!windowOpen && !isSubmitted && (
          <div style={{ padding: "12px 16px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 6, color: "var(--ink-soft)", fontSize: "0.875rem", marginBottom: 16 }}>
            The submission window is closed. This application cannot be edited.
          </div>
        )}

        {/* Persistent action bar — visible save status + manual save + review toggle,
            placed near the top so it doesn't require scrolling past the whole form. */}
        {editable && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            padding: "14px 18px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.8rem", color: saveStatus === "error" ? "var(--marquee)" : "var(--ink-soft)" }}>
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved"}
                {saveStatus === "error" && "Save failed — retry"}
                {saveStatus === "idle" && "No changes yet"}
              </span>
              <button
                type="button"
                onClick={handleManualSave}
                style={{ fontSize: "0.8rem", padding: "6px 14px", background: saveStatus === "error" ? "var(--marquee)" : "var(--paper)", color: saveStatus === "error" ? "#fff" : "var(--ink)", border: saveStatus === "error" ? "none" : "1px solid var(--hairline)", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
              >
                Save Draft
              </button>
            </div>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => setMode("review")}
                style={{ padding: "8px 18px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer" }}
              >
                Review Application
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("edit")}
                style={{ padding: "8px 18px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
              >
                Back to Edit
              </button>
            )}
          </div>
        )}

        {/* ─── Review mode ─── */}
        {(mode === "review" || (!editable && isSubmitted)) ? (
          <ApplicationReview
            form={form}
            missing={missing}
            consents={consents}
            setConsents={setConsents}
            onBackToEdit={() => setMode("edit")}
            onSubmit={handleSubmit}
            submitStatus={submitStatus}
            submitError={submitError}
            isSubmitted={isSubmitted}
            submittedAt={app?.submitted_at ?? null}
            editable={editable}
            onWithdraw={handleWithdraw}
            withdrawing={withdrawing}
            readOnly={!editable}
          />
        ) : (
        <div>
          {/* Section 1: Performer */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>1. Performer</h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>Performer Name</label>
              <input style={inputStyle} type="text" value={form.actor_name} onChange={(e) => setField("actor_name", e.target.value)} maxLength={120} disabled={!editable} placeholder="Full name as it appears on materials" />
            </div>
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>Birth Year <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(eligible ages 6–24)</span></label>
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
              <select
                style={inputStyle}
                value={genderSelectValue}
                disabled={!editable}
                onChange={(e) => setField("gender", e.target.value === GENDER_SELF_DESCRIBE ? "" : e.target.value)}
              >
                <option value="">— select —</option>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                <option value={GENDER_SELF_DESCRIBE}>Prefer to self-describe</option>
              </select>
              {genderSelectValue === GENDER_SELF_DESCRIBE && (
                <input
                  style={{ ...inputStyle, marginTop: 8 }} type="text" value={form.gender}
                  onChange={(e) => setField("gender", e.target.value)} maxLength={40} disabled={!editable}
                  placeholder="Self-describe"
                />
              )}
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Preferred Pronouns (optional)</label>
              <select style={inputStyle} value={form.pronouns} onChange={(e) => setField("pronouns", e.target.value)} disabled={!editable}>
                <option value="">— select —</option>
                {PRONOUN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Playable Ethnicities (select all that apply)</label>
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

            <div style={fieldStyle}>
              <label style={labelStyle}>Are you currently represented?</label>
              <div style={{ display: "flex", gap: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                  <input type="radio" name="has_current_rep" checked={form.has_current_rep === true} onChange={() => editable && setHasCurrentRep(true)} disabled={!editable} />
                  Yes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                  <input type="radio" name="has_current_rep" checked={form.has_current_rep === false} onChange={() => editable && setHasCurrentRep(false)} disabled={!editable} />
                  No
                </label>
              </div>
            </div>

            {form.has_current_rep && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Current Representative(s)</label>
                {form.representatives.map((rep, i) => (
                  <div key={i} style={repRowStyle}>
                    <input
                      style={inputStyle} type="text" value={rep.name} disabled={!editable}
                      placeholder="Agency or Management Company"
                      onChange={(e) => updateRepresentative(i, { name: e.target.value })}
                    />
                    <select
                      style={inputStyle} value={rep.type} disabled={!editable}
                      onChange={(e) => updateRepresentative(i, { type: e.target.value })}
                    >
                      {REPRESENTATION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      style={inputStyle} type="text" value={rep.market ?? ""} disabled={!editable}
                      placeholder="Market or Region (optional)"
                      onChange={(e) => updateRepresentative(i, { market: e.target.value || null })}
                    />
                    {editable && (
                      <button type="button" onClick={() => removeRepresentative(i)} style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700, padding: "10px 4px" }}>✕</button>
                    )}
                  </div>
                ))}
                {editable && (
                  <button
                    type="button"
                    onClick={addRepresentative}
                    style={{ marginTop: 4, padding: "8px 16px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    + Add Another Representative
                  </button>
                )}
              </div>
            )}

            <div style={fieldStyle}>
              <label style={labelStyle}>Representation Sought</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                {REPRESENTATION_TYPE_OPTIONS.map((o) => (
                  <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "var(--ink)", cursor: editable ? "pointer" : "default" }}>
                    <input type="checkbox" checked={form.seeking_representation.includes(o.value)} onChange={() => editable && toggleArrayItem("seeking_representation", o.value)} disabled={!editable} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Representation Notes (optional)</label>
              <p style={helperTextStyle}>Add any helpful details about current representation, markets, exclusivity, or what you are seeking.</p>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.representation_notes} onChange={(e) => setField("representation_notes", e.target.value)} maxLength={2000} disabled={!editable} />
            </div>
          </div>

          {/* Section 4: Materials */}
          <div style={sectionStyle}>
            <h2 style={sectionHeadStyle}>4. Materials</h2>

            {/* Headshots */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Headshots</label>
              <div style={helperBlockStyle}>
                <p style={{ margin: "0 0 10px" }}>Please upload at least <strong>TWO</strong> recent headshots or high-quality snapshots. We strongly recommend including:</p>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--ink)" }}>1. Commercial</p>
                <p style={{ margin: "0 0 10px" }}>Happy · Joyful · Genuine · Approachable · Excited · A natural smile (teeth showing is preferred)</p>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--ink)" }}>2. Theatrical</p>
                <p style={{ margin: "0 0 10px" }}>Confident · Relaxed · Thoughtful · Serious · Dramatic</p>
                <p style={{ margin: "0 0 4px", fontWeight: 700, color: "var(--ink)" }}>Optional Third Photo — Character Type</p>
                <p style={{ margin: "0 0 10px" }}>Show a character you naturally play well. Examples: Quirky, Nerd, Bully, Surfer, Gothic, Mean Girl, Athlete, Country Kid, Class Clown, Young Professional.</p>
                <p style={{ margin: 0 }}>Recent snapshots are acceptable if professional headshots are not yet available.</p>
              </div>
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
                        <option value="other">Other (character type)</option>
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

            {/* Personality Slate */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Personality Slate <span style={{ color: "var(--marquee)" }}>*</span></label>
              <div style={helperBlockStyle}>
                <p style={{ margin: "0 0 8px" }}><strong>Maximum 90 seconds.</strong> Introduce yourself by sharing your name, age, and location. Then choose <strong>TWO</strong> of the following:</p>
                <ul style={{ margin: "0 0 10px", paddingLeft: 20, display: "grid", gap: 2 }}>
                  <li>Fun fact about yourself</li>
                  <li>Pet peeve</li>
                  <li>Favorite book</li>
                  <li>Performance idol</li>
                  <li>Tell us a joke or funny story</li>
                  <li>Hidden talent</li>
                  <li>Favorite TV show or movie</li>
                  <li>Hobbies, sports, or activities</li>
                  <li>Why you love acting</li>
                  <li>An actor whose career you admire</li>
                  <li>Introduce your pet(s)</li>
                  <li>The craziest thing that&apos;s ever happened to you</li>
                </ul>
                <p style={{ margin: 0 }}>We&apos;re looking for your personality, confidence, and charisma — not a memorized performance.</p>
              </div>
              <input style={inputStyle} type="url" value={form.slate_url} onChange={(e) => setField("slate_url", e.target.value)} disabled={!editable} placeholder="https://vimeo.com/... or https://youtu.be/..." />
            </div>

            {/* Acting Sample */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Acting Sample (optional)</label>
              <div style={helperBlockStyle}>
                <p style={{ margin: "0 0 10px" }}>Choose ONE: a <strong>Demo Reel</strong> (max 3 minutes; completed professional work, self-produced scenes, or previous self-tapes) or a <strong>Self Tape Scene</strong> (max 5 minutes; a previous audition, scene, or monologue).</p>
                <p style={{ margin: 0 }}>Please do not submit stage-performance recordings or clips where your actor is only visible but does not speak.</p>
              </div>
              <input style={inputStyle} type="url" value={form.reel_url} onChange={(e) => setField("reel_url", e.target.value)} disabled={!editable} />
            </div>

            {/* Special Skill Video */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Special Skill Video (optional)</label>
              <p style={helperTextStyle}>Examples: Singing, Dance, Instrument, Stand-up Comedy, Voice Acting, Martial Arts, Gymnastics, Sports, Magic, or other unique performance skills. Maximum 2 minutes.</p>
              <input style={inputStyle} type="url" value={form.other_video_url} onChange={(e) => setField("other_video_url", e.target.value)} disabled={!editable} />
            </div>

            {uploadError && <p style={{ color: "var(--marquee)", fontSize: "0.875rem" }}>{uploadError}</p>}

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

            {/* Casting Profile */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Casting Profile <span style={{ color: "var(--marquee)" }}>*</span></label>
              <p style={helperTextStyle}>
                Please provide a public Actors Access or Casting Networks profile. A vanity URL is preferred — e.g. <code>https://resumes.actorsaccess.com/SamanthaSinger</code>. Your profile should include photos, resume, and media.
              </p>
              <input style={{ ...inputStyle, marginBottom: 8 }} type="url" value={form.casting_profile_url_0} onChange={(e) => setField("casting_profile_url_0", e.target.value)} disabled={!editable} placeholder="https://resumes.actorsaccess.com/YourName" />
              <input style={inputStyle} type="url" value={form.casting_profile_url_1} onChange={(e) => setField("casting_profile_url_1", e.target.value)} disabled={!editable} placeholder="Second profile URL (optional)" />
            </div>

            {/* Additional Links */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Additional Links (optional)</label>
              <p style={helperTextStyle}>Share anything else that helps representatives learn more about you — e.g. Pages101 page, IMDb, personal actor website, Linktree, Instagram, YouTube, TikTok, or another professional profile.</p>
              {form.additional_links.map((link, i) => (
                <div key={i} style={repRowStyle}>
                  <input
                    style={inputStyle} type="text" value={link.label} disabled={!editable}
                    placeholder="Label (e.g. IMDb)"
                    onChange={(e) => updateLink(i, { label: e.target.value })}
                  />
                  <input
                    style={{ ...inputStyle, gridColumn: "span 2" }} type="url" value={link.url} disabled={!editable}
                    placeholder="https://..."
                    onChange={(e) => updateLink(i, { url: e.target.value })}
                  />
                  {editable && (
                    <button type="button" onClick={() => removeLink(i)} style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700, padding: "10px 4px" }}>✕</button>
                  )}
                </div>
              ))}
              {editable && (
                <button
                  type="button"
                  onClick={addLink}
                  style={{ marginTop: 4, padding: "8px 16px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                >
                  + Add Another Link
                </button>
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

            {/* Supplemental Notes */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Supplemental Notes (optional, max 4000 characters)</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={form.supplemental_notes} onChange={(e) => setField("supplemental_notes", e.target.value)} maxLength={4000} disabled={!editable} />
            </div>

            {/* Before You Submit reminder */}
            <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", padding: "18px 20px", marginTop: 8 }}>
              <p style={{ margin: "0 0 10px", fontWeight: 800, color: "var(--ink)", fontSize: "0.95rem" }}>Before You Submit</p>
              <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "var(--ink-soft)" }}>Please take a moment to confirm:</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.875rem", color: "var(--ink-soft)", display: "grid", gap: 4 }}>
                <li>Your headshots are recent.</li>
                <li>Your résumé is up to date.</li>
                <li>Your casting profile is public.</li>
                <li>All video links open correctly.</li>
                <li>Your slate represents your personality.</li>
                <li>Your contact information is current.</li>
              </ul>
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

          {editable && (
            <div style={{ paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => setMode("review")}
                style={{ padding: "14px 32px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}
              >
                Review Application
              </button>
            </div>
          )}

          {!editable && isSubmitted && (
            <div style={{ padding: "20px 24px", marginTop: 32, background: "#e6f4ed", borderRadius: "var(--radius)", fontWeight: 700, color: "#1a7a4a" }}>
              This application was submitted on {app?.submitted_at ? formatDeadline(app.submitted_at) : ""}. The submission window has closed.
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
