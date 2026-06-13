"use client";

import { useState } from "react";
import { getTemplateCss } from "@/lib/templates";
import {
  buildPlaceholderHeadshots,
  getHeadshots,
  hasRenderableImage,
  TemplateImageSlot,
  TemplateLightbox,
  TemplateResume,
  TemplateSlateModal
} from "@/components/public-page/TemplateParts";
import type { ActorPage, Clip, FeedItem, Headshot, PressQuote } from "@/lib/types";

type EnabledSection = ActorPage["sections"][number];

export function PrestigeActorPageRenderer({ page }: { page: ActorPage }) {
  const headshots = getHeadshots(page);
  const featured = headshots.find((headshot) => headshot.featured) ?? headshots[0];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slateOpen, setSlateOpen] = useState(false);
  const sortedSections = page.sections
    .filter((section) => section.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const press = getPressQuote(sortedSections);
  const anchors = getPrestigeAnchors(sortedSections);
  const hasSlate = Boolean(page.slateUrl);

  return (
    <main className="prestige-template" style={getTemplateCss("prestige", page.accent, page.fontPair)}>
      <header className="hero">
        <TemplateImageSlot className="ph" image={featured} fallbackLabel={page.displayName.trim().charAt(0).toUpperCase() || "P"} sizes="100vw" priority />
        <nav className="nav">
          <a className="wordmark" href="#">
            {page.displayName}
          </a>
          <ul>
            {anchors.map((anchor) => (
              <li key={anchor.href}>
                <a href={anchor.href}>{anchor.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hero-info">
          <h1>{page.displayName}</h1>
          <p>{["Actor", page.unionStatus, page.market].filter(Boolean).join(" · ")}</p>
        </div>
        {hasSlate ? (
          <button className="hero-slate" data-slate type="button" onClick={() => setSlateOpen(true)}>
            Play Slate
          </button>
        ) : null}
      </header>

      {press ? (
        <div className="quote">
          <p>&quot;{press.quote}&quot;</p>
          <cite>{press.attribution}</cite>
        </div>
      ) : null}

      <div className="page">
        <div className="reps-block">
          {page.statusLine}
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
            <>
              <a className="parent-btn" href="#contact">
                Contact {page.displayName}&apos;s Parent
              </a>
              <p className="parent-note">Messages go through a private relay. No contact details are published on this page.</p>
            </>
          )}
        </div>
        <TemplateLinks page={page} />

        {sortedSections.map((section) => (
          <PrestigeSection key={section.id} page={page} section={section} headshots={headshots} onHeadshotClick={setLightboxIndex} />
        ))}
      </div>

      <footer className="footer">
        <div className="fm">{page.displayName}</div>
        <small>
          © 2026 · Made with <b>Pages101</b>
        </small>
      </footer>

      <TemplateLightbox headshots={headshots} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} />
      <TemplateSlateModal slateUrl={page.slateUrl} open={slateOpen} onClose={() => setSlateOpen(false)} />
    </main>
  );
}

function PrestigeSection({
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
    return <PrestigeHeadshots headshots={headshots} onHeadshotClick={onHeadshotClick} />;
  }

  if (section.type === "resume") {
    return (
      <div className="sec" id="p-resume">
        <div className="sec-title">Resume</div>
        <TemplateResume page={page} resume={section.content} />
      </div>
    );
  }

  if (section.type === "clips") {
    return <PrestigeClips clips={section.content.clips} />;
  }

  if (section.type === "feed") {
    return <PrestigeFeed items={section.content.items} />;
  }

  return null;
}

function PrestigeHeadshots({ headshots, onHeadshotClick }: { headshots: Headshot[]; onHeadshotClick: (index: number) => void }) {
  const slots = headshots.length > 0 ? headshots : buildPlaceholderHeadshots(6);

  return (
    <div className="sec" id="p-photos">
      <div className="sec-title">Photographs</div>
      <div className="grid3" data-gallery>
        {slots.map((headshot, index) => (
          <button
            key={headshot.id}
            className={hasRenderableImage(headshot) ? "photo-btn" : "ph"}
            aria-label={`View headshot ${index + 1}`}
            type="button"
            onClick={() => onHeadshotClick(index)}
          >
            <TemplateImageSlot image={headshot} fallbackLabel="✦" sizes="(max-width: 600px) 50vw, 286px" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PrestigeClips({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return null;
  }

  return (
    <div className="sec" id="p-video">
      <div className="sec-title">Video</div>
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

function PrestigeFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="sec" id="p-lately">
      <div className="sec-title">Lately</div>
      <div className="feed">
        {items.map((item) => (
          <div className="feed-card" key={item.id}>
            <div className="feed-date">{item.date}</div>
            <p className="feed-text">{item.body}</p>
            {item.image ? (
              <TemplateImageSlot image={{ id: item.id, src: item.image, alt: "", label: item.title }} fallbackLabel="✦" className="feed-img ph" sizes="880px" />
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

function getPressQuote(sections: EnabledSection[]): PressQuote | null {
  const section = sections.find((candidate) => candidate.type === "press");
  if (!section || section.type !== "press" || !section.content.quote) {
    return null;
  }

  return section.content;
}

function getPrestigeAnchors(sections: EnabledSection[]) {
  const anchors = [];
  if (sections.some((section) => section.type === "headshots")) {
    anchors.push({ href: "#p-photos", label: "Photos" });
  }
  if (sections.some((section) => section.type === "resume")) {
    anchors.push({ href: "#p-resume", label: "Resume" });
  }
  if (sections.some((section) => section.type === "clips")) {
    anchors.push({ href: "#p-video", label: "Video" });
  }
  if (sections.some((section) => section.type === "feed")) {
    anchors.push({ href: "#p-lately", label: "Lately" });
  }
  return anchors;
}
