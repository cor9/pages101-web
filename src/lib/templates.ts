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
    accent: "#c9282d",
    background: "#fbfaf8",
    surface: "#ffffff",
    ink: "#171717",
    muted: "#6b625d",
    displayFont: "Outfit, Inter, system-ui, sans-serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  splash: {
    id: "splash",
    label: "Splash",
    tier: "plus",
    personality: "Bold, youthful, poster energy",
    accent: "#f04f91",
    background: "#fff03f",
    surface: "#ffffff",
    ink: "#171717",
    muted: "#59443b",
    displayFont: "Bricolage Grotesque, Inter, system-ui, sans-serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  prestige: {
    id: "prestige",
    label: "Prestige",
    tier: "plus",
    personality: "Full-bleed, editorial, Squarespace gravitas",
    accent: "#a97725",
    background: "#f7f1e6",
    surface: "#fffaf0",
    ink: "#211d19",
    muted: "#6d6255",
    displayFont: "var(--font-fraunces), Cormorant Garamond, Georgia, serif",
    bodyFont: "var(--font-inter), Inter, system-ui, sans-serif"
  }
};

export const accentSwatches = [
  { label: "Auto", value: null },
  { label: "Marquee Red", value: "#c9282d" },
  { label: "Pink", value: "#f04f91" },
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
    display: "Cormorant Garamond, Georgia, serif",
    body: "var(--font-inter), Inter, system-ui, sans-serif"
  },
  {
    id: "bricolage-inter",
    label: "Bricolage + Inter",
    display: "Bricolage Grotesque, Inter, system-ui, sans-serif",
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
