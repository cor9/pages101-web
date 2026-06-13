import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActorPageRenderer } from "@/components/public-page/ActorPageRenderer";
import { getPublicPageBySlug } from "@/lib/pages";
import type { FontPair, TemplateId } from "@/lib/types";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const page = await getPublicPageBySlug(slug);

  if (!page) {
    return {
      title: "Page not found | Pages101"
    };
  }

  const template = query.draft === "1" ? getTemplateId(query.template) ?? page.template : page.template;

  return {
    title: template === "prestige" ? `${page.displayName} — Actor` : `${page.displayName} — Young Actor`,
    description: page.statusLine,
    robots: page.noindex
      ? {
          index: false,
          follow: false
        }
      : {
          index: true,
          follow: true
        }
  };
}

export default async function PublicActorPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const page = await getPublicPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const draftPage =
    query.draft === "1"
      ? {
          ...page,
          displayName: getQueryValue(query.name) ?? page.displayName,
          statusLine: getQueryValue(query.status) ?? page.statusLine,
          unionStatus: getQueryValue(query.union) ?? page.unionStatus,
          ageRange: getQueryValue(query.age) ?? page.ageRange,
          market: getQueryValue(query.market) ?? page.market,
          accent: getQueryValue(query.accent) ?? page.accent,
          fontPair: getFontPair(query.font) ?? page.fontPair,
          template: getTemplateId(query.template) ?? page.template
        }
      : page;

  return <ActorPageRenderer page={draftPage} />;
}

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getFontPair(value: string | string[] | undefined): FontPair | null {
  const fontPair = getQueryValue(value);
  if (
    fontPair === "template" ||
    fontPair === "fraunces-inter" ||
    fontPair === "cormorant-inter" ||
    fontPair === "bricolage-inter" ||
    fontPair === "outfit-inter"
  ) {
    return fontPair;
  }

  return null;
}

function getTemplateId(value: string | string[] | undefined): TemplateId | null {
  const templateId = getQueryValue(value);
  if (templateId === "classic" || templateId === "splash" || templateId === "prestige") {
    return templateId;
  }

  return null;
}
