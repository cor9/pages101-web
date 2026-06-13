export type Plan = "free" | "plus";

export type TemplateId = "classic" | "splash" | "prestige";

export type FontPair =
  | "template"
  | "fraunces-inter"
  | "cormorant-inter"
  | "bricolage-inter"
  | "outfit-inter";

export type SectionType = "headshots" | "resume" | "clips" | "feed" | "press";

export type Rep = {
  name: string;
  role: "agent" | "manager";
  email: string;
};

export type PageLink = {
  label: string;
  url: string;
};

export type Headshot = {
  id: string;
  src: string;
  alt: string;
  label: string;
  featured?: boolean;
};

export type ResumeCredit = {
  project: string;
  role: string;
  company: string;
};

export type ResumeSection = {
  syncedWithResume101: boolean;
  updatedAt: string;
  credits: ResumeCredit[];
  fileUrl?: string;
  fileName?: string;
};

export type Clip = {
  id: string;
  title: string;
  category: "Booked Work" | "Demo Reel" | "About Me" | "VO Reel" | "Singing";
  embedUrl: string;
};

export type FeedItem = {
  id: string;
  date: string;
  title: string;
  body: string;
  image?: string;
};

export type PressQuote = {
  quote: string;
  attribution: string;
};

export type PageSectionBase<TType extends SectionType, TContent> = {
  id: string;
  type: TType;
  enabled: boolean;
  sortOrder: number;
  content: TContent;
};

export type ActorPageSection =
  | PageSectionBase<"headshots", { headshots: Headshot[] }>
  | PageSectionBase<"resume", ResumeSection>
  | PageSectionBase<"clips", { clips: Clip[] }>
  | PageSectionBase<"feed", { items: FeedItem[] }>
  | PageSectionBase<"press", PressQuote>;

export type ActorPage = {
  id: string;
  userId: string;
  slug: string;
  plan: Plan;
  template: TemplateId;
  accent: string | null;
  fontPair: FontPair | null;
  displayName: string;
  statusLine: string;
  unionStatus: string;
  ageRange: string;
  market: string;
  hasRep: boolean;
  reps: Rep[];
  links: PageLink[];
  slateUrl: string | null;
  published: boolean;
  noindex: boolean;
  sections: ActorPageSection[];
};
