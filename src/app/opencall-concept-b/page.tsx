import type { Metadata } from "next";
import { OC, TRUST_SENTENCE } from "@/lib/opencall-concept-content";

export const metadata: Metadata = {
  title: "Open Call — Modern (Concept B)",
  description: "Static visual direction B for the Child Actor 101 Open Call.",
};

/* ── Concept B · Modern Youth Industry ───────────────────────────────────────
   Dark high-contrast hero, bold contemporary sans (Bricolage / Outfit),
   rounded photography, graphic color blocks, prominent stats + process.
   Energetic and current without feeling childish. Static mockup only.
   Art-directed rounded portrait placeholders stand in for real headshots. */

const C = {
  bg: "#141210",
  bg2: "#1D1A16",
  ink: "#F6F1E9",
  soft: "#B7ADA0",
  line: "rgba(246,241,233,0.14)",
  lime: "#E9F27A", // graphic accent block
  coral: "#FF6A47",
  blue: "#8FB8FF",
  cream: "#F6F1E9",
};

const display = "var(--font-bricolage), var(--font-outfit), system-ui, sans-serif";
const sans = "var(--font-inter), system-ui, sans-serif";

function RoundPortrait({ tone = 0, block }: { tone?: number; block: string }) {
  const bases = ["#4A4038", "#5A4A3E", "#463F39", "#544A3C"];
  const base = bases[tone % bases.length];
  return (
    <div
      style={{
        aspectRatio: "3 / 4",
        borderRadius: 22,
        background: base,
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${C.line}`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: block, mixBlendMode: "soft-light" }} />
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g fill="#000" opacity="0.28">
          <circle cx="150" cy="155" r="64" />
          <path d="M46 400c0-66 46-116 104-116s104 50 104 116z" />
        </g>
      </svg>
    </div>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
      {children}
    </span>
  );
}

export default function ConceptB() {
  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: sans, minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(20,18,16,0.85)", backdropFilter: "saturate(140%) blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>
            {OC.org}
          </div>
          <nav style={{ display: "flex", gap: 26, fontSize: 14, color: C.soft, fontWeight: 500 }}>
            <span>Open Call</span>
            <span>How it works</span>
            <span>For families</span>
          </nav>
          <a href="#apply" style={{ background: C.lime, color: C.bg, borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
            Apply now
          </a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "64px 32px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <Pill bg={C.coral} fg={C.bg}>{OC.edition}</Pill>
              <Pill bg="transparent" fg={C.soft}>Now open · 2026</Pill>
            </div>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.8rem, 6.4vw, 5.4rem)", lineHeight: 0.95, letterSpacing: "-0.03em", margin: "0 0 24px" }}>
              One profile.<br />
              <span style={{ color: C.lime }}>Real reps</span> reviewing.
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: C.soft, maxWidth: 520, margin: "0 0 32px" }}>
              {OC.hero.subhead}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <a href="#apply" style={{ background: C.lime, color: C.bg, borderRadius: 999, padding: "16px 32px", fontSize: 16, fontWeight: 800, textDecoration: "none" }}>
                {OC.hero.primaryCta}
              </a>
              <a href="#how" style={{ color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "16px 28px", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
                {OC.hero.secondaryCta}
              </a>
            </div>
            <p style={{ fontSize: 14, color: C.soft, marginTop: 20 }}>{OC.hero.note}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <RoundPortrait tone={0} block={C.coral} />
              <RoundPortrait tone={1} block={C.blue} />
            </div>
            <div style={{ display: "grid", gap: 14, marginTop: 36 }}>
              <RoundPortrait tone={2} block={C.lime} />
              <RoundPortrait tone={3} block={C.coral} />
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 32px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {OC.stats.map((s, i) => {
            const bgs = [C.lime, C.bg2, C.bg2, C.bg2];
            const fgs = [C.bg, C.ink, C.ink, C.ink];
            return (
              <div key={s.label} style={{ background: bgs[i], color: fgs[i], borderRadius: 20, padding: "26px 24px", border: i === 0 ? "none" : `1px solid ${C.line}` }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 44, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.value}</div>
                <div style={{ fontSize: 14, marginTop: 8, opacity: 0.85 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* What it is — big statement on cream block */}
      <section style={{ background: C.cream, color: "#1B1712" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: C.coral, margin: "0 0 24px" }}>
            {OC.what.heading}
          </p>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 3.2rem)", lineHeight: 1.12, letterSpacing: "-0.02em", margin: "0 0 20px", maxWidth: 1000 }}>
            {OC.what.body}
          </p>
          <p style={{ fontSize: 20, fontWeight: 600, color: C.coral, margin: 0 }}>{OC.what.tail}</p>
        </div>
      </section>

      {/* Why families trust it */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>
          {OC.trust.heading}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {OC.trust.points.map((p, i) => {
            const accents = [C.lime, C.coral, C.blue, C.lime];
            return (
              <div key={p.title} style={{ background: C.bg2, borderRadius: 20, padding: 30, border: `1px solid ${C.line}` }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: accents[i], color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, marginBottom: 18 }}>
                  {i + 1}
                </div>
                <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 21, margin: "0 0 8px" }}>{p.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: C.soft, margin: 0 }}>{p.body}</p>
              </div>
            );
          })}
        </div>

        {/* Trust promise — bold color block */}
        <div style={{ background: C.lime, color: C.bg, borderRadius: 24, padding: "44px 40px", marginTop: 16, textAlign: "center" }}>
          <p style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(1.5rem, 3.2vw, 2.4rem)", lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0 }}>
            “{TRUST_SENTENCE}”
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ background: C.bg2, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>
            {OC.how.heading}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {OC.how.steps.map((s, i) => {
              const accents = [C.lime, C.blue, C.coral, C.lime];
              return (
                <div key={s.n} style={{ background: C.bg, borderRadius: 20, padding: 26, border: `1px solid ${C.line}`, position: "relative" }}>
                  <div style={{ fontFamily: display, fontWeight: 800, fontSize: 15, color: accents[i], letterSpacing: "0.1em", marginBottom: 44 }}>STEP {s.n}</div>
                  <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 19, margin: "0 0 10px" }}>{s.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: C.soft, margin: 0 }}>{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who + Dates */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: C.coral, color: C.bg, borderRadius: 24, padding: 36 }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 26, margin: "0 0 22px" }}>{OC.who.heading}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {OC.who.items.map((it) => (
              <li key={it} style={{ display: "flex", gap: 12, fontSize: 16.5, lineHeight: 1.5, fontWeight: 500 }}>
                <span style={{ fontWeight: 800 }}>↳</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: C.bg2, borderRadius: 24, padding: 36, border: `1px solid ${C.line}` }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 26, margin: "0 0 22px" }}>{OC.dates.heading}</h2>
          <div>
            {OC.dates.items.map((d, i) => (
              <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                <span style={{ fontSize: 15, color: C.soft }}>{d.label}</span>
                <span style={{ fontFamily: display, fontWeight: 700, fontSize: 17, textAlign: "right" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What reps see */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px 88px" }}>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          {OC.reps.heading}
        </h2>
        <p style={{ fontSize: 18, color: C.soft, maxWidth: 660, margin: "0 0 32px" }}>{OC.reps.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div style={{ background: C.bg2, borderRadius: 20, padding: 32, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: C.lime, margin: "0 0 18px" }}>Visible to reviewers</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {OC.reps.see.map((s) => (
                <span key={s} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 16px", fontSize: 14.5 }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={{ background: "#241512", borderRadius: 20, padding: 32, border: `1px solid ${C.coral}` }}>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: C.coral, margin: "0 0 18px" }}>{OC.reps.neverHeading}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {OC.reps.never.map((s) => (
                <li key={s} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.45 }}>
                  <span style={{ color: C.coral, fontWeight: 800 }}>✕</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{ background: C.blue, color: "#10233F" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 32px" }}>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 20px", opacity: 0.7 }}>
            {OC.privacy.heading}
          </p>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 2.2rem)", lineHeight: 1.32, letterSpacing: "-0.01em", margin: "0 0 16px" }}>
            {OC.privacy.body}
          </p>
          <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{OC.privacy.tail}</p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>
          {OC.faq.heading}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {OC.faq.items.map((f) => (
            <div key={f.q} style={{ background: C.bg2, borderRadius: 18, padding: 28, border: `1px solid ${C.line}` }}>
              <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 19, margin: "0 0 10px" }}>{f.q}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.soft, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section id="apply" style={{ background: C.lime, color: C.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "100px 32px", textAlign: "center" }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.0, letterSpacing: "-0.03em", margin: "0 0 18px" }}>
            {OC.finalCta.heading}
          </h2>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 34px" }}>{OC.finalCta.body}</p>
          <a href="#" style={{ display: "inline-block", background: C.bg, color: C.lime, borderRadius: 999, padding: "18px 44px", fontSize: 17, fontWeight: 800, textDecoration: "none" }}>
            {OC.finalCta.cta}
          </a>
          <p style={{ fontSize: 14, marginTop: 18, fontWeight: 600 }}>{OC.finalCta.note}</p>
        </div>
      </section>

      <footer style={{ background: C.bg, color: C.soft, fontSize: 13, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: 32, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span>{OC.org} · {OC.brand}</span>
          <span>“{TRUST_SENTENCE}”</span>
        </div>
      </footer>
    </div>
  );
}
