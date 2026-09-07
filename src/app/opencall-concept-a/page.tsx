import type { Metadata } from "next";
import { OC, TRUST_SENTENCE } from "@/lib/opencall-concept-content";

export const metadata: Metadata = {
  title: "Open Call — Editorial (Concept A)",
  description: "Static visual direction A for the Child Actor 101 Open Call.",
};

/* ── Concept A · Editorial Casting Call ──────────────────────────────────────
   Warm cream, oversized Fraunces serif, single strong red/orange accent,
   cinematic portrait plates. Industry-facing, magazine-like — deliberately
   NOT a SaaS page. Art-directed portrait placeholders stand in for real
   youth headshots. Static mockup only. */

const C = {
  cream: "#F4ECE0",
  paper: "#FBF6EE",
  ink: "#241C17",
  soft: "#6A5C50",
  line: "rgba(36,28,23,0.14)",
  accent: "#C43E23", // strong red/orange
  accentDeep: "#8F2A16",
  plate: "#E7DBCB",
};

// Cinematic duotone portrait plate (stands in for a real headshot).
function Portrait({ tone = 0, ratio = "3 / 4", label }: { tone?: number; ratio?: string; label?: string }) {
  const tints = ["#D9C6AF", "#CBB79C", "#E0CDB4", "#C9B091"];
  const base = tints[tone % tints.length];
  return (
    <figure
      style={{
        margin: 0,
        aspectRatio: ratio,
        background: base,
        border: `1px solid ${C.line}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g fill={C.accentDeep} opacity="0.30">
          <circle cx="150" cy="150" r="66" />
          <path d="M40 400c0-70 44-120 110-120s110 50 110 120z" />
        </g>
      </svg>
      {label && (
        <figcaption
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.ink,
            background: "rgba(251,246,238,0.85)",
            padding: "3px 8px",
            fontWeight: 700,
          }}
        >
          {label}
        </figcaption>
      )}
    </figure>
  );
}

function Rule({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "0 0 28px" }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

const serif = "var(--font-fraunces), Georgia, serif";
const sans = "var(--font-inter), system-ui, sans-serif";

export default function ConceptA() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: sans, minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>
            {OC.org}
          </div>
          <nav style={{ display: "flex", gap: 28, fontSize: 13, letterSpacing: "0.02em", color: C.soft }}>
            <span>The Open Call</span>
            <span>How it works</span>
            <span>Privacy</span>
          </nav>
          <a href="#apply" style={{ fontSize: 13, fontWeight: 700, color: C.paper, background: C.accent, padding: "9px 18px", textDecoration: "none" }}>
            Apply
          </a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 32px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 56, alignItems: "end" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent, margin: "0 0 22px" }}>
              {OC.hero.eyebrow}
            </p>
            <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 0.98, letterSpacing: "-0.02em", margin: "0 0 26px" }}>
              The Online <span style={{ fontStyle: "italic", color: C.accent }}>Talent</span> Representation Open&nbsp;Call
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: C.soft, maxWidth: 560, margin: "0 0 30px" }}>
              {OC.hero.subhead}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <a href="#apply" style={{ background: C.ink, color: C.paper, padding: "15px 30px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                {OC.hero.primaryCta}
              </a>
              <a href="#how" style={{ color: C.ink, fontSize: 15, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 5, textDecorationColor: C.accent }}>
                {OC.hero.secondaryCta}
              </a>
            </div>
            <p style={{ fontSize: 13, color: C.soft, marginTop: 20, letterSpacing: "0.02em" }}>{OC.hero.note}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ marginTop: 28 }}><Portrait tone={0} label="Theatrical" /></div>
            <Portrait tone={1} label="Commercial" />
            <Portrait tone={2} label="Musical Theater" />
            <div style={{ marginTop: -28 }}><Portrait tone={3} label="Voiceover" /></div>
          </div>
        </div>
      </section>

      {/* Marquee trust strip */}
      <section style={{ background: C.ink, color: C.paper, padding: "18px 0", overflow: "hidden" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 32px", display: "flex", flexWrap: "wrap", gap: "12px 40px", justifyContent: "space-between" }}>
          {OC.stats.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 600 }}>{s.value}</span>
              <span style={{ fontSize: 13, color: "rgba(251,246,238,0.7)", letterSpacing: "0.02em" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* What it is */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 64, alignItems: "start" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 3.4vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
            {OC.what.heading}
          </h2>
          <div>
            <p style={{ fontSize: 21, lineHeight: 1.6, margin: "0 0 20px" }}>{OC.what.body}</p>
            <p style={{ fontSize: 21, lineHeight: 1.6, margin: 0, color: C.accent, fontFamily: serif, fontStyle: "italic" }}>
              {OC.what.tail}
            </p>
          </div>
        </div>
      </section>

      {/* Why families trust it */}
      <section style={{ background: C.paper, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
          <Rule label={OC.trust.heading} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "40px 64px" }}>
            {OC.trust.points.map((p, i) => (
              <div key={p.title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18 }}>
                <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 24, color: C.accent, lineHeight: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 22, margin: "0 0 8px" }}>{p.title}</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: C.soft, margin: 0 }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust sentence — the promise, set as a pull quote */}
          <blockquote
            style={{
              margin: "56px 0 0",
              paddingTop: 40,
              borderTop: `2px solid ${C.accent}`,
              fontFamily: serif,
              fontWeight: 500,
              fontStyle: "italic",
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              maxWidth: 900,
            }}
          >
            “{TRUST_SENTENCE}”
          </blockquote>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <Rule label={OC.how.heading} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderLeft: `1px solid ${C.line}` }}>
          {OC.how.steps.map((s) => (
            <div key={s.n} style={{ borderRight: `1px solid ${C.line}`, padding: "6px 24px 0" }}>
              <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 44, color: C.accent, lineHeight: 1, marginBottom: 18 }}>{s.n}</div>
              <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 10px" }}>{s.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: C.soft, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who should apply + Important dates */}
      <section style={{ background: C.ink, color: C.paper }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 72 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, margin: "0 0 24px" }}>
              {OC.who.heading}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {OC.who.items.map((it) => (
                <li key={it} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, padding: "18px 0", borderTop: "1px solid rgba(251,246,238,0.16)", fontSize: 18, lineHeight: 1.5 }}>
                  <span style={{ color: C.accent, fontFamily: serif, fontSize: 20 }}>—</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, margin: "0 0 24px" }}>
              {OC.dates.heading}
            </p>
            {OC.dates.items.map((d) => (
              <div key={d.label} style={{ padding: "18px 0", borderTop: "1px solid rgba(251,246,238,0.16)" }}>
                <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(251,246,238,0.6)", marginBottom: 6 }}>{d.label}</div>
                <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600 }}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What representatives see */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <Rule label={OC.reps.heading} />
        <p style={{ fontSize: 21, lineHeight: 1.6, maxWidth: 720, margin: "0 0 40px" }}>{OC.reps.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 32 }}>
            <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 18px" }}>Reviewers see</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {OC.reps.see.map((s) => (
                <li key={s} style={{ display: "flex", gap: 12, fontSize: 15.5, lineHeight: 1.45 }}>
                  <span style={{ color: C.accent, fontWeight: 800 }}>+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: C.ink, color: C.paper, padding: 32 }}>
            <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 18px", color: C.paper }}>{OC.reps.neverHeading}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {OC.reps.never.map((s) => (
                <li key={s} style={{ display: "flex", gap: 12, fontSize: 15.5, lineHeight: 1.45, color: "rgba(251,246,238,0.86)" }}>
                  <span style={{ color: C.accent, fontWeight: 800 }}>—</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Privacy & guardian contact */}
      <section style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 32px", textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, margin: "0 0 20px" }}>
            {OC.privacy.heading}
          </p>
          <p style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(1.5rem, 2.6vw, 2rem)", lineHeight: 1.4, letterSpacing: "-0.01em", margin: "0 0 20px" }}>
            {OC.privacy.body}
          </p>
          <p style={{ fontSize: 16, color: C.soft, margin: 0 }}>{OC.privacy.tail}</p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <Rule label={OC.faq.heading} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "40px 64px" }}>
          {OC.faq.items.map((f) => (
            <div key={f.q}>
              <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 20, margin: "0 0 10px" }}>{f.q}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: C.soft, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section id="apply" style={{ background: C.accent, color: C.paper }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "96px 32px", textAlign: "center" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            {OC.finalCta.heading}
          </h2>
          <p style={{ fontSize: 20, margin: "0 0 32px", color: "rgba(251,246,238,0.92)" }}>{OC.finalCta.body}</p>
          <a href="#" style={{ display: "inline-block", background: C.ink, color: C.paper, padding: "17px 40px", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
            {OC.finalCta.cta}
          </a>
          <p style={{ fontSize: 13, marginTop: 18, color: "rgba(251,246,238,0.8)", letterSpacing: "0.02em" }}>{OC.finalCta.note}</p>
        </div>
      </section>

      <footer style={{ background: C.ink, color: "rgba(251,246,238,0.6)", fontSize: 13 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span>{OC.org} · {OC.brand}</span>
          <span>“{TRUST_SENTENCE}”</span>
        </div>
      </footer>
    </div>
  );
}
