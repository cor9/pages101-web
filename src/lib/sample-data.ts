import type { ActorPage } from "./types";

const headshotBase = "/pageslogo.png";

export const samplePages: ActorPage[] = [
  {
    id: "2c8b26bf-b103-4e91-91f6-49a8d0c7f16f",
    userId: "seed-user",
    slug: "maya-ralston",
    plan: "free",
    template: "classic",
    accent: null,
    fontPair: null,
    displayName: "Maya Ralston",
    statusLine: "Young performer for film, TV, commercial, and voiceover",
    unionStatus: "SAG-AFTRA Eligible",
    ageRange: "Portrays 9-12",
    market: "Los Angeles / Southeast",
    hasRep: false,
    reps: [],
    links: [
      { label: "Actors Access", url: "https://actorsaccess.com" },
      { label: "IMDb", url: "https://imdb.com" }
    ],
    slateUrl: "https://player.vimeo.com/video/76979871",
    published: true,
    noindex: true,
    sections: [
      {
        id: "headshots",
        type: "headshots",
        enabled: true,
        sortOrder: 10,
        content: {
          headshots: [
            { id: "h1", src: headshotBase, alt: "Featured theatrical headshot for Maya Ralston", label: "Theatrical", featured: true },
            { id: "h2", src: headshotBase, alt: "Commercial headshot for Maya Ralston", label: "Commercial" },
            { id: "h3", src: headshotBase, alt: "Light theatrical headshot for Maya Ralston", label: "Light Theatrical" },
            { id: "h4", src: headshotBase, alt: "Character look headshot for Maya Ralston", label: "Character" }
          ]
        }
      },
      {
        id: "resume",
        type: "resume",
        enabled: true,
        sortOrder: 20,
        content: {
          syncedWithResume101: true,
          updatedAt: "June 2026",
          credits: [
            { project: "The Library Door", role: "Supporting", company: "Independent Short" },
            { project: "BrightMart Back to School", role: "Principal", company: "Commercial" },
            { project: "Matilda Jr.", role: "Lavender", company: "Community Theatre" }
          ]
        }
      },
      {
        id: "clips",
        type: "clips",
        enabled: true,
        sortOrder: 30,
        content: {
          clips: [
            { id: "c1", title: "Demo Reel", category: "Demo Reel", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" },
            { id: "c2", title: "About Me", category: "About Me", embedUrl: "https://player.vimeo.com/video/76979871" }
          ]
        }
      },
      {
        id: "press",
        type: "press",
        enabled: true,
        sortOrder: 40,
        content: {
          quote: "Prepared, present, and unusually natural on camera.",
          attribution: "Casting workshop note"
        }
      },
      {
        id: "feed",
        type: "feed",
        enabled: false,
        sortOrder: 50,
        content: {
          items: [
            {
              id: "f1",
              date: "2026-06-01",
              title: "Booked a new commercial",
              body: "A quick win from this month, shared without locations or schedule details."
            }
          ]
        }
      }
    ]
  }
];

export function getPageBySlug(slug: string) {
  return samplePages.find((page) => page.slug === slug && page.published) ?? null;
}
