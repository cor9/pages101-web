"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  PRIOR_REP_OPTIONS,
  CONTACTED_OPTIONS,
  REP_COUNT_OPTIONS,
  OUTCOME_OPTIONS,
  MEETING_OPTIONS,
  OFFER_OPTIONS,
  PREPARED_SCALE,
  SUPPORT_GAP_OPTIONS,
  SHARE_CONSENT_OPTIONS,
  surveySchema,
} from "@/lib/opencall-survey";

const DONE_KEY = "oc11_survey_done";

// "unset" = not answered yet; "na" = "No representative contacted us"
type NextStep = number | "na" | null;

type State = {
  is_anonymous: boolean | null;
  actor_name: string;
  prior_representation: string;
  reps_contacted: string;
  rep_contact_count: string;
  outcomes: string[];
  meetings_count: number | null;
  offers_count: number | null;
  signed_with: string;
  prepared_submission: number | null;
  prepared_next_step: NextStep;
  support_gaps: string[];
  top_improvement: string;
  additional_comments: string;
  share_consent: string;
  website: string; // honeypot
};

const blank: State = {
  is_anonymous: null, actor_name: "", prior_representation: "", reps_contacted: "",
  rep_contact_count: "", outcomes: [], meetings_count: null, offers_count: null,
  signed_with: "", prepared_submission: null, prepared_next_step: null,
  support_gaps: [], top_improvement: "", additional_comments: "", share_consent: "", website: "",
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const card: CSSProperties = { background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", padding: "22px 22px 8px", marginBottom: 20 };
const sectionLabel: CSSProperties = { fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--marquee)", margin: "0 0 14px" };
const legend: CSSProperties = { fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem", lineHeight: 1.4, padding: 0, marginBottom: 4 };
const hint: CSSProperties = { fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 10px" };
const textInput: CSSProperties = { width: "100%", padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: "0.95rem", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };
const primaryBtn: CSSProperties = { padding: "13px 28px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "1rem", cursor: "pointer" };

function Q({ n, title, hintText, optional, children }: { n: number; title: string; hintText?: string; optional?: boolean; children: ReactNode }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 22px", minWidth: 0 }}>
      <legend style={legend}>
        {n}. {title}
        {optional && <span style={{ fontWeight: 500, color: "var(--ink-soft)" }}> (optional)</span>}
      </legend>
      {hintText && <p style={hint}>{hintText}</p>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </fieldset>
  );
}

function Choice({ type, name, checked, disabled, onChange, children }: {
  type: "radio" | "checkbox"; name: string; checked: boolean; disabled?: boolean; onChange: () => void; children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontSize: "0.92rem", color: "var(--ink)" }}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} style={{ marginTop: 3, accentColor: "var(--marquee)" }} />
      <span>{children}</span>
    </label>
  );
}

function Pills<T extends string | number>({ name, options, value, onChange }: {
  name: string; options: readonly { value: T; label: string }[]; value: T | null | ""; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <label key={String(o.value)} style={{ padding: "9px 18px", borderRadius: 999, border: `1px solid ${on ? "var(--marquee)" : "var(--hairline)"}`, background: on ? "var(--marquee)" : "#fff", color: on ? "#fff" : "var(--ink)", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o.value)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

function Scale({ name, value, onChange }: { name: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
      {PREPARED_SCALE.map((s) => {
        const on = value === s.value;
        return (
          <label key={s.value} style={{ textAlign: "center", padding: "10px 4px", borderRadius: 8, border: `1px solid ${on ? "var(--marquee)" : "var(--hairline)"}`, background: on ? "var(--marquee)" : "#fff", color: on ? "#fff" : "var(--ink)", cursor: "pointer" }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(s.value)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{s.label}</div>
            <div style={{ fontSize: "0.68rem", lineHeight: 1.25, marginTop: 2 }}>{s.detail}</div>
          </label>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OpenCallSurvey() {
  const [f, setF] = useState<State>(blank);
  const [eventName, setEventName] = useState("Open Call 11");
  const [open, setOpen] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { if (localStorage.getItem(DONE_KEY)) setAlreadyDone(true); } catch { /* storage blocked */ }
    fetch("/api/opencall/survey")
      .then((r) => r.json())
      .then((b: { event?: { name: string } | null }) => {
        setOpen(!!b.event);
        if (b.event?.name) setEventName(b.event.name);
      })
      .catch(() => setOpen(true));
  }, []);

  const set = <K extends keyof State>(k: K, v: State[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: "outcomes" | "support_gaps", v: string, exclusive: string) =>
    setF((p) => {
      const cur = p[k];
      if (cur.includes(v)) return { ...p, [k]: cur.filter((x) => x !== v) };
      return { ...p, [k]: v === exclusive ? [v] : [...cur.filter((x) => x !== exclusive), v] };
    });

  const anon = f.is_anonymous === true;
  const noContact = f.reps_contacted === "no";
  const showRepQs = f.reps_contacted === "yes" || f.reps_contacted === "unsure";
  const signed = showRepQs && f.outcomes.includes("signed");

  function chooseAnonymity(isAnon: boolean) {
    setF((p) => ({
      ...p,
      is_anonymous: isAnon,
      actor_name: isAnon ? "" : p.actor_name,
      share_consent: isAnon && p.share_consent === "first_names" ? "" : p.share_consent,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.is_anonymous === null) return fail("Please choose whether to put your actor's name on this response or keep it anonymous.");

    const payload = {
      is_anonymous: f.is_anonymous,
      actor_name: f.is_anonymous ? undefined : f.actor_name,
      prior_representation: f.prior_representation || undefined,
      reps_contacted: f.reps_contacted || undefined,
      rep_contact_count: showRepQs ? f.rep_contact_count || undefined : undefined,
      outcomes: showRepQs ? f.outcomes : [],
      meetings_count: showRepQs ? f.meetings_count ?? undefined : undefined,
      offers_count: showRepQs ? f.offers_count ?? undefined : undefined,
      signed_with: signed ? f.signed_with : undefined,
      prepared_submission: f.prepared_submission ?? undefined,
      prepared_next_step: noContact ? null : f.prepared_next_step === "na" ? null : f.prepared_next_step ?? undefined,
      support_gaps: f.support_gaps,
      top_improvement: f.top_improvement,
      additional_comments: f.additional_comments,
      share_consent: f.share_consent || undefined,
      website: f.website,
    };

    const parsed = surveySchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path[0];
      // Zod's own wording for an unanswered required choice is unhelpful to a parent.
      const missingChoice = issue.code === "invalid_type" || issue.code === "invalid_enum_value";
      return fail(missingChoice ? `Please answer: ${labelFor(String(path))}.` : issue.message);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/opencall/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) return fail(body.error ?? "We couldn't save your response. Please try again.");
      try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch {
      fail("We couldn't save your response. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function fail(msg: string) {
    setError(msg);
    setTimeout(() => errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", fontFamily: "var(--font-inter), sans-serif" }}>
      <header style={{ borderBottom: "1px solid var(--hairline)", background: "var(--paper)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 24px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 900 }}>
            Pages<span style={{ color: "var(--marquee)" }}>101</span>
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px 80px" }}>
        {done ? (
          <div style={{ ...card, padding: 32, textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "2rem", margin: "0 0 12px", color: "var(--ink)" }}>Thank you.</h1>
            <p style={{ color: "var(--ink)", lineHeight: 1.6 }}>
              Your answers just made the next Open Call better, and that includes the ones that say &quot;nobody called.&quot; Especially those.
            </p>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              You can close this page. Questions? Email <a href="mailto:info@childactor101.com">info@childactor101.com</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p style={{ ...sectionLabel, margin: "0 0 8px" }}>Child Actor 101</p>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "clamp(1.9rem, 5vw, 2.8rem)", lineHeight: 1.1, margin: "0 0 16px", color: "var(--ink)" }}>
              {eventName} Follow-Up Survey
            </h1>
            <div style={{ color: "var(--ink)", lineHeight: 1.6, fontSize: "0.97rem", marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px" }}>
                Now that representatives have had time to review the submissions, I want to find out what happened. We know 61 talent agents and managers accessed this year&apos;s Open Call. What I can&apos;t see is who they contacted, what kind of interest actors received, whether meetings or offers resulted, and how prepared families felt when that interest came.
              </p>
              <p style={{ margin: "0 0 12px" }}>
                This isn&apos;t just a satisfaction survey. Your answers will help me understand what is actually working and what I need to improve for the next Open Call.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Please respond even if your actor received no representative interest.</strong> That&apos;s important data, too. It takes about 3 minutes.
              </p>
            </div>

            {alreadyDone && (
              <div style={{ padding: "12px 16px", background: "#fff8e1", border: "1px solid #f0d98a", borderRadius: 8, marginBottom: 20, fontSize: "0.9rem", color: "var(--ink)" }}>
                It looks like you already submitted a response from this browser. One response per actor please, so if that&apos;s you, thank you and you&apos;re all set. If you have more than one actor in the Open Call, carry on.
              </div>
            )}
            {open === false && (
              <div style={{ padding: "12px 16px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 8, marginBottom: 20, color: "var(--ink-soft)" }}>
                This survey isn&apos;t open yet. Check back soon.
              </div>
            )}

            {/* Honeypot: hidden from people, irresistible to bots */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label>
            </div>

            {/* ─── Privacy choice ─── */}
            <div style={card}>
              <p style={sectionLabel}>Your privacy</p>
              <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px", minWidth: 0 }}>
                <legend style={legend}>How would you like to respond?</legend>
                <p style={hint}>
                  If you choose anonymous, we don&apos;t ask for or store your actor&apos;s name, and nothing in the database connects your answers to your application, your email, or you.
                </p>
                <Choice type="radio" name="anon" checked={f.is_anonymous === false} onChange={() => chooseAnonymity(false)}>
                  <strong>With my actor&apos;s name.</strong> Lets me follow up and connect your results to your actor.
                </Choice>
                <Choice type="radio" name="anon" checked={f.is_anonymous === true} onChange={() => chooseAnonymity(true)}>
                  <strong>Anonymously.</strong> Same questions, no name attached.
                </Choice>
              </fieldset>
            </div>

            {/* ─── Your actor ─── */}
            <div style={card}>
              <p style={sectionLabel}>Your actor</p>
              {f.is_anonymous === false && (
                <Q n={1} title="Actor's name">
                  <input style={textInput} value={f.actor_name} maxLength={120} onChange={(e) => set("actor_name", e.target.value)} autoComplete="off" />
                </Q>
              )}
              {anon && <p style={{ ...hint, marginBottom: 18 }}>Question 1 (actor&apos;s name) skipped. You&apos;re anonymous.</p>}
              <Q n={2} title="Before the Open Call, what representation did your actor have?">
                {PRIOR_REP_OPTIONS.map((o) => (
                  <Choice key={o.value} type="radio" name="prior" checked={f.prior_representation === o.value} onChange={() => set("prior_representation", o.value)}>{o.label}</Choice>
                ))}
              </Q>
            </div>

            {/* ─── What happened ─── */}
            <div style={card}>
              <p style={sectionLabel}>What happened?</p>
              <Q n={3} title="Did any talent agents or managers contact you as a result of the Open Call?">
                {CONTACTED_OPTIONS.map((o) => (
                  <Choice key={o.value} type="radio" name="contacted" checked={f.reps_contacted === o.value} onChange={() => set("reps_contacted", o.value)}>{o.label}</Choice>
                ))}
              </Q>

              {noContact && (
                <p style={{ ...hint, marginBottom: 18 }}>
                  Thank you for telling us. That&apos;s real data. We&apos;ll skip the questions about rep responses.
                </p>
              )}

              {showRepQs && (
                <>
                  <Q n={4} title="How many DIFFERENT agents or managers contacted you?">
                    <Pills name="repcount" options={REP_COUNT_OPTIONS} value={f.rep_contact_count} onChange={(v) => set("rep_contact_count", v)} />
                  </Q>
                  <Q n={5} title="What resulted from that interest?" hintText="Select all that apply.">
                    {OUTCOME_OPTIONS.map((o) => (
                      <Choice key={o.value} type="checkbox" name="outcomes" checked={f.outcomes.includes(o.value)} onChange={() => toggle("outcomes", o.value, "nothing_yet")}>{o.label}</Choice>
                    ))}
                  </Q>
                  <Q n={6} title="How many meetings with representatives resulted from the Open Call?">
                    <Pills name="meetings" options={MEETING_OPTIONS} value={f.meetings_count} onChange={(v) => set("meetings_count", v)} />
                  </Q>
                  <Q n={7} title="How many offers of representation resulted from the Open Call?">
                    <Pills name="offers" options={OFFER_OPTIONS} value={f.offers_count} onChange={(v) => set("offers_count", v)} />
                  </Q>
                  {signed && (
                    <Q n={8} title="If your actor signed with someone through the Open Call, who did they sign with?" optional
                       hintText={anon ? "Heads up: naming the rep may make an anonymous response easier to identify. Skip it if you'd rather." : undefined}>
                      <input style={textInput} value={f.signed_with} maxLength={200} onChange={(e) => set("signed_with", e.target.value)} />
                    </Q>
                  )}
                </>
              )}
            </div>

            {/* ─── Were you ready ─── */}
            <div style={card}>
              <p style={sectionLabel}>Were you ready?</p>
              <Q n={9} title="BEFORE submitting, how prepared did you feel to create a strong representation submission?">
                <Scale name="prep1" value={f.prepared_submission} onChange={(v) => set("prepared_submission", v)} />
              </Q>
              {!noContact && (
                <Q n={10} title="If a representative contacted you, how prepared did you feel to handle the next step: communicating, meeting, evaluating the representative, or considering an offer?">
                  <Scale name="prep2" value={typeof f.prepared_next_step === "number" ? f.prepared_next_step : null} onChange={(v) => set("prepared_next_step", v)} />
                  <div style={{ marginTop: 8 }}>
                    <Choice type="radio" name="prep2na" checked={f.prepared_next_step === "na"} onChange={() => set("prepared_next_step", "na")}>
                      No representative contacted us
                    </Choice>
                  </div>
                </Q>
              )}
              <Q n={11} title="Where could Child Actor 101 have better prepared or supported you?" hintText="Select all that apply.">
                {SUPPORT_GAP_OPTIONS.map((o) => (
                  <Choice key={o.value} type="checkbox" name="gaps" checked={f.support_gaps.includes(o.value)} onChange={() => toggle("support_gaps", o.value, "well_prepared")}>{o.label}</Choice>
                ))}
              </Q>
            </div>

            {/* ─── Make the next one better ─── */}
            <div style={card}>
              <p style={sectionLabel}>Help me make the next one better</p>
              <Q n={12} title="What is the ONE thing you would change, add, or improve about the Open Call next time?">
                <textarea style={{ ...textInput, minHeight: 110, resize: "vertical" }} value={f.top_improvement} maxLength={4000} onChange={(e) => set("top_improvement", e.target.value)} />
              </Q>
              <Q n={13} title="Is there anything else about what happened after you submitted that you think I should know?" optional>
                <textarea style={{ ...textInput, minHeight: 110, resize: "vertical" }} value={f.additional_comments} maxLength={4000} onChange={(e) => set("additional_comments", e.target.value)} />
              </Q>
              <Q n={14} title="May Child Actor 101 use your response when sharing Open Call results or experiences with other families?">
                {SHARE_CONSENT_OPTIONS.map((o) => (
                  <Choice key={o.value} type="radio" name="consent" checked={f.share_consent === o.value} disabled={anon && o.value === "first_names"} onChange={() => set("share_consent", o.value)}>
                    {o.label}
                    {anon && o.value === "first_names" && <em style={{ color: "var(--ink-soft)" }}> (not available on anonymous responses)</em>}
                  </Choice>
                ))}
              </Q>
            </div>

            <div ref={errRef}>
              {error && (
                <div role="alert" style={{ padding: "12px 16px", background: "#fdecea", border: "1px solid #f5c2bd", borderRadius: 8, color: "#8a1c12", marginBottom: 16, fontSize: "0.92rem" }}>
                  {error}
                </div>
              )}
            </div>
            <button type="submit" disabled={submitting || open === false} style={{ ...primaryBtn, opacity: submitting || open === false ? 0.6 : 1 }}>
              {submitting ? "Sending…" : "Submit my answers"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function labelFor(path: string): string {
  const map: Record<string, string> = {
    prior_representation: "question 2 (what representation your actor had before the Open Call)",
    reps_contacted: "question 3 (whether any agents or managers contacted you)",
    prepared_submission: "question 9 (how prepared you felt before submitting)",
    share_consent: "question 14 (whether we may share your response)",
  };
  return map[path] ?? "every required question";
}
