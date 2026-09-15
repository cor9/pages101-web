# Open Call 11 — Rep Release Runbook

**Release day:** Tuesday, September 15, 2026
**Event:** Open Call 11 (`88c99d87-ded2-4fdb-8a6b-4f55af63135e`)
**Gallery:** https://talent.childactor101.com
**Admin:** https://pages.childactor101.com/dashboard/admin/opencall/reps

State as of Sunday Sept 13: 105 submitted, 62 drafts (never submitted), 1 withdrawn, 0 rep invites issued.

---

## How it works (the 60-second version)

1. You create an invite in the admin UI (name, email, agency, expiry). The server generates a one-time link, emails it to the rep, and shows it to you once. Only a hash is stored.
2. Rep clicks the link → `talent.childactor101.com/access?t=…` → gets an 8-hour session cookie → lands on the gallery. Clicking the email link again any time before expiry gives a fresh session.
3. Gallery shows all 105 submitted applications for Open Call 11 only. Three views: **All Talent / Saved / Introductions**, plus search + filters (age, gender, location, seeking). Star = favorite, ✎ = private note, "✓ Intro" = requested; all persist per invite so a rep can close the browser and pick up later. **Introductions** is their working list: everyone requested, with the parent's contact, date and their note. The banner shows "Saved N · Introductions M". Guardian contact is never in the gallery payload; it is fetched only for requested profiles.
4. Rep clicks **Request Introduction**. First time only, they confirm name / agency / role / email (prefilled from the invite; stored in a signed cookie on that browser). After that it is one click; a note for the family is optional. The family is emailed the good news with the rep's name, agency, role and email in the body; the rep immediately sees the parent's name, email and phone (Email Parent / Copy Contact) and gets a confirmation email with the same contact. Families consented to exactly this. Contact is never visible without a request, every reveal is logged (`reveal_guardian_contact`), and one request per performer per invite.
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

**Done Sunday Sept 13 (production smoke-tested end to end)**
- [x] talentsearch `main` at `b1525bd` deployed to `talent.childactor101.com` (modal CSS fix, FAQ, `/join` registration, no-store DB reads).
- [x] pages101-web `d812675` promoted to `pages.childactor101.com` (admin tabs, link-only invites, Reply-To).
- [x] review_close extended to Nov 30 + status `reviewing`.
- [x] DB migration `20260913000001_p101_opencall_registration_links.sql` applied.
- [x] talentsearch Vercel env rebuilt: Production now points at the Open Call 11 Supabase project (was the legacy `tultuplahemorkofmptd` project) with its own session secret, SES keys, `SES_FROM_ADDRESS`, `TALENTSEARCH_BASE_URL`. Preview SES keys refreshed.
- [x] **SES region is `us-west-2`** on both apps (`AWS_REGION` on talentsearch, `SES_REGION` on pages101-web). `childactor101.com` verification is *Failed* in us-east-1 and that region is sandboxed; us-west-2 is verified with production access (50k/day). If an email ever fails with "not verified in region US-EAST-1", the region var got lost.
- [x] Verified in production: bogus token → `r=unknown`; registration → personal invite emailed (landed in Gmail Inbox, not spam) → link opens gallery (105 cards, hero photos styled, FAQ shows Nov 30) → favorite saved and counted → `registered_via` shown in admin → re-registration deduped → link turned off blocks new registrations but personal link still works → direct invite emailed and redeemed → link-only invite redeemed → revoke denies the live session instantly. All test rows deleted.
- [x] Rep workspace (Sept 14): one-click introductions with contact reveal, All Talent / Saved / Introductions views, progress counter, persistent state. Verified end to end on preview (browser) and production (API): confirm-once form → contact panel with Email Parent / Copy Contact → card flips to View Contact → Introductions list with contact → reload keeps everything → identity carried to the next profile. Both emails delivered (parent "Good news", rep confirmation with contact). Test kid, invite, and logs deleted; your own `corey.acting@gmail.com` invite left in place.
- [x] Notes (Sept 14): every profile has a private per-link Notes box (autosaves on blur, ✎ badge on the card); admin shows ✎ count per invite. Verified end to end in production and cleaned up.
- [x] Final cleanup (Sept 13): rep invite emails from pages101-web now send as "Child Actor 101 <noreply@…>" (relay/sign-in emails keep the Pages101 sender); invite + admin dates format in Pacific time (Nov 30, not Dec 1); legacy `NEXT_PUBLIC_SUPABASE_URL` removed from talentsearch. SES audit: both apps verified sending via us-west-2 from delivered-message headers. **Frozen — no further infra changes before Tuesday.**
- Not exercised: Request Introduction (would email a real family; code unchanged since Phase 5, and SES delivery from talentsearch is now proven). Admin UI clicked-through only via its API; the page is typechecked and linted.

