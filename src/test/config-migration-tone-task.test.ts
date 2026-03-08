import { describe, expect, it } from "vitest";
import { normalizeTemplateConfig } from "@/lib/template-store";
import { hydrateConfigV1ToWorkingState } from "@/lib/prompt-config-adapters";
import { defaultConfig } from "@/lib/prompt-builder";

describe("tone migration", () => {
  it("normalizeTemplateConfig maps legacy Professional tone to empty", () => {
    const config = { ...defaultConfig, tone: "Professional" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("");
  });

  it("preserves explicitly chosen non-default tones", () => {
    const config = { ...defaultConfig, tone: "Creative" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("Creative");
  });

  it("V1 hydration maps Professional tone to empty", () => {
    const raw = { originalPrompt: "test", tone: "Professional" };
    const hydrated = hydrateConfigV1ToWorkingState(raw);
    expect(hydrated.tone).toBe("");
  });
});

describe("task-to-originalPrompt migration", () => {
  it("moves task to originalPrompt when originalPrompt is empty", () => {
    const config = { ...defaultConfig, task: "Write a report", originalPrompt: "" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toBe("Write a report");
    expect(normalized.task).toBe("");
  });

  it("appends task to originalPrompt when both have values", () => {
    const config = {
      ...defaultConfig,
      originalPrompt: "Draft an email",
      task: "Include quarterly figures",
    };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toContain("Draft an email");
    expect(normalized.originalPrompt).toContain("Include quarterly figures");
    expect(normalized.task).toBe("");
  });

  it("does nothing when task is empty", () => {
    const config = { ...defaultConfig, originalPrompt: "Hello", task: "" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.originalPrompt).toBe("Hello");
  });
});
