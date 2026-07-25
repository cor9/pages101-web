"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SeedApp = {
  id: string;
  actor_name: string;
  gender: string | null;
  city: string | null;
  state: string | null;
  birth_year: number | null;
  union_status: string | null;
  has_current_rep: boolean;
  status: string;
  submitted_at: string | null;
};

type TestEvent = {
  id: string;
  year: number;
  name: string;
  status: string;
  is_test: boolean;
};

function ageFrom(birthYear: number | null) {
  if (!birthYear) return "?";
  return String(new Date().getFullYear() - birthYear);
}

function unionLabel(s: string | null) {
  switch (s) {
    case "sag_member": return "SAG-AFTRA";
    case "sag_eligible": return "SAG-Eligible";
    case "non_union": return "Non-Union";
    default: return s ?? "—";
  }
}

export default function AdminSeedPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [events, setEvents] = useState<TestEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [apps, setApps] = useState<SeedApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ created: number } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ counts: Record<string, number> } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthError("Supabase unavailable."); return; }
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      if (!t) { router.push("/"); return; }
      setToken(t);
    });
  }, [supabase, router]);

  useEffect(() => {
    if (!supabase || !token) return;
    setLoadingEvents(true);
    supabase
      .from("p101_opencall_events")
      .select("id, year, name, status, is_test")
      .eq("is_test", true)
      .order("year", { ascending: false })
      .then(({ data }) => {
        const evts = (data ?? []) as TestEvent[];
        setEvents(evts);
        if (evts.length > 0) setSelectedEventId(evts[0].id);
        setLoadingEvents(false);
      });
  }, [supabase, token]);

  const fetchApps = useCallback(async () => {
    if (!token || !selectedEventId) return;
    setLoadingApps(true);
    const res = await fetch(`/api/opencall/admin/seed?event_id=${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) { setAuthError("Admin access required."); return; }
    const body = res.ok ? await res.json() as { applications: SeedApp[] } : { applications: [] };
    setApps(body.applications);
    setLoadingApps(false);
  }, [token, selectedEventId]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  async function handleSeed() {
    if (!token || !selectedEventId) return;
    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);
    const res = await fetch("/api/opencall/admin/seed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: selectedEventId, action: "batch" }),
    });
    const body = await res.json() as { created?: number; error?: string };
    if (!res.ok) {
      setSeedError(body.error ?? "Seeding failed.");
    } else {
      setSeedResult({ created: body.created ?? 0 });
      fetchApps();
    }
    setSeeding(false);
  }

  async function handleDelete() {
    if (!token || !selectedEventId) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteResult(null);
    const res = await fetch(
      `/api/opencall/admin/seed?event_id=${selectedEventId}&confirm=DELETE+SEED+DATA`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await res.json() as { deleted?: boolean; counts?: Record<string, number>; error?: string };
    if (!res.ok) {
      setDeleteError(body.error ?? "Delete failed.");
    } else {
      setDeleteResult({ counts: body.counts ?? {} });
      setConfirmDelete(false);
      fetchApps();
    }
    setDeleting(false);
  }

  async function handleGeneratePreview() {
    if (!token || !selectedEventId) return;
    setGeneratingPreview(true);
    const res = await fetch("/api/opencall/admin/seed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: selectedEventId, action: "preview_invite" }),
    });
    const body = await res.json() as { preview_url?: string; error?: string };
    if (res.ok && body.preview_url) {
      setPreviewUrl(body.preview_url);
    } else {
      setSeedError(body.error ?? "Could not generate preview invite.");
    }
    setGeneratingPreview(false);
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: 32, border: "1px solid #fee2e2", borderRadius: 8, background: "#fff1f2", color: "#dc2626" }}>
          {authError}
        </div>
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b" }}>
      <header style={{ background: "#1a1a2e", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.push("/dashboard/admin/opencall/reps")}
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "#94a3b8", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          ← Rep Management
        </button>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>Open Call — Seed Gallery Preview</h1>
        <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>Admin · Test Data Only</span>
      </header>

      {/* Warning banner */}
      <div style={{ background: "#fef3c7", borderBottom: "1px solid #fcd34d", padding: "10px 32px", fontSize: 13, color: "#92400e" }}>
        <strong>Seed applications are fictional test records.</strong> Never use real child or guardian information.
        These records are never visible to representatives in production events.
      </div>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* Event selector — test events only */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Test Event
          </label>
          {loadingEvents ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading events…</p>
          ) : events.length === 0 ? (
            <p style={{ color: "#dc2626", fontSize: 14 }}>
              No test events found. Run the migration <code>202607280001_p101_opencall_seed_and_test_event.sql</code> to create the Gallery Preview event.
            </p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, background: "#fff", minWidth: 280 }}
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name} · Year {evt.year} ({evt.status})
                  </option>
                ))}
              </select>
              {selectedEvent && (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>ID: {selectedEvent.id}</span>
              )}
            </div>
          )}
        </div>

        {/* Action banners */}
        {seedResult && (
          <div style={{ marginBottom: 20, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
            <strong style={{ color: "#15803d" }}>✓ {seedResult.created} seed profiles created.</strong>
            <button onClick={() => setSeedResult(null)} style={{ marginLeft: 16, fontSize: 12, color: "#15803d", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}
        {deleteResult && (
          <div style={{ marginBottom: 20, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 13 }}>
            <strong style={{ color: "#15803d" }}>✓ Seed data deleted.</strong>
            {Object.entries(deleteResult.counts).map(([k, v]) => (
              <span key={k} style={{ marginLeft: 12, color: "#374151" }}>{k}: {v}</span>
            ))}
            <button onClick={() => setDeleteResult(null)} style={{ marginLeft: 12, fontSize: 12, color: "#15803d", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}
        {(seedError || deleteError) && (
          <div style={{ marginBottom: 20, padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 14 }}>
            {seedError ?? deleteError}
            <button onClick={() => { setSeedError(null); setDeleteError(null); }} style={{ marginLeft: 12, fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}

        {/* Preview invite */}
        {previewUrl && (
          <div style={{ marginBottom: 20, padding: "16px 20px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#1d4ed8" }}>Preview invite created (valid 90 days)</p>
            <p style={{ margin: "0 0 8px", color: "#374151" }}>
              This link opens TalentSearch as an authorized representative for the test gallery.
              The gallery will show a <strong>TEST GALLERY</strong> banner.
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ display: "block", background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, padding: "6px 10px", fontSize: 12, wordBreak: "break-all", color: "#374151", flex: 1 }}>
                {previewUrl}
              </code>
              <a href={previewUrl} target="_blank" rel="noreferrer"
                style={{ padding: "8px 16px", background: "#1d4ed8", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Open Gallery ↗
              </a>
            </div>
            <button onClick={() => setPreviewUrl(null)} style={{ marginTop: 8, fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}

        {/* Action bar */}
        {selectedEventId && (
          <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
            <button
              onClick={handleSeed}
              disabled={seeding || apps.length >= 24}
              style={{
                padding: "10px 20px", background: apps.length >= 24 ? "#94a3b8" : "#1a1a2e", color: "#fff",
                border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
                cursor: (seeding || apps.length >= 24) ? "not-allowed" : "pointer", opacity: seeding ? 0.7 : 1,
              }}
            >
              {seeding ? "Generating…" : apps.length >= 24 ? "24 Profiles Already Seeded" : `Generate All 24 Seed Profiles`}
            </button>

            <button
              onClick={handleGeneratePreview}
              disabled={generatingPreview || apps.length === 0}
              style={{
                padding: "10px 20px", background: apps.length === 0 ? "#94a3b8" : "#1d4ed8", color: "#fff",
                border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
                cursor: (generatingPreview || apps.length === 0) ? "not-allowed" : "pointer", opacity: generatingPreview ? 0.7 : 1,
              }}
            >
              {generatingPreview ? "Generating…" : "Preview Representative Gallery"}
            </button>

            {apps.length > 0 && (
              !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ padding: "10px 20px", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                >
                  Delete All Seed Data
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Confirm delete {apps.length} records?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer" }}
                  >
                    {deleting ? "Deleting…" : "DELETE SEED DATA"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{ padding: "8px 12px", background: "none", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Seed application list */}
        <section>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
            Seed Profiles {!loadingApps && `(${apps.length})`}
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            These are the fictional test submissions currently in the database. They appear in the test gallery (via rep invite) but not in any real event gallery.
          </p>

          {loadingApps ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</p>
          ) : apps.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              No seed profiles yet. Click <strong>Generate All 24 Seed Profiles</strong> to create them.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    {["Name", "Age", "Location", "Union", "Rep", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, i) => (
                    <tr key={app.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{app.actor_name}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{ageFrom(app.birth_year)}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{[app.city, app.state].filter(Boolean).join(", ") || "—"}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{unionLabel(app.union_status)}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{app.has_current_rep ? "Yes" : "No"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: app.status === "submitted" ? "#dcfce7" : "#f1f5f9", color: app.status === "submitted" ? "#15803d" : "#64748b" }}>
                          {app.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Edge-case coverage legend */}
        {apps.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Edge-Case Coverage</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, fontSize: 12 }}>
              {[
                ["Two headshots (commercial + theatrical)", "Zoe Park, Ethan Jackson-Brown, + more"],
                ["One headshot only", "Liam Torres"],
                ["Three headshots", "Sofia Chen-Williams"],
                ["Landscape image (900×600)", "Avery Santos"],
                ["Unusually tall image (300×800)", "Destiny Williams"],
                ["Low-resolution image (120×150)", "Priya Mehta"],
                ["Broken image URL", "Noah Kim"],
                ["Missing optional reel", "Liam Torres, Isabella Moreno, + more"],
                ["Broken résumé URL", "Alyssa Nguyen"],
                ["Multiple video clips (reel + other)", "Caleb Fitzgerald, Lucas Park Fernandez Romano, Jordan Williams-Scott"],
                ["Two casting profile URLs", "Avery Santos, Isabella Moreno, + more"],
                ["No supplemental note", "Sofia Chen-Williams, Maya Okonkwo"],
                ["Long supplemental note (~4000 chars)", "Marcus Reed, Jordan Williams-Scott"],
                ["Short name", "Jake Ma, Alex Reyes, Zoe Park"],
                ["Hyphenated surname", "Sofia Chen-Williams, Ethan Jackson-Brown, Valentina Cruz-García, Bianca Osei-Mensah, Jordan Williams-Scott"],
                ["Long multi-part name (4 parts)", "Lucas Park Fernandez Romano"],
                ["Many local-hire markets (5 cities)", "Ryan Walsh"],
                ["All seeking categories", "Lucas Park Fernandez Romano, Jordan Williams-Scott"],
                ["SAG-AFTRA", "Zoe Park, Avery Santos, Noah Kim, + more"],
                ["SAG-Eligible", "Sofia Chen-Williams, Priya Mehta, + more"],
                ["Non-Union", "Liam Torres, Marcus Reed, + more"],
                ["Represented", "Zoe Park, Sofia Chen-Williams, + more"],
                ["Unrepresented", "Liam Torres, Marcus Reed, + more"],
                ["Ages 6–9", "6 profiles (Zoe, Liam, Sofia, Marcus, Avery, Priya)"],
                ["Ages 10–13", "6 profiles (Noah, Isabella, Ethan, Alyssa, Caleb, Maya)"],
                ["Ages 14–17", "6 profiles (Ryan, Valentina, Jake, Destiny, Nadia, Lucas)"],
                ["Ages 18–21", "6 profiles (Emma, Dylan, Bianca, Alex, Megan, Jordan)"],
              ].map(([label, example]) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 600, color: "#374151", marginBottom: 2 }}>{label}</div>
                  <div style={{ color: "#94a3b8" }}>{example}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
