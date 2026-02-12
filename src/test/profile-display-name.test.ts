import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from "@/lib/profile";

describe("display name validation", () => {
  it("accepts trimmed alphanumeric display names", () => {
    expect(validateDisplayName("Prompt123")).toBeNull();
    expect(validateDisplayName("  Prompt123  ")).toBeNull();
  });

  it("rejects empty display names", () => {
    expect(validateDisplayName("")).toBe("Display name is required.");
    expect(validateDisplayName("   ")).toBe("Display name is required.");
  });

  it("rejects display names with non-alphanumeric characters", () => {
    expect(validateDisplayName("Prompt Dev")).toBe("Display name can only include letters and numbers.");
    expect(validateDisplayName("Prompt_Dev")).toBe("Display name can only include letters and numbers.");
    expect(validateDisplayName("Prompt-Dev")).toBe("Display name can only include letters and numbers.");
  });

  it("rejects display names longer than the max length", () => {
    const tooLong = "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
    expect(validateDisplayName(tooLong)).toBe(
      `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    );
  });
});
