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
  ANON_SHARE_VALUES,
  surveySchema,
} from "@/lib/opencall-survey";
import type { SurveyLinkInfo } from "@/lib/opencall-survey";

type State = {
  is_anonymous: boolean | null;
  prior_representation: string;
  reps_contacted: string;
  rep_contact_count: string;
  outcomes: string[];
  meetings_count: number | null;
  offers_count: number | null;
  signed_with: string;
  prepared_submission: number | null;
  prepared_next_step: number | null;
  support_gaps: string[];
  top_improvement: string;
  additional_comments: string;
  share_consent: string;
  followup_contact: string;
  website: string; // honeypot
};

const blank: State = {
  is_anonymous: null, prior_representation: "", reps_contacted: "", rep_contact_count: "",
  outcomes: [], meetings_count: null, offers_count: null, signed_with: "",
  prepared_submission: null, prepared_next_step: null, support_gaps: [],
  top_improvement: "", additional_comments: "", share_consent: "", followup_contact: "", website: "",
};

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; info: SurveyLinkInfo };

// ─── Styles ──────────────────────────────────────────────────────────────────

const card: CSSProperties = { background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", padding: "22px 22px 8px", marginBottom: 20 };
const sectionLabel: CSSProperties = { fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--marquee)", margin: "0 0 14px" };
const legend: CSSProperties = { fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem", lineHeight: 1.4, padding: 0, marginBottom: 4 };
const hint: CSSProperties = { fontSize: "0.8rem", color: "var(--ink-soft)", margin: "0 0 10px", lineHeight: 1.5 };
const textInput: CSSProperties = { width: "100%", padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: "0.95rem", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };
const primaryBtn: CSSProperties = { padding: "13px 28px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: "1rem", cursor: "pointer" };

// Questions are deliberately unnumbered: branching means numbers would skip.
function Q({ title, hintText, optional, children }: { title: string; hintText?: string; optional?: boolean; children: ReactNode }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 22px", minWidth: 0 }}>
      <legend style={legend}>
        {title}
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
  const [token, setToken] = useState("");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [f, setF] = useState<State>(blank);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { named: boolean; updated: boolean }>(null);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setToken(t);
    if (!t) {
      setLoad({ kind: "error", message: "This survey uses a personal link. Please open it from the email I sent you. Lost it? Write to info@childactor101.com and we'll resend it." });
      return;
    }
    fetch(`/api/opencall/survey?t=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const body = (await r.json()) as SurveyLinkInfo & { error?: string };
        if (!r.ok) return setLoad({ kind: "error", message: body.error ?? "We couldn't load the survey." });
        setLoad({ kind: "ready", info: body });
        if (body.existing) setF(hydrate(body.existing));
      })
      .catch(() => setLoad({ kind: "error", message: "We couldn't load the survey. Please try again in a few minutes." }));
  }, []);

  const set = <K extends keyof State>(k: K, v: State[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: "outcomes" | "support_gaps", v: string, exclusive: string) =>
    setF((p) => {
      const cur = p[k];
      if (cur.includes(v)) return { ...p, [k]: cur.filter((x) => x !== v) };
      return { ...p, [k]: v === exclusive ? [v] : [...cur.filter((x) => x !== exclusive), v] };
    });

  const info = load.kind === "ready" ? load.info : null;
  const editing = !!info?.existing;                     // returning to update a named response
  const anon = f.is_anonymous === true;
  const leftContact = anon && f.followup_contact.trim().length > 0;
  const contacted = f.reps_contacted === "yes";
  const signed = contacted && f.outcomes.includes("signed");
  const shareOptions = SHARE_CONSENT_OPTIONS.filter((o) => !anon || (ANON_SHARE_VALUES as readonly string[]).includes(o.value));

  function chooseAnonymity(isAnon: boolean) {
    setF((p) => ({
      ...p,
      is_anonymous: isAnon,
      followup_contact: isAnon ? p.followup_contact : "",
      share_consent: isAnon && !(ANON_SHARE_VALUES as readonly string[]).includes(p.share_consent) ? "" : p.share_consent,
    }));
  }

  function fail(msg: string) {
    setError(msg);
    setTimeout(() => errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.is_anonymous === null) return fail("Please choose how you'd like to respond: with your actor's name, or anonymously.");

    const payload = {
      is_anonymous: f.is_anonymous,
      followup_contact: f.is_anonymous ? f.followup_contact.trim() || undefined : undefined,
      prior_representation: f.prior_representation || undefined,
      reps_contacted: f.reps_contacted || undefined,
      rep_contact_count: contacted ? f.rep_contact_count || undefined : undefined,
      outcomes: contacted ? f.outcomes : [],
      meetings_count: contacted ? f.meetings_count ?? undefined : undefined,
      offers_count: contacted ? f.offers_count ?? undefined : undefined,
      signed_with: signed ? f.signed_with : undefined,
      prepared_submission: f.prepared_submission ?? undefined,
      prepared_next_step: contacted ? f.prepared_next_step ?? undefined : undefined,
      support_gaps: f.support_gaps,
      top_improvement: f.top_improvement,
      additional_comments: f.additional_comments,
      share_consent: f.share_consent || undefined,
      website: f.website,
    };

    const parsed = surveySchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      // Zod's wording for an unanswered required choice isn't parent-friendly.
      const missingChoice = issue.code === "invalid_type" || issue.code === "invalid_enum_value";
      return fail(missingChoice ? `Please answer: ${labelFor(String(issue.path[0]))}.` : issue.message);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/opencall/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, ...payload }) });
      const body = (await res.json()) as { error?: string; updated?: boolean };
      if (!res.ok) return fail(body.error ?? "We couldn't save your response. Please try again.");
      setDone({ named: !anon || leftContact, updated: !!body.updated });
      window.scrollTo({ top: 0 });
    } catch {
      fail("We couldn't save your response. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--cream)", fontFamily: "var(--font-inter), sans-serif" }}>
      <header style={{ borderBottom: "1px solid var(--hairline)", background: "var(--paper)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 24px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 900 }}>
            Pages<span style={{ color: "var(--marquee)" }}>101</span>
          </Link>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px 80px" }}>{children}</main>
    </div>
  );

  if (load.kind === "loading") return shell(<p style={{ color: "var(--ink-soft)" }}>Loading…</p>);
  if (load.kind === "error") {
    return shell(<div style={{ ...card, padding: 28 }}><p style={{ margin: 0, color: "var(--ink)", lineHeight: 1.6 }}>{load.message}</p></div>);
  }

  // Finished anonymously (or from another device): nothing to edit.
  if (info && info.completed && !info.existing && !done) {
    return shell(
      <div style={{ ...card, padding: 32, textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "1.8rem", margin: "0 0 12px", color: "var(--ink)" }}>You&apos;re all set.</h1>
        <p style={{ color: "var(--ink)", lineHeight: 1.6 }}>
          This survey has already been completed, so there&apos;s nothing more to do. Thank you.
        </p>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
          (Anonymous responses can&apos;t be edited afterward. That&apos;s the price of being anonymous.)
        </p>
      </div>
    );
  }

  if (done) {
    return shell(
      <div style={{ ...card, padding: 32, textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "2rem", margin: "0 0 12px", color: "var(--ink)" }}>
          {done.updated ? "Updated. Thank you." : "Thank you."}
        </h1>
        <p style={{ color: "var(--ink)", lineHeight: 1.6 }}>
          Your answers just made the next Open Call better, and that includes the ones that say &quot;nobody called.&quot; Especially those.
        </p>
        {done.named && (
          <div style={{ textAlign: "left", background: "var(--cream)", borderRadius: 8, padding: "14px 18px", margin: "20px 0 12px" }}>
            <strong style={{ color: "var(--ink)" }}>Still talking with a representative?</strong>
            <p style={{ margin: "6px 0 12px", color: "var(--ink-soft)", fontSize: "0.9rem", lineHeight: 1.5 }}>
              Things move slowly in this business. If anything changes, come back to this same link and update your outcome. It&apos;s in the email I sent you.
            </p>
            <button type="button" onClick={() => setDone(null)} style={{ ...primaryBtn, padding: "10px 20px", fontSize: "0.9rem" }}>
              Update my answers
            </button>
          </div>
        )}
        <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          Questions? Email <a href="mailto:info@childactor101.com">info@childactor101.com</a>.
        </p>
      </div>
    );
  }

  const actorName = info?.actor_name ?? "";

  return shell(
    <form onSubmit={submit} noValidate>
      <p style={{ ...sectionLabel, margin: "0 0 8px" }}>Child Actor 101</p>
      <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "clamp(1.9rem, 5vw, 2.8rem)", lineHeight: 1.1, margin: "0 0 16px", color: "var(--ink)" }}>
        {info?.event.name ?? "Open Call"} Follow-Up Survey
      </h1>
      <div style={{ color: "var(--ink)", lineHeight: 1.6, fontSize: "0.97rem", marginBottom: 24 }}>
        <p style={{ margin: "0 0 12px" }}>
          Now that representatives have had time to review this year&apos;s Open Call, I want to find out what happened next.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          61 talent agents and managers accessed the submissions. What I can&apos;t see is what happened afterward: who received interest, meetings or offers, and how prepared families felt when that interest came.
        </p>
        <p style={{ margin: "0 0 12px" }}>
          Your answers will help me understand what&apos;s working and what I should improve next time.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Please respond even if your actor received no representative interest.</strong> That&apos;s important data, too. Takes about 3 minutes.
        </p>
      </div>

      {/* Honeypot: hidden from people, irresistible to bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label>
      </div>

      {/* ─── Privacy choice ─── */}
      <div style={card}>
        <p style={sectionLabel}>Before we start…</p>
        <p style={{ margin: "0 0 14px", color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.55 }}>
          You can complete this survey with your actor&apos;s name attached or completely anonymously. I want honest feedback, so choose whichever makes you most comfortable.
        </p>
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px", minWidth: 0 }}>
          <legend style={legend}>How would you like to respond?</legend>
          {editing ? (
            <p style={hint}>You&apos;re updating a response you gave with {actorName ? `${actorName}'s` : "your actor's"} name attached.</p>
          ) : (
            <>
              <Choice type="radio" name="anon" checked={f.is_anonymous === false} onChange={() => chooseAnonymity(false)}>
                <strong>With my actor&apos;s name{actorName ? ` (${actorName})` : ""}</strong>
                <br /><span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>This lets me connect your feedback and outcomes with your actor&apos;s Open Call submission.</span>
              </Choice>
              <Choice type="radio" name="anon" checked={f.is_anonymous === true} onChange={() => chooseAnonymity(true)}>
                <strong>Anonymously</strong>
                <br /><span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>Your answers will not be connected to your actor or Open Call submission.</span>
              </Choice>
            </>
          )}
        </fieldset>
      </div>

      {/* ─── What happened ─── */}
      <div style={card}>
        <p style={sectionLabel}>What happened?</p>
        <Q title="When you submitted to the Open Call, what representation did your actor already have?">
          {PRIOR_REP_OPTIONS.map((o) => (
            <Choice key={o.value} type="radio" name="prior" checked={f.prior_representation === o.value} onChange={() => set("prior_representation", o.value)}>{o.label}</Choice>
          ))}
        </Q>
        <Q title="Did any talent agents or managers contact you as a result of the Open Call?">
          {CONTACTED_OPTIONS.map((o) => (
            <Choice key={o.value} type="radio" name="contacted" checked={f.reps_contacted === o.value} onChange={() => set("reps_contacted", o.value)}>{o.label}</Choice>
          ))}
        </Q>

        {f.reps_contacted === "no" && (
          <p style={{ ...hint, marginBottom: 18 }}>Thank you for telling us. That&apos;s real data. We&apos;ll skip the questions about rep responses.</p>
        )}
        {f.reps_contacted === "unsure" && (
          <p style={{ ...hint, marginBottom: 18 }}>That&apos;s helpful to know. We&apos;ll skip the detailed questions about representative responses.</p>
        )}

        {contacted && (
          <>
            <Q title="How many DIFFERENT agents or managers contacted you?">
              <Pills name="repcount" options={REP_COUNT_OPTIONS} value={f.rep_contact_count} onChange={(v) => set("rep_contact_count", v)} />
            </Q>
            <Q title="What resulted from that interest?" hintText="Select all that apply.">
              {OUTCOME_OPTIONS.map((o) => (
                <Choice key={o.value} type="checkbox" name="outcomes" checked={f.outcomes.includes(o.value)} onChange={() => toggle("outcomes", o.value, "nothing_yet")}>{o.label}</Choice>
              ))}
            </Q>
            <Q title="How many meetings with representatives resulted from the Open Call?">
              <Pills name="meetings" options={MEETING_OPTIONS} value={f.meetings_count} onChange={(v) => set("meetings_count", v)} />
            </Q>
            <Q title="How many offers of representation resulted from the Open Call?">
              <Pills name="offers" options={OFFER_OPTIONS} value={f.offers_count} onChange={(v) => set("offers_count", v)} />
            </Q>
            {signed && (
              <Q title="If your actor signed with someone through the Open Call, who did they sign with?" optional
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
        <Q title="Looking back, how prepared do you feel your actor's submission was for representative review?">
          <Scale name="prep1" value={f.prepared_submission} onChange={(v) => set("prepared_submission", v)} />
        </Q>
        {contacted && (
          <Q title="When a representative contacted you, how prepared did you feel to handle the next step?" hintText="Communicating, meeting, evaluating the representative, or considering an offer.">
            <Scale name="prep2" value={f.prepared_next_step} onChange={(v) => set("prepared_next_step", v)} />
          </Q>
        )}
        <Q title="Where could Child Actor 101 have better prepared or supported you?" hintText="Select all that apply.">
          {SUPPORT_GAP_OPTIONS.map((o) => (
            <Choice key={o.value} type="checkbox" name="gaps" checked={f.support_gaps.includes(o.value)} onChange={() => toggle("support_gaps", o.value, "well_prepared")}>{o.label}</Choice>
          ))}
        </Q>
      </div>

      {/* ─── Make the next one better ─── */}
      <div style={card}>
        <p style={sectionLabel}>Help me make the next one better</p>
        <Q title="If you could change, add, or improve ONE thing about the Open Call next time, what would it be?" optional>
          <textarea style={{ ...textInput, minHeight: 110, resize: "vertical" }} value={f.top_improvement} maxLength={4000} onChange={(e) => set("top_improvement", e.target.value)} />
        </Q>
        <Q title="Is there anything else about what happened after you submitted that you think I should know?" optional>
          <textarea style={{ ...textInput, minHeight: 110, resize: "vertical" }} value={f.additional_comments} maxLength={4000} onChange={(e) => set("additional_comments", e.target.value)} />
        </Q>
        <Q title="If I share Open Call results, may I quote your comments?"
           hintText={anon ? "Your name is never attached to an anonymous response, so quotes would be anonymous." : undefined}>
          {shareOptions.map((o) => (
            <Choice key={o.value} type="radio" name="consent" checked={f.share_consent === o.value} onChange={() => set("share_consent", o.value)}>{o.label}</Choice>
          ))}
        </Q>

        {anon && (
          <Q title="If you'd like me to follow up with you about anything you shared, you may leave your name or email below. Otherwise, leave this blank." optional>
            <input style={textInput} value={f.followup_contact} maxLength={254} onChange={(e) => set("followup_contact", e.target.value)} autoComplete="off" />
            {leftContact && (
              <p style={{ ...hint, marginTop: 8, color: "var(--ink)", fontWeight: 600 }}>
                If you fill this in, your response will no longer be anonymous. It will be connected to your actor&apos;s Open Call submission so I can follow up.
              </p>
            )}
          </Q>
        )}
      </div>

      <div ref={errRef}>
        {error && (
          <div role="alert" style={{ padding: "12px 16px", background: "#fdecea", border: "1px solid #f5c2bd", borderRadius: 8, color: "#8a1c12", marginBottom: 16, fontSize: "0.92rem" }}>
            {error}
          </div>
        )}
      </div>
      <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
        {submitting ? "Sending…" : editing ? "Update my answers" : "Submit my answers"}
      </button>
    </form>
  );
}

function hydrate(e: NonNullable<SurveyLinkInfo["existing"]>): State {
  return {
    ...blank,
    is_anonymous: false,
    prior_representation: e.prior_representation ?? "",
    reps_contacted: e.reps_contacted ?? "",
    rep_contact_count: e.rep_contact_count ?? "",
    outcomes: e.outcomes ?? [],
    meetings_count: e.meetings_count ?? null,
    offers_count: e.offers_count ?? null,
    signed_with: e.signed_with ?? "",
    prepared_submission: e.prepared_submission ?? null,
    prepared_next_step: e.prepared_next_step ?? null,
    support_gaps: e.support_gaps ?? [],
    top_improvement: e.top_improvement ?? "",
    additional_comments: e.additional_comments ?? "",
    share_consent: e.share_consent ?? "",
  };
}

function labelFor(path: string): string {
  const map: Record<string, string> = {
    prior_representation: "what representation your actor already had",
    reps_contacted: "whether any agents or managers contacted you",
    prepared_submission: "how prepared your actor's submission was",
    share_consent: "whether I may quote your comments",
  };
  return map[path] ?? "every required question";
}
