const STRING_FIELD_LABELS = {
  role: "Set AI persona",
  tone: "Adjust tone",
  lengthPreference: "Tune response length",
};

const LIST_FIELD_LABELS = {
  format: "Choose output format",
  constraints: "Add guidance constraints",
};

const TONE_VALUES = [
  "Casual",
  "Technical",
  "Creative",
  "Academic",
  "Professional",
  "Empathetic",
  "Persuasive",
];

const LENGTH_PREFERENCE_VALUES = ["brief", "standard", "detailed"];
const LEGACY_LENGTH_PREFERENCE_ALIASES = {
  moderate: "standard",
};
const MAX_SOURCE_SUMMARIES_IN_PROMPT = 4;
const MAX_SOURCE_SUMMARY_CHARS = 800;

function buildEntrySchema(valueSchema) {
  return {
    type: "object",
    properties: {
      value: valueSchema,
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["value", "confidence"],
    additionalProperties: false,
  };
}

export const INFER_BUILDER_FIELDS_SCHEMA = {
  type: "object",
  properties: {
    role: buildEntrySchema({
      type: "string",
      minLength: 1,
    }),
    tone: buildEntrySchema({
      type: "string",
      enum: TONE_VALUES,
    }),
    lengthPreference: buildEntrySchema({
      type: "string",
      enum: LENGTH_PREFERENCE_VALUES,
    }),
    format: buildEntrySchema({
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "string",
        minLength: 1,
      },
    }),
    constraints: buildEntrySchema({
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "string",
        minLength: 1,
      },
    }),
  },
  additionalProperties: false,
};

export const INFER_SYSTEM_PROMPT = [
  "You infer builder fields for a prompt-engineering UI.",
  "Use the user's draft prompt, existing field values, and request context to infer only missing, unlocked fields.",
  "Be conservative and omit any field you cannot infer with confidence above 0.4.",
  `Tone choices: ${TONE_VALUES.join(", ")}.`,
  `Length choices: ${LENGTH_PREFERENCE_VALUES.join(", ")}.`,
].join("\n");

