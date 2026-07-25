"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDeadline, isWindowOpen } from "@/lib/opencall";
import type { OpenCallEvent, OpenCallApplication } from "@/lib/opencall";
import type { User } from "@supabase/supabase-js";

type ActorPageOption = { id: string; display_name: string };
type AppSummary = Pick<OpenCallApplication, "id" | "status" | "actor_name" | "submitted_at" | "updated_at">;

/* ── Design system — Concept B · Modern Youth Industry (APPROVED, unchanged) ──
   Black ground, acid-yellow signal, coral + pale-blue graphic blocks, bold
   Bricolage display type, strong grid, large stat cards, high-contrast CTAs.
   This revision is content/copy only — do not alter the visual system. */
const C = {
  bg: "#141210",
  bg2: "#1D1A16",
  ink: "#F6F1E9",
  soft: "#B7ADA0",
  line: "rgba(246,241,233,0.14)",
  lime: "#E9F27A",
  coral: "#FF6A47",
  blue: "#8FB8FF",
  cream: "#F6F1E9",
};

const display = "var(--font-bricolage), var(--font-outfit), system-ui, sans-serif";
const sans = "var(--font-inter), system-ui, sans-serif";

// Displayed dates. State (pre-open / open / closed) is driven by event status
// below; these strings mirror the approved event configuration (Aug 17 – Sep 7).
const OPEN_LABEL = "August 17";
const DEADLINE_LABEL = "September 7, 2026";
const DEADLINE_SUB = "Labor Day · 11:59 PM Pacific";

