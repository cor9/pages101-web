"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  formatCooldown,
  getMagicLinkCooldownRemaining,
  isMagicLinkRateLimitError,
  MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS,
  MAGIC_LINK_SUCCESS_COOLDOWN_MS,
  setMagicLinkCooldown
} from "@/lib/auth/magic-link";

type TemplateType = "classic" | "splash" | "prestige";

export default function HomePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  
  // Auth states
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownMs, setCooldownMs] = useState(0);

  // Template previewer state
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>("classic");

  useEffect(() => {
    if (!supabase) return;
    
    // Check initial user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Handle magic link email cooldown timer
  useEffect(() => {
    setCooldownMs(getMagicLinkCooldownRemaining(email));

    if (!email.trim()) return;

    const timer = window.setInterval(() => {
      setCooldownMs(getMagicLinkCooldownRemaining(email));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [email]);

  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setStatus("error");
      return;
    }

    const remainingMs = getMagicLinkCooldownRemaining(email);
    if (remainingMs > 0) {
      setErrorMessage(`Please wait ${formatCooldown(remainingMs)} before requesting another link.`);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    // Dynamic redirect URI for local vs production
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) {
      if (isMagicLinkRateLimitError(error)) {
        setMagicLinkCooldown(email, MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS);
        setCooldownMs(MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS);
        setErrorMessage(`Too many sign-in emails were requested. Please wait ${formatCooldown(MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS)} and try again.`);
      } else {
        setErrorMessage(error.message);
      }
      setStatus("error");
    } else {
      setMagicLinkCooldown(email, MAGIC_LINK_SUCCESS_COOLDOWN_MS);
      setCooldownMs(MAGIC_LINK_SUCCESS_COOLDOWN_MS);
      setStatus("success");
    }
  }

  const handleScrollToLogin = () => {
    const el = document.getElementById("login-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="landing-page">
      {/* Ecosystem Top Banner */}
      <div className="landing-top-banner" style={{
        background: "var(--ink)",
        color: "var(--cream)",
        fontSize: "12px",
        padding: "10px 24px",
        textAlign: "center",
        fontWeight: "500",
        borderBottom: "1px solid var(--hairline)"
      }}>
        Part of the <a href="https://childactor101.com" target="_blank" rel="noreferrer" style={{ color: "var(--marquee)", textDecoration: "underline", fontWeight: "600" }}>Child Actor 101</a> family &bull; Build your resume at <a href="https://resumes.childactor101.com" target="_blank" rel="noreferrer" style={{ color: "var(--marquee)", textDecoration: "underline", fontWeight: "600" }}>Resume101</a>
      </div>

      {/* Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-logo">
            Pages<span>101</span>
          </div>
          <nav className="landing-nav-actions">
            {user ? (
              <button 
                onClick={() => router.push("/dashboard")} 
                className="btn-nav-primary"
              >
                Manage Your Actor Pages
              </button>
            ) : (
              <button 
                onClick={handleScrollToLogin} 
                className="btn-nav-secondary"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero" aria-label="Pages101 Hero">
        <div className="landing-hero-container">
          <div className="landing-hero-content">
            <h1 className="landing-hero-title">
              The Free Home Base for Your Young Actor&apos;s Career
            </h1>
            <p className="landing-hero-subtitle">
              Create one professional link for headshots, clips, resume credits, representation, and casting profiles — while privately tracking auditions, callbacks, avail checks, and bookings in one dashboard.
            </p>
            <p className="landing-hero-authority">
              Created by Corey Ralston, youth talent manager and founder of Child Actor 101.
            </p>
            <div className="landing-hero-ctas">
              {user ? (
                <button 
                  onClick={() => router.push("/dashboard")} 
                  className="btn-hero-primary"
                >
                  Manage Your Actor Pages
                </button>
              ) : (
                <button 
                  onClick={handleScrollToLogin} 
                  className="btn-hero-primary"
                >
                  Create Your Free Actor Page
                </button>
              )}
              <a href="#how-it-works" className="btn-hero-secondary">
                See How It Works
              </a>
            </div>
          </div>
          
          <div className="landing-hero-visual">
            <div className="mock-profile-card">
              <div className="mock-profile-header">
                <div className="mock-profile-avatar"></div>
                <div className="mock-profile-meta">
                  <h3>Mia Rose</h3>
                  <span>SAG-AFTRA Eligible &middot; Portrays 9-12</span>
                  <p>Atlanta / Southeast Market</p>
                </div>
              </div>
              <div className="mock-profile-details">
                <div className="mock-badge-strip">
                  <span>Theatrical</span>
                  <span>Commercial</span>
                  <span>Voiceover</span>
                </div>
                <div className="mock-reps">
                  <strong>Representation:</strong> Coast to Coast Talent Group
                </div>
                <div className="mock-resume-row">
                  <div className="mock-resume-line"><strong>The Library Door</strong> &middot; Supporting &middot; Indie Short</div>
                  <div className="mock-resume-line"><strong>BrightMart TV Commercial</strong> &middot; Principal &middot; National</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="landing-social" aria-label="Social Proof">
        <p>Built by Corey Ralston, youth talent manager and founder of Child Actor 101.</p>
      </section>

      <section id="how-it-works" className="landing-problem" aria-label="Problem">
        <div className="landing-section-header">
          <h2>Most Actor Families Are Managing Everything In Five Different Places</h2>
          <p>Headshots in one folder. Resume PDFs somewhere else. Audition notes buried in texts. Callback information hidden in emails. Booking history scattered across spreadsheets.</p>
          <p className="landing-support-line">Pages101 brings everything together in one place. One professional actor page for the public. One private career tracker for the family.</p>
        </div>
      </section>

      <section className="landing-pillars" aria-label="Product Pillars">
        <div className="landing-section-header">
          <h2>Publicly Professional. Privately Organized.</h2>
        </div>

        <div className="landing-pillars-grid">
          <div className="feature-card landing-pillar-card">
            <p className="landing-pillar-eyebrow">Public Actor Page</p>
            <h3>One clean, professional link for the public side of the career.</h3>
            <ul className="landing-check-list">
              <li>Headshots</li>
              <li>Resume credits</li>
              <li>Representation</li>
              <li>Reels and clips</li>
              <li>Casting profile links</li>
              <li>Safe contact relay</li>
              <li>Custom domains (Plus)</li>
            </ul>
            <p>Share one professional link with agents, managers, casting directors, coaches, and industry contacts.</p>
          </div>

          <div className="feature-card landing-pillar-card">
            <p className="landing-pillar-eyebrow">Career Tracker &amp; Audition Journal</p>
            <h3>The private record families actually need to stay organized over time.</h3>
            <ul className="landing-check-list">
              <li>Auditions</li>
              <li>Callbacks</li>
              <li>Producer sessions</li>
              <li>Avail checks</li>
              <li>Bookings</li>
              <li>Casting contacts</li>
              <li>Notes and statistics</li>
            </ul>
            <p>Track your actor&apos;s progress over months and years while keeping every opportunity organized.</p>
          </div>
        </div>
      </section>

      <section className="landing-career-tracker" aria-label="Career Tracker">
        <div className="landing-section-header">
          <h2>Finally Know What&apos;s Actually Happening In Your Actor&apos;s Career</h2>
          <p>Most families guess. Pages101 keeps a complete history of auditions, outcomes, callbacks, avail checks, and bookings so you can identify patterns and measure growth over time.</p>
        </div>

        <div className="landing-career-grid">
          <div className="career-stats-panel">
            <div className="career-stats-grid landing-career-stats-grid">
              <div className="career-stat-card">
                <span>37</span>
                <small>Auditions</small>
              </div>
              <div className="career-stat-card">
                <span>11</span>
                <small>Callbacks</small>
              </div>
              <div className="career-stat-card">
                <span>4</span>
                <small>Avail Checks</small>
              </div>
              <div className="career-stat-card">
                <span>2</span>
                <small>Bookings</small>
              </div>
              <div className="career-stat-card career-stat-card--wide">
                <span>29.7%</span>
                <small>Callback Rate</small>
              </div>
            </div>
          </div>

          <div className="career-table-card landing-career-table-card">
            <div className="career-filters-header">
              <h3>Career Tracker Snapshot</h3>
            </div>
            <div className="career-table-wrap">
              <table className="career-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Role</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Summer of Wren</td>
                    <td>Guest Star</td>
                    <td><span className="career-outcome-badge career-outcome-badge--callback">Callback</span></td>
                  </tr>
                  <tr>
                    <td>BrightMart</td>
                    <td>Principal</td>
                    <td><span className="career-outcome-badge career-outcome-badge--avail_check">Avail Check</span></td>
                  </tr>
                  <tr>
                    <td>Maple Street</td>
                    <td>Supporting</td>
                    <td><span className="career-outcome-badge career-outcome-badge--booked">Booked</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Templates Preview */}
      <section className="landing-templates" aria-label="Templates Showcase">
        <div className="landing-section-header">
          <h2>Choose The Look That Fits Your Actor</h2>
          <p>Switch styles instantly without losing headshots, clips, resume credits, representation information, or career data.</p>
        </div>

        <div className="template-previewer">
          <div className="template-tabs">
            <button 
              className={`template-tab ${activeTemplate === "classic" ? "active" : ""}`}
              onClick={() => setActiveTemplate("classic")}
            >
              Classic <span className="badge-free">Free</span>
            </button>
            <button 
              className={`template-tab ${activeTemplate === "splash" ? "active" : ""}`}
              onClick={() => setActiveTemplate("splash")}
            >
              Splash <span className="badge-plus">Plus</span>
            </button>
            <button 
              className={`template-tab ${activeTemplate === "prestige" ? "active" : ""}`}
              onClick={() => setActiveTemplate("prestige")}
            >
              Prestige <span className="badge-plus">Plus</span>
            </button>
          </div>

          <div className="template-mock-display">
            {activeTemplate === "classic" && (
              <div className="browser-mockup">
                <div className="browser-mockup-header">
                  <span className="browser-mockup-dot red"></span>
                  <span className="browser-mockup-dot yellow"></span>
                  <span className="browser-mockup-dot green"></span>
                  <span className="browser-mockup-address">billy.childactor101.com</span>
                </div>
                <div className="browser-mockup-body" style={{ position: "relative" }}>
                  <Image src="/classicexample.jpg" alt="Classic actor page preview" width={500} height={833} style={{ width: "100%", height: "auto" }} />
                </div>
              </div>
            )}
            
            {activeTemplate === "splash" && (
              <div className="browser-mockup">
                <div className="browser-mockup-header">
                  <span className="browser-mockup-dot red"></span>
                  <span className="browser-mockup-dot yellow"></span>
                  <span className="browser-mockup-dot green"></span>
                  <span className="browser-mockup-address">mia.childactor101.com</span>
                </div>
                <div className="browser-mockup-body" style={{ position: "relative" }}>
                  <Image src="/splashexample.jpg" alt="Splash actor page preview" width={500} height={633} style={{ width: "100%", height: "auto" }} />
                </div>
              </div>
            )}

            {activeTemplate === "prestige" && (
              <div className="browser-mockup">
                <div className="browser-mockup-header">
                  <span className="browser-mockup-dot red"></span>
                  <span className="browser-mockup-dot yellow"></span>
                  <span className="browser-mockup-dot green"></span>
                  <span className="browser-mockup-address">corey.childactor101.com</span>
                </div>
                <div className="browser-mockup-body" style={{ position: "relative" }}>
                  <Image src="/prestigeexample.jpg" alt="Prestige actor page preview" width={500} height={806} style={{ width: "100%", height: "auto" }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="landing-template-note">
          Every Pages101 account starts with Classic. Upgrade to Plus to unlock Splash, Prestige, unlimited media, custom domains, sibling support, and unlimited career tracking.
        </p>
      </section>

      <section className="landing-domain" aria-label="Custom Domains">
        <div className="landing-section-header">
          <h2>Give Your Actor Their Own Professional Web Address</h2>
          <p>Plus members can connect a custom domain in minutes. Instead of sharing a platform URL, send casting and industry professionals directly to your actor&apos;s own branded web address.</p>
        </div>
        <div className="landing-domain-grid">
          <div className="feature-card landing-domain-card">
            <div className="landing-domain-examples">
              <span>MiaRoseActor.com</span>
              <span>BillyThompsonActor.com</span>
              <span>JordanLeePerformer.com</span>
            </div>
            <p className="landing-domain-words">Professional. Memorable. Easy to share.</p>
          </div>
        </div>
      </section>

      <section className="landing-comparison" aria-label="Comparison">
        <div className="landing-section-header">
          <h2>Built Specifically For Young Actors</h2>
        </div>
        <div className="landing-comparison-wrap">
          <table className="landing-comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Pages101</th>
                <th>Generic Website Builder</th>
                <th>Linktree</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Built for child actors</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Resume integration</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Career tracking</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Representation section</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Casting links</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Safe contact relay</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Google-hidden by default</td><td>✓</td><td>—</td><td>—</td></tr>
              <tr><td>Child safety controls</td><td>✓</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="landing-upgrade-reasons" aria-label="Why Families Upgrade">
        <div className="landing-section-header">
          <h2>Why Families Upgrade To Plus</h2>
        </div>
        <div className="landing-features-grid">
          <div className="feature-card">
            <h3>Premium Templates</h3>
            <p>Unlock Splash and Prestige for a more distinct, polished presentation.</p>
          </div>
          <div className="feature-card">
            <h3>Custom Domains</h3>
            <p>Use your own professional web address instead of a platform URL.</p>
          </div>
          <div className="feature-card">
            <h3>Unlimited Media</h3>
            <p>Add all the clips and headshots you need without free-tier caps.</p>
          </div>
          <div className="feature-card">
            <h3>Sibling Support</h3>
            <p>Create up to four performer pages for one family account.</p>
          </div>
          <div className="feature-card">
            <h3>Updates Feed</h3>
            <p>Share curated wins and momentum on the public page without exposing private details.</p>
          </div>
          <div className="feature-card">
            <h3>Unlimited Career Tracking</h3>
            <p>Track years of auditions, callbacks, avails, and bookings in one organized dashboard.</p>
          </div>
        </div>
      </section>

      {/* Auth Card / Sign In Section */}
      <section id="login-section" className="landing-login">
        <div className="landing-login-container">
          <div className="login-card">
            <h2>Create Your Free Actor Page</h2>
            <p className="login-card-subtitle">No password needed. We&apos;ll email you a secure link to sign in or register.</p>
            
            {status === "success" ? (
              <div className="login-success-state">
                <div className="success-icon">✉️</div>
                <h3>Check your email!</h3>
                <p>We sent a magic sign-in link to <strong>{email}</strong>. If you do not see it, check your spam folder.</p>
                <button onClick={() => setStatus("idle")} className="btn-secondary">
                  Use another email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkLogin} className="login-form">
                <div className="input-group">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter parent email address"
                    required
                    className="login-input"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={status === "loading" || cooldownMs > 0}
                  className="btn-login"
                >
                  {status === "loading" ? "Sending link..." : cooldownMs > 0 ? `Wait ${formatCooldown(cooldownMs)}` : "Send magic link"}
                </button>

                {status === "error" && (
                  <p className="error-message">
                    {errorMessage}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="landing-pricing" aria-label="Pricing">
        <div className="landing-section-header">
          <h2>Simple, Honest Pricing</h2>
          <p>Safety is always free. Plus unlocks premium designs, custom domains, unlimited media, sibling support, updates feed, and unlimited audition tracking.</p>
        </div>
        <div className="landing-pricing-summary">
          <p className="landing-pricing-summary-title">Every account includes:</p>
          <div className="landing-pricing-summary-list" aria-label="Included in every account">
            <span>✓ Professional actor page</span>
            <span>✓ One-click Resume101 import and re-import</span>
            <span>✓ Child-safe contact relay</span>
            <span>✓ Career Tracker</span>
          </div>
        </div>

        <div className="pricing-grid">
          <div className="pricing-tier free-tier">
            <h3>Classic Free</h3>
            <div className="tier-price">$0 <span>/ forever</span></div>
            <p className="tier-desc">Great for building a safe public actor page with private career organization.</p>
            <ul className="tier-features">
              <li>✓ Classic actor page</li>
              <li>✓ Custom Accent Colors & Fonts</li>
              <li>✓ 3 headshots & 2 video links</li>
              <li>✓ Included safety controls</li>
              <li>✓ One-click Resume101 import and re-import</li>
              <li>✓ Safety relays & default noindex</li>
              <li>✓ 1 performer page</li>
              <li>✓ 5 audition tracker entries</li>
            </ul>
          </div>

          <div className="pricing-tier plus-tier featured">
            <div className="tier-badge">Recommended</div>
            <h3>Plus</h3>
            <div className="tier-price">$49 <span>/ year</span></div>
            <p className="tier-desc">Perfect for active performers, siblings, and families who want a polished professional link plus unlimited private career tracking.</p>
            <ul className="tier-features">
              <li>✓ Classic + Splash + Prestige page styles</li>
              <li>✓ Connect your own custom domain</li>
              <li>✓ Unlimited headshots & clips</li>
              <li>✓ Curated updates feed</li>
              <li>✓ Sibling support — up to 4 performer pages</li>
              <li>✓ Unlimited audition tracking</li>
              <li>✓ Minimal Pages101 credit (no ads)</li>
              <li>✓ One-click Resume101 import and re-import</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-bottom-cta" aria-label="Bottom Call To Action">
        <div className="landing-bottom-cta-card">
          <h2>One Link For The Industry. One Dashboard For The Family.</h2>
          <p>Create a professional actor page, organize auditions and callbacks, track career progress, and upgrade anytime for custom domains and premium designs.</p>
          <div className="landing-bottom-cta-actions">
            {user ? (
              <button onClick={() => router.push("/dashboard")} className="btn-hero-primary">
                Create Free Account
              </button>
            ) : (
              <button onClick={handleScrollToLogin} className="btn-hero-primary">
                Create Free Account
              </button>
            )}
            <a
              href="https://resumes.childactor101.com"
              target="_blank"
              rel="noreferrer"
              className="btn-hero-secondary"
            >
              Import Resume From Resume101
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-brand">
            Pages<span>101</span>
          </div>
          <div className="footer-links">
            <Link href="/">Pages101</Link>
            <a href="https://childactor101.com" target="_blank" rel="noreferrer">Child Actor 101</a>
            <a href="https://resumes.childactor101.com" target="_blank" rel="noreferrer">Resume101</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#login-section">Login</a>
          </div>
          <p className="footer-credit">&copy; {new Date().getFullYear()} Child Actor 101. All safety controls are active by default.</p>
        </div>
      </footer>
    </div>
  );
}
