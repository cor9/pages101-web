# Pages101 — Product Design Requirements & Deployment Plan

**Product:** Pages101 — actor pages for young performers, by Child Actor 101
**Owner:** Corey Ralston · **Status:** Design approved (v5 mockups) · **Date:** June 2026
**Mockup reference:** `pages101-templates-v5.html`

---

## 1. Product Summary

Pages101 lets parents of young actors build a professional, casting-ready web page for their child in under ten minutes — no design skills, no Carrd/Wix/Squarespace account, no exposed contact information. Every section ships with coaching guidance from 30 years of talent management ("101 Tips"), and the resume syncs with Resume101. Free pages carry Child Actor 101 branding and act as the top of the ecosystem funnel; the Plus tier unlocks premium templates and capabilities.

**Positioning:** "Carrd for child actors, with a talent manager built in."

### Goals
1. A parent goes from signup → published page in one sitting.
2. Every page is safe-by-default for a minor (no published contact info, no birthdates, unlisted until opted in).
3. Free pages drive ecosystem traffic (Prep101, Vendor Directory, Resume101, email list).
4. Plus tier converts on outcomes (premium templates, custom domain, capacity), not paywalled safety.
5. Low-maintenance for a solo operator: boring architecture, few moving parts.

### Non-Goals (v1)
- Page analytics (explicitly deferred by owner)
- Self-hosted video (embeds only: YouTube/Vimeo unlisted)
- Freeform drag-and-drop canvas (section reorder/toggle only)
- In-app domain *purchase* (connect-your-own only; purchase via Vercel registrar API is a v2 candidate)
- Acting as a registrar, email host, or anything else with a support tail

---

## 2. Tiers

| | **Free** | **Plus (~$49/yr)** |
|---|---|---|
| Template | Classic only | Classic + Splash + Prestige |
| Color/font customization | ✅ (all tiers) | ✅ |
| URL | `{slug}.pages.childactor101.com` | Custom domain or subdomain |
| Headshots | 6 max | Unlimited |
| Clips | 2 max | Unlimited |
| Behind-the-Scenes feed | — | ✅ |
| Sibling pages per account | 1 | Up to 4 |
| CA101 branding | Top bar + ecosystem footer (Prep101 / Vendor Directory cards) + badge | Small "Made with Pages101" credit |
| **Safety features (relay contact, noindex, age-range-only, slug moderation)** | **✅ Always — never paywalled, any tier** | **✅** |

**Policy:** Safety features are never gated by payment. This is both ethics and marketing ("Safety is always free").

**Downgrade behavior:** If Plus lapses, the page does not break. It falls back to the Classic template, free branding returns, and media beyond free limits is hidden (not deleted). Re-upgrading restores everything.

---

## 3. Templates

All three render the same data; switching templates never loses content.

| Template | Tier | Personality | Defaults |
|---|---|---|---|
| **Classic** | Free | Clean, Carrd-like, white | Outfit + Inter, Marquee Red accent |
| **Splash** | Plus | Bold, youthful, sticker/poster energy | Bricolage Grotesque + Inter, pink accent, sunshine yellow bg |
| **Prestige** | Plus | Squarespace gravitas: full-bleed hero, top nav, press quote, production stills | Cormorant Garamond + Inter, gold accent, ivory bg |

### Customization (all tiers)
- **Accent color:** preset swatches (Marquee Red, Pink, Blue, Green, Gold) + "auto" (template default). Stored as a single hex.
- **Font pairing:** Template default / Fraunces+Inter / Cormorant+Inter / Bricolage+Inter / Outfit+Inter.
- Implementation: two CSS custom properties (`--ua`, `--ud/--ub`) overriding per-template fallbacks — identical to the v5 mockup mechanism.

---

## 4. Page Sections & Data

Single-column page; sections reorder/toggle in the editor (dnd-kit sortable list).

| Section | Content | Notes |
|---|---|---|
| **Hero** | Featured headshot, name, status line, union, age range, market | Tap headshot → **slate video** modal (embed URL). Age range only — never DOB. |
| **Reps / Contact** | Agent + manager names, each `mailto:` linked | If `has_rep=false`: "Contact {Name}'s Parent" relay button + microcopy. Relay form → SES email to parent. No contact details ever rendered. |
| **Links** | Pill buttons: Instagram, Actors Access, IMDb, etc. | Resume credits live on Actors Access (industry-standard); on-page resume is supplementary. |
| **Headshots** | Photo grid, lightbox viewer | Free: 6 / Plus: unlimited. Builder tip prescribes look variety. |
| **Resume** | PDF-styled paper sheet, classic 3-column credit rows, Download PDF | **Resume101 sync:** one-click import from Resume101 data; "Synced with Resume101" strip; re-import overwrites resume section only, with confirm. |
| **Clips** | Titled embeds with category labels (Booked Work, Demo Reel, About Me, VO Reel, Singing) | Embeds only (YouTube/Vimeo unlisted). |
| **BTS Feed** (Plus) | Dated cards: text + optional photo | Builder tip enforces safety: no schools, locations, schedules. |
| **Press Quote** (Prestige) | One quote + attribution | Hidden when empty. |

