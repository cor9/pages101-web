"use client";

import { useState } from "react";
import { getTemplateCss } from "@/lib/templates";
import { normalizeEmbedUrl } from "@/lib/video";
import {
  buildPlaceholderHeadshots,
  getHeadshots,
  hasRenderableImage,
  splitDisplayName,
  TemplateImageSlot,
  TemplateLightbox,
  TemplateRelayForm,
  TemplateResume,
  TemplateSlateModal
} from "@/components/public-page/TemplateParts";
import type { ActorPage, Clip, FeedItem, Headshot } from "@/lib/types";

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
    <main className="classic-template" style={getTemplateCss("classic", page.accent, page.fontPair, page.background)}>
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
          <TemplateImageSlot
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
          <>
            <p className="parent-note">Messages go through a private relay. No contact details are published on this page.</p>
            <TemplateRelayForm pageSlug={page.slug} pageName={page.displayName} />
          </>
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

      <TemplateLightbox
        headshots={visibleHeadshots}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />

      <TemplateSlateModal slateUrl={page.slateUrl} open={slateOpen} onClose={() => setSlateOpen(false)} />
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
    return (
      <div className="sec">
        <div className="sec-title">Resume</div>
        <TemplateResume page={page} resume={section.content} />
      </div>
    );
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
            <TemplateImageSlot image={headshot} fallbackLabel="*" sizes="(max-width: 600px) 50vw, 210px" />
          </button>
        ))}
      </div>
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
              <iframe src={normalizeEmbedUrl(clip.embedUrl)} title={clip.title} allow="autoplay; fullscreen; picture-in-picture" />
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
              <TemplateImageSlot image={{ id: item.id, src: item.image, alt: "", label: item.title }} fallbackLabel="*" className="feed-img ph" sizes="680px" />
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
          <a className="promo-card" href="https://pages.childactor101.com">
            <b>Prep101</b>
            <span>Audition prep guides built from 30 years of coaching young actors.</span>
            <i>Explore Prep101 →</i>
          </a>
          <a className="promo-card" href="https://pages.childactor101.com">
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
