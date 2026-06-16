"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardShell } from "@/components/editor/DashboardShell";
import { normalizeSlug, validateSlug } from "@/lib/slug";

type ActorPageListItem = {
  id: string;
  display_name: string;
  slug: string;
  template: string;
  published: boolean;
  updated_at: string;
  p101_custom_domains?: { domain: string; verified: boolean }[] | null;
};

type SubscriptionState = {
  plan: "free" | "plus";
  status: string;
  current_period_end: string | null;
} | null;

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pages & Subscription lists
  const [pages, setPages] = useState<ActorPageListItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  
  // Page Creation form states
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [formError, setFormError] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  
  // Stripe Loading
  const [billingLoading, setBillingLoading] = useState(false);

  // Fetch all pages and subscription for current user
  const fetchPagesAndSub = useCallback(async (userId: string) => {
    if (!supabase) return;

    try {
      // 1. Get pages with custom domains
      const { data: pageData, error: pageErr } = await supabase
        .from("p101_actor_pages")
        .select("id, display_name, slug, template, published, updated_at, p101_custom_domains(domain, verified)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (pageErr) {
        console.error("Error fetching pages:", pageErr.message);
      } else {
        setPages((pageData as unknown as ActorPageListItem[]) || []);
      }

      // 2. Get subscription
      const { data: subData, error: subErr } = await supabase
        .from("p101_subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", userId)
        .maybeSingle();

      if (subErr) {
        console.error("Error fetching subscription:", subErr.message);
      } else {
        setSubscription(subData as SubscriptionState);
      }
    } catch (err) {
      console.error("Error in fetch:", err);
    }
  }, [supabase]);

  // Auth listener
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        fetchPagesAndSub(data.user.id);
      } else {
        // Redirect if not logged in
        router.push("/");
      }
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchPagesAndSub(session.user.id);
      } else {
        setUser(null);
        router.push("/");
      }
    });

    return () => authSub.unsubscribe();
  }, [supabase, fetchPagesAndSub, router]);

  // Sign out
  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  // Billing Actions
  const handleUpgrade = async () => {
    if (!supabase || !user) return;
    setBillingLoading(true);
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
        alert(body.error ?? "Failed to initiate Checkout session.");
      }
    } catch {
      alert("Failed to connect to billing server.");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!supabase || !user) return;
    setBillingLoading(true);
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
        alert(body.error ?? "Failed to open Billing Customer Portal.");
      }
    } catch {
      alert("Failed to connect to billing server.");
    } finally {
      setBillingLoading(false);
    }
  };

  // Page Deletion
  const handleDeletePage = async (pageId: string, name: string) => {
    if (!supabase) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete ${name}'s performer page? All headshots, clips, and resume data for this page will be permanently removed. This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("p101_actor_pages")
        .delete()
        .eq("id", pageId);

      if (error) {
        alert(`Failed to delete page: ${error.message}`);
      } else {
        if (user) {
          fetchPagesAndSub(user.id);
        }
      }
    } catch {
      alert("An unexpected error occurred during page deletion.");
    }
  };

  // Page Creation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewName(name);
    // Auto populate slug suggestion
    setNewSlug(normalizeSlug(name));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSlug(normalizeSlug(e.target.value));
  };

  const handleCreatePageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;

    setFormError("");
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setFormError("Performer's name is required.");
      return;
    }

    const validation = validateSlug(newSlug);
    if (!validation.ok) {
      setFormError(validation.reason);
      return;
    }

    // Check plan limits
    const isPlus = subscription?.plan === "plus" && (subscription?.status === "active" || subscription?.status === "trialing");
    const limit = isPlus ? 4 : 1;
    if (pages.length >= limit) {
      if (!isPlus) {
        setFormError("The Free Plan is limited to 1 performer page. Please upgrade to the Plus Plan to add up to 4 siblings.");
      } else {
        setFormError("You've reached the maximum limit of 4 performer pages under the Plus Plan.");
      }
      return;
    }

    setCreatingPage(true);

    try {
      // 1. Check if slug is already taken
      const { data: taken } = await supabase
        .from("p101_actor_pages")
        .select("id")
        .eq("slug", newSlug)
        .maybeSingle();

      if (taken) {
        setFormError("That safe URL is already taken. Please choose a different slug.");
        setCreatingPage(false);
        return;
      }

      // 2. Insert new page
      const { data: newPage, error: insertError } = await supabase
        .from("p101_actor_pages")
        .insert({
          user_id: user.id,
          slug: newSlug,
          display_name: trimmedName,
          template: "classic",
          published: false
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError) {
        setFormError(insertError.message);
        setCreatingPage(false);
        return;
      }

      // 3. Create default page sections (sort orders match dashboard configuration)
      const defaultSections = [
        { page_id: newPage.id, type: "headshots", enabled: true, sort_order: 10, content: { headshots: [] } },
        { page_id: newPage.id, type: "resume", enabled: true, sort_order: 20, content: { credits: [], syncedWithResume101: false, updatedAt: "" } },
        { page_id: newPage.id, type: "clips", enabled: true, sort_order: 30, content: { clips: [] } },
        { page_id: newPage.id, type: "feed", enabled: false, sort_order: 40, content: { items: [] } },
        { page_id: newPage.id, type: "press", enabled: false, sort_order: 50, content: { quote: "", attribution: "" } }
      ];

      const { error: sectionError } = await supabase
        .from("p101_page_sections")
        .insert(defaultSections);

      if (sectionError) {
        console.error("Error creating default sections:", sectionError.message);
        // Continue anyway since DashboardShell will initialize empty ones
      }

      // Clean up form states
      setNewName("");
      setNewSlug("");
      setIsCreating(false);
      
      // Select the new page and load the editor directly
      setSelectedPageId(newPage.id);
    } catch {
      setFormError("Failed to create performer page.");
    } finally {
      setCreatingPage(false);
    }
  };

  // Loader state
  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--cream)",
        color: "var(--ink-soft)",
        fontFamily: "var(--font-inter), sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{
            width: "40px",
            height: "40px",
            border: "3px solid rgba(43,35,32,0.1)",
            borderTopColor: "var(--marquee)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px auto"
          }}></div>
          <p>Loading your account...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // If in page editor view, render the DashboardShell
  if (selectedPageId) {
    return (
      <DashboardShell 
        pageId={selectedPageId} 
        onBack={() => {
          setSelectedPageId(null);
          if (user) fetchPagesAndSub(user.id);
        }}
      />
    );
  }

  // Standard Dashboard View
  const isPlusActive = subscription?.plan === "plus" && (subscription?.status === "active" || subscription?.status === "trialing");
  const siblingLimit = isPlusActive ? 4 : 1;
  const isLimitReached = pages.length >= siblingLimit;

  return (
    <div className="dashboard-page">
      {/* Navigation Header */}
      <header className="dashboard-nav-header">
        <div className="nav-header-container">
          <div className="nav-brand">
            Pages<span>101</span>
          </div>
          <div className="nav-user-controls">
            <span className="user-email">{user?.email}</span>
            <button onClick={handleSignOut} className="btn-signout">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Main Area */}
      <main className="dashboard-container">
        <div className="dashboard-columns">
          {/* Left Column: Performer Pages List */}
          <section className="dashboard-main-col" aria-label="Performers Section">
            <div className="col-header">
              <h2>Family Performers</h2>
              {!isCreating && (
                <button
                  disabled={isLimitReached}
                  onClick={() => setIsCreating(true)}
                  className={`btn-add-performer ${isLimitReached ? "disabled" : ""}`}
                >
                  + Add Performer
                </button>
              )}
            </div>

            {isCreating && (
              <div className="creation-card">
                <h3>Create Performer Profile</h3>
                <form onSubmit={handleCreatePageSubmit} className="creation-form">
                  <label>
                    Performer&apos;s Name
                    <input
                      type="text"
                      value={newName}
                      onChange={handleNameChange}
                      placeholder="e.g. Mia Rose"
                      required
                    />
                  </label>
                  
                  <label>
                    Safe URL Slug (Safe-by-default link)
                    <div className="slug-input-wrapper">
                      <span className="slug-prefix">pages.childactor101.com/p/</span>
                      <input
                        type="text"
                        value={newSlug}
                        onChange={handleSlugChange}
                        placeholder="mia-rose"
                        required
                      />
                    </div>
                    <span className="input-hint">Lowercase letters, numbers, and single hyphens only.</span>
                  </label>

                  {formError && <p className="form-error-msg">{formError}</p>}

                  <div className="form-buttons">
                    <button 
                      type="button" 
                      onClick={() => { setIsCreating(false); setFormError(""); }} 
                      className="btn-form-cancel"
                      disabled={creatingPage}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-form-submit"
                      disabled={creatingPage}
                    >
                      {creatingPage ? "Creating..." : "Create Performer Page"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {pages.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">🎭</div>
                <h3>No performer profiles created yet</h3>
                <p>Add your child&apos;s performer profile to begin building their professional, casting-ready page.</p>
                {!isCreating && (
                  <button 
                    onClick={() => setIsCreating(true)} 
                    className="btn-hero-primary"
                    style={{ marginTop: "16px" }}
                  >
                    Add Your First Performer
                  </button>
                )}
              </div>
            ) : (
              <div className="pages-list">
                {pages.map((pageItem) => {
                  const hasCustom = pageItem.p101_custom_domains?.find((d) => d.verified);
                  const displaySlugUrl = hasCustom 
                    ? `https://${hasCustom.domain}` 
                    : `https://pages.childactor101.com/p/${pageItem.slug}`;
                  
                  return (
                    <article key={pageItem.id} className="performer-card">
                      <div className="performer-avatar">
                        {pageItem.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="performer-details">
                        <div className="performer-header">
                          <h3>{pageItem.display_name}</h3>
                          <span className={`status-pill ${pageItem.published ? "status-published" : "status-draft"}`}>
                            {pageItem.published ? "Published" : "Draft"}
                          </span>
                        </div>
                        <a 
                          href={displaySlugUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="performer-slug-link"
                        >
                          {pageItem.slug}.pages.childactor101.com ↗
                        </a>
                        <div className="performer-meta">
                          <span className="meta-item">Template: <strong>{pageItem.template}</strong></span>
                        </div>
                      </div>
                      
                      <div className="performer-actions">
                        <button
                          onClick={() => setSelectedPageId(pageItem.id)}
                          className="btn-action-edit"
                        >
                          Edit Profile
                        </button>
                        <a
                          href={displaySlugUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-action-view"
                        >
                          View Page
                        </a>
                        <button
                          onClick={() => handleDeletePage(pageItem.id, pageItem.display_name)}
                          className="btn-action-delete"
                          aria-label={`Delete profile for ${pageItem.display_name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Sidebar Plan Status */}
          <aside className="dashboard-sidebar" aria-label="Account details">
            <div className="sidebar-section plan-card">
              <h3>Plan & Settings</h3>
              
              <div className="plan-summary">
                <span className="plan-label">Current Plan:</span>
                <span className={`plan-badge ${isPlusActive ? "plan-plus" : "plan-free"}`}>
                  {isPlusActive ? "Plus Tier" : "Free Tier"}
                </span>
              </div>

              <div className="limits-progress">
                {pages.length > siblingLimit ? (
                  <div className="limit-overflow-warning" style={{ color: "var(--marquee-deep)", fontSize: "12px", fontWeight: "600", marginBottom: "8px", lineHeight: "1.4" }}>
                    You&apos;re over the free limit &mdash; upgrade to Plus to manage {pages.length === 2 ? "both" : "all"} pages.
                  </div>
                ) : (
                  <div className="limits-header">
                    <span>Performers limit:</span>
                    <strong>{pages.length} / {siblingLimit} pages</strong>
                  </div>
                )}
                <div className="progress-bar-container" style={{ borderColor: pages.length > siblingLimit ? "var(--marquee-deep)" : undefined }}>
                  <div 
                    className="progress-bar-fill"
                    style={{ 
                      width: `${Math.min(100, (pages.length / siblingLimit) * 100)}%`,
                      backgroundColor: pages.length > siblingLimit ? "var(--marquee-deep)" : undefined
                    }}
                  ></div>
                </div>
              </div>

              {isPlusActive ? (
                <div className="plus-active-box">
                  <p className="plus-features-note">✓ Custom Domains &bull; ✓ Prestige/Splash templates &bull; ✓ Unlimited headshots & clips</p>
                  <button 
                    onClick={handleManageBilling} 
                    disabled={billingLoading}
                    className="btn-manage-billing"
                  >
                    {billingLoading ? "Loading..." : "Manage Subscription"}
                  </button>
                </div>
              ) : (
                <div className="upgrade-upsell-box">
                  <h4>Upgrade to Plus</h4>
                  <p>Unlock the full casting potential for your young performers:</p>
                  <ul>
                    <li>&bull; Connect custom domains</li>
                    <li>&bull; Manage up to 4 sibling profiles</li>
                    <li>&bull; Access Splash & Prestige templates</li>
                    <li>&bull; Unlimited headshots and demo clips</li>
                  </ul>
                  <button 
                    onClick={handleUpgrade}
                    disabled={billingLoading}
                    className="btn-upgrade-now"
                  >
                    {billingLoading ? "Loading..." : "Upgrade for $49/year"}
                  </button>
                </div>
              )}
            </div>

            <div className="sidebar-section tips-box">
              <h4>Safety & Standards</h4>
              <p>Safety is built into Pages101 at every layer. We never expose your child&apos;s phone number or personal email address, and exact dates of birth are never stored.</p>
              <p>For more details or help connecting your custom domains, read the talent manager advice in the editor toolbar tips.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
