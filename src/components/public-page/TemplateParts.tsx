"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import type { ActorPage, Headshot, ResumeCredit, ResumeSection } from "@/lib/types";
import { getDocumentViewerUrl, isPdfFile } from "@/lib/media";
import { normalizeEmbedUrl } from "@/lib/video";

export function TemplateImageSlot({
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
    // Use .img-wrap instead of .ph so the placeholder gradient ::after does NOT overlay real photos
    const wrapClass = className ? className.replace(/\bph\b/, "img-wrap").trim() || "img-wrap" : "img-wrap";
    return (
      <div className={wrapClass}>
        <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} style={{ objectPosition: image.focus ?? "center center" }} />
      </div>
    );
  }

  return (
    <div className={className ?? "ph"}>
      <span>{fallbackLabel}</span>
    </div>
  );
}

export function TemplateResume({ page, resume }: { page: ActorPage; resume: ResumeSection }) {
  if (resume.fileUrl) {
    return (
      <div className="sheet">
        <div className="resume-preview">
          <iframe
            src={isPdfFile(resume.fileName ?? resume.fileUrl) ? resume.fileUrl : getDocumentViewerUrl(resume.fileUrl)}
            title={resume.fileName || "Resume preview"}
            loading="lazy"
            allow="fullscreen"
          />
        </div>
        <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer">
          ↓ Download PDF
        </a>
      </div>
    );
  }

  if (resume.credits.length === 0) {
    return null;
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <h3>{page.displayName}</h3>
        <p>{[page.unionStatus, page.ageRange, page.market].filter(Boolean).join(" · ")}</p>
      </div>
      {resume.syncedWithResume101 ? (
        <div className="sheet-sync">
          <p>
            <b>Synced with Resume101</b> · Last updated {resume.updatedAt}. Edit once, update everywhere.
          </p>
        </div>
      ) : null}
      <h4>Television</h4>
      {resume.credits.map((credit) => <ResumeRow key={`${credit.project}-${credit.role}`} credit={credit} />)}
    </div>
  );
}

export function TemplateLightbox({
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
        <TemplateImageSlot className="ph" image={current} fallbackLabel={String(currentIndex + 1)} sizes="min(500px, 86vw)" />
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

export function TemplateSlateModal({ slateUrl, open, onClose }: { slateUrl: string | null; open: boolean; onClose: () => void }) {
  return (
    <div className={open ? "modal open" : "modal"} id="slate" role="dialog" aria-modal="true" aria-label="Slate video">
      <button className="m-btn m-close" aria-label="Close" type="button" onClick={onClose}>
        ✕
      </button>
      <div className="slate-stage">
        <div className="vid">
          {slateUrl ? <iframe src={normalizeEmbedUrl(slateUrl)} title="Slate video" allow="autoplay; fullscreen; picture-in-picture" /> : null}
        </div>
        <div className="m-cap">Slate</div>
      </div>
    </div>
  );
}

export function TemplateRelayForm({ pageSlug, pageName }: { pageSlug: string; pageName: string }) {
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [website, setWebsite] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/relay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: pageSlug,
          senderName,
          senderEmail,
          body,
          website
        })
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setStatus(payload.error ?? "We could not send that message.");
        return;
      }

      setSenderName("");
      setSenderEmail("");
      setBody("");
      setWebsite("");
      setStatus(payload.message ?? "Message sent. The parent relay has it.");
    } catch {
      setStatus("We could not send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="relay-card" id="contact" aria-label={`Contact ${pageName}'s parent`}>
      <div className="relay-copy">
        <h2>Contact {pageName}&apos;s Parent</h2>
        <p>This message goes through a private relay. Parent contact details stay off the page.</p>
      </div>
      <form className="relay-form" onSubmit={handleSubmit}>
        <label>
          Your name
          <input value={senderName} onChange={(event) => setSenderName(event.target.value)} required />
        </label>
        <label>
          Your email
          <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} required />
        </label>
        <label className="relay-honeypot" aria-hidden="true">
          Website
          <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
        <label>
          Message
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={5} />
        </label>
        <button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send relay message"}
        </button>
        {status ? <p className="relay-status">{status}</p> : null}
      </form>
    </section>
  );
}

export function getHeadshots(page: ActorPage) {
  const section = page.sections.find((candidate) => candidate.type === "headshots");
  if (!section || section.type !== "headshots") {
    return [];
  }
  return section.content.headshots;
}

export function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { first: name, last: "" };
  }
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1]
  };
}

export function hasRenderableImage(headshot?: Headshot) {
  return Boolean(headshot?.src && headshot.src !== "/pageslogo.png");
}

export function buildPlaceholderHeadshots(count: number): Headshot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `placeholder-${index + 1}`,
    src: "",
    alt: `Headshot ${index + 1}`,
    label: `Headshot ${index + 1}`
  }));
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

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}
