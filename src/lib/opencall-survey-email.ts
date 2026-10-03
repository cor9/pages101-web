// Parent-facing survey emails (Corey's voice). Copy lives here so the admin
// send route and docs/opencall-survey-email.md stay in step.
//
// Layout notes: table-based with inline styles so it renders in Gmail, Apple
// Mail and Outlook. Only system fonts (web fonts are unreliable in email) and
// no images, so nothing is blocked and there's no tracking pixel.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type SurveyEmailKind = "invite" | "reminder";

export function surveyEmailSubject(kind: SurveyEmailKind, actorName: string): string {
  return kind === "invite"
    ? `So... did anyone call? Open Call 11 follow-up for ${actorName} (3 minutes)`
    : `Last call: Open Call 11 follow-up for ${actorName}`;
}

// Palette matches the Pages101 site.
const C = {
  cream: "#f5efe6",
  paper: "#ffffff",
  ink: "#2b2320",
  soft: "#6b5f56",
  marquee: "#c8553d",
  deep: "#b5271c",
  line: "#e6dccd",
  tint: "#faf5ec",
};
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function layout(preheader: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Open Call 11 follow-up</title>
<style>
  @media only screen and (max-width:620px){
    .wrap{padding:12px 8px !important}
    .card-pad{padding:26px 20px !important}
    .h1{font-size:30px !important;line-height:1.15 !important}
    .fact{display:block !important;width:100% !important;box-sizing:border-box !important;border-right:0 !important;border-bottom:1px solid ${C.line} !important}
    .opt{display:block !important;width:100% !important;box-sizing:border-box !important;padding:0 0 12px 0 !important}
    .opt table{height:auto !important}
    .btn a{display:block !important;text-align:center !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};font-size:1px;line-height:1px;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
<tr><td align="center" class="wrap" style="padding:28px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 4px 14px 4px;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.soft};">
      <span style="color:${C.marquee};font-weight:800;">Child Actor 101</span> &nbsp;&middot;&nbsp; Open Call 11 Follow-Up
    </td></tr>
    <tr><td style="background:${C.marquee};height:5px;line-height:5px;font-size:0;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
    <tr><td class="card-pad" style="background:${C.paper};padding:36px 40px 32px 40px;border:1px solid ${C.line};border-top:0;border-radius:0 0 12px 12px;font-family:${SERIF};font-size:17px;line-height:1.65;color:${C.ink};">
      ${inner}
    </td></tr>
    <tr><td style="padding:18px 8px 0 8px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.soft};text-align:center;">
      You're getting this because an actor was submitted to Child Actor 101's Open Call 11.<br>
      This link is personal to that submission, so please don't forward it.<br>
      Questions? Just reply to this email.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 18px 0;">${html}</p>`;

function headline(text: string): string {
  return `<h1 class="h1" style="margin:0 0 22px 0;font-family:${SERIF};font-style:italic;font-weight:normal;font-size:36px;line-height:1.1;color:${C.ink};">${text}</h1>`;
}

function callout(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px 0;">
<tr><td style="background:${C.tint};border-left:4px solid ${C.marquee};border-radius:0 8px 8px 0;padding:16px 20px;font-family:${SERIF};font-size:17px;line-height:1.6;color:${C.ink};">${html}</td></tr></table>`;
}

function facts(items: [string, string][]): string {
  const cells = items
    .map(
      ([big, small], i) =>
        `<td class="fact" width="33%" valign="top" style="padding:14px 10px;text-align:center;${i < items.length - 1 ? `border-right:1px solid ${C.line};` : ""}">
<div style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${C.marquee};line-height:1.2;">${big}</div>
<div style="font-family:${SANS};font-size:12px;color:${C.soft};line-height:1.4;margin-top:3px;">${small}</div></td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px 0;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};"><tr>${cells}</tr></table>`;
}

function privacyCards(actor: string): string {
  const card = (title: string, body: string, accent: string, pad: string) =>
    `<td class="opt" width="50%" valign="top" style="padding:${pad};">
<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="height:100%;border:1px solid ${C.line};border-top:3px solid ${accent};border-radius:8px;">
<tr><td style="padding:14px 16px;">
<div style="font-family:${SANS};font-size:13px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${C.ink};margin-bottom:6px;">${title}</div>
<div style="font-family:${SERIF};font-size:15px;line-height:1.55;color:${C.soft};">${body}</div>
</td></tr></table></td>`;
  return `<p style="margin:0 0 10px 0;">You choose how to answer. I want honest feedback, so pick whichever makes you most comfortable.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr>
${card(`With ${actor}&rsquo;s name`, `I can connect your feedback to the Open Call submission and do some richer digging.`, C.marquee, "0 6px 0 0")}
${card("Anonymously", `Not connected to ${actor}, your submission, or you. Not &ldquo;anonymous-ish.&rdquo; Actually anonymous.`, C.soft, "0 0 0 6px")}
</tr></table>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:26px 0 12px 0;"><tr>
<td align="center" bgcolor="${C.marquee}" style="border-radius:8px;">
<a href="${esc(url)}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background:${C.marquee};">${label} &rarr;</a>
</td></tr></table>
<p style="margin:0 0 26px 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.soft};">Button not working? Paste this link into your browser:<br><a href="${esc(url)}" style="color:${C.soft};word-break:break-all;">${esc(url)}</a></p>`;
}

const SIGNOFF = `<p style="margin:0 0 4px 0;font-family:${SERIF};font-style:italic;font-size:26px;color:${C.ink};">Corey</p>
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.55;color:${C.soft};">Corey Ralston<br>Founder, Child Actor 101<br>Director of Youth Talent, Bohemia Group</p>`;

export function buildSurveyEmailHtml(kind: SurveyEmailKind, opts: { actorName: string; url: string }): string {
  const actor = esc(opts.actorName);

  if (kind === "reminder") {
    return layout(
      "3 minutes, anonymous if you want. “Nobody called” counts double.",
      `${headline("Last call.")}
${p(`If you've already filled out the Open Call 11 follow-up survey for ${actor}, thank you. You're a hero and you can delete this.`)}
${p(`If you haven't, here's the pitch: 3 minutes, anonymous if you want, and no answer is the wrong answer. &ldquo;Nobody called&rdquo; counts. Honestly, it counts double.`)}
${button(opts.url, "Take the survey")}
${p("The more families I hear from, the better the next Open Call gets. That's the whole trade.")}
${SIGNOFF}`
    );
  }

  return layout(
    "3 minutes. Anonymous if you want. “Nobody called” is a real answer.",
    `${headline("So&hellip; did anyone call?")}
${p("Hi Open Call families,")}
${p("Quick question, and I promise it's one you can answer even if the answer is &ldquo;crickets.&rdquo;")}
${p("61 talent agents and managers walked through the Open Call 11 gallery this year. I can see that they looked. What I can't see is what happened next. Who reached out? Who asked for a self-tape? Who took a meeting? Did anybody actually sign? And when that email or phone call landed in your inbox at 9pm on a Tuesday, did you feel ready for it, or did you stare at your phone like it was a live grenade?")}
${p("I don't know. And I really, really want to.")}
${p("This is not a satisfaction survey. I don't need you to tell me I'm wonderful. I need real numbers about what is working and what is not, so I can fix the next Open Call instead of just feeling good about the last one.")}
${callout(`<strong>Please answer even if ${actor} heard nothing at all.</strong> I mean that. &ldquo;Nobody contacted us&rdquo; is not a failed answer. It's one of the most useful answers I can get, and if I only hear from the families with good news, I'm flying blind with a very flattering tailwind.`)}
${facts([
  ["3 minutes", "start to finish"],
  ["Anonymous", "if you want"],
  ["One link", `personal to ${actor}`],
])}
${privacyCards(actor)}
${p(`<span style="color:${C.soft};font-size:15px;">The link below is personal to ${actor}&rsquo;s submission. That's how I make sure each actor is counted once (and nobody gets nagged after they've finished). It doesn't change how anonymous you can be.</span>`)}
${button(opts.url, "Take the survey")}
${p("I read every single answer, including the long angry ones and the ones that say I should have done this three weeks ago (fair).")}
${p("Thank you for trusting me with your kid's shot at this. It matters more to me than you probably realize.")}
${SIGNOFF}`
  );
}
