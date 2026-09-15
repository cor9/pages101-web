// Shared, real Open Call 11 copy used by all three visual-direction mockups
// (/opencall-concept-a, /opencall-concept-b, /opencall-concept-c).
// Content is identical across concepts so the visual direction can be compared fairly.
// These are static design mockups — no backend wiring.

export const TRUST_SENTENCE =
  "No purchase improves your child’s chances. Nothing we sell touches selection.";

export const OC = {
  brand: "Pages101",
  org: "Child Actor 101",
  edition: "11th Annual",
  year: 2026,

  hero: {
    eyebrow: "Child Actor 101 · 11th Annual",
    title: "The Online Talent Representation Open Call",
    subhead:
      "Every year, young performers across the country submit one profile — and real talent representatives review every single one. The 11th Open Call is now accepting submissions for 2026.",
    primaryCta: "Start Your Application",
    secondaryCta: "See how it works",
    note: "Free to apply · Submitted by a parent or legal guardian",
  },

  // Honest, defensible figures — no fabricated outcome numbers
  stats: [
    { value: "11", label: "years of Open Calls" },
    { value: "100%", label: "of submissions reviewed" },
    { value: "$0", label: "to apply" },
    { value: "6", label: "representation categories" },
  ],

  what: {
    heading: "What the Open Call is",
    body:
      "A direct line between young performers and the people who represent them. Families build one casting-ready profile on Pages101. Verified talent agents and managers review submissions privately and reach out when there’s a fit.",
    tail: "No agency fees. No auditions to buy. One honest look from the industry.",
  },

  trust: {
    heading: "Why families trust it",
    points: [
      {
        title: "Real representatives, verified",
        body: "Every reviewer is a vetted talent agent or manager, invited by Child Actor 101 and bound to confidentiality.",
      },
      {
        title: "Guardian-controlled",
        body: "A parent or legal guardian creates the submission, gives consent, and stays in the loop for every contact.",
      },
      {
        title: "Private by design",
        body: "Your child’s profile is seen only by authorized reviewers for this Open Call — never public, never sold.",
      },
      {
        title: "Eleven years of connections",
        body: "The Open Call has connected families with legitimate representation since 2015.",
      },
    ],
  },

  how: {
    heading: "How it works",
    steps: [
      {
        n: "01",
        title: "Build the profile",
        body: "Headshots, stats, reel, and resume in one guided application. Start from an existing Pages101 performer page or a blank form.",
      },
      {
        n: "02",
        title: "Guardian consent & submit",
        body: "A parent or legal guardian reviews and authorizes the submission before it’s sent. Nothing is shared without consent.",
      },
      {
        n: "03",
        title: "Representatives review",
        body: "Verified agents and managers review every submission privately during the review window — talent first, standardized profiles.",
      },
      {
        n: "04",
        title: "Introductions, on your terms",
        body: "When a representative is interested, Pages101 reaches out to the guardian on file. You decide whether to connect.",
      },
    ],
  },

  who: {
    heading: "Who should apply",
    items: [
      "Young performers seeking theatrical (Film & TV), commercial, voiceover, print, musical theater, or hosting representation.",
      "Performers with or without current representation — both are welcome.",
      "Any location, including local-hire markets. Union and non-union alike.",
      "Submitted by a parent or legal guardian on the performer’s behalf.",
    ],
  },

  dates: {
    heading: "Important dates",
    items: [
      { label: "Submissions open", value: "August 4, 2026" },
      { label: "Submission deadline", value: "September 15, 2026" },
      { label: "Representative review", value: "Sept 16 – Oct 10, 2026" },
      { label: "Introductions begin", value: "Rolling, from September 2026" },
    ],
  },

  reps: {
    heading: "What representatives see",
    intro:
      "Reviewers see a clean, standardized profile — the same fields for every performer, so talent speaks first.",
    see: [
      "Performer name and age",
      "Location and local-hire markets",
      "Union status, Coogan, work permit, passport",
      "What they’re seeking",
      "Current representation, if any",
      "Headshots, slate, and reel",
      "Resume and casting profiles",
      "Supplemental notes",
    ],
    neverHeading: "What they never see",
    never: [
      "Guardian name, email, or phone",
      "Your home address",
      "Anything you don’t add yourself",
    ],
  },

  privacy: {
    heading: "Privacy & guardian contact",
    body:
      "Guardian contact information is collected for one reason: so we can reach you — never the reviewer. Representatives cannot see or search a guardian’s name, email, or phone. When a reviewer requests an introduction, Pages101 contacts the guardian on file, and the family decides whether to respond.",
    tail: "You can withdraw a submission at any time.",
  },

  faq: {
    heading: "Questions families ask",
    items: [
      {
        q: "Does it cost anything to apply?",
        a: "No. Submitting to the Open Call is free. Pages101 offers optional products, but per our promise: no purchase improves your child’s chances. Nothing we sell touches selection.",
      },
      {
        q: "Who reviews the submissions?",
        a: "Verified talent agents and managers invited by Child Actor 101. Reviewers agree to confidentiality and see only the standardized profile.",
      },
      {
        q: "My child already has representation. Can they still apply?",
        a: "Yes. You can note current representation, and it’s shared with reviewers for context.",
      },
      {
        q: "Is my child’s information public?",
        a: "No. Profiles are private to authorized reviewers for this Open Call. They are never listed publicly or sold.",
      },
      {
        q: "Who is allowed to submit?",
        a: "A parent or legal guardian must create and authorize every submission.",
      },
      {
        q: "What happens if a representative is interested?",
        a: "Pages101 reaches out to the guardian on file. You choose whether to connect — there’s no obligation.",
      },
    ],
  },

  finalCta: {
    heading: "The 11th Open Call is now accepting submissions.",
    body: "Build one profile. Let the industry take an honest look.",
    cta: "Start Your Application",
    note: "Free to apply · Submission deadline September 15, 2026",
  },
} as const;
