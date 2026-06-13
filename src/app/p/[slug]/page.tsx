import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActorPageRenderer } from "@/components/public-page/ActorPageRenderer";
import { getPageBySlug } from "@/lib/sample-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    return {
      title: "Page not found | Pages101"
    };
  }

  return {
    title: `${page.displayName} | Pages101`,
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

export default async function PublicActorPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return <ActorPageRenderer page={page} />;
}
