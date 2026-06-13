"use client";

import Image from "next/image";
import { useState } from "react";
import { getTemplateCss } from "@/lib/templates";
import type { ActorPage, Clip, FeedItem, Headshot, ResumeCredit, ResumeSection } from "@/lib/types";

type ClassicActorPageRendererProps = {
  page: ActorPage;
};

type EnabledSection = ActorPage["sections"][number];

export function ClassicActorPageRenderer({ page }: ClassicActorPageRendererProps) {
  const headshots = getHeadshots(page);
  const visibleHeadshots = page.plan === "free" ? headshots.slice(0, 6) : headshots;
  const featured = headshots.find((headshot) => headshot.featured) ?? headshots[0];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slateOpen, setSlateOpen] = useState(false);
  const displayName = splitDisplayName(page.displayName);
  const monogram = page.displayName.trim().charAt(0).toUpperCase() || "P";
  const sortedSections = page.sections
    .filter((section) => section.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasSlate = Boolean(page.slateUrl);

  return (
    <main className="classic-template" style={getTemplateCss("classic", page.accent, page.fontPair)}>
      {page.plan === "free" ? (
        <div className="freebar">
          ✦ This page is hosted free on <b>Pages101</b> by Child Actor 101{" "}
          <a href="https://pages.childactor101.com">Build yours →</a>
        </div>
      ) : null}

      <div className="page">
        <button
          className="feature"
          data-slate={hasSlate ? true : undefined}
          aria-label={hasSlate ? "Play slate video" : `${page.displayName} featured headshot`}
          type="button"
          onClick={() => hasSlate && setSlateOpen(true)}
        >
          <ClassicImageSlot
            className="ph"
            image={featured}
            fallbackLabel={monogram}
            sizes="min(380px, 80vw)"
            priority
          />
          {hasSlate ? <span className="slate-badge">Play my slate</span> : null}
        </button>

        <h1>
          {displayName.first}
          {displayName.last ? (
            <>
              {" "}
              <em>{displayName.last}</em>
            </>
          ) : null}
        </h1>

        {page.statusLine ? <p className="status">{page.statusLine}</p> : null}

        <p className="reps">
          {[page.unionStatus, page.ageRange, page.market].filter(Boolean).join(" · ")}
          <br />
          {page.hasRep && page.reps.length > 0 ? (
            page.reps.map((rep, index) => (
              <span key={`${rep.role}-${rep.email}`}>
                {index > 0 ? " · " : null}
                <a href={`mailto:${rep.email}`}>
                  {rep.name}
                  {rep.role === "manager" ? ", Manager" : null}
                </a>
              </span>
            ))
          ) : (
            <a className="parent-btn" href="#contact">
              Contact {displayName.first || page.displayName}&apos;s Parent
            </a>
          )}
        </p>
        {!page.hasRep ? (
          <p className="parent-note">Messages go through a private relay. No contact details are published on this page.</p>
        ) : null}

        {page.links.length > 0 ? (
          <div className="links">
            {page.links.map((link) => (
              <a key={link.url} href={link.url} rel="noreferrer" target="_blank">
                {link.label}
              </a>
            ))}
          </div>
        ) : null}

        {sortedSections.map((section) => (
          <ClassicSection
            key={section.id}
            page={page}
            section={section}
            headshots={visibleHeadshots}
            onHeadshotClick={setLightboxIndex}
          />
        ))}
      </div>

      {page.plan === "free" ? <ClassicFreePromo /> : <ClassicPlusCredit />}

      <Lightbox
        headshots={visibleHeadshots}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />

      <SlateModal slateUrl={page.slateUrl} open={slateOpen} onClose={() => setSlateOpen(false)} />
    </main>
  );
}

function ClassicSection({
  page,
  section,
  headshots,
  onHeadshotClick
}: {
  page: ActorPage;
  section: EnabledSection;
  headshots: Headshot[];
  onHeadshotClick: (index: number) => void;
}) {
  if (section.type === "headshots") {
    return <ClassicHeadshots headshots={headshots} onHeadshotClick={onHeadshotClick} />;
  }

  if (section.type === "resume") {
    return <ClassicResume page={page} resume={section.content} />;
  }

  if (section.type === "clips") {
    return <ClassicClips clips={page.plan === "free" ? section.content.clips.slice(0, 2) : section.content.clips} />;
  }

  if (section.type === "feed" && page.plan === "plus") {
    return <ClassicFeed items={section.content.items} />;
  }

  return null;
}

