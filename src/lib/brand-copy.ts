export const brandCopy = {
  appName: "PromptForge",
  brandLine: "Quality prompts grounded in context",
  tagline: "Build, score, and remix prompts your team can trust.",
  hero: {
    headline: "Turn rough ideas into quality prompts with context",
    subhead:
      "Draft once, improve with quality checks, and remix proven prompts without losing intent.",
    primaryCta: "Enhance prompt",
  },
  pillars: [
    {
      title: "Quality you can see",
      proof: "Quality Score highlights clarity, constraints, and structure before you run a model.",
    },
    {
      title: "Context that travels",
      proof: "Attach sources, notes, and data references so every prompt stays grounded.",
    },
    {
      title: "Remix with attribution",
      proof: "Community remixes keep lineage visible so teams can iterate without losing intent.",
    },
  ],
} as const;

export type BrandPillar = (typeof brandCopy.pillars)[number];
