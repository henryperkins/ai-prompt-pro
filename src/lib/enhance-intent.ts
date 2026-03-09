export const INTENT_ROUTES = [
  "brainstorm",
  "rewrite",
  "analysis",
  "code",
  "extraction",
  "planning",
  "research",
] as const;

export type IntentRoute = (typeof INTENT_ROUTES)[number];

export const INTENT_ROUTE_LABELS: Record<IntentRoute, string> = {
  brainstorm: "Brainstorm",
  rewrite: "Rewrite",
  analysis: "Analysis",
  code: "Code",
  extraction: "Extraction",
  planning: "Planning",
  research: "Research",
};

export function isIntentRoute(value: unknown): value is IntentRoute {
  return typeof value === "string" && INTENT_ROUTES.includes(value as IntentRoute);
}
