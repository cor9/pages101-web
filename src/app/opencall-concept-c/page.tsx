import type { Metadata } from "next";
import { OC, TRUST_SENTENCE } from "@/lib/opencall-concept-content";

export const metadata: Metadata = {
  title: "Open Call — Community (Concept C)",
  description: "Static visual direction C for the Child Actor 101 Open Call.",
};

/* ── Concept C · Warm Community Editorial ─────────────────────────────────────
   Cream background, warm red + pale blue + muted yellow, candid family/young-
   actor imagery, subtle hand-drawn marks and arrows. Approachable and trusted,
   still polished. Static mockup only. Art-directed candid-warmth portrait
   placeholders stand in for real photography. */

const C = {
  cream: "#F6EEE0",
  paper: "#FCF7EE",
  ink: "#3A2E23",
  soft: "#7A6B5A",
  line: "rgba(58,46,35,0.14)",
  red: "#C24A34", // warm red
  blue: "#AEC7DA", // pale blue
  yellow: "#E9CE7A", // muted yellow
  yellowSoft: "#F2E3B4",
};

const serif = "var(--font-fraunces), Georgia, serif";
const sans = "var(--font-inter), system-ui, sans-serif";

// Hand-drawn underline
function Squiggle({ color = C.red }: { color?: string }) {
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 10, marginTop: 2 }}>
      <path d="M2 8 C 40 2, 60 10, 100 6 S 170 2, 198 7" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Hand-drawn arrow
