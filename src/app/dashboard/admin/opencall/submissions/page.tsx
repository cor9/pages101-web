"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Submission = {
  id: string;
  actor_name: string | null;
  birth_month: number | null;
  birth_year: number | null;
  gender: string | null;
  ethnicity: string[] | null;
  city: string | null;
  state: string | null;
  country: string | null;
  union_status: string | null;
  local_hire_cities: string[] | null;
  has_current_rep: boolean | null;
  representatives: Array<{ name?: string; type?: string; market?: string | null }> | null;
  representation_notes: string | null;
  seeking_representation: string[] | null;
  coogan_status: string | null;
  work_permit: string | null;
  passport: boolean | null;
  casting_platforms: string[] | null;
  casting_profile_urls: string[] | null;
  supplemental_notes: string | null;
  headshots: Array<{ url?: string; label?: string }> | null;
  slate_url: string | null;
  reel_url: string | null;
  resume_url: string | null;
  submitted_at: string | null;
};

type EventSummary = { id: string; name: string; year: number; status: string };
type AgeBand = "all" | "6-8" | "9-12" | "13-15" | "16-18" | "19-21" | "22-24";

const AGE_BANDS: Array<{ value: AgeBand; label: string; min?: number; max?: number }> = [
  { value: "all", label: "All ages" },
  { value: "6-8", label: "Ages 6–8", min: 6, max: 8 },
  { value: "9-12", label: "Ages 9–12", min: 9, max: 12 },
  { value: "13-15", label: "Ages 13–15", min: 13, max: 15 },
  { value: "16-18", label: "Ages 16–18", min: 16, max: 18 },
  { value: "19-21", label: "Ages 19–21", min: 19, max: 21 },
  { value: "22-24", label: "Ages 22–24", min: 22, max: 24 },
];

const REPRESENTATION_LABELS: Record<string, string> = {
  manager: "Manager",
  regional_agent: "Regional Agent",
  theatrical_agent: "Theatrical Agent (TV & Film)",
  commercial_agent: "Commercial Agent",
  voiceover_agent: "Voiceover Agent",
  theatre_agent: "Theatre Agent (Stage)",
  print_agent: "Print Agent",
  hosting_agent: "Hosting Agent",
  across_the_board: "Across-the-Board",
};

function submittedDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
}

function joinValues(values: string[] | null) {
  return values?.filter(Boolean).join(", ") || "—";
}

