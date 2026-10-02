# Open Call 11 Follow-Up Survey

The emails below are sent by the admin tool (`/dashboard/admin/opencall/survey`),
one per submitted application, each with that actor's personal link. The live
copy is in `src/lib/opencall-survey-email.ts`; this file is the readable version.

## How privacy works

Two separate things are stored, and they are never joined for anonymous answers:

| Concept | Table | What it says |
|---|---|---|
| Participation | `p101_opencall_survey_invites` | "Invitation #72 was completed." Drives response rate, de-duplication, reminders. |
| Survey data | `p101_opencall_survey_responses` | "Respondent reported 2 rep contacts, 1 meeting, 0 offers, prepared 3/5." |

- **Named** responses carry `application_id` + `invite_id`, so results can be analysed against the submission. The family can reopen the same link to update their outcome as things change.
- **Anonymous** responses carry neither (enforced by a DB constraint). No name, email, token, IP or user agent is stored. The date is rounded to the start of the week so a timestamp can't be matched to an invitation's `completed_at`.
- An anonymous respondent who volunteers a name or email at the end is told the response is no longer anonymous, and the server then stores it as named and linked.
- "May I quote your comments?" is a separate choice from anonymity. Anonymous respondents can only answer "Yes, anonymously" or "No".

## Runbook

1. Set `SURVEY_LINK_SECRET` (random, 32+ chars) in the deployment environment. Optional: `SURVEY_BASE_URL` (defaults to `https://pages.childactor101.com`).
2. Apply `supabase/migrations/202610020001_p101_opencall_survey.sql`.
3. Open `/dashboard/admin/opencall/survey` and run, in order: **Create invitations**, **Email invitations**, later **Remind non-responders**. Each shows a count and asks before doing anything.
4. Results: `select * from p101_opencall_survey_participation;` and `select * from p101_opencall_survey_summary;`

Reminders re-send the same link (it is derived from the invitation id, not stored), and only go to families who haven't finished.

---

## Email 1 (invitation)

**Subject:** So... did anyone call? Open Call 11 follow-up for {actor} (3 minutes)

Hi Open Call families,

Quick question, and I promise it's one you can answer even if the answer is "crickets."

61 talent agents and managers walked through the Open Call 11 gallery this year. I can see that they looked. What I can't see is what happened next. Who reached out? Who asked for a self-tape? Who took a meeting? Did anybody actually sign? And when that email or phone call landed in your inbox at 9pm on a Tuesday, did you feel ready for it, or did you stare at your phone like it was a live grenade?

I don't know. And I really, really want to.

This is not a satisfaction survey. I don't need you to tell me I'm wonderful. I need real numbers about what is working and what is not, so I can fix the next Open Call instead of just feeling good about the last one.

**Please answer even if {actor} heard nothing at all.** I mean that. "Nobody contacted us" is not a failed answer. It's one of the most useful answers I can get, and if I only hear from the families with good news, I'm flying blind with a very flattering tailwind.

Here's the deal:

It takes about 3 minutes.

You choose how to answer. With {actor}'s name attached, I can connect your feedback to the Open Call submission and do some richer digging. Anonymously, your answers are not connected to {actor}, your submission, or you. Not "anonymous-ish." Actually anonymous. I want honest feedback, so pick whichever makes you most comfortable.

This link is personal to {actor}'s submission. That's how I make sure each actor is counted once (and nobody gets nagged after they've finished). It doesn't change how anonymous you can be.

[ Take the survey ]

I read every single answer, including the long angry ones and the ones that say I should have done this three weeks ago (fair).

Thank you for trusting me with your kid's shot at this. It matters more to me than you probably realize.

Corey

Corey Ralston
Founder, Child Actor 101
Director of Youth Talent, Bohemia Group

---

## Email 2 (reminder, about a week later, non-responders only)

**Subject:** Last call: Open Call 11 follow-up for {actor}

Hi again,

If you've already filled out the Open Call 11 follow-up survey for {actor}, thank you. You're a hero and you can delete this.

If you haven't, here's the pitch: 3 minutes, anonymous if you want, and no answer is the wrong answer. "Nobody called" counts. Honestly, it counts double.

[ Take the survey ]

The more families I hear from, the better the next Open Call gets. That's the whole trade.

Corey
