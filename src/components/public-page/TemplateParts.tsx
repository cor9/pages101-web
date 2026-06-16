"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import type { ActorPage, Headshot, ResumeCredit, ResumeSection } from "@/lib/types";
import { isPdfFile } from "@/lib/media";
import { normalizeEmbedUrl } from "@/lib/video";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask
} from "pdfjs-dist/types/src/display/api";

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
  if (resume.fileUrl && isPdfFile(resume.fileName ?? resume.fileUrl)) {
    return (
      <div className="sheet">
        <ResumePdfPreview fileUrl={resume.fileUrl} fileName={resume.fileName} />
        <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer">
          ↓ Download Resume PDF
        </a>
      </div>
    );
  }

  if (resume.fileUrl) {
    return (
      <div className="sheet">
        <div className="resume-file-card">
          <div className="resume-file-badge">Resume file attached</div>
          <p>{resume.fileName || "Resume document"}</p>
        </div>
        <a href={resume.fileUrl} target="_blank" rel="noopener noreferrer">
          ↓ Download Resume File
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

function ResumePdfPreview({ fileUrl, fileName }: { fileUrl: string; fileName?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let pdfDocument: PDFDocumentProxy | null = null;

    async function renderPreview() {
      try {
        setLoading(true);
        setError(null);

        const [{ getDocument }, response] = await Promise.all([
          import("pdfjs-dist/webpack.mjs"),
          fetch(fileUrl, { mode: "cors" })
        ]);

        if (!response.ok) {
          throw new Error("Unable to load the resume PDF.");
        }

        const arrayBuffer = await response.arrayBuffer();
        loadingTask = getDocument({
          data: arrayBuffer,
          useWorkerFetch: false,
          disableRange: true,
          disableStream: true,
          disableAutoFetch: true
        });
        pdfDocument = await loadingTask.promise;

        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        const page: PDFPageProxy = await pdfDocument.getPage(1);
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        const canvas = canvasRef.current;
        const wrapWidth = wrapRef.current?.clientWidth ?? 0;
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = wrapWidth > 0 ? wrapWidth : baseViewport.width;
        const scale = targetWidth / baseViewport.width;
        const deviceScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * deviceScale });
        const context = canvas?.getContext("2d", { alpha: false });

        if (!canvas || !context) {
          throw new Error("Unable to prepare the resume preview.");
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        renderTask = page.render({ canvasContext: context, canvas, viewport });
        await renderTask.promise;

        if (!cancelled) {
          setLoading(false);
        }
      } catch (previewError) {
        if (!cancelled) {
          setError(previewError instanceof Error ? previewError.message : "Unable to render the resume preview.");
          setLoading(false);
        }
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      loadingTask?.destroy();
      pdfDocument?.cleanup();
    };
  }, [fileUrl]);

  return (
    <div className="resume-preview" ref={wrapRef} aria-label={fileName ? `Resume preview for ${fileName}` : "Resume preview"} aria-busy={loading}>
      <canvas ref={canvasRef} />
      {loading ? <div className="resume-preview-state">Rendering resume preview…</div> : null}
      {error ? <div className="resume-preview-state resume-preview-state--error">{error}</div> : null}
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