function ClassicHeadshots({
  headshots,
  onHeadshotClick
}: {
  headshots: Headshot[];
  onHeadshotClick: (index: number) => void;
}) {
  const slots = headshots.length > 0 ? headshots : buildPlaceholderHeadshots(6);

  return (
    <div className="sec">
      <div className="sec-title">Headshots</div>
      <div className="grid3" data-gallery>
        {slots.map((headshot, index) => (
          <button
            key={headshot.id}
            className={hasRenderableImage(headshot) ? "photo-btn" : "ph"}
            aria-label={`View headshot ${index + 1}`}
            type="button"
            onClick={() => onHeadshotClick(index)}
          >
            <ClassicImageSlot image={headshot} fallbackLabel="*" sizes="(max-width: 600px) 50vw, 210px" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassicResume({ page, resume }: { page: ActorPage; resume: ResumeSection }) {
  return (
    <div className="sec">
      <div className="sec-title">Resume</div>
      <div className="sheet">
        <div className="sheet-head">
          <h3>{page.displayName}</h3>
          <p>{[page.unionStatus, page.ageRange, page.market].filter(Boolean).join(" · ")}</p>
        </div>
        <h4>Television</h4>
        {resume.credits.length > 0 ? (
          resume.credits.map((credit) => <ResumeRow key={`${credit.project}-${credit.role}`} credit={credit} />)
        ) : (
          <div className="srow">
            <span className="p">Production</span>
            <span className="r">Role</span>
            <span className="d">Network</span>
          </div>
        )}
        <h4>Training</h4>
        <div className="srow">
          <span className="p">Class</span>
          <span className="r">Status</span>
          <span className="d">Cadence</span>
        </div>
        <h4>Special Skills</h4>
        <p className="skills">Skills line.</p>
        {resume.syncedWithResume101 ? (
          <div className="sheet-sync">
            <p>
              <b>Synced with Resume101</b> · Last updated {resume.updatedAt}. Edit once, update everywhere.
            </p>
            <a href="#">↓ Download PDF</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResumeRow({ credit }: { credit: ResumeCredit }) {
  return (
    <div className="srow">
      <span className="p">{credit.project}</span>
      <span className="r">{credit.role}</span>
      <span className="d">{credit.company}</span>
    </div>
  );
}

function ClassicClips({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return null;
  }

  return (
    <div className="sec">
      <div className="sec-title">Watch</div>
      <div className="clips">
        {clips.map((clip) => (
          <div className="clip" key={clip.id}>
            <small>{clip.category}</small>
            <p>{clip.title}</p>
            <div className="vid">
              <iframe src={clip.embedUrl} title={clip.title} allow="autoplay; fullscreen; picture-in-picture" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassicFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="sec">
      <div className="sec-title">Updates</div>
      <div className="feed">
        {items.map((item) => (
          <div className="feed-card" key={item.id}>
            <div className="feed-date">{item.date}</div>
            <div className="feed-text">{item.body}</div>
            {item.image ? (
              <div className="feed-img ph">
                <Image src={item.image} alt="" fill sizes="680px" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassicFreePromo() {
  return (
    <div className="promo">
      <div className="promo-in">
        <div className="promo-eyebrow">From Child Actor 101</div>
        <div className="promo-cards">
          <a className="promo-card" href="https://childactor101.com">
            <b>Prep101</b>
            <span>Audition prep guides built from 30 years of coaching young actors.</span>
            <i>Explore Prep101 →</i>
          </a>
          <a className="promo-card" href="https://childactor101.com">
            <b>Vendor Directory</b>
            <span>Trusted headshot photographers, coaches, and reel editors — vetted for families.</span>
            <i>Browse the Directory →</i>
          </a>
        </div>
        <div className="promo-badge">
          Made with <b>Pages101</b> by Child Actor 101 · Free for young actors
        </div>
      </div>
    </div>
  );
}

function ClassicPlusCredit() {
  return (
    <div className="promo-badge classic-plus-credit">
      Made with <b>Pages101</b>
    </div>
  );
}

function Lightbox({
  headshots,
  index,
  onClose,
  onChange
}: {
  headshots: Headshot[];
  index: number | null;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const total = Math.max(headshots.length, 1);
  const currentIndex = index ?? 0;
  const current = headshots[currentIndex];

  return (
    <div className={index === null ? "modal" : "modal open"} id="lb" role="dialog" aria-modal="true" aria-label="Headshot viewer">
      <button className="m-btn m-close" aria-label="Close" type="button" onClick={onClose}>
        ✕
      </button>
      <button className="m-btn m-prev" aria-label="Previous" type="button" onClick={() => onChange(wrapIndex(currentIndex - 1, total))}>
        ‹
      </button>
      <div className="lb-stage">
        <ClassicImageSlot className="ph" image={current} fallbackLabel={String(currentIndex + 1)} sizes="min(500px, 86vw)" />
        <div className="m-cap">
          Headshot <span id="lb-cap-n">{currentIndex + 1}</span>
        </div>
      </div>
      <button className="m-btn m-next" aria-label="Next" type="button" onClick={() => onChange(wrapIndex(currentIndex + 1, total))}>
        ›
      </button>
    </div>
  );
}

function SlateModal({ slateUrl, open, onClose }: { slateUrl: string | null; open: boolean; onClose: () => void }) {
  return (
    <div className={open ? "modal open" : "modal"} id="slate" role="dialog" aria-modal="true" aria-label="Slate video">
      <button className="m-btn m-close" aria-label="Close" type="button" onClick={onClose}>
        ✕
      </button>
      <div className="slate-stage">
        <div className="vid">
          {slateUrl ? <iframe src={slateUrl} title="Slate video" allow="autoplay; fullscreen; picture-in-picture" /> : null}
        </div>
        <div className="m-cap">Slate</div>
      </div>
    </div>
  );
}

function ClassicImageSlot({
  image,
  fallbackLabel,
  className,
  sizes,
  priority = false
}: {
  image?: Headshot;
  fallbackLabel: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  if (image && hasRenderableImage(image)) {
    if (className) {
      return (
        <div className={className}>
          <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} />
        </div>
      );
    }

    return <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} />;
  }

  return (
    <div className={className ?? "ph"}>
      <span>{fallbackLabel}</span>
    </div>
  );
}

function getHeadshots(page: ActorPage) {
  const section = page.sections.find((candidate) => candidate.type === "headshots");
  if (!section || section.type !== "headshots") {
    return [];
  }
  return section.content.headshots;
}

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { first: name, last: "" };
  }
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1]
  };
}

function hasRenderableImage(headshot?: Headshot) {
  return Boolean(headshot?.src && headshot.src !== "/pageslogo.png");
}

function buildPlaceholderHeadshots(count: number): Headshot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `placeholder-${index + 1}`,
    src: "",
    alt: `Headshot ${index + 1}`,
    label: `Headshot ${index + 1}`
  }));
}

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}