function formatRepresentationType(value: string) {
  return REPRESENTATION_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ageRange(birthMonth: number | null, birthYear: number | null): { min: number; max: number; label: string } | null {
  if (!birthMonth || !birthYear) return null;
  const now = new Date();
  const ageThisYear = now.getFullYear() - birthYear;
  const currentMonth = now.getMonth() + 1;
  if (birthMonth < currentMonth) return { min: ageThisYear, max: ageThisYear, label: `Age ${ageThisYear}` };
  if (birthMonth > currentMonth) return { min: ageThisYear - 1, max: ageThisYear - 1, label: `Age ${ageThisYear - 1}` };
  return { min: ageThisYear - 1, max: ageThisYear, label: `Age ${ageThisYear - 1}–${ageThisYear}` };
}

export default function AdminOpenCallSubmissionsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [token, setToken] = useState<string | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [ageBand, setAgeBand] = useState<AgeBand>("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [seekingFilter, setSeekingFilter] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setError("Supabase is unavailable."); setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.access_token) {
        router.push("/login?next=/dashboard/admin/opencall/submissions");
        return;
      }
      setToken(data.session.access_token);
    });
  }, [router, supabase]);

  const loadSubmissions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/opencall/admin/submissions", { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({})) as { event?: EventSummary | null; submissions?: Submission[]; error?: string };
    if (!response.ok) {
      setError(response.status === 403 ? "Admin access required." : body.error ?? "Unable to load submissions.");
      setLoading(false);
      return;
    }
    setEvent(body.event ?? null);
    setSubmissions(body.submissions ?? []);
    setLoading(false);
  }, [token]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  useEffect(() => {
    try {
      setSavedIds(new Set(JSON.parse(window.localStorage.getItem("p101-opencall-owner-saved") ?? "[]")));
    } catch { /* Ignore unavailable or malformed local saved-profile data. */ }
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      window.localStorage.setItem("p101-opencall-owner-saved", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const visibleSubmissions = useMemo(() => {
    const band = AGE_BANDS.find((item) => item.value === ageBand);
    return submissions.filter((submission) => {
      const range = ageRange(submission.birth_month, submission.birth_year);
      const ageMatches = !band?.min || !band.max || (range !== null && range.max >= band.min && range.min <= band.max);
      const genderMatches = genderFilter === "all" || submission.gender?.toLowerCase() === genderFilter;
      const location = [submission.city, submission.state, submission.country, ...(submission.local_hire_cities ?? [])].filter(Boolean).join(" ").toLowerCase();
      const locationMatches = !locationFilter.trim() || location.includes(locationFilter.trim().toLowerCase());
      const seekingMatches = seekingFilter === "all" || submission.seeking_representation?.includes(seekingFilter);
      const savedMatches = !savedOnly || savedIds.has(submission.id);
      return ageMatches && genderMatches && locationMatches && seekingMatches && savedMatches;
    });
  }, [ageBand, genderFilter, locationFilter, savedIds, savedOnly, seekingFilter, submissions]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#1e293b", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ background: "#1a1a2e", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/dashboard/admin/opencall/reps")} style={{ background: "none", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, color: "#cbd5e1", cursor: "pointer", fontSize: 13, padding: "6px 12px" }}>← Representative Management</button>
        <h1 style={{ color: "#fff", fontSize: 18, margin: 0 }}>Open Call — Submission Gallery</h1>
      </header>
      <main style={{ margin: "0 auto", maxWidth: 1180, padding: "32px 24px" }}>
        <div style={{ alignItems: "end", display: "flex", gap: 16, justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <p style={{ color: "#64748b", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", margin: "0 0 6px", textTransform: "uppercase" }}>Representative view</p>
            <h2 style={{ fontSize: 26, margin: 0 }}>{event ? `${event.name} (${event.status})` : "Active Open Call"}</h2>
            <p style={{ color: "#64748b", margin: "7px 0 0" }}>Only completed submissions are shown. Guardian details are never displayed here.</p>
          </div>
          <button onClick={loadSubmissions} disabled={loading} style={{ background: "#1a1a2e", border: 0, borderRadius: 6, color: "#fff", cursor: "pointer", fontWeight: 700, padding: "10px 15px" }}>{loading ? "Refreshing…" : "Refresh submissions"}</button>
        </div>
        {error ? <p style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, color: "#be123c", padding: 18 }}>{error}</p> : loading ? <p style={{ color: "#64748b" }}>Loading submissions…</p> : submissions.length === 0 ? <p style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", padding: 24 }}>No completed submissions yet. Refresh this page as entries arrive.</p> : <>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ color: "#475569", fontWeight: 700, margin: 0 }}>{visibleSubmissions.length} of {submissions.length} completed submission{submissions.length === 1 ? "" : "s"}</p>
            <span style={{ color: "#64748b", fontSize: 13 }}>Stars save profiles in this browser.</span>
          </div>
          <div style={{ alignItems: "end", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20, padding: 14 }}>
            <FilterSelect label="Age" value={ageBand} onChange={(value) => setAgeBand(value as AgeBand)} options={AGE_BANDS.map((band) => ({ value: band.value, label: band.label }))} />
            <FilterSelect label="Gender" value={genderFilter} onChange={setGenderFilter} options={[{ value: "all", label: "Any gender" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "non-binary", label: "Non-binary" }]} />
            <label style={{ color: "#475569", display: "grid", fontSize: 13, fontWeight: 800, gap: 5 }}>
              Location / local hire
              <input aria-label="Filter submissions by location or local hire city" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="City or state" style={{ border: "1px solid #cbd5e1", borderRadius: 6, font: "inherit", minWidth: 150, padding: "8px 10px" }} />
            </label>
            <FilterSelect label="Representation sought" value={seekingFilter} onChange={setSeekingFilter} options={[{ value: "all", label: "Any type" }, ...Object.entries(REPRESENTATION_LABELS).map(([value, label]) => ({ value, label }))]} />
            <label style={{ alignItems: "center", color: "#475569", display: "flex", fontSize: 14, fontWeight: 700, gap: 7, minHeight: 36 }}><input checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} type="checkbox" /> Show starred only</label>
          </div>
          {visibleSubmissions.length === 0 ? <p style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", padding: 24 }}>No submissions match this age range.</p> :
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))" }}>
            {visibleSubmissions.map((submission) => {
              const photo = Array.isArray(submission.headshots) ? submission.headshots[0]?.url : null;
              const location = [submission.city, submission.state].filter(Boolean).join(", ");
              const age = ageRange(submission.birth_month, submission.birth_year);
              return <article key={submission.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ alignItems: "center", background: "#e2e8f0", display: "flex", height: 235, justifyContent: "center" }}>{photo ? <img src={photo} alt={`${submission.actor_name ?? "Performer"} headshot`} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : <span style={{ color: "#64748b", fontSize: 14 }}>No headshot</span>}</div>
                <div style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 19, margin: "0 0 8px" }}>{submission.actor_name ?? "Unnamed performer"}</h3>
                  <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>{[age?.label, submission.gender, location, submission.union_status].filter(Boolean).join(" · ") || "Profile details available"}</p>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Submitted {submittedDate(submission.submitted_at)}</p>
                  <div style={{ display: "flex", gap: 8 }}><button onClick={() => setSelected(submission)} style={{ background: "#1a1a2e", border: 0, borderRadius: 6, color: "#fff", cursor: "pointer", flex: 1, fontWeight: 700, padding: "9px 12px" }}>View full profile</button><button aria-label={savedIds.has(submission.id) ? "Remove saved profile" : "Save profile"} onClick={() => toggleSaved(submission.id)} style={{ background: savedIds.has(submission.id) ? "#fef3c7" : "#fff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#92400e", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "6px 11px" }}>{savedIds.has(submission.id) ? "★" : "☆"}</button></div>
                </div>
              </article>;
            })}
          </div>
          }
        </>}
      </main>
      {selected && <div role="presentation" onMouseDown={() => setSelected(null)} style={{ alignItems: "center", background: "rgba(15, 23, 42, .66)", display: "flex", inset: 0, justifyContent: "center", padding: 24, position: "fixed", zIndex: 50 }}>
        <section role="dialog" aria-modal="true" aria-labelledby="submission-profile-title" onMouseDown={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,.35)", maxHeight: "calc(100vh - 48px)", maxWidth: 1100, overflow: "auto", padding: 28, position: "relative", width: "100%" }}>
          <button onClick={() => setSelected(null)} aria-label="Close profile" style={{ background: "#f1f5f9", border: 0, borderRadius: "50%", color: "#334155", cursor: "pointer", fontSize: 22, height: 38, position: "absolute", right: 20, top: 18, width: 38 }}>×</button>
          <p style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", margin: "0 0 6px", textTransform: "uppercase" }}>Representative profile</p>
          <h2 id="submission-profile-title" style={{ fontSize: 32, margin: "0 50px 6px 0" }}>{selected.actor_name ?? "Unnamed performer"}</h2>
          <p style={{ color: "#475569", fontSize: 16, margin: 0 }}>{[ageRange(selected.birth_month, selected.birth_year)?.label, selected.gender, [selected.city, selected.state, selected.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", margin: "28px 0" }}>
            {(selected.headshots ?? []).filter((headshot) => headshot.url).map((headshot, index) => <figure key={`${headshot.url}-${index}`} style={{ margin: 0 }}><img src={headshot.url} alt={headshot.label || `${selected.actor_name ?? "Performer"} headshot ${index + 1}`} style={{ aspectRatio: "4 / 5", borderRadius: 8, objectFit: "cover", width: "100%" }} /><figcaption style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>{headshot.label || `Headshot ${index + 1}`}</figcaption></figure>)}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>{selected.slate_url && <a href={selected.slate_url} target="_blank" rel="noreferrer" style={{ background: "#1a1a2e", borderRadius: 6, color: "#fff", fontWeight: 700, padding: "10px 14px", textDecoration: "none" }}>Watch slate</a>}{selected.reel_url && <a href={selected.reel_url} target="_blank" rel="noreferrer" style={{ background: "#1a1a2e", borderRadius: 6, color: "#fff", fontWeight: 700, padding: "10px 14px", textDecoration: "none" }}>Watch reel</a>}{selected.resume_url && <a href={selected.resume_url} target="_blank" rel="noreferrer" style={{ background: "#1a1a2e", borderRadius: 6, color: "#fff", fontWeight: 700, padding: "10px 14px", textDecoration: "none" }}>Open résumé</a>}</div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            <ProfileField label="Union status" value={selected.union_status} />
            <ProfileField label="Ethnicity" value={joinValues(selected.ethnicity)} />
            <ProfileField label="Local hire cities" value={joinValues(selected.local_hire_cities)} />
            <ProfileField label="Seeking representation" value={selected.seeking_representation?.length ? selected.seeking_representation.map(formatRepresentationType).join(", ") : "—"} />
            <ProfileField label="Current representation" value={<CurrentRepresentation submission={selected} />} />
            <ProfileField label="Coogan account" value={selected.coogan_status} />
            <ProfileField label="Work permit" value={selected.work_permit} />
            <ProfileField label="Passport" value={selected.passport === null ? "—" : selected.passport ? "Yes" : "No"} />
          </div>
          {selected.casting_profile_urls?.length ? <div style={{ marginTop: 24 }}><p style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Casting profile links</p>{selected.casting_profile_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 7, overflowWrap: "anywhere" }}>{url}</a>)}</div> : null}
          {selected.supplemental_notes ? <div style={{ marginTop: 24 }}><p style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Additional notes</p><p style={{ color: "#334155", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{selected.supplemental_notes}</p></div> : null}
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 28 }}>Submitted {submittedDate(selected.submitted_at)}</p>
        </section>
      </div>}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}><p style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".05em", margin: "0 0 5px", textTransform: "uppercase" }}>{label}</p><p style={{ color: "#1e293b", lineHeight: 1.45, margin: 0 }}>{value || "—"}</p></div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label style={{ color: "#475569", display: "grid", fontSize: 13, fontWeight: 800, gap: 5 }}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#1e293b", font: "inherit", padding: "8px 10px" }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function CurrentRepresentation({ submission }: { submission: Submission }) {
  const representatives = submission.representatives?.filter((representative) => representative.name) ?? [];
  if (!representatives.length) return <>{submission.has_current_rep === false ? "Not currently represented" : "—"}</>;
  return <div style={{ display: "grid", gap: 7 }}>{representatives.map((representative, index) => <div key={`${representative.name}-${index}`}><strong>{representative.name}</strong>{representative.type ? <span style={{ color: "#475569" }}> · {formatRepresentationType(representative.type)}</span> : null}{representative.market ? <span style={{ color: "#64748b" }}> · {representative.market}</span> : null}</div>)}{submission.representation_notes ? <p style={{ color: "#475569", fontStyle: "italic", margin: "4px 0 0" }}>{submission.representation_notes}</p> : null}</div>;
}
