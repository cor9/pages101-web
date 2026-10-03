"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OpenCallEvent } from "@/lib/opencall";
import type { SurveySummary, Distribution, Pct } from "@/lib/opencall-survey-stats";

type Stats = { configured: boolean; submitted_applications: number; summary: SurveySummary };

type ActionResult = { dry_run?: boolean; would_create?: number; would_email?: number; created?: number; sent?: number; failed?: number; error?: string };

const btn = { padding: "9px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 } as const;
const note = { color: "#64748b", fontSize: 13, margin: "10px 0 0", lineHeight: 1.5 } as const;
const th = { textAlign: "left", fontSize: 12, color: "#64748b", fontWeight: 600, padding: "8px 12px", borderBottom: "1px solid #e2e8f0" } as const;
const td = { padding: "9px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 14 } as const;

const p = (v: Pct) => (v === null ? "–" : `${v}%`);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.07em", color: "#475569", margin: "0 0 10px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Tiles({ items }: { items: [string, string | number, string?][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {items.map(([k, v, sub]) => (
        <div key={k} style={{ padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{k}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
          {sub && <div style={{ fontSize: 12, color: "#64748b" }}>{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
    </div>
  );
}

// The shape matters more than the average: a 3.8 can be "everyone said 4" or "half said 2, half said 5".
function Bars({ title, d }: { title: string; d: Distribution }) {
  const max = Math.max(1, ...d.counts);
  const labels = ["1 Not", "2 Slightly", "3 Fairly", "4 Well", "5 Extremely"];
  return (
    <div style={{ flex: "1 1 300px", padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
        n = {d.n}{d.avg !== null && ` · average ${d.avg} / 5`}
      </div>
      {d.counts.map((c, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "86px 1fr 52px", alignItems: "center", gap: 8, fontSize: 12, margin: "4px 0" }}>
          <span style={{ color: "#475569" }}>{labels[i]}</span>
          <div style={{ background: "#f1f5f9", borderRadius: 3, height: 14 }}>
            <div style={{ width: `${(100 * c) / max}%`, background: "#c8402a", height: 14, borderRadius: 3 }} />
          </div>
          <span style={{ textAlign: "right", color: "#475569" }}>{c}{d.n ? ` · ${Math.round((100 * c) / d.n)}%` : ""}</span>
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
      if (evts.length) setEventId((prev) => prev || evts[0].id);
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

  const s = stats?.summary;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px", fontFamily: "var(--font-inter), sans-serif" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Open Call survey</h1>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
        Participation is tracked per invitation. Anonymous answers are stored with no link back to an invitation, so this page can show how many families responded, never who answered what. It shows aggregates only: no individual answers and no free-text comments.
      </p>

      <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, minWidth: 280, marginBottom: 24 }}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.status})</option>)}
      </select>

      {stats && !stats.configured && (
        <div style={{ padding: "12px 16px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
          SURVEY_LINK_SECRET isn&apos;t set on this deployment (needs 32+ characters). Survey links won&apos;t work until it is.
        </div>
      )}

      {stats && s && (
        <>
          <Section title="Invitations">
            <Tiles items={[
              ["Submitted apps", stats.submitted_applications],
              ["Invitations", s.participation.invites],
              ["Emailed", s.participation.sent],
              ["Completed", s.participation.completed, `${p(s.participation.completed_pct_of_invites)} of invitations`],
              ["Median time to finish", s.participation.median_hours_to_complete === null ? "–" : `${s.participation.median_hours_to_complete} hrs`, "after the email was sent"],
              ["Finished after a reminder", s.participation.completed_after_reminder],
            ]} />
            <p style={note}>Email opens aren&apos;t tracked (no tracking pixel, on purpose). Timing comes from invitations only.</p>
          </Section>

          <Section title="Who responded">
            <Tiles items={[
              ["Respondents", s.respondents.total],
              ["Named", s.respondents.named, `${p(s.respondents.total ? Math.round((100 * s.respondents.named) / s.respondents.total) : null)} of respondents`],
              ["Anonymous", s.respondents.anonymous, `${p(s.respondents.anonymous_pct)} of respondents`],
            ]} />
          </Section>

          <Section title="Outcome funnel">
            <Table>
              <thead>
                <tr><th style={th}>Stage</th><th style={th}>Actors</th><th style={th}>% of respondents</th><th style={th}>% of actors contacted</th></tr>
              </thead>
              <tbody>
                {s.stages.map((st) => (
                  <tr key={st.key}>
                    <td style={td}>{st.label}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{st.count}</td>
                    <td style={td}>{st.key === "respondents" ? "–" : p(st.of_respondents)}</td>
                    <td style={td}>{st.key === "respondents" || st.key === "contacted" ? "–" : p(st.of_contacted)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div style={{ marginTop: 14 }}>
              <Table>
                <thead><tr><th style={th}>Conversion</th><th style={th}>Result</th><th style={th}>Out of</th></tr></thead>
                <tbody>
                  {s.conversions.map((c) => (
                    <tr key={c.label}>
                      <td style={td}>{c.label}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{c.count} ({p(c.pct)})</td>
                      <td style={td}>{c.base} {c.base_label}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p style={note}>
              Meetings and offers are minimums (the form tops out at &ldquo;4+&rdquo; and &ldquo;3+&rdquo;): at least {s.totals.meetings_min} meetings and {s.totals.offers_min} offers reported. A signing counts as an offer.
            </p>
          </Section>

          <Section title="Outcomes by representation at submission">
            <Table>
              <thead>
                <tr><th style={th}>Had at submission</th><th style={th}>Respondents</th><th style={th}>Heard from a rep</th><th style={th}>Meeting</th><th style={th}>Offer</th><th style={th}>Signed</th></tr>
              </thead>
              <tbody>
                {s.by_representation.map((r) => (
                  <tr key={r.key}>
                    <td style={td}>{r.label}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.respondents}</td>
                    <td style={td}>{r.contacted}{r.contacted_pct !== null && ` (${r.contacted_pct}%)`}</td>
                    <td style={td}>{r.meeting}</td>
                    <td style={td}>{r.offer}</td>
                    <td style={td}>{r.signed}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p style={note}>
              Counts of 1 or 2 show as &ldquo;&lt;3&rdquo;, and a percentage only appears once a group has 5+ respondents, so small groups can&apos;t be picked out by elimination. Percent is of that row&apos;s respondents.
            </p>
          </Section>

          <Section title="Preparedness">
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Bars title="Submission readiness, looking back" d={s.preparedness.submission} />
              <Bars title="Readiness for the rep's next step (contacted only)" d={s.preparedness.next_step} />
            </div>
            <p style={note}>Full distribution shown alongside the average: a 3.8 can mean everyone said 4, or a split between 2s and 5s.</p>
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
