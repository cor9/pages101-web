"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OpenCallEvent } from "@/lib/opencall";

type Stats = {
  configured: boolean;
  submitted_applications: number;
  invites: number;
  sent: number;
  reminded: number;
  completed: number;
  completed_after_reminder: number;
  median_hours_to_complete: number | null;
  responses: number;
  named_responses: number;
  anonymous_responses: number;
  outcomes: {
    contacted_yes: number;
    contacted_no: number;
    contacted_unsure: number;
    with_meeting: number;
    with_offer: number;
    signed: number;
    meetings_total_min: number;
    offers_total_min: number;
    avg_submission_prepared: number | null;
    avg_next_step_prepared: number | null;
  };
};

type ActionResult = { dry_run?: boolean; would_create?: number; would_email?: number; created?: number; sent?: number; failed?: number; error?: string };

const btn = { padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 } as const;

const note = { color: "#64748b", fontSize: 13, margin: "10px 0 0" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.07em", color: "#475569", margin: "0 0 10px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Tiles({ items }: { items: [string, string | number][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{k}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export default function AdminSurveyPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<OpenCallEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      if (!t) { router.push("/"); return; }
      setToken(t);
    });
  }, [supabase, router]);

  useEffect(() => {
    if (!supabase || !token) return;
    supabase.from("p101_opencall_events").select("id, year, name, status").order("year", { ascending: false }).then(({ data }) => {
      const evts = (data ?? []) as OpenCallEvent[];
      setEvents(evts);
      if (evts.length) setEventId((p) => p || evts[0].id);
    });
  }, [supabase, token]);

  const refresh = useCallback(async () => {
    if (!token || !eventId) return;
    const res = await fetch(`/api/opencall/admin/survey?event_id=${eventId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) { setMessage("Admin access required."); return; }
    if (res.ok) setStats((await res.json()) as Stats);
  }, [token, eventId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function call(action: "create" | "send" | "remind", confirm: boolean): Promise<ActionResult> {
    const res = await fetch("/api/opencall/admin/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event_id: eventId, action, confirm }),
    });
    return (await res.json()) as ActionResult;
  }

  // Always preview first. Emailing real parents needs an explicit second yes.
  async function run(action: "create" | "send" | "remind") {
    setBusy(true);
    setMessage("");
    try {
      const preview = await call(action, false);
      if (preview.error) return setMessage(preview.error);
      const n = preview.would_create ?? preview.would_email ?? 0;
      if (n === 0) return setMessage("Nothing to do.");
      const what = action === "create" ? `Create ${n} survey invitation(s)?` : `Email ${n} parent(s) the ${action === "send" ? "survey invitation" : "survey reminder"}? This can't be undone.`;
      if (!window.confirm(what)) return setMessage("Cancelled. Nothing was sent.");
      const done = await call(action, true);
      if (done.error) return setMessage(done.error);
      setMessage(action === "create" ? `Created ${done.created} invitation(s).` : `Sent ${done.sent}. Failed ${done.failed ?? 0}.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const pct = stats && stats.invites ? Math.round((100 * stats.completed) / stats.invites) : 0;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px", fontFamily: "var(--font-inter), sans-serif" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Open Call survey</h1>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
        Participation is tracked per invitation. Anonymous answers are stored with no link back to an invitation, so this page can show how many families responded, never who answered what.
      </p>

      <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, minWidth: 280, marginBottom: 24 }}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
      </select>

      {stats && !stats.configured && (
        <div style={{ padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
          SURVEY_LINK_SECRET isn&apos;t set on this deployment (needs 32+ characters). Survey links won&apos;t work until it is.
        </div>
      )}

      {stats && (
        <>
          <Section title="Funnel">
            <Tiles items={[
              ["Submitted apps", stats.submitted_applications],
              ["Invitations", stats.invites],
              ["Emailed", stats.sent],
              ["Completed", `${stats.completed} (${pct}%)`],
              ["Median time to finish", stats.median_hours_to_complete === null ? "–" : `${stats.median_hours_to_complete} hrs`],
              ["Finished after a reminder", stats.completed_after_reminder],
            ]} />
            <p style={note}>Email opens aren&apos;t tracked (the emails carry no tracking pixel, on purpose). Timing comes from invitations only.</p>
          </Section>

          <Section title="Who responded">
            <Tiles items={[
              ["Responses", stats.responses],
              ["Named", stats.named_responses],
              ["Anonymous", stats.anonymous_responses],
            ]} />
          </Section>

          <Section title="What happened (all responses)">
            <Tiles items={[
              ["Heard from a rep", stats.outcomes.contacted_yes],
              ["No contact", stats.outcomes.contacted_no],
              ["Not sure", stats.outcomes.contacted_unsure],
              ["Had a meeting", stats.outcomes.with_meeting],
              ["Got an offer", stats.outcomes.with_offer],
              ["Signed", stats.outcomes.signed],
              ["Meetings (min.)", stats.outcomes.meetings_total_min],
              ["Offers (min.)", stats.outcomes.offers_total_min],
              ["Submission readiness (avg /5)", stats.outcomes.avg_submission_prepared ?? "–"],
              ["Readiness after contact (avg /5)", stats.outcomes.avg_next_step_prepared ?? "–"],
            ]} />
            <p style={note}>Counts combine named and anonymous answers. With few responses, small numbers can be traceable by process of elimination, so avoid publishing a cell of 1 or 2.</p>
          </Section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={busy} style={btn} onClick={() => run("create")}>1. Create invitations</button>
            <button disabled={busy} style={btn} onClick={() => run("send")}>2. Email invitations</button>
            <button disabled={busy} style={btn} onClick={() => run("remind")}>3. Remind non-responders</button>
          </div>
          <p style={note}>Each button previews the count first and asks before anything is created or emailed.</p>
        </>
      )}
      {message && <p style={{ marginTop: 16, fontSize: 14, fontWeight: 600 }}>{message}</p>}
    </div>
  );
}
