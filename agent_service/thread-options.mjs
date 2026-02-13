const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);

export function sanitizeEnhanceThreadOptions(input) {
  if (input === undefined) {
    return { ok: true, value: undefined };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "thread_options must be an object when provided." };
  }

  const source = input;
  const sanitized = {};

  if (typeof source.modelReasoningEffort === "string") {
    const normalizedEffort = source.modelReasoningEffort.trim().toLowerCase();
    if (REASONING_EFFORTS.has(normalizedEffort)) {
      sanitized.modelReasoningEffort = normalizedEffort;
    }
  }

  if (typeof source.webSearchEnabled === "boolean") {
    sanitized.webSearchEnabled = source.webSearchEnabled;
  }

  return {
    ok: true,
    value: Object.keys(sanitized).length > 0 ? sanitized : undefined,
  };
}

export function extractThreadOptions(input) {
  const result = sanitizeEnhanceThreadOptions(input);
  if (!result.ok || !result.value) {
    return {};
  }
  return result.value;
}
