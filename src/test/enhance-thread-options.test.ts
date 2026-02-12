import { describe, expect, it } from "vitest";
import { sanitizeEnhanceThreadOptions } from "../../supabase/functions/enhance-prompt/thread-options";

describe("sanitizeEnhanceThreadOptions", () => {
  it("returns undefined for missing thread options", () => {
    expect(sanitizeEnhanceThreadOptions(undefined)).toEqual({
      ok: true,
      value: undefined,
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
    });
  });

  it("ignores invalid modelReasoningEffort", () => {
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "none" })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("accepts supported modelReasoningEffort values", () => {
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "minimal" })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "minimal" },
    });
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: " HIGH " })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "high" },
    });
    expect(sanitizeEnhanceThreadOptions({ modelReasoningEffort: "high" })).toEqual({
      ok: true,
      value: { modelReasoningEffort: "high" },
    });
  });

  it("accepts webSearchEnabled as boolean only", () => {
    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: true })).toEqual({
      ok: true,
      value: { webSearchEnabled: true },
    });

    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: false })).toEqual({
      ok: true,
      value: { webSearchEnabled: false },
    });

    expect(sanitizeEnhanceThreadOptions({ webSearchEnabled: "true" })).toEqual({
      ok: true,
      value: undefined,
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
    });
  });
});
