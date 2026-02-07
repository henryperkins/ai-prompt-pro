export interface ContextSource {
  id: string;
  type: "text" | "url" | "file";
  title: string;
  rawContent: string;
  summary: string;
  addedAt: number;
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

export interface ContextConfig {
  sources: ContextSource[];
  structured: StructuredContext;
  interviewAnswers: InterviewAnswer[];
  useDelimiters: boolean;
  projectNotes: string;
}

export const defaultContextConfig: ContextConfig = {
  sources: [],
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

export function summarizeSource(content: string): string {
  const sentences = content
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 10);

  if (sentences.length <= 5) {
    return sentences.map((s) => `• ${s.trim()}`).join("\n");
  }

  // Pick the first 3 and last 2 sentences as a heuristic summary
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
      (s) => `[${s.type.toUpperCase()}: ${s.title}]\n${s.summary}`
    );
    if (useDelimiters) {
      sections.push(`<sources>\n${sourceLines.join("\n\n")}\n</sources>`);
    } else {
      sections.push(`**Sources:**\n${sourceLines.join("\n\n")}`);
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
  const checks: { label: string; met: boolean; tip: string }[] = [];

  const hasObjective =
    ctx.structured.offer.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "goal" && a.answer.trim());
  checks.push({
    label: "Clear objective",
    met: hasObjective,
    tip: "Fill in the Goal/Offer field or complete the context interview.",
  });

  const hasBackground =
    ctx.structured.audience.trim().length > 0 ||
    ctx.structured.product.trim().length > 0 ||
    ctx.sources.length > 0;
  checks.push({
    label: "Enough background",
    met: hasBackground,
    tip: "Add audience, subject info, or attach source material.",
  });

  const hasConstraints =
    ctx.structured.excludedTopics.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "constraints" && a.answer.trim());
  checks.push({
    label: "Defined constraints",
    met: hasConstraints,
    tip: "Specify excluded topics or constraints so the model knows boundaries.",
  });

  const hasExample =
    ctx.structured.mustInclude.trim().length > 0 || ctx.sources.length > 0;
  checks.push({
    label: "Supporting evidence",
    met: hasExample,
    tip: "Add must-include facts or attach a source for grounded output.",
  });

  const metCount = checks.filter((c) => c.met).length;
  const score = Math.round((metCount / checks.length) * 100);

  return { score, checks };
}
