# Open Call — Phase 5 Launch-Gate Addendum

**Date:** 2026-07-24  
**Authored against:** Phase 5 handoff (`docs/opencall-phase5-handoff.md`)  
**Instruction:** Do not begin launch, promote production, or change event status until the owner authorizes.

---

## 1. Server-Only Finding — Explanation and Scanner Proof

### What the finding is

`lib/supabase-p101.js` holds the `SUPABASE_SERVICE_ROLE_KEY` but does not have `import 'server-only'`. Without that guard, there is no build-time enforcement preventing a client component from importing the module. Adding the guard was attempted and caused Next.js 14 dev mode to hang on all requests (see Phase 5 handoff §B6 for root cause). The guard was reverted.

`lib/pages101.js` (the gallery data adapter) **does** have `import 'server-only'`, so the primary read path is protected at build time.

### How the build-time security suite provides equivalent protection

Three checks cover the gap:

**SEC-09 — source-level allowlist check**  
Any file referencing `SUPABASE_SERVICE_ROLE_KEY` that is NOT in the allowlist `{lib/supabase-p101.js, lib/pages101.js}` AND lacks `import 'server-only'` is flagged as a violation. This catches the key copied into any new file.

**SEC-10 — client component import scan**  
Any `'use client'` component importing from `lib/supabase-p101` (or `lib/pages101`, `server-only`, common relative aliases) is flagged. `lib/supabase-p101` is listed explicitly in `serverOnlyImports`.

**SEC-12 — built bundle scan**  
Scans all files under `.next/static/` for the literal service-role key string. `.next/static/` currently exists (`chunks/`, `css/`, `media/`, `webpack/` confirmed) so SEC-12 is not skipping.

### Does the scanner cover source code AND the built client bundle?

**Yes on both.** SEC-09 and SEC-10 scan all `.js/.jsx/.ts/.tsx/.mjs/.cjs` source files. SEC-12 scans the built `.next/static/` output.

### Negative fixture test (SEC-NEG-01)

Added to `tests/security.test.mjs` at the end of `runServiceRoleLeakTests()`. The test:
1. Writes `components/__test_sec_neg01.jsx` — a fake `'use client'` component with `process.env.SUPABASE_SERVICE_ROLE_KEY`
2. Applies the SEC-09 predicate to that file inline (`hasSRK && !isAllowed && !hasGuard`)
3. Asserts the predicate evaluates `true` — i.e., the scanner would flag it
4. Unconditionally deletes the file in a `finally` block

The repo is left clean. The test currently passes.

---

## 2. Classification of Remaining Cold-Review Findings

| Finding | Classification | Reason |
|---|---|---|
| No rate limiting on `/access` | **ACCEPTED LAUNCH RISK** | 256-bit tokens make brute force infeasible. DoS risk is low at current scale (~20 invites). Add Vercel Edge Rate Limiting before next event. |
| Error oracle (unknown vs revoked/expired) | **ACCEPTED LAUNCH RISK** | With 256-bit tokens, confirmation a token exists provides no exploitable advantage. Collapse denial codes in a future event. |
| `/api/rep/*` authorization — convention only | **ACCEPTED LAUNCH RISK** | All 3 current handlers call `getVerifiedSession()` — confirmed by code review and SEC-09/SEC-10. Risk is bounded to routes that exist today. Add lint rule before any new route. |
| No HTTP security headers | **FUTURE HARDENING** | Raw token only appears in the single `/access` request, which immediately redirects. Token leakage via `Referer` is not a realistic attack path. Add `headers()` to `next.config.mjs` before next event. |
| `server-only` guard missing from `supabase-p101.js` | **FUTURE HARDENING** | SEC-09, SEC-10, and SEC-12 provide equivalent detection. Revisit on Next.js 15 upgrade. |

**None of the remaining findings are launch blockers for this event.**

---

## 3. Staging and Production Infrastructure Walkthrough

### Evidence basis

- **Rep-workflow:** ACC acceptance test suite (29 tests, all PASS, run against Next.js 14.2.35 + live Pages101 Supabase). Real end-to-end HTTP tests.
- **Staging browser verification:** Phase 4 walkthrough against deployed Preview URL on 2026-07-24 — 15-item table, all PASS (see `docs/opencall-phase4-handoff.md §Verification results`).
- **Family-workflow (pages101-web):** Not covered by the talentsearch test suite. No Phase 5 changes touched pages101-web code paths.
- **Production:** Owner confirmed TalentSearch Vercel Production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point to correct Pages101 Supabase project (B2 resolved 2026-07-24).

### Walkthrough matrix

