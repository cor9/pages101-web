# Pages101 — Product Requirements Document

> **One-liner:** Free, safety-first marketing pages for young actors — built by a talent manager with 30 years in the industry.

---

## Table of Contents

- [Product Overview](#product-overview)
- [Target Audience](#target-audience)
- [Ecosystem Context](#ecosystem-context)
- [Pricing & Plans](#pricing--plans)
- [Feature Inventory](#feature-inventory)
- [Career Tracker](#career-tracker)
- [Templates & Design System](#templates--design-system)
- [Safety Model](#safety-model)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Authentication](#authentication)
- [Billing & Payments](#billing--payments)
- [Custom Domains](#custom-domains)
- [Environment Variables](#environment-variables)
- [Deployment & Infrastructure](#deployment--infrastructure)
- [Content & Copy Reference](#content--copy-reference)

---

## Product Overview

**Pages101** is a web-based page builder that lets parents and managers of child actors create casting-ready marketing pages and manage audition activity in a private dashboard. Each page showcases headshots, reels/clips, grouped resume sections, representation info, casting links, and an optional behind-the-scenes updates feed — all behind a safety-first architecture that never exposes a child's personal contact info, exact birthdate, or location data.

**Tagline:** *"The Free 10-Minute Marketing Page for Young Actors"*

**Subtitle:** *"Built with Industry Experience. Safe-by-default. Showcase headshots, reels, clips, resume, important links, contact info and a curated newsfeed in a stunning casting-ready web page."*

**Domain:** `pages.childactor101.com`  
**Public page URLs:** `pages.childactor101.com/p/{slug}` (or custom domain)

---

## Target Audience

| Persona | Description |
|---|---|
| **Stage Parents** | Parents managing one or more child actors who need a professional web presence for auditions and casting submissions |
| **Talent Managers** | Managers representing multiple young performers who need quick, branded pages per client |
| **Young Actors (via parents)** | The child performers themselves — the pages represent them, but parents/guardians control the account |

---

## Ecosystem Context

Pages101 is part of the **Child Actor 101** family of tools:

| Product | Domain | Purpose |
|---|---|---|
| **Child Actor 101** | `childactor101.com` | Main site — articles, resources, community |
| **Resume101** | `resumes.childactor101.com` | Resume builder for young actors (Airtable-backed) |
| **Pages101** | `pages.childactor101.com` | Marketing page builder (this product) |

**Resume101 Integration:** Pages101 has one-click import from Resume101 via Airtable-backed data. The import preserves grouped resume sections (Television, Film, Theatre, Commercial, New Media, Voiceover) plus Training and Special Skills. Re-sync is manual by clicking Import again. If the user has not built a resume yet, the editor links them directly to Resume101 to create one first.

---

## Pricing & Plans

### Free — Classic ($0/forever)

| Feature | Limit |
|---|---|
| Templates | Classic only |
| Performer pages | 1 |
| Headshot uploads | 3 |
| Video clip links | 2 |
| Custom accent colors | ✓ |
| Custom font pairings | ✓ |
| Safety controls (relay, noindex) | ✓ |
| Resume101 import / re-import | ✓ |
| Career Tracker | Up to 5 auditions |
| Custom domains | ✗ |
| Behind-the-Scenes feed | ✗ |
| Press quote section | ✗ |

### Plus ($49/year) — Recommended

| Feature | Limit |
|---|---|
| Templates | Classic + Splash + Prestige |
| Performer pages | Up to 4 (sibling support) |
| Headshot uploads | Unlimited |
| Video clip links | Unlimited |
| Custom accent colors | ✓ |
| Custom font pairings | ✓ |
| Background color control | ✓ |
| Safety controls (relay, noindex) | ✓ |
| Resume101 import / re-import | ✓ |
| Career Tracker | Unlimited auditions |
| Custom domains | ✓ (1 per page) |
| Behind-the-Scenes feed | ✓ |
| Press quote section | ✓ (Prestige template) |
| Pages101 credit | Minimal (no ads) |

Implementation note: the current product supports manual Resume101 re-import rather than invisible background sync.

**Billing:** Stripe Payment Link → `https://buy.stripe.com/...`  
**Subscription management:** Stripe Customer Portal via `/api/stripe/portal`

---

## Feature Inventory

### Page Builder (Editor)

The editor is a full-featured, real-time page builder with autosave (700ms debounce), live preview, and drag-and-drop section reordering.

#### Editor Panels (in order):

| # | Panel | Description |
|---|---|---|
| 1 | **Page Setup** | Performer name, safe URL slug, noindex toggle, status line, union status, age range, market |
| 2 | **Representation & Contact** | Toggle for "Represented by agent/manager" — add reps (Name, Role, Email). If no rep, parent relay is used |
| 3 | **Casting Links** | Button label + URL pairs (e.g., "Actors Access" → URL) |
| 4 | **Template & Style** | Template picker, accent color swatches, background color swatches, font pair dropdown |
| 5 | **Custom Domain** | Connect/verify/remove a custom domain (Plus only) |
| 6 | **Headshots** | Upload photos, per-headshot controls (crop focus, set featured, remove) |
| 7 | **Slate, Clips & Reels** | Slate video URL, clip entries with title/category/URL |
| 8 | **Resume** | Resume101 one-click import, Resume101 CTA for empty states, PDF/DOC upload, manual credit entry |
| 9 | **Updates Feed** | Date + body (280 char max) — Plus only |
| 10 | **Press Quote** | Quote text + attribution — Prestige template only |
| 11 | **Account** | Auth controls, plan badge, upgrade bar |
| 12 | **Sections** | Drag-and-drop reorder, enable/disable toggle per section |

#### 101 Manager Tips

Professional coaching guidance appears beside every builder field:

- **Slate:** "Keep it 20–30 seconds: name, age range, union status, and one fun fact."
- **Headshots:** "Show range: commercial, theatrical, light theatrical, and one character look."
- **Clips:** "Lead with the strongest clip. Booked work, demo reel, About Me, VO reel, and singing all work."
- **Updates:** "Wins only. Never include school names, set locations, schedules, or anything that helps someone track your child."
- **Resume:** "Use Resume101 one-click import so the page and actor resume stay consistent."
- **Press:** "One attributed quote is stronger than paragraphs of bio."

#### Resume Panel Behavior

- **Resume101 import is always available** — even if a PDF/DOC resume file is already attached
- **Resume document upload coexists with structured resume data** — users can keep a downloadable file and imported/manual credits on the same page
- **Empty resume state includes Resume101 CTA** — if the page has no uploaded resume file and no structured resume data, the editor shows a direct link to `resumes.childactor101.com`
- **Resume101 import preserves structure** — Pages101 stores grouped resume sections plus Training and Special Skills instead of flattening everything into one undifferentiated credits list

#### Clip Categories

- Booked Work
- Demo Reel
- About Me
- VO Reel
- Singing

#### Upload Limits

| Asset | Free | Plus |
|---|---|---|
| Headshot images | 3 max | Unlimited |
| Video clip links | 2 max | Unlimited |
| Per-file size limit | 10 MB | 10 MB |
| Resume document | 10 MB (.pdf/.doc/.docx) | 10 MB (.pdf/.doc/.docx) |

### Account Dashboard

The dashboard (`/dashboard`) is the logged-in home screen:

- **Performer pages list** — cards showing name, slug, template, published/draft status, custom domain, last updated
- **Add Performer** — form with name + slug input (enforces plan limits)
- **Edit / View / Delete** actions per page
- **Subscription panel** — current plan, usage progress bar, upgrade upsell or "Manage Subscription" button
- **Promo / Beta code redemption** — redeem codes that unlock Plus access without Stripe checkout
- **Career Tracker entry point** — dedicated dashboard flow for auditions, callbacks, avail checks, and bookings
- **Safety & Standards box** — "We never expose your child's phone number or personal email address, and exact dates of birth are never stored."

### Published Resume Display

- Public pages render imported resume sections by category heading (for example: Television, Theatre, Commercial)
- Public pages render Training and Special Skills when present in Resume101 data
- Public pages do **not** display a visible "Synced with Resume101" marketing banner or last-updated sync copy

---

## Career Tracker

Pages101 includes a private audition-tracking dashboard at `/dashboard/career-tracker`.

### Current Scope

- Track auditions per performer page
- Store project, role, casting contact, project type, role size, audition date, format, audition stage, outcome, source, and notes
- Show current-year stats for auditions, callbacks, avail checks, bookings, callback rate, and booking rate
- Surface ecosystem prep links for Reader101 and Prep101 from relevant audition entries
- Support create, edit, and delete via authenticated API routes

### Plan Limits

| Plan | Limit |
|---|---|
| Free | 5 total auditions |
| Plus | Unlimited |

### Audition Taxonomy

- **Project types:** Film, TV, Commercial, Theater, Voiceover, Industrial, Student Film, New Media, Print, Other
- **Role sizes:** Series Regular, Recurring, Guest Star, Co-Star, Lead, Supporting, Principal, Featured, Background, Ensemble, Other
- **Formats:** Self Tape, In Person, Virtual
- **Stages:** Initial, Callback, Producer Session, Chemistry Read, Work Session, Final Callback, Network Test
- **Outcomes:** Pending, Callback, Avail Check, Booked, Released, No Word
- **Received from:** Self Submit, Agency, Management, CD Direct, Other

### Default Sections (on new page creation)

| Section | Enabled | Sort Order |
|---|---|---|
| Headshots | ✓ | 10 |
| Resume | ✓ | 20 |
| Clips | ✓ | 30 |
| Feed | ✗ | 40 |
| Press | ✗ | 50 |

---

## Templates & Design System

### Classic (Free)

| Property | Value |
|---|---|
| Personality | Clean, casting-ready, Carrd-like |
| Default Accent | `#C8553D` (Marquee Red) |
| Default Background | `#FFFFFF` (White) |
| Display Font | Outfit |
| Body Font | Inter |

### Splash (Plus)

| Property | Value |
|---|---|
| Personality | Bold, youthful, poster energy |
| Default Accent | `#FF4D8D` (Pink) |
| Default Background | `#FFDE59` (Sunshine Yellow) |
| Display Font | Bricolage Grotesque |
| Body Font | Inter |

### Prestige (Plus)

| Property | Value |
|---|---|
| Personality | Full-bleed, editorial, Squarespace gravitas |
| Default Accent | `#8A6F47` (Gold) |
| Default Background | `#FAF8F4` (Ivory) |
| Display Font | Cormorant Garamond |
| Body Font | Inter |

### Accent Color Swatches

| Name | Hex |
|---|---|
| Auto | (template default) |
| Marquee Red | `#C8553D` |
| Pink | `#FF4D8D` |
| Blue | `#2368D8` |
| Green | `#268060` |
| Gold | `#A97725` |

### Background Color Swatches (Splash & Prestige only)

Auto, White, Ivory, Sand, Blush, Sunshine

### Font Pair Options

| Option | Display Font | Body Font |
|---|---|---|
| Template Default | (per template) | (per template) |
| Fraunces + Inter | Fraunces | Inter |
| Cormorant + Inter | Cormorant Garamond | Inter |
| Bricolage + Inter | Bricolage Grotesque | Inter |
| Outfit + Inter | Outfit | Inter |

---

## Safety Model

> [!IMPORTANT]
> Safety is the core product differentiator. Every design decision defaults to protecting the child.

| Protection | Implementation |
|---|---|
| **No personal contact info exposed** | Phone numbers and personal emails are never displayed on pages. All contact goes through the relay |
| **Email relay** | Contact form on public pages routes through AWS SES. Parent's email stays private. Messages stored in `p101_relay_messages` |
| **No exact birthdates** | Only age ranges are stored and displayed (e.g., "8–10") — DOB is never collected |
| **Search unlisted by default** | `noindex` is `true` by default on all pages. Parents must explicitly opt in to search indexing |
| **No location data** | Updates feed warns: "Never include school names, set locations, schedules, or anything that helps someone track your child" |
| **Slug validation** | Reserved slugs are blocked. Profanity filter applied. Regex enforced: `^[a-z0-9](-?[a-z0-9])*$`, 3–40 chars |

### Reserved Slugs (blocked)

`admin`, `administrator`, `www`, `app`, `api`, `mail`, `email`, `pages`, `page`, `login`, `logout`, `signup`, `signin`, `register`, `dashboard`, `account`, `settings`, `billing`, `stripe`, `checkout`, `help`, `support`, `contact`, `abuse`, `security`, `legal`, `privacy`, `terms`, `assets`, `static`, `cdn`, `img`, `media`, `files`, `test`, `demo`, `staging`, `dev`, `root`, `status`, `blog`, `store`, `shop`, `news`, `about`, `home`, `index`, `childactor101`, `ca101`, `prep101`, `resume101`, `pages101`, `vault`, `official`, `verify`, `verified`

---

## Tech Stack

### Core

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.3.3 |
| Language | TypeScript | 5.8.3 |
| UI | React | 19.1.0 |
| Styling | Vanilla CSS (`globals.css`) | — |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (Magic Links) | — |
| Payments | Stripe (Payment Links + Webhooks) | SDK v18.2.1 |
| Email | AWS SES | SDK v3.1069.0 |
| Hosting | Vercel | — |
| Storage | Supabase Storage (`pages101-media` bucket) | — |

### Key Dependencies

| Package | Purpose |
|---|---|
| `@supabase/ssr` | Server-side Supabase client |
| `@supabase/supabase-js` | Supabase JavaScript client |
| `stripe` | Stripe SDK for webhooks & portal |
| `@aws-sdk/client-ses` | AWS SES for email relay |
| `@dnd-kit/core` + `sortable` + `utilities` | Drag-and-drop section reordering |
| `pdfjs-dist` | PDF rendering for resume preview |
| `sharp` | Image processing / optimization |
| `zod` | Schema validation |
| `clsx` | CSS class composition |

---

## Database Schema

The current implementation is split across legacy `pages101.*` relations and app-facing `public.p101_*` relations. The dashboard and API routes interact with the `p101_*` tables exposed to Supabase clients.

### `p101_actor_pages`

The core table — one row per performer page.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` FK → `auth.users` | `ON DELETE CASCADE` |
| `slug` | `text` UNIQUE | regex `^[a-z0-9](-?[a-z0-9])*$`, 3–40 chars |
| `template` | `text` | CHECK in `('classic','splash','prestige')`, default `'classic'` |
| `accent` | `text` | nullable, hex color `^#[0-9A-Fa-f]{6}$` |
| `background` | `text` | nullable, hex color |
| `font_pair` | `text` | nullable, CHECK in `('template','fraunces-inter','cormorant-inter','bricolage-inter','outfit-inter')` |
| `display_name` | `text` NOT NULL | 1–80 chars |
| `status_line` | `text` | nullable, ≤ 160 chars |
| `union_status` | `text` | nullable, ≤ 40 chars |
| `age_range` | `text` | nullable, ≤ 20 chars |
| `market` | `text` | nullable, ≤ 60 chars |
| `has_rep` | `boolean` | default `true` |
| `reps` | `jsonb` | default `'[]'` — array of `{name, role, email}` |
| `links` | `jsonb` | default `'[]'` — array of `{label, url}` |
| `slate_url` | `text` | nullable (YouTube/Vimeo) |
| `published` | `boolean` | default `false` |
| `noindex` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | auto-updated via trigger |

### `p101_page_sections`

Section content for each page. One row per section type per page.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | |
| `page_id` | `uuid` FK → `actor_pages` | `ON DELETE CASCADE` |
| `type` | `text` | CHECK in `('headshots','resume','clips','feed','press')` |
| `enabled` | `boolean` | default `true` |
| `sort_order` | `int` | default `0` |
| `content` | `jsonb` | default `'{}'` — type-specific content blob |
| | UNIQUE | `(page_id, type)` |

### `p101_subscriptions`

One row per user. Managed by Stripe webhooks.

| Column | Type | Constraints |
|---|---|---|
| `user_id` | `uuid` PK FK → `auth.users` | `ON DELETE CASCADE` |
| `stripe_customer_id` | `text` | |
| `stripe_subscription_id` | `text` | |
| `plan` | `text` | CHECK in `('free','plus')`, default `'free'` |
| `status` | `text` | Stripe status string |
| `current_period_end` | `timestamptz` | |
| `updated_at` | `timestamptz` | auto-updated via trigger |

### `p101_custom_domains`

Custom domain mappings. One domain per page.

| Column | Type | Constraints |
|---|---|---|
| `domain` | `text` PK | valid domain regex |
| `page_id` | `uuid` FK → `actor_pages` | `ON DELETE CASCADE` |
| `verified` | `boolean` | default `false` |
| `created_at` | `timestamptz` | default `now()` |

### `p101_relay_messages`

Contact form submissions from public pages. Inserted via service role only.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | |
| `page_id` | `uuid` FK → `actor_pages` | `ON DELETE CASCADE` |
| `sender_name` | `text` | 1–120 chars |
| `sender_email` | `text` | ≤ 254 chars |
| `body` | `text` | 1–2,000 chars |
| `created_at` | `timestamptz` | default `now()` |

### `p101_auditions`

Private audition-tracker records tied to a user and a performer page.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` FK → `auth.users` | `ON DELETE CASCADE` |
| `page_id` | `uuid` FK → `p101_actor_pages` | `ON DELETE CASCADE` |
| `project` | `text` NOT NULL | |
| `role` | `text` | nullable |
| `casting_contact` | `text` | nullable |
| `project_type` | `text` | enum-like check |
| `role_size` | `text` | enum-like check |
| `audition_date` | `date` | nullable |
| `format` | `text` | enum-like check |
| `audition_stage` | `text` | enum-like check |
| `outcome` | `text` | enum-like check |
| `received_from` | `text` | enum-like check |
| `received_from_detail` | `text` | nullable |
| `notes` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | auto-updated via trigger |

### `p101_promo_codes`

Codes that grant plan access without direct checkout.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` UNIQUE | uppercase normalized |
| `label` | `text` | nullable |
| `description` | `text` | nullable |
| `plan` | `text` | check in `('free','plus')` |
| `status` | `text` | check in `('active','inactive')` |
| `duration_days` | `integer` | nullable |
| `max_redemptions` | `integer` | nullable |
| `redemptions_count` | `integer` | default `0` |
| `starts_at` | `timestamptz` | nullable |
| `expires_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | auto-updated via trigger |

### `p101_promo_redemptions`

Audit trail of who redeemed which code.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` PK | |
| `promo_code_id` | `uuid` FK → `p101_promo_codes` | `ON DELETE CASCADE` |
| `user_id` | `uuid` FK → `auth.users` | `ON DELETE CASCADE` |
| `code` | `text` | |
| `granted_plan` | `text` | check in `('free','plus')` |
| `granted_duration_days` | `integer` | nullable |
| `redeemed_at` | `timestamptz` | default `now()` |

### `pages101.reserved_slugs`

Lookup table of blocked slug values. Enforced by DB trigger.

### Database Triggers

| Trigger | Effect |
|---|---|
| `actor_pages_updated_at` | Auto-set `updated_at` on row update |
| `subscriptions_updated_at` | Auto-set `updated_at` on row update |
| `actor_pages_slug_reserved` | Reject inserts/updates using reserved slugs |
| `actor_pages_enforce_free_limits` | Block free users from using `splash`/`prestige` templates |
| `page_sections_enforce_free_limits` | Enforce headshot limit (3) and clip limit (2) for free users |
| `p101_auditions_enforce_free_limit` | Enforce free career-tracker limit of 5 auditions |

### Row-Level Security (RLS)

| Table | Policy |
|---|---|
| `actor_pages` | Owner full CRUD; public read on `published = true` |
| `page_sections` | Owner full CRUD; public read on published pages |
| `subscriptions` | Owner read-only (writes via service role / webhooks) |
| `custom_domains` | Owner read + manage |
| `relay_messages` | Owner read-only (inserts via service role) |
| `auditions` | Owner full CRUD only |
| `promo_redemptions` | Owner read-only |
| `reserved_slugs` | Public read |

### Storage

- **Bucket:** `pages101-media` (public read)
- **Path format:** `{user_id}/{page_id}/{uuid}-{filename}`
- **RLS:** Insert/update/delete requires `folder[1] = auth.uid()`

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/webhook` | POST | Stripe webhook receiver — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| `/api/stripe/portal` | POST | Creates a Stripe Customer Portal session for subscription management |
| `/api/relay` | POST | Contact relay — receives messages from public pages, sends via AWS SES |
| `/api/auth/send-email` | POST | Sends emails via AWS SES |
| `/api/domains/connect` | POST | Attach a custom domain to a page (Plus only) |
| `/api/domains/verify` | POST | Verify custom domain DNS configuration |
| `/api/domains/status` | GET | Check domain verification status |
| `/api/custom-domains` | DELETE | Detach a custom domain |
| `/api/resume101/import` | POST | Import grouped resume data from Resume101 (Airtable backend) |
| `/api/career-tracker` | GET | Load private audition tracker data, performers, and subscription state |
| `/api/career-tracker` | POST | Create an audition entry (free limit 5, Plus unlimited) |
| `/api/career-tracker/[auditionId]` | PATCH | Update an audition entry |
| `/api/career-tracker/[auditionId]` | DELETE | Delete an audition entry |
| `/api/promo/redeem` | POST | Redeem a promo or beta code and update subscription state |
| `/api/debug-domain` | GET | Debug route for domain lookups (dev) |
| `/auth/callback` | GET | Magic link callback handler |
| `/auth/confirm` | GET | Email confirmation handler |

---

## Authentication

| Method | Details |
|---|---|
| **Primary** | Magic link (passwordless OTP via Supabase Auth) |
| **Rate limiting** | Cooldown timer on magic link requests in the UI |
| **Email guidance** | Success state tells users to check spam if the magic link is not visible |
| **Session** | Supabase SSR cookies |
| **Protected routes** | `/dashboard` redirects to `/` if not authenticated |

---

## Billing & Payments

### Flow

```
User clicks "Upgrade for $49/year"
  → window.location.href = NEXT_PUBLIC_STRIPE_PAYMENT_LINK
    → Stripe hosted checkout
      → Stripe webhook fires checkout.session.completed
        → /api/stripe/webhook upserts p101_subscriptions (plan: "plus")
          → User refreshes dashboard → sees Plus features
```

### Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Create/update subscription → `plan: "plus"` |
| `customer.subscription.updated` | Update plan based on status (`active`/`trialing` → `"plus"`, else `"free"`) |
| `customer.subscription.deleted` | Set `plan: "free"`, `status: "canceled"` |

### Subscription Management

- Plus users get a "Manage Subscription" button → POST `/api/stripe/portal` → Stripe Customer Portal URL

### Stripe API Version

`2025-08-27.basil`

---

## Custom Domains

### Flow

1. User enters a domain in the editor (Plus only)
2. POST `/api/domains/connect` — registers domain with Vercel + creates `p101_custom_domains` row
3. User adds CNAME record pointing to `cname.vercel-dns.com`
4. POST `/api/domains/verify` — checks DNS and marks `verified = true`
5. Middleware detects non-platform hostnames, queries `p101_custom_domains` for a verified match, and rewrites to `/p/{slug}`

### Middleware Logic (`src/middleware.ts`)

1. Extract `host` header, strip port, lowercase
2. **Skip** (pass through) for: `pages.childactor101.com`, `localhost`, `127.0.0.1`, `*.vercel.app`
3. For custom domains: query `p101_custom_domains` (via Supabase REST) for `domain = host` AND `verified = true`
4. If found: **rewrite** request to `/p/{slug}` (URL stays as the custom domain)
5. Uses `SUPABASE_SERVICE_ROLE_KEY` for the REST query

---

## Environment Variables

### Required

| Variable | Context | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (middleware, webhooks) |
| `STRIPE_SECRET_KEY` | Server | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Server | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | Public | Stripe Payment Link URL for upgrades |

### Optional / Feature-Specific

| Variable | Context | Purpose |
|---|---|---|
| `VERCEL_PROJECT_ID` | Server | Vercel project ID for custom domain API |
| `VERCEL_API_TOKEN` | Server | Vercel API token for custom domain management |
| `SES_REGION` / `AWS_REGION` | Server | AWS region for SES email relay |
| `AIRTABLE_API_KEY` | Server | Airtable API key for Resume101 import |
| `AIRTABLE_BASE_ID` | Server | Airtable base ID for Resume101 |
| `AIRTABLE_TABLE_NAME` | Server | Primary Airtable table name / ID for Resume101 imports |
| `AIRTABLE_CREDITS_TABLE` | Server | Optional legacy alias for the Airtable table name |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Public | Root Pages101 domain used in generated URLs and auth redirects |
| `NEXT_PUBLIC_PAGES101_BETA_FULL_ACCESS` | Public | Feature flag — if not "0", enables Plus features in dev |

---

## Deployment & Infrastructure

| Component | Provider | Details |
|---|---|---|
| Hosting | Vercel | Next.js App Router, edge middleware |
| Database | Supabase | PostgreSQL with RLS, custom `pages101` schema |
| Auth | Supabase Auth | Magic link OTP |
| Storage | Supabase Storage | `pages101-media` bucket, public read |
| Payments | Stripe | Payment Links + Webhooks + Customer Portal |
| Email | AWS SES | Contact relay, transactional emails |
| Resume Data | Airtable | Resume101 backend; imports support either direct credit rows or Resume101 `RESUME JSON` records |
| Promo Access | PostgreSQL + RPC | Promo code redemption updates subscription state without Stripe checkout |
| DNS | Vercel DNS | Custom domain CNAME targets |

---

## Content & Copy Reference

### Landing Page Sections

1. **Nav Header** — Links to Child Actor 101 ecosystem and Resume101
2. **Hero** — "The Free 10-Minute Marketing Page for Young Actors" + CTA
3. **Social Proof** — "Built by a talent manager with 30 years in the industry."
4. **Features Grid** (4 cards):
   - 101 Manager Tips
   - Resume101 Integration
   - Career Tracker
   - Safety-First by Default
5. **Interactive Template Previewer** — Tabbed switcher with scrollable browser mockup screenshots of Classic, Splash, and Prestige
6. **Pricing Comparison** — Free vs Plus tier table
7. **Integrated Login Card** — Magic link email input with cooldown timer

### Key Marketing Messages

- *"The promotional page your child's team actually wants to use."*
- *"Hides personal contact info and exact birthdates."*
- *"Parent messages relayed securely via email form."*
- *"Pages unlisted from Google search unless opted in."*
- *"Import all credits from Resume101 with a single click."*
- *"Need a resume first? Build it on Resume101, then come back here and import your credits."*
- *"Track auditions, callbacks, avail checks, and bookings in one private dashboard."*

---

## Type System Reference

```typescript
type Plan = "free" | "plus"
type TemplateId = "classic" | "splash" | "prestige"
type FontPair = "template" | "fraunces-inter" | "cormorant-inter" | "bricolage-inter" | "outfit-inter"
type SectionType = "headshots" | "resume" | "clips" | "feed" | "press"

interface Rep { name: string; role: "agent" | "manager"; email: string }
interface Clip { id: string; title: string; category: string; embedUrl: string }
interface FeedItem { id: string; date: string; title: string; body: string; image?: string }
interface PressQuote { quote: string; attribution: string }
interface Headshot { id: string; src: string; alt: string; label: string; featured?: boolean; focus?: string }
interface ResumeCredit { project: string; role: string; company: string }
interface ResumeCreditGroup { title: string; credits: ResumeCredit[] }
interface ResumeTraining { class: string; instructor: string; location: string }
interface ResumeSection {
  syncedWithResume101: boolean
  updatedAt: string
  credits: ResumeCredit[]
  groups?: ResumeCreditGroup[]
  training?: ResumeTraining[]
  skills?: string
  fileUrl?: string
  fileName?: string
}
interface AuditionRecord {
  id: string
  page_id: string
  project: string
  role: string | null
  casting_contact: string | null
  project_type: string | null
  role_size: string | null
  audition_date: string | null
  format: string | null
  audition_stage: string | null
  outcome: string | null
  received_from: string | null
  received_from_detail: string | null
  notes: string | null
}
```

---

*Last updated: June 2026*
