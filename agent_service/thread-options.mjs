const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const SUPPORTED_THREAD_OPTION_KEYS = new Set(["modelReasoningEffort", "webSearchEnabled"]);

export function sanitizeEnhanceThreadOptions(input) {
  if (input === undefined) {
    return { ok: true, value: undefined, warnings: [] };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "thread_options must be an object when provided." };
  }

  const source = input;
  const sanitized = {};
  const warnings = [];

  for (const key of Object.keys(source)) {
    if (!SUPPORTED_THREAD_OPTION_KEYS.has(key)) {
      warnings.push({
        field: key,
        reason: "unsupported_field",
      });
    }
  }

  if (typeof source.modelReasoningEffort === "string") {
    const normalizedEffort = source.modelReasoningEffort.trim().toLowerCase();
    if (REASONING_EFFORTS.has(normalizedEffort)) {
      sanitized.modelReasoningEffort = normalizedEffort;
    } else {
      warnings.push({
        field: "modelReasoningEffort",
        reason: "invalid_value",
      });
    }
  } else if (source.modelReasoningEffort !== undefined) {
    warnings.push({
      field: "modelReasoningEffort",
      reason: "invalid_type",
    });
  }

  if (typeof source.webSearchEnabled === "boolean") {
    sanitized.webSearchEnabled = source.webSearchEnabled;
  } else if (source.webSearchEnabled !== undefined) {
    warnings.push({
      field: "webSearchEnabled",
      reason: "invalid_type",
    });
  }

  return {
    ok: true,
    value: Object.keys(sanitized).length > 0 ? sanitized : undefined,
    warnings,
  };
}

export function extractThreadOptions(input) {
  const result = sanitizeEnhanceThreadOptions(input);
  if (!result.ok || !result.value) {
    return {};
  }
  return result.value;
}

export function mergeEnhanceThreadOptions(defaultOptions, requestOptions) {
  const merged = {
    ...(defaultOptions || {}),
    ...(requestOptions || {}),
  };

  if (
    requestOptions
    && Object.prototype.hasOwnProperty.call(requestOptions, "webSearchEnabled")
  ) {
    delete merged.webSearchMode;
  }

  return merged;
}