function Arrow({ color = C.red, rotate = 0 }: { color?: string; rotate?: number }) {
  return (
    <svg viewBox="0 0 80 60" style={{ width: 64, height: 48, transform: `rotate(${rotate}deg)` }}>
      <path d="M6 10 C 30 4, 62 14, 68 44" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M56 40 L 70 46 L 60 54" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Candid-warmth portrait plate (stands in for real photography)
function Candid({ tone = 0, tall = false }: { tone?: number; tall?: boolean }) {
  const bases = ["#E4CFAF", "#D8C4A6", "#E8D8B8", "#D2BE9E"];
  const washes = [C.red, C.blue, C.yellow, C.red];
  return (
    <div
      style={{
        aspectRatio: tall ? "3 / 4" : "4 / 3",
        borderRadius: 16,
        background: bases[tone % bases.length],
        border: `1px solid ${C.line}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: washes[tone % washes.length], opacity: 0.12 }} />
      <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g fill={C.red} opacity="0.22">
          <circle cx="120" cy="130" r="46" />
          <path d="M52 300c0-52 30-92 68-92s68 40 68 92z" />
        </g>
        <g fill={C.ink} opacity="0.16">
          <circle cx="205" cy="160" r="38" />
          <path d="M150 300c0-44 25-76 55-76s55 32 55 76z" />
        </g>
      </svg>
    </div>
  );
}

export default function ConceptC() {
  return (
    <div style={{ background: C.cream, color: C.ink, fontFamily: sans, minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ background: C.red, color: C.paper }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, letterSpacing: "0.04em" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 18 }}>{OC.org}</span>
          <nav style={{ display: "flex", gap: 26, opacity: 0.92 }}>
            <span>The Open Call</span>
            <span>For families</span>
            <span>Privacy</span>
          </nav>
          <a href="#apply" style={{ color: C.red, background: C.paper, borderRadius: 999, padding: "7px 16px", fontWeight: 700, textDecoration: "none" }}>
            Apply
          </a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 32px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.red, margin: "0 0 18px" }}>
              {OC.hero.eyebrow}
            </p>
            <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2.4rem, 5.4vw, 4.4rem)", lineHeight: 1.03, letterSpacing: "-0.015em", margin: "0 0 8px" }}>
              The Online Talent Representation{" "}
              <span style={{ display: "inline-block", position: "relative" }}>
                Open&nbsp;Call
                <span style={{ position: "absolute", left: 0, right: 0, bottom: -6 }}><Squiggle /></span>
              </span>
            </h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.6, color: C.soft, maxWidth: 540, margin: "24px 0 30px" }}>
              {OC.hero.subhead}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <a href="#apply" style={{ background: C.red, color: C.paper, borderRadius: 10, padding: "15px 30px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                {OC.hero.primaryCta}
              </a>
              <a href="#how" style={{ color: C.ink, fontWeight: 600, textDecoration: "none", fontSize: 15, borderBottom: `2px solid ${C.yellow}`, paddingBottom: 2 }}>
                {OC.hero.secondaryCta}
              </a>
            </div>
            <p style={{ fontSize: 13, color: C.soft, marginTop: 18 }}>{OC.hero.note}</p>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <Candid tone={0} tall />
                <Candid tone={1} />
              </div>
              <div style={{ display: "grid", gap: 14, marginTop: 30 }}>
                <Candid tone={2} />
                <Candid tone={3} tall />
              </div>
            </div>
            {/* little sticker badge */}
            <div style={{ position: "absolute", top: -18, right: -10, background: C.yellow, color: C.ink, borderRadius: 999, width: 92, height: 92, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 800, fontSize: 12, lineHeight: 1.1, transform: "rotate(-8deg)", border: `2px solid ${C.ink}` }}>
              <span style={{ fontFamily: serif, fontSize: 22 }}>11</span>
              years
            </div>
          </div>
        </div>
      </section>

      {/* Ribbon */}
      <div style={{ background: C.yellow, color: C.ink, padding: "10px 0", overflow: "hidden" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 32px", display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
          <span>★ Free to apply</span>
          <span>★ Guardian-controlled</span>
          <span>★ Verified reviewers</span>
          <span>★ Private by design</span>
        </div>
      </div>

      {/* What it is */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 56, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Candid tone={1} />
            <div style={{ position: "absolute", bottom: -22, right: -12 }}><Arrow rotate={20} /></div>
          </div>
          <div>
            <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)", lineHeight: 1.1, margin: "0 0 18px" }}>
              {OC.what.heading}
            </h2>
            <p style={{ fontSize: 19, lineHeight: 1.6, margin: "0 0 16px" }}>{OC.what.body}</p>
            <p style={{ fontSize: 19, lineHeight: 1.6, color: C.red, fontWeight: 600, margin: 0 }}>{OC.what.tail}</p>
          </div>
        </div>
      </section>

      {/* Why families trust it */}
      <section style={{ background: C.paper, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 3.6vw, 2.9rem)", textAlign: "center", margin: "0 0 44px" }}>
            {OC.trust.heading}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {OC.trust.points.map((p, i) => {
              const chips = [C.red, C.blue, C.yellow, C.red];
              return (
                <div key={p.title} style={{ background: C.cream, borderRadius: 16, padding: 28, border: `1px solid ${C.line}`, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: chips[i], marginTop: 7, flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 21, margin: "0 0 6px" }}>{p.title}</h3>
                    <p style={{ fontSize: 16, lineHeight: 1.6, color: C.soft, margin: 0 }}>{p.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust promise */}
          <div style={{ marginTop: 24, background: C.red, color: C.paper, borderRadius: 20, padding: "44px 40px", textAlign: "center", position: "relative" }}>
            <p style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 500, fontSize: "clamp(1.5rem, 3vw, 2.2rem)", lineHeight: 1.28, margin: 0 }}>
              “{TRUST_SENTENCE}”
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 44 }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 3.6vw, 2.9rem)", margin: 0 }}>{OC.how.heading}</h2>
          <Arrow rotate={95} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {OC.how.steps.map((s, i) => {
            const tints = [C.yellowSoft, C.blue, C.yellowSoft, C.blue];
            return (
              <div key={s.n} style={{ background: tints[i], borderRadius: 16, padding: 26, border: `1px solid ${C.line}` }}>
                <div style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, color: C.red, marginBottom: 12 }}>{s.n}</div>
                <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.ink, opacity: 0.82, margin: 0 }}>{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Who + Dates */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 32px 80px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
        <div style={{ background: C.blue, borderRadius: 20, padding: 36, color: "#26333D" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 26, margin: "0 0 22px" }}>{OC.who.heading}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {OC.who.items.map((it) => (
              <li key={it} style={{ display: "flex", gap: 12, fontSize: 16.5, lineHeight: 1.5 }}>
                <span style={{ color: C.red, fontWeight: 800 }}>✓</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: C.paper, borderRadius: 20, padding: 36, border: `1px solid ${C.line}` }}>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 26, margin: "0 0 20px" }}>{OC.dates.heading}</h2>
          {OC.dates.items.map((d, i) => (
            <div key={d.label} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div style={{ fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.soft, marginBottom: 4 }}>{d.label}</div>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 21 }}>{d.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What reps see */}
      <section style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "80px 32px" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 3.6vw, 2.9rem)", margin: "0 0 12px" }}>{OC.reps.heading}</h2>
          <p style={{ fontSize: 18, color: C.soft, maxWidth: 640, margin: "0 0 32px" }}>{OC.reps.intro}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
            <div style={{ background: C.cream, borderRadius: 16, padding: 30, border: `1px solid ${C.line}` }}>
              <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, margin: "0 0 16px", color: C.red }}>Reviewers see</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                {OC.reps.see.map((s) => (
                  <div key={s} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.4 }}>
                    <span style={{ color: C.red }}>✓</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.ink, color: C.paper, borderRadius: 16, padding: 30 }}>
              <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, margin: "0 0 16px", color: C.yellow }}>{OC.reps.neverHeading}</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
                {OC.reps.never.map((s) => (
                  <li key={s} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.45, color: "rgba(252,247,238,0.88)" }}>
                    <span style={{ color: C.yellow }}>✕</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "80px 32px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><Arrow rotate={135} color={C.blue} /></div>
        <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.red, margin: "0 0 18px" }}>
          {OC.privacy.heading}
        </p>
        <p style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(1.5rem, 2.8vw, 2.1rem)", lineHeight: 1.4, margin: "0 0 16px" }}>
          {OC.privacy.body}
        </p>
        <p style={{ fontSize: 16, color: C.soft, margin: 0 }}>{OC.privacy.tail}</p>
      </section>

      {/* FAQ */}
      <section style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 32px" }}>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 3.6vw, 2.9rem)", textAlign: "center", margin: "0 0 40px" }}>
            {OC.faq.heading}
          </h2>
          <div style={{ display: "grid", gap: 14 }}>
            {OC.faq.items.map((f) => (
              <div key={f.q} style={{ background: C.cream, borderRadius: 14, padding: "24px 28px", border: `1px solid ${C.line}` }}>
                <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, margin: "0 0 8px" }}>{f.q}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.soft, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="apply" style={{ maxWidth: 1120, margin: "0 auto", padding: "88px 32px" }}>
        <div style={{ background: C.red, color: C.paper, borderRadius: 28, padding: "72px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 24, left: 30, opacity: 0.5 }}><Arrow rotate={200} color={C.yellow} /></div>
          <h2 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1.08, margin: "0 0 14px" }}>
            {OC.finalCta.heading}
          </h2>
          <p style={{ fontSize: 19, margin: "0 0 30px", color: "rgba(252,247,238,0.92)" }}>{OC.finalCta.body}</p>
          <a href="#" style={{ display: "inline-block", background: C.paper, color: C.red, borderRadius: 12, padding: "16px 40px", fontSize: 16, fontWeight: 800, textDecoration: "none" }}>
            {OC.finalCta.cta}
          </a>
          <p style={{ fontSize: 13, marginTop: 16, color: "rgba(252,247,238,0.82)" }}>{OC.finalCta.note}</p>
        </div>
      </section>

      <footer style={{ color: C.soft, fontSize: 13 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: 32, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTop: `1px solid ${C.line}` }}>
          <span>{OC.org} · {OC.brand}</span>
          <span>“{TRUST_SENTENCE}”</span>
        </div>
      </footer>
    </div>
  );
}
