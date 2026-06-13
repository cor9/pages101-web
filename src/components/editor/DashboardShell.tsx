"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ActorPageRenderer } from "@/components/public-page/ActorPageRenderer";
import { accentSwatches, fontPairOptions, templateTokens } from "@/lib/templates";
import { samplePages } from "@/lib/sample-data";
import { tips, type TipKey } from "@/content/tips";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { mapActorPageRows, type ActorPageRow, type PageSectionRow } from "@/lib/page-mapping";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ActorPage,
  ActorPageSection,
  Clip,
  FontPair,
  Headshot,
  PageLink,
  Plan,
  Rep,
  SectionType,
  TemplateId
} from "@/lib/types";

const page = samplePages[0];
const initialHeadshots = getPageHeadshots(page);
const betaFullAccess = process.env.NEXT_PUBLIC_PAGES101_BETA_FULL_ACCESS !== "0";

const sectionTipMap: Partial<Record<SectionType, TipKey>> = {
  headshots: "headshots",
  resume: "resume",
  clips: "clips",
  feed: "updates",
  press: "press"
};

const clipCategories: Clip["category"][] = ["Booked Work", "Demo Reel", "About Me", "VO Reel", "Singing"];

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
  const [hasRep, setHasRep] = useState(page.hasRep);
  const [reps, setReps] = useState<Rep[]>(page.reps);
  const [links, setLinks] = useState<PageLink[]>(page.links);
  const [slateUrl, setSlateUrl] = useState(page.slateUrl ?? "");
  const [headshots, setHeadshots] = useState<Headshot[]>(initialHeadshots);
  const [sections, setSections] = useState<ActorPageSection[]>(page.sections);
  const [previewTick, setPreviewTick] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Beta preview");
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const checkedSlug = validateSlug(slug);
  const publicSlug = checkedSlug.ok ? checkedSlug.slug : page.slug;
  const editorPlan: Plan = betaFullAccess ? "plus" : page.plan;
  const renderedHeadshots = headshots.length > 0 ? headshots : initialHeadshots;
  const realHeadshotCount = renderedHeadshots.filter((headshot) => !isPlaceholderHeadshot(headshot)).length;
  const clips = getSectionClips(sections);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewTick((current) => current + 1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    displayName,
    statusLine,
    unionStatus,
    ageRange,
    market,
    accent,
    fontPair,
    publicSlug,
    renderedHeadshots,
    hasRep,
    reps,
    links,
    slateUrl,
    sections
  ]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPage() {
      if (!supabase || !authUser) {
        return;
      }

      setSaveStatus("Loading saved page...");

      const { data: pageRow, error: pageError } = await supabase
        .schema("pages101")
        .from("actor_pages")
        .select("*")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<ActorPageRow>();

      if (cancelled) {
        return;
      }

      if (pageError) {
        setSaveStatus(pageError.message);
        return;
      }

      if (!pageRow) {
        setSaveStatus("Beta preview");
        return;
      }

      const { data: sectionRows, error: sectionError } = await supabase
        .schema("pages101")
        .from("page_sections")
        .select("*")
        .eq("page_id", pageRow.id)
        .order("sort_order", { ascending: true })
        .returns<PageSectionRow[]>();

      if (cancelled) {
        return;
      }

      if (sectionError) {
        setSaveStatus(sectionError.message);
        return;
      }

      applyActorPage(mapActorPageRows(pageRow, sectionRows ?? [], editorPlan));
      setSaveStatus(pageRow.published ? `Published /p/${pageRow.slug}` : "Saved draft loaded");
    }

    loadSavedPage();

    return () => {
      cancelled = true;
    };
  }, [authUser, editorPlan, supabase]);

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
      plan: editorPlan,
      statusLine,
      unionStatus,
      ageRange,
      market,
      hasRep,
      reps: normalizeReps(reps),
      links: normalizeLinks(links),
      slateUrl: slateUrl.trim() ? normalizeEmbedUrl(slateUrl.trim()) : null,
      template: templateId,
      accent,
      fontPair,
      sections: sections.map((section) => {
        if (section.type === "headshots") {
          return {
            ...section,
            content: {
              headshots: renderedHeadshots
            }
          };
        }

        if (section.type === "clips") {
          return {
            ...section,
            content: {
              clips: normalizeClips(section.content.clips)
            }
          };
        }

        return section;
      })
    }),
    [
      accent,
      ageRange,
      displayName,
      editorPlan,
      fontPair,
      hasRep,
      links,
      market,
      publicSlug,
      renderedHeadshots,
      reps,
      sections,
      slateUrl,
      statusLine,
      templateId,
      unionStatus
    ]
  );

  function applyActorPage(actorPage: ActorPage) {
    const loadedSections = actorPage.sections.length > 0 ? actorPage.sections : page.sections;
    const loadedHeadshots = getPageHeadshots({ ...actorPage, sections: loadedSections });

    setDisplayName(actorPage.displayName);
    setSlug(actorPage.slug);
    setStatusLine(actorPage.statusLine);
    setUnionStatus(actorPage.unionStatus);
    setAgeRange(actorPage.ageRange);
    setMarket(actorPage.market);
    setHasRep(actorPage.hasRep);
    setReps(actorPage.reps);
    setLinks(actorPage.links);
    setSlateUrl(actorPage.slateUrl ?? "");
    setTemplateId(actorPage.template);
    setAccent(actorPage.accent);
    setFontPair(actorPage.fontPair ?? "template");
    setSections(loadedSections);
    setHeadshots(normalizeHeadshots(loadedHeadshots.length > 0 ? loadedHeadshots : initialHeadshots));
  }

  function updateRep(index: number, patch: Partial<Rep>) {
    setReps((currentReps) => currentReps.map((rep, repIndex) => (repIndex === index ? { ...rep, ...patch } : rep)));
  }

  function addRep() {
    setReps((currentReps) => [...currentReps, { name: "", role: "agent", email: "" }]);
    setHasRep(true);
  }

  function removeRep(index: number) {
    setReps((currentReps) => currentReps.filter((_rep, repIndex) => repIndex !== index));
  }

  function updateLink(index: number, patch: Partial<PageLink>) {
    setLinks((currentLinks) => currentLinks.map((link, linkIndex) => (linkIndex === index ? { ...link, ...patch } : link)));
  }

  function addLink() {
    setLinks((currentLinks) => [...currentLinks, { label: "", url: "" }]);
  }

  function removeLink(index: number) {
    setLinks((currentLinks) => currentLinks.filter((_link, linkIndex) => linkIndex !== index));
  }

  function updateClip(index: number, patch: Partial<Clip>) {
    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.type !== "clips") {
          return section;
        }

        return {
          ...section,
          content: {
            clips: section.content.clips.map((clip, clipIndex) => (clipIndex === index ? { ...clip, ...patch } : clip))
          }
        };
      })
    );
  }

  function addClip() {
    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.type !== "clips") {
          return section;
        }

        return {
          ...section,
          enabled: true,
          content: {
            clips: [
              ...section.content.clips,
              {
                id: crypto.randomUUID(),
                title: "",
                category: "Demo Reel",
                embedUrl: ""
              }
            ]
          }
        };
      })
    );
  }

  function removeClip(index: number) {
    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.type !== "clips") {
          return section;
        }

        return {
          ...section,
          content: {
            clips: section.content.clips.filter((_clip, clipIndex) => clipIndex !== index)
          }
        };
      })
    );
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus(null);

    if (!supabase) {
      setAuthStatus("Set the Supabase URL and anon key to enable sign-in.");
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

    const existingHeadshots = renderedHeadshots.filter((headshot) => !isPlaceholderHeadshot(headshot));
    const capacity = editorPlan === "free" ? Math.max(0, 6 - existingHeadshots.length) : files.length;
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
        uploadedHeadshots.push(await uploadHeadshot(file));
      }

      setHeadshots(normalizeHeadshots([...existingHeadshots, ...uploadedHeadshots]));
      setUploadStatus(
        selectedFiles.length < files.length
          ? `Uploaded ${selectedFiles.length}. Free pages show 6 headshots.`
          : authUser
            ? `Uploaded ${selectedFiles.length} headshot${selectedFiles.length === 1 ? "" : "s"}.`
            : `Added ${selectedFiles.length} preview headshot${selectedFiles.length === 1 ? "" : "s"}.`
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

  async function uploadHeadshot(file: File): Promise<Headshot> {
    if (!supabase || !authUser) {
      return {
        id: crypto.randomUUID(),
        src: URL.createObjectURL(file),
        alt: `${displayName} headshot`,
        label: getHeadshotLabel(file.name)
      };
    }

    const objectPath = `${authUser.id}/${page.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("pages101-media").upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("pages101-media").getPublicUrl(objectPath);

    return {
      id: crypto.randomUUID(),
      src: data.publicUrl,
      alt: `${displayName} headshot`,
      label: getHeadshotLabel(file.name)
    };
  }

  async function handlePublish() {
    setSaveStatus("Publishing...");

    if (!supabase) {
      setSaveStatus("Supabase env vars are missing.");
      return;
    }

    if (!authUser) {
      setSaveStatus("Sign in to publish.");
      return;
    }

    if (!checkedSlug.ok) {
      setSaveStatus(checkedSlug.reason);
      return;
    }

    const previewOnlyHeadshots = renderedHeadshots.some((headshot) => headshot.src.startsWith("blob:"));
    if (previewOnlyHeadshots) {
      setSaveStatus("Sign in, then re-upload preview photos before publishing.");
      return;
    }

    setSaving(true);

    try {
      const savedPageId = await saveActorPage(previewPage);
      await saveSections(savedPageId, previewPage.sections);
      setSaveStatus(`Published /p/${publicSlug}`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveActorPage(actorPage: ActorPage) {
    if (!supabase || !authUser) {
      throw new Error("Sign in to publish.");
    }

    const pages = supabase.schema("pages101").from("actor_pages");
    const payload = {
      user_id: authUser.id,
      slug: actorPage.slug,
      template: actorPage.template,
      accent: actorPage.accent,
      font_pair: actorPage.fontPair,
      display_name: actorPage.displayName,
      status_line: actorPage.statusLine,
      union_status: actorPage.unionStatus,
      age_range: actorPage.ageRange,
      market: actorPage.market,
      has_rep: actorPage.hasRep,
      reps: actorPage.reps,
      links: actorPage.links,
      slate_url: actorPage.slateUrl,
      published: true,
      noindex: actorPage.noindex,
      updated_at: new Date().toISOString()
    };

    const { data: existing, error: existingError } = await pages
      .select("id")
      .eq("user_id", authUser.id)
      .eq("slug", actorPage.slug)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { data, error } = await pages.update(payload).eq("id", existing.id).select("id").single<{ id: string }>();
      if (error) {
        throw error;
      }
      return data.id;
    }

    const { data, error } = await pages.insert(payload).select("id").single<{ id: string }>();
    if (error) {
      throw error;
    }

    return data.id;
  }

  async function saveSections(pageId: string, sections: ActorPage["sections"]) {
    if (!supabase) {
      throw new Error("Supabase env vars are missing.");
    }

    const rows = sections.map((section) => ({
      page_id: pageId,
      type: section.type,
      enabled: section.enabled,
      sort_order: section.sortOrder,
      content: section.content
    }));

    const { error } = await supabase
      .schema("pages101")
      .from("page_sections")
      .upsert(rows, { onConflict: "page_id,type" });

    if (error) {
      throw error;
    }
  }

  return (
    <main className="dashboard-shell">
      <EditorToolbar
        displayName={displayName}
        previewUrl={previewUrl}
        saveStatus={saveStatus}
        saving={saving}
        onPreview={() => setPreviewOpen(true)}
        onPublish={handlePublish}
      />

      <section className="editor-workspace" aria-label="Pages101 editor workspace">
        <div className="editor-column">
          <article className="editor-panel" data-testid="page-setup-panel">
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

          <article className="editor-panel" data-testid="representation-panel">
            <div className="panel-heading">
              <p>Representation &amp; Contact</p>
              <span>{hasRep ? `${normalizeReps(reps).length} rep${normalizeReps(reps).length === 1 ? "" : "s"}` : "Parent relay"}</span>
            </div>
            <label className="checkbox-line">
              <input type="checkbox" checked={hasRep} onChange={(event) => setHasRep(event.target.checked)} />
              <span>Represented by agent or manager</span>
            </label>
            {hasRep ? (
              <div className="editor-rows" aria-label="Representatives">
                {reps.map((rep, index) => (
                  <div className="editor-row" key={`rep-${index}`}>
                    <div className="field-grid field-grid--rep">
                      <label>
                        Name
                        <input value={rep.name} onChange={(event) => updateRep(index, { name: event.target.value })} />
                      </label>
                      <label>
                        Role
                        <select value={rep.role} onChange={(event) => updateRep(index, { role: event.target.value as Rep["role"] })}>
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                        </select>
                      </label>
                      <label>
                        Email
                        <input type="email" value={rep.email} onChange={(event) => updateRep(index, { email: event.target.value })} />
                      </label>
                    </div>
                    <button className="row-remove" type="button" onClick={() => removeRep(index)}>
                      Remove
                    </button>
                  </div>
                ))}
                <button className="button-secondary panel-action" type="button" onClick={addRep}>
                  Add rep
                </button>
              </div>
            ) : (
              <p className="panel-note">
                The live page shows a parent contact button that routes through the private relay. Parent email and phone stay off the page.
              </p>
            )}
          </article>

          <article className="editor-panel" data-testid="links-panel">
            <div className="panel-heading">
              <p>Casting Links</p>
              <span>{normalizeLinks(links).length} visible</span>
            </div>
            <div className="editor-rows" aria-label="Casting links">
              {links.map((link, index) => (
                <div className="editor-row" key={`link-${index}`}>
                  <div className="field-grid field-grid--link">
                    <label>
                      Button label
                      <input value={link.label} placeholder="Actors Access" onChange={(event) => updateLink(index, { label: event.target.value })} />
                    </label>
                    <label>
                      URL
                      <input value={link.url} placeholder="https://..." onChange={(event) => updateLink(index, { url: event.target.value })} />
                    </label>
                  </div>
                  <button className="row-remove" type="button" onClick={() => removeLink(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button className="button-secondary panel-action" type="button" onClick={addLink}>
                Add link
              </button>
            </div>
          </article>

          <article className="editor-panel" data-testid="template-panel">
            <div className="panel-heading">
              <p>Template &amp; Style</p>
              <span>{betaFullAccess ? "Beta full access" : "Plus templates preview here"}</span>
            </div>
            <div className="template-options" aria-label="Template">
              {Object.values(templateTokens).map((template) => {
                const locked = editorPlan === "free" && template.tier === "plus";
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
                    <small>{locked ? "Preview · Plus" : template.tier === "plus" && betaFullAccess ? "Beta" : template.tier === "plus" ? "Plus" : "Free"}</small>
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

          <article className="editor-panel" data-testid="account-panel">
            <div className="panel-heading">
              <p>Account</p>
              <span>{betaFullAccess ? "Full beta enabled" : "Auth ready"}</span>
            </div>
            <AuthControls
              email={authEmail}
              user={authUser}
              status={authStatus}
              onEmailChange={setAuthEmail}
              onSubmit={handleAuthSubmit}
              onSignOut={handleSignOut}
            />
          </article>

          <article className="editor-panel" data-testid="clips-panel">
            <div className="panel-heading">
              <p>Slate, Clips &amp; Reels</p>
              <span>{normalizeClips(clips).length} visible</span>
            </div>
            <TipDisclosure tipKey="clips" />
            <label>
              Slate video URL
              <input value={slateUrl} placeholder="YouTube or Vimeo URL" onChange={(event) => setSlateUrl(event.target.value)} />
            </label>
            <div className="editor-rows" aria-label="Clip and reel links">
              {clips.map((clip, index) => (
                <div className="editor-row" key={clip.id}>
                  <div className="field-grid field-grid--clip">
                    <label>
                      Title
                      <input value={clip.title} placeholder="Demo Reel" onChange={(event) => updateClip(index, { title: event.target.value })} />
                    </label>
                    <label>
                      Category
                      <select value={clip.category} onChange={(event) => updateClip(index, { category: event.target.value as Clip["category"] })}>
                        {clipCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      YouTube/Vimeo URL
                      <input value={clip.embedUrl} placeholder="https://..." onChange={(event) => updateClip(index, { embedUrl: event.target.value })} />
                    </label>
                  </div>
                  <button className="row-remove" type="button" onClick={() => removeClip(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button className="button-secondary panel-action" type="button" onClick={addClip}>
                Add clip
              </button>
            </div>
          </article>

          <article className="editor-panel" data-testid="headshots-panel">
            <div className="panel-heading">
              <p>Headshots</p>
              <span>{editorPlan === "plus" ? `${realHeadshotCount} uploaded` : `${realHeadshotCount}/6 free`}</span>
            </div>
            <TipDisclosure tipKey="headshots" />
            <label className="upload-dropzone">
              Upload photos
              <input type="file" accept="image/*" multiple disabled={uploading} onChange={handleHeadshotUpload} />
              <span>{uploading ? "Adding..." : "Choose image files"}</span>
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

          <article className="editor-panel section-sorter" data-testid="sections-panel">
            <div className="panel-heading">
              <p>Sections</p>
              <span>Reorder and publish</span>
            </div>
            {sections
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
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setSections((currentSections) =>
                            currentSections.map((candidate) =>
                              candidate.id === section.id ? { ...candidate, enabled } : candidate
                            )
                          );
                        }}
                      />
                      <span>Enabled</span>
                    </label>
                  </div>
                  {sectionTipMap[section.type] ? <TipDisclosure tipKey={sectionTipMap[section.type]} /> : null}
                </div>
            ))}
          </article>
        </div>

        <PreviewPane page={previewPage} pageUrl={`pages.childactor101.com/p/${publicSlug}`} />
      </section>

      <button type="button" className="floating-preview" onClick={() => setPreviewOpen(true)}>
        Preview
      </button>

      {previewOpen ? (
        <div className="preview-overlay" role="dialog" aria-label="Page preview" aria-modal="true">
          <div className="preview-overlay-bar">
            <span>{`pages.childactor101.com/p/${publicSlug}`}</span>
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

function EditorToolbar({
  displayName,
  previewUrl,
  saveStatus,
  saving,
  onPreview,
  onPublish
}: {
  displayName: string;
  previewUrl: string;
  saveStatus: string;
  saving: boolean;
  onPreview: () => void;
  onPublish: () => void;
}) {
  return (
    <header className="editor-toolbar">
      <div className="editor-brand">
        <span>Pages101</span>
        <strong>·</strong>
        <p>{displayName}</p>
      </div>
      <div className="editor-actions">
        <span className="save-state">{saveStatus}</span>
        <button className="button-secondary" type="button" onClick={onPreview} data-preview-url={previewUrl}>
          Preview
        </button>
        <button className="button-primary" type="button" disabled={saving} onClick={onPublish}>
          {saving ? "Publishing..." : "Publish"}
        </button>
      </div>
    </header>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "status-pill status-pill--ok" : "status-pill status-pill--error"}>{label}</span>;
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

function getSectionClips(sections: ActorPageSection[]) {
  const section = sections.find((candidate) => candidate.type === "clips");
  return section?.type === "clips" ? section.content.clips : [];
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

function normalizeReps(repsToNormalize: Rep[]) {
  return repsToNormalize
    .map((rep) => ({
      name: rep.name.trim(),
      role: rep.role,
      email: rep.email.trim()
    }))
    .filter((rep) => rep.name && rep.email);
}

function normalizeLinks(linksToNormalize: PageLink[]) {
  return linksToNormalize
    .map((link) => ({
      label: link.label.trim(),
      url: normalizeExternalUrl(link.url)
    }))
    .filter((link) => link.label && link.url);
}

function normalizeClips(clipsToNormalize: Clip[]) {
  return clipsToNormalize
    .map((clip) => ({
      ...clip,
      title: clip.title.trim(),
      embedUrl: normalizeEmbedUrl(clip.embedUrl.trim())
    }))
    .filter((clip) => clip.title && clip.embedUrl);
}

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizeEmbedUrl(url: string) {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : normalized;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        return normalized;
      }

      const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://www.youtube.com/embed/${id}` : normalized;
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${id}` : normalized;
    }

    if (host === "player.vimeo.com") {
      return normalized;
    }
  } catch {
    return normalized;
  }

  return normalized;
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
