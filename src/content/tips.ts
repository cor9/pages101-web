export type TipKey = "slate" | "headshots" | "clips" | "updates" | "resume" | "press";

export const tips: Record<TipKey, { title: string; body: string }> = {
  slate: {
    title: "Slate",
    body: "Keep it 20-30 seconds: name, age range, union status, and one fun fact."
  },
  headshots: {
    title: "Headshots",
    body: "Show range: commercial, theatrical, light theatrical, and one character look."
  },
  clips: {
    title: "Clips",
    body: "Lead with the strongest clip. Booked work, demo reel, About Me, VO reel, and singing all work."
  },
  updates: {
    title: "Updates",
    body: "Wins only. Never include school names, set locations, schedules, or anything that helps someone track your child."
  },
  resume: {
    title: "Resume",
    body: "Use Resume101 one-click import so the page and actor resume stay consistent."
  },
  press: {
    title: "Press",
    body: "One attributed quote is stronger than paragraphs of bio."
  }
};
