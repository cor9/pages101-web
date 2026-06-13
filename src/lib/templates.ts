import type { FontPair, TemplateId } from "./types";

export type TemplateTokens = {
  id: TemplateId;
  label: string;
  tier: "free" | "plus";
  personality: string;
  accent: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  displayFont: string;
  bodyFont: string;
};

export const templateTokens: Record<TemplateId, TemplateTokens> = {
  classic: {
    id: "classic",
    label: "Classic",
    tier: "free",
    personality: "Clean, casting-ready, Carrd-like",
    accent: "#C8553D",
    background: "#ffffff",
    surface: "#ffffff",
    ink: "#1F1D1A",
    muted: "#6E6862",
    displayFont: "var(--font-outfit), Outfit, Inter, system-ui, sans-serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  splash: {
    id: "splash",
    label: "Splash",
    tier: "plus",
    personality: "Bold, youthful, poster energy",
    accent: "#FF4D8D",
    background: "#FFDE59",
    surface: "#ffffff",
    ink: "#221C3A",
    muted: "rgba(34, 28, 58, 0.75)",
    displayFont: "var(--font-bricolage), Bricolage Grotesque, Inter, system-ui, sans-serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  prestige: {
    id: "prestige",
    label: "Prestige",
    tier: "plus",
    personality: "Full-bleed, editorial, Squarespace gravitas",
    accent: "#8A6F47",
    background: "#FAF8F4",
    surface: "#ffffff",
    ink: "#1E1C19",
    muted: "#6E675E",
    displayFont: "var(--font-cormorant), Cormorant Garamond, Georgia, serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  }
};

export const accentSwatches = [
  { label: "Auto", value: null },
  { label: "Marquee Red", value: "#C8553D" },
  { label: "Pink", value: "#FF4D8D" },
  { label: "Blue", value: "#2368d8" },
  { label: "Green", value: "#268060" },
  { label: "Gold", value: "#a97725" }
] as const;

export const fontPairOptions: Array<{ id: FontPair; label: string; display: string; body: string }> = [
  {
    id: "template",
    label: "Template Default",
    display: "inherit",
    body: "inherit"
  },
  {
    id: "fraunces-inter",
    label: "Fraunces + Inter",
    display: "var(--font-fraunces), Fraunces, Georgia, serif",
    body: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  {
    id: "cormorant-inter",
    label: "Cormorant + Inter",
    display: "var(--font-cormorant), Cormorant Garamond, Georgia, serif",
    body: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  {
    id: "bricolage-inter",
    label: "Bricolage + Inter",
    display: "var(--font-bricolage), Bricolage Grotesque, Inter, system-ui, sans-serif",
    body: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  {
    id: "outfit-inter",
    label: "Outfit + Inter",
    display: "Outfit, Inter, system-ui, sans-serif",
    body: "var(--font-inter), Inter, system-ui, sans-serif"
  }
];

export function getTemplateCss(templateId: TemplateId, accent: string | null, fontPair: FontPair | null) {
  const template = templateTokens[templateId];
  const pair = fontPairOptions.find((option) => option.id === fontPair);

  return {
    "--ua": accent ?? template.accent,
    "--ub": pair && pair.id !== "template" ? pair.body : template.bodyFont,
    "--ud": pair && pair.id !== "template" ? pair.display : template.displayFont,
    "--page-bg": template.background,
    "--page-surface": template.surface,
    "--page-ink": template.ink,
    "--page-muted": template.muted
  } as React.CSSProperties;
}
