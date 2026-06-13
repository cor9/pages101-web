import clsx from "clsx";
import Image from "next/image";
import { tips } from "@/content/tips";
import { ClassicActorPageRenderer } from "@/components/public-page/ClassicActorPageRenderer";
import { getTemplateCss, templateTokens } from "@/lib/templates";
import type { ActorPage, Clip, FeedItem, Headshot, PressQuote, ResumeSection, SectionType } from "@/lib/types";

type ActorPageRendererProps = {
  page: ActorPage;
};

type SectionRendererProps<T> = {
  page: ActorPage;
  content: T;
};

const sectionLabels: Record<SectionType, string> = {
  headshots: "Headshots",
  resume: "Resume",
  clips: "Clips",
  feed: "Updates",
  press: "Press"
};

export function ActorPageRenderer({ page }: ActorPageRendererProps) {
  if (page.template === "classic") {
    return <ClassicActorPageRenderer page={page} />;
  }

  const template = templateTokens[page.template];
  const featured = getHeadshots(page).find((headshot) => headshot.featured) ?? getHeadshots(page)[0];
  const visibleSections = page.sections
    .filter((section) => section.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main
      className={clsx("actor-page", `actor-page--${page.template}`, page.plan === "free" && "actor-page--free")}
      style={getTemplateCss(page.template, page.accent, page.fontPair)}
    >
      {page.plan === "free" ? (
        <div className="free-topbar">
          <span>Built with Pages101 by Child Actor 101</span>
          <a href="https://childactor101.com">Explore Child Actor 101</a>
        </div>
      ) : null}

      <article className="actor-shell" aria-label={`${page.displayName} actor page`}>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="template-label">{template.label}</p>
            <h1>{page.displayName}</h1>
            <p className="status-line">{page.statusLine}</p>
            <dl className="hero-facts" aria-label="Actor details">
              <div>
                <dt>Union</dt>
                <dd>{page.unionStatus}</dd>
              </div>
              <div>
                <dt>Age Range</dt>
                <dd>{page.ageRange}</dd>
              </div>
              <div>
                <dt>Market</dt>
                <dd>{page.market}</dd>
              </div>
            </dl>
            <div className="link-row" aria-label="Actor profile links">
              {page.links.map((link) => (
                <a key={link.url} href={link.url} rel="noreferrer" target="_blank">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {featured ? (
            <a className="featured-headshot" href={page.slateUrl ?? "#clips"} aria-label="Open slate video">
              <Image src={featured.src} alt={featured.alt} fill priority sizes="(max-width: 880px) 100vw, 420px" />
              <span>Tap for slate</span>
            </a>
          ) : null}
        </section>

        <section className="contact-band" aria-label="Representation and contact">
          {page.hasRep && page.reps.length > 0 ? (
            page.reps.map((rep) => (
              <a key={`${rep.role}-${rep.email}`} href={`mailto:${rep.email}`}>
                <span>{rep.role}</span>
                {rep.name}
              </a>
            ))
          ) : (
            <div>
              <h2>Contact {page.displayName}&apos;s Parent</h2>
              <p>Messages go through a private relay. No parent contact details are published.</p>
              <a href="#relay">Request contact</a>
            </div>
          )}
        </section>

        {visibleSections.map((section) => {
          if (section.type === "headshots") {
            return <HeadshotsSection key={section.id} page={page} content={section.content} />;
          }
          if (section.type === "resume") {
            return <ResumeSectionView key={section.id} page={page} content={section.content} />;
          }
          if (section.type === "clips") {
            return <ClipsSection key={section.id} page={page} content={section.content} />;
          }
          if (section.type === "feed") {
            return <FeedSection key={section.id} page={page} content={section.content} />;
          }
          return <PressSection key={section.id} page={page} content={section.content} />;
        })}

        <section id="relay" className="relay-section" aria-label="Private contact relay">
          <div>
            <h2>Private Contact Relay</h2>
            <p>Public pages never render parent email, phone, address, birthdate, school, or schedule details.</p>
          </div>
          <button type="button">Request contact</button>
        </section>
      </article>

      {page.plan === "free" ? <FreeFooter /> : <p className="plus-credit">Made with Pages101</p>}
    </main>
  );
}

function getHeadshots(page: ActorPage) {
  const section = page.sections.find((candidate) => candidate.type === "headshots");
  if (!section || section.type !== "headshots") {
    return [];
  }
  return section.content.headshots;
}

function SectionHeader({ type, tip }: { type: SectionType; tip?: keyof typeof tips }) {
  return (
    <header className="section-header">
      <div>
        <p>{sectionLabels[type]}</p>
        <h2>{sectionLabels[type]}</h2>
      </div>
      {tip ? (
        <aside>
          <strong>101 Tip: {tips[tip].title}</strong>
          <span>{tips[tip].body}</span>
        </aside>
      ) : null}
    </header>
  );
}

function HeadshotsSection({ page, content }: SectionRendererProps<{ headshots: Headshot[] }>) {
  const visibleHeadshots = page.plan === "free" ? content.headshots.slice(0, 6) : content.headshots;

  return (
    <section className="page-section">
      <SectionHeader type="headshots" tip="headshots" />
      <div className="headshot-grid">
        {visibleHeadshots.map((headshot) => (
          <figure key={headshot.id}>
            <div className="headshot-image">
              <Image src={headshot.src} alt={headshot.alt} fill priority sizes="(max-width: 880px) 100vw, 25vw" />
            </div>
            <figcaption>{headshot.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function ResumeSectionView({ content }: SectionRendererProps<ResumeSection>) {
  return (
    <section className="page-section">
      <SectionHeader type="resume" tip="resume" />
      <div className="resume-paper">
        {content.syncedWithResume101 ? <p className="sync-strip">Synced with Resume101 · {content.updatedAt}</p> : null}
        <div className="credit-list">
          {content.credits.map((credit) => (
            <div key={`${credit.project}-${credit.role}`}>
              <span>{credit.project}</span>
              <span>{credit.role}</span>
              <span>{credit.company}</span>
            </div>
          ))}
        </div>
        <button type="button">Download PDF</button>
      </div>
    </section>
  );
}

function ClipsSection({ page, content }: SectionRendererProps<{ clips: Clip[] }>) {
  const visibleClips = page.plan === "free" ? content.clips.slice(0, 2) : content.clips;

  return (
    <section className="page-section" id="clips">
      <SectionHeader type="clips" tip="clips" />
      <div className="clip-grid">
        {visibleClips.map((clip) => (
          <article key={clip.id}>
            <div className="embed-frame">
              <iframe src={clip.embedUrl} title={clip.title} allow="autoplay; fullscreen; picture-in-picture" />
            </div>
            <p>{clip.category}</p>
            <h3>{clip.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedSection({ content }: SectionRendererProps<{ items: FeedItem[] }>) {
  return (
    <section className="page-section">
      <SectionHeader type="feed" tip="updates" />
      <div className="feed-list">
        {content.items.map((item) => (
          <article key={item.id}>
            <time dateTime={item.date}>{item.date}</time>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PressSection({ content }: SectionRendererProps<PressQuote>) {
  if (!content.quote) {
    return null;
  }

  return (
    <section className="press-section">
      <SectionHeader type="press" tip="press" />
      <figure>
        <blockquote>{content.quote}</blockquote>
        <figcaption>{content.attribution}</figcaption>
      </figure>
    </section>
  );
}

function FreeFooter() {
  return (
    <footer className="ecosystem-footer">
      <div>
        <p>Prep101</p>
        <span>Audition coaching and self-tape prep for young performers.</span>
      </div>
      <div>
        <p>Vendor Directory</p>
        <span>Trusted photographers, coaches, and production resources.</span>
      </div>
      <div>
        <p>Resume101</p>
        <span>Build and sync a clean actor resume.</span>
      </div>
    </footer>
  );
}
