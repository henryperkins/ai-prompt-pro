import { describe, expect, it } from "vitest";
import {
  sanitizeEnhanceThreadOptions,
  extractThreadOptions,
  mergeEnhanceThreadOptions,
  normalizeReasoningEffortForModel,
  normalizeThreadOptionsForModel,
} from "../../agent_service/thread-options.mjs";

describe("sanitizeEnhanceThreadOptions", () => {
  it("returns ok with undefined value for undefined input", () => {
    expect(sanitizeEnhanceThreadOptions(undefined)).toEqual({
      ok: true,
      value: undefined,
      warnings: [],
    });
  });

  it("returns error for non-object input", () => {
    expect(sanitizeEnhanceThreadOptions("string")).toEqual({
      ok: false,
      error: "thread_options must be an object when provided.",
    });
    expect(sanitizeEnhanceThreadOptions(42)).toEqual({
      ok: false,
      error: "thread_options must be an object when provided.",
    });
    expect(sanitizeEnhanceThreadOptions(null)).toEqual({
      ok: false,
      error: "thread_options must be an object when provided.",
    });
    expect(sanitizeEnhanceThreadOptions([])).toEqual({
      ok: false,
      error: "thread_options must be an object when provided.",
    });
  });

  it("accepts all valid reasoning efforts", () => {
    for (const effort of ["minimal", "low", "medium", "high", "xhigh"]) {
      const result = sanitizeEnhanceThreadOptions({ modelReasoningEffort: effort });
      expect(result.ok).toBe(true);
      expect(result.value?.modelReasoningEffort).toBe(effort);
    }
  });

  it("normalizes reasoning effort to lowercase", () => {
    const result = sanitizeEnhanceThreadOptions({ modelReasoningEffort: "HIGH" });
    expect(result.ok).toBe(true);
    expect(result.value?.modelReasoningEffort).toBe("high");
  });

  it("ignores invalid reasoning effort", () => {
    const result = sanitizeEnhanceThreadOptions({ modelReasoningEffort: "ultra" });
    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
    expect(result.warnings).toEqual([
      { field: "modelReasoningEffort", reason: "invalid_value" },
    ]);
  });

  it("accepts boolean webSearchEnabled", () => {
    const result = sanitizeEnhanceThreadOptions({ webSearchEnabled: true });
    expect(result.ok).toBe(true);
    expect(result.value?.webSearchEnabled).toBe(true);
  });

  it("ignores non-boolean webSearchEnabled", () => {
    const result = sanitizeEnhanceThreadOptions({ webSearchEnabled: "yes" });
    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
    expect(result.warnings).toEqual([
      { field: "webSearchEnabled", reason: "invalid_type" },
    ]);
  });

  it("returns undefined value for empty object", () => {
    const result = sanitizeEnhanceThreadOptions({});
    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("returns warnings for unsupported keys", () => {
    const result = sanitizeEnhanceThreadOptions({ sandboxMode: "danger-full-access" });
    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
    expect(result.warnings).toEqual([
      { field: "sandboxMode", reason: "unsupported_field" },
    ]);
  });
});

describe("extractThreadOptions", () => {
  it("returns empty object for undefined input", () => {
    expect(extractThreadOptions(undefined)).toEqual({});
  });

  it("returns empty object for invalid input", () => {
    expect(extractThreadOptions("bad")).toEqual({});
  });

  it("returns sanitized options for valid input", () => {
    const result = extractThreadOptions({ modelReasoningEffort: "medium" });
    expect(result).toEqual({ modelReasoningEffort: "medium" });
  });
});

describe("mergeEnhanceThreadOptions", () => {
  it("drops default webSearchMode when a request explicitly sets webSearchEnabled", () => {
    expect(mergeEnhanceThreadOptions(
      { modelReasoningEffort: "high", webSearchMode: "live" },
      { webSearchEnabled: false },
    )).toEqual({
      modelReasoningEffort: "high",
      webSearchEnabled: false,
    });
  });

  it("retains default webSearchMode when the request does not override web search", () => {
    expect(mergeEnhanceThreadOptions(
      { modelReasoningEffort: "high", webSearchMode: "cached" },
      { modelReasoningEffort: "medium" },
    )).toEqual({
      modelReasoningEffort: "medium",
      webSearchMode: "cached",
    });
  });
});

describe("normalizeReasoningEffortForModel", () => {
  it("coerces minimal reasoning to low for gpt-5.4 models", () => {
    expect(normalizeReasoningEffortForModel("gpt-5.4", "minimal")).toEqual({
      value: "low",
      adjusted: true,
      reason: "minimal_unsupported_for_model",
    });

    expect(normalizeReasoningEffortForModel("gpt-5.4-2026-03-05", "minimal")).toEqual({
      value: "low",
      adjusted: true,
      reason: "minimal_unsupported_for_model",
    });
  });

  it("preserves minimal reasoning for models that still support it", () => {
    expect(normalizeReasoningEffortForModel("gpt-5.3", "minimal")).toEqual({
      value: "minimal",
      adjusted: false,
    });
  });
});

describe("normalizeThreadOptionsForModel", () => {
  it("adjusts modelReasoningEffort only at execution time for unsupported models", () => {
    expect(normalizeThreadOptionsForModel(
      {
        modelReasoningEffort: "minimal",
        webSearchEnabled: true,
      },
      "gpt-5.4",
    )).toEqual({
      value: {
        modelReasoningEffort: "low",
        webSearchEnabled: true,
      },
      adjusted: true,
      requestedEffort: "minimal",
      appliedEffort: "low",
      reason: "minimal_unsupported_for_model",
    });
  });

  it("returns the original thread options when no adjustment is needed", () => {
    const threadOptions = {
      modelReasoningEffort: "medium",
      webSearchEnabled: false,
    };

    expect(normalizeThreadOptionsForModel(threadOptions, "gpt-5.4")).toEqual({
      value: threadOptions,
      adjusted: false,
    });
  });
});
