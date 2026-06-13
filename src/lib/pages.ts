import { getPageBySlug as getSamplePageBySlug } from "@/lib/sample-data";
import { getSupabasePublicClient } from "@/lib/supabase/server";
import type {
  ActorPage,
  ActorPageSection,
  FontPair,
  PageLink,
  Rep,
  SectionType,
  TemplateId
} from "@/lib/types";

type ActorPageRow = {
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

type PageSectionRow = {
  id: string;
  type: string;
  enabled: boolean;
  sort_order: number;
  content: unknown;
};

export async function getPublicPageBySlug(slug: string) {
  const supabase = getSupabasePublicClient();

  if (!supabase) {
    return getSamplePageBySlug(slug);
  }

  const { data: pageRow, error: pageError } = await supabase
    .from("actor_pages")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle<ActorPageRow>();

  if (pageError) {
    console.error("Pages101 public page query failed", pageError);
    return process.env.NODE_ENV === "production" ? null : getSamplePageBySlug(slug);
  }

  if (!pageRow) {
    return process.env.NODE_ENV === "production" ? null : getSamplePageBySlug(slug);
  }

  const { data: sectionRows, error: sectionError } = await supabase
    .from("page_sections")
    .select("*")
    .eq("page_id", pageRow.id)
    .order("sort_order", { ascending: true })
    .returns<PageSectionRow[]>();

  if (sectionError) {
    console.error("Pages101 public sections query failed", sectionError);
    return process.env.NODE_ENV === "production" ? null : getSamplePageBySlug(slug);
  }

  return mapActorPage(pageRow, sectionRows ?? []);
}

function mapActorPage(page: ActorPageRow, sections: PageSectionRow[]): ActorPage {
  return {
    id: page.id,
    userId: page.user_id,
    slug: page.slug,
    plan: "free",
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
          credits: getArray(content.credits)
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
