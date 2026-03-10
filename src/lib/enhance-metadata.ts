/**
 * Normalized frontend type for the `enhance.metadata` payload.
 *
 * The backend emits all of these fields in every `enhance.metadata` SSE event,
 * but the frontend previously only extracted `enhanced_prompt`. This type
 * captures the full payload so the UI can surface quality scores, suggestions,
 * alternative versions, and detected context.
 *
 * All fields are optional so the UI degrades gracefully when the backend falls
 * back to raw-text mode (parse_status = "fallback").
 */

import { parseEnhancementPlan, type EnhancementPlan } from "@/lib/enhancement-plan";

export interface EnhanceQualityScore {
  clarity: number;
  specificity: number;
  completeness: number;
  actionability: number;
  overall: number;
}

export interface EnhancePartsBreakdown {
  role: string;
  context: string;
  task: string;
  output_format: string;
  examples: string | null;
  guardrails: string;
}

export interface EnhanceAlternativeVersions {
  shorter: string;
  more_detailed: string;
}

export interface EnhanceDetectedContext {
  intent: string[];
  domain: string[];
  complexity: number;
  mode: string;
  input_language: string;
  primaryIntent?: string;
}

export type EnhanceParseStatus = "json" | "fallback";

export type EditableEnhancementListField =
  | "assumptions_made"
  | "open_questions"
  | "plan_assumptions"
  | "plan_open_questions";

export interface EditableEnhancementListEdit {
  field: EditableEnhancementListField;
  index: number;
  before: string;
  after: string;
  source: "structured_inspector";
}

export interface EnhanceMetadata {
  enhancedPrompt: string;
  partsBreakdown?: EnhancePartsBreakdown;
  enhancementsMade?: string[];
  qualityScore?: EnhanceQualityScore;
  suggestions?: string[];
  alternativeVersions?: EnhanceAlternativeVersions;
  detectedContext?: EnhanceDetectedContext;
  missingParts?: string[];
  improvementDelta?: number;
  sessionContextSummary?: string;
  assumptionsMade?: string[];
  openQuestions?: string[];
  ambiguityLevel?: string;
  enhancementPlan?: EnhancementPlan;
  parseStatus?: EnhanceParseStatus;
}

export type { EnhancementPlan };

/**
 * Parse the raw `enhance.metadata` event payload into a normalized
 * `EnhanceMetadata` object.
 *
 * Returns `null` if the payload doesn't contain a valid enhanced_prompt.
 */
export function parseEnhanceMetadata(raw: unknown): EnhanceMetadata | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const parseStatus =
    data.parse_status === "json" || data.parse_status === "fallback"
      ? data.parse_status
      : undefined;
  const allowStructuredInspector = parseStatus !== "fallback";

  const enhancedPrompt =
    typeof data.enhanced_prompt === "string" ? data.enhanced_prompt.trim() : "";
  if (!enhancedPrompt) return null;

  return {
    enhancedPrompt,
    partsBreakdown: allowStructuredInspector
      ? parsePartsBreakdown(data.parts_breakdown)
      : undefined,
    enhancementsMade: parseStringArray(data.enhancements_made),
    qualityScore: parseQualityScore(data.quality_score),
    suggestions: parseStringArray(data.suggestions),
    alternativeVersions: parseAlternativeVersions(data.alternative_versions),
    detectedContext: parseDetectedContext(data.detected_context),
    missingParts: parseStringArray(data.missing_parts),
    improvementDelta:
      typeof data.improvement_delta === "number" ? data.improvement_delta : undefined,
    sessionContextSummary:
      typeof data.session_context_summary === "string"
        ? data.session_context_summary
        : undefined,
    assumptionsMade: parseStringArray(data.assumptions_made),
    openQuestions: parseStringArray(data.open_questions),
    ambiguityLevel:
      typeof data.ambiguity_level === "string" ? data.ambiguity_level : undefined,
    enhancementPlan: allowStructuredInspector
      ? parseEnhancementPlan(data.enhancement_plan) ?? undefined
      : undefined,
    parseStatus,
  };
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return filtered.length > 0 ? filtered : undefined;
}

function parsePartsBreakdown(value: unknown): EnhancePartsBreakdown | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return {
    role: typeof obj.role === "string" ? obj.role : "",
    context: typeof obj.context === "string" ? obj.context : "",
    task: typeof obj.task === "string" ? obj.task : "",
    output_format: typeof obj.output_format === "string" ? obj.output_format : "",
    examples: typeof obj.examples === "string" ? obj.examples : null,
    guardrails: typeof obj.guardrails === "string" ? obj.guardrails : "",
  };
}

function parseQualityScore(value: unknown): EnhanceQualityScore | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const score = {
    clarity: typeof obj.clarity === "number" ? obj.clarity : 0,
    specificity: typeof obj.specificity === "number" ? obj.specificity : 0,
    completeness: typeof obj.completeness === "number" ? obj.completeness : 0,
    actionability: typeof obj.actionability === "number" ? obj.actionability : 0,
    overall: typeof obj.overall === "number" ? obj.overall : 0,
  };
  return score.overall > 0 ? score : undefined;
}

function parseAlternativeVersions(
  value: unknown,
): EnhanceAlternativeVersions | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const shorter = typeof obj.shorter === "string" ? obj.shorter.trim() : "";
  const moreDetailed =
    typeof obj.more_detailed === "string" ? obj.more_detailed.trim() : "";
  if (!shorter && !moreDetailed) return undefined;
  return { shorter, more_detailed: moreDetailed };
}

function parseDetectedContext(
  value: unknown,
): EnhanceDetectedContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const intent = Array.isArray(obj.intent)
    ? obj.intent.filter((i): i is string => typeof i === "string")
    : [];
  const domain = Array.isArray(obj.domain)
    ? obj.domain.filter((d): d is string => typeof d === "string")
    : [];
  const complexity = typeof obj.complexity === "number" ? obj.complexity : 0;
  const mode = typeof obj.mode === "string" ? obj.mode : "";
  const input_language = typeof obj.input_language === "string" ? obj.input_language : "";
  const primaryIntent = typeof obj.primary_intent === "string" ? obj.primary_intent : undefined;

  if (intent.length === 0 && domain.length === 0 && complexity === 0 && !mode && !input_language && !primaryIntent) {
    return undefined;
  }

  return { intent, domain, complexity, mode, input_language, primaryIntent };
}
