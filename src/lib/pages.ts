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

  let plan: "free" | "plus" = "free";

  if (!error && data) {
    const { data: subData } = await supabase
      .from("p101_subscriptions")
      .select("plan, status")
      .eq("user_id", data.user_id)
      .maybeSingle();

    if (subData?.plan === "plus" && (subData?.status === "active" || subData?.status === "trialing")) {
      plan = "plus";
    }

    return mapActorPageRows(
      data as ActorPageRow,
      getJoinedSections(data),
      plan
    );
  }

  if (error) {
    console.error("Pages101 public page query failed", error);
  }

  const { data: domainData, error: domainError } = await supabase
    .from("p101_custom_domains")
    .select("verified, p101_actor_pages(*, p101_page_sections(*))")
    .eq("domain", slug)
    .eq("verified", true)
    .maybeSingle<JoinedCustomDomainRow>();

  if (domainError) {
    console.error("Pages101 custom domain query failed", domainError);
  }

  const mappedPage = domainData?.p101_actor_pages;
  if (mappedPage) {
    const { data: subData } = await supabase
      .from("p101_subscriptions")
      .select("plan, status")
      .eq("user_id", mappedPage.user_id)
      .maybeSingle();

    if (subData?.plan === "plus" && (subData?.status === "active" || subData?.status === "trialing")) {
      plan = "plus";
    }

    return mapActorPageRows(
      mappedPage as ActorPageRow,
      getJoinedSections(mappedPage),
      plan
    );
  }

  return process.env.NODE_ENV === "production" ? null : getSamplePageBySlug(slug);
}

type JoinedPageRow = ActorPageRow & {
  p101_page_sections?: PageSectionRow[] | null;
};

type JoinedCustomDomainRow = {
  verified: boolean;
  p101_actor_pages?: JoinedPageRow | null;
};

function getJoinedSections(pageRow: unknown): PageSectionRow[] {
  const typedPage = pageRow as JoinedPageRow;
  return Array.isArray(typedPage.p101_page_sections) ? typedPage.p101_page_sections : [];
}
