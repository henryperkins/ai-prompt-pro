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

export interface DraftIntentDetectionOptions {
  role?: string;
  context?: string;
  outputFormats?: string[];
  hasAttachedSources?: boolean;
  hasSessionContext?: boolean;
  hasPastedSourceMaterial?: boolean;
}

export interface DraftIntentDetectionResult {
  intent: IntentRoute | null;
  confidence: number;
}

const ROUTE_PRIORITY: IntentRoute[] = [
  "rewrite",
  "code",
  "extraction",
  "research",
  "planning",
  "analysis",
  "brainstorm",
];

const ROUTE_PATTERNS: Record<IntentRoute, RegExp[]> = {
  brainstorm: [
    /\b(brainstorm|idea|ideas|concept|concepts|options|angles|names|taglines?)\b/g,
    /\b(write|create|generate|compose|invent|propose)\b/g,
  ],
  rewrite: [
    /\b(rewrite|revise|edit|improve|rephrase|shorten|simplify|polish|refine|correct|fix)\b/g,
    /\b(make this better|clean this up)\b/g,
  ],
  analysis: [
    /\b(analy[sz]e|analysis|assess|evaluate|compare|benchmark|audit|review|critique)\b/g,
    /\b(retention|churn|cohort|metric|metrics|kpi|numbers|findings)\b/g,
  ],
  code: [
    /\b(code|function|script|refactor|debug|bug|typescript|javascript|python|sql|api|react|node)\b/g,
    /\b(implementation|code review|pull request|compile)\b/g,
  ],
  extraction: [
    /\b(extract|pull out|identify|list all|parse|catalog|summari[sz]e)\b/g,
    /\b(from this|from the transcript|from the document|from these notes)\b/g,
  ],
  planning: [
    /\b(plan|roadmap|timeline|milestones|schedule|launch plan|action plan|checklist|next steps)\b/g,
    /\b(strategy|rollout|execution plan)\b/g,
  ],
  research: [
    /\b(research|investigate|literature|sources?|citations?|evidence|market research)\b/g,
    /\b(latest|current|up[- ]to[- ]date|papers?)\b/g,
  ],
};

const DEVELOPER_ROLE_PATTERN =
  /\b(developer|engineer|programmer|software|frontend|backend|full[- ]stack)\b/i;

const CRITIQUE_PATTERN =
  /\b(review|critique|feedback|evaluate|assessment|assess)\b/i;

const EXTRACTION_WITH_SOURCES_PATTERN =
  /\b(extract|summari[sz]e|identify|parse|pull out|list)\b/i;

const ANALYSIS_WITH_SOURCES_PATTERN =
  /\b(analy[sz]e|compare|evaluate|assess|benchmark|audit)\b/i;

const RESEARCH_WITH_SOURCES_PATTERN =
  /\b(research|investigate|source|citation|evidence|verify)\b/i;

const CODE_OUTPUT_PATTERN = /\bcode block\b/i;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function buildSignalText(options: DraftIntentDetectionOptions): string {
  return [
    options.role,
    options.context,
    ...(options.outputFormats ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function computeIntentConfidence(
  bestScore: number,
  tiedCount: number,
): number {
  if (bestScore <= 0) return 0;
  const confidence =
    0.58 +
    Math.max(bestScore - 1, 0) * 0.08 +
    (tiedCount === 1 ? 0.08 : 0);
  return Number(Math.min(confidence, 0.95).toFixed(2));
}

export function detectDraftIntent(
  prompt: string,
  options: DraftIntentDetectionOptions = {},
): DraftIntentDetectionResult {
  const normalizedPrompt = prompt.trim().toLowerCase();
  if (!normalizedPrompt) {
    return { intent: null, confidence: 0 };
  }

  const signalText = buildSignalText(options);
  const scores = new Map<IntentRoute, number>(
    INTENT_ROUTES.map((route) => [route, 0]),
  );

  const addScore = (route: IntentRoute, value: number) => {
    scores.set(route, (scores.get(route) ?? 0) + value);
  };

  for (const route of INTENT_ROUTES) {
    const patterns = ROUTE_PATTERNS[route];
    for (const pattern of patterns) {
      const matches = countMatches(normalizedPrompt, pattern);
      if (matches > 0) {
        addScore(route, route === "brainstorm" ? matches * 0.6 : matches);
      }
    }
  }

  if (DEVELOPER_ROLE_PATTERN.test(signalText) || CODE_OUTPUT_PATTERN.test(signalText)) {
    addScore("code", 1.5);
  }

  if (CRITIQUE_PATTERN.test(normalizedPrompt)) {
    addScore("analysis", 0.8);
  }

  if (
    options.hasAttachedSources ||
    options.hasSessionContext ||
    options.hasPastedSourceMaterial
  ) {
    if (EXTRACTION_WITH_SOURCES_PATTERN.test(normalizedPrompt)) {
      addScore("extraction", 0.8);
    }
    if (ANALYSIS_WITH_SOURCES_PATTERN.test(normalizedPrompt)) {
      addScore("analysis", 0.6);
    }
    if (RESEARCH_WITH_SOURCES_PATTERN.test(normalizedPrompt)) {
      addScore("research", 0.6);
    }
  }

  const bestScore = Math.max(...scores.values());
  if (bestScore <= 0) {
    return { intent: null, confidence: 0 };
  }

  const tiedRoutes = ROUTE_PRIORITY.filter(
    (route) => (scores.get(route) ?? 0) === bestScore,
  );
  const intent = tiedRoutes[0] ?? null;

  return {
    intent,
    confidence: computeIntentConfidence(bestScore, tiedRoutes.length),
  };
}
