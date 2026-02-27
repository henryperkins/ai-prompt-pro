export type ContextSourceType = "text" | "url" | "file" | "database" | "rag";
export type SourceValidationStatus = "unknown" | "valid" | "stale" | "invalid";

export interface ContextReference {
  kind: "url" | "file" | "database" | "rag";
  refId: string;
  locator: string;
  permissionScope?: string;
}

export interface SourceValidation {
  status: SourceValidationStatus;
  checkedAt?: number;
  message?: string;
}

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  title: string;
  rawContent: string;
  summary: string;
  addedAt: number;
  reference?: ContextReference;
  validation?: SourceValidation;
}

export interface DatabaseConnection {
  id: string;
  label: string;
  provider: "postgres" | "mysql" | "sqlite" | "mongodb" | "other";
  connectionRef: string;
  database: string;
  schema?: string;
  tables: string[];
  readOnly: boolean;
  lastValidatedAt?: number;
}

export interface RagParameters {
  enabled: boolean;
  vectorStoreRef: string;
  namespace: string;
  topK: number;
  minScore: number;
  retrievalStrategy: "semantic" | "hybrid" | "keyword";
  documentRefs: string[];
  chunkWindow: number;
}

export interface StructuredContext {
  audience: string;
  product: string;
  offer: string;
  mustInclude: string;
  excludedTopics: string;
}

export interface InterviewAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface ContextCoreSignals {
  hasObjective: boolean;
  hasBackground: boolean;
  hasConstraints: boolean;
  hasSupportingEvidence: boolean;
}

export interface ContextConfig {
  sources: ContextSource[];
  databaseConnections: DatabaseConnection[];
  rag: RagParameters;
  structured: StructuredContext;
  interviewAnswers: InterviewAnswer[];
  useDelimiters: boolean;
  projectNotes: string;
}

export const defaultContextConfig: ContextConfig = {
  sources: [],
  databaseConnections: [],
  rag: {
    enabled: false,
    vectorStoreRef: "",
    namespace: "",
    topK: 5,
    minScore: 0.2,
    retrievalStrategy: "hybrid",
    documentRefs: [],
    chunkWindow: 3,
  },
  structured: {
    audience: "",
    product: "",
    offer: "",
    mustInclude: "",
    excludedTopics: "",
  },
  interviewAnswers: [],
  useDelimiters: true,
  projectNotes: "",
};

export const structuredFieldsMeta: {
  key: keyof StructuredContext;
  label: string;
  placeholder: string;
  examples: string[];
}[] = [
  {
    key: "audience",
    label: "Audience",
    placeholder: "Who is this for?",
    examples: [
      "Marketing managers at B2B SaaS companies",
      "First-year university students studying biology",
      "Non-technical startup founders",
    ],
  },
  {
    key: "product",
    label: "Product / Subject",
    placeholder: "What product, topic, or subject is this about?",
    examples: [
      "A project management tool for remote teams",
      "The French Revolution (1789–1799)",
      "React Server Components",
    ],
  },
  {
    key: "offer",
    label: "Goal / Offer",
    placeholder: "What are you offering or trying to achieve?",
    examples: [
      "Free 14-day trial with no credit card required",
      "A comprehensive summary for exam prep",
      "A persuasive pitch deck for Series A investors",
    ],
  },
  {
    key: "mustInclude",
    label: "Must-include facts",
    placeholder: "Key facts, data, or points that must appear",
    examples: [
      "Revenue grew 200% YoY; 10k active users",
      "Must mention GDPR compliance and SOC 2",
      "Include the 3 main causes and 5 consequences",
    ],
  },
  {
    key: "excludedTopics",
    label: "Excluded topics",
    placeholder: "What should the model NOT cover?",
    examples: [
      "Don't mention competitor pricing",
      "Avoid medical advice or diagnoses",
      "Skip implementation details; focus on concepts",
    ],
  },
];

