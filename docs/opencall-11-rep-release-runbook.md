# Open Call 11 — Rep Release Runbook

**Release day:** Tuesday, September 15, 2026
**Event:** Open Call 11 (`88c99d87-ded2-4fdb-8a6b-4f55af63135e`)
**Gallery:** https://talent.childactor101.com
**Admin:** https://pages101.com/dashboard/admin/opencall/reps

State as of Sunday Sept 13: 105 submitted, 62 drafts (never submitted), 1 withdrawn, 0 rep invites issued.

---

## How it works (the 60-second version)

1. You create an invite in the admin UI (name, email, agency, expiry). The server generates a one-time link, emails it to the rep, and shows it to you once. Only a hash is stored.
2. Rep clicks the link → `talent.childactor101.com/access?t=…` → gets an 8-hour session cookie → lands on the gallery. Clicking the email link again any time before expiry gives a fresh session.
3. Gallery shows all 105 submitted applications for Open Call 11 only. Search + filters (age, gender, seeking). Star = favorite (persists per invite). Guardian name/email/phone are never in the gallery, the API, or the DB view.
4. Rep clicks **Request Introduction** → fills name/email/role/note → the family gets an email with the rep's details (Reply-To = rep), the rep gets a confirmation. The family decides whether to answer. One request per performer per invite (duplicates are silently deduped).
5. Everything is logged to `p101_opencall_access_log` (redeem, session start, favorite, intro, denied). The admin reps page shows per-invite favorites, intro count, and last access.
6. You can revoke any invite from the admin page; it's dead on the next request.
7. On `review_close` the whole gallery goes dark (`/denied?r=closed`). Invites cannot be issued past that date.

### Two invite types (admin → Reps → tabs)

**1. Direct Invite** — one rep or one office.
- *Emailed*: name, email, agency → the rep gets the invite email automatically.
- *Link only* (checkbox): no email; you copy the link and hand it to one office/department. Everyone on it shares one favorites list and one log entry. Revoking cuts off everyone on it. Email optional (your admin email is stored as the contact).

**2. Registration Link** — rep groups and professional communities.
- One reusable link per source (`talent.childactor101.com/join?g=…`). Name it for the source ("Youth Talent Reps FB Group").
- A rep opens it → form: name, work email, agency, role → **auto-approved** → their own personal invite is created (`registered_via` = that link) and emailed to them. The email is the verification.
- Each registered rep has their own favorites, intro requests, access log, and Revoke button in the Direct Invites list (marked "Registered via …").
- The registration link never opens the gallery. Turning it off stops new registrations only; people already registered keep access.
- Duplicate registrations (same event + email, case-insensitive) rotate and re-send that person's existing link instead of creating a second invite. A revoked email is refused with "contact info@".
- The Registration Links tab shows: source name, active/off/expired, registered, redeemed, intro count, revoked count.
- Caveat: dedupe matches any invite with that email, including a *link-only* office invite that stored your admin email. Don't register yourself with the same email you used as the contact on a link-only invite, or that office's link gets rotated.

---

## Decisions you need to make before Tuesday

### 1. ~~Extend `review_close`~~ DONE (2026-09-13)
`review_close` is now **Nov 30, 2026, 11:59pm PT** and status is `reviewing`. The gallery FAQ and invite emails read this live.

### 2. Consent copy (from the Phase 5 launch-gate addendum, still open)
The family consent said reps may contact them at the email/phone provided. The actual mechanism is the opposite: the family gets an email and chooses whether to reply. The system is *more* private than promised, so this is not a blocker, but the FAQ on the gallery now states the real mechanism to reps. No action needed unless you want to email families a clarification (draft C below covers it).

### 3. Draft applicants (62)
Submissions closed Sept 8. If `notify-opencall-draft-applicants.mjs` already went out, nothing to do. If not, it's too late for them to submit; skip it.

---

## Tuesday checklist

