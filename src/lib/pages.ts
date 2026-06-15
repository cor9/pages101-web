import { getPageBySlug as getSamplePageBySlug } from "@/lib/sample-data";
import { mapActorPageRows, type ActorPageRow, type PageSectionRow } from "@/lib/page-mapping";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function getPublicPageBySlug(slug: string) {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return getSamplePageBySlug(slug);
  }

  const { data, error } = await supabase
    .from("p101_actor_pages")
    .select("*, p101_page_sections(*)")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) {
    console.error("Pages101 public page query failed", error);
    return process.env.NODE_ENV === "production" ? null : getSamplePageBySlug(slug);
  }

  return mapActorPageRows(
    data as ActorPageRow,
    getJoinedSections(data),
    "free"
  );
}

type JoinedPageRow = ActorPageRow & {
  p101_page_sections?: PageSectionRow[] | null;
};

function getJoinedSections(pageRow: unknown): PageSectionRow[] {
  const typedPage = pageRow as JoinedPageRow;
  return Array.isArray(typedPage.p101_page_sections) ? typedPage.p101_page_sections : [];
}
