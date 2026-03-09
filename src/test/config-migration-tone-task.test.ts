import { describe, expect, it } from "vitest";
import { normalizeTemplateConfig } from "@/lib/template-store";
import { hydrateConfigV1ToWorkingState } from "@/lib/prompt-config-adapters";
import { defaultConfig } from "@/lib/prompt-builder";

describe("tone migration", () => {
  it("normalizeTemplateConfig preserves explicit Professional tone selections", () => {
    const config = { ...defaultConfig, tone: "Professional" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("Professional");
  });

  it("normalizeTemplateConfig preserves explicit Moderate complexity selections", () => {
    const config = { ...defaultConfig, complexity: "Moderate" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.complexity).toBe("Moderate");
  });

  it("preserves explicitly chosen non-default tones", () => {
    const config = { ...defaultConfig, tone: "Creative" };
    const normalized = normalizeTemplateConfig(config);
    expect(normalized.tone).toBe("Creative");
  });

  it("V1 hydration preserves explicit Professional tone", () => {
    const raw = { originalPrompt: "test", tone: "Professional", complexity: "Moderate" };
    const hydrated = hydrateConfigV1ToWorkingState(raw);
    expect(hydrated.tone).toBe("Professional");
    expect(hydrated.complexity).toBe("Moderate");
  });
});

describe("task-to-originalPrompt migration", () => {
  it("moves task to originalPrompt when originalPrompt is empty", () => {
    const config = {
      ...defaultConfig,
      task: "Write a report",
      originalPrompt: "",
    };
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

  it("preserves task when task migration is disabled", () => {
    const config = {
      ...defaultConfig,
      task: "Write a report",
      originalPrompt: "",
    };
    const normalized = normalizeTemplateConfig(config, {
      migrateTaskToOriginalPrompt: false,
    });

    expect(normalized.task).toBe("Write a report");
    expect(normalized.originalPrompt).toBe("");
  });
});
