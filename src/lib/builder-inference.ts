import {
  defaultConfig,
  normalizeConstraintSelections,
  type PromptConfig,
} from "@/lib/prompt-builder";
import {
  chooseConstraints,
  chooseFormat,
  chooseLengthPreference,
  chooseRoleWithConfidence,
  chooseToneWithConfidence,
  chooseTaskMode,
  INFERENCE_FIELD_CONFIDENCE,
  INFERENCE_FIELD_LABELS,
  type InferenceField,
} from "../../shared/builder-inference-heuristics";

export type BuilderFieldOwnership = "ai" | "user" | "empty";
export type BuilderInferenceField = InferenceField;

export type BuilderFieldOwnershipMap = Record<
  BuilderInferenceField,
  BuilderFieldOwnership
>;

export interface BuilderSuggestionChip {
  id: string;
  label: string;
  description: string;
  action:
    | {
        type: "set_fields";
        updates: Partial<PromptConfig>;
        fields: BuilderInferenceField[];
      }
    | {
        type: "append_prompt";
        text: string;
      };
}

export interface BuilderInferenceRequestContext {
  hasAttachedSources?: boolean;
  attachedSourceCount?: number;
  hasPresetOrRemix?: boolean;
  hasSessionContext?: boolean;
  selectedOutputFormats?: string[];
  hasPastedSourceMaterial?: boolean;
}

