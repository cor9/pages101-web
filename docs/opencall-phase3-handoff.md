# Open Call — Phase 3 Handoff

This document captures the state of the Open Call feature after Phase 3 completion. It is the authoritative reference for Phase 4 implementation.

---

## What was built

Phase 3 built the representative-access layer across two repositories. pages101-web gained admin invite management routes and UI. talentsearch received a full rep-access layer: token redemption, session signing, gallery, favorites, introductions, and access logging.

Both repositories are merged to `main` and deployed to production.

- **pages101-web branch:** `opencall-schema-hardening`
- **talentsearch branch:** `opencall-rep-access`
- **pages101-web preview:** `https://pages101-5byutsbai-cor9s-projects.vercel.app`
- **talentsearch preview:** `https://talentsearch-k21dhp5mv-cor9s-projects.vercel.app`

---

## Database schema additions

Two new tables. All live in the `public` schema on Supabase project `gouasbcszvehhqybevsc` (us-east-2).

### `p101_opencall_rep_favorites`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `invite_id` | uuid FK → rep_invites NOT NULL | |
| `event_id` | uuid FK → events NOT NULL | |
| `application_id` | uuid FK → applications NOT NULL | on delete cascade |
| `created_at` | timestamptz NOT NULL | |

**Unique constraint:** `(invite_id, application_id)`

No RLS — `anon` and `authenticated` roles have all privileges revoked. Service role only.

### `p101_opencall_intro_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events NOT NULL | |
| `invite_id` | uuid FK → rep_invites NOT NULL | |
| `application_id` | uuid FK → applications NOT NULL | on delete restrict |
| `status` | text NOT NULL | `pending / sent / partial_failure / failed` |
| `requested_at` | timestamptz NOT NULL | |
| `guardian_email_sent_at` | timestamptz | nullable |
| `rep_email_sent_at` | timestamptz | nullable |
| `failed_at` | timestamptz | nullable |
| `failure_code` | text | nullable; max 120 chars |
| `requester_name` | text NOT NULL | collected from form; pre-filled from invite |
| `requester_email` | text NOT NULL | used as Reply-To on guardian notification |
| `requester_role` | text | nullable |
| `requester_message` | text | nullable |

**Unique constraint:** `(invite_id, application_id)` — idempotent: second request returns the existing row.

Guardian contact (email, phone) is NOT stored here; it is resolved at send time from the application row using the service role.

No RLS — service role only.

### `p101_opencall_access_log` — amended action list

The action allowlist was extended. Full list as of Phase 3:

`session_start`, `invite_redeemed`, `access_denied`, `view_application`, `reveal_guardian_contact`, `favorite_application`, `unfavorite_application`, `invite_revoked`, `request_introduction`

Actions that may omit `application_id`: `session_start`, `invite_redeemed`, `access_denied`, `invite_revoked`.

### `p101_opencall_rep_invites` — confirmed live schema

> No structural changes in Phase 3. Columns verified against live DB.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events NOT NULL | |
| `rep_name` | text NOT NULL | |
| `rep_email` | text NOT NULL | |
| `rep_agency` | text | nullable |
| `token_hash` | text UNIQUE NOT NULL | sha256(raw_token) |
| `expires_at` | timestamptz NOT NULL | |
| `revoked_at` | timestamptz | nullable; set on revocation |
| `redeemed_at` | timestamptz | nullable; set on FIRST redemption only |
| `last_access` | timestamptz | nullable; updated on every valid redemption |
| `created_at` | timestamptz NOT NULL | |

---

## Admin routes (pages101-web)

All under `src/app/api/opencall/admin/`. Every route calls `requireAdminAuth(request)` which:

1. Extracts Bearer token from `Authorization` header
2. Calls `serviceClient.auth.getUser(token)` to verify identity
3. Checks `user.email` against `ADMIN_EMAILS` env var (comma-separated server-only list)
4. Returns 401 if no token or invalid; 403 if valid user but not an admin

### `GET /api/opencall/admin/reps`

Lists all rep invites for the active event, ordered by `created_at` descending.

### `POST /api/opencall/admin/reps`

Creates a new rep invite.

