import type { ContextSource, DatabaseConnection, RagParameters } from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import { normalizeTemplateConfig } from "@/lib/template-store";

type FieldOwnership = "ai" | "user" | "empty";
export const PROMPT_CONFIG_SCHEMA_VERSION_KEY = "__schemaVersion";
export const PROMPT_CONFIG_V2_COMPAT_KEY = "__promptConfigV2";

export interface PromptConfigV2 {
  originalPrompt: string;
  role: string;
  audience: string;
  tone: string;
  format: string[];
  lengthPreference: "brief" | "standard" | "detailed";
  constraints: string[];
  examples: string;
  sources: ContextSource[];
  projectNotes: string;
  advanced: {
    useDelimiters: boolean;
    databaseConnections: DatabaseConnection[];
    rag: RagParameters;
  };
  aiMeta?: {
    fieldOwnership: Record<string, FieldOwnership>;
    inferredAt?: number;
  };
}

interface SerializeWorkingStateToV1Options {
  includeV2Compat?: boolean;
  preserveSourceRawContent?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeLengthPreference(value: unknown): "brief" | "standard" | "detailed" {
  return value === "brief" || value === "detailed" ? value : "standard";
}

function toPromptConfig(config: PromptConfig): PromptConfig {
  return {
    originalPrompt: config.originalPrompt,
    role: config.role,
    customRole: config.customRole,
    task: config.task,
    context: config.context,
    contextConfig: config.contextConfig,
    format: config.format,
    customFormat: config.customFormat,
    lengthPreference: config.lengthPreference,
    examples: config.examples,
    constraints: config.constraints,
    customConstraint: config.customConstraint,
    tone: config.tone,
    complexity: config.complexity,
  };
}

function toOriginalPrompt(originalPrompt: string, task: string): string {
  const normalizedOriginal = originalPrompt.trim();
  const normalizedTask = task.trim();

  if (normalizedOriginal && normalizedTask && normalizedOriginal !== normalizedTask) {
    return `${normalizedOriginal}\n\n${normalizedTask}`;
  }

  return normalizedOriginal || normalizedTask;
}

function hasLegacyV1Fields(value: Record<string, unknown>): boolean {
  return (
    "contextConfig" in value ||
    "customRole" in value ||
    "task" in value ||
    "customFormat" in value ||
    "customConstraint" in value ||
    "complexity" in value
  );
}

function isPromptConfigV2Payload(value: unknown): value is PromptConfigV2 {
  if (!isRecord(value)) return false;
  const advanced = value.advanced;
  return (
    typeof value.originalPrompt === "string" &&
    typeof value.role === "string" &&
    typeof value.audience === "string" &&
    typeof value.tone === "string" &&
    Array.isArray(value.format) &&
    Array.isArray(value.constraints) &&
    typeof value.examples === "string" &&
    Array.isArray(value.sources) &&
    typeof value.projectNotes === "string" &&
    isRecord(advanced)
  );
}

function hydrateConfigV2ToWorkingState(payload: PromptConfigV2): PromptConfig {
  const advanced = isRecord(payload.advanced) ? payload.advanced : {};
  const ragRaw = isRecord(advanced.rag) ? advanced.rag : {};
  const normalized = normalizeTemplateConfig(
    {
      ...defaultConfig,
      originalPrompt: payload.originalPrompt,
      role: payload.role,
      customRole: "",
      tone: payload.tone || defaultConfig.tone,
      format: toStringArray(payload.format),
      customFormat: "",
      lengthPreference: normalizeLengthPreference(payload.lengthPreference),
      constraints: toStringArray(payload.constraints),
      customConstraint: "",
      examples: payload.examples,
      contextConfig: {
        ...defaultContextConfig,
        sources: Array.isArray(payload.sources)
          ? (payload.sources as ContextSource[])
          : [],
        projectNotes: payload.projectNotes,
        useDelimiters:
          typeof advanced.useDelimiters === "boolean"
            ? advanced.useDelimiters
            : defaultContextConfig.useDelimiters,
        databaseConnections: Array.isArray(advanced.databaseConnections)
          ? (advanced.databaseConnections as DatabaseConnection[])
          : [],
        rag: {
          ...defaultContextConfig.rag,
          ...(ragRaw as Partial<RagParameters>),
          documentRefs: toStringArray(ragRaw.documentRefs),
        },
        structured: {
          ...defaultContextConfig.structured,
          audience: payload.audience,
        },
        interviewAnswers: [],
      },
    },
    { preserveSourceRawContent: true },
  );

  return toPromptConfig(normalized);
}

export function hydrateConfigV1ToWorkingState(raw: unknown): PromptConfig {
  if (!isRecord(raw)) return defaultConfig;
  const embeddedV2Raw = raw[PROMPT_CONFIG_V2_COMPAT_KEY];
  const embeddedV2: PromptConfigV2 | null = isPromptConfigV2Payload(embeddedV2Raw)
    ? embeddedV2Raw
    : null;

  if (!hasLegacyV1Fields(raw)) {
    if (isPromptConfigV2Payload(raw)) {
      return hydrateConfigV2ToWorkingState(raw);
    }
    if (embeddedV2) {
      return hydrateConfigV2ToWorkingState(embeddedV2);
    }
  }

  const candidate = raw as Partial<PromptConfig>;
  const rawContextConfig = isRecord(candidate.contextConfig)
    ? (candidate.contextConfig as Record<string, unknown>)
    : {};
  const rawRag = isRecord(rawContextConfig.rag)
    ? (rawContextConfig.rag as Record<string, unknown>)
    : {};

  const hydrated: PromptConfig = {
    ...defaultConfig,
    ...candidate,
    format: toStringArray(candidate.format),
    constraints: toStringArray(candidate.constraints),
    contextConfig: {
      ...defaultContextConfig,
      ...(rawContextConfig as Partial<typeof defaultContextConfig>),
      sources: Array.isArray(rawContextConfig.sources)
        ? (rawContextConfig.sources as typeof defaultContextConfig.sources)
        : [],
      databaseConnections: Array.isArray(rawContextConfig.databaseConnections)
        ? (rawContextConfig.databaseConnections as typeof defaultContextConfig.databaseConnections)
        : [],
      rag: {
        ...defaultContextConfig.rag,
        ...(rawRag as Partial<typeof defaultContextConfig.rag>),
        documentRefs: toStringArray(rawRag.documentRefs),
      },
      structured: {
        ...defaultContextConfig.structured,
        ...(isRecord(rawContextConfig.structured)
          ? (rawContextConfig.structured as Partial<typeof defaultContextConfig.structured>)
          : {}),
      },
      interviewAnswers: Array.isArray(rawContextConfig.interviewAnswers)
        ? (rawContextConfig.interviewAnswers as typeof defaultContextConfig.interviewAnswers)
        : [],
    },
  };

  return toPromptConfig(normalizeTemplateConfig(hydrated, { preserveSourceRawContent: true }));
}

export function serializeWorkingStateToV1(
  config: PromptConfig,
  options: SerializeWorkingStateToV1Options = {},
): PromptConfig {
  const normalized = toPromptConfig(
    normalizeTemplateConfig(config, {
      preserveSourceRawContent: options.preserveSourceRawContent === true,
    }),
  );
  if (options.includeV2Compat === false) {
    return normalized;
  }

  const v2 = serializeWorkingStateToV2(normalized);
  return {
    ...normalized,
    [PROMPT_CONFIG_SCHEMA_VERSION_KEY]: 2,
    [PROMPT_CONFIG_V2_COMPAT_KEY]: v2,
  } as PromptConfig;
}

export function serializeWorkingStateToV2(config: PromptConfig): PromptConfigV2 {
  const normalized = normalizeTemplateConfig(config);
  const format = [...normalized.format];
  if (normalized.customFormat.trim()) {
    format.push(normalized.customFormat.trim());
  }

  const constraints = [...normalized.constraints];
  if (normalized.customConstraint.trim()) {
    constraints.push(normalized.customConstraint.trim());
  }

  const lengthPreference: "brief" | "standard" | "detailed" =
    normalized.lengthPreference === "brief" || normalized.lengthPreference === "detailed"
      ? normalized.lengthPreference
      : "standard";

  return {
    originalPrompt: toOriginalPrompt(normalized.originalPrompt, normalized.task),
    role: (normalized.customRole || normalized.role || "").trim(),
    audience: normalized.contextConfig.structured.audience,
    tone: normalized.tone,
    format,
    lengthPreference,
    constraints,
    examples: normalized.examples,
    sources: normalized.contextConfig.sources,
    projectNotes: normalized.contextConfig.projectNotes,
    advanced: {
      useDelimiters: normalized.contextConfig.useDelimiters,
      databaseConnections: normalized.contextConfig.databaseConnections,
      rag: normalized.contextConfig.rag,
    },
  };
}
