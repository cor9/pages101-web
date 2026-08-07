"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Submission = {
  id: string;
  actor_name: string | null;
  birth_year: number | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  union_status: string | null;
  headshots: Array<{ url?: string; label?: string }> | null;
  slate_url: string | null;
  reel_url: string | null;
  resume_url: string | null;
  submitted_at: string | null;
};

type EventSummary = { id: string; name: string; year: number; status: string };

function submittedDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
}

export default function AdminOpenCallSubmissionsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [token, setToken] = useState<string | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setError("Supabase is unavailable."); setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.access_token) { router.push("/"); return; }
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
          <p style={{ color: "#475569", fontWeight: 700, marginBottom: 16 }}>{submissions.length} completed submission{submissions.length === 1 ? "" : "s"}</p>
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))" }}>
            {submissions.map((submission) => {
              const photo = Array.isArray(submission.headshots) ? submission.headshots[0]?.url : null;
              const location = [submission.city, submission.state].filter(Boolean).join(", ");
              return <article key={submission.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ alignItems: "center", background: "#e2e8f0", display: "flex", height: 235, justifyContent: "center" }}>{photo ? <img src={photo} alt={`${submission.actor_name ?? "Performer"} headshot`} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : <span style={{ color: "#64748b", fontSize: 14 }}>No headshot</span>}</div>
                <div style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 19, margin: "0 0 8px" }}>{submission.actor_name ?? "Unnamed performer"}</h3>
                  <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>{[submission.birth_year, submission.gender, location, submission.union_status].filter(Boolean).join(" · ") || "Profile details available"}</p>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 12px" }}>Submitted {submittedDate(submission.submitted_at)}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{submission.slate_url && <a href={submission.slate_url} target="_blank" rel="noreferrer">Slate</a>}{submission.reel_url && <a href={submission.reel_url} target="_blank" rel="noreferrer">Reel</a>}{submission.resume_url && <a href={submission.resume_url} target="_blank" rel="noreferrer">Résumé</a>}</div>
                </div>
              </article>;
            })}
          </div>
        </>}
      </main>
    </div>
  );
}
