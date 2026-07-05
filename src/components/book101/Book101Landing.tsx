"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const problemCards = [
  {
    title: "\"How many callbacks this year?\"",
    body: "You think it was around six. Maybe eight. There was that one in February, or was that last year?"
  },
  {
    title: "\"Which offices bring us back?\"",
    body: "North Harbor Casting seems to like you. Or maybe Juniper Room? You know one office has called your actor back three times, but which one?"
  },
  {
    title: "\"What was the note last time?\"",
    body: "The CD gave a redirect on a comedy audition eighteen months ago. It would help right now. It's in a text somewhere. Somewhere."
  }
] as const;

const insightCards = [
  {
    metric: "75%",
    label: "Callback rate at Bluebird Kids Casting",
    body: "They've brought Avery back three of four times. That's a real relationship, not a coincidence. Now you know to prep harder every time their name lands."
  },
  {
    metric: "3.2x",
    label: "Comedy vs. drama booking ratio",
    body: "Your actor books comedy at more than triple their drama rate. Time to talk to your rep about leaning harder into comedic material."
  },
  {
    metric: "18 days",
    label: "Average time to callback",
    body: "If it's been three weeks with no word, it's not coming. Stop refreshing the inbox. Book101 keeps the timeline honest."
  }
] as const;

const officeRows = [
  {
    name: "Bluebird Kids Casting",
    detail: "Morgan Lee Office",
    count: "4 auds / 3 CBs",
    rate: "75%"
  },
  {
    name: "Juniper Room Casting",
    detail: "Commercial Division",
    count: "6 auds / 3 CBs",
    rate: "50%"
  },
  {
    name: "North Harbor Casting",
    detail: "Series Regular Desk",
    count: "3 auds / 1 CB",
    rate: "33%"
  },
  {
    name: "Red Kite Casting",
    detail: "Feature / Indie",
    count: "2 auds / 1 booking",
    rate: "50%"
  },
  {
    name: "Various - Under 2 auds",
    detail: "Growing relationships",
    count: "22 auds / 3 CBs",
    rate: "14%"
  }
] as const;

const fieldCards = [
  ["01", "Project & Role", "What you auditioned for. What part."],
  ["02", "Casting Office", "Auto-suggests as you build your history."],
  ["03", "Casting Director", "Track individual CD relationships."],
  ["04", "Project Type", "Film, TV, Commercial, Theater, VO, more."],
  ["05", "Role Size", "Co-star to lead. Casting speaks in these terms."],
  ["06", "Format", "Self-tape, in-person, or virtual."],
  ["07", "Audition Stage", "Initial, callback, producer, network test."],
  ["08", "Outcome", "Booked, callback, avail, pass, no word."],
  ["09", "Received From", "Your rep, direct from CD, or self-submitted."],
  ["10", "Notes", "The CD's redirect. The bold choice. Future-you will thank you."],
  ["11", "Date", "Filter by month, quarter, year, or custom range."],
  ["12", "Multi-Actor", "Sibling actors? All tracked under one login."]
] as const;

const freeFeatures = [
  "Up to 5 audition entries",
  "All 12 fields",
  "Basic stats dashboard",
  "One performer",
  "Casting office auto-suggest",
  "Export to CSV"
] as const;

const proFeatures = [
  "Unlimited audition entries",
  "Multi-performer support (up to 4 siblings)",
  "Casting office CRM & callback rates",
  "Pattern insights & booking analytics",
  "Prep101 integration for upcoming auditions",
  "Priority support from Corey's team",
  "Pages101 Plus included"
] as const;

function AuthAwareLink({
  signedIn,
  signedOutHref,
  signedInHref,
  className,
  children
}: {
  signedIn: boolean;
  signedOutHref: string;
  signedInHref: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={signedIn ? signedInHref : signedOutHref} className={className}>
      {children}
    </Link>
  );
}

