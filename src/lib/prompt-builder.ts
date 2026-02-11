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
  tone: "Professional",
  complexity: "Moderate",
};

const hasText = (value: string): boolean => value.trim().length > 0;

export function hasPromptInput(config: PromptConfig): boolean {
  const hasStructuredContext = Object.values(config.contextConfig.structured).some(
    (value) => typeof value === "string" && hasText(value),
  );
  const hasInterviewAnswers = config.contextConfig.interviewAnswers.some((answer) => hasText(answer.answer));
  const hasRagDocumentRefs = config.contextConfig.rag.documentRefs.some((reference) => hasText(reference));
  const hasRagSignal =
    config.contextConfig.rag.enabled ||
    hasText(config.contextConfig.rag.vectorStoreRef) ||
    hasRagDocumentRefs;

  return (
    hasText(config.originalPrompt) ||
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

export const toneOptions = ["Professional", "Casual", "Technical", "Creative", "Academic"];
export const complexityOptions = ["Simple", "Moderate", "Advanced"];
export const lengthOptions = [
  { value: "brief", label: "Brief (~100 words)" },
  { value: "standard", label: "Standard (~300 words)" },
  { value: "detailed", label: "Detailed (500+ words)" },
];

export function buildPrompt(config: PromptConfig): string {
  const parts: string[] = [];

  const actualRole = config.customRole || config.role;
  if (actualRole) {
    parts.push(`**Role:** Act as a ${actualRole}.`);
  }

  if (config.task || config.originalPrompt) {
    parts.push(`**Task:** ${config.task || config.originalPrompt}`);
  }

  // Rich context from ContextPanel
  const contextBlock = buildContextBlock(config.contextConfig, config.contextConfig.useDelimiters);
  if (contextBlock) {
    parts.push(contextBlock);
  }

  // Legacy context field (for backward compat / simple usage)
  if (config.context && !contextBlock) {
    parts.push(`**Context:** ${config.context}`);
  }

  const formats = [...config.format];
  if (config.customFormat) formats.push(config.customFormat);
  if (formats.length > 0) {
    const lengthLabel =
      config.lengthPreference === "brief"
        ? "Keep it brief (~100 words)"
        : config.lengthPreference === "detailed"
          ? "Be detailed (500+ words)"
          : "Standard length (~300 words)";
    parts.push(`**Format:** Present the response as ${formats.join(", ")}. ${lengthLabel}.`);
  }

  if (config.examples) {
    parts.push(`**Examples:**\n${config.examples}`);
  }

  const allConstraints = [...config.constraints];
  if (config.customConstraint) allConstraints.push(config.customConstraint);
  const hasMeaningfulInput = parts.length > 0 || allConstraints.length > 0;
  if (config.tone && (config.tone !== defaultConfig.tone || hasMeaningfulInput)) {
    allConstraints.push(`Use a ${config.tone.toLowerCase()} tone`);
  }
  if (config.complexity && (config.complexity !== defaultConfig.complexity || hasMeaningfulInput)) {
    allConstraints.push(`Target ${config.complexity.toLowerCase()} complexity level`);
  }

  if (allConstraints.length > 0) {
    parts.push(`**Constraints:**\n${allConstraints.map((c) => `- ${c}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

export function scorePrompt(config: PromptConfig): {
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

  // Clarity (0-25)
  if (config.task || config.originalPrompt) {
    const taskLen = (config.task || config.originalPrompt).length;
    clarity = Math.min(25, Math.round((taskLen / 100) * 25));
  }
  if (clarity < 15) tips.push("Make your task description more specific and detailed.");

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
  if (ctx.interviewAnswers.filter((a) => a.answer.trim()).length > 0) context += 3;
  if (ctx.projectNotes.trim()) context += 2;
  if (config.role || config.customRole) context = Math.min(25, context + 5);
  context = Math.min(25, context);
  if (context < 15) tips.push("Use the Context & Sources panel to add structured background info.");

  // Specificity (0-25)
  if (config.format.length > 0) specificity += 8;
  if (config.lengthPreference) specificity += 5;
  if (config.examples) specificity += 7;
  if (config.constraints.length > 0) specificity += 5;
  specificity = Math.min(25, specificity);
  if (specificity < 15) tips.push("Specify output format, length, or provide examples for better results.");

  // Structure (0-25)
  if (config.role || config.customRole) structure += 7;
  if (config.tone) structure += 5;
  if (config.complexity) structure += 5;
  if (config.constraints.length >= 2) structure += 4;
  if (config.format.length > 0) structure += 4;
  structure = Math.min(25, structure);
  if (structure < 15) tips.push("Select a role, tone, and constraints to improve prompt structure.");

  if (tips.length === 0) tips.push("Great prompt! You've covered all the essentials.");

  return {
    total: clarity + context + specificity + structure,
    clarity,
    context,
    specificity,
    structure,
  tips,
  };
}
