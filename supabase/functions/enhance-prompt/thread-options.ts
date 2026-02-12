export type EnhanceReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type SanitizedThreadOptions = {
  modelReasoningEffort?: EnhanceReasoningEffort;
};

export type ThreadOptionsSanitizeResult =
  | { ok: true; value: SanitizedThreadOptions | undefined }
  | { ok: false; error: string };

const REASONING_EFFORTS = new Set<EnhanceReasoningEffort>([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);
const ALLOWED_THREAD_OPTION_KEYS = new Set(["modelReasoningEffort"]);

export function sanitizeEnhanceThreadOptions(input: unknown): ThreadOptionsSanitizeResult {
  if (input === undefined) {
    return { ok: true, value: undefined };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "thread_options must be an object when provided." };
  }

  const source = input as Record<string, unknown>;
  const sanitized: SanitizedThreadOptions = {};
  if (
    ALLOWED_THREAD_OPTION_KEYS.has("modelReasoningEffort") &&
    typeof source.modelReasoningEffort === "string"
  ) {
    const normalizedEffort = source.modelReasoningEffort.trim().toLowerCase();
    if (REASONING_EFFORTS.has(normalizedEffort as EnhanceReasoningEffort)) {
      sanitized.modelReasoningEffort = normalizedEffort as EnhanceReasoningEffort;
    }
  }

  return {
    ok: true,
    value: Object.keys(sanitized).length > 0 ? sanitized : undefined,
  };
}
