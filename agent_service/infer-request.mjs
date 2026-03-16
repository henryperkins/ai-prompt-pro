import {
  hasText,
  truncateString,
} from "./env-parse.mjs";
import { buildRequestContextSummary } from "./builder-field-inference.mjs";

const INFER_STRING_FIELDS = ["role", "tone", "lengthPreference"];
const INFER_LIST_FIELDS = ["format", "constraints"];
const LOCK_METADATA_VALUES = new Set(["user", "empty"]);

const MAX_INFER_SOURCE_SUMMARIES = 4;
const MAX_INFER_SOURCE_SUMMARY_CHARS = 800;
const MAX_INFER_SOURCE_SUMMARY_TOTAL_CHARS = 2400;
const MAX_INFER_SELECTED_OUTPUT_FORMATS = 8;
const MAX_INFER_SELECTED_OUTPUT_FORMAT_CHARS = 80;

function countJsonChars(value) {
  if (value === undefined) return 0;
  try {
    return JSON.stringify(value)?.length || 0;
  } catch {
    return 0;
  }
}

function normalizeInferStringList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => typeof entry === "string" && entry.trim())
    .map((entry) => entry.trim());
}

export function normalizeInferCurrentFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};

  for (const field of INFER_STRING_FIELDS) {
    if (!hasText(value[field])) continue;
    normalized[field] = value[field].trim();
  }

  for (const field of INFER_LIST_FIELDS) {
    const entries = normalizeInferStringList(value[field]);
    if (entries.length > 0) {
      normalized[field] = entries;
    }
  }

  return normalized;
}

export function normalizeInferLockMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};

  for (const field of [...INFER_STRING_FIELDS, ...INFER_LIST_FIELDS]) {
    if (!hasText(value[field])) continue;
    const entry = value[field].trim().toLowerCase();
    if (LOCK_METADATA_VALUES.has(entry)) {
      normalized[field] = entry;
    }
  }

  return normalized;
}

export function normalizeInferRequestContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const parsed = {};

  if (typeof value.hasAttachedSources === "boolean") {
    parsed.hasAttachedSources = value.hasAttachedSources;
  }
  if (typeof value.attachedSourceCount === "number" && Number.isFinite(value.attachedSourceCount)) {
    parsed.attachedSourceCount = value.attachedSourceCount;
  }
  if (typeof value.hasPresetOrRemix === "boolean") {
    parsed.hasPresetOrRemix = value.hasPresetOrRemix;
  }
  if (typeof value.hasSessionContext === "boolean") {
    parsed.hasSessionContext = value.hasSessionContext;
  }
  if (Array.isArray(value.selectedOutputFormats)) {
    const formats = value.selectedOutputFormats
      .filter((entry) => typeof entry === "string" && entry.trim())
      .slice(0, MAX_INFER_SELECTED_OUTPUT_FORMATS)
      .map((entry) => truncateString(entry, MAX_INFER_SELECTED_OUTPUT_FORMAT_CHARS));
    if (formats.length > 0) {
      parsed.selectedOutputFormats = formats;
    }
  }
  if (typeof value.hasPastedSourceMaterial === "boolean") {
    parsed.hasPastedSourceMaterial = value.hasPastedSourceMaterial;
  }

  return parsed;
}

export function normalizeInferSourceSummaries(value) {
  if (!Array.isArray(value)) return [];

  let remainingChars = MAX_INFER_SOURCE_SUMMARY_TOTAL_CHARS;
  const summaries = [];

  for (const entry of value.slice(0, MAX_INFER_SOURCE_SUMMARIES)) {
    if (!hasText(entry) || remainingChars <= 0) continue;
    const summary = truncateString(
      entry,
      Math.min(MAX_INFER_SOURCE_SUMMARY_CHARS, remainingChars),
    );
    if (!hasText(summary)) continue;
    summaries.push(summary);
    remainingChars = Math.max(0, remainingChars - summary.length);
  }

  return summaries;
}

export function buildInferInputBudget({
  prompt,
  currentFields,
  lockMetadata,
  inferRequestContext,
  sourceSummaries,
  inferInput,
}) {
  return {
    rawPromptChars: typeof prompt === "string" ? prompt.length : 0,
    currentFieldsChars: countJsonChars(currentFields),
    lockMetadataChars: countJsonChars(lockMetadata),
    requestContextChars: buildRequestContextSummary(inferRequestContext).length,
    sourceSummaryChars: Array.isArray(sourceSummaries)
      ? sourceSummaries.reduce((sum, entry) => {
          return sum + (typeof entry === "string" ? entry.length : 0);
        }, 0)
      : 0,
    composedInferInputChars: typeof inferInput === "string" ? inferInput.length : 0,
  };
}

export function buildInferInputBudgetDetail(maxChars, budget) {
  const detailParts = [
    `raw prompt ${budget.rawPromptChars}`,
    `current fields ${budget.currentFieldsChars}`,
    `lock metadata ${budget.lockMetadataChars}`,
    `request context ${budget.requestContextChars}`,
  ];

  if (budget.sourceSummaryChars > 0) {
    detailParts.push(`source summaries ${budget.sourceSummaryChars}`);
  }

  return [
    "Builder-field inference input is too large.",
    `Maximum ${maxChars} characters; composed prompt is ${budget.composedInferInputChars} characters.`,
    `Breakdown: ${detailParts.join(", ")}.`,
  ].join(" ");
}
