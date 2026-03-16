const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const SUPPORTED_THREAD_OPTION_KEYS = new Set(["modelReasoningEffort", "webSearchEnabled"]);
const MINIMAL_UNSUPPORTED_MODEL_PATTERNS = [
  /^gpt-5\.4(?:$|-)/,
];

export function normalizeReasoningEffortForModel(model, effort) {
  const normalizedModel = typeof model === "string" ? model.trim().toLowerCase() : "";
  const normalizedEffort = typeof effort === "string" ? effort.trim().toLowerCase() : "";

  if (!normalizedEffort || !REASONING_EFFORTS.has(normalizedEffort)) {
    return {
      value: normalizedEffort || effort,
      adjusted: false,
    };
  }

  if (
    normalizedEffort === "minimal"
    && MINIMAL_UNSUPPORTED_MODEL_PATTERNS.some((pattern) => pattern.test(normalizedModel))
  ) {
    return {
      value: "low",
      adjusted: true,
      reason: "minimal_unsupported_for_model",
    };
  }

  return {
    value: normalizedEffort,
    adjusted: false,
  };
}

export function normalizeThreadOptionsForModel(threadOptions, model) {
  if (!threadOptions || typeof threadOptions !== "object" || Array.isArray(threadOptions)) {
    return {
      value: threadOptions,
      adjusted: false,
    };
  }

  const requestedEffort =
    typeof threadOptions.modelReasoningEffort === "string"
      ? threadOptions.modelReasoningEffort.trim().toLowerCase()
      : undefined;
  const normalizedEffort = normalizeReasoningEffortForModel(model, requestedEffort);

  if (!normalizedEffort.adjusted) {
    return {
      value: threadOptions,
      adjusted: false,
    };
  }

  return {
    value: {
      ...threadOptions,
      modelReasoningEffort: normalizedEffort.value,
    },
    adjusted: true,
    requestedEffort,
    appliedEffort: normalizedEffort.value,
    reason: normalizedEffort.reason,
  };
}

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
