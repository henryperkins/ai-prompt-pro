export const PROMPT_CATEGORIES = [
  "general",
  "frontend",
  "backend",
  "fullstack",
  "devops",
  "data",
  "ml-ai",
  "security",
  "testing",
  "api",
  "automation",
  "docs",
  "content",
  "analysis",
  "creative",
  "business",
  "education",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
  devops: "DevOps",
  data: "Data",
  "ml-ai": "ML / AI",
  security: "Security",
  testing: "Testing",
  api: "API",
  automation: "Automation",
  docs: "Docs",
  content: "Content",
  analysis: "Analysis",
  creative: "Creative",
  business: "Business",
  education: "Education",
};

export const PROMPT_CATEGORY_OPTIONS: ReadonlyArray<{ value: PromptCategory; label: string }> = PROMPT_CATEGORIES.map(
  (value) => ({
    value,
    label: PROMPT_CATEGORY_LABELS[value],
  }),
);

const PROMPT_CATEGORY_SET = new Set<string>(PROMPT_CATEGORIES);

export function isPromptCategory(value: string): value is PromptCategory {
  return PROMPT_CATEGORY_SET.has(value);
}

export function normalizePromptCategory(category?: string): PromptCategory | undefined {
  if (category === undefined) return undefined;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return "general";
  return isPromptCategory(normalized) ? normalized : "general";
}
