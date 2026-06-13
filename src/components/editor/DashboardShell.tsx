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
  FeedItem,
  FontPair,
  Headshot,
  PageLink,
  Plan,
  PressQuote,
  Rep,
  ResumeCredit,
  ResumeSection,
  SectionType,
  TemplateId
} from "@/lib/types";

const page = samplePages[0];
const initialHeadshots = getPageHeadshots(page);

const sectionTipMap: Partial<Record<SectionType, TipKey>> = {
  headshots: "headshots",
  resume: "resume",
  clips: "clips",
  feed: "updates",
  press: "press"
};

const clipCategories: Clip["category"][] = ["Booked Work", "Demo Reel", "About Me", "VO Reel", "Singing"];

// ─── Plan subscription state ──────────────────────────────────────────────────

type SubscriptionRow = {
  plan: Plan;
  status: string;
  current_period_end: string | null;
};

function isActivePlus(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  return sub.plan === "plus" && (sub.status === "active" || sub.status === "trialing");
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SUPABASE KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('SUPABASE CLIENT:', supabase);

    if (supabase) {
      supabase.from('p101_actor_pages').select('*', { count: 'exact', head: true }).limit(1).then(result => {
        console.log('TEST QUERY:', result);
      }).catch(e => {
        console.log('TEST QUERY THREW:', e);
      });
    }
  }, [supabase]);

  const checkedSlug = validateSlug(slug);
  const publicSlug = checkedSlug.ok ? checkedSlug.slug : page.slug;

  // Plan: use real subscription when signed in
  const editorPlan: Plan = useMemo(() => {
    if (authUser && subscription) return isActivePlus(subscription) ? "plus" : "free";
    // Beta fallback: NEXT_PUBLIC_PAGES101_BETA_FULL_ACCESS=1 → plus in dev
    if (process.env.NEXT_PUBLIC_PAGES101_BETA_FULL_ACCESS !== "0") return "plus";
    return page.plan;
  }, [authUser, subscription]);

  const renderedHeadshots = headshots.length > 0 ? headshots : initialHeadshots;
  const realHeadshotCount = renderedHeadshots.filter((headshot) => !isPlaceholderHeadshot(headshot)).length;
  const clips = getSectionClips(sections);
  const feedItems = getSectionFeedItems(sections);

  // ─── Preview tick (debounced) ──────────────────────────────────────────────

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

  // ─── Auth listener ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
    });

    const {
      data: { subscription: authSubscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => authSubscription.unsubscribe();
  }, [supabase]);

  // ─── Load saved page ───────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPage() {
      if (!supabase || !authUser) return;

      setSaveStatus("Loading saved page...");

      setSaveStatus("Loading saved page...");

      // Load subscription plan
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", authUser.id)
        .maybeSingle<SubscriptionRow>();

      if (!cancelled) setSubscription(subRow ?? null);

      const { data: pageRow, error: pageError } = await supabase
        .from("p101_actor_pages")
        .select("*")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<ActorPageRow>();

      if (cancelled) return;
      if (pageError) { setSaveStatus(pageError.message); return; }
      if (!pageRow) { setSaveStatus("Beta preview"); return; }

      const { data: sectionRows, error: sectionError } = await supabase
        .from("p101_page_sections")
        .select("*")
        .eq("page_id", pageRow.id)
        .order("sort_order", { ascending: true })
        .returns<PageSectionRow[]>();

      if (cancelled) return;
      if (sectionError) { setSaveStatus(sectionError.message); return; }

      applyActorPage(mapActorPageRows(pageRow, sectionRows ?? [], isActivePlus(subRow ?? null) ? "plus" : "free"));
      setSaveStatus(pageRow.published ? `Published /p/${pageRow.slug}` : "Saved draft loaded");
    }

    loadSavedPage();
    return () => { cancelled = true; };
  }, [authUser, supabase]);

  // ─── Preview URL & page object ─────────────────────────────────────────────

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

    if (accent) params.set("accent", accent);
    if (fontPair !== "template") params.set("font", fontPair);
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
          return { ...section, content: { headshots: renderedHeadshots } };
        }
        if (section.type === "clips") {
          return { ...section, content: { clips: normalizeClips(section.content.clips) } };
        }
        return section;
      })
    }),
    [
      accent, ageRange, displayName, editorPlan, fontPair, hasRep,
      links, market, publicSlug, renderedHeadshots, reps, sections,
      slateUrl, statusLine, templateId, unionStatus
    ]
  );

  // ─── Apply loaded page ─────────────────────────────────────────────────────

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

  // ─── Reps / Links ──────────────────────────────────────────────────────────

  function updateRep(index: number, patch: Partial<Rep>) {
    setReps((r) => r.map((rep, i) => (i === index ? { ...rep, ...patch } : rep)));
  }
  function addRep() {
    setReps((r) => [...r, { name: "", role: "agent", email: "" }]);
    setHasRep(true);
  }
  function removeRep(index: number) {
    setReps((r) => r.filter((_, i) => i !== index));
  }

  function updateLink(index: number, patch: Partial<PageLink>) {
    setLinks((l) => l.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }
  function addLink() {
    setLinks((l) => [...l, { label: "", url: "" }]);
  }
  function removeLink(index: number) {
    setLinks((l) => l.filter((_, i) => i !== index));
  }

  // ─── Clips ─────────────────────────────────────────────────────────────────

  function updateClip(index: number, patch: Partial<Clip>) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "clips") return section;
        return {
          ...section,
          content: { clips: section.content.clips.map((clip, i) => (i === index ? { ...clip, ...patch } : clip)) }
        };
      })
    );
  }
  function addClip() {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "clips") return section;
        return {
          ...section,
          enabled: true,
          content: {
            clips: [...section.content.clips, { id: crypto.randomUUID(), title: "", category: "Demo Reel", embedUrl: "" }]
          }
        };
      })
    );
  }
  function removeClip(index: number) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "clips") return section;
        return { ...section, content: { clips: section.content.clips.filter((_, i) => i !== index) } };
      })
    );
  }

  // ─── Resume credits ────────────────────────────────────────────────────────

  function updateResume(patch: Partial<ResumeSection>) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "resume") return section;
        return { ...section, content: { ...section.content, ...patch } };
      })
    );
  }
  function addCredit() {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "resume") return section;
        return { ...section, enabled: true, content: { ...section.content, credits: [...section.content.credits, { project: "", role: "", company: "" }] } };
      })
    );
  }
  function updateCredit(index: number, patch: Partial<ResumeCredit>) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "resume") return section;
        return { ...section, content: { ...section.content, credits: section.content.credits.map((c, i) => (i === index ? { ...c, ...patch } : c)) } };
      })
    );
  }
  function removeCredit(index: number) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "resume") return section;
        return { ...section, content: { ...section.content, credits: section.content.credits.filter((_, i) => i !== index) } };
      })
    );
  }

  // ─── BTS Feed ──────────────────────────────────────────────────────────────

  function addFeedItem() {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "feed") return section;
        const today = new Date().toISOString().slice(0, 10);
        return {
          ...section,
          enabled: true,
          content: {
            items: [
              ...section.content.items,
              { id: crypto.randomUUID(), date: today, title: "", body: "" }
            ]
          }
        };
      })
    );
  }
  function updateFeedItem(index: number, patch: Partial<FeedItem>) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "feed") return section;
        return { ...section, content: { items: section.content.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) } };
      })
    );
  }
  function removeFeedItem(index: number) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "feed") return section;
        return { ...section, content: { items: section.content.items.filter((_, i) => i !== index) } };
      })
    );
  }

  // ─── Press Quote ───────────────────────────────────────────────────────────

  function updatePress(patch: Partial<PressQuote>) {
    setSections((secs) =>
      secs.map((section) => {
        if (section.type !== "press") return section;
        return { ...section, content: { ...section.content, ...patch } };
      })
    );
  }

  // ─── Headshots ─────────────────────────────────────────────────────────────

  async function handleHeadshotUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setUploadStatus(null);

    if (files.length === 0) return;

    const existingHeadshots = renderedHeadshots.filter((h) => !isPlaceholderHeadshot(h));
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
    const next = renderedHeadshots.filter((h) => h.id !== id && !isPlaceholderHeadshot(h));
    setHeadshots(normalizeHeadshots(next.length > 0 ? next : initialHeadshots));
  }

  function handleSetFeatured(id: string) {
    const next = renderedHeadshots
      .filter((h) => !isPlaceholderHeadshot(h))
      .map((h) => ({ ...h, featured: h.id === id }));
    setHeadshots(normalizeHeadshots(next));
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

    if (error) throw error;

    const { data } = supabase.storage.from("pages101-media").getPublicUrl(objectPath);

    return {
      id: crypto.randomUUID(),
      src: data.publicUrl,
      alt: `${displayName} headshot`,
      label: getHeadshotLabel(file.name)
    };
  }

  async function uploadResumeDocument(file: File): Promise<{ url: string; name: string }> {
    if (!supabase || !authUser) {
      return { url: URL.createObjectURL(file), name: file.name };
    }

    const objectPath = `${authUser.id}/${page.id}/resume-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from("pages101-media").upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

    if (error) throw error;

    const { data } = supabase.storage.from("pages101-media").getPublicUrl(objectPath);

    return { url: data.publicUrl, name: file.name };
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setResumeUploadStatus(null);
    if (file.size > 10 * 1024 * 1024) {
      setResumeUploadStatus("Use document files under 10MB.");
      return;
    }

    setResumeUploading(true);
    try {
      const doc = await uploadResumeDocument(file);
      updateResume({ fileUrl: doc.url, fileName: doc.name });
      setResumeUploadStatus("Resume document uploaded.");
    } catch (error) {
      setResumeUploadStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setResumeUploading(false);
      event.target.value = "";
    }
  }

  function handleRemoveResumeDocument() {
    updateResume({ fileUrl: undefined, fileName: undefined });
    setResumeUploadStatus("Document removed.");
  }

  // ─── Resume101 import ──────────────────────────────────────────────────────

  async function handleResume101Import() {
    if (!supabase || !authUser) {
      setImportStatus("Sign in to import from Resume101.");
      return;
    }

    setImporting(true);
    setImportStatus(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const response = await fetch("/api/resume101/import", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Import failed");
      }

      const { credits, updatedAt } = (await response.json()) as { credits: ResumeCredit[]; updatedAt: string };
      updateResume({ credits, syncedWithResume101: true, updatedAt });
      setImportStatus(`Imported ${credits.length} credit${credits.length === 1 ? "" : "s"} from Resume101.`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  // ─── Stripe ────────────────────────────────────────────────────────────────

  async function handleUpgrade() {
    if (!supabase || !authUser) {
      setAuthStatus("Sign in first to upgrade.");
      return;
    }

    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const body = (await response.json()) as { url?: string; error?: string };
      if (body.url) {
        window.location.href = body.url;
      } else {
        setAuthStatus(body.error ?? "Upgrade failed.");
      }
    } catch {
      setAuthStatus("Upgrade failed. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageSubscription() {
    if (!supabase || !authUser) return;

    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const body = (await response.json()) as { url?: string; error?: string };
      if (body.url) {
        window.location.href = body.url;
      } else {
        setAuthStatus(body.error ?? "Could not open subscription portal.");
      }
    } catch {
      setAuthStatus("Could not open subscription portal.");
    } finally {
      setUpgrading(false);
    }
  }

  // ─── Publish ───────────────────────────────────────────────────────────────

  async function handlePublish() {
    setSaveStatus("Publishing...");

    if (!supabase) { setSaveStatus("Supabase env vars are missing."); return; }
    if (!authUser) { setSaveStatus("Sign in to publish."); return; }
    if (!checkedSlug.ok) { setSaveStatus(checkedSlug.reason); return; }

    const previewOnlyHeadshots = renderedHeadshots.some((h) => h.src.startsWith("blob:"));
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
    if (!supabase || !authUser) throw new Error("Sign in to publish.");

    const payload = {
      user_id: authUser.id,
      slug: actorPage.slug,
      template: actorPage.template,
      accent: actorPage.accent ?? null,
      font_pair: actorPage.fontPair ?? null,
      display_name: actorPage.displayName,
      status_line: actorPage.statusLine ?? null,
      union_status: actorPage.unionStatus ?? null,
      age_range: actorPage.ageRange ?? null,
      market: actorPage.market ?? null,
      has_rep: actorPage.hasRep ?? true,
      reps: actorPage.reps ?? [],
      links: actorPage.links ?? [],
      slate_url: actorPage.slateUrl ?? null,
      published: true,
      noindex: actorPage.noindex,
      updated_at: new Date().toISOString()
    };

    console.log("SAVE ATTEMPT - user:", authUser.id);
    console.log("SAVE ATTEMPT - payload:", payload);

    const { data, error } = await supabase
      .from("p101_actor_pages")
      .upsert(payload, { onConflict: "slug" })
      .select("id")
      .single<{ id: string }>();

    console.log("SAVE RESULT - data:", data);
    console.log("SAVE RESULT - error:", JSON.stringify(error));

    if (error) throw error;
    return data.id;
  }

  async function saveSections(pageId: string, pageSections: ActorPage["sections"]) {
    if (!supabase) throw new Error("Supabase env vars are missing.");

    const rows = pageSections.map((section) => ({
      page_id: pageId,
      type: section.type,
      enabled: section.enabled,
      sort_order: section.sortOrder,
      content: section.content
    }));

    const { error } = await supabase
      .from("p101_page_sections")
      .upsert(rows, { onConflict: "page_id,type" });

    if (error) throw error;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus(null);

    if (!supabase) { setAuthStatus("Set the Supabase URL and anon key to enable sign-in."); return; }
    if (!authEmail.trim()) { setAuthStatus("Enter an email address."); return; }

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` }
    });

    setAuthStatus(error ? error.message : "Check your email for the sign-in link.");
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthStatus("Signed out.");
    setSubscription(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const resumeSection = sections.find((s) => s.type === "resume");
  const resumeContent = resumeSection?.type === "resume" ? resumeSection.content : null;

  const pressSection = sections.find((s) => s.type === "press");
  const pressContent = pressSection?.type === "press" ? pressSection.content : null;

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

          {/* Page Setup */}
          <article className="editor-panel" data-testid="page-setup-panel">
            <div className="panel-heading">
              <p>Page Setup</p>
              <StatusPill ok={checkedSlug.ok} label={checkedSlug.ok ? "URL approved" : checkedSlug.reason} />
            </div>
            <TipDisclosure tipKey="slate" />
            <label>
              Performer name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label>
              Safe URL
              <input value={slug} onChange={(e) => setSlug(normalizeSlug(e.target.value))} />
            </label>
            <label>
              Status line
              <input value={statusLine} onChange={(e) => setStatusLine(e.target.value)} />
            </label>
            <div className="three-fields">
              <label>
                Union
                <input value={unionStatus} onChange={(e) => setUnionStatus(e.target.value)} />
              </label>
              <label>
                Age range
                <input value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
              </label>
              <label>
                Market
                <input value={market} onChange={(e) => setMarket(e.target.value)} />
              </label>
            </div>
          </article>

          {/* Representation & Contact */}
          <article className="editor-panel" data-testid="representation-panel">
            <div className="panel-heading">
              <p>Representation &amp; Contact</p>
              <span>{hasRep ? `${normalizeReps(reps).length} rep${normalizeReps(reps).length === 1 ? "" : "s"}` : "Parent relay"}</span>
            </div>
            <label className="checkbox-line">
              <input type="checkbox" checked={hasRep} onChange={(e) => setHasRep(e.target.checked)} />
              <span>Represented by agent or manager</span>
            </label>
            {hasRep ? (
              <div className="editor-rows" aria-label="Representatives">
                {reps.map((rep, index) => (
                  <div className="editor-row" key={`rep-${index}`}>
                    <div className="field-grid field-grid--rep">
                      <label>
                        Name
                        <input value={rep.name} onChange={(e) => updateRep(index, { name: e.target.value })} />
                      </label>
                      <label>
                        Role
                        <select value={rep.role} onChange={(e) => updateRep(index, { role: e.target.value as Rep["role"] })}>
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                        </select>
                      </label>
                      <label>
                        Email
                        <input type="email" value={rep.email} onChange={(e) => updateRep(index, { email: e.target.value })} />
                      </label>
                    </div>
                    <button className="row-remove" type="button" onClick={() => removeRep(index)}>Remove</button>
                  </div>
                ))}
                <button className="button-secondary panel-action" type="button" onClick={addRep}>Add rep</button>
              </div>
            ) : (
              <p className="panel-note">
                The live page shows a parent contact button that routes through the private relay. Parent email and phone stay off the page.
              </p>
            )}
          </article>

          {/* Casting Links */}
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
                      <input value={link.label} placeholder="Actors Access" onChange={(e) => updateLink(index, { label: e.target.value })} />
                    </label>
                    <label>
                      URL
                      <input value={link.url} placeholder="https://..." onChange={(e) => updateLink(index, { url: e.target.value })} />
                    </label>
                  </div>
                  <button className="row-remove" type="button" onClick={() => removeLink(index)}>Remove</button>
                </div>
              ))}
              <button className="button-secondary panel-action" type="button" onClick={addLink}>Add link</button>
            </div>
          </article>

          {/* Template & Style */}
          <article className="editor-panel" data-testid="template-panel">
            <div className="panel-heading">
              <p>Template &amp; Style</p>
              <span className={editorPlan === "plus" ? "plan-badge plan-badge--plus" : "plan-badge plan-badge--free"}>
                {editorPlan === "plus" ? "✦ Plus" : "Free"}
              </span>
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
                    onClick={() => {
                      if (locked) {
                        // Clicking a locked template scrolls to the upgrade prompt
                        document.getElementById("upgrade-bar")?.scrollIntoView({ behavior: "smooth" });
                      } else {
                        setTemplateId(template.id);
                      }
                    }}
                  >
                    <span className={`template-thumb template-thumb--${template.id}`} aria-hidden="true">
                      <span />
                    </span>
                    <strong>{template.label}</strong>
                    <small>{locked ? "Plus only ↑" : template.tier === "plus" ? "Plus" : "Free"}</small>
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
              <select value={fontPair} onChange={(e) => setFontPair(e.target.value as FontPair)}>
                {fontPairOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </article>

          {/* Headshots */}
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
                .filter((h) => !isPlaceholderHeadshot(h))
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
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {!headshot.featured ? (
                        <button type="button" className="btn-set-featured" onClick={() => handleSetFeatured(headshot.id)}>
                          Set featured
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleRemoveHeadshot(headshot.id)}>Remove</button>
                    </div>
                  </div>
                ))}
            </div>
          </article>

          {/* Slate, Clips & Reels */}
          <article className="editor-panel" data-testid="clips-panel">
            <div className="panel-heading">
              <p>Slate, Clips &amp; Reels</p>
              <span>{normalizeClips(clips).length} visible</span>
            </div>
            <TipDisclosure tipKey="clips" />
            <label>
              Slate video URL
              <input value={slateUrl} placeholder="YouTube or Vimeo URL" onChange={(e) => setSlateUrl(e.target.value)} />
            </label>
            <div className="editor-rows" aria-label="Clip and reel links">
              {clips.map((clip, index) => (
                <div className="editor-row" key={clip.id}>
                  <div className="field-grid field-grid--clip">
                    <label>
                      Title
                      <input value={clip.title} placeholder="Demo Reel" onChange={(e) => updateClip(index, { title: e.target.value })} />
                    </label>
                    <label>
                      Category
                      <select value={clip.category} onChange={(e) => updateClip(index, { category: e.target.value as Clip["category"] })}>
                        {clipCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      YouTube/Vimeo URL
                      <input value={clip.embedUrl} placeholder="https://..." onChange={(e) => updateClip(index, { embedUrl: e.target.value })} />
                    </label>
                  </div>
                  <button className="row-remove" type="button" onClick={() => removeClip(index)}>Remove</button>
                </div>
              ))}
              <button className="button-secondary panel-action" type="button" onClick={addClip}>Add clip</button>
            </div>
          </article>

          {/* Resume */}
          <article className="editor-panel" data-testid="resume-panel">
            <div className="panel-heading">
              <p>Resume</p>
              <span>{(resumeContent?.credits ?? []).length} credit{(resumeContent?.credits ?? []).length === 1 ? "" : "s"}</span>
            </div>
            <TipDisclosure tipKey="resume" />
            <div className="resume-import-bar">
              <p>
                <b>Resume101 Import</b> — pull your credits directly from resumes.childactor101.com.
              </p>
              <button
                className="btn-import"
                type="button"
                disabled={importing || !authUser}
                onClick={handleResume101Import}
              >
                {importing ? "Importing…" : "Import →"}
              </button>
            </div>
            {importStatus ? <p className="panel-note">{importStatus}</p> : null}
            {!authUser ? <p className="panel-note">Sign in to import from Resume101.</p> : null}
            
            <div className="resume-import-bar" style={{ marginTop: 16 }}>
              <p>
                <b>Resume Document</b> — {resumeContent?.fileName ? `Current: ${resumeContent.fileName}` : "Upload a PDF or DOC for download."}
              </p>
              {resumeContent?.fileUrl ? (
                <button className="btn-import" type="button" onClick={handleRemoveResumeDocument}>
                  Remove
                </button>
              ) : (
                <label className="btn-import" style={{ cursor: "pointer", textAlign: "center" }}>
                  {resumeUploading ? "Uploading…" : "Upload →"}
                  <input type="file" accept=".pdf,.doc,.docx" disabled={resumeUploading} onChange={handleResumeUpload} style={{ display: "none" }} />
                </label>
              )}
            </div>
            {resumeUploadStatus ? <p className="panel-note">{resumeUploadStatus}</p> : null}
            <div className="editor-rows" aria-label="Resume credits" style={{ marginTop: 16 }}>
              {(resumeContent?.credits ?? []).map((credit, index) => (
                <div className="editor-row" key={`credit-${index}`}>
                  <div className="field-grid field-grid--credit">
                    <label>
                      Project / Production
                      <input value={credit.project} placeholder="Short film title" onChange={(e) => updateCredit(index, { project: e.target.value })} />
                    </label>
                    <label>
                      Role
                      <input value={credit.role} placeholder="Supporting" onChange={(e) => updateCredit(index, { role: e.target.value })} />
                    </label>
                    <label>
                      Company / Network
                      <input value={credit.company} placeholder="Independent" onChange={(e) => updateCredit(index, { company: e.target.value })} />
                    </label>
                  </div>
                  <button className="row-remove" type="button" onClick={() => removeCredit(index)}>Remove</button>
                </div>
              ))}
              <button className="button-secondary panel-action" type="button" onClick={addCredit}>Add credit</button>
            </div>
          </article>

          {/* BTS Feed (Plus only) */}
          <article className="editor-panel" data-testid="feed-panel">
            <div className="panel-heading">
              <p>Updates Feed</p>
              <span className="plus-badge">Plus</span>
            </div>
            <TipDisclosure tipKey="updates" />
            {editorPlan === "plus" ? (
              <>
                <div className="editor-rows" aria-label="Updates feed items">
                  {feedItems.map((item, index) => (
                    <div className="editor-row" key={item.id}>
                      <div className="field-grid field-grid--feed">
                        <label>
                          Date
                          <input type="date" value={item.date} onChange={(e) => updateFeedItem(index, { date: e.target.value })} />
                        </label>
                        <label>
                          Body (keep short — wins only, no locations or schedules)
                          <textarea
                            className="feed-body-input"
                            value={item.body}
                            placeholder="We booked a commercial!"
                            maxLength={280}
                            onChange={(e) => updateFeedItem(index, { body: e.target.value })}
                          />
                        </label>
                      </div>
                      <button className="row-remove" type="button" onClick={() => removeFeedItem(index)}>Remove</button>
                    </div>
                  ))}
                  <button className="button-secondary panel-action" type="button" onClick={addFeedItem}>Add update</button>
                </div>
              </>
            ) : (
              <div className="plus-gate-strip">
                <span className="plus-badge">Plus</span>
                <p>The BTS feed is available on Plus. Upgrade to share wins and updates directly on your page.</p>
              </div>
            )}
          </article>

          {/* Press Quote (Prestige template only) */}
          {(templateId === "prestige" || pressContent) ? (
            <article className="editor-panel" data-testid="press-panel">
              <div className="panel-heading">
                <p>Press Quote</p>
                <span className="plus-badge">Prestige</span>
              </div>
              <TipDisclosure tipKey="press" />
              <label>
                Quote
                <input
                  value={pressContent?.quote ?? ""}
                  placeholder="Prepared, present, and unusually natural on camera."
                  onChange={(e) => updatePress({ quote: e.target.value })}
                />
              </label>
              <label>
                Attribution
                <input
                  value={pressContent?.attribution ?? ""}
                  placeholder="Casting workshop note"
                  onChange={(e) => updatePress({ attribution: e.target.value })}
                />
              </label>
            </article>
          ) : null}

          {/* Account */}
          <article className="editor-panel" data-testid="account-panel">
            <div className="panel-heading">
              <p>Account</p>
              <span>{authUser ? (editorPlan === "plus" ? "✦ Plus" : "Free") : "Not signed in"}</span>
            </div>
            <AuthControls
              email={authEmail}
              user={authUser}
              status={authStatus}
              plan={editorPlan}
              subscription={subscription}
              upgrading={upgrading}
              onEmailChange={setAuthEmail}
              onSubmit={handleAuthSubmit}
              onSignOut={handleSignOut}
              onUpgrade={handleUpgrade}
              onManageSubscription={handleManageSubscription}
            />
          </article>

          {/* Sections sorter */}
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
                    <button type="button" className="drag-handle" aria-label={`Drag ${section.type}`}>⠿</button>
                    <span>{section.type}</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setSections((secs) => secs.map((s) => s.id === section.id ? { ...s, enabled } : s));
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

      <button type="button" className="floating-preview" onClick={() => setPreviewOpen(true)}>Preview</button>

      {previewOpen ? (
        <div className="preview-overlay" role="dialog" aria-label="Page preview" aria-modal="true">
          <div className="preview-overlay-bar">
            <span>{`pages.childactor101.com/p/${publicSlug}`}</span>
            <button type="button" onClick={() => setPreviewOpen(false)}>Close</button>
          </div>
          <div className="preview-overlay-surface">
            <ActorPageRenderer page={previewPage} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EditorToolbar({
  displayName, previewUrl, saveStatus, saving, onPreview, onPublish
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
  email, user, status, plan, subscription, upgrading,
  onEmailChange, onSubmit, onSignOut, onUpgrade, onManageSubscription
}: {
  email: string;
  user: User | null;
  status: string | null;
  plan: Plan;
  subscription: SubscriptionRow | null;
  upgrading: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onUpgrade: () => void;
  onManageSubscription: () => void;
}) {
  if (user) {
    return (
      <div>
        <div className="auth-strip">
          <span>{user.email}</span>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>

        {/* Subscription panel */}
        {plan === "plus" ? (
          <div className="upgrade-bar" id="upgrade-bar">
            <p>
              <strong>✦ Pages101 Plus</strong> — Premium templates, unlimited headshots &amp; clips, BTS feed.
              {subscription?.current_period_end ? ` Renews ${new Date(subscription.current_period_end).toLocaleDateString()}.` : ""}
            </p>
            <button className="btn-import" type="button" disabled={upgrading} onClick={onManageSubscription}>
              {upgrading ? "Loading…" : "Manage subscription"}
            </button>
          </div>
        ) : (
          <div className="upgrade-bar" id="upgrade-bar">
            <p>
              <strong>Upgrade to Plus</strong> — Unlock Splash &amp; Prestige templates, unlimited headshots, BTS feed, and custom domain.
            </p>
            <button className="button-primary" type="button" style={{ minHeight: 38, padding: "0 18px", borderRadius: 999 }} disabled={upgrading} onClick={onUpgrade}>
              {upgrading ? "Loading…" : "Upgrade — $49/yr"}
            </button>
          </div>
        )}

        {status ? <p className="panel-note">{status}</p> : null}
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Account email
        <input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} />
      </label>
      <button className="button-secondary" type="submit">Send link</button>
      {status ? <p className="panel-note">{status}</p> : null}
    </form>
  );
}

function TipDisclosure({ tipKey }: { tipKey?: TipKey }) {
  if (!tipKey) return null;
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

// ─── Utility helpers ───────────────────────────────────────────────────────────

function getPageHeadshots(actorPage: ActorPage) {
  const section = actorPage.sections.find((s) => s.type === "headshots");
  return section?.type === "headshots" ? section.content.headshots : [];
}

function getSectionClips(sections: ActorPageSection[]) {
  const section = sections.find((s) => s.type === "clips");
  return section?.type === "clips" ? section.content.clips : [];
}

function getSectionFeedItems(sections: ActorPageSection[]) {
  const section = sections.find((s) => s.type === "feed");
  return section?.type === "feed" ? section.content.items : [];
}

function getSectionPress(sections: ActorPageSection[]) {
  const section = sections.find((s) => s.type === "press");
  return section?.type === "press" ? section.content : null;
}

function isPlaceholderHeadshot(headshot: Headshot) {
  return headshot.src === "/pageslogo.png";
}

function normalizeHeadshots(headshotsToNormalize: Headshot[]) {
  let featuredAssigned = false;
  return headshotsToNormalize.map((headshot, index) => {
    const featured = !featuredAssigned && (headshot.featured || index === 0);
    if (featured) featuredAssigned = true;
    return { ...headshot, featured };
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
    .map((rep) => ({ name: rep.name.trim(), role: rep.role, email: rep.email.trim() }))
    .filter((rep) => rep.name && rep.email);
}

function normalizeLinks(linksToNormalize: PageLink[]) {
  return linksToNormalize
    .map((link) => ({ label: link.label.trim(), url: normalizeExternalUrl(link.url) }))
    .filter((link) => link.label && link.url);
}

function normalizeClips(clipsToNormalize: Clip[]) {
  return clipsToNormalize
    .map((clip) => ({ ...clip, title: clip.title.trim(), embedUrl: normalizeEmbedUrl(clip.embedUrl.trim()) }))
    .filter((clip) => clip.title && clip.embedUrl);
}

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeEmbedUrl(url: string) {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : normalized;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) return normalized;
      const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://www.youtube.com/embed/${id}` : normalized;
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${id}` : normalized;
    }

    if (host === "player.vimeo.com") return normalized;
  } catch {
    return normalized;
  }

  return normalized;
}

function getHeadshotLabel(fileName: string) {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const words = nameWithoutExtension.replace(/[-_]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Headshot";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