export const interviewQuestions = [
  {
    id: "goal",
    question: "Which of these best describes your goal?",
    options: [
      "Create new content from scratch",
      "Rewrite or improve existing content",
      "Analyze or summarize information",
      "Generate structured data or code",
      "Brainstorm or explore ideas",
    ],
  },
  {
    id: "success",
    question: "What does a successful output look like? (one sentence)",
    options: null, // free text
  },
  {
    id: "inputs",
    question: "What inputs do you have available?",
    options: [
      "Raw notes or bullet points",
      "Existing document(s) to reference",
      "URLs or web sources",
      "Data in spreadsheet/CSV/JSON",
      "Nothing yet — starting from scratch",
    ],
  },
  {
    id: "constraints",
    question: "What should the model NOT do?",
    options: [
      "Don't invent facts or statistics",
      "Don't use overly technical language",
      "Don't exceed a specific word count",
      "Don't include opinions — facts only",
      "No specific constraints",
    ],
  },
  {
    id: "audience_level",
    question: "How much does your audience already know about this topic?",
    options: [
      "Complete beginners",
      "Some familiarity",
      "Intermediate practitioners",
      "Advanced experts",
    ],
  },
];

function splitIntoSentences(content: string): string[] {
  const normalized = content.replace(/\n+/g, " ").trim();
  if (!normalized) return [];
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char !== "." && char !== "!" && char !== "?") continue;

    const next = normalized[i + 1];
    if (next !== " " && next !== undefined) continue;

    const sentence = normalized.slice(start, i + 1).trim();
    if (sentence) sentences.push(sentence);

    let j = i + 1;
    while (normalized[j] === " ") j += 1;
    start = j;
    i = j - 1;
  }

  const tail = normalized.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

export function summarizeSource(content: string): string {
  const sentences = splitIntoSentences(content).filter((s) => s.trim().length > 10);

  if (sentences.length <= 5) {
    return sentences.map((s) => `• ${s.trim()}`).join("\n");
  }

  // Pick the first 3 and last 2 sentences as a heuristic summary.
  const picked = [...sentences.slice(0, 3), ...sentences.slice(-2)];
  return picked.map((s) => `• ${s.trim()}`).join("\n");
}

