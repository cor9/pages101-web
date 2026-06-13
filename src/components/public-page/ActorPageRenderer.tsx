import { ClassicActorPageRenderer } from "@/components/public-page/ClassicActorPageRenderer";
import { PrestigeActorPageRenderer } from "@/components/public-page/PrestigeActorPageRenderer";
import { SplashActorPageRenderer } from "@/components/public-page/SplashActorPageRenderer";
import type { ActorPage } from "@/lib/types";

type ActorPageRendererProps = {
  page: ActorPage;
};

export function ActorPageRenderer({ page }: ActorPageRendererProps) {
  if (page.template === "splash") {
    return <SplashActorPageRenderer page={page} />;
  }

  if (page.template === "prestige") {
    return <PrestigeActorPageRenderer page={page} />;
  }

  return <ClassicActorPageRenderer page={page} />;
}