**Tuesday morning**
- [ ] Open `talent.childactor101.com/denied` and `pages.childactor101.com/dashboard/admin/opencall/reps` — both load.

**Smoke test (you)**
- [ ] Admin → Reps → create an invite to **yourself** (agency "Child Actor 101 (test)").
- [ ] Confirm the invite email arrives, from-address looks right, Reply-To is info@.
- [ ] Click the link. Confirm: gallery loads, ~105 cards, filters work, open a profile, photos render in the hero + thumbnails, star a kid, FAQ shows the correct close date.
- [ ] Request Introduction on a known-friendly family's profile (warn them first): confirm-details form appears once → contact panel shows parent name/email/phone → Email Parent opens mail → family receives the "Good news" email with your name/agency/email → you receive the confirmation with the contact → Introductions tab lists them → reload, still there, card says View Contact.
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

Voice reference: your Dec 2025 rep email. Plain, warm, short paragraphs, ALL-CAPS callouts for the audience that needs to hear it (REGIONAL REPS, MANAGERS), "I hope you find some winners." One change from last year: you no longer say "contact the parents on your own" — the gallery has a Request Introduction button that emails the family with the rep's details, and families reply directly. Parent contact info is never shown.

### A. To your rep list (send from your own email; each rep's personal link goes out separately from the system)

**Subject:** Talent Submissions from over 100 youth actors seeking representation

Hey Youth Talent Reps.. It's Corey Ralston from Bohemia Group and [Child Actor 101](https://childactor101.com).

I hope this email catches you at the perfect moment to fill any holes you may have in your youth roster. This year's Open Call brought in some truly strong submissions, and I'm excited to finally get them in front of you.

We just wrapped our 11th Free Online Talent Representation Open Call at Child Actor 101.

As you may know, Child Actor 101 is a parent resource community on Facebook with more than 12,000 members, moderated by 25+ talent agents, managers, casting directors, coaches and other working industry professionals. The goal has always been pretty simple: give parents frank, useful advice about navigating an industry that isn't exactly famous for coming with an instruction manual.

We're always looking for more experienced industry perspectives. If you're not already part of the community and would like to participate as a moderator, podcast guest, blogger, or simply hop in occasionally and answer a few parent questions, please reach out. Your time, wisdom, experience and humanity are genuinely helpful and needed. We all see this business through a slightly different lens, and that's part of what makes the community valuable.

THIS YEAR'S OPEN CALL

We received 105 submissions. Every profile includes headshots, profile and video links, location, and the type of representation they're seeking.

I've personally signed around 20 kids through the Open Call over the past seven years, so I don't say this lightly: there are some real gems in this group.

Regional reps: There are quite a few actors specifically seeking regional representation, so please keep an eye on those submissions.

Managers: You can filter specifically for talent seeking management.

This year's gallery is accessed through your own private link. You'll receive a separate email from noreply@childactor101.com with your access button. Click that button anytime you want to return to the gallery. If you don't see it, check Spam or Promotions. If it's still missing, reply to me and I'll send you a new one.

CONNECTING WITH TALENT

When someone interests you, simply click Request Introduction on their profile. The family is immediately notified that you'd like to connect, and you'll receive the parent/guardian contact information so you can reach out directly. You do not need to ask me for permission or wait for me to make the connection.

You can also save favorites, keep private notes, and revisit everyone you've requested an introduction with when you return. The idea is to make this as easy as possible for you to browse when you have time, leave, and pick up exactly where you left off.

The gallery will remain accessible through November 30.

Please use it. Even if you aren't actively looking to fill a particular slot today, spend a little time browsing. These families participated because they're serious about finding the right representation, and there is a surprisingly broad mix of ages, types, markets and experience levels this year.

ONE MORE QUICK FAVOR

While you're there, please take a minute to check out the [Child Actor 101 Directory](https://directory.childactor101.com). If your agency or management company isn't listed, or the information needs updating, let me know. And if there are photographers, coaches, self-tape studios, schools or other reputable vendors you regularly recommend to families, I'd love those recommendations as well. I'm continuing to build the Directory into a genuinely useful, vetted resource rather than another giant list of whoever managed to find the submission form.

As always, feedback is welcome, whether it's about an individual submission, the gallery itself, or how we can make the Open Call better for reps next year.

I hope you find some winners.

And please feel free to share this with another agent or manager who may be looking for quality young talent. Your access link is intended for your office. If someone at another company would like access, send them my way and I'll get them their own account.