export interface BuilderInferenceResult {
  inferredUpdates: Partial<PromptConfig>;
  inferredFields: BuilderInferenceField[];
  suggestionChips: BuilderSuggestionChip[];
  confidence?: Partial<Record<BuilderInferenceField, number>>;
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRole(config: PromptConfig): boolean {
  return hasText(config.customRole) || hasText(config.role);
}

function hasFormat(config: PromptConfig): boolean {
  return config.format.length > 0 || hasText(config.customFormat);
}

function hasConstraints(config: PromptConfig): boolean {
  return config.constraints.length > 0 || hasText(config.customConstraint);
}

export function createFieldOwnershipFromConfig(
  config: PromptConfig,
): BuilderFieldOwnershipMap {
  return {
    role: hasRole(config) ? "user" : "empty",
    tone: config.tone !== defaultConfig.tone ? "user" : "empty",
    lengthPreference:
      config.lengthPreference !== defaultConfig.lengthPreference
        ? "user"
        : "empty",
    format: hasFormat(config) ? "user" : "empty",
    constraints: hasConstraints(config) ? "user" : "empty",
  };
}

export function listInferenceFieldsFromUpdates(
  updates: Partial<PromptConfig>,
): BuilderInferenceField[] {
  const fields = new Set<BuilderInferenceField>();

  if ("role" in updates || "customRole" in updates) fields.add("role");
  if ("tone" in updates) fields.add("tone");
  if ("lengthPreference" in updates) fields.add("lengthPreference");
  if ("format" in updates || "customFormat" in updates) fields.add("format");
  if ("constraints" in updates || "customConstraint" in updates)
    fields.add("constraints");

  return Array.from(fields);
}

export function markOwnershipFields(
  current: BuilderFieldOwnershipMap,
  fields: BuilderInferenceField[],
  value: BuilderFieldOwnership,
): BuilderFieldOwnershipMap {
  if (fields.length === 0) return current;
  const next = { ...current };
  for (const field of fields) {
    next[field] = value;
  }
  return next;
}

function isFieldEmpty(
  config: PromptConfig,
  field: BuilderInferenceField,
): boolean {
  if (field === "role") return !hasRole(config);
  if (field === "tone") return config.tone === defaultConfig.tone;
  if (field === "lengthPreference")
    return config.lengthPreference === defaultConfig.lengthPreference;
  if (field === "format") return !hasFormat(config);
  return !hasConstraints(config);
}

const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.70;

export function applyInferenceUpdates(
  config: PromptConfig,
  ownership: BuilderFieldOwnershipMap,
  inference: BuilderInferenceResult,
): {
  updates: Partial<PromptConfig>;
  appliedFields: BuilderInferenceField[];
} {
  const updates: Partial<PromptConfig> = {};
  const appliedFields: BuilderInferenceField[] = [];
  const candidateFields =
    inference.inferredFields.length > 0
      ? inference.inferredFields
      : listInferenceFieldsFromUpdates(inference.inferredUpdates);

  for (const field of candidateFields) {
    if (ownership[field] === "user") continue;
    if (!isFieldEmpty(config, field) && ownership[field] !== "ai") continue;

    const fieldConfidence = inference.confidence?.[field] ?? INFERENCE_FIELD_CONFIDENCE[field];
    if (fieldConfidence < AUTO_APPLY_CONFIDENCE_THRESHOLD) continue;

    if (field === "role" && hasText(inference.inferredUpdates.role)) {
      updates.role = inference.inferredUpdates.role;
      updates.customRole = "";
      appliedFields.push(field);
      continue;
    }
    if (field === "tone" && hasText(inference.inferredUpdates.tone)) {
      updates.tone = inference.inferredUpdates.tone;
      appliedFields.push(field);
      continue;
    }
    if (
      field === "lengthPreference" &&
      hasText(inference.inferredUpdates.lengthPreference)
    ) {
      updates.lengthPreference = inference.inferredUpdates.lengthPreference;
      appliedFields.push(field);
      continue;
    }
    if (field === "format" && Array.isArray(inference.inferredUpdates.format)) {
      updates.format = inference.inferredUpdates.format;
      updates.customFormat = "";
      appliedFields.push(field);
      continue;
    }
    if (
      field === "constraints" &&
      Array.isArray(inference.inferredUpdates.constraints)
    ) {
      updates.constraints = normalizeConstraintSelections(
        inference.inferredUpdates.constraints,
      );
      updates.customConstraint = "";
      appliedFields.push(field);
    }
  }

  return { updates, appliedFields };
}

export function clearAiOwnedFields(ownership: BuilderFieldOwnershipMap): {
  updates: Partial<PromptConfig>;
  clearedFields: BuilderInferenceField[];
  nextOwnership: BuilderFieldOwnershipMap;
} {
  const nextOwnership = { ...ownership };
  const updates: Partial<PromptConfig> = {};
  const clearedFields: BuilderInferenceField[] = [];

  if (ownership.role === "ai") {
    updates.role = "";
    updates.customRole = "";
    nextOwnership.role = "empty";
    clearedFields.push("role");
  }
  if (ownership.tone === "ai") {
    updates.tone = defaultConfig.tone;
    nextOwnership.tone = "empty";
    clearedFields.push("tone");
  }
  if (ownership.lengthPreference === "ai") {
    updates.lengthPreference = defaultConfig.lengthPreference;
    nextOwnership.lengthPreference = "empty";
    clearedFields.push("lengthPreference");
  }
  if (ownership.format === "ai") {
    updates.format = [];
    updates.customFormat = "";
    nextOwnership.format = "empty";
    clearedFields.push("format");
  }
  if (ownership.constraints === "ai") {
    updates.constraints = [];
    updates.customConstraint = "";
    nextOwnership.constraints = "empty";
    clearedFields.push("constraints");
  }

  return { updates, clearedFields, nextOwnership };
}

function toChipLabel(field: BuilderInferenceField): string {
  return INFERENCE_FIELD_LABELS[field];
}

function toChipDescription(
  field: BuilderInferenceField,
  updates: Partial<PromptConfig>,
): string {
  if (field === "role") return `Use role: ${updates.role}`;
  if (field === "tone") return `Use tone: ${updates.tone}`;
  if (field === "lengthPreference")
    return `Use length: ${updates.lengthPreference}`;
  if (field === "format") return `Use format: ${updates.format?.join(", ")}`;
  return `Use constraints: ${updates.constraints?.join(", ")}`;
}

function buildSetFieldChip(
  field: BuilderInferenceField,
  updates: Partial<PromptConfig>,
): BuilderSuggestionChip {
  return {
    id: `set-${field}`,
    label: toChipLabel(field),
    description: toChipDescription(field, updates),
    action: {
      type: "set_fields",
      updates,
      fields: [field],
    },
  };
}

const ANALYSIS_PROMPT_PATTERN =
  /\b(analy[sz]e|analysis|assess|evaluate|compare|benchmark|audit|retention|churn|cohort|metrics?|kpi|findings)\b/;

function looksLikeAnalysisPrompt(prompt: string): boolean {
  return ANALYSIS_PROMPT_PATTERN.test(prompt);
}

function buildRouteOrientedChips(
  prompt: string,
  config: PromptConfig,
  requestContext?: BuilderInferenceRequestContext,
): BuilderSuggestionChip[] {
  const taskMode = chooseTaskMode(prompt);
  const isAnalysisPrompt = looksLikeAnalysisPrompt(prompt);
  if (!taskMode && !isAnalysisPrompt) return [];

  const hasSourceContext = Boolean(
    requestContext?.hasAttachedSources ||
      requestContext?.hasPastedSourceMaterial ||
      requestContext?.hasSessionContext,
  );
  const hasSelectedOutputFormats = Boolean(
    requestContext?.selectedOutputFormats &&
      requestContext.selectedOutputFormats.length > 0,
  );

  if (taskMode?.mode === "transform") {
    const chips: BuilderSuggestionChip[] = [];
    if (!hasSourceContext) {
      chips.push({
        id: "append-source-material",
        label: "Add source material",
        description: "Specify what content to transform.",
        action: {
          type: "append_prompt",
          text: "\nSource material: [paste or describe the content to transform]",
        },
      });
    }
    chips.push(
      {
        id: "append-audience",
        label: "Add target audience",
        description: "Who will read the result?",
        action: { type: "append_prompt", text: "\nTarget audience: [who this is for]" },
      },
    );
    if (!hasText(config.tone)) {
      chips.push({
        id: "append-tone-guidance",
        label: "Add tone guidance",
        description: "What tone should the rewrite use?",
        action: {
          type: "append_prompt",
          text: "\nTone: [professional, candid, technical, empathetic, etc.]",
        },
      });
    }
    return chips;
  }

  // analysis or generate
  const chips: BuilderSuggestionChip[] = [];
  if (!hasSelectedOutputFormats) {
    chips.push({
      id: "append-output-format",
      label: "Specify output format",
      description: "Define what the deliverable looks like.",
      action: {
        type: "append_prompt",
        text: "\nOutput format: [table, report, bullet points, etc.]",
      },
    });
  }
  chips.push({
    id: "append-evidence",
    label: "Add evidence requirements",
    description: "What should back the claims?",
    action: {
      type: "append_prompt",
      text: "\nEvidence: [cite sources, use data, include examples]",
    },
  });
  if (isAnalysisPrompt) {
    chips.push({
      id: "append-comparison-framework",
      label: "Add comparison framework",
      description: "Define the baseline, segments, or time periods to compare.",
      action: {
        type: "append_prompt",
        text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
      },
    });
  }
  return chips;
}

function applySuggestionRelevance(
  prompt: string,
  config: PromptConfig,
  chips: BuilderSuggestionChip[],
  requestContext?: BuilderInferenceRequestContext,
): BuilderSuggestionChip[] {
  const normalizedPrompt = prompt.trim().toLowerCase();
  if (!normalizedPrompt) return [];

  if (chips.length > 0) {
    const routeChips = buildRouteOrientedChips(
      normalizedPrompt,
      config,
      requestContext,
    );
    const deduped = new Map<string, BuilderSuggestionChip>();
    for (const chip of [...chips, ...routeChips]) {
      if (!deduped.has(chip.id)) {
        deduped.set(chip.id, chip);
      }
    }
    return Array.from(deduped.values()).slice(0, 6);
  }

  const hasAnyDetails =
    hasRole(config) || hasFormat(config) || hasConstraints(config);

  if (!hasAnyDetails && normalizedPrompt.length > 20) {
    const routeChips = buildRouteOrientedChips(
      normalizedPrompt,
      config,
      requestContext,
    );
    if (routeChips.length > 0) return routeChips.slice(0, 4);

    return [
      {
        id: "append-audience",
        label: "Add audience details",
        description: "Append audience + outcome hints to your prompt.",
        action: {
          type: "append_prompt",
          text: "\nAudience: [who this is for]\nDesired outcome: [what success looks like]",
        },
      },
    ];
  }

  return [];
}

export function inferBuilderFieldsLocally(
  prompt: string,
  config: PromptConfig,
  requestContext?: BuilderInferenceRequestContext,
): BuilderInferenceResult {
  const normalizedPrompt = prompt.trim().toLowerCase();
  if (!normalizedPrompt) {
    return {
      inferredUpdates: {},
      inferredFields: [],
      suggestionChips: [],
    };
  }

  const inferredUpdates: Partial<PromptConfig> = {};
  const inferredFields: BuilderInferenceField[] = [];
  const chips: BuilderSuggestionChip[] = [];
  const confidence: Partial<Record<BuilderInferenceField, number>> = {};

  const roleResult = chooseRoleWithConfidence(normalizedPrompt);
  if (roleResult) {
    inferredUpdates.role = roleResult.role;
    inferredFields.push("role");
    chips.push(
      buildSetFieldChip("role", {
        role: roleResult.role,
        customRole: "",
      }),
    );
    confidence.role = roleResult.confidence;
  }

  const toneResult = chooseToneWithConfidence(normalizedPrompt);
  if (toneResult) {
    inferredUpdates.tone = toneResult.tone;
    inferredFields.push("tone");
    chips.push(buildSetFieldChip("tone", { tone: toneResult.tone }));
    confidence.tone = toneResult.confidence;
  }

  const inferredLength = chooseLengthPreference(normalizedPrompt);
  if (inferredLength) {
    inferredUpdates.lengthPreference = inferredLength;
    inferredFields.push("lengthPreference");
    chips.push(
      buildSetFieldChip("lengthPreference", {
        lengthPreference: inferredLength,
      }),
    );
    confidence.lengthPreference = INFERENCE_FIELD_CONFIDENCE.lengthPreference;
  }

  const inferredFormat = chooseFormat(normalizedPrompt);
  if (inferredFormat.length > 0) {
    inferredUpdates.format = inferredFormat;
    inferredUpdates.customFormat = "";
    inferredFields.push("format");
    chips.push(
      buildSetFieldChip("format", { format: inferredFormat, customFormat: "" }),
    );
    confidence.format = INFERENCE_FIELD_CONFIDENCE.format;
  }

  const inferredConstraints = chooseConstraints(normalizedPrompt);
  if (inferredConstraints.length > 0) {
    inferredUpdates.constraints = inferredConstraints;
    inferredUpdates.customConstraint = "";
    inferredFields.push("constraints");
    chips.push(
      buildSetFieldChip("constraints", {
        constraints: inferredConstraints,
        customConstraint: "",
      }),
    );
    confidence.constraints = INFERENCE_FIELD_CONFIDENCE.constraints;
  }

  return {
    inferredUpdates,
    inferredFields,
    suggestionChips: applySuggestionRelevance(
      normalizedPrompt,
      config,
      chips,
      requestContext,
    ),
    confidence,
  };
}
