import { describe, expect, it } from "vitest";
import { sanitizeEnhanceThreadOptions } from "../../agent_service/thread-options.mjs";

describe("sanitizeEnhanceThreadOptions", () => {
  it("returns undefined for missing thread options", () => {
    expect(sanitizeEnhanceThreadOptions(undefined)).toEqual({
      ok: true,
      value: undefined,
      warnings: [],
    });
  });

  it("rejects non-object thread options payloads", () => {
    expect(sanitizeEnhanceThreadOptions("invalid")).toEqual({
      ok: false,
      error: "thread_options must be an object when provided.",
    });
  });

  it("ignores unsupported thread option keys", () => {
    expect(sanitizeEnhanceThreadOptions({ sandboxMode: "danger-full-access" })).toEqual({
      ok: true,
      value: undefined,
      warnings: [{ field: "sandboxMode", reason: "unsupported_field" }],
    });
  });

  it("ignores invalid modelReasoningEffort", () => {
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "none" })).toEqual({
      ok: true,
      value: undefined,
      warnings: [{ field: "modelReasoningEffort", reason: "invalid_value" }],
    });
  });

  it("accepts supported modelReasoningEffort values", () => {
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "minimal" })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "minimal" },
      warnings: [],
    });
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: " HIGH " })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "high" },
      warnings: [],
    });
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "high" })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "high" },
      warnings: [],
    });
  });

  it("accepts webSearchEnabled as boolean only", () => {
    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: true })).toEqual({
      ok: true,
      value: { webSearchEnabled: true },
      warnings: [],
    });

    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: false })).toEqual({
      ok: true,
      value: { webSearchEnabled: false },
      warnings: [],
    });

    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: "true" })).toEqual({
      ok: true,
      value: undefined,
      warnings: [{ field: "webSearchEnabled", reason: "invalid_type" }],
    });
  });

  it("keeps supported keys and drops unsupported keys", () => {
    expect(
      sanitizeEnhanceThreadOptions({
        modelReasoningEffort: "medium",
        webSearchEnabled: true,
        sandboxMode: "danger-full-access",
      }),
    ).toEqual({
      ok: true,
      value: { modelReasoningEffort: "medium", webSearchEnabled: true },
      warnings: [{ field: "sandboxMode", reason: "unsupported_field" }],
    });
  });
});