### 101 Tips (builder guidance)
Contextual coaching beside every editor panel, in Corey's voice. Canonical copy (from v5 mockup):
- **Slate:** 20–30s max; name, age range, union, one fun fact.
- **Headshots:** commercial / theatrical / light theatrical / character variety.
- **Clips:** booked work, demo reel, About Me, VO reel, singing clip; lead with strongest.
- **Updates:** wins only; never school names, set locations, or schedules.
- **Resume:** Resume101 one-click import.
- **Press:** one attributed quote beats paragraphs of bio.

Tips stored as a static content map in the repo (not DB) — editable in one file.

---

## 5. Safety Requirements (non-negotiable, all tiers)

1. No email, phone, or address of a minor or parent rendered in page HTML. Rep mailtos are the reps' professional addresses; parent contact is relay-only.
2. `noindex` default ON; indexing is an explicit parent opt-in toggle.
3. Age range only; DOB is never collected for display.
4. Slug moderation: profanity + impersonation check at creation; reserved-word list.
5. Relay form: rate-limited, honeypot field, sender email verified format, body length cap; delivered via existing SES.
6. BTS feed guidance discourages location/schedule disclosure (enforced by tip copy; no automated scanning in v1).
7. No public directory of pages in v1 (a vetted, opt-in directory is a v2 discussion).

---

## 6. Architecture

**Stack:** Next.js (App Router) on Vercel · Supabase (Postgres + Auth + Storage) · Stripe · Amazon SES (existing) · dnd-kit.

**Repo:** `cor9/pages101-web` (new), Vercel team `cor9s-projects`.
**Supabase:** existing project (`omwbjwptmuvyyqsqfpbws`) with a dedicated `pages101` schema — consistent with the unified-ecosystem plan; Pages101 is the second property on shared Supabase Auth after Resume101 (Google, Apple, magic links; cookie domain `.pages.childactor101.com`).

### Routing
- Public pages: wildcard subdomain `*.pages.childactor101.com` → Next.js middleware reads host, rewrites to `/p/[slug]`.
- Custom domains (Plus): attached to the Vercel project via Domains API; middleware maps domain → slug via a `custom_domains` lookup.
- Editor/dashboard: `pages.childactor101.com` (apex of the wildcard) or `/app`.

### Rendering
- Published pages: server-rendered with on-demand revalidation on publish (`revalidateTag(slug)`). No client Supabase calls on public pages.
- Images: Supabase Storage bucket `pages101-media`, path `{user_id}/{page_id}/…`; server-side resize on upload (sharp): featured 1600px, grid 1200px, thumbs 480px; 10MB upload cap.

### Database (DDL sketch)

```sql
create schema if not exists pages101;

create table pages101.actor_pages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique
                check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) between 3 and 40),
  template      text not null default 'classic'
                check (template in ('classic','splash','prestige')),
  accent        text,            -- hex; null = template default
  font_pair     text,            -- null = template default
  display_name  text not null,
  status_line   text,
  union_status  text,
  age_range     text,            -- display string; DOB never stored for display
  market        text,
  has_rep       boolean not null default true,
  reps          jsonb  not null default '[]',  -- [{name, role, email}]
  links         jsonb  not null default '[]',  -- [{label, url}]
  slate_url     text,            -- embed URL
  published     boolean not null default false,
  noindex       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table pages101.page_sections (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages101.actor_pages(id) on delete cascade,
  type       text not null check (type in ('headshots','resume','clips','feed','press')),
  enabled    boolean not null default true,
  sort_order int not null default 0,
  content    jsonb not null default '{}'
);
create index on pages101.page_sections (page_id, sort_order);

create table pages101.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free','plus')),
  status                 text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

create table pages101.custom_domains (
  domain     text primary key,
  page_id    uuid not null references pages101.actor_pages(id) on delete cascade,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table pages101.relay_messages (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references pages101.actor_pages(id) on delete cascade,
  sender_name  text not null,
  sender_email text not null,
  body         text not null check (char_length(body) <= 2000),
  created_at   timestamptz not null default now()
);
```

**RLS:** owners full CRUD on their rows; public (anon) `select` on `actor_pages`/`page_sections` only where `published = true`; `relay_messages` insert via server route only (service role), never anon; `subscriptions` written only by the Stripe webhook (service role).

### Stripe
- One product, one yearly price (Plus). Stripe Checkout for purchase; Customer Portal for management.
- Webhook (`/api/stripe/webhook`) handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → upserts `pages101.subscriptions`.
- Entitlement check is one query (`plan = 'plus' and status = 'active'`), evaluated server-side at render and save time.

### Environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SES_REGION`, `SES_FROM_ADDRESS`, `VERCEL_API_TOKEN` (custom domains), `NEXT_PUBLIC_ROOT_DOMAIN=pages.childactor101.com`.

