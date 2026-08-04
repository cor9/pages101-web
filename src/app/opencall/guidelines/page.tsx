import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Child Actor 101's Free Talent Representation Open Call",
};

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

type GuideSection = {
  id: string;
  number: string;
  title: string;
  required: string;
  intro: string[];
  callout?: string;
  cards?: { title: string; text: string; bullets: string[] }[];
  bullets?: string[];
};

const sections: GuideSection[] = [
  {
    id: "photos", number: "01", title: "Headshots & photos", required: "At least two required",
    intro: ["Please upload at least two recent headshots or high-quality snapshots. Professional actor headshots are wonderful, but they are not required. A strong, well-lit snapshot is absolutely acceptable.", "The most important rule: your photos should look like your actor right now. Kids change quickly. Choose materials that represent the performer a representative would actually meet today."],
    callout: "Ask: What could this actor realistically walk onto a television or film set and play tomorrow?",
    cards: [
      { title: "Photo #1 — Commercial", text: "Happy, joyful, genuine, approachable, excited. A natural smile with teeth is preferred; the eyes should participate too.", bullets: ["Use genuine energy, not a pasted-on school-picture smile.", "Ask: Does this look like someone I’d want to meet?"] },
      { title: "Photo #2 — Theatrical", text: "In the industry, theatrical generally means television and film, not stage acting. Think confident, relaxed, thoughtful, serious, dramatic.", bullets: ["Serious does not mean angry, miserable or intensely brooding.", "The strongest photos feel grounded and effortless — like a real person with something going on behind their eyes."] },
      { title: "Optional photo #3 — Character type", text: "Show another believable side: quirky, nerd, bully, surfer, gothic, athlete, country kid, class clown or young professional are examples only.", bullets: ["Do not force a costume or a role the actor could not believably play.", "Type is about helping representatives recognize what already exists in the actor."] },
    ],
  },
  {
    id: "slate", number: "02", title: "Personality slate", required: "Required · maximum 90 seconds",
    intro: ["Start with name, age and location. Then choose two personality elements. These are prompts, not interview questions requiring perfect answers.", "The goal is to meet the person behind the headshot. Don’t perform personality. Quiet, dry, silly, thoughtful and a little weird can all be memorable when they are real."],
    cards: [
      { title: "Choose any two prompts", text: "Give the actor something they genuinely want to talk about.", bullets: ["Fun fact, pet peeve, favorite book, TV show or movie", "A joke, funny story, hidden talent or favorite hobby", "Why they love acting, a performance idol, or a career they admire", "Introduce a pet, or tell the craziest thing that has happened to them"] },
      { title: "Film simply", text: "You do not need cinematic production. Make the actor easy and enjoyable to watch.", bullets: ["Use a reasonably quiet space, good natural/soft light and clear sound.", "Keep the camera around eye level with clean, simple framing.", "Let them speak conversationally and allow pauses, thinking and spontaneity."] },
      { title: "Skip the overproduction", text: "Polished is good. Overproduced is not necessary.", bullets: ["No dramatic music, beauty filters, montages or elaborate graphics.", "Do not script every word or feed answers from behind the camera.", "Upload to YouTube or Vimeo and test that the link is viewable."] },
    ],
  },
  {
    id: "acting", number: "03", title: "Acting sample", required: "Optional",
    intro: ["If you have strong current material, this is the opportunity to show representatives what the actor can do. Choose the material that offers the best current evidence of ability — not necessarily the newest, most expensive or most professionally branded."],
    cards: [
      { title: "Demo reel — maximum 3 minutes", text: "Completed professional work, self-produced demo scenes and permitted previous self-tapes are all welcome. Put the strongest material first.", bullets: ["Do not expect someone to watch three minutes before deciding whether they are interested.", "Choose clips where the actor speaks and engages quickly."] },
      { title: "Self-tape scene — maximum 5 minutes", text: "You may share a permitted previous audition, self-tape scene or monologue.", bullets: ["Use normal self-tape standards: good light, clear sound, appropriate framing and a reader when needed.", "Choose memorized material with strong, believable acting choices."] },
      { title: "What helps — and what does not", text: "Look for acting that is specific, connected, interesting and believable.", bullets: ["Avoid audience-recorded stage performances, long montages and scenes dominated by someone else.", "Do not include old footage if the actor now looks substantially different, or anything you are not permitted to share.", "A terrific current self-tape is more useful than weak professional footage."] },
    ],
  },
  {
    id: "skills", number: "04", title: "Special skill video", required: "Optional · maximum 2 minutes",
    intro: ["Use this only when a skill genuinely adds something to the performer’s professional profile. Quality over quantity."],
    bullets: ["Singing, dance, musical instruments, stand-up, voice acting, martial arts, gymnastics, sports, magic or another unusual performance skill.", "If your actor is an exceptional singer, let us hear them sing. If they can play four ukulele chords from six weeks of lessons in 2023, we can probably survive without the documentary."],
  },
  {
    id: "profile", number: "05", title: "Casting profile", required: "Required",
    intro: ["The application requires a public Actors Access or Casting Networks profile. For television and film, Actors Access is particularly important; Casting Networks is also widely used, especially for commercial casting.", "A vanity/public profile URL is preferred when available. Open the link yourself while logged out or in a private browser window before submitting."],
    bullets: ["Make sure the profile shows current photos, résumé, media, location, credits, training and representation information when applicable.", "A beautiful Open Call application connected to a profile that has not been updated since the actor lost six teeth is not helping anybody."],
  },
  {
    id: "resume", number: "06", title: "Résumé", required: "Recommended",
    intro: ["You may provide a link to the actor’s résumé or upload it directly. Keep it clean, readable and current. A shorter professional résumé is better than a crowded amateur one."],
    bullets: ["Appropriate sections can include Film/Television, Theatre, commercials when appropriate, training and special skills.", "For developing actors without many professional credits, training matters.", "Do not pad a résumé with background work or unrelated accomplishments simply to make it longer."],
  },
  {
    id: "representation", number: "07", title: "Representation", required: "Answer honestly",
    intro: ["The application asks whether the actor is currently represented and what type of representation they are seeking. Already having representation does not necessarily mean there is nothing else to seek."],
    bullets: ["You may seek a manager, regional agent, theatrical TV/film agent, commercial agent, voiceover agent, theatre agent, print agent, hosting agent or across-the-board representation.", "Use representation notes for useful context about the actor’s situation, markets or exclusivity. Keep them concise and factual."],
  },
  {
    id: "work", number: "08", title: "Location & work information", required: "Accuracy matters",
    intro: ["The application asks about city, state/province, country, local-hire cities, union status, Coogan account, work permit and passport. Answer accurately."],
    callout: "Local Hire means that you are able to travel to the location and secure accommodations on your own dime.",
    bullets: ["If your actor can genuinely work locally in Los Angeles, San Diego, Atlanta, New York or another market, include it.", "Accuracy is considerably more useful than trying to make an actor appear available everywhere."],
  },
  {
    id: "links", number: "09", title: "Additional links", required: "Optional",
    intro: ["Share additional professional links only when they help representatives understand the actor. More is not automatically better."],
    bullets: ["A Pages101 page, IMDb, professional actor website, Linktree, Instagram, YouTube, TikTok or another professional profile can work.", "Before including social media, view it through the eyes of a prospective representative. If it helps, include it. If it creates questions you do not want them asking, leave it out."],
  },
  {
    id: "type", number: "10", title: "Type matters", required: "Make the answer easy",
    intro: ["One of the biggest mistakes performers make is trying to demonstrate that they can play anything. Nobody can — and they do not need to.", "Representatives are often answering a simpler question: Where would I submit this actor tomorrow? Your photos, acting, slate and profile should make that answer easier."],
    callout: "Casting begins with believability. Range develops over time.",
  },
  {
    id: "kid", number: "11", title: "Don’t erase the kid", required: "Let personality stay visible",
    intro: ["Parents understandably want everything to look professional. But perfect hair, perfect answers, perfect posture, perfect smile and a perfectly rehearsed slate can leave us with absolutely no idea who the kid actually is.", "Do not polish away the interesting parts. Representatives are wondering who they could submit, who casting would remember, who can act, who has a point of view and who might make people pay attention."],
  },
];