**Before 9am**
- [ ] Merge `talentsearch` branch `opencall-11-rep-release` → `main` (Vercel deploys production automatically). This includes the missing modal CSS fix, the FAQ, and the copy alignment.
- [ ] Deploy pages101-web with the invite-email Reply-To change and link-only invite mode (`src/app/api/opencall/admin/reps/route.ts`, `src/app/dashboard/admin/opencall/reps/page.tsx`).
- [x] review_close extended to Nov 30 + status `reviewing` (done Sept 13).
- [x] DB migration `20260913000001_p101_opencall_registration_links.sql` applied to production Supabase (done Sept 13).
- [ ] **Verify TalentSearch Vercel env: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `SES_FROM_ADDRESS`.** The Preview environment returned "signature does not match" on Sept 13 — the keys there are stale. Confirm Production's keys match the working pages101-web ones, because BOTH intro-request emails and registration emails are sent from talentsearch.
- [ ] Hard-refresh `talent.childactor101.com/denied` and confirm it loads.

**Smoke test (you)**
- [ ] Admin → Reps → create an invite to **yourself** (agency "Child Actor 101 (test)").
- [ ] Confirm the invite email arrives, from-address looks right, Reply-To is info@.
- [ ] Click the link. Confirm: gallery loads, ~105 cards, filters work, open a profile, photos render in the hero + thumbnails, star a kid, FAQ shows the correct close date.
- [ ] Request Introduction on your **own child's** or a known-friendly family's profile (or skip if you don't have one; the intro path was verified in Phase 5).
- [ ] Revoke your test invite from the admin page, confirm the link now shows "Access Revoked".
- [ ] Registration Links tab → create "Smoke test" link → open it in a private window → register with a second email you control → confirm the email arrives and the button opens the gallery → confirm you appear under Direct Invites as "Registered via Smoke test" → turn the link off → confirm the /join page now says "Registration Closed" while your personal link still works → revoke the test invite.

**Release (batches)**
- [ ] Registration Links tab → create one per rep group / community, copy the URL, post it with Draft F.
- [ ] Direct Invites tab → **link-only** invites for offices you're comfortable giving one shared link.
- [ ] Create invites for your rep list. Do it in batches of ~10 and glance at the admin list after each batch for `email_delivered: false` rows (the raw URL is shown once in the response; copy it and send manually if SES bounced).
- [ ] Send Draft A (personal heads-up) from your Gmail to the same reps, ideally 10–15 minutes *before* you create their invite so the automated email doesn't land cold in spam.
- [ ] Send Draft B to families (EmailOctopus, "submitted" segment).

**Wednesday / ongoing**
- [ ] Check admin reps page: who redeemed, who hasn't. Nudge no-shows Thursday (Draft D).
- [ ] Watch `info@` for reps asking for colleague links; create a fresh invite per person, never forward an existing link.
- [ ] Week before close: Draft E to reps.

---

## Email drafts

### A. Personal heads-up to reps (send from your Gmail, before creating their invite)

**Subject:** Open Call 11 is ready for you (link coming from a robot)

Hi [First name],

The 11th Child Actor 101 Open Call submissions are in and they are good. 105 kids from all over the country, headshots, slates, reels, casting profiles, the works.

In the next few minutes you will get a second email from noreply@childactor101.com with your personal access button. That one is the real one. If it does not show up, it is hiding in spam or promotions ... please go rescue it, because I cannot resend it (security thing, long story, I did not design the vault).

Two quick things:

- The link is for your whole office. Share it with your agents, managers, assistants. Do not forward it to other companies, just tell them to email me and I will get them their own.
- To reach a family, hit **Request Introduction** on the profile. We email the parents with your info and they reply straight to you. You will never see a parent's email in the gallery, on purpose.

There is a short FAQ at the bottom of the gallery page that answers everything else I usually get asked at 11pm.

The gallery stays open through [REVIEW CLOSE DATE]. Go find your next client.

Corey

---

### B. To families whose child was submitted (EmailOctopus, "submitted" segment)

**Subject:** Your Open Call submission is now in front of reps

Hi [First name],

It happened. As of today, [Child's name]'s Open Call 11 submission is live in a private gallery being reviewed by youth talent agents and managers from across the country. [Number] offices are getting access this week, and more will be added as they respond.

Here is exactly how this works, so nobody is refreshing their inbox for the wrong thing:

**What reps see.** Your child's headshots, slate, reel, resume, casting profile links, and the details you entered. They do NOT see your name, email, or phone number. Nobody does.

**What happens if a rep is interested.** They click a button that sends YOU an email through Child Actor 101 with the rep's name, agency, role, and a note. You reply to that email and it goes straight to the rep. If you are not interested, you do nothing. No pressure, no obligation, no awkwardness.

**What you should do right now.** Make sure your slate and reel links are public and play on a phone. Every year a few links are set to private and a rep moves on. Check them today. Then leave it alone.

**How long.** The gallery stays open through [REVIEW CLOSE DATE]. Some reps look on day one. Some look in week six. Both are normal.

**What this is not.** It is not a guarantee. Not every kid gets a request, and that says nothing about your kid. Reps are building specific rosters and looking for specific holes. I have watched kids get zero requests in one Open Call and three the next.

If a rep reaches out and you want a gut check before replying, you know where I am.

Proud of you for getting it done.

Corey

---

### C. Optional: consent clarification for families (only if you want it on record)

Fold this paragraph into Draft B, or skip it:

> A note on privacy. When you submitted, the consent language said reps could contact you at the email and phone you provided. In practice it is even tighter than that: reps never see your contact information. They request an introduction, we email you, and you decide whether to write back.

---

### D. Nudge to reps who have not redeemed (Thursday)

**Subject:** Did the Open Call link find you?

Hi [First name],

Quick one. I sent your Open Call 11 access link Tuesday and it has not been opened yet, which usually means it is sitting in spam under noreply@childactor101.com.

If you can find it, great, click the button. If you cannot, reply here and I will issue a fresh one.

105 kids, and a few of the ones I would have bet on are already getting introduction requests. Do not let the good ones get away.

Corey

---

### F. Rep-group post (paste with a Registration Link)

Youth agents and managers: the Child Actor 101 Open Call 11 gallery is open. 105 kids from across the country looking for representation, with headshots, slates, reels, resumes and casting profile links, all searchable and filterable by age, gender and the kind of rep they are seeking.

Register here and your personal access link lands in your inbox in about a minute:
[REGISTRATION LINK]

Everyone in your office can register for their own. Please do not repost this outside the group. To reach a family, hit Request Introduction on their profile and they get your info and reply to you directly. Parent contact info is never shown, on purpose.

Open through [REVIEW CLOSE DATE]. Questions, I am right here. Go find your next client.

---

### E. Closing-soon notice to reps (one week before review_close)

**Subject:** Open Call 11 gallery closes [DATE]

Hi [First name],

The Open Call 11 gallery closes on [DATE] and then the link stops working, no exceptions (the families consented to a window, not forever).

If you starred anyone and never hit Request Introduction, this is the week. Your favorites are still saved under your link.

Thank you for looking. Every year a couple of these kids end up on a call sheet because someone in your office took twenty minutes.

Corey

---

## Rep FAQ (what now appears at the bottom of the gallery)

- **How do I get back in later?** Click the same button in the invite email. Every click = fresh 8-hour session. Bookmarking the page itself lands on "Access Required."
- **Can I share this with my office?** Yes, whole company. Not outside it; email info@ for a colleague's own link.
- **How do I contact a family?** Request Introduction on the profile. We email the family; they reply directly to you. You get a confirmation. One request per performer.
- **What does the star do?** Favorites, saved per invite, private to you.
- **How long is the gallery open?** Through `review_close` (displayed live on the page).
- **Some of these kids already have reps?** Yes, shown per profile; use the Seeking filter.
- **How old are they, really?** Age computed from birth month/year; birth year only is shown; guardian-consented.
- **A video will not play.** Email info@ with the performer's name.

---

## If something breaks

| Symptom | Fix |
|---|---|
| Rep says link goes to "Invalid Invitation" | Email client mangled the URL. Revoke, create a new invite, send the raw URL from the admin response in a plain-text email. |
| "Gallery Unavailable" | Event status is not open/reviewing/closed. Check `p101_opencall_events.status`. |
| "Review Period Closed" | `review_close` is in the past. Run the SQL above. |
| Invite email not delivered | Admin response shows `email_error`; copy `invite_url` and send manually. Check SES sending quota / suppression list. |
| Gallery empty | View `p101_opencall_gallery_v` filtered to event; confirm `status='submitted'` rows exist. |
| Rep says "Registration Closed" on a group link | Link was turned off or expired; turn it on in the Registration Links tab or create a fresh one. |
| Rep registered but no email | Check talentsearch Vercel logs for "Registration email failed". Usually SES creds. They can re-register to resend once fixed. |
| Need to pull a kid | Set that application's `status` to `withdrawn` (it drops out of the view immediately). |
| Full rollback | Airtable adapter still in `lib/airtable.js`; three-step revert documented at top of `app/page.js`. |
