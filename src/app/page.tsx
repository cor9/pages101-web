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
                Manage Your Press Kits
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
              The Free 10-Minute Digital Press Kit for Young Actors
            </h1>
            <p className="landing-hero-subtitle">
              Built by a talent manager. Safe by default. One polished link for headshots, reels, resume, and reps — plus a private tracker for every audition.
            </p>
            <div className="landing-hero-ctas">
              {user ? (
                <button 
                  onClick={() => router.push("/dashboard")} 
                  className="btn-hero-primary"
                >
                  Manage Your Press Kits
                </button>
              ) : (
                <button 
                  onClick={handleScrollToLogin} 
                  className="btn-hero-primary"
                >
                  Create Your Free Press Kit
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
          <h2>The press kit your child&apos;s team actually wants to use.</h2>
          <p>One professional link for headshots, resume credits, reels, clips, representation, casting profiles, and safe contact — plus a private career tracker for auditions, callbacks, avail checks, and bookings.</p>
          <p className="landing-support-line">Stop sending casting five different links. Pages101 gives your actor one clean, professional place for everything their team needs.</p>
        </div>
        
        <div className="landing-features-grid">
          <div className="feature-card">
            <div className="feature-icon font-tip-icon">💡</div>
            <h3>101 Manager Tips</h3>
            <p>Get professional guidance beside every field. Know what to include, what to leave out, which headshots to lead with, and how to present your actor&apos;s materials clearly.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon resume-icon">🔄</div>
            <h3>Resume101 Integration</h3>
            <p>Import credits from Resume101 with a single click. Keep your press kit and actor resume consistent without re-typing the same credits over and over.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon safety-icon">🛡️</div>
            <h3>Safety-First by Default</h3>
            <p>We hide personal contact info and exact birthdates. Parent messages are relayed securely through a contact form. Press kits are unlisted from Google search unless you choose to opt in.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon multi-icon">📋</div>
            <h3>Career Tracker</h3>
            <p>Track auditions, callbacks, avail checks, and bookings in one private dashboard. See your actor&apos;s progress over time and keep important casting notes organized.</p>
          </div>
        </div>
      </section>

      <section className="landing-more-than" aria-label="More Than a Press Kit">
        <div className="landing-section-header">
          <h2>More Than a Digital Press Kit</h2>
          <p>Pages101 helps families showcase the actor publicly while staying organized privately.</p>
        </div>

        <div className="landing-mini-grid">
          <div className="feature-card landing-mini-card">
            <h3>Public Press Kit</h3>
            <p>Share headshots, clips, reels, resume credits, representation, casting links, and safe contact in one clean professional link.</p>
          </div>

          <div className="feature-card landing-mini-card">
            <h3>Private Career Tracker</h3>
            <p>Log auditions, callbacks, producer sessions, avail checks, bookings, outcomes, casting contacts, and notes.</p>
          </div>

          <div className="feature-card landing-mini-card">
            <h3>Connected 101 Tools</h3>
            <p>Use Resume101 to keep credits consistent, Prep101 to prepare stronger auditions, and Reader101 to support better self-tapes.</p>
          </div>
        </div>
      </section>

      {/* Interactive Templates Preview */}
      <section className="landing-templates" aria-label="Templates Showcase">
        <div className="landing-section-header">
          <h2>Choose a Press Kit Style</h2>
          <p>Switch styles in one click without losing resume credits, clips, links, or headshots.</p>
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
                  <Image src="/classicexample.jpg" alt="Classic Press Kit Preview" width={500} height={833} style={{ width: "100%", height: "auto" }} />
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
                  <Image src="/splashexample.jpg" alt="Splash Press Kit Preview" width={500} height={633} style={{ width: "100%", height: "auto" }} />
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
                  <Image src="/prestigeexample.jpg" alt="Prestige Press Kit Preview" width={500} height={806} style={{ width: "100%", height: "auto" }} />
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
            <h2>Start Building Your Press Kit</h2>
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
          <p>Safety is always free. Plus unlocks custom domains, sibling press kits, unlimited media, premium styles, live Resume101 sync, and unlimited audition tracking.</p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-tier free-tier">
            <h3>Classic Free</h3>
            <div className="tier-price">$0 <span>/ forever</span></div>
            <p className="tier-desc">Great for creating a safe, simple digital press kit.</p>
            <ul className="tier-features">
              <li>✓ Classic Press Kit Style</li>
              <li>✓ Custom Accent Colors & Fonts</li>
              <li>✓ 3 headshots & 2 video links</li>
              <li>✓ Included safety controls</li>
              <li>✓ Resume101 credit import</li>
              <li>✓ Safety relays & default noindex</li>
              <li>✓ 1 performer press kit</li>
              <li>✓ 5 audition tracker entries</li>
            </ul>
          </div>

          <div className="pricing-tier plus-tier featured">
            <div className="tier-badge">Recommended</div>
            <h3>Plus</h3>
            <div className="tier-price">$49 <span>/ year</span></div>
            <p className="tier-desc">Perfect for active performers, siblings, and families who want a polished professional link plus private career tracking.</p>
            <ul className="tier-features">
              <li>✓ Classic + Splash + Prestige press kit styles</li>
              <li>✓ Connect your own custom domain</li>
              <li>✓ Unlimited headshots & clips</li>
              <li>✓ Curated updates feed</li>
              <li>✓ Sibling support — up to 4 performer press kits</li>
              <li>✓ Unlimited audition tracking</li>
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
            <Link href="/">Pages101</Link>
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