| Item | Staging | Production | Evidence |
|---|---|---|---|
| Magic-link sign-in | NOT VERIFIED | NOT VERIFIED | pages101-web family auth; outside talentsearch test scope; no Phase 5 changes |
| Two independent applications | NOT VERIFIED | NOT VERIFIED | ACC-14 confirms event isolation per se; submission form UI untested |
| Draft persistence after logout/return | NOT VERIFIED | NOT VERIFIED | Existing feature; no Phase 5 changes |
| Server-side required-field validation | NOT VERIFIED | NOT VERIFIED | Not covered by automated tests; needs browser walkthrough |
| Submission | NOT VERIFIED | NOT VERIFIED | ACC suite seeds apps directly via DB, not via submission form |
| Withdrawal | NOT VERIFIED | NOT VERIFIED | Not covered by automated tests |
| Rep invite redemption | PASS | BLOCKED (env) | ACC-06: valid token → 302 + `__rep` cookie. Phase 4 staging: PASS. |
| Expiration | PASS | BLOCKED (env) | ACC-08: expired token → `/denied?r=expired` |
| Revocation | PASS | BLOCKED (env) | ACC-07 (token denied), ACC-27 (gallery denied), ACC-28 (API 401). Phase 4: PASS. |
| Gallery isolation | PASS | BLOCKED (env) | ACC-12 (submitted shown), ACC-13 (drafts excluded), ACC-14 (event isolation) |
| Favorite persistence | PASS | BLOCKED (env) | ACC-16 (add), ACC-17 (idempotent), ACC-18 (remove). Phase 4 confirmed persist across reload. |
| Introduction request | PASS | BLOCKED (env) | ACC-21 (DB record), ACC-22 (idempotent), ACC-23 (no guardian PII in response) |
| Guardian privacy | PASS | BLOCKED (env) | SEC-01–07 (no PII in HTTP responses), ACC-15 (gallery DB view excludes columns) |
| Cleanup | PASS | BLOCKED (env) | ACC suite teardown; Phase 4 admin revoke PASS |

**Rep-workflow: 8/8 PASS on staging.** Family-workflow: 6/6 NOT VERIFIED (separate walkthrough required). Production: partially BLOCKED pending full env confirmation.

---

## 4. Fallback System Status

**B2 resolved (2026-07-24):** Owner confirmed TalentSearch production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point to correct Pages101 Supabase project.

No fallback system artifacts found in either codebase.

| Fallback component | Status |
|---|---|
| Hidden Google Form | NOT COMPLETE — no URL found in codebase or docs |
| Incident banner/link mechanism | NOT COMPLETE — no opencall-specific banner hook in pages101-web |
| Registered-but-unsubmitted emergency email | NOT COMPLETE — no draft found or referenced |
| Trigger owner documented | NOT COMPLETE — not formally documented |
| Recovery/export/import procedure | NOT COMPLETE — rollback to Airtable is documented; no full export/import procedure |

---

## 5. Definition of Done — Mapping

Status legend: **PASS** = demonstrated by test or verified walkthrough. **OWNER VERIFIED** = owner personally confirmed. **NOT VERIFIED** = work may exist; not yet tested. **BLOCKED** = cannot verify until a dependency resolves. **NOT COMPLETE** = work is not done. **PHASE 6** = out of Phase 5 scope; launch/marketing deliverable.

