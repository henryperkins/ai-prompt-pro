import type { ContextConfig } from "@/lib/context-types";
import { defaultContextConfig, buildContextBlock } from "@/lib/context-types";

export interface PromptConfig {
  originalPrompt: string;
  role: string;
  customRole: string;
  task: string;
  context: string;
  contextConfig: ContextConfig;
  format: string[];
  customFormat: string;
  lengthPreference: string;
  examples: string;
  constraints: string[];
  customConstraint: string;
  tone: string;
  complexity: string;
}

export const defaultConfig: PromptConfig = {
  originalPrompt: "",
  role: "",
  customRole: "",
  task: "",
  context: "",
  contextConfig: defaultContextConfig,
  format: [],
  customFormat: "",
  lengthPreference: "standard",
  examples: "",
  constraints: [],
  customConstraint: "",
  tone: "",
  complexity: "",
};

const hasText = (value: string): boolean => value.trim().length > 0;
const LIST_ITEM_PREFIX_RE = /^\s*(?:[-*+•]\s+|\d+[.)]\s+)/;

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeLogicalLine(value: string): string {
  return value.replace(LIST_ITEM_PREFIX_RE, "").trim();
}

function splitLogicalLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((entry) => normalizeLogicalLine(entry))
        .filter(Boolean),
    ),
  );
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function getPrimaryTaskInput(config: PromptConfig): string {
  const originalPrompt = config.originalPrompt.trim();
  if (originalPrompt) return originalPrompt;
  return config.task.trim();
}

export function hasBuilderFieldInput(config: PromptConfig): boolean {
  const hasStructuredContext = Object.values(
    config.contextConfig.structured,
  ).some((value) => typeof value === "string" && hasText(value));
  const hasInterviewAnswers = config.contextConfig.interviewAnswers.some(
    (answer) => hasText(answer.answer),
  );
  const hasRagDocumentRefs = config.contextConfig.rag.documentRefs.some(
    (reference) => hasText(reference),
  );
  const hasRagSignal =
    config.contextConfig.rag.enabled ||
    hasText(config.contextConfig.rag.vectorStoreRef) ||
    hasRagDocumentRefs;

  return (
    hasText(config.task) ||
    hasText(config.role) ||
    hasText(config.customRole) ||
    hasText(config.context) ||
    config.contextConfig.sources.length > 0 ||
    config.contextConfig.databaseConnections.length > 0 ||
    hasRagSignal ||
    hasStructuredContext ||
    hasInterviewAnswers ||
    hasText(config.contextConfig.projectNotes) ||
    config.format.length > 0 ||
    hasText(config.customFormat) ||
    config.lengthPreference !== defaultConfig.lengthPreference ||
    hasText(config.examples) ||
    config.constraints.length > 0 ||
    hasText(config.customConstraint) ||
    config.tone !== defaultConfig.tone ||
    config.complexity !== defaultConfig.complexity
  );
}

export function hasPromptInput(config: PromptConfig): boolean {
  return hasText(config.originalPrompt) || hasBuilderFieldInput(config);
}

export const roles = [
  "Expert Copywriter",
  "Data Analyst",
  "Software Developer",
  "Teacher",
  "Business Consultant",
  "Creative Director",
  "Marketing Specialist",
  "UX Designer",
  "Financial Advisor",
  "Research Scientist",
  "Product Manager",
  "Legal Advisor",
  "Medical Professional",
  "Journalist",
  "Technical Writer",
];

export const formatOptions = [
  "Bullet points",
  "Numbered list",
  "Paragraph form",
  "Table",
  "JSON",
  "Markdown",
  "Code block",
];

export const constraintOptions = [
  "Avoid jargon",
  "Use formal tone",
  "Be conversational",
  "Include citations",
  "Think step-by-step",
];

export const constraintExclusions: Record<string, string> = {
  "Use formal tone": "Be conversational",
  "Be conversational": "Use formal tone",
};