const COPY = {
  org: "Child Actor 101",
  brand: "Pages101",
  edition: "11th Open Call",

  stats: [
    { value: "11th", label: "Open Call" },
    { value: "Every", label: "eligible submission included" },
    { value: "$0", label: "to apply" },
    { value: "Nationwide", label: "industry reach", sub: "Both coasts and major regional markets" },
  ],

  what: {
    heading: "What the Open Call is",
    lead: "A free, nationwide opportunity to put your child’s materials in front of real youth talent representatives.",
    body: [
      "Most showcases charge families thousands of dollars for limited access to a small group of industry guests. The Child Actor 101 Open Call works differently. Families build one complete, casting-ready profile, and verified agents and managers from across the country review the submissions privately.",
      "Participating representatives have included professionals serving Los Angeles, New York, Atlanta, Chicago, Texas, New Mexico, Utah, Arizona, Florida, Colorado, and other active production markets.",
    ],
    tail: "No showcase fees. No access sold to the highest bidder. Just preparation, real materials, and a genuine opportunity to be seen.",
  },

  different: {
    heading: "Why this Open Call is different",
    body: [
      "Many talent showcases are built around selling families an expensive dream. Anyone who can pay the fee can attend, and the actual access often falls far short of the promises.",
      "The Child Actor 101 Open Call was created to do the opposite. It is free, carefully managed, and built around legitimate youth agents and managers who are actively developing their rosters.",
      "Previous Open Calls have helped young performers connect with respected agencies and management companies in major and regional markets. Those relationships have contributed to opportunities in television, film, Broadway, and national commercials.",
      "Representation is never guaranteed, and getting signed is only the beginning. But for a prepared young actor with strong materials, this is a meaningful chance to get in front of people they may not otherwise be able to reach.",
    ],
    highlight: "This is what happens when preparation meets opportunity.",
  },

  trust: {
    heading: "Why families trust it",
    points: [
      { title: "Real representatives, carefully verified", body: "Every reviewer is a legitimate talent agent or manager invited through Child Actor 101’s professional industry network." },
      { title: "Guardian-controlled from start to finish", body: "A parent or legal guardian creates the application, authorizes the submission, and remains in control of every introduction." },
      { title: "Private by design", body: "Your child’s profile is shown only to authorized Open Call reviewers. It is never published as a public directory and never sold." },
      { title: "A proven record of real connections", body: "Previous Open Calls have connected prepared young performers with respected agents and managers in major and regional markets across the country." },
    ],
  },

  how: {
    heading: "How it works",
    steps: [
      { n: "01", title: "Build the submission", body: "Add two headshots, a casting profile, acting footage, a slate, performer information, and any relevant résumé or supplemental materials." },
      { n: "02", title: "Guardian review and consent", body: "A parent or legal guardian reviews the full application and authorizes it before submission." },
      { n: "03", title: "Representatives review", body: "Verified agents and managers privately review eligible profiles, looking for performers who fit the needs of their roster." },
      { n: "04", title: "Introduction requested", body: "An interested representative submits their name, role, agency or management company, and an optional note. Pages101 emails the guardian. The representative never receives guardian contact details through the gallery, and the family decides whether to respond." },
    ],
  },

  requirements: {
    heading: "What you need to submit",
    intro: "To be considered, each performer needs a complete submission package. You do not need expensive materials, but every link must work and the performer must be clearly represented.",
    items: [
      { title: "Two headshots or current snapshots", body: "Include both a commercial look and a theatrical look." },
      { title: "Casting profile link", body: "Actors Access and Casting Networks are preferred. Other professional casting profiles are accepted as long as the link works and can be viewed by reviewers." },
      { title: "Acting video", body: "Submit a reel, self-tape, scene, or collection of clips that clearly demonstrates the performer’s acting ability." },
      { title: "Slate video", body: "Include a short introduction that allows representatives to see the performer’s natural personality and presence." },
    ],
    ages: "Eligible ages: 6–21",
  },

  who: {
    heading: "Who should apply",
    items: [
      "Young performers ages 6–21 seeking theatrical, commercial, voiceover, print, musical theater, or hosting representation.",
      "Performers with or without current representation are welcome.",
      "Applicants may live anywhere, including major markets and regional local-hire areas. Union and non-union performers may apply.",
      "Every submission must be created and authorized by a parent or legal guardian.",
    ],
  },

  reps: {
    heading: "What representatives see",
    intro: "Reviewers see a clean, standardized profile — the same fields for every performer, so talent speaks first.",
    see: [
      "Performer name",
      "Age range: 6–21",
      "Location and local-hire markets",
      "Union status and work-readiness information",
      "What they’re seeking",
      "Current representation, if any",
      "Headshots, slate, and reel",
      "Resume and casting profiles",
      "Supplemental notes",
    ],
    neverHeading: "What they never see",
    never: ["Guardian name, email, or phone", "Your home address", "Anything you don’t add yourself"],
  },

  privacy: {
    heading: "Privacy & guardian contact",
    body: [
      "Guardian contact information is collected so Pages101 can manage the application and contact the family when a representative requests an introduction.",
      "Reviewers cannot see or search the guardian’s name, email address, or phone number. If a representative is interested, Pages101 emails the guardian with the representative’s identifying information and message.",
      "The family decides whether to respond. Guardian contact details are never automatically released through the Open Call gallery.",
    ],
    tail: "You may withdraw a submission at any time before the withdrawal deadline stated in the application.",
  },

  faq: {
    heading: "Questions families ask",
    items: [
      { q: "Who can submit?", a: "Young performers ages 6–21 may apply. Every submission must be created and authorized by a parent or legal guardian. A Pages101 account is required, but there is no fee to participate." },
      { q: "Which casting profiles are accepted?", a: "Actors Access and Casting Networks are preferred. Other professional casting profiles may be submitted as long as the link works and reviewers can access it." },
      { q: "Will we receive feedback on the submission?", a: "No. The Open Call does not include individual performance or materials feedback. We may contact you if there is a technical problem that prevents representatives from viewing the submission." },
      { q: "Can we see a list of participating talent representatives?", a: "We do not publish a list of participating representatives. Many agents and managers prefer not to have their information publicly distributed because it can lead to unsolicited calls, emails, and submissions. Participation may also change throughout the review period depending on each representative’s current roster needs. The Open Call includes verified youth agents and managers serving major and regional markets across the country." },
      { q: "How long does it take to hear from an agent or manager?", a: "Timing varies. Some representatives may request an introduction during the review window. Others may return to a submission weeks or months later when a specific roster need arises. A submission does not guarantee contact or representation." },
      { q: "Are the workshops or Two Scenes Program required?", a: "No. Workshops, coaching, submission audits, and the Two Scenes Program are completely optional. Purchasing any Child Actor 101 or Pages101 service does not improve a performer’s placement, visibility, or likelihood of being selected." },
      { q: "Can my child apply if they already have representation?", a: "Yes. Current representation can be listed in the application so reviewers have the correct context." },
      { q: "What happens if a representative is interested?", a: "The representative requests an introduction and provides their name, professional role, company, and an optional message. Pages101 sends that information to the guardian. The family decides whether to respond." },
    ],
  },

  heroSub: "Free to apply · Ages 6–21 · Submitted by a parent or legal guardian",
  footerLine: "Ages 6–21 · Free to apply · Parent or legal guardian submission required",
};