| # | DoD Item | Status | Evidence / Notes |
|---|---|---|---|
| 1 | Magic-link sign-in | **NOT VERIFIED** | No automated test. No browser walkthrough in Phase 4 or 5. Required for B1. |
| 2 | Two independent applications | **NOT VERIFIED** | ACC-14 confirms event isolation; submission form UI not tested. Required for B1. |
| 3 | Draft survives logout and return | **NOT VERIFIED** | Feature exists in code; no browser test confirms the round-trip. Required for B1. |
| 4 | Required fields validated server-side | **NOT VERIFIED** | Schema constraint documented (18-field CHECK). No browser test confirms error UX. Required for B1. |
| 5 | Database rejects post-deadline edits | **NOT VERIFIED** | Server-side check present: `route.ts` returns 409 when `submits_close <= now()`. Not browser-tested. Required for B1. |
| 6 | Protected columns cannot be changed by client | **NOT VERIFIED** | `status`, `submitted_at`, `event_id` absent from `draftSaveSchema`; DB revokes anon/authenticated write access. Not adversarially tested. Required for B1. |
| 7 | Withdrawal works and hides application from gallery | **NOT VERIFIED** | Not covered by automated tests. No walkthrough item in Phase 4 or 5. Required for B1. |
| 8 | Invite create/redeem/expire/revoke | **PASS** | ACC-06 (redeem), ACC-07 (revoke denied), ACC-08 (expire denied), ACC-27/ACC-28 (revoke blocks gallery + API). Phase 4 staging: PASS (create + revoke). |
| 9 | Unauthenticated TalentSearch access denied | **PASS** | ACC-01 (no cookie), ACC-02 (malformed), ACC-03 (tampered HMAC), ACC-04 (expired session), ACC-05 (API 401). |
| 10 | Guardian data absent from public and non-rep responses | **PASS** | SEC-01–07 (no PII in 6 HTTP routes + DB view), ACC-15 (gallery view schema), ACC-23 (intro response). |
| 11 | Service-role key absent from client code | **PASS** | SEC-08–15 (8 static checks), SEC-NEG-01 (scanner self-test). `.next/static/` clean. |
| 12 | Gallery load test at 150 applications | **NOT COMPLETE** | PERF-01/PERF-07 test gallery load with 1 seeded application. 150-app threshold not measured. Required for B4. |
| 13 | Production env vars correct for both apps | **OWNER VERIFIED** (partial) | TalentSearch `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` confirmed 2026-07-24. Remaining 5 TalentSearch vars and pages101-web production vars not yet confirmed. Run `npm run opencall:verify` against production to complete. |
| 14 | Fallback Google Form and incident system complete | **NOT COMPLETE** | See §4. All five components missing. Required for B3. |
| 15 | Trust sentence appears on marketing pages | **PHASE 6** | Phase 6 marketing deliverable. Code not expected to contain it yet. Not a Phase 5 blocker. |
| 16 | EmailOctopus segmentation and post-event emails complete | **PHASE 6** | External tool, launch content. Not a Phase 5 blocker. |
| 17 | Rep contact model implemented and reflected in consent copy | **OWNER CONTENT APPROVAL** | Implementation: guardian receives notification email; guardian may reply to contact the rep (Reply-To is set to requester email). Guardian contact info is NOT given to the rep directly. Consent copy reads: *"I consent to Pages101 and participating representatives contacting me at the email address and phone number provided."* This implies reps receive guardian contact info; the actual mechanism is the opposite (guardian is notified and chooses whether to respond). Owner must decide whether the consent copy needs to be updated before launch. |

---

## 6. Launch Verification Script

`tests/verify-launch.mjs` — run with:

```bash
npm run opencall:verify

# With full test suite (requires running server):
TEST_BASE_URL=https://talentsearch.childactor101.com npm run opencall:verify
```

Checks (10 total):
1. Required env vars present
2. Supabase service-role connectivity
3. Required tables exist (migration proxy)
4. Gallery view excludes guardian columns
5. Active Open Call event exists
6. Anonymous access blocked on sensitive tables
7. Storage bucket "pages101-media" accessible
8. SES credentials valid + from-address verified
9. Static security analysis (SEC-08–15)
10. Full test suite — 63 tests (requires `TEST_BASE_URL`)

Output format:

```
Open Call Launch Verification
Edition: 11th Annual Open Call (2026)
══════════════════════════════════════════

Running checks: .........

══════════════════════════════════════════
[ 1/10]  PASS  Required env vars present
[ 2/10]  PASS  Supabase service-role connectivity
...
[10/10]  PASS  Full test suite (63 tests)
══════════════════════════════════════════

PASS  10 check(s) passed
Ready for owner approval.
```

---

## 7. Verdict

**PHASE 5 NOT GREEN**

**B2 resolved.** Three technical blockers remain:

---

**B1 — Family workflow not verified (DoD items 1–7)**  
Magic-link sign-in, two independent applications, draft persistence, server-side validation, post-deadline rejection, protected columns, and withdrawal have never been browser-tested in any phase walkthrough. No Phase 5 changes touched pages101-web, so regression risk is low — but no positive confirmation exists. Owner must complete a manual walkthrough of the family submission flow against staging before launch.

---

**B3 — Fallback system not built (DoD item 14)**  
No Google Form URL, incident banner hook, emergency email draft, documented trigger owner, or export/import procedure exists in the codebase or documentation. All five components are NOT COMPLETE.

---

**B4 — 150-application gallery load test not run (DoD item 12)**  
The performance suite tests gallery load with 1 seeded application. The DoD requires a test at 150 applications. Owner must either: (a) run `npm run opencall:verify` or `TEST_BASE_URL=<url> npm run test:perf` against a staging environment seeded with ≥150 submitted applications and confirm p95 is within the 3000ms threshold, or (b) accept this as a known gap and document the decision.

---

**Non-blocking items for owner review before launch:**

- **DoD 13 (partial):** Run `npm run opencall:verify` against the production TalentSearch URL to confirm remaining env vars (SESSION_SECRET, AWS, SES). Confirm pages101-web production env vars separately.
- **DoD 17 (consent copy):** Owner must decide whether the `contact_consent` text accurately describes the intro-request mechanism before launch. The current copy implies reps receive guardian contact info; the implementation notifies the guardian, who chooses whether to respond.

---

When B1, B3, and B4 are resolved, Phase 5 is eligible for PHASE 5 GREEN authorization. Do not begin launch, promote production, or change event status until the owner issues that authorization.
