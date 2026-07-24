"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDeadline, isWindowOpen } from "@/lib/opencall";
import type { OpenCallEvent, OpenCallApplication } from "@/lib/opencall";
import type { User } from "@supabase/supabase-js";

type ActorPageOption = { id: string; display_name: string };
type AppSummary = Pick<OpenCallApplication, "id" | "status" | "actor_name" | "submitted_at" | "updated_at">;

export default function OpenCallLanding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<OpenCallEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [applications, setApplications] = useState<AppSummary[]>([]);
  const [pages, setPages] = useState<ActorPageOption[]>([]);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [email, setEmail] = useState("");
  const [loginSent, setLoginSent] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Load event (no auth needed)
  useEffect(() => {
    fetch("/api/opencall/event")
      .then((r) => r.json())
      .then((body: { event?: OpenCallEvent }) => setEvent(body.event ?? null))
      .catch(() => {})
      .finally(() => setEventLoading(false));
  }, []);

  // Auth & user data
  useEffect(() => {
    if (!supabase) { setAuthLoaded(true); return; }

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user);
        await loadUserData(data.user);
      }
      setAuthLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserData(session.user);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserData(u: User) {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";

    const [appsRes, pagesRes] = await Promise.all([
      fetch("/api/opencall/applications", { headers: { Authorization: `Bearer ${token}` } }),
      supabase.from("p101_actor_pages").select("id, display_name").eq("user_id", u.id).order("updated_at", { ascending: false }),
    ]);

    if (appsRes.ok) {
      const body = await appsRes.json() as { applications?: AppSummary[] };
      setApplications(body.applications ?? []);
    }
    if (!pagesRes.error) {
      setPages((pagesRes.data ?? []) as ActorPageOption[]);
    }
  }

  async function handleCreateApplication(sourcePageId?: string) {
    if (!supabase) return;
    setCreating(true);
    setCreateError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/opencall/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...(sourcePageId ? { source_page_id: sourcePageId } : {}) }),
      });
      const body = await res.json() as { application?: { id: string }; error?: string };
      if (!res.ok || !body.application) {
        setCreateError(body.error ?? "Failed to start application.");
        return;
      }
      router.push(`/opencall/apply/${body.application.id}`);
    } catch {
      setCreateError("Failed to start application. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginError("");
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/opencall`,
        },
      });
      if (error) {
        setLoginError(error.message);
      } else {
        setLoginSent(true);
      }
    } catch {
      setLoginError("Failed to send sign-in link. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  const windowOpen = event ? isWindowOpen(event) : false;
  const activeApplications = applications.filter((a) => a.status !== "withdrawn");

  if (eventLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--cream)" }}>
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", fontFamily: "var(--font-inter), sans-serif" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid var(--hairline)", background: "var(--paper)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 900 }}>
            Pages<span style={{ color: "var(--marquee)" }}>101</span>
          </Link>
          {user ? (
            <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--ink-soft)", textDecoration: "none" }}>
              Dashboard →
            </Link>
          ) : (
            <span style={{ fontSize: "0.875rem", color: "var(--ink-soft)" }}>{email ? "" : "Sign in to apply"}</span>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--marquee)", marginBottom: 8 }}>
            Open Call
          </p>
          <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontStyle: "italic", fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.1, color: "var(--ink)", margin: "0 0 16px" }}>
            {event ? event.name : "Open Call"}
          </h1>

          {event && (
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-soft)", marginBottom: 4 }}>Submissions Open</div>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>{formatDeadline(event.submits_open)}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-soft)", marginBottom: 4 }}>Deadline</div>
                <div style={{ fontWeight: 700, color: windowOpen ? "var(--marquee)" : "var(--ink)" }}>
                  {formatDeadline(event.submits_close)}
                </div>
              </div>
            </div>
          )}

          {event && !windowOpen && (
            <div style={{ padding: "12px 16px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)", color: "var(--ink-soft)", fontSize: "0.875rem" }}>
              {event.status === "closed" || event.status === "reviewing"
                ? "This Open Call has closed. Thank you to everyone who submitted."
                : "Submissions are not yet open. Check back soon."}
            </div>
          )}
        </div>

        {/* Authenticated state */}
        {authLoaded && user && (
          <div>
            {/* Existing applications */}
            {activeApplications.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>Your Applications</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeApplications.map((app) => (
                    <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                          {app.actor_name ?? "Unnamed application"}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: 2 }}>
                          {app.status === "submitted" ? `Submitted ${app.submitted_at ? formatDeadline(app.submitted_at) : ""}` : `Draft — last saved ${new Date(app.updated_at).toLocaleDateString("en-US")}`}
                        </div>
                      </div>
                      {app.status === "draft" && windowOpen && (
                        <Link href={`/opencall/apply/${app.id}`} style={{ padding: "8px 16px", background: "var(--marquee)", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.875rem" }}>
                          Continue
                        </Link>
                      )}
                      {app.status === "submitted" && windowOpen && (
                        <Link href={`/opencall/apply/${app.id}`} style={{ padding: "8px 16px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.875rem" }}>
                          Edit / View
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start new application */}
            {windowOpen && (
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
                  {activeApplications.length === 0 ? "Apply Now" : "New Application"}
                </h2>
                {createError && (
                  <p style={{ color: "var(--marquee)", fontSize: "0.875rem", marginBottom: 12 }}>{createError}</p>
                )}

                {pages.length > 0 ? (
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", marginBottom: 12 }}>
                      Start with a performer page or apply without pre-filling.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {pages.map((pg) => (
                        <button
                          key={pg.id}
                          onClick={() => handleCreateApplication(pg.id)}
                          disabled={creating}
                          style={{ padding: "10px 18px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: "0.875rem", opacity: creating ? 0.6 : 1 }}
                        >
                          Apply for {pg.display_name}
                        </button>
                      ))}
                      <button
                        onClick={() => handleCreateApplication()}
                        disabled={creating}
                        style={{ padding: "10px 18px", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--hairline)", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: "0.875rem", opacity: creating ? 0.6 : 1 }}
                      >
                        Blank Application
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleCreateApplication()}
                    disabled={creating}
                    style={{ padding: "12px 24px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? "Starting…" : "Start Application"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Guest state */}
        {authLoaded && !user && windowOpen && (
          <div style={{ padding: 32, background: "var(--paper)", borderRadius: "var(--radius)", border: "1px solid var(--hairline)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>Sign in to apply</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", marginBottom: 20 }}>
              We&apos;ll send you a magic link — no password needed.
            </p>
            {loginSent ? (
              <div style={{ padding: "12px 16px", background: "var(--cream)", borderRadius: 8, color: "var(--ink)", fontWeight: 700 }}>
                Check your email for a sign-in link.
              </div>
            ) : (
              <form onSubmit={handleLogin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: "0.9rem", fontFamily: "inherit" }}
                />
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{ padding: "10px 20px", background: "var(--marquee)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", opacity: loginLoading ? 0.6 : 1 }}
                >
                  {loginLoading ? "Sending…" : "Send Link"}
                </button>
              </form>
            )}
            {loginError && <p style={{ color: "var(--marquee)", fontSize: "0.875rem", marginTop: 10 }}>{loginError}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
