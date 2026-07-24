# Open Call — Phase 4 Handoff

This document captures the state of the Open Call feature after Phase 4 completion. It is the authoritative reference for Phase 5 implementation.

---

## What was built

Phase 4 replaced the Airtable gallery data source with a server-only Pages101/Supabase adapter. The rep-access layer (Phase 3) is unchanged. The gallery now loads submissions directly from `p101_opencall_gallery_v` on the shared Pages101 Supabase project, scoped to the event ID from the validated rep session.

The Airtable adapter is retained in `lib/airtable.js` for fast rollback.

- **talentsearch branch merged to `main`:** `opencall-pages101-adapter`
- **Phase 4 commit:** `cfd6139`
- **talentsearch preview (verified):** `https://talentsearch-5i8va01o4-cor9s-projects.vercel.app`
- **pages101-web:** no changes in Phase 4

---

## Database view used

`p101_opencall_gallery_v` on Supabase project `gouasbcszvehhqybevsc` (us-east-2).

The view filters `WHERE status = 'submitted'` and deliberately excludes guardian fields. Verified columns (28 total):

| Column | Type | Gallery field |
|---|---|---|
| `id` | uuid | `id`, `applicationId` |
| `event_id` | uuid | (used for isolation only) |
| `actor_name` | text | `name` |
| `birth_month` | integer | used to compute `age` |
| `birth_year` | integer | `birthday` (year displayed) |
| `gender` | text | `genderIdentity` |
| `ethnicity` | text[] | `ethnicity` (joined with ", ") |
| `union_status` | text | `union` (normalized) |
| `city` | text | used in `location` |
| `state` | text | used in `location` |
| `country` | text | used in `location` |
| `local_hire_cities` | text[] | `localHireCities` (joined) |
| `has_current_rep` | boolean | `representation` |
| `current_rep_name` | text | `representation` |
| `rep_context` | text | (appended to representation) |
| `seeking` | text[] | `seeking` (joined with ", ") |
| `coogan_status` | text | `cooganAccount` |
| `work_permit` | text | `workPermits` |
| `passport` | boolean | `passport` |
| `casting_platforms` | text[] | `castingProfiles` |
| `casting_profile_urls` | text[] | `castingProfiles` |
| `supplemental_notes` | text | `supplementalNotes` |
| `headshots` | jsonb | `allImages`, `mainHeadshot`, `headshotLabels` |
| `slate_url` | text | `videos[0]` (Slate) |
| `reel_url` | text | `videos[1]` (Reel / Clips) |
| `other_video_url` | text | `videos[2]` (Other Video) |
| `resume_url` | text | `resume` |
| `submitted_at` | timestamptz | (available but not displayed) |

Guardian fields (`guardian_name`, `guardian_email`, `guardian_phone`) are absent from the view by design. They are accessible only via service-role queries in `lib/supabase-p101.js` (used by the intro request handler).

---

## New files (talentsearch)

### `lib/pages101.js` — server-only Pages101 adapter

```
import 'server-only'   ← build-time enforcement; import in a client component = build error
```

**`getSubmissions(eventId)`** → `{ submissions, error }`

Queries `p101_opencall_gallery_v` via PostgREST:

```
GET /rest/v1/p101_opencall_gallery_v
  ?event_id=eq.<eventId>
  &select=*
  &order=actor_name.asc
```

The event ID always comes from the validated rep session (`session.eid` in `app/page.js`). It is never accepted from the client.

Error handling returns `{ submissions: [], error: <sanitized string> }` — no SQL table names or Supabase error codes are exposed.

**`normalizeApplication(app)`** maps view columns to the gallery shape used by `TalentGallery.jsx` and `TalentModal.jsx`. Key normalizations:

| Logic | Detail |
|---|---|
| `age` | `computeAge(birth_month, birth_year)` using current date |
| `birthday` | `birth_year` as string (year only — no full DOB) |
| `union` | `non_union` → `"Non-Union"`, `sag_eligible` → `"SAG-AFTRA Eligible"`, `sag_member` → `"SAG-AFTRA"` |
| `location` | `[city, state, country].filter(Boolean).join(", ")` |
| `allImages` | string[] of URLs ordered: commercial → theatrical → other, deduped |
| `headshotLabels` | parallel string[] of labels (`"Commercial"`, `"Theatrical"`, `"Other"`) |
| `mainHeadshot` | `allImages[0]` or `"/11k.jpeg"` fallback |
| `applicationId` | real Supabase UUID (same as `id`) — used by favorites and intro routes |
| `id` | same UUID — used as React list key |
| `guardianName / email / phone` | always `""` — never populated from view |

### `config/opencall.js` — year-specific display config

```js
export const OPEN_CALL = {
  edition: '11th',
  displayYear: 2026,
  eventTitle: 'Child Actor 101 Online Talent Representation Open Call',
  headshotCount: '100+',
}
```

Used in `app/page.js` to replace hard-coded edition copy. Update this file when the next Open Call launches; no other files need edition-specific edits.

---

## Modified files (talentsearch)

### `app/page.js`

- Import changed from `lib/airtable` to `lib/pages101`
- `getSubmissions` now takes `session.eid` (event ID from validated session):
  ```js
  const { submissions, error } = await getSubmissions(session.eid)
  ```
- All edition strings updated to `{OPEN_CALL.edition}` via `config/opencall.js`
- Rollback comment block at top of file with exact 3-step revert instructions

### `components/TalentModal.jsx`

