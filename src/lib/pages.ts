import { getPageBySlug as getSamplePageBySlug } from "@/lib/sample-data";
import { mapActorPageRows, type ActorPageRow, type PageSectionRow } from "@/lib/page-mapping";
import { getSupabasePublicClient } from "@/lib/supabase/server";

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

  return mapActorPageRows(pageRow, sectionRows ?? []);
}
