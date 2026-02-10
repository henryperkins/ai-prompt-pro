import { describe, expect, it } from "vitest";
import {
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  PROMPT_CATEGORY_OPTIONS,
  isPromptCategory,
  normalizePromptCategory,
} from "@/lib/prompt-categories";

describe("prompt category taxonomy", () => {
  it("includes the full saved prompt category set", () => {
    expect(PROMPT_CATEGORIES).toEqual([
      "general",
      "frontend",
      "backend",
      "fullstack",
      "devops",
      "data",
      "ml-ai",
      "security",
      "testing",
      "api",
      "automation",
      "docs",
      "content",
      "analysis",
      "creative",
      "business",
      "education",
    ]);
  });

  it("exposes label and option entries for each category", () => {
    expect(PROMPT_CATEGORY_OPTIONS).toHaveLength(PROMPT_CATEGORIES.length);
    PROMPT_CATEGORIES.forEach((category) => {
      expect(PROMPT_CATEGORY_LABELS[category]).toBeTypeOf("string");
      expect(PROMPT_CATEGORY_OPTIONS.some((option) => option.value === category)).toBe(true);
    });
  });

  it("normalizes category input safely", () => {
    expect(normalizePromptCategory(undefined)).toBeUndefined();
    expect(normalizePromptCategory("")).toBe("general");
    expect(normalizePromptCategory("BUSINESS")).toBe("business");
    expect(normalizePromptCategory("not-a-category")).toBe("general");
    expect(isPromptCategory("content")).toBe(true);
    expect(isPromptCategory("unknown")).toBe(false);
  });
});
