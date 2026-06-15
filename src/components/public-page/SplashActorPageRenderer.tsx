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
  TemplateResume,
  TemplateSlateModal
} from "@/components/public-page/TemplateParts";
import type { ActorPage, Clip, FeedItem, Headshot } from "@/lib/types";

type EnabledSection = ActorPage["sections"][number];

export function SplashActorPageRenderer({ page }: { page: ActorPage }) {
  const headshots = getHeadshots(page);
  const featured = headshots.find((headshot) => headshot.featured) ?? headshots[0];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slateOpen, setSlateOpen] = useState(false);
  const displayName = splitDisplayName(page.displayName);
  const monogram = page.displayName.trim().charAt(0).toUpperCase() || "P";
  const sortedSections = page.sections
    .filter((section) => section.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleHeadshots = headshots;
  const hasSlate = Boolean(page.slateUrl);

  return (
    <main className="splash-template" style={getTemplateCss("splash", page.accent, page.fontPair)}>
      <div className="page">
        <button
          className="feature"
          data-slate={hasSlate ? true : undefined}
          aria-label={hasSlate ? "Play slate video" : `${page.displayName} featured headshot`}
          type="button"
          onClick={() => hasSlate && setSlateOpen(true)}
        >
          <TemplateImageSlot className="ph" image={featured} fallbackLabel={monogram} sizes="min(330px, 78vw)" priority />
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

        <div className="pills">
          {[page.unionStatus, page.ageRange, page.market].filter(Boolean).map((value) => (
            <span className="pill" key={value}>
              {value}
            </span>
          ))}
        </div>

        {page.statusLine ? <p className="status">{page.statusLine}</p> : null}

        <p className="reps">
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
        {!page.hasRep ? <p className="parent-note">Messages go through a private relay. No contact details are published on this page.</p> : null}

        <TemplateLinks page={page} />

        {sortedSections.map((section) => (
          <SplashSection key={section.id} page={page} section={section} headshots={visibleHeadshots} onHeadshotClick={setLightboxIndex} />
        ))}

        <div className="footer">
          Made with <b>Pages101</b>
        </div>
      </div>

      <TemplateLightbox headshots={visibleHeadshots} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} />
      <TemplateSlateModal slateUrl={page.slateUrl} open={slateOpen} onClose={() => setSlateOpen(false)} />
    </main>
  );
}

function SplashSection({
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
    return <SplashHeadshots headshots={headshots} onHeadshotClick={onHeadshotClick} />;
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
    return <SplashClips clips={section.content.clips} />;
  }

  if (section.type === "feed") {
    return <SplashFeed items={section.content.items} />;
  }

  return null;
}

function SplashHeadshots({ headshots, onHeadshotClick }: { headshots: Headshot[]; onHeadshotClick: (index: number) => void }) {
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
            <TemplateImageSlot image={headshot} fallbackLabel="✦" sizes="(max-width: 600px) 50vw, 210px" />
          </button>
        ))}
      </div>
    </div>
  );
}

function SplashClips({ clips }: { clips: Clip[] }) {
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

function SplashFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="sec">
      <div className="sec-title">Lately</div>
      <div className="feed">
        {items.map((item) => (
          <div className="feed-card" key={item.id}>
            <div className="feed-date">{item.date}</div>
            <p className="feed-text">{item.body}</p>
            {item.image ? (
              <TemplateImageSlot image={{ id: item.id, src: item.image, alt: "", label: item.title }} fallbackLabel="✦" className="feed-img ph" sizes="680px" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateLinks({ page }: { page: ActorPage }) {
  if (page.links.length === 0) {
    return null;
  }

  return (
    <div className="links">
      {page.links.map((link) => (
        <a key={link.url} href={link.url} rel="noreferrer" target="_blank">
          {link.label}
        </a>
      ))}
    </div>
  );
}