export function createEmptyBuilderFieldInferenceResult() {
  return {
    inferredUpdates: {},
    inferredFields: [],
    suggestionChips: [],
    confidence: {},
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function truncateText(value, maxChars) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function renderJsonFence(value) {
  return [
    "```json",
    JSON.stringify(value, null, 2),
    "```",
  ].join("\n");
}

function normalizeLengthPreference(value) {
  if (!hasText(value)) return "";
  const normalized = value.trim().toLowerCase();
  const alias = LEGACY_LENGTH_PREFERENCE_ALIASES[normalized];
  if (alias) return alias;
  return LENGTH_PREFERENCE_VALUES.includes(normalized) ? normalized : "";
}

function hasListValue(values) {
  return Array.isArray(values) && values.some((value) => hasText(value));
}

function isLockedToUser(lockMetadata, field) {
  return lockMetadata?.[field] === "user";
}

function createSuggestionChip(field, updates) {
  const label = STRING_FIELD_LABELS[field] || LIST_FIELD_LABELS[field];
  return {
    id: `set-${field}`,
    label,
    description: "Apply AI-inferred details",
    action: {
      type: "set_fields",
      updates,
      fields: [field],
    },
  };
}

function extractJsonObject(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function normalizeConfidence(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.8;
  return Math.max(0, Math.min(1, value));
}

export function buildRequestContextSummary(requestContext) {
  if (!requestContext || typeof requestContext !== "object") return "";

  const lines = [];
  if (typeof requestContext.hasAttachedSources === "boolean") {
    const count = typeof requestContext.attachedSourceCount === "number"
      ? requestContext.attachedSourceCount
      : 0;
    lines.push(`- attached_sources: ${requestContext.hasAttachedSources ? `yes (${count})` : "no"}`);
  }
  if (typeof requestContext.hasPresetOrRemix === "boolean") {
    lines.push(`- preset_or_remix_active: ${requestContext.hasPresetOrRemix ? "yes" : "no"}`);
  }
  if (typeof requestContext.hasSessionContext === "boolean") {
    lines.push(`- session_context_present: ${requestContext.hasSessionContext ? "yes" : "no"}`);
  }
  if (Array.isArray(requestContext.selectedOutputFormats) && requestContext.selectedOutputFormats.length > 0) {
    lines.push(`- selected_output_formats: ${requestContext.selectedOutputFormats.join(", ")}`);
  }
  if (typeof requestContext.hasPastedSourceMaterial === "boolean") {
    lines.push(`- pasted_source_material_present: ${requestContext.hasPastedSourceMaterial ? "yes" : "no"}`);
  }

  return lines.join("\n");
}

export function buildInferUserMessage(prompt, currentFields, lockMetadata, requestContext) {
  const lockedList = Object.entries(lockMetadata || {})
    .filter(([, value]) => value === "user")
    .map(([key]) => key);
  const setEntries = Object.fromEntries(
    Object.entries(currentFields || {})
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.some((entry) => hasText(entry));
      return hasText(value);
    })
    .map(([key, value]) => [key, value]),
  );

  const parts = [
    "Prompt:",
    renderJsonFence({ prompt }),
  ];
  if (Object.keys(setEntries).length > 0) {
    parts.push(`Already set:\n${renderJsonFence(setEntries)}`);
  }
  if (lockedList.length > 0) {
    parts.push(`Locked (skip):\n${renderJsonFence(lockedList)}`);
  }
  const requestContextSummary = buildRequestContextSummary(requestContext);
  if (requestContextSummary) {
    parts.push(`Request context:\n${requestContextSummary}`);
  }
  const sourceSummaries = Array.isArray(requestContext?.sourceSummaries)
    ? requestContext.sourceSummaries
      .filter((entry) => hasText(entry))
      .slice(0, MAX_SOURCE_SUMMARIES_IN_PROMPT)
      .map((entry) => truncateText(entry, MAX_SOURCE_SUMMARY_CHARS))
    : [];
  if (sourceSummaries.length > 0) {
    parts.push(`Attached source summaries:\n${renderJsonFence(sourceSummaries)}`);
  }
  return parts.join("\n");
}

export function buildBuilderFieldInferenceResult({
  rawResponse,
  prompt,
  currentFields,
  lockMetadata,
}) {
  const parsed = extractJsonObject(rawResponse);
  if (!parsed) {
    return createEmptyBuilderFieldInferenceResult();
  }

  const inferredUpdates = {};
  const inferredFields = [];
  const suggestionChips = [];
  const confidence = {};

  for (const field of Object.keys(STRING_FIELD_LABELS)) {
    const entry = parsed[field];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (!hasText(entry.value)) continue;
    if (hasText(currentFields?.[field]) || isLockedToUser(lockMetadata, field)) continue;
    const value = field === "lengthPreference"
      ? normalizeLengthPreference(entry.value)
      : entry.value.trim();
    if (!value) continue;
    inferredUpdates[field] = value;
    inferredFields.push(field);
    suggestionChips.push(createSuggestionChip(field, { [field]: value }));
    confidence[field] = normalizeConfidence(entry.confidence);
  }

  for (const field of Object.keys(LIST_FIELD_LABELS)) {
    const entry = parsed[field];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (!Array.isArray(entry.value) || entry.value.length === 0) continue;
    const values = entry.value
      .filter((value) => hasText(value))
      .map((value) => value.trim());
    if (values.length === 0) continue;
    if (field === "format" && hasListValue(currentFields?.format)) continue;
    if (field === "constraints" && hasListValue(currentFields?.constraints)) continue;
    if (isLockedToUser(lockMetadata, field)) continue;
    inferredUpdates[field] = values;
    inferredFields.push(field);
    suggestionChips.push(createSuggestionChip(field, { [field]: values }));
    confidence[field] = normalizeConfidence(entry.confidence);
  }

  if (suggestionChips.length === 0 && hasText(prompt) && prompt.trim().length > 20) {
    suggestionChips.push({
      id: "append-audience",
      label: "Add audience details",
      description: "Append audience and success criteria hints.",
      action: {
        type: "append_prompt",
        text: "\nAudience: [who this is for]\nDesired outcome: [what success looks like]",
      },
    });
  }

  return {
    inferredUpdates,
    inferredFields,
    suggestionChips,
    confidence,
  };
}
