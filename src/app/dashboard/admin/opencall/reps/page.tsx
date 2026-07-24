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
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  redeemed_at: string | null;
  favorite_count?: number;
  intro_count?: number;
  last_access?: string | null;
};

type CreateResult = {
  invite: RepInvite;
  invite_url: string;
  email_delivered: boolean;
  email_error: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
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
    }
  }, [selectedEventId, events]);

  const fetchInvites = useCallback(async () => {
    if (!token || !selectedEventId) return;
    setLoadingInvites(true);
    const res = await fetch(`/api/opencall/admin/reps?event_id=${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403) { setAuthError("Admin access required."); return; }
    const body = res.ok ? await res.json() : {};
    setInvites((body as { invites?: RepInvite[] }).invites ?? []);
    setLoadingInvites(false);
  }, [token, selectedEventId]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedEventId) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);

    const evt = events.find((ev) => ev.id === selectedEventId);
    const expiresIso = new Date(form.expires_at).toISOString();

    const res = await fetch("/api/opencall/admin/reps", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: selectedEventId,
        rep_name: form.rep_name.trim(),
        rep_email: form.rep_email.trim(),
        rep_agency: form.rep_agency.trim() || undefined,
        expires_at: expiresIso,
      }),
    });

    const body = await res.json() as { invite?: RepInvite; invite_url?: string; email_delivered?: boolean; email_error?: string | null; error?: string };
    if (!res.ok) {
      setCreateError(body.error ?? "Failed to create invite.");
    } else {
      setCreateResult({ invite: body.invite!, invite_url: body.invite_url!, email_delivered: body.email_delivered!, email_error: body.email_error ?? null });
      setForm({ rep_name: "", rep_email: "", rep_agency: "", expires_at: evt ? toLocalDateTimeInput(evt.review_close) : "" });
      setShowCreate(false);
      fetchInvites();
    }
    setCreating(false);
  }

  async function handleRevoke(inviteId: string) {
    if (!token) return;
    if (!window.confirm("Revoke this invitation? The representative will lose access immediately. This cannot be undone.")) return;
    setRevoking(inviteId);
    await fetch(`/api/opencall/admin/reps/${inviteId}/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
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
        <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>Admin</span>
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
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
                  ⚠ {createResult.email_error}
                </p>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Copy this link now — it will not be shown again:
                </p>
                <code style={{ display: "block", background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, padding: "8px 12px", fontSize: 12, wordBreak: "break-all", color: "#374151" }}>
                  {createResult.invite_url}
                </code>
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
                      <span style={{ fontWeight: 600, color: "#374151" }}>Email Address *</span>
                      <input required type="email" value={form.rep_email} onChange={(e) => setForm((f) => ({ ...f, rep_email: e.target.value }))}
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
                  {selectedEvent && form.expires_at && (
                    <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6b7280" }}>
                      Effective expiry: <strong>{new Date(form.expires_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })} ET</strong>
                      {" · "}Review closes: {fmtDate(selectedEvent.review_close)} ET
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" disabled={creating}
                      style={{ padding: "9px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
                      {creating ? "Creating…" : "Create & Send Invite"}
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
            Invites {!loadingInvites && `(${invites.length})`}
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
                        {inv.rep_agency && <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{inv.rep_agency}</p>}
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
      </main>
    </div>
  );
}
