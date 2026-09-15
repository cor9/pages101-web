"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OpenCallEvent } from "@/lib/opencall";

type RepInvite = {
  id: string;
  event_id: string;
  rep_name: string;
  rep_email: string;
  rep_agency: string | null;
  rep_role?: string | null;
  registered_via?: string | null;
  registered_via_name?: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  redeemed_at: string | null;
  favorite_count?: number;
  intro_count?: number;
  note_count?: number;
  last_access?: string | null;
};

type RegistrationLink = {
  id: string;
  event_id: string;
  source_name: string;
  created_at: string;
  expires_at: string;
  disabled_at: string | null;
  active: boolean;
  registered: number;
  redeemed: number;
  revoked: number;
  intros: number;
};

type LinkCreateResult = { link: RegistrationLink; registration_url: string };

type CreateResult = {
  invite: RepInvite;
  invite_url: string;
  email_delivered: boolean;
  email_error: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function toLocalDateTimeInput(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inviteStatus(inv: RepInvite): { label: string; color: string } {
  if (inv.revoked_at) return { label: "Revoked", color: "#ef4444" };
  if (new Date(inv.expires_at) <= new Date()) return { label: "Expired", color: "#9ca3af" };
  if (inv.redeemed_at) return { label: "Active (redeemed)", color: "#22c55e" };
  return { label: "Active (not yet redeemed)", color: "#f59e0b" };
}

export default function AdminRepsPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Event selection
  const [events, setEvents] = useState<OpenCallEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Invite list
  const [invites, setInvites] = useState<RepInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ rep_name: "", rep_email: "", rep_agency: "", expires_at: "" });
  const [linkOnly, setLinkOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  // Invite type tabs: direct invites (existing) vs reusable registration links
  const [tab, setTab] = useState<"direct" | "registration">("direct");
  const [regLinks, setRegLinks] = useState<RegistrationLink[]>([]);
  const [loadingRegLinks, setLoadingRegLinks] = useState(false);
  const [showRegCreate, setShowRegCreate] = useState(false);
  const [regForm, setRegForm] = useState({ source_name: "", expires_at: "" });
  const [regCreating, setRegCreating] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regResult, setRegResult] = useState<LinkCreateResult | null>(null);
  const [regCopied, setRegCopied] = useState(false);
  const [regToggling, setRegToggling] = useState<string | null>(null);

  // Revoke
  const [revoking, setRevoking] = useState<string | null>(null);

  // Get auth token
  useEffect(() => {
    if (!supabase) { setAuthError("Supabase unavailable."); return; }
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      if (!t) { router.push("/"); return; }
      setToken(t);
    });
  }, [supabase, router]);

  // Access tokens expire (~1hr). This page is often left open through a whole
  // batch of invite sends, so every authenticated call re-reads the session
  // instead of reusing the token captured at mount — getSession() refreshes
  // an expired token from the stored refresh token when one is available.
  // `token` state above still gates "logged in at all" and drives effects.
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token ?? null;
    if (t) setToken(t);
    return t;
  }, [supabase]);

  // Load events (all statuses visible to admin)
  useEffect(() => {
    if (!supabase || !token) return;
    setLoadingEvents(true);
    supabase
      .from("p101_opencall_events")
      .select("id, year, name, status, review_close, submits_close")
      .order("year", { ascending: false })
      .then(({ data }) => {
        const evts = (data ?? []) as OpenCallEvent[];
        setEvents(evts);
        if (evts.length > 0) setSelectedEventId((prev) => prev || evts[0].id);
        setLoadingEvents(false);
      });
  }, [supabase, token]);

  // Set default expiry when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    const evt = events.find((e) => e.id === selectedEventId);
    if (evt) {
      setForm((f) => ({ ...f, expires_at: toLocalDateTimeInput(evt.review_close) }));
      setRegForm((f) => ({ ...f, expires_at: toLocalDateTimeInput(evt.review_close) }));
    }
  }, [selectedEventId, events]);

  const fetchInvites = useCallback(async () => {
    if (!token || !selectedEventId) return;
    setLoadingInvites(true);
    const t = await getAuthToken();
    if (!t) { router.push("/"); return; }
    const res = await fetch(`/api/opencall/admin/reps?event_id=${selectedEventId}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 403) { setAuthError("Admin access required."); return; }
    const body = res.ok ? await res.json() : {};
    setInvites((body as { invites?: RepInvite[] }).invites ?? []);
    setLoadingInvites(false);
  }, [token, selectedEventId, getAuthToken, router]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const fetchRegLinks = useCallback(async () => {
    if (!token || !selectedEventId) return;
    setLoadingRegLinks(true);
    const t = await getAuthToken();
    if (!t) { router.push("/"); return; }
    const res = await fetch(`/api/opencall/admin/registration-links?event_id=${selectedEventId}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const body = await res.json() as { links: RegistrationLink[] };
      setRegLinks(body.links ?? []);
    }
    setLoadingRegLinks(false);
  }, [token, selectedEventId, getAuthToken, router]);

  useEffect(() => { fetchRegLinks(); }, [fetchRegLinks]);

  async function handleRegCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedEventId) return;
    setRegCreating(true);
    setRegError(null);
    setRegResult(null);
    const t = await getAuthToken();
    if (!t) { setRegError("Not authenticated. Please reload the page."); setRegCreating(false); return; }
    const evt = events.find((ev) => ev.id === selectedEventId);
    const res = await fetch("/api/opencall/admin/registration-links", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEventId,
        source_name: regForm.source_name.trim(),
        expires_at: new Date(regForm.expires_at).toISOString(),
      }),
    });
    const body = await res.json() as { link?: RegistrationLink; registration_url?: string; error?: string };
    if (!res.ok) {
      setRegError(body.error ?? "Failed to create registration link.");
    } else {
      setRegResult({ link: body.link!, registration_url: body.registration_url! });
      setRegCopied(false);
      setRegForm({ source_name: "", expires_at: evt ? toLocalDateTimeInput(evt.review_close) : "" });
      setShowRegCreate(false);
      fetchRegLinks();
    }
    setRegCreating(false);
  }

  async function handleRegToggle(link: RegistrationLink) {
    if (!token) return;
    const turningOff = link.active;
    if (turningOff && !window.confirm(`Turn off "${link.source_name}"? New registrations will stop. Reps who already registered keep their access.`)) return;
    setRegToggling(link.id);
    const t = await getAuthToken();
    if (!t) { setRegToggling(null); router.push("/"); return; }
    await fetch(`/api/opencall/admin/registration-links/${link.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active: !turningOff }),
    });
    setRegToggling(null);
    fetchRegLinks();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedEventId) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);

    const t = await getAuthToken();
    if (!t) { setCreateError("Not authenticated. Please reload the page."); setCreating(false); return; }

    const evt = events.find((ev) => ev.id === selectedEventId);
    const expiresIso = new Date(form.expires_at).toISOString();

    const res = await fetch("/api/opencall/admin/reps", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEventId,
        rep_name: form.rep_name.trim(),
        rep_email: form.rep_email.trim() || undefined,
        rep_agency: form.rep_agency.trim() || undefined,
        expires_at: expiresIso,
        send_email: !linkOnly,
      }),
    });

    const body = await res.json() as { invite?: RepInvite; invite_url?: string; email_delivered?: boolean; email_error?: string | null; error?: string };
    if (!res.ok) {
      setCreateError(body.error ?? "Failed to create invite.");
    } else {
      setCreateResult({ invite: body.invite!, invite_url: body.invite_url!, email_delivered: body.email_delivered!, email_error: body.email_error ?? null });
      setCopied(false);
      setForm({ rep_name: "", rep_email: "", rep_agency: "", expires_at: evt ? toLocalDateTimeInput(evt.review_close) : "" });
      setLinkOnly(false);
      setShowCreate(false);
      fetchInvites();
    }
    setCreating(false);
  }

  async function handleRevoke(inviteId: string) {
    if (!token) return;
    if (!window.confirm("Revoke this invitation? The representative will lose access immediately. This cannot be undone.")) return;
    setRevoking(inviteId);
    const t = await getAuthToken();
    if (!t) { setRevoking(null); router.push("/"); return; }
    await fetch(`/api/opencall/admin/reps/${inviteId}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    setRevoking(null);
    fetchInvites();
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
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
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: "#94a3b8", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          ← Dashboard
        </button>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>Open Call — Representative Management</h1>
        <button onClick={() => router.push("/dashboard/admin/opencall/submissions")} style={{ marginLeft: "auto", background: "#fff", border: 0, borderRadius: 6, color: "#1a1a2e", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px" }}>
          View submission gallery
        </button>
        <span style={{ color: "#64748b", fontSize: 12 }}>Admin</span>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Event selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Event
          </label>
          {loadingEvents ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading events…</p>
          ) : events.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No events found.</p>
          ) : (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, background: "#fff", minWidth: 280 }}
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Invite type tabs */}
        {selectedEventId && (
          <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e2e8f0" }}>
            {([
              ["direct", "Direct Invites", `Email a rep, or a shared link for one office · ${invites.length}`],
              ["registration", "Registration Links", `Reusable links for rep groups & communities · ${regLinks.length}`],
            ] as const).map(([key, label, hint]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: tab === key ? "2px solid #1a1a2e" : "2px solid transparent", marginBottom: -1, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: tab === key ? "#1a1a2e" : "#64748b" }}>{label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{hint}</div>
              </button>
            ))}
          </div>
        )}

        {tab === "registration" && selectedEventId && (
          <>
            {regError && (
              <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 14 }}>
                {regError}
              </div>
            )}

            {regResult && (
              <div style={{ marginBottom: 24, padding: "20px 24px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#15803d" }}>
                  ✓ Registration link created for {regResult.link.source_name}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Copy this link now — it will not be shown again. Post it to the group; each rep who registers gets their own personal invite.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <code style={{ flex: 1, display: "block", background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, padding: "8px 12px", fontSize: 12, wordBreak: "break-all", color: "#374151" }}>
                    {regResult.registration_url}
                  </code>
                  <button type="button"
                    onClick={async () => { try { await navigator.clipboard.writeText(regResult.registration_url); setRegCopied(true); } catch { setRegCopied(false); } }}
                    style={{ padding: "0 14px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {regCopied ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
                <button onClick={() => setRegResult(null)}
                  style={{ marginTop: 12, padding: "6px 14px", background: "none", border: "1px solid #86efac", borderRadius: 6, color: "#15803d", cursor: "pointer", fontSize: 13 }}>
                  Dismiss
                </button>
              </div>
            )}

            <div style={{ marginBottom: 28 }}>
              {!showRegCreate ? (
                <button onClick={() => setShowRegCreate(true)}
                  style={{ padding: "10px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  + Create Registration Link
                </button>
              ) : (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>New Registration Link</h3>
                  <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                    One reusable link for a rep group or community. Reps who open it enter their name, work email, agency and role,
                    and are emailed their own personal access link (auto-approved). The registration link itself never opens the gallery.
                  </p>
                  <form onSubmit={handleRegCreate}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: "#374151" }}>Source / Group Name *</span>
                        <input required value={regForm.source_name} onChange={(e) => setRegForm((f) => ({ ...f, source_name: e.target.value }))}
                          style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} placeholder="Youth Talent Reps (Facebook)" />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: "#374151" }}>
                          Registrations close * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(max: review close)</span>
                        </span>
                        <input required type="datetime-local" value={regForm.expires_at}
                          onChange={(e) => setRegForm((f) => ({ ...f, expires_at: e.target.value }))}
                          max={selectedEvent ? toLocalDateTimeInput(selectedEvent.review_close) : undefined}
                          style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
                      </label>
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6b7280" }}>
                      Reps who register get access until this date. Turning the link off later does not affect them.
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="submit" disabled={regCreating}
                        style={{ padding: "9px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: regCreating ? "not-allowed" : "pointer", opacity: regCreating ? 0.7 : 1 }}>
                        {regCreating ? "Creating…" : "Create Registration Link"}
                      </button>
                      <button type="button" onClick={() => { setShowRegCreate(false); setRegError(null); }}
                        style={{ padding: "9px 16px", background: "none", border: "1px solid #d1d5db", borderRadius: 7, color: "#374151", fontSize: 13, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <section>
              <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
                Registration Links {!loadingRegLinks && `(${regLinks.length})`}
              </h2>
              {loadingRegLinks ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</p>
              ) : regLinks.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14 }}>No registration links for this event yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {regLinks.map((l) => (
                    <div key={l.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{l.source_name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: (l.active ? "#22c55e" : "#9ca3af") + "20", color: l.active ? "#15803d" : "#6b7280" }}>
                              {l.active ? "Active" : l.disabled_at ? "Turned off" : "Expired"}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                            Created {fmtDate(l.created_at)} · Registrations close {fmtDate(l.expires_at)}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 18, fontSize: 13, color: "#374151", alignItems: "center" }}>
                          <span title="Reps registered through this link"><strong>{l.registered}</strong> registered</span>
                          <span title="Registered reps who have opened the gallery"><strong>{l.redeemed}</strong> redeemed</span>
                          <span title="Introduction requests from these reps">✉ <strong>{l.intros}</strong></span>
                          {l.revoked > 0 && <span style={{ color: "#ef4444" }}>{l.revoked} revoked</span>}
                        </div>
                        {!(l.disabled_at === null && !l.active) && (
                          <button onClick={() => handleRegToggle(l)} disabled={regToggling === l.id}
                            style={{ padding: "7px 14px", background: "none", border: `1px solid ${l.active ? "#fca5a5" : "#86efac"}`, color: l.active ? "#dc2626" : "#15803d", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            {regToggling === l.id ? "Saving…" : l.active ? "Turn off" : "Turn on"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "direct" && <>
        {/* Create result (one-time invite URL) */}
        {createResult && (
          <div style={{ marginBottom: 24, padding: "20px 24px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#15803d" }}>
              ✓ Invite created for {createResult.invite.rep_name}
            </p>
            {createResult.email_delivered ? (
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "#166534" }}>
                Invitation email sent to {createResult.invite.rep_email}.
              </p>
            ) : (
              <>
                {createResult.email_error ? (
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
                    ⚠ {createResult.email_error}
                  </p>
                ) : (
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: "#166534" }}>
                    Link-only invite. No email was sent.
                  </p>
                )}
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Copy this link now — it will not be shown again:
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <code style={{ flex: 1, display: "block", background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, padding: "8px 12px", fontSize: 12, wordBreak: "break-all", color: "#374151" }}>
                    {createResult.invite_url}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(createResult.invite_url); setCopied(true); } catch { setCopied(false); }
                    }}
                    style={{ padding: "0 14px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => setCreateResult(null)}
              style={{ marginTop: 12, padding: "6px 14px", background: "none", border: "1px solid #86efac", borderRadius: 6, color: "#15803d", cursor: "pointer", fontSize: 13 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {createError && (
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 14 }}>
            {createError}
          </div>
        )}

        {/* Create form */}
        {selectedEventId && (
          <div style={{ marginBottom: 28 }}>
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                style={{ padding: "10px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                + Create Invite
              </button>
            ) : (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700 }}>New Representative Invite</h3>
                <form onSubmit={handleCreate}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 14 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>Representative Name *</span>
                      <input required value={form.rep_name} onChange={(e) => setForm((f) => ({ ...f, rep_name: e.target.value }))}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} placeholder="Jane Smith" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>Email Address {linkOnly ? <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span> : "*"}</span>
                      <input required={!linkOnly} type="email" value={form.rep_email} onChange={(e) => setForm((f) => ({ ...f, rep_email: e.target.value }))}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} placeholder="jane@agency.com" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>Agency / Company</span>
                      <input value={form.rep_agency} onChange={(e) => setForm((f) => ({ ...f, rep_agency: e.target.value }))}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} placeholder="Acme Talent Agency" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>
                        Access Expires * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(max: review close)</span>
                      </span>
                      <input required type="datetime-local" value={form.expires_at}
                        onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                        max={selectedEvent ? toLocalDateTimeInput(selectedEvent.review_close) : undefined}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
                    </label>
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
                    <input type="checkbox" checked={linkOnly} onChange={(e) => setLinkOnly(e.target.checked)} style={{ marginTop: 2 }} />
                    <span>
                      <strong style={{ color: "#374151" }}>Link only — don&apos;t send an email.</strong>{" "}
                      <span style={{ color: "#6b7280" }}>
                        For a rep group post or a whole office. You copy the link and share it yourself. Use the name field to
                        describe the audience (e.g. &quot;Youth Reps FB Group&quot;). Everyone on the link shares one favorites list.
                      </span>
                    </span>
                  </label>
                  {selectedEvent && form.expires_at && (
                    <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6b7280" }}>
                      Effective expiry: <strong>{new Date(form.expires_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })} PT</strong>
                      {" · "}Review closes: {fmtDate(selectedEvent.review_close)} PT
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" disabled={creating}
                      style={{ padding: "9px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
                      {creating ? "Creating…" : linkOnly ? "Create Link" : "Create & Send Invite"}
                    </button>
                    <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); }}
                      style={{ padding: "9px 16px", background: "none", border: "1px solid #d1d5db", borderRadius: 7, color: "#374151", fontSize: 13, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Invite list */}
        <section>
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>
            Direct Invites {!loadingInvites && `(${invites.length})`}
          </h2>

          {loadingInvites ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</p>
          ) : invites.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No invites for this event yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {invites.map((inv) => {
                const st = inviteStatus(inv);
                return (
                  <div key={inv.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{inv.rep_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: st.color + "20", color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 2px", fontSize: 13, color: "#64748b" }}>{inv.rep_email}</p>
                        {(inv.rep_agency || inv.rep_role) && (
                          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                            {[inv.rep_agency, inv.rep_role].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {inv.registered_via_name && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                            Registered via {inv.registered_via_name}
                          </p>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: "#6b7280", minWidth: 160 }}>
                        <div>Created: {fmtDate(inv.created_at)}</div>
                        <div>Expires: {fmtDate(inv.expires_at)}</div>
                        {inv.redeemed_at && <div>Redeemed: {fmtDate(inv.redeemed_at)}</div>}
                        {inv.revoked_at && <div style={{ color: "#ef4444" }}>Revoked: {fmtDate(inv.revoked_at)}</div>}
                        {inv.last_access && <div>Last access: {fmtDate(inv.last_access)}</div>}
                      </div>

                      <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#374151", alignItems: "center" }}>
                        <span title="Favorites saved">⭐ {inv.favorite_count ?? 0}</span>
                        <span title="Introduction requests">✉ {inv.intro_count ?? 0}</span>
                        <span title="Profiles with notes">✎ {inv.note_count ?? 0}</span>
                      </div>

                      {!inv.revoked_at && (
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revoking === inv.id}
                          style={{ padding: "7px 14px", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          {revoking === inv.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </>}
      </main>
    </div>
  );
}
