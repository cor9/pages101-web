// Parent-facing survey emails (Corey's voice). Copy lives here so the admin
// send route and docs/opencall-survey-email.md stay in step.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type SurveyEmailKind = "invite" | "reminder";

export function surveyEmailSubject(kind: SurveyEmailKind, actorName: string): string {
  return kind === "invite"
    ? `So... did anyone call? Open Call 11 follow-up for ${actorName} (3 minutes)`
    : `Last call: Open Call 11 follow-up for ${actorName}`;
}

function shell(inner: string): string {
  return `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1b1b1b;max-width:600px;margin:0 auto;padding:8px">${inner}</div>`;
}

function button(url: string): string {
  return `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#c8402a;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;padding:13px 26px;border-radius:6px;display:inline-block">Take the survey</a></p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666">Button not working? Paste this into your browser:<br><span style="word-break:break-all">${esc(url)}</span></p>`;
}

const SIGNOFF = `<p>Corey</p>
<p style="font-size:14px;color:#555">Corey Ralston<br>Founder, Child Actor 101<br>Director of Youth Talent, Bohemia Group</p>`;

export function buildSurveyEmailHtml(kind: SurveyEmailKind, opts: { actorName: string; url: string }): string {
  const actor = esc(opts.actorName);

  if (kind === "reminder") {
    return shell(`
<p>Hi again,</p>
<p>If you've already filled out the Open Call 11 follow-up survey for ${actor}, thank you. You're a hero and you can delete this.</p>
<p>If you haven't, here's the pitch: 3 minutes, anonymous if you want, and no answer is the wrong answer. "Nobody called" counts. Honestly, it counts double.</p>
${button(opts.url)}
<p>The more families I hear from, the better the next Open Call gets. That's the whole trade.</p>
${SIGNOFF}`);
  }

  return shell(`
<p>Hi Open Call families,</p>
<p>Quick question, and I promise it's one you can answer even if the answer is "crickets."</p>
<p>61 talent agents and managers walked through the Open Call 11 gallery this year. I can see that they looked. What I can't see is what happened next. Who reached out? Who asked for a self-tape? Who took a meeting? Did anybody actually sign? And when that email or phone call landed in your inbox at 9pm on a Tuesday, did you feel ready for it, or did you stare at your phone like it was a live grenade?</p>
<p>I don't know. And I really, really want to.</p>
<p>This is not a satisfaction survey. I don't need you to tell me I'm wonderful. I need real numbers about what is working and what is not, so I can fix the next Open Call instead of just feeling good about the last one.</p>
<p><strong>Please answer even if ${actor} heard nothing at all.</strong> I mean that. "Nobody contacted us" is not a failed answer. It's one of the most useful answers I can get, and if I only hear from the families with good news, I'm flying blind with a very flattering tailwind.</p>
<p>Here's the deal:</p>
<p>It takes about 3 minutes.</p>
<p>You choose how to answer. With ${actor}'s name attached, I can connect your feedback to the Open Call submission and do some richer digging. Anonymously, your answers are not connected to ${actor}, your submission, or you. Not "anonymous-ish." Actually anonymous. I want honest feedback, so pick whichever makes you most comfortable.</p>
<p>This link is personal to ${actor}'s submission. That's how I make sure each actor is counted once (and nobody gets nagged after they've finished). It doesn't change how anonymous you can be.</p>
${button(opts.url)}
<p>I read every single answer, including the long angry ones and the ones that say I should have done this three weeks ago (fair).</p>
<p>Thank you for trusting me with your kid's shot at this. It matters more to me than you probably realize.</p>
${SIGNOFF}`);
}