Body: `{ event_id, rep_name, rep_email, rep_agency?, expires_at? }`

Flow:
1. Generates 32 random bytes → `base64url` raw token
2. Computes `sha256(rawToken)` → `token_hash`
3. Inserts into `p101_opencall_rep_invites` (only hash stored)
4. Builds invite URL: `TALENTSEARCH_BASE_URL/access?t=<encodeURIComponent(rawToken)>`
5. Attempts email via AWS SES; if SES fails, still returns `{invite, inviteUrl}` so admin can share the link manually

The raw token appears in the response body once and is never stored. It is not logged.

### `GET /api/opencall/admin/reps/[id]`

Returns full invite detail including favorites, intro requests, and access log (last 50 entries) for that invite.

### `POST /api/opencall/admin/reps/[id]/revoke`

Idempotent revocation. Sets `revoked_at = now()` if not already set, then logs `invite_revoked` to `p101_opencall_access_log`. Returns `{revoked: true}`.

---

## Rep-access layer (talentsearch)

### Token redemption — `GET /access?t=<raw-token>`

1. Hash raw token with SHA-256
2. `findInviteByHash(tokenHash)` — PostgREST lookup by `token_hash`
3. Returns `/denied?r=unknown` if not found
4. Returns `/denied?r=revoked` if `revoked_at IS NOT NULL`
5. Returns `/denied?r=expired` if `expires_at <= now()`
6. On success:
   - Sets `redeemed_at` if this is the first redemption (`redeemed_at IS NULL`)
   - Updates `last_access = now()` on every redemption
   - Logs `invite_redeemed` to access log
   - Computes session TTL = min(8 hours, invite.expires_at, event.review_close)
   - Signs HMAC-SHA256 session cookie (`__rep`, HttpOnly, Secure in production)
   - Redirects to `/` (token removed from URL)

**Access model:** Invite links may be shared within an office. A valid invite may be redeemed any number of times while active. `redeemed_at` records only the first redemption. Each redemption creates a fresh short-lived session.

### Session signing — `lib/session.js`

Format: `base64url(JSON_payload) + "." + base64url(HMAC-SHA256_signature)`

Signing secret: `TALENTSEARCH_SESSION_SECRET` env var (server-only; never client-visible).

Session payload fields:

| Key | Description |
|---|---|
| `iid` | invite id |
| `eid` | event id |
| `rn` | rep_name |
| `ra` | rep_agency |
| `exp` | Unix timestamp (seconds) — cookie expiry |

