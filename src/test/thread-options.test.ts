import { describe, expect, it } from "vitest";
import {
  sanitizeEnhanceThreadOptions,
  extractThreadOptions,
  mergeEnhanceThreadOptions,
} from "../../agent_service/thread-options.mjs";

describe("sanitizeEnhanceThreadOptions", () => {
  it("returns ok with undefined value for undefined input", () => {
    expect(sanitizeEnhanceThreadOptions(undefined)).toEqual({
      ok: true,
      value: undefined,
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
  });

  it("returns undefined value for empty object", () => {
    const result = sanitizeEnhanceThreadOptions({});
    expect(result.ok).toBe(true);
    expect(result.value).toBeUndefined();
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