Thank you again for participating and, more importantly, for giving these kids a legitimate opportunity to get in front of working representation.

Corey
Director of Youth Talent, [Bohemia Group](https://bohemiaent.com)
Founder, [Child Actor 101](https://childactor101.com)

---

### F. Rep-group post (paste with a Registration Link)

Hey Youth Talent Reps.. Corey Ralston from Bohemia Group and Child Actor 101 here.

We just wrapped our 11th Online Talent Representation Open Call. 105 kids from across the country looking for reps, with headshots, slates, reels, resumes and casting profile links. You can filter by age, gender, location and the kind of rep they are seeking.

Register here and your personal access link lands in your inbox in about a minute:
[REGISTRATION LINK]

Every submission lists what type of representation they want and where they live. I have personally signed around 20 kids from this over the years. There are some real gems.

REGIONAL REPS. There are many looking just for Regional so please keep your eye on that!

MANAGERS - filter by those seeking management.

When someone interests you, click Request Introduction on their profile. The family is notified right away and you get the parent's contact so you can reach out directly. Save favorites, keep private notes, and everyone you've requested is waiting under Introductions when you come back.

Open through November 30. Everyone in your office can register for their own link. Please keep this inside the group.

I hope you find some winners!

Corey

---

### B. To families whose child was submitted (EmailOctopus, "submitted" segment)

**Subject:** Your Open Call submission is now in front of reps

Hi [First name],

As of today, [Child's name]'s Open Call 11 submission is live in a private gallery being reviewed by youth talent agents and managers from across the country. More offices are being added all week.

Here is how it works so nobody is refreshing their inbox for the wrong thing.

What reps see while browsing: your child's headshots, slate, reel, resume, casting profile links, and the details you entered. Not your name, email, or phone.

What happens if a rep is interested: they click Request Introduction. The same moment, you get an email from Child Actor 101 with the rep's name, agency, role and email, and the rep receives the contact information you provided when you submitted. They may reach out directly, or you can write to them first. Please try to reply within a few days, even if it is just to set up a better time to talk. If it is not a fit, a polite no is fine.

What to do right now: make sure your slate and reel links are public and play on a phone. Every year a few are set to private and a rep moves on. Check them today. Then leave it alone.

How long: the gallery stays open through November 30. Some reps look on day one. Some look in week six. Both are normal.

What this is not: a guarantee. Not every kid gets a request, and that says nothing about your kid. Reps are building specific rosters. I have watched kids get zero requests in one Open Call and three the next.

If a rep reaches out and you want a gut check before replying, you know where I am.

Proud of you for getting it done.

Corey

---

### C. Optional: consent clarification for families (fold into B if you want it on record)

> A note on privacy. Your contact information is not visible to reps browsing the gallery. A rep only receives it after they specifically request an introduction to your child, and you are emailed at the same moment telling you exactly who. Every one of those requests is logged.

---

### D. Nudge to reps who have not opened their link (Thursday)

**Subject:** Did the Open Call link find you?

Hey [First name],

Quick one. Your Open Call 11 access link went out Tuesday and it has not been opened yet, which usually means it is sitting in spam under noreply@childactor101.com.

If you can find it, great, click the button. If you cannot, reply here and I will send a fresh one.

105 kids, and a few of the ones I would have bet on are already getting introduction requests.

Corey

---

### E. Closing-soon notice to reps (one week before Nov 30)

**Subject:** Open Call 11 gallery closes November 30

Hey Youth Talent Reps.. Corey here.

The Open Call 11 gallery closes November 30 and then the link stops working. The families consented to a window, not forever.

If you starred anyone or left yourself a note and never hit Request Introduction, this is the week. Your favorites and notes are still saved under your link.

Thank you for looking. Every year a couple of these kids end up on a call sheet because someone in your office took twenty minutes.

Corey

---

## Rep FAQ (what now appears at the bottom of the gallery)

- **How do I get back in later?** Click the same button in the invite email. Every click = fresh 8-hour session. Bookmarking the page itself lands on "Access Required."
- **Can I share this with my office?** Yes, whole company. Not outside it; email info@ for a colleague's own link.
- **How do I contact a family?** Request Introduction on the profile. First time, confirm your details once; then one click. Family is notified, you see the parent's name/email/phone immediately (Email Parent / Copy Contact), and it stays under Introductions. Note optional.
- **What do Saved, Notes and Introductions do?** Saved = shortlist. Notes = private per-profile box. Introductions = everyone requested, with contact. All persist per link; families and other offices never see any of it.
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
