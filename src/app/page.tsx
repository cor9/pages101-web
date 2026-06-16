"use client";

import { useEffect, useState } from "react";
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
        Part of the <a href="https://childactor101.com" target="_blank" rel="noreferrer" style={{ color: "var(--marquee)", textDecoration: "underline", fontWeight: "600" }}>Child Actor 101</a> family &bull; Build your resume at <a href="https://resumes.childactor101.com" target="_blank" rel="noreferrer" style={{ color: "var(--marquee)", textDecoration: "underline", fontWeight: "600" }}>resumes.childactor101.com</a>
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
                Go to Dashboard
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
              The Free 10-Minute Marketing Page for Young Actors
            </h1>
            <p className="landing-hero-subtitle">
              Built with Industry Experience. Safe-by-default. Showcase headshots, reels, clips, resume, important links, Contact info and a curated newsfeed in a stunning casting-ready web page.
            </p>
            <div className="landing-hero-ctas">
              {user ? (
                <button 
                  onClick={() => router.push("/dashboard")} 
                  className="btn-hero-primary"
                >
                  Manage Your Pages
                </button>
              ) : (
                <button 
                  onClick={handleScrollToLogin} 
                  className="btn-hero-primary"
                >
                  Create Your Actor Page Free
                </button>
              )}
              <a href="#features" className="btn-hero-secondary">
                Learn More
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
        <p>Built by a talent manager with 30 years in the industry.</p>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features" aria-label="Features">
        <div className="landing-section-header">
          <h2>The promotional page your child&apos;s team actually wants to use.</h2>
          <p>Everything you need to showcase your child&apos;s talent professionally, safely, and quickly.</p>
        </div>
        
        <div className="landing-features-grid">
          <div className="feature-card">
            <div className="feature-icon font-tip-icon">💡</div>
            <h3>101 Manager Tips</h3>
            <p>Get professional coaching guidance beside every builder field. Know exactly how to slate, which headshots to lead with, and what clips casting directors want to see.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon resume-icon">🔄</div>
            <h3>Resume101 Integration</h3>
            <p>Import all credits from Resume101 with a single click. Keep your page in sync instantly without re-typing. Download formatted PDF resumes directly from the page.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon safety-icon">🛡️</div>
            <h3>Safety-First by Default</h3>
            <p>We hide personal contact info and exact birthdates. parent messages are relayed securely via an email form. Pages are unlisted from Google search unless you choose to opt in.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon multi-icon">👥</div>
            <h3>Manage Sibling Pages</h3>
            <p>Have multiple talented performers in the family? Manage up to 4 child actor pages under a single account, switching between templates instantly (Plus Tier).</p>
          </div>
        </div>
      </section>

      {/* Interactive Templates Preview */}
      <section className="landing-templates" aria-label="Templates Showcase">
        <div className="landing-section-header">
          <h2>Choose a Stunning Template</h2>
          <p>Switch templates in one click without losing any resume details, clips, or headshots.</p>
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
              <div className="mock-display-canvas classic-style">
                <div className="mock-canvas-header" style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--cream)", border: "1px solid var(--hairline)", margin: "0 auto 8px auto" }}></div>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-fraunces), serif", fontSize: "18px" }}>Mia Rose</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--ink-soft)" }}>SAG-AFTRA Eligible &bull; Age 9-12</p>
                </div>
                <div className="mock-canvas-body">
                  <div className="mock-canvas-accent-bar" style={{ margin: "0 auto 12px auto" }}></div>
                  <div style={{ border: "1px solid var(--hairline)", padding: "10px", borderRadius: "6px", fontSize: "11px", marginBottom: "12px", background: "#fcfbfa" }}>
                    <div style={{ fontWeight: 600, borderBottom: "1px solid var(--hairline)", paddingBottom: "4px", marginBottom: "6px" }}>Selected Credits</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>The Library Door</span>
                      <span style={{ color: "var(--ink-soft)" }}>Supporting</span>
                    </div>
                  </div>
                  <div className="mock-canvas-buttons" style={{ justifyContent: "center" }}>
                    <span className="mock-btn">Actors Access</span>
                    <span className="mock-btn">IMDb</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTemplate === "splash" && (
              <div className="mock-display-canvas splash-style">
                <div className="mock-canvas-header" style={{ transform: "rotate(-2deg)" }}>
                  <div style={{ width: "48px", height: "48px", background: "#e3c84f", borderRadius: "8px", border: "2px solid #2b2320", marginBottom: "8px" }}></div>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-inter), sans-serif", fontWeight: 900, fontSize: "20px", color: "#ff69b4" }}>MIA ROSE! ☀️</h3>
                  <span style={{ background: "#2b2320", color: "white", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "2px" }}>SAG-AFTRA Eligible</span>
                </div>
                <div className="mock-canvas-body" style={{ marginTop: "12px" }}>
                  <div className="mock-canvas-buttons" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="mock-btn-badge" style={{ background: "#ff69b4", border: "2px solid #2b2320", textAlign: "center", boxShadow: "2px 2px 0 #2b2320" }}>Watch Reels ↗</span>
                    <span className="mock-btn-badge" style={{ background: "#e3c84f", color: "#2b2320", border: "2px solid #2b2320", textAlign: "center", boxShadow: "2px 2px 0 #2b2320" }}>Voice Reels ↗</span>
                  </div>
                </div>
              </div>
            )}

            {activeTemplate === "prestige" && (
              <div className="mock-display-canvas prestige-style" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ height: "90px", background: "linear-gradient(135deg, #2b2320, #6b5f56)", display: "flex", alignItems: "flex-end", padding: "12px", color: "white" }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-fraunces), serif", fontSize: "18px" }}>Mia Rose</h3>
                    <p style={{ margin: 0, fontSize: "10px", opacity: 0.8 }}>SAG-AFTRA Eligible &bull; Age 9-12</p>
                  </div>
                </div>
                <div className="mock-canvas-body" style={{ padding: "12px" }}>
                  <div style={{ fontStyle: "italic", fontSize: "11px", borderLeft: "2px solid #d4af37", paddingLeft: "8px", marginBottom: "12px", color: "var(--ink-soft)" }}>
                    &ldquo;A bright new screen presence with immense dramatic focus.&rdquo;
                  </div>
                  <div className="mock-canvas-buttons">
                    <span className="mock-btn-prestige" style={{ border: "1px solid #d4af37", padding: "6px 12px", fontSize: "9px", display: "inline-block" }}>View Press Kit</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Auth Card / Sign In Section */}
      <section id="login-section" className="landing-login">
        <div className="landing-login-container">
          <div className="login-card">
            <h2>Start Building Your Page</h2>
            <p className="login-card-subtitle">No password needed. We&apos;ll email you a secure link to sign in or register.</p>
            
            {status === "success" ? (
              <div className="login-success-state">
                <div className="success-icon">✉️</div>
                <h3>Check your email!</h3>
                <p>We sent a magic sign-in link to <strong>{email}</strong>.</p>
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
          <p>Safety is always free. Plus unlocks custom domains, sibling pages, and design templates.</p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-tier free-tier">
            <h3>Classic Free</h3>
            <div className="tier-price">$0 <span>/ forever</span></div>
            <p className="tier-desc">Great for getting started and setting up a basic profile.</p>
            <ul className="tier-features">
              <li>✓ Classic Template</li>
              <li>✓ Custom Accent Colors & Fonts</li>
              <li>✓ 3 free images & 2 video link uploads</li>
              <li>✓ Included safety controls</li>
              <li>✓ Resume101 copy import</li>
              <li>✓ Safety relays & default noindex</li>
              <li>✓ 1 performer page</li>
            </ul>
          </div>

          <div className="pricing-tier plus-tier featured">
            <div className="tier-badge">Recommended</div>
            <h3>Plus</h3>
            <div className="tier-price">$49 <span>/ year</span></div>
            <p className="tier-desc">Perfect for active performers and multi-sibling families.</p>
            <ul className="tier-features">
              <li>✓ Classic + Splash + Prestige templates</li>
              <li>✓ Connect your own custom domain</li>
              <li>✓ Unlimited headshots & clips</li>
              <li>✓ Behind-the-Scenes updates feed</li>
              <li>✓ Sibling support (up to 4 performer pages)</li>
              <li>✓ Minimal Pages101 credit (no ads)</li>
              <li>✓ Syncs live with Resume101</li>
            </ul>
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
            <a href="https://childactor101.com" target="_blank" rel="noreferrer">Child Actor 101</a>
            <a href="https://resumes.childactor101.com" target="_blank" rel="noreferrer">Resume101</a>
            <a href="#features">Features</a>
            <a href="#login-section">Login</a>
          </div>
          <p className="footer-credit">&copy; {new Date().getFullYear()} Child Actor 101. All safety controls are active by default.</p>
        </div>
      </footer>
    </div>
  );
}
