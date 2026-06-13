"use client";

import { useEffect, useMemo, useState } from "react";
import { accentSwatches, fontPairOptions, templateTokens } from "@/lib/templates";
import { samplePages } from "@/lib/sample-data";
import { tips, type TipKey } from "@/content/tips";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import type { FontPair, SectionType, TemplateId } from "@/lib/types";

const page = samplePages[0];

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
  const [previewTick, setPreviewTick] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  const checkedSlug = validateSlug(slug);
  const publicSlug = checkedSlug.ok ? checkedSlug.slug : page.slug;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewTick((current) => current + 1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [displayName, statusLine, unionStatus, ageRange, market, accent, fontPair, publicSlug]);

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
              <span>Classic publishes free</span>
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
                    onClick={(event) => {
                      event.preventDefault();
                      if (locked) {
                        window.location.href = "/upgrade";
                        return;
                      }
                      setTemplateId(template.id);
                    }}
                  >
                    <span className={`template-thumb template-thumb--${template.id}`} aria-hidden="true">
                      <span />
                    </span>
                    <strong>{template.label}</strong>
                    <small>{locked ? "Lock · Plus" : template.tier === "plus" ? "Plus" : "Free"}</small>
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

        <PreviewPane previewUrl={previewUrl} pageUrl={`${publicSlug}.pages.childactor101.com`} />
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
          <iframe title="Pages101 mobile preview" src={previewUrl} />
        </div>
      ) : null}
    </main>
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

function PreviewPane({ previewUrl, pageUrl }: { previewUrl: string; pageUrl: string }) {
  return (
    <aside className="preview-pane" aria-label="Live page preview">
      <div className="browser-frame">
        <div className="browser-bar">
          <span>{pageUrl}</span>
        </div>
        <iframe title="Live Pages101 preview" src={previewUrl} />
      </div>
    </aside>
  );
}