export function buildContextBlock(ctx: ContextConfig, useDelimiters: boolean): string {
  const sections: string[] = [];

  // Structured fields
  const structuredParts: string[] = [];
  const { structured } = ctx;
  if (structured.audience) structuredParts.push(`Audience: ${structured.audience}`);
  if (structured.product) structuredParts.push(`Subject: ${structured.product}`);
  if (structured.offer) structuredParts.push(`Goal: ${structured.offer}`);
  if (structured.mustInclude) structuredParts.push(`Must include: ${structured.mustInclude}`);
  if (structured.excludedTopics) structuredParts.push(`Excluded: ${structured.excludedTopics}`);

  if (structuredParts.length > 0) {
    if (useDelimiters) {
      sections.push(`<background>\n${structuredParts.join("\n")}\n</background>`);
    } else {
      sections.push(`**Background:**\n${structuredParts.join("\n")}`);
    }
  }

  // Sources
  if (ctx.sources.length > 0) {
    const sourceLines = ctx.sources.map(
      (s) =>
        `[${s.type.toUpperCase()}: ${s.title}]` +
        (s.reference ? ` [ref=${s.reference.refId}]` : "") +
        `\n${s.summary}`
    );
    if (useDelimiters) {
      sections.push(`<sources>\n${sourceLines.join("\n\n")}\n</sources>`);
    } else {
      sections.push(`**Sources:**\n${sourceLines.join("\n\n")}`);
    }
  }

  // Database connections
  if (ctx.databaseConnections.length > 0) {
    const dbLines = ctx.databaseConnections.map((db) => {
      const tableSegment = db.tables.length > 0 ? ` tables=${db.tables.join(",")}` : "";
      const schemaSegment = db.schema ? ` schema=${db.schema}` : "";
      return `[DB: ${db.label}] ref=${db.connectionRef} db=${db.database}${schemaSegment}${tableSegment} readOnly=${db.readOnly}`;
    });
    if (useDelimiters) {
      sections.push(`<database-connections>\n${dbLines.join("\n")}\n</database-connections>`);
    } else {
      sections.push(`**Database Connections:**\n${dbLines.join("\n")}`);
    }
  }

  // RAG parameters
  if (ctx.rag.enabled && ctx.rag.vectorStoreRef.trim()) {
    const ragLines = [
      `vectorStoreRef: ${ctx.rag.vectorStoreRef}`,
      `namespace: ${ctx.rag.namespace || "default"}`,
      `retrievalStrategy: ${ctx.rag.retrievalStrategy}`,
      `topK: ${ctx.rag.topK}`,
      `minScore: ${ctx.rag.minScore}`,
      `chunkWindow: ${ctx.rag.chunkWindow}`,
      ctx.rag.documentRefs.length > 0 ? `documentRefs: ${ctx.rag.documentRefs.join(", ")}` : "",
    ].filter(Boolean);

    if (useDelimiters) {
      sections.push(`<rag-parameters>\n${ragLines.join("\n")}\n</rag-parameters>`);
    } else {
      sections.push(`**RAG Parameters:**\n${ragLines.join("\n")}`);
    }
  }

  // Project notes
  if (ctx.projectNotes.trim()) {
    if (useDelimiters) {
      sections.push(`<project-notes>\n${ctx.projectNotes.trim()}\n</project-notes>`);
    } else {
      sections.push(`**Project Notes:**\n${ctx.projectNotes.trim()}`);
    }
  }

  // Interview answers
  const answeredQ = ctx.interviewAnswers.filter((a) => a.answer.trim());
  if (answeredQ.length > 0) {
    const qaLines = answeredQ.map((a) => `Q: ${a.question}\nA: ${a.answer}`);
    if (useDelimiters) {
      sections.push(`<context-interview>\n${qaLines.join("\n\n")}\n</context-interview>`);
    } else {
      sections.push(`**Context Interview:**\n${qaLines.join("\n\n")}`);
    }
  }

  return sections.join("\n\n");
}

export function scoreContext(ctx: ContextConfig): {
  score: number;
  checks: { label: string; met: boolean; tip: string }[];
} {
  const signals = getContextCoreSignals(ctx);
  const checks: { label: string; met: boolean; tip: string }[] = [];
  checks.push({
    label: "Clear objective",
    met: signals.hasObjective,
    tip: "Fill in the Goal/Offer field or complete the context interview.",
  });
  checks.push({
    label: "Enough background",
    met: signals.hasBackground,
    tip: "Add audience, subject info, or attach source material.",
  });
  checks.push({
    label: "Defined constraints",
    met: signals.hasConstraints,
    tip: "Specify excluded topics or constraints so the model knows boundaries.",
  });
  checks.push({
    label: "Supporting evidence",
    met: signals.hasSupportingEvidence,
    tip: "Add must-include facts or attach a source for grounded output.",
  });

  const metCount = checks.filter((c) => c.met).length;
  const score = Math.round((metCount / checks.length) * 100);

  return { score, checks };
}

export function getContextCoreSignals(ctx: ContextConfig): ContextCoreSignals {
  const hasObjective =
    ctx.structured.offer.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "goal" && a.answer.trim().length > 0);
  const hasBackground =
    ctx.structured.audience.trim().length > 0 ||
    ctx.structured.product.trim().length > 0 ||
    ctx.sources.length > 0;
  const hasConstraints =
    ctx.structured.excludedTopics.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "constraints" && a.answer.trim().length > 0);
  const hasSupportingEvidence =
    ctx.structured.mustInclude.trim().length > 0 || ctx.sources.length > 0;

  return {
    hasObjective,
    hasBackground,
    hasConstraints,
    hasSupportingEvidence,
  };
}