export function Book101Landing() {
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const isSignedIn = Boolean(user);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <div className="book101-page">
      <div className="book101-umbrella">
        Part of the <a href="https://childactor101.com">Child Actor 101</a> family &middot; Also try <Link href="/">Pages101</Link> and <a href="https://resumes.childactor101.com">Resume101</a>
      </div>

      <header className="book101-nav">
        <Link href="/book101" className="book101-brand">
          <span className="book101-brand-mark">
            Book<em>101</em>
          </span>
          <span className="book101-brand-tag">Career Tracker</span>
        </Link>
        <nav className="book101-nav-links" aria-label="Book101">
          <a href="#how">How it works</a>
          <a href="#pattern">Insights</a>
          <a href="#pricing">Pricing</a>
          <AuthAwareLink
            signedIn={isSignedIn}
            signedOutHref="/login"
            signedInHref="/dashboard/career-tracker"
            className="book101-btn-primary"
          >
            {isSignedIn ? "Open dashboard ->" : "Sign in ->"}
          </AuthAwareLink>
        </nav>
      </header>

      <main>
        <section className="book101-hero">
          <div>
            <div className="book101-hero-eyebrow">Private Career Tracker for Young Actors</div>
            <h1>
              Finally know what&apos;s <em>actually happening</em> in your actor&apos;s career.
            </h1>
            <p className="book101-lead">
              Log every audition, callback, avail check, and booking in one private dashboard. See patterns emerge. Stop guessing which offices remember your kid. Start knowing.
            </p>
            <div className="book101-hero-ctas">
              <AuthAwareLink
                signedIn={isSignedIn}
                signedOutHref="/login"
                signedInHref="/dashboard/career-tracker"
                className="book101-cta-primary"
              >
                {isSignedIn ? "Open your tracker ->" : "Start tracking free ->"}
              </AuthAwareLink>
              <a className="book101-cta-secondary" href="#how">
                See how it works
              </a>
            </div>
            <p className="book101-hero-fine">
              Free forever for up to <b>5 auditions</b>. Unlimited on Pro - $49/year. <b>Pages101 Plus members: Book101 Pro is included.</b>
            </p>
          </div>

          <div className="book101-hero-mock" aria-hidden="true">
            <div className="book101-mock-chrome">
              <span className="book101-mock-dot book101-mock-dot-r"></span>
              <span className="book101-mock-dot book101-mock-dot-y"></span>
              <span className="book101-mock-dot book101-mock-dot-g"></span>
              <span className="book101-mock-url">pages.childactor101.com/book101/dashboard</span>
            </div>
            <div className="book101-mock-body">
              <div className="book101-mock-head">
                <div className="book101-mock-title">Career Tracker</div>
                <button type="button" className="book101-mock-add">
                  + Add Audition
                </button>
              </div>
              <div className="book101-stats">
                <div className="book101-stat">
                  <div className="book101-stat-n">37</div>
                  <div className="book101-stat-l">Auditions</div>
                </div>
                <div className="book101-stat">
                  <div className="book101-stat-n">11</div>
                  <div className="book101-stat-l">Callbacks</div>
                </div>
                <div className="book101-stat">
                  <div className="book101-stat-n">3</div>
                  <div className="book101-stat-l">Avails</div>
                </div>
                <div className="book101-stat">
                  <div className="book101-stat-n">2</div>
                  <div className="book101-stat-l">Bookings</div>
                </div>
                <div className="book101-stat">
                  <div className="book101-stat-n">29.7%</div>
                  <div className="book101-stat-l">CB Rate</div>
                </div>
              </div>
              <div className="book101-rows">
                <div className="book101-row-h">
                  <span>Date</span>
                  <span>Project</span>
                  <span>Type</span>
                  <span>Outcome</span>
                </div>
                <div className="book101-row">
                  <span className="book101-date">Jun 12</span>
                  <span className="book101-proj">
                    Lantern Summer
                    <small>Guest Star / Bluebird Kids Casting</small>
                  </span>
                  <span className="book101-type">TV</span>
                  <span>
                    <span className="book101-pill book101-pill-callback">Callback</span>
                  </span>
                </div>
                <div className="book101-row">
                  <span className="book101-date">Jun 08</span>
                  <span className="book101-proj">
                    Pinecrest Market Spot
                    <small>Principal / Juniper Room Casting</small>
                  </span>
                  <span className="book101-type">Commercial</span>
                  <span>
                    <span className="book101-pill book101-pill-avail">Avail</span>
                  </span>
                </div>
                <div className="book101-row">
                  <span className="book101-date">May 30</span>
                  <span className="book101-proj">
                    Harbor Street
                    <small>Supporting / Red Kite Casting</small>
                  </span>
                  <span className="book101-type">Film</span>
                  <span>
                    <span className="book101-pill book101-pill-booked">Booked</span>
                  </span>
                </div>
                <div className="book101-row">
                  <span className="book101-date">May 22</span>
                  <span className="book101-proj">
                    Moonlight Hall
                    <small>Co-Star / North Harbor Casting</small>
                  </span>
                  <span className="book101-type">TV</span>
                  <span>
                    <span className="book101-pill book101-pill-pending">Pending</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="book101-proof">
          Built by <b>Corey Ralston</b>, youth talent manager and founder of Child Actor 101. From the fields, categories, and habits that actually get young actors booked.
        </div>

        <section className="book101-problem" id="how">
          <div className="book101-wrap">
            <div className="book101-sec-eyebrow">The Problem</div>
            <h2 className="book101-sec-h">
              Every actor family runs a <em>data operation</em>. Most run it blind.
            </h2>
            <p className="book101-sec-sub book101-centered-copy">
              Auditions live in text threads. Callback notes live in your memory. Casting office context lives on Post-its. When your rep asks how the year is going, you guess.
            </p>

            <div className="book101-problem-list">
              {problemCards.map((card) => (
                <article key={card.title} className="book101-problem-card">
                  <div className="book101-problem-k">Without Book101</div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="book101-pattern" id="pattern">
          <div className="book101-wrap">
            <div className="book101-sec-eyebrow">The Payoff</div>
            <h2 className="book101-sec-h">
              The patterns you&apos;ve been sitting on <em>all along</em>.
            </h2>
            <p className="book101-sec-sub">
              Log a few months of auditions and Book101 starts showing you things you couldn&apos;t see before. Which offices bring you back. What genres your actor lands. Where the booking rate lives.
            </p>

            <div className="book101-pattern-grid">
              <div className="book101-insight-list">
                {insightCards.map((card) => (
                  <article key={card.label} className="book101-insight">
                    <div className="book101-insight-metric">{card.metric}</div>
                    <div className="book101-insight-label">{card.label}</div>
                    <p>{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="book101-pattern-viz">
                <h4>Casting Offices - This Year</h4>
                <p className="book101-pattern-sub">Ranked by callback rate. Auto-generated from your audition log.</p>
                {officeRows.map((row) => (
                  <div key={row.name} className="book101-office-row">
                    <span className="book101-office-name">
                      {row.name}
                      <small>{row.detail}</small>
                    </span>
                    <span className="book101-office-count">{row.count}</span>
                    <span className="book101-office-rate">{row.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="book101-fields">
          <div className="book101-wrap">
            <div className="book101-sec-eyebrow">Built by a Talent Manager</div>
            <h2 className="book101-sec-h">
              The <em>right fields</em>. In the right order.
            </h2>
            <p className="book101-sec-sub">Every field in Book101 exists because 30 years of managing young actors proved it mattered. Nothing extra. Nothing missing.</p>

            <div className="book101-fields-grid">
              {fieldCards.map(([number, title, body]) => (
                <article key={number} className="book101-field">
                  <div className="book101-field-n">{number}</div>
                  <h4>{title}</h4>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="book101-cross">
          <div className="book101-wrap">
            <div className="book101-cross-grid">
              <div className="book101-cross-mock" aria-hidden="true">
                <div className="book101-cross-badge">Pages101 / Classic</div>
                <div className="book101-cross-photo">M</div>
                <div className="book101-cross-name">
                  Mia <em>Rose</em>
                </div>
                <div className="book101-cross-stats">SAG-AFTRA Eligible &middot; Portrays 9-12 &middot; Atlanta</div>
                <div className="book101-cross-url">mia-rose.pages.childactor101.com</div>
              </div>
              <div>
                <h3>
                  Need a public link too? <em>Pages101</em> is the other half.
                </h3>
                <p>
                  Book101 tracks the private career data. <Link href="/">Pages101</Link> gives your actor a professional public link, the one you send to casting, agents, and industry contacts.
                </p>
                <ul>
                  <li>Headshots, resume, reels, and reps</li>
                  <li>Safe contact relay - never expose your child&apos;s info</li>
                  <li>Custom domain support</li>
                  <li>Same account. Same login. One ecosystem.</li>
                </ul>
                <Link className="book101-cross-cta" href="/">
                  See Pages101 &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="book101-pricing" id="pricing">
          <div className="book101-wrap">
            <div className="book101-sec-eyebrow">Pricing</div>
            <h2 className="book101-sec-h">
              One tool. <em>Real value.</em>
            </h2>
            <p className="book101-sec-sub book101-centered-copy">Free forever for casual tracking. Pro for the family running a real career.</p>

            <div className="book101-price-note">
              <span>Tip</span>
              <span>
                <b>Bundle deal:</b> Pages101 Plus subscribers get Book101 Pro included. Sign up for either, get both.
              </span>
            </div>

            <div className="book101-price-cards">
              <article className="book101-price-card book101-price-card-free">
                <div className="book101-price-tier">Free</div>
                <div className="book101-price-name">Book101</div>
                <div className="book101-price-num">
                  <span className="book101-price-amt">$0</span>
                  <span className="book101-price-per">forever</span>
                </div>
                <p className="book101-price-desc">Perfect for tracking your first pilot season.</p>
                <ul className="book101-price-features">
                  {freeFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <AuthAwareLink
                  signedIn={isSignedIn}
                  signedOutHref="/login"
                  signedInHref="/dashboard/career-tracker"
                  className="book101-price-cta book101-price-cta-free"
                >
                  {isSignedIn ? "Open dashboard ->" : "Start free ->"}
                </AuthAwareLink>
              </article>

              <article className="book101-price-card book101-price-card-pro">
                <div className="book101-price-tier">Pro</div>
                <div className="book101-price-name">Book101</div>
                <div className="book101-price-num">
                  <span className="book101-price-amt">$49</span>
                  <span className="book101-price-per">/ year</span>
                </div>
                <p className="book101-price-desc">For families running a real career.</p>
                <ul className="book101-price-features">
                  {proFeatures.map((feature) => (
                    <li key={feature}>{feature === "Unlimited audition entries" || feature === "Pages101 Plus included" ? <b>{feature}</b> : feature}</li>
                  ))}
                </ul>
                <AuthAwareLink
                  signedIn={isSignedIn}
                  signedOutHref="/login"
                  signedInHref="/dashboard/career-tracker"
                  className="book101-price-cta"
                >
                  {isSignedIn ? "See upgrade options ->" : "Go Pro ->"}
                </AuthAwareLink>
              </article>
            </div>
          </div>
        </section>

        <section className="book101-cta-strip">
          <div className="book101-wrap">
            <h2>
              Stop guessing. Start <em>knowing.</em>
            </h2>
            <p>Log your first audition in the next five minutes. See what a year of data looks like.</p>
            <AuthAwareLink
              signedIn={isSignedIn}
              signedOutHref="/login"
              signedInHref="/dashboard/career-tracker"
              className="book101-cta-primary book101-cta-primary-gold"
            >
              {isSignedIn ? "Open your tracker ->" : "Start tracking free ->"}
            </AuthAwareLink>
          </div>
        </section>
      </main>

      <footer className="book101-footer">
        <div className="book101-foot-links">
          <a href="https://childactor101.com">Child Actor 101</a>
          <Link href="/">Pages101</Link>
          <a href="https://resumes.childactor101.com">Resume101</a>
          <a href="https://prep101.childactor101.com">Prep101</a>
          <Link href="/login">Sign in</Link>
        </div>
        <div className="book101-foot-fine">&copy; 2026 <b>Book101</b> &middot; A Child Actor 101 product &middot; Built by a talent manager, for actor families.</div>
      </footer>
    </div>
  );
}