const checklist = [
  ["Performer & representation", "Performer, location, work and representation information are accurate.", "It is clear what representation you are seeking."],
  ["Photos", "At least two recent photos show how the actor looks now.", "Commercial, theatrical and any optional type image are strong and believable."],
  ["Personality slate", "Name, age, location and two personality elements are included.", "It is under 90 seconds, clear, conversational and viewable without permission."],
  ["Acting / special skill videos", "Only include strong current material that suits the actor’s age and type.", "Confirm every link works and you have permission to share it."],
  ["Casting profile & résumé", "Profile, photos, media and résumé are current.", "Test every link one final time."],
];

const pageCss = `
  .guide-grid { display:grid; grid-template-columns:220px minmax(0, 1fr); gap:48px; align-items:start; }
  .guide-cards { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; }
  .guide-example-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; }
  .guide-example-grid figure { margin:0; border-radius:18px; overflow:hidden; background:#1D1A16; border:1px solid rgba(246,241,233,.14); }
  .guide-example-grid img { display:block; width:100%; aspect-ratio:1.25 / 1; object-fit:cover; }
  .guide-example-grid figcaption { padding:13px 15px 15px; color:#F6F1E9; font-family:var(--font-bricolage), var(--font-outfit), system-ui, sans-serif; font-weight:800; font-size:15px; }
  .guide-nav { position:sticky; top:88px; }
  @media (max-width:900px) { .guide-grid { grid-template-columns:1fr; gap:28px; } .guide-nav { position:static; display:flex; flex-wrap:wrap; gap:8px; } .guide-nav a { margin:0 !important; } .guide-cards, .guide-example-grid { grid-template-columns:1fr; } }
`;