Cookie name: `__rep` — `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production. Not readable by JavaScript.

### Middleware — `middleware.js`

Runs on all page routes except `/access` and `/denied`. Verifies HMAC signature and `exp` field only (no Supabase round-trip). If invalid or expired, clears the cookie and redirects to `/denied?r=expired` or `/denied?r=invalid`.

`/api/rep/*` routes bypass middleware entirely — they perform their own full Supabase revocation check in each handler.

### Gallery page — `app/page.js`

Server component. On every render:

1. Reads `__rep` cookie, calls `verifySession()`
2. Calls `findInviteById(session.iid)` — Supabase round-trip
3. Checks `revoked_at IS NULL` and `expires_at > now()`
4. Verifies `invite.event_id === session.eid`
5. Checks event `review_close > now()` and `status IN ('reviewing','open','closed')`
6. Redirects to `/denied?r=revoked` or `/denied?r=expired` on failure
7. Queries submitted applications for the event — `guardian_name`, `guardian_email`, `guardian_phone` are excluded from the SELECT
8. Passes `sessionInfo: {repName, repAgency, exp}` to `TalentGallery`

### `RepSessionBanner` — `components/TalentGallery.jsx` (lines 155–167)

Shows "Access through **[agency or name]**" using `repAgency || repName`. Does not identify the individual invite recipient — shows the office/access link identity.

### Favorites — `app/api/rep/favorites/[applicationId]/route.js`

`POST` adds a favorite; `DELETE` removes it.

Every request calls `getVerifiedSession()` which:
1. Reads `__rep` cookie, calls `verifySession()`
2. Calls `findInviteById(session.iid)` — checks `revoked_at`, `expires_at`, `event_id`
3. Calls `findEventById(session.eid)` — checks `review_close`, `status`
4. Verifies `applicationId` (from URL) belongs to `session.eid`

Identity (invite_id, event_id) always comes from the session. Client-supplied invite IDs and event IDs are ignored.

Idempotency: `addFavorite` upserts with `?on_conflict=invite_id,application_id` (URL query param — PostgREST ignores the header form). Duplicate adds return 200 silently.

**Bug found and fixed in Phase 3 audit:** `dbInsert` in `lib/supabase-p101.js` was passing `on-conflict` as a request header, which PostgREST ignores. Fixed to use `?on_conflict=` URL query parameter. Previously, duplicate favorites returned 500; now they return 200.

### Introduction requests — `app/api/rep/intro/[applicationId]/route.js`

`POST` submits a request introduction.

Body: `{ requesterName, requesterEmail, requesterRole?, requesterMessage? }`

Identity and scope are derived from the session, not the request body. The `applicationId` in the URL is verified against `session.eid`.

Idempotency: `getIntroRequest(session.iid, applicationId)` is checked before creating. A second request returns `{ok: true, status: "failed", existing: true}` without inserting or sending email.

Email flow:
1. Loads application via service role — includes `guardian_name`, `guardian_email`
2. Sends guardian notification via AWS SES
3. Sends requester confirmation via AWS SES
4. Updates `intro_requests` row with delivery state (`sent`, `partial_failure`, `failed`)

Guardian email address is never included in any response body. `sanitizeEmailError()` redacts email addresses from SES error messages before logging.

### Supabase helper — `lib/supabase-p101.js`

Raw PostgREST fetch client for the Pages101 Supabase project. Uses the service-role key from `SUPABASE_SERVICE_ROLE_KEY`. Never imported in client components.

Key functions: `findInviteByHash`, `findInviteById`, `findEventById`, `findApplicationForRep`, `setInviteRedeemed`, `logAccess`, `getFavorites`, `addFavorite`, `removeFavorite`, `getIntroRequest`, `createIntroRequest`, `updateIntroRequest`.

---

## Security properties

All verified during the Phase 3 audit.

| Property | Mechanism |
|---|---|
| Service-role key server-side only | `lib/supabase-p101.js` is server-only; never imported in client components |
| Session secret server-side only | `TALENTSEARCH_SESSION_SECRET` — only read in `lib/session.js` (server) |
| Raw token never stored | Only `sha256(rawToken)` is stored; raw token emailed once, returned in API response once, never logged |
| Token removed from URL on redemption | `/access` route redirects to `/` with no query string |
| Guardian fields excluded from gallery | SELECT in `app/page.js` names only safe columns; guardian_name/email/phone are absent |
| Invite lookup indexed by token hash | `token_hash` column has UNIQUE index — O(1) lookup; raw token never used as key |
| Admin routes verify real admin | `requireAdminAuth` → Supabase `getUser` → `ADMIN_EMAILS` env check |
| Per-request DB revocation check | Every rep route calls `findInviteById`; checks `revoked_at IS NULL` before proceeding |
| Revocation blocks immediately | No TTL grace period — next request after revocation hits DB and is denied |
| Favorites/intro identity from session | `invite_id` and `event_id` come from session payload; client cannot override them |
| Application checked against session event | `findApplicationForRep(applicationId, session.eid)` — cross-event access returns 403 |
| Email errors sanitized | `sanitizeEmailError()` strips email addresses before any error is stored or logged |
| Intro requests idempotent | Unique constraint `(invite_id, application_id)` + pre-check; second request returns existing row |
| Access log not forgeable | `p101_opencall_access_log` has no insert policy for `anon`/`authenticated`; service role only |
| Session cookie not JS-readable | `httpOnly: true` |
| Session cookie not outliving invite | TTL = `min(8h, invite.expires_at, event.review_close)` |

---

## Environment variables

### pages101-web (Vercel + `.env.local`)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | PostgREST base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for admin and rep DB ops |
| `NEXT_PUBLIC_SUPABASE_URL` | Public anon client (applicant auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `ADMIN_EMAILS` | Comma-separated list of admin emails |
| `TALENTSEARCH_BASE_URL` | Base URL of talentsearch (used to build invite links) |
| `AWS_ACCESS_KEY_ID` | SES credential |
| `AWS_SECRET_ACCESS_KEY` | SES credential |
| `AWS_REGION` | SES region (e.g. `us-east-1`) |
| `SES_FROM_EMAIL` | Verified SES sender address |

### talentsearch (Vercel + `.env.local`)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | PostgREST base URL (same Pages101 project) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key |
| `TALENTSEARCH_SESSION_SECRET` | HMAC signing secret for `__rep` cookies |
| `AWS_ACCESS_KEY_ID` | SES credential |
| `AWS_SECRET_ACCESS_KEY` | SES credential |
| `AWS_REGION` | SES region |
| `SES_FROM_EMAIL` | Verified SES sender address |

**Known issue:** Email delivery requires `AWS_SECRET_ACCESS_KEY` to match `AWS_ACCESS_KEY_ID`. If SES returns `SignatureDoesNotMatch`, the IAM key pair needs to be rotated in the AWS console (existing secret key values cannot be retrieved). After rotating, update both `.env.local` and the Vercel project env vars — paste the value without surrounding quotes.

---

## Admin UI (pages101-web)

`src/app/dashboard/admin/opencall/reps/page.tsx`

Shows all rep invites for the active event. Each row displays invite status (active / revoked / expired), last access, and redemption date. Admin can create new invites (opens a form; on success shows the invite URL to copy if email delivery is uncertain) and revoke existing ones.

---

## Phase 4 entry point

Phase 3 delivered read-only access for reps. The remaining capabilities are:

- **Guardian notification emails**: AWS SES is wired; delivery depends on the key pair being correct. Once keys are confirmed working, the intro email flow functions end-to-end.
- **Admin review tooling**: The access log captures all rep activity; a Phase 4 admin view could surface which applications received the most interest.
- **Gallery migration from Airtable**: Out of scope for Phase 3; do not begin until explicitly authorized.

### Constraints inherited from Phase 1–3

- Do not expose guardian contact (name, email, phone) to rep sessions in any API response or page render.
- Do not store raw invite tokens in logs, DB rows, or client storage.
- Do not use client-supplied invite IDs or event IDs in rep API routes — derive identity from the session.
- Service-role key and session secret remain server-side only.
- All rep route handlers must call `findInviteById` on every request (no cookie-only authorization).
- Introduction requests are idempotent; do not send duplicate emails.
- Gallery migration from Airtable is explicitly out of scope until authorized.

---

## File map

### pages101-web

```
src/lib/opencall-admin.ts                                  Admin auth, token generation, invite URL builder, log helper
src/app/api/opencall/admin/reps/route.ts                  List + create invites
src/app/api/opencall/admin/reps/[id]/route.ts             Invite detail (favorites, intros, access log)
src/app/api/opencall/admin/reps/[id]/revoke/route.ts      Revocation endpoint
src/app/dashboard/admin/opencall/reps/page.tsx            Admin invite management UI
supabase/migrations/202607260001_p101_opencall_phase3_tables.sql   rep_favorites, intro_requests, access_log extension
supabase/migrations/202607270001_p101_opencall_intro_requester.sql  Add requester identity fields to intro_requests
```

### talentsearch

```
middleware.js                                     HMAC verification for page routes; bypasses /api/rep/*
lib/session.js                                   Sign, verify, and build HMAC-SHA256 session cookies
lib/supabase-p101.js                             Raw PostgREST helper; all DB ops for talentsearch
lib/email.js                                     AWS SES send helpers + sanitizeEmailError
app/access/route.js                              Token redemption → session cookie → redirect
app/denied/page.js                               Denied page (unknown / expired / revoked / invalid)
app/page.js                                      Gallery: per-render DB revocation check, application list
components/TalentGallery.jsx                     Gallery UI, TalentModal, RepSessionBanner
components/TalentModal.jsx                       Application detail modal + favorites + intro form
app/api/rep/favorites/[applicationId]/route.js   POST add / DELETE remove favorites
app/api/rep/intro/[applicationId]/route.js       POST request introduction; sends SES emails
```