// ── Official Child Actor 101 logo. Hidden until it successfully loads, so a
//    not-yet-added file never flashes a broken-image icon. Drop the logo at
//    public/opencall/child-actor-101-logo.png and it appears beside the wordmark.
function LogoMark() {
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  const imgRef = useRef<HTMLImageElement>(null);
  // Cached images can finish loading before hydration attaches onLoad, so also
  // check `complete` on mount — otherwise a present logo can stay hidden.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) setStatus(img.naturalWidth > 0 ? "ok" : "fail");
  }, []);
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: C.ink }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src="/opencall/child-actor-101-logo.png"
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
        onLoad={() => setStatus("ok")}
        onError={() => setStatus("fail")}
        style={{ height: 36, width: 36, objectFit: "contain", borderRadius: 8, display: status === "ok" ? "block" : "none" }}
      />
      <span style={{ fontFamily: display, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{COPY.org}</span>
    </Link>
  );
}

// ── Hero collage bento — the four supplied original mixed-media images, used
//    as provided. object-fit: cover + per-image object-position so the strongest
//    subject stays visible. No enhancement, recolor, smoothing, or overlaid text;
//    the handmade collage artifacts are intentional campaign identity. ──
function HeroCollage() {
  return (
    <div className="oc-bento">
      {/* 1 · Primary large — child holding the oversized clapperboard */}
      <figure className="oc-card oc-primary" style={{ background: C.coral }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/opencall/hero/clapperboard.webp" alt="Young performer with an oversized clapperboard" style={{ objectPosition: "center 30%" }} />
      </figure>
      {/* 2 · Upper small — child in sunglasses pointing at the oversized document */}
      <figure className="oc-card oc-upper" style={{ background: C.blue }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/opencall/hero/sunglasses-document.webp" alt="Young performer in sunglasses reviewing a document" style={{ objectPosition: "80% 42%" }} />
      </figure>
      {/* 3 & 4 · Lower pair — retro TV with youth portraits, and audition/callback crop */}
      <div className="oc-lower">
        <figure className="oc-card" style={{ background: C.lime }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/opencall/hero/tv-portraits.webp" alt="Retro television surrounded by young performers" style={{ objectPosition: "center center" }} />
        </figure>
        <figure className="oc-card" style={{ background: C.coral }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/opencall/hero/audition-callback.jpg" alt="Audition and callback collage" style={{ objectPosition: "60% 40%" }} />
        </figure>
      </div>
    </div>
  );
}

// Hero-only responsive CSS (keeps the approved desktop composition; adds mobile
// stacking so no face is cut awkwardly). Scoped by the oc- classes above.
const HERO_CSS = `
.oc-hero-grid{ display:grid; grid-template-columns:1.05fr 0.95fr; gap:48px; align-items:center; }
.oc-bento{ display:grid; grid-template-columns:1.25fr 1fr; grid-template-rows:1fr 1fr; gap:14px; aspect-ratio:1 / 1; }
.oc-primary{ grid-row:1 / 3; }
.oc-upper{ grid-column:2; grid-row:1; }
.oc-lower{ grid-column:2; grid-row:2; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.oc-card{ position:relative; margin:0; border-radius:22px; overflow:hidden; border:1px solid rgba(246,241,233,0.14); background-clip:padding-box; }
.oc-card img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
@media (max-width: 900px){
  .oc-hero-grid{ grid-template-columns:1fr; gap:32px; }
  .oc-bento{ grid-template-columns:1fr 1fr; grid-template-rows:auto; aspect-ratio:auto; }
  .oc-primary{ grid-column:1 / 3; grid-row:auto; aspect-ratio:16 / 10; }
  .oc-upper{ grid-column:1 / 3; grid-row:auto; aspect-ratio:16 / 10; }
  .oc-lower{ grid-column:1 / 3; grid-row:auto; }
  .oc-lower .oc-card{ aspect-ratio:4 / 5; }
}
`;

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
      {children}
    </span>
  );
}

export default function OpenCallLanding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<OpenCallEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [applications, setApplications] = useState<AppSummary[]>([]);
  const [pages, setPages] = useState<ActorPageOption[]>([]);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [email, setEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/opencall/event")
      .then((r) => r.json())
      .then((body: { event?: OpenCallEvent }) => setEvent(body.event ?? null))
      .catch(() => {})
      .finally(() => setEventLoading(false));
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthLoaded(true); return; }

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user);
        await loadUserData(data.user);
      }
      setAuthLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserData(session.user);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData(u: User) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const [appsRes, pagesRes] = await Promise.all([
      fetch("/api/opencall/applications", { headers: { Authorization: `Bearer ${token}` } }),
      supabase.from("p101_actor_pages").select("id, display_name").eq("user_id", u.id).order("updated_at", { ascending: false }),
    ]);

    if (appsRes.ok) {
      const body = await appsRes.json() as { applications?: AppSummary[] };
      setApplications(body.applications ?? []);
    }
    if (!pagesRes.error) {
      setPages((pagesRes.data ?? []) as ActorPageOption[]);
    }
  }

  async function handleCreateApplication(sourcePageId?: string) {
    if (!supabase) return;
    setCreating(true);
    setCreateError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/opencall/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...(sourcePageId ? { source_page_id: sourcePageId } : {}) }),
      });
      const body = await res.json() as { application?: { id: string }; error?: string };
      if (!res.ok || !body.application) {
        setCreateError(body.error ?? "Failed to start application.");
        return;
      }
      router.push(`/opencall/apply/${body.application.id}`);
    } catch {
      setCreateError("Failed to start application. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginError("");
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/opencall` },
      });
      if (error) {
        setLoginError(error.message);
      } else {
        setLoginSent(true);
      }
    } catch {
      setLoginError("Failed to send sign-in link. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  const windowOpen = event ? isWindowOpen(event) : false;
  const activeApplications = applications.filter((a) => a.status !== "withdrawn");

  // Single source of truth for lifecycle state — messaging can't contradict itself.
  const phase: "loading" | "open" | "closed" | "preopen" =
    eventLoading || !authLoaded
      ? "loading"
      : windowOpen
      ? "open"
      : event && (event.status === "closed" || event.status === "reviewing")
      ? "closed"
      : "preopen";

  const statusPill = phase === "open" ? "Now open" : phase === "closed" ? "Submissions closed" : `Opens ${OPEN_LABEL}`;

  const dateItems = [
    { label: "Submissions open", value: event ? formatDeadline(event.submits_open) : "August 17, 2026", sub: null as string | null },
    { label: "Submission deadline", value: event ? formatDeadline(event.submits_close) : DEADLINE_LABEL, sub: DEADLINE_SUB },
    { label: "Representative review", value: event?.review_close ? `Through ${formatDeadline(event.review_close)}` : "Begins after submissions close", sub: null },
    { label: "Introductions begin", value: "Rolling, during and after review", sub: null },
  ];

  // ── Functional apply control (open state only): login / start / applications ──
  function ApplyControl() {
    if (user) {
      return (
        <div style={{ display: "grid", gap: 20 }}>
          {activeApplications.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.lime }}>Your applications</div>
              {activeApplications.map((app) => (
                <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.ink }}>{app.actor_name ?? "Unnamed application"}</div>
                    <div style={{ fontSize: 13, color: C.soft, marginTop: 2 }}>
                      {app.status === "submitted"
                        ? `Submitted ${app.submitted_at ? formatDeadline(app.submitted_at) : ""}`
                        : `Draft — last saved ${new Date(app.updated_at).toLocaleDateString("en-US")}`}
                    </div>
                  </div>
                  <Link href={`/opencall/apply/${app.id}`} style={{ padding: "9px 16px", background: app.status === "draft" ? C.lime : "transparent", color: app.status === "draft" ? C.bg : C.ink, border: app.status === "draft" ? "none" : `1px solid ${C.line}`, borderRadius: 999, textDecoration: "none", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                    {app.status === "draft" ? "Continue" : "Edit / View"}
                  </Link>
                </div>
              ))}
            </div>
          )}

          {createError && <p style={{ color: C.coral, fontSize: 14, margin: 0 }}>{createError}</p>}

          {pages.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ fontSize: 14, color: C.soft, margin: 0 }}>Start with a performer page or apply without pre-filling.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pages.map((pg) => (
                  <button key={pg.id} onClick={() => handleCreateApplication(pg.id)} disabled={creating}
                    style={{ padding: "12px 20px", background: C.lime, color: C.bg, border: "none", borderRadius: 999, fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: creating ? 0.6 : 1 }}>
                    Apply for {pg.display_name}
                  </button>
                ))}
                <button onClick={() => handleCreateApplication()} disabled={creating}
                  style={{ padding: "12px 20px", background: "transparent", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: creating ? 0.6 : 1 }}>
                  Blank application
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => handleCreateApplication()} disabled={creating}
              style={{ padding: "16px 32px", background: C.lime, color: C.bg, border: "none", borderRadius: 999, fontWeight: 800, cursor: "pointer", fontSize: 16, justifySelf: "start", opacity: creating ? 0.6 : 1 }}>
              {creating ? "Starting…" : "Start Your Application"}
            </button>
          )}
        </div>
      );
    }

    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.lime, marginBottom: 10 }}>Sign in to apply</div>
        <p style={{ fontSize: 15, color: C.soft, margin: "0 0 16px" }}>We’ll email you a magic link — no password needed.</p>
        {loginSent ? (
          <div style={{ padding: "14px 18px", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, fontWeight: 700 }}>Check your email for a sign-in link.</div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required
              style={{ flex: 1, minWidth: 220, padding: "13px 16px", border: `1px solid ${C.line}`, background: C.bg, color: C.ink, borderRadius: 999, fontSize: 15, fontFamily: "inherit" }} />
            <button type="submit" disabled={loginLoading}
              style={{ padding: "13px 26px", background: C.lime, color: C.bg, border: "none", borderRadius: 999, fontWeight: 800, cursor: "pointer", fontSize: 15, opacity: loginLoading ? 0.6 : 1 }}>
              {loginLoading ? "Sending…" : "Send link"}
            </button>
          </form>
        )}
        {loginError && <p style={{ color: C.coral, fontSize: 14, marginTop: 10 }}>{loginError}</p>}
      </div>
    );
  }

  // Hero primary CTA is phase-aware so it never invites an action that isn't available.
  const heroPrimaryLabel = phase === "open" ? "Start Your Application" : phase === "closed" ? null : "Get Ready to Apply";
  const navCtaLabel = phase === "open" ? "Apply now" : "Get Ready";

  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: sans, minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(20,18,16,0.85)", backdropFilter: "saturate(140%) blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <LogoMark />
          <nav style={{ display: "flex", gap: 26, fontSize: 14, color: C.soft, fontWeight: 500 }}>
            <a href="#what" style={{ color: "inherit", textDecoration: "none" }}>Open Call</a>
            <a href="#how" style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
            <a href="#requirements" style={{ color: "inherit", textDecoration: "none" }}>Requirements</a>
            <a href="#privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          </nav>
          <a href="#apply" style={{ background: C.lime, color: C.bg, borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>{navCtaLabel}</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "64px 32px 40px" }}>
        <div className="oc-hero-grid">
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <Pill bg={C.coral} fg={C.bg}>{COPY.edition}</Pill>
              <Pill bg="transparent" fg={C.soft}>{statusPill}</Pill>
            </div>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.8rem, 6.4vw, 5.4rem)", lineHeight: 0.95, letterSpacing: "-0.03em", margin: "0 0 24px" }}>
              One profile.<br />
              <span style={{ color: C.lime }}>Real industry eyes.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: C.soft, maxWidth: 540, margin: "0 0 16px" }}>
              Young performers from across the country submit one casting-ready profile. Verified youth talent agents and managers review every eligible submission, looking for performers who fit the needs of their roster.
            </p>
            <p style={{ fontSize: 18, lineHeight: 1.5, color: C.ink, fontWeight: 600, maxWidth: 540, margin: "0 0 32px" }}>
              This is one of the broadest free youth representation opportunities available anywhere in the country.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {heroPrimaryLabel && (
                <a href="#apply" style={{ background: C.lime, color: C.bg, borderRadius: 999, padding: "16px 32px", fontSize: 16, fontWeight: 800, textDecoration: "none" }}>{heroPrimaryLabel}</a>
              )}
              <a href="#how" style={{ color: C.ink, border: `1px solid ${C.line}`, borderRadius: 999, padding: "16px 28px", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>See How It Works</a>
            </div>
            <p style={{ fontSize: 14, color: C.soft, marginTop: 20 }}>{COPY.heroSub}</p>
          </div>
          <HeroCollage />
        </div>
      </section>

      {/* Stats */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 32px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {COPY.stats.map((s, i) => {
            const bgs = [C.lime, C.bg2, C.bg2, C.bg2];
            const fgs = [C.bg, C.ink, C.ink, C.ink];
            return (
              <div key={s.label} style={{ background: bgs[i], color: fgs[i], borderRadius: 20, padding: "26px 24px", border: i === 0 ? "none" : `1px solid ${C.line}` }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: s.value.length > 6 ? 30 : 44, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.value}</div>
                <div style={{ fontSize: 14, marginTop: 8, opacity: 0.85 }}>{s.label}</div>
                {"sub" in s && s.sub && <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>{s.sub}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* What it is */}
      <section id="what" style={{ background: C.cream, color: "#1B1712" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: C.coral, margin: "0 0 24px" }}>{COPY.what.heading}</p>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 3.2rem)", lineHeight: 1.12, letterSpacing: "-0.02em", margin: "0 0 24px", maxWidth: 1000 }}>{COPY.what.lead}</p>
          <div style={{ display: "grid", gap: 16, maxWidth: 820 }}>
            {COPY.what.body.map((p) => (
              <p key={p.slice(0, 24)} style={{ fontSize: 18, lineHeight: 1.6, margin: 0, color: "#40372E" }}>{p}</p>
            ))}
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.coral, margin: "24px 0 0", maxWidth: 900 }}>{COPY.what.tail}</p>
        </div>
      </section>

      {/* Why this Open Call is different */}
      <section style={{ background: C.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 28px" }}>{COPY.different.heading}</h2>
          <div style={{ display: "grid", gap: 18, maxWidth: 820, marginBottom: 40 }}>
            {COPY.different.body.map((p) => (
              <p key={p.slice(0, 24)} style={{ fontSize: 18, lineHeight: 1.65, color: C.soft, margin: 0 }}>{p}</p>
            ))}
          </div>
          <p style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(1.7rem, 3.6vw, 2.8rem)", lineHeight: 1.15, letterSpacing: "-0.02em", color: C.lime, margin: 0, maxWidth: 900 }}>
            {COPY.different.highlight}
          </p>
        </div>
      </section>

      {/* Why families trust it */}
      <section style={{ background: C.bg2, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>{COPY.trust.heading}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {COPY.trust.points.map((p, i) => {
              const accents = [C.lime, C.coral, C.blue, C.lime];
              return (
                <div key={p.title} style={{ background: C.bg, borderRadius: 20, padding: 30, border: `1px solid ${C.line}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: accents[i], color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, marginBottom: 18 }}>{i + 1}</div>
                  <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 21, margin: "0 0 8px" }}>{p.title}</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: C.soft, margin: 0 }}>{p.body}</p>
                </div>
              );
            })}
          </div>

          {/* Trust promise — large block, quotation marks removed, two lines */}
          <div style={{ background: C.lime, color: C.bg, borderRadius: 24, padding: "44px 40px", marginTop: 16, textAlign: "center" }}>
            <p style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(1.5rem, 3.2vw, 2.4rem)", lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0 }}>
              No purchase improves your child’s chances.<br />Nothing we sell touches selection.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ background: C.bg, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>{COPY.how.heading}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {COPY.how.steps.map((s, i) => {
              const accents = [C.lime, C.blue, C.coral, C.lime];
              return (
                <div key={s.n} style={{ background: C.bg2, borderRadius: 20, padding: 26, border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: display, fontWeight: 800, fontSize: 15, color: accents[i], letterSpacing: "0.1em", marginBottom: 44 }}>STEP {s.n}</div>
                  <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 19, margin: "0 0 10px" }}>{s.title}</h3>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: C.soft, margin: 0 }}>{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What you need to submit */}
      <section id="requirements" style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: 0 }}>{COPY.requirements.heading}</h2>
          <span style={{ background: C.blue, color: "#10233F", borderRadius: 999, padding: "8px 18px", fontFamily: display, fontWeight: 800, fontSize: 15 }}>{COPY.requirements.ages}</span>
        </div>
        <p style={{ fontSize: 18, color: C.soft, maxWidth: 720, margin: "0 0 32px" }}>{COPY.requirements.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {COPY.requirements.items.map((it, i) => {
            const accents = [C.coral, C.lime, C.blue, C.coral];
            return (
              <div key={it.title} style={{ background: C.bg2, borderRadius: 20, padding: 28, border: `1px solid ${C.line}`, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: accents[i], color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 15 }}>{i + 1}</span>
                <div>
                  <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 19, margin: "0 0 8px" }}>{it.title}</h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.soft, margin: 0 }}>{it.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Who + Dates */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px 88px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: C.coral, color: C.bg, borderRadius: 24, padding: 36 }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 26, margin: "0 0 22px" }}>{COPY.who.heading}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {COPY.who.items.map((it) => (
              <li key={it} style={{ display: "flex", gap: 12, fontSize: 16.5, lineHeight: 1.5, fontWeight: 500 }}>
                <span style={{ fontWeight: 800 }}>↳</span><span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: C.bg2, borderRadius: 24, padding: 36, border: `1px solid ${C.line}` }}>
          <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 26, margin: "0 0 22px" }}>Important dates</h2>
          {dateItems.map((d, i) => (
            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "16px 0", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <span style={{ fontSize: 15, color: C.soft, paddingTop: 2 }}>{d.label}</span>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontFamily: display, fontWeight: 700, fontSize: 17 }}>{d.value}</span>
                {d.sub && <span style={{ display: "block", fontSize: 12.5, color: C.coral, fontWeight: 600, marginTop: 3 }}>{d.sub}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What reps see */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px 88px" }}>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 12px" }}>{COPY.reps.heading}</h2>
        <p style={{ fontSize: 18, color: C.soft, maxWidth: 660, margin: "0 0 32px" }}>{COPY.reps.intro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div style={{ background: C.bg2, borderRadius: 20, padding: 32, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: C.lime, margin: "0 0 18px" }}>Visible to reviewers</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {COPY.reps.see.map((s) => (
                <span key={s} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 16px", fontSize: 14.5 }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={{ background: "#241512", borderRadius: 20, padding: 32, border: `1px solid ${C.coral}` }}>
            <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: C.coral, margin: "0 0 18px" }}>{COPY.reps.neverHeading}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {COPY.reps.never.map((s) => (
                <li key={s} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.45 }}>
                  <span style={{ color: C.coral, fontWeight: 800 }}>✕</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" style={{ background: C.blue, color: "#10233F" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 32px" }}>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 20px", opacity: 0.7 }}>{COPY.privacy.heading}</p>
          <div style={{ display: "grid", gap: 16 }}>
            {COPY.privacy.body.map((p) => (
              <p key={p.slice(0, 24)} style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(1.3rem, 2.6vw, 1.9rem)", lineHeight: 1.34, letterSpacing: "-0.01em", margin: 0 }}>{p}</p>
            ))}
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "20px 0 0" }}>{COPY.privacy.tail}</p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "88px 32px" }}>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.02em", margin: "0 0 40px" }}>{COPY.faq.heading}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {COPY.faq.items.map((f) => (
            <div key={f.q} style={{ background: C.bg2, borderRadius: 18, padding: 28, border: `1px solid ${C.line}` }}>
              <h3 style={{ fontFamily: display, fontWeight: 700, fontSize: 19, margin: "0 0 10px" }}>{f.q}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.soft, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA — state-driven */}
      <section id="apply" style={{ background: C.lime, color: C.bg }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "100px 32px" }}>
          {phase === "open" ? (
            <>
              <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
                <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.0, letterSpacing: "-0.03em", margin: "0 0 18px" }}>The 11th Open Call is accepting submissions.</h2>
                <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Build one complete profile and let the industry take an honest look.</p>
              </div>
              <div style={{ maxWidth: 620, margin: "0 auto", background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 24, padding: 32 }}>
                <ApplyControl />
              </div>
            </>
          ) : phase === "closed" ? (
            <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
              <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.2rem, 4.6vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 16px" }}>This Open Call has closed.</h2>
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Thank you to everyone who submitted. Watch for the next Open Call announcement.</p>
            </div>
          ) : (
            <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
              <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.0, letterSpacing: "-0.03em", margin: "0 0 18px" }}>The 11th Open Call opens {OPEN_LABEL}.</h2>
              <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 30px" }}>Prepare your child’s headshots, casting profile, acting footage, and slate now.</p>
              <a href="#requirements" style={{ display: "inline-block", background: C.bg, color: C.lime, borderRadius: 999, padding: "18px 44px", fontSize: 17, fontWeight: 800, textDecoration: "none" }}>Get Ready to Apply</a>
              <p style={{ fontSize: 14, marginTop: 18, fontWeight: 600 }}>Submissions close {DEADLINE_LABEL} at 11:59 PM Pacific.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer — trust quote removed */}
      <footer style={{ background: C.bg, color: C.soft, fontSize: 13, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: 32, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span>{COPY.org} · {COPY.brand}</span>
          <span>{COPY.footerLine}</span>
        </div>
      </footer>
    </div>
  );
}
