import type {
  ActorPage,
  ActorPageSection,
  FontPair,
  PageLink,
  Rep,
  SectionType,
  TemplateId
} from "@/lib/types";

export type ActorPageRow = {
  id: string;
  user_id: string;
  slug: string;
  template: string;
  accent: string | null;
  font_pair: string | null;
  display_name: string;
  status_line: string | null;
  union_status: string | null;
  age_range: string | null;
  market: string | null;
  has_rep: boolean;
  reps: unknown;
  links: unknown;
  slate_url: string | null;
  published: boolean;
  noindex: boolean;
};

export type PageSectionRow = {
  id: string;
  type: string;
  enabled: boolean;
  sort_order: number;
  content: unknown;
};

export function mapActorPageRows(page: ActorPageRow, sections: PageSectionRow[], plan: ActorPage["plan"] = "free"): ActorPage {
  return {
    id: page.id,
    userId: page.user_id,
    slug: page.slug,
    plan,
    template: getTemplateId(page.template),
    accent: page.accent,
    fontPair: getFontPair(page.font_pair),
    displayName: page.display_name,
    statusLine: page.status_line ?? "",
    unionStatus: page.union_status ?? "",
    ageRange: page.age_range ?? "",
    market: page.market ?? "",
    hasRep: page.has_rep,
    reps: getArray<Rep>(page.reps),
    links: getArray<PageLink>(page.links),
    slateUrl: page.slate_url,
    published: page.published,
    noindex: page.noindex,
    sections: sections.flatMap(mapSection).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

function mapSection(section: PageSectionRow): ActorPageSection[] {
  const type = getSectionType(section.type);
  if (!type) {
    return [];
  }

  const base = {
    id: section.id,
    enabled: section.enabled,
    sortOrder: section.sort_order
  };

  const content = getRecord(section.content);

  if (type === "headshots") {
    return [{ ...base, type, content: { headshots: getArray(content.headshots) } }];
  }

  if (type === "resume") {
    return [
      {
        ...base,
        type,
        content: {
          syncedWithResume101: Boolean(content.syncedWithResume101),
          updatedAt: getString(content.updatedAt),
          credits: getArray(content.credits),
          fileUrl: getOptionalString(content.fileUrl),
          fileName: getOptionalString(content.fileName)
        }
      }
    ];
  }

  if (type === "clips") {
    return [{ ...base, type, content: { clips: getArray(content.clips) } }];
  }

  if (type === "feed") {
    return [{ ...base, type, content: { items: getArray(content.items) } }];
  }

  return [
    {
      ...base,
      type,
      content: {
        quote: getString(content.quote),
        attribution: getString(content.attribution)
      }
    }
  ];
}

function getTemplateId(value: string): TemplateId {
  if (value === "splash" || value === "prestige") {
    return value;
  }

  return "classic";
}

function getFontPair(value: string | null): FontPair | null {
  if (
    value === "template" ||
    value === "fraunces-inter" ||
    value === "cormorant-inter" ||
    value === "bricolage-inter" ||
    value === "outfit-inter"
  ) {
    return value;
  }

  return null;
}

function getSectionType(value: string): SectionType | null {
  if (value === "headshots" || value === "resume" || value === "clips" || value === "feed" || value === "press") {
    return value;
  }

  return null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