---

## 7. Deployment Plan

Phased so each phase ends with something shippable. Effort assumes solo nights/weekends; phases are sequential.

### Phase 0 — Infrastructure (1 weekend)
- Create repo `cor9/pages101-web`, Next.js App Router scaffold, Vercel project under `cor9s-projects`.
- DNS: add `*.pages.childactor101.com` and `pages.childactor101.com` records pointing to Vercel (wherever the domain DNS is hosted — verify current DNS provider first; Squarespace-managed DNS supports wildcard CNAME).
- Run schema migration; write RLS policies; create `pages101-media` bucket.
- Middleware: host → `/p/[slug]` rewrite, verified with two test slugs.
- **Done when:** `test.pages.childactor101.com` renders a hello page from the DB.

### Phase 1 — Auth + Editor + Classic + Publish (2–3 weekends)
- Supabase Auth wired (magic link first; Google/Apple after), session on `.pages.childactor101.com`.
- Dashboard: create page, claim slug (moderation list), edit hero/reps/links via forms.
- Section list with dnd-kit reorder + enable toggles; live preview pane.
- Classic template public renderer with accent/font variables; publish flow with on-demand revalidation; `noindex` default.
- 101 Tips content map rendered beside each editor panel.
- **Done when:** a real parent (beta tester from the community) publishes a complete Classic page unassisted.

### Phase 2 — Media + Resume + Relay + Free Branding (2 weekends)
- Headshot upload (sharp resize pipeline), grid, lightbox; featured photo + slate embed + modal.
- Clips section (embed URLs, category labels).
- Resume section renderer (paper sheet) + **Resume101 import** (one-click copy from existing resume data; re-import with confirm) + PDF download (reuse existing reportlab/Marquee pipeline or client print stylesheet — decide at build).
- Parent relay: form → server route → SES → parent email; rate limit + honeypot; `relay_messages` log.
- Free-tier branding: top bar + Prep101/Vendor Directory footer cards + badge.
- **Done when:** the full Classic page matches the v5 mockup feature-for-feature.

### Phase 3 — Stripe + Premium Templates (2 weekends)
- Stripe Checkout, webhook, Customer Portal link, `subscriptions` entitlements.
- Gating: template picker locks Splash/Prestige behind Plus; media limits enforced on free; BTS feed Plus-only; downgrade fallback behavior.
- Build Splash and Prestige renderers (port v5 CSS), press-quote section, BTS feed editor.
- **Done when:** test account can upgrade, switch to Prestige, lapse (Stripe test clock), and fall back gracefully.

### Phase 4 — Custom Domains + Launch (1–2 weekends)
- "Connect your domain": Vercel Domains API attach + verification UI + `custom_domains` mapping (Plus only).
- QA pass: mobile, accessibility (focus states, reduced motion, alt text on uploads), Lighthouse, slug-squatting check.
- Seed 3–5 real pages with willing Bohemia/community families as showcases.
- Launch: Child Actor 101 email list, Facebook community post, blog post (reuse Resume101 launch-post format), Resume101 cross-promo banner.
- **Done when:** public signup is open and the first non-seeded page publishes.

### Launch checklist
- [ ] Wildcard DNS + SSL verified on 3 slugs
- [ ] RLS verified: anon cannot read unpublished pages or any relay/subscription rows
- [ ] Stripe live keys + webhook signing verified; test purchase + refund
- [ ] SES relay deliverability tested to Gmail/Yahoo/iCloud
- [ ] noindex default confirmed in rendered HTML; opt-in toggle flips it
- [ ] Slug moderation list loaded; reserved words (admin, www, app, mail, etc.)
- [ ] Free limits enforced server-side, not just in UI
- [ ] Downgrade fallback tested with Stripe test clock
- [ ] Backup: nightly Supabase backup confirmed includes `pages101` schema

### Risks & mitigations
| Risk | Mitigation |
|---|---|
| DNS provider can't do wildcard | Verify before Phase 0; worst case move DNS to Cloudflare (free) without moving the Squarespace site |
| Resume101 data shape drift | Import maps through one adapter function; version the jsonb shape |
| Relay form abuse/spam | Rate limit by IP + page, honeypot, length cap, SES suppression list |
| Free tier abuse (non-actor spam pages) | Slug moderation + manual review queue for first N pages + report link in footer |
| Solo-operator bus factor | Boring stack, one repo, migrations in-repo, this document in the Obsidian vault |

---

## 8. Open Decisions (small, non-blocking)
1. PDF download implementation: reuse reportlab Marquee pipeline (server) vs. print stylesheet (client). Recommend reportlab for brand consistency with existing client reports.
2. Plus price point: $49/yr placeholder; validate against community willingness before Stripe setup.
3. Sibling page limit on Plus (proposed 4).
4. Whether Plus removes the footer credit entirely or keeps the whisper version (recommend keep — Squarespace precedent).