export default function OpenCallGuidelinesPage() {
  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: sans }}>
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />
      <header style={{ borderBottom: `1px solid ${C.line}`, background: "rgba(20,18,16,.9)", position: "sticky", top: 0, zIndex: 2, backdropFilter: "blur(10px)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "14px 32px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <a href="https://childactor101.com" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, color: C.ink, fontFamily: display, fontWeight: 800, fontSize: 18, textDecoration: "none" }}>
            <Image src="/opencall/child-actor-101-logo.png" width={40} height={40} alt="Child Actor 101" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 9 }} />
            <span>Child Actor 101 <span style={{ color: C.lime }}>Open Call 11</span></span>
          </a>
          <Link href="/opencall#apply" style={{ background: C.lime, color: C.bg, borderRadius: 999, padding: "10px 18px", fontWeight: 800, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>Free to submit</Link>
        </div>
      </header>

      <section style={{ background: C.cream, color: "#1B1712" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(56px, 9vw, 108px) 32px" }}>
          <p style={{ color: C.coral, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 13, margin: "0 0 18px" }}>Open Call 11</p>
          <h1 style={{ fontFamily: display, fontSize: "clamp(2.8rem, 7vw, 5.7rem)", lineHeight: .92, letterSpacing: "-.055em", maxWidth: 980, margin: "0 0 18px" }}>Child Actor 101&apos;s Free Talent Representation Open Call</h1>
          <p style={{ color: "#354E78", fontFamily: display, fontWeight: 800, fontSize: "clamp(1.35rem, 3vw, 2.1rem)", letterSpacing: "-.025em", margin: "0 0 24px" }}>Free Submission Guidelines &amp; Tips</p>
          <p style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(1.2rem, 2.5vw, 1.65rem)", lineHeight: 1.35, maxWidth: 760, margin: "0 0 30px" }}>Show us who your actor really is, what they realistically play, and what they can do.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["Submissions: August 4 – September 7, 2026", "Ages 6–21", "Free to submit"].map((item, i) => <span key={item} style={{ borderRadius: 999, padding: "9px 14px", fontWeight: 800, fontSize: 14, background: i === 2 ? C.lime : "#E5DDD1" }}>{item}</span>)}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "64px 32px 96px" }}>
        <div style={{ background: "#172330", border: `1px solid ${C.blue}`, borderRadius: 22, padding: "clamp(22px, 4vw, 34px)", marginBottom: 56 }}>
          <p style={{ fontFamily: display, color: C.blue, fontWeight: 800, fontSize: 19, margin: "0 0 8px" }}>Start here</p>
          <p style={{ fontSize: 17, lineHeight: 1.6, margin: 0, maxWidth: 900 }}>Open Call 11 is completely free to enter. You do not need to purchase a workshop, class, coaching session, submission review or any other Child Actor 101 service to participate. You do not need expensive or elaborate materials — just current, clear, thoughtful materials that represent the actor well.</p>
        </div>
        <div className="guide-grid">
          <nav className="guide-nav" aria-label="Guidelines sections">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} style={{ display: "block", color: C.soft, textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{section.number} &nbsp;{section.title}</a>)}
            <a href="#checklist" style={{ display: "block", color: C.lime, textDecoration: "none", fontSize: 13, fontWeight: 800, marginTop: 18 }}>12 &nbsp;Before you submit</a>
          </nav>
          <div style={{ display: "grid", gap: 64 }}>
            {sections.map((section) => <section key={section.id} id={section.id} style={{ scrollMarginTop: 100 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 18, borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
                <h2 style={{ fontFamily: display, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-.03em", margin: 0 }}><span style={{ color: C.coral, fontSize: 14, verticalAlign: "middle", letterSpacing: ".08em" }}>{section.number}</span> {section.title}</h2>
                <span style={{ flex: "none", color: C.lime, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", textAlign: "right" }}>{section.required}</span>
              </div>
              <div style={{ display: "grid", gap: 14, maxWidth: 810 }}>
                {section.intro.map((paragraph) => <p key={paragraph} style={{ color: C.soft, fontSize: 16.5, lineHeight: 1.65, margin: 0 }}>{paragraph}</p>)}
              </div>
              {section.callout && <p style={{ margin: "22px 0 0", background: C.lime, color: C.bg, borderRadius: 14, padding: "16px 18px", fontFamily: display, fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{section.callout}</p>}
              {section.cards && <div className="guide-cards" style={{ marginTop: 24 }}>{section.cards.map((card) => <article key={card.title} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22 }}><h3 style={{ color: C.ink, fontFamily: display, fontSize: 19, margin: "0 0 10px" }}>{card.title}</h3><p style={{ color: C.soft, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 14px" }}>{card.text}</p><ul style={{ listStyle: "none", display: "grid", gap: 8, padding: 0, margin: 0 }}>{card.bullets.map((bullet) => <li key={bullet} style={{ display: "flex", gap: 8, color: C.soft, fontSize: 13.5, lineHeight: 1.45 }}><span style={{ color: C.coral, fontWeight: 900 }}>↳</span>{bullet}</li>)}</ul></article>)}</div>}
              {section.id === "photos" && <div style={{ marginTop: 28 }}>
                <p style={{ color: C.lime, fontSize: 13, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", margin: "0 0 12px" }}>Photo examples</p>
                <div className="guide-example-grid">
                  <figure><Image src="/opencall/commercialexamples.jpeg" width={1262} height={1003} alt="Examples of commercial headshots for young performers" /><figcaption>Commercial examples</figcaption></figure>
                  <figure><Image src="/opencall/theatricalexamples.png" width={1024} height={805} alt="Examples of theatrical headshots for young performers" /><figcaption>Theatrical examples</figcaption></figure>
                  <figure><Image src="/opencall/lighttheatricalexamples.png" width={945} height={756} alt="Examples of light theatrical headshots for young performers" /><figcaption>Light theatrical examples</figcaption></figure>
                </div>
              </div>}
              {section.bullets && <ul style={{ listStyle: "none", display: "grid", gap: 10, padding: 0, margin: "22px 0 0", maxWidth: 810 }}>{section.bullets.map((bullet) => <li key={bullet} style={{ display: "flex", gap: 10, color: C.soft, fontSize: 15.5, lineHeight: 1.5 }}><span style={{ color: C.lime, fontWeight: 900 }}>✓</span>{bullet}</li>)}</ul>}
              {section.id === "resume" && <a href="https://resumes.childactor101.com" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginTop: 24, padding: "18px 20px", background: C.blue, color: "#10233F", borderRadius: 16, textDecoration: "none" }}><span><span style={{ display: "block", fontFamily: display, fontSize: 18, fontWeight: 800 }}>Free Industry Standard Youth Resume Creator</span><span style={{ display: "block", marginTop: 4, fontSize: 14, fontWeight: 600 }}>Build a clean, professional youth acting résumé with Resume101.</span></span><span style={{ flex: "none", fontWeight: 900 }}>Resume101 ↗</span></a>}
            </section>)}

            <section id="checklist" style={{ background: C.coral, color: C.bg, borderRadius: 24, padding: "clamp(24px, 5vw, 42px)", scrollMarginTop: 100 }}>
              <p style={{ fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 13, margin: "0 0 12px" }}>12 · Before you hit submit</p>
              <h2 style={{ fontFamily: display, fontSize: "clamp(2rem, 4vw, 3.2rem)", letterSpacing: "-.035em", margin: "0 0 28px" }}>A five-minute final check</h2>
              <div className="guide-cards">{checklist.map(([title, ...items]) => <div key={title} style={{ background: "rgba(20,18,16,.12)", border: "1px solid rgba(20,18,16,.22)", borderRadius: 16, padding: 20 }}><h3 style={{ fontFamily: display, fontSize: 18, margin: "0 0 12px" }}>{title}</h3>{items.map((item) => <p key={item} style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 10px" }}>□ {item}</p>)}</div>)}</div>
              <p style={{ maxWidth: 780, fontFamily: display, fontSize: "clamp(1.25rem, 2.5vw, 1.65rem)", lineHeight: 1.35, fontWeight: 800, margin: "34px 0 0" }}>Do not spend the next month trying to manufacture the world’s most perfect Open Call submission. There isn’t one. Give us current materials, your strongest acting, believable types, personality and enough information to understand who this young actor is. Then submit it. That’s the job.</p>
            </section>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: "32px", textAlign: "center", color: C.soft, fontSize: 14 }}>
        <p style={{ margin: "0 0 12px" }}>Open Call 11 is free to enter. No purchase is required or given preferential consideration.</p>
        <Link href="/opencall#apply" style={{ color: C.lime, fontWeight: 800 }}>Return to the free Open Call submission</Link>
      </footer>
    </main>
  );
}