export function normalizeConstraintSelections(constraints: string[]): string[] {
  const normalized: string[] = [];

  constraints.forEach((constraint) => {
    const trimmed = constraint.trim();
    if (!trimmed) return;

    const excluded = constraintExclusions[trimmed];
    if (excluded) {
      const excludedIndex = normalized.indexOf(excluded);
      if (excludedIndex >= 0) {
        normalized.splice(excludedIndex, 1);
      }
    }

    if (!normalized.includes(trimmed)) {
      normalized.push(trimmed);
    }
  });

  return normalized;
}

export function getCustomConstraintLines(value: string): string[] {
  return splitLogicalLines(value);
}

export function partitionConstraintLines(lines: string[]): {
  constraints: string[];
  customConstraint: string;
} {
  const nextConstraints: string[] = [];
  const nextCustomConstraintLines: string[] = [];

  lines.forEach((line) => {
    if (constraintOptions.includes(line)) {
      nextConstraints.push(line);
      return;
    }

    nextCustomConstraintLines.push(line);
  });

  return {
    constraints: normalizeConstraintSelections(nextConstraints),
    customConstraint: nextCustomConstraintLines.join("\n"),
  };
}

export function partitionConstraintText(value: string): {
  constraints: string[];
  customConstraint: string;
} {
  return partitionConstraintLines(getCustomConstraintLines(value));
}

export function applyPromptConfigInvariants(
  config: PromptConfig,
): PromptConfig {
  const constraints = normalizeConstraintSelections(config.constraints);
  if (arraysEqual(constraints, config.constraints)) {
    return config;
  }

  return {
    ...config,
    constraints,
  };
}

export const toneOptions = [
  "Professional",
  "Casual",
  "Technical",
  "Creative",
  "Academic",
];
export const complexityOptions = ["Simple", "Moderate", "Advanced"];
export const lengthOptions = [
  { value: "brief", label: "Brief (~100 words)" },
  { value: "standard", label: "Standard (~300 words)" },
  { value: "detailed", label: "Detailed (500+ words)" },
];

export const lengthChipOptions = [
  { value: "brief", label: "Brief", hint: "~100 words" },
  { value: "standard", label: "Standard", hint: "~300 words" },
  { value: "detailed", label: "Detailed", hint: "500+ words" },
];

export function buildPromptConfigSignature(config: PromptConfig): string {
  const serializedSources = sortStrings(
    config.contextConfig.sources.map((source) =>
      stableStringify({
        ...source,
        addedAt: 0,
        rawContent: source.rawContent.trim(),
        summary: source.summary.trim(),
        title: source.title.trim(),
        validation: source.validation
          ? {
              ...source.validation,
              checkedAt: 0,
              message: source.validation.message?.trim() ?? "",
            }
          : null,
      }),
    ),
  );
  const serializedDatabaseConnections = sortStrings(
    config.contextConfig.databaseConnections.map((connection) =>
      stableStringify({
        ...connection,
        database: connection.database.trim(),
        label: connection.label.trim(),
        lastValidatedAt: 0,
        schema: connection.schema?.trim() ?? "",
        tables: sortStrings(connection.tables.map((table) => table.trim())),
      }),
    ),
  );
  const serializedInterviewAnswers = sortStrings(
    config.contextConfig.interviewAnswers.map((answer) =>
      stableStringify({
        ...answer,
        answer: answer.answer.trim(),
        question: answer.question.trim(),
      }),
    ),
  );

  return fnv1aHash(
    stableStringify({
      originalPrompt: config.originalPrompt.trim(),
      task: config.task.trim(),
      role: config.role.trim(),
      customRole: config.customRole.trim(),
      context: config.context.trim(),
      format: sortStrings(config.format.map((entry) => entry.trim())),
      customFormat: config.customFormat.trim(),
      lengthPreference: config.lengthPreference,
      examples: config.examples.trim(),
      constraints: sortStrings(normalizeConstraintSelections(config.constraints)),
      customConstraints: sortStrings(getCustomConstraintLines(config.customConstraint)),
      tone: config.tone.trim(),
      complexity: config.complexity.trim(),
      contextConfig: {
        useDelimiters: config.contextConfig.useDelimiters,
        projectNotes: config.contextConfig.projectNotes.trim(),
        structured: config.contextConfig.structured,
        sources: serializedSources,
        databaseConnections: serializedDatabaseConnections,
        interviewAnswers: serializedInterviewAnswers,
        rag: {
          ...config.contextConfig.rag,
          vectorStoreRef: config.contextConfig.rag.vectorStoreRef.trim(),
          namespace: config.contextConfig.rag.namespace.trim(),
          documentRefs: sortStrings(
            config.contextConfig.rag.documentRefs.map((ref) => ref.trim()),
          ),
        },
      },
    }),
  );
}

