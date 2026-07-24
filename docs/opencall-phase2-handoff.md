# Open Call — Phase 2 Handoff

This document captures the state of the Open Call feature after Phase 2 completion. It is the authoritative reference for Phase 3 implementation.

---

## What was built

Phase 1 established the database schema and security infrastructure. Phase 2 built the public-facing side: the three API routes, the applicant form, and the dashboard card. Both phases are merged on `main` via [PR #2](https://github.com/cor9/pages101-web/pull/2).

---

## Database schema

Five tables. All live in the `public` schema on Supabase project `gouasbcszvehhqybevsc` (us-east-2).

### `p101_opencall_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `year` | integer UNIQUE | |
| `name` | text | |
| `submits_open` | timestamptz | |
| `submits_close` | timestamptz | |
| `review_close` | timestamptz | |
| `status` | text | `draft / open / reviewing / closed` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto-updated by trigger |

Only `open / reviewing / closed` events are returned by the public event API. `draft` events are never surfaced. The year=9999 staging fixture is permanently at `draft`.

### `p101_opencall_applications`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events | immutable after creation |
| `user_id` | uuid FK → auth.users | immutable after creation |
| `source_page_id` | uuid FK → p101_actor_pages | nullable; immutable once set; provenance only |
| `actor_name` | text | editable; prefilled from source page display_name |
| `birth_year` | integer | |
| `birth_month` | integer | |
| `gender` | text | |
| `ethnicity` | text[] | |
| `city / state / country` | text | |
| `local_hire_cities` | text[] | |
| `union_status` | text | `non_union / sag_eligible / sag_member` |
| `coogan_status` | text | `yes / no / not_required` |
| `work_permit` | text | `yes / no / not_required` |
| `passport` | boolean | |
| `has_current_rep` | boolean | |
| `current_rep_name` | text | |
| `rep_context` | text | |
| `seeking` | text[] | values from SEEKING_OPTIONS |
| `casting_platforms` | text[] | `actors_access / casting_networks / other` |
| `casting_profile_urls` | text[] | max 2 |
| `headshots` | jsonb | array of `{type, url}`; type: `commercial / theatrical / other` |
| `guardian_name` | text | private; Phase 3 reveal mechanic |
| `guardian_email` | text | private |
| `guardian_phone` | text | private |
| `resume_url` | text | |
| `slate_url` | text | |
| `reel_url` | text | |
| `other_video_url` | text | |
| `supplemental_notes` | text | max 4000 chars |
| `status` | text | `draft / submitted / withdrawn` — server-managed |
| `submitted_at` | timestamptz | server-managed |
| `withdrawn_at` | timestamptz | server-managed |
| `reviewed_at` | timestamptz | server-managed |
| `consents` | jsonb | see Consent Contract |
| `created_at` | timestamptz | immutable |
| `updated_at` | timestamptz | auto-updated by trigger |

**Unique constraint:** `(event_id, user_id, actor_name)` — prevents duplicate submissions for the same performer name within an event.

**Guard trigger** `p101_opencall_guard_application` (BEFORE UPDATE): blocks `authenticated` and `anon` roles from changing `id`, `user_id`, `event_id`, `source_page_id`, `status`, `submitted_at`, `withdrawn_at`, `reviewed_at`, `created_at`. Service role bypasses the trigger (all server mutations use service role).

**RLS policies:**
- `select own applications` — SELECT for `authenticated` where `user_id = auth.uid()`
- `edit application in window` — UPDATE for `authenticated` where `user_id = auth.uid()` and event window open
- `create application in window` — INSERT for `authenticated` where `user_id = auth.uid()`, `status = 'draft'`, event window open, source_page_id owned by user (if provided)

### `p101_opencall_rep_invites`

> **Note:** Earlier session reports conflicted on this table's columns (`email` vs `rep_email`, presence of `invited_by`). The table below reflects the verified live schema as of Phase 2 completion.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events NOT NULL | |
| `rep_name` | text NOT NULL | |
| `rep_email` | text NOT NULL | rep's email |
| `rep_agency` | text | nullable |
| `token_hash` | text UNIQUE NOT NULL | sha256 of the raw token; raw token is emailed once, never stored |
| `expires_at` | timestamptz NOT NULL | |
| `revoked_at` | timestamptz | nullable |
| `redeemed_at` | timestamptz | nullable; set on first valid redemption |
| `created_at` | timestamptz NOT NULL | |

Token flow: server generates raw token → emails it → stores only `sha256(raw_token)`. Redemption checks hash match + not expired + not revoked. Single-use via `redeemed_at`.

### `p101_opencall_access_log`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK → events NOT NULL | verified NOT NULL in live schema |
| `invite_id` | uuid FK → rep_invites NOT NULL | verified NOT NULL in live schema |
| `application_id` | uuid FK → applications | nullable; required for application-scoped actions |
| `action` | text NOT NULL | `session_start / invite_redeemed / access_denied / view_application / reveal_guardian_contact` |
| `created_at` | timestamptz NOT NULL | |

No INSERT policy for `authenticated` or `anon` — service role only.

**Application-required constraint:** `action IN ('session_start','invite_redeemed','access_denied') OR application_id IS NOT NULL`.

### `p101_opencall_application_consents`

Exists as a separate table but Phase 2 stores consents as JSONB on the application row (`consents` column) for submission atomicity. This table is available for future normalized consent history.

---

## API routes

All three routes are under `src/app/api/opencall/`. Every authenticated route validates the Bearer token via `getAuthenticatedRequestUser()` (calls `serviceClient.auth.getUser(token)`), then uses the service-role client for all reads and writes. The service role is never sent to the browser.

### `GET /api/opencall/event`

Public (no auth). Returns the most recent event with `status IN ('open','reviewing','closed')`. Returns `{event: null}` if none exists.

### `GET /api/opencall/applications`

Authenticated. Returns the current user's applications for the active event.

### `POST /api/opencall/applications`

Authenticated. Creates a new draft for the open event.

Body: `{ year?: number, source_page_id?: string }`

- If `source_page_id` provided: verifies `user_id = auth.uid()` ownership on `p101_actor_pages`; prefills `actor_name` from `page.display_name`. Returns 404 if page not found or not owned.
- Data is copied once at creation; subsequent edits to the source page do not affect the application.
- `source_page_id` is stored as provenance only.

### `GET /api/opencall/applications/[id]`

Authenticated. Loads a single application. Returns 404 if the application doesn't exist or belongs to a different user.

### `PATCH /api/opencall/applications/[id]`

Authenticated. Autosaves draft fields. The request body is validated against `draftSaveSchema` (28 fields — see `src/lib/opencall.ts`). Unknown keys are stripped by Zod. An empty payload after stripping returns 400 "No valid fields to update."

Blocked with 409 if:
- `existing.status === 'withdrawn'`
- `event.submits_close <= now()`

`status`, `submitted_at`, `withdrawn_at`, `reviewed_at`, `event_id`, `user_id`, `source_page_id`, `consents` are absent from `draftSaveSchema` and cannot be changed via PATCH.

### `POST /api/opencall/applications/[id]`

Authenticated. Action dispatch.

**`{action: "submit"}`**
1. Validates consents via `submitConsentSchema`
2. Loads application with all completeness-required fields
3. Checks `status !== 'withdrawn'` and window open
4. Runs completeness check (18 fields); returns 422 with field list on failure
5. Builds `consents` JSONB with server-generated `accepted_at` and `copy_hash`
6. Updates `status = 'submitted'`, `submitted_at = now()`, `consents = ...` via service role

**`{action: "withdraw"}`**
1. Loads application; checks not already withdrawn and window open
2. Updates `status = 'withdrawn'`, `withdrawn_at = now()` via service role
3. Permanent — no restore endpoint

---

## Security properties

All verified during the Phase 2 audit.

| Property | Mechanism |
|---|---|
| No unauthenticated access | `getAuthenticatedRequestUser` → 401 before any query |
| Cross-user isolation | `.eq("user_id", user.id)` on every load; returns 404 (not 403) |
| Status escalation via PATCH blocked | `status` absent from `draftSaveSchema`; Zod strips it; empty-body check → 400 |
| Lifecycle fields not PATCH-able | `submitted_at`, `withdrawn_at`, `reviewed_at`, `event_id`, `consents` all absent from schema |
| DB-level enforcement | Guard trigger blocks direct SQL mutations from `authenticated`/`anon` roles |
| Service role client-side | Never imported in client components; only in `src/lib/supabase/server.ts` |
| `user_id` from JWT, not body | Server derives from `getUser(token)` result; any `user_id` in body is ignored |
| Raw token never stored | Rep invite flow stores only `sha256(token)` |
| `accepted_at` server-generated | Client sends `true`/`false`; timestamp set server-side at submission |
| `copy_hash` deterministic | `"sha256-" + createHash("sha256").update(text, "utf8").digest("hex")` — not a random UUID |
| Staging fixture | year=9999 event at `draft` — never returned by public event API |
| Media bucket | Existing public `pages101-media` bucket. UI does not describe uploads as private. |

---

## Consent contract

Defined in `src/lib/opencall.ts` (`CONSENT_COPY`, `submitConsentSchema`). Hashes computed by the POST submit handler in `src/app/api/opencall/applications/[id]/route.ts`.

All four consents share version `2026-07-23`.

### `guardian_consent` — required (`z.literal(true)`)

> I am the parent or legal guardian of this performer and I authorize this Open Call application to be submitted on their behalf.

`sha256-902f22998ccf6b06a2d29ff3a82ec6f70ee5b5836989236b28a8210b04f554d7`

### `reviewer_visibility_consent` — required (`z.literal(true)`)

> I consent to this application being reviewed by Pages101 and authorized industry representatives participating in this Open Call.

`sha256-cef26751ed65df4e4995bf21843e2ac7de2f739f391959dffc2f13a34bfc3f28`

### `contact_consent` — required (`z.literal(true)`)

> I consent to Pages101 and participating representatives contacting me at the email address and phone number provided in this application.

`sha256-813693d933ea3f53ddfd39951c10ad3277a3bdfcc06036e6e40958c42b67494a`

### `anonymized_results_consent` — optional (`z.boolean().optional()`)

> I consent to anonymized data from this submission being included in aggregate reporting about this Open Call.

`sha256-d21eb922e9a8a637067a0cee65d24d0b21b155c0aaa4231e981d7cc6f0c44b7b`

### Storage shape

Each key in the `consents` JSONB column:

```json
{
  "accepted": true,
  "accepted_at": "2026-07-23T18:34:01.123Z",
  "version": "2026-07-23",
  "copy_hash": "sha256-902f22998ccf6b06a2d29ff3a82ec6f70ee5b5836989236b28a8210b04f554d7"
}
```

`accepted_at` is the same ISO 8601 timestamp for all four entries within one submission (set at the top of the handler as `const submittedAt = new Date().toISOString()`). The client communicates checked/unchecked state only; it never sends a timestamp.

---

## Autosave implementation

`src/app/opencall/apply/[id]/page.tsx`

- **Debounce:** 700ms. Every `setField` / `toggleArrayItem` call fires `scheduleSave`, which clears and resets the debounce timer.
- **`latestFormRef`:** Updated at the start of every `scheduleSave` call. Always holds the current form snapshot regardless of whether the debounce has fired.
- **Race protection:** `inFlightRef` prevents concurrent PATCH calls. If a save is in flight when a new one is requested, the new payload is stored in `pendingRef` and dispatched immediately after the in-flight resolves.
- **`toSavePayload()`:** Converts `FormState` → PATCH body. Key transformations:
  - `casting_profile_url_0` + `casting_profile_url_1` → `casting_profile_urls` array (empty strings filtered)
  - `local_hire_cities` string → array (split by comma)
  - Empty strings → `null` for optional text fields
- **Error recovery:** When `saveStatus === "error"`, a red "Save Draft" button appears in the header. Clicking it calls `handleManualSave()`, which clears any pending debounce and fires `executeSave(toSavePayload(latestFormRef.current ?? form))`.
- **Unload warning:** A `beforeunload` listener fires when `saveStatus === "saving"` or `"error"` or `debounceRef.current !== null`.

---

## Edit-after-submit contract

Submitted applications remain editable until the submission window closes.

`editable = windowOpen && !isWithdrawn`

The PATCH route does not block `status === "submitted"` — only `withdrawn` and closed window are blocked. The form shows a "Submitted" badge in the header but does not disable inputs while the window is open. This allows families to correct mistakes after submitting.

---

## Withdrawal behavior

- **Confirmation dialog:** "Withdraw this application? It will be removed from consideration and cannot be restored."
- **Effect:** `status = 'withdrawn'`, `withdrawn_at = now()`. Permanent — no restore endpoint exists.
- **After withdrawal:** Client redirects to `/opencall`.
- **Post-withdrawal:** PATCH returns 409 "This application has been withdrawn." Submit returns 409 with the same message. A new application for the same actor name would conflict with the `(event_id, user_id, actor_name)` unique constraint.
- **Window-closed:** Withdrawal after `submits_close` returns 409 "The submission window has closed."

---

## Prefill behavior

When an application is created with `source_page_id`:

1. Route verifies `p101_actor_pages.user_id = auth.uid()` — 404 if not owned.
2. `actor_name` is set to `page.display_name` at INSERT time (one-time copy).
3. `source_page_id` is stored on the row as provenance.
4. Subsequent edits to the source actor page have no effect on the application.
5. `source_page_id` is immutable (guard trigger). `actor_name` is editable (in `draftSaveSchema`).

---

## Phase 3 entry point

The Phase 1 gallery design points to **Model C** for the representative contact flow:

> Representatives use "Request Introduction." Guardian details remain hidden. The system contacts both parties and logs the action.

This gives privacy, measurable rep interest, and less manual approval work than alternatives.

### What Phase 3 needs to build

- Rep-facing gallery (read-only view of submitted applications, excluding guardian fields)
- Invite token redemption flow (token emailed, redeemed against `p101_opencall_rep_invites`)
- "Request Introduction" action: server sends email to guardian (from the stored contact fields), logs `reveal_guardian_contact` to `p101_opencall_access_log`
- Access log UI for the admin to see which reps viewed and contacted which applications

### Infrastructure available

- `p101_opencall_rep_invites` schema is in place (Phase 1)
- `p101_opencall_access_log` is in place with `reveal_guardian_contact` action
- Guardian fields exist on the application row; Phase 3 must never expose them in the gallery query or in any API response that rep sessions can reach
- Email/relay infrastructure: `p101_relay_messages` table and associated routes exist from a prior feature

### Constraints inherited from Phase 1 + 2

- "Do not send service-role credentials to the browser."
- "Do not import service-role clients into client components."
- "Do not log guardian information, full consent payloads, or sensitive application contents."
- "Do not expose raw Supabase errors to users."
- "Avoid including guardian information in analytics events."
- "The existing media bucket is public. The UI must not describe uploads as private or access-controlled."
- "Raw tokens are generated and emailed by trusted server code. Never store the raw token."

---

## File map

```
src/lib/opencall.ts                              Shared types, schemas, consent copy, helpers
src/app/api/opencall/event/route.ts             Public event lookup
src/app/api/opencall/applications/route.ts      List + create
src/app/api/opencall/applications/[id]/route.ts Load + autosave + submit + withdraw
src/app/opencall/page.tsx                        Applicant listing page
src/app/opencall/apply/[id]/page.tsx            Applicant form
src/app/dashboard/page.tsx                       Dashboard (Open Call card added here)
supabase/migrations/202607230001_p101_opencall.sql
supabase/migrations/202607230002_p101_opencall_field_mapping.sql
supabase/migrations/202607230003_p101_opencall_hardening.sql
supabase/migrations/202607240001_p101_opencall_phase1_hardening.sql
supabase/migrations/202607250001_p101_opencall_fixture_safety.sql
```
