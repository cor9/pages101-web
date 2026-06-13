"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ActorPageRenderer } from "@/components/public-page/ActorPageRenderer";
import { accentSwatches, fontPairOptions, templateTokens } from "@/lib/templates";
import { samplePages } from "@/lib/sample-data";
import { tips, type TipKey } from "@/content/tips";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ActorPage, FontPair, Headshot, SectionType, TemplateId } from "@/lib/types";

const page = samplePages[0];
const initialHeadshots = getPageHeadshots(page);

const sectionTipMap: Partial<Record<SectionType, TipKey>> = {
  headshots: "headshots",
  resume: "resume",
  clips: "clips",
  feed: "updates",
  press: "press"
};

export function DashboardShell() {
  const [displayName, setDisplayName] = useState(page.displayName);
  const [slug, setSlug] = useState(page.slug);
  const [statusLine, setStatusLine] = useState(page.statusLine);
  const [unionStatus, setUnionStatus] = useState(page.unionStatus);
  const [ageRange, setAgeRange] = useState(page.ageRange);
  const [market, setMarket] = useState(page.market);
  const [templateId, setTemplateId] = useState<TemplateId>(page.template);
  const [accent, setAccent] = useState<string | null>(page.accent);
  const [fontPair, setFontPair] = useState<FontPair>(page.fontPair ?? "template");
  const [headshots, setHeadshots] = useState<Headshot[]>(initialHeadshots);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const checkedSlug = validateSlug(slug);
  const publicSlug = checkedSlug.ok ? checkedSlug.slug : page.slug;
  const renderedHeadshots = headshots.length > 0 ? headshots : initialHeadshots;
  const realHeadshotCount = renderedHeadshots.filter((headshot) => !isPlaceholderHeadshot(headshot)).length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewTick((current) => current + 1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [displayName, statusLine, unionStatus, ageRange, market, accent, fontPair, publicSlug, renderedHeadshots]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      draft: "1",
      name: displayName,
      status: statusLine,
      union: unionStatus,
      age: ageRange,
      market,
      tick: String(previewTick)
    });

    if (accent) {
      params.set("accent", accent);
    }

    if (fontPair !== "template") {
      params.set("font", fontPair);
    }

    params.set("template", templateId);

    return `/p/${publicSlug}?${params.toString()}`;
  }, [accent, ageRange, displayName, fontPair, market, previewTick, publicSlug, statusLine, templateId, unionStatus]);

  const previewPage = useMemo<ActorPage>(
    () => ({
      ...page,
      displayName,
      slug: publicSlug,
      statusLine,
      unionStatus,
      ageRange,
      market,
      template: templateId,
      accent,
      fontPair,
      sections: page.sections.map((section) =>
        section.type === "headshots"
          ? {
              ...section,
              content: {
                headshots: renderedHeadshots
              }
            }
          : section
      )
    }),
    [accent, ageRange, displayName, fontPair, market, publicSlug, renderedHeadshots, statusLine, templateId, unionStatus]
  );

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus(null);

    if (!supabase) {
      setAuthStatus("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel first.");
      return;
    }

    if (!authEmail.trim()) {
      setAuthStatus("Enter an email address.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`
      }
    });

    setAuthStatus(error ? error.message : "Check your email for the sign-in link.");
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAuthStatus("Signed out.");
  }

  async function handleHeadshotUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setUploadStatus(null);

    if (files.length === 0) {
      return;
    }

    if (!supabase) {
      setUploadStatus("Supabase env vars are missing.");
      return;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setUploadStatus("Sign in before uploading.");
      return;
    }

    const existingHeadshots = renderedHeadshots.filter((headshot) => !isPlaceholderHeadshot(headshot));
    const capacity = page.plan === "free" ? Math.max(0, 6 - existingHeadshots.length) : files.length;
    const selectedFiles = files.slice(0, capacity);

    if (selectedFiles.length === 0) {
      setUploadStatus("Free pages can show up to 6 headshots.");
      return;
    }

    const invalidFile = selectedFiles.find((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024);
    if (invalidFile) {
      setUploadStatus("Use image files under 10MB.");
      return;
    }

    setUploading(true);

    try {
      const uploadedHeadshots: Headshot[] = [];

      for (const file of selectedFiles) {
        const objectPath = `${user.id}/${page.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from("pages101-media").upload(objectPath, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false
        });

        if (error) {
          throw error;
        }

        const { data: publicUrl } = supabase.storage.from("pages101-media").getPublicUrl(objectPath);
        uploadedHeadshots.push({
          id: crypto.randomUUID(),
          src: publicUrl.publicUrl,
          alt: `${displayName} headshot`,
          label: getHeadshotLabel(file.name)
        });
      }

      setHeadshots(normalizeHeadshots([...existingHeadshots, ...uploadedHeadshots]));
      setUploadStatus(
        selectedFiles.length < files.length
          ? `Uploaded ${selectedFiles.length}. Free pages show 6 headshots.`
          : `Uploaded ${selectedFiles.length} headshot${selectedFiles.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveHeadshot(id: string) {
    const nextHeadshots = renderedHeadshots.filter((headshot) => headshot.id !== id && !isPlaceholderHeadshot(headshot));
    setHeadshots(normalizeHeadshots(nextHeadshots.length > 0 ? nextHeadshots : initialHeadshots));
  }

  return (
    <main className="dashboard-shell">
      <EditorToolbar displayName={displayName} previewUrl={previewUrl} onPreview={() => setPreviewOpen(true)} />

      <section className="editor-workspace" aria-label="Pages101 editor workspace">
        <div className="editor-column">
          <article className="editor-panel">
            <div className="panel-heading">
              <p>Page Setup</p>
              <StatusPill ok={checkedSlug.ok} label={checkedSlug.ok ? "URL approved" : checkedSlug.reason} />
            </div>
            <TipDisclosure tipKey="slate" />
            <label>
              Performer name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Safe URL
              <input value={slug} onChange={(event) => setSlug(normalizeSlug(event.target.value))} />
            </label>
            <label>
              Status line
              <input value={statusLine} onChange={(event) => setStatusLine(event.target.value)} />
            </label>
            <div className="three-fields">
              <label>
                Union
                <input value={unionStatus} onChange={(event) => setUnionStatus(event.target.value)} />
              </label>
              <label>
                Age range
                <input value={ageRange} onChange={(event) => setAgeRange(event.target.value)} />
              </label>
              <label>
                Market
                <input value={market} onChange={(event) => setMarket(event.target.value)} />
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="panel-heading">
              <p>Template &amp; Style</p>
              <span>Plus templates preview here</span>
            </div>
            <div className="template-options" aria-label="Template">
              {Object.values(templateTokens).map((template) => {
                const locked = page.plan === "free" && template.tier === "plus";
                const selected = template.id === templateId;

                return (
                  <button
                    key={template.id}
                    className="template-card"
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    data-locked={locked ? "true" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setTemplateId(template.id);
                    }}
                  >
                    <span className={`template-thumb template-thumb--${template.id}`} aria-hidden="true">
                      <span />
                    </span>
                    <strong>{template.label}</strong>
                    <small>{locked ? "Preview · Plus" : template.tier === "plus" ? "Plus" : "Free"}</small>
                    {selected ? <span className="check-badge" aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="swatches" aria-label="Accent color">
              {accentSwatches.map((swatch) => (
                <button
                  key={swatch.label}
                  type="button"
                  aria-label={swatch.label}
                  title={swatch.label}
                  aria-pressed={swatch.value === accent || (!swatch.value && !accent)}
                  className={swatch.value ? undefined : "swatch-auto"}
                  style={{ "--swatch": swatch.value ?? "#c9282d" } as React.CSSProperties}
                  onClick={() => setAccent(swatch.value)}
                />
              ))}
            </div>
            <label>
              Font pairing
              <select value={fontPair} onChange={(event) => setFontPair(event.target.value as FontPair)}>
                {fontPairOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </article>

          <article className="editor-panel">
            <div className="panel-heading">
              <p>Headshots</p>
              <span>{realHeadshotCount}/6 free</span>
            </div>
            <TipDisclosure tipKey="headshots" />
            <AuthControls
              email={authEmail}
              user={authUser}
              status={authStatus}
              onEmailChange={setAuthEmail}
              onSubmit={handleAuthSubmit}
              onSignOut={handleSignOut}
            />
            <label className="upload-dropzone">
              Upload photos
              <input type="file" accept="image/*" multiple disabled={uploading || !authUser} onChange={handleHeadshotUpload} />
              <span>{uploading ? "Uploading..." : authUser ? "Choose image files" : "Sign in to enable uploads"}</span>
            </label>
            {uploadStatus ? <p className="panel-note">{uploadStatus}</p> : null}
            <div className="uploaded-headshots" aria-label="Uploaded headshots">
              {renderedHeadshots
                .filter((headshot) => !isPlaceholderHeadshot(headshot))
                .map((headshot) => (
                  <div key={headshot.id} className="uploaded-headshot">
                    <span
                      className="uploaded-headshot-thumb"
                      role="img"
                      aria-label={headshot.alt}
                      style={{ backgroundImage: `url("${headshot.src}")` }}
                    />
                    <div>
                      <strong>{headshot.label}</strong>
                      {headshot.featured ? <span>Featured</span> : null}
                    </div>
                    <button type="button" onClick={() => handleRemoveHeadshot(headshot.id)}>
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          </article>

          <article className="editor-panel section-sorter">
            <div className="panel-heading">
              <p>Sections</p>
              <span>Reorder and publish</span>
            </div>
            {page.sections
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((section) => (
                <div key={section.id} className="section-card">
                  <div className={section.enabled ? "section-row" : "section-row section-row--disabled"}>
                    <button type="button" className="drag-handle" aria-label={`Drag ${section.type}`}>
                      ⠿
                    </button>
                    <span>{section.type}</span>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked={section.enabled} />
                      <span>Enabled</span>
                    </label>
                  </div>
                  {sectionTipMap[section.type] ? <TipDisclosure tipKey={sectionTipMap[section.type]} /> : null}
                </div>
            ))}
          </article>
        </div>

        <PreviewPane page={previewPage} pageUrl={`${publicSlug}.pages.childactor101.com`} />
      </section>

      <button type="button" className="floating-preview" onClick={() => setPreviewOpen(true)}>
        Preview
      </button>

      {previewOpen ? (
        <div className="preview-overlay" role="dialog" aria-label="Page preview" aria-modal="true">
          <div className="preview-overlay-bar">
            <span>{publicSlug}.pages.childactor101.com</span>
            <button type="button" onClick={() => setPreviewOpen(false)}>
              Close
            </button>
          </div>
          <div className="preview-overlay-surface">
            <ActorPageRenderer page={previewPage} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function AuthControls({
  email,
  user,
  status,
  onEmailChange,
  onSubmit,
  onSignOut
}: {
  email: string;
  user: User | null;
  status: string | null;
  onEmailChange: (email: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
}) {
  if (user) {
    return (
      <div className="auth-strip">
        <span>{user.email}</span>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Account email
        <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} />
      </label>
      <button className="button-secondary" type="submit">
        Send link
      </button>
      {status ? <p className="panel-note">{status}</p> : null}
    </form>
  );
}

function EditorToolbar({
  displayName,
  previewUrl,
  onPreview
}: {
  displayName: string;
  previewUrl: string;
  onPreview: () => void;
}) {
  return (
    <header className="editor-toolbar">
      <div className="editor-brand">
        <span>Pages101</span>
        <strong>·</strong>
        <p>{displayName}</p>
      </div>
      <div className="editor-actions">
        <span className="save-state">Saved</span>
        <button className="button-secondary" type="button" onClick={onPreview} data-preview-url={previewUrl}>
          Preview
        </button>
        <button className="button-primary" type="button">
          Publish
        </button>
      </div>
    </header>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "status-pill status-pill--ok" : "status-pill status-pill--error"}>{label}</span>;
}

function TipDisclosure({ tipKey }: { tipKey?: TipKey }) {
  if (!tipKey) {
    return null;
  }

  const tip = tips[tipKey];

  return (
    <details className="tip-disclosure">
      <summary>💡 101 Tip</summary>
      <p>{tip.body}</p>
    </details>
  );
}

function PreviewPane({ page, pageUrl }: { page: ActorPage; pageUrl: string }) {
  return (
    <aside className="preview-pane" aria-label="Live page preview">
      <div className="browser-frame">
        <div className="browser-bar">
          <span>{pageUrl}</span>
        </div>
        <div className="live-preview-surface">
          <ActorPageRenderer page={page} />
        </div>
      </div>
    </aside>
  );
}

function getPageHeadshots(actorPage: ActorPage) {
  const section = actorPage.sections.find((candidate) => candidate.type === "headshots");
  return section?.type === "headshots" ? section.content.headshots : [];
}

function isPlaceholderHeadshot(headshot: Headshot) {
  return headshot.src === "/pageslogo.png";
}

function normalizeHeadshots(headshotsToNormalize: Headshot[]) {
  let featuredAssigned = false;

  return headshotsToNormalize.map((headshot, index) => {
    const featured = !featuredAssigned && (headshot.featured || index === 0);
    if (featured) {
      featuredAssigned = true;
    }

    return {
      ...headshot,
      featured
    };
  });
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "headshot.jpg";
}

function getHeadshotLabel(fileName: string) {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const words = nameWithoutExtension
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Headshot";
  }

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