export function buildPrompt(config: PromptConfig): string {
  const parts: string[] = [];

  const actualRole = config.customRole || config.role;
  if (actualRole) {
    parts.push(`**Role:** Act as a ${actualRole}.`);
  }

  const primaryTaskInput = getPrimaryTaskInput(config);
  if (primaryTaskInput) {
    parts.push(`**Task:** ${primaryTaskInput}`);
  }

  // Rich context from ContextPanel
  const contextBlock = buildContextBlock(
    config.contextConfig,
    config.contextConfig.useDelimiters,
  );
  if (contextBlock) {
    parts.push(contextBlock);
  }

  // Legacy context field (for backward compat / simple usage)
  if (config.context && !contextBlock) {
    parts.push(`**Context:** ${config.context}`);
  }

  const formats = [...config.format];
  if (config.customFormat.trim()) formats.push(config.customFormat.trim());
  if (formats.length > 0) {
    const lengthLabel =
      config.lengthPreference === "brief"
        ? "Keep it brief (~100 words)"
        : config.lengthPreference === "detailed"
          ? "Be detailed (500+ words)"
          : "Standard length (~300 words)";
    parts.push(
      `**Format:** Present the response as ${formats.join(", ")}. ${lengthLabel}.`,
    );
  }

  if (config.examples) {
    parts.push(`**Examples:**\n${config.examples}`);
  }

  const allConstraints = Array.from(
    new Set([
      ...normalizeConstraintSelections(config.constraints),
      ...getCustomConstraintLines(config.customConstraint),
    ]),
  );
  if (config.tone && config.tone !== defaultConfig.tone) {
    allConstraints.push(`Use a ${config.tone.toLowerCase()} tone`);
  }
  if (config.complexity && config.complexity !== defaultConfig.complexity) {
    allConstraints.push(
      `Target ${config.complexity.toLowerCase()} complexity level`,
    );
  }

  if (allConstraints.length > 0) {
    parts.push(
      `**Constraints:**\n${allConstraints.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  return parts.join("\n\n");
}

export function scorePrompt(
  config: PromptConfig,
  fieldOwnership?: Partial<Record<string, string>>,
): {
  total: number;
  clarity: number;
  context: number;
  specificity: number;
  structure: number;
  tips: string[];
} {
  let clarity = 0;
  let context = 0;
  let specificity = 0;
  let structure = 0;
  const tips: string[] = [];
  const normalizedConstraints = normalizeConstraintSelections(
    config.constraints,
  );
  const customConstraintLines = getCustomConstraintLines(
    config.customConstraint,
  );
  const totalConstraintCount = Array.from(
    new Set([...normalizedConstraints, ...customConstraintLines]),
  ).length;
  const hasFormatSelection =
    config.format.length > 0 || hasText(config.customFormat);

  // Clarity (0-25)
  const primaryTaskInput = getPrimaryTaskInput(config);
  if (primaryTaskInput) {
    const taskLen = primaryTaskInput.length;
    clarity = Math.min(25, Math.round((taskLen / 100) * 25));
  }
  if (clarity < 15)
    tips.push("Make your task description more specific and detailed.");

  // Context (0-25) — now includes structured context
  if (config.context) {
    context = Math.min(15, Math.round((config.context.length / 150) * 15));
  }
  const ctx = config.contextConfig;
  if (ctx.sources.length > 0) context += 5;
  if (ctx.databaseConnections.length > 0) context += 3;
  if (ctx.rag.enabled && ctx.rag.vectorStoreRef.trim()) context += 3;
  if (ctx.structured.audience || ctx.structured.product) context += 4;
  if (ctx.structured.offer) context += 3;
  if (ctx.interviewAnswers.filter((a) => a.answer.trim()).length > 0)
    context += 3;
  if (ctx.projectNotes.trim()) context += 2;
  if (config.role || config.customRole) context = Math.min(25, context + 5);
  context = Math.min(25, context);
  if (context < 15) {
    if (fieldOwnership?.role === "ai") {
      tips.push(
        "AI suggested a role — review or customize it for better results.",
      );
    } else if (fieldOwnership?.role !== "user") {
      tips.push(
        "Use the Context & Sources panel to add structured background info.",
      );
    }
  }

  // Specificity (0-25)
  if (hasFormatSelection) specificity += 8;
  if (config.lengthPreference) specificity += 5;
  if (config.examples) specificity += 7;
  if (totalConstraintCount > 0) {
    specificity += Math.min(5, totalConstraintCount * 2);
  }
  specificity = Math.min(25, specificity);
  if (specificity < 15) {
    const aiFields = ["format", "lengthPreference", "constraints"].filter(
      (f) => fieldOwnership?.[f] === "ai",
    );
    if (aiFields.length > 0) {
      tips.push(
        "AI filled some format details — review them to ensure they match your needs.",
      );
    } else {
      tips.push(
        "Specify output format, length, or provide examples for better results.",
      );
    }
  }

  // Structure (0-25)
  if (config.role || config.customRole) structure += 7;
  if (config.tone) structure += 5;
  if (config.complexity) structure += 5;
  if (totalConstraintCount >= 2) {
    structure += 4;
  } else if (totalConstraintCount === 1) {
    structure += 2;
  }
  if (hasFormatSelection) structure += 4;
  structure = Math.min(25, structure);
  if (structure < 15) {
    const aiStructure = ["role", "tone"].filter(
      (f) => fieldOwnership?.[f] === "ai",
    );
    const userStructure = ["role", "tone"].filter(
      (f) => fieldOwnership?.[f] === "user",
    );
    if (aiStructure.length > 0 && userStructure.length === 0) {
      tips.push(
        "AI suggested role and tone — confirm or adjust them for the best structure.",
      );
    } else if (userStructure.length < 2) {
      tips.push(
        "Select a role, tone, and constraints to improve prompt structure.",
      );
    }
  }

  if (tips.length === 0)
    tips.push("Great prompt! You've covered all the essentials.");

  return {
    total: clarity + context + specificity + structure,
    clarity,
    context,
    specificity,
    structure,
    tips,
  };
}

/**
 * Reconcile a `Length:` token inside inspector-applied format text.
 *
 * When the inspector emits format strings like `"Table | Length: standard"`,
 * this helper extracts the length value and syncs it with `lengthPreference`
 * so the built prompt never contains contradictory length guidance.
 */
const KNOWN_LENGTHS = new Set(["brief", "standard", "detailed"]);
const LENGTH_TOKEN_RE = /\|\s*length\s*:\s*(\w+)/i;

export function reconcileFormatLength(formatText: string): {
  customFormat: string;
  lengthPreference: "brief" | "standard" | "detailed" | null;
} {
  const match = formatText.match(LENGTH_TOKEN_RE);
  if (!match) {
    return { customFormat: formatText, lengthPreference: null };
  }

  const raw = match[1].toLowerCase();
  const lengthPreference = KNOWN_LENGTHS.has(raw)
    ? (raw as "brief" | "standard" | "detailed")
    : null;

  // Strip the "| Length: value" fragment from the format text.
  const cleaned = formatText.replace(LENGTH_TOKEN_RE, "").replace(/\s*\|\s*$/, "").trim();
  return { customFormat: cleaned, lengthPreference };
}