Each headshot is now wrapped in a `.modal-photo-item` container div. A label renders below the image using optional chaining:

```jsx
{talent.headshotLabels?.[idx] && (
  <span className="modal-photo-label">{talent.headshotLabels[idx]}</span>
)}
```

Backward-compatible: if `headshotLabels` is absent (Airtable rollback), no crash.

### `app/globals.css`

```css
.modal-photo-item { display:flex; flex-direction:column; align-items:center; gap:4px; }
.modal-photo-label { font-size:10px; font-weight:700; letter-spacing:0.06em;
                     text-transform:uppercase; color:var(--text-muted,#6b7280); }
```

### `lib/airtable.js`

Marked as rollback adapter with prominent comment block and exact 3-step revert instructions. Not imported in production after Phase 4.

### `package.json`

Added `"server-only": "^0.0.1"` to dependencies.

---

## Rollback to Airtable

In `app/page.js`:

1. Change `import { getSubmissions } from '../lib/pages101'` to `import { getSubmissions } from '../lib/airtable'`
2. Change `getSubmissions(session.eid)` to `getSubmissions()`
3. Ensure `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_ID` are set in env.

After rollback: headshot labels will not display (gracefully handled — `headshotLabels` is absent from Airtable data and the modal uses optional chaining).

---

## Verification results (2026-07-24)

Full browser walkthrough completed against `talentsearch-5i8va01o4-cor9s-projects.vercel.app` with live Supabase data. All checks passed.

| Check | Result |
|---|---|
| Invite token → session cookie created | PASS |
| Gallery loads from Supabase | PASS |
| Zero Airtable network requests | PASS |
| Event isolation (only submitted apps for session event) | PASS |
| Field normalization (age, location, union) | PASS |
| Headshot labels: Commercial → Theatrical → Other | PASS |
| Birthday shows year only (no full DOB) | PASS |
| Guardian PII absent from UI, response, and DB | PASS |
| Favorites add — written to `p101_opencall_rep_favorites` | PASS |
| Favorites persist across page reload | PASS |
| Intro form: name editable, email required | PASS |
| Intro request DB record created with requester identity | PASS |
| Duplicate intro request returns `existing:true` | PASS |
| Revocation → API returns 401 immediately | PASS |
| Access log entries written for session lifecycle | PASS |

---

## Environment variables (talentsearch)

All vars confirmed in Vercel Preview and `.env.local` as of 2026-07-24:

| Variable | Status |
|---|---|
| `SUPABASE_URL` | ✓ Points to Pages101 project (`gouasbcszvehhqybevsc`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ Pages101 service role key |
| `TALENTSEARCH_SESSION_SECRET` | ✓ Set |
| `AWS_ACCESS_KEY_ID` | ✓ Real SES credentials |
| `AWS_SECRET_ACCESS_KEY` | ✓ Real SES credentials |
| `AWS_REGION` | ✓ Set |
| `SES_FROM_ADDRESS` | ✓ Set |

---

## Security properties — Phase 4 additions

All Phase 3 properties hold. Phase 4 adds:

| Property | Mechanism |
|---|---|
| Gallery adapter server-side only | `lib/pages101.js` has `import 'server-only'` — build fails if imported in a client component |
| Event scope from session, never client | `getSubmissions(session.eid)` — event ID from HMAC-verified cookie, not query string or body |
| Guardian fields excluded at view level | `p101_opencall_gallery_v` does not select guardian columns — server error in query would still return nothing |
| Service-role key not in bundle | `lib/pages101.js` imports `SUPABASE_SERVICE_ROLE_KEY` only at runtime in server context; `server-only` guarantees this |

---

## File map (Phase 4 additions)

### talentsearch

```
lib/pages101.js           Server-only Pages101/Supabase adapter; getSubmissions(eventId)
config/opencall.js        Year-specific display config (edition, displayYear, etc.)
```

### talentsearch (modified)

```
app/page.js               Data source switched to pages101 adapter; edition copy from config
components/TalentModal.jsx  Headshot label rendering (Commercial / Theatrical / Other)
app/globals.css           Modal photo item + label styles
lib/airtable.js           Marked as rollback adapter; not imported in production
package.json              Added server-only dependency
```

---

## Phase 5 entry point

The system is end-to-end verified in Preview. Before production:

1. **Create the real 11th Open Call event** in the Pages101 Supabase DB via the `p101_opencall_events` table. Required fields: `name`, `year` (2026), `status` (`'open'` when accepting submissions, `'reviewing'` during rep review), `review_close`.
2. **Merge to production** — both repos are already on `main`. A Vercel production deployment picks up the Phase 4 changes automatically when triggered.
3. **Issue rep invites** via the pages101-web admin UI at `/dashboard/admin/opencall/reps`. The admin UI sends the invite email with the talentsearch access URL. Invites are scoped to the real event ID.
4. **Accept applicant submissions** — the existing pages101-web submission form populates `p101_opencall_applications` with `status='draft'` until submitted. The gallery view filters to `status='submitted'` automatically.

### Constraints inherited from Phase 1–4

- Do not expose guardian contact (name, email, phone) in any rep-facing response or page render.
- Do not store raw invite tokens in logs, DB rows, or client storage.
- Do not accept invite IDs or event IDs from the client in rep API routes — derive from session.
- Service-role key and session secret remain server-side only.
- All rep route handlers must call `findInviteById` on every request (no cookie-only authorization).
- Introduction requests are idempotent — second request returns existing row, no duplicate email.
- The `config/opencall.js` edition config must be updated before each new Open Call launch.
