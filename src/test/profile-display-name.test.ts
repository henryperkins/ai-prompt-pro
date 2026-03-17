import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX_LENGTH,
  normalizeDisplayName,
  validateDisplayName,
} from "@/lib/profile";

describe("display name validation", () => {
  it("accepts the display name shapes already used by the app", () => {
    expect(validateDisplayName("Prompt Dev")).toBeNull();
    expect(validateDisplayName("jane.doe")).toBeNull();
    expect(validateDisplayName("Jean-Luc O'Brien")).toBeNull();
  });

  it("trims outer whitespace before validating", () => {
    expect(normalizeDisplayName("  Prompt Dev  ")).toBe("Prompt Dev");
    expect(validateDisplayName("  Prompt Dev  ")).toBeNull();
  });

  it("collapses repeated internal whitespace during normalization", () => {
    expect(normalizeDisplayName("Prompt   Dev\t\tTeam")).toBe("Prompt Dev Team");
    expect(validateDisplayName("Prompt   Dev\t\tTeam")).toBeNull();
  });

  it("rejects empty display names", () => {
    expect(validateDisplayName("")).toBe("Display name is required.");
    expect(validateDisplayName("   ")).toBe("Display name is required.");
  });

  it("rejects hidden and control characters", () => {
    expect(validateDisplayName("\u0007Admin")).toBe("Display name cannot include hidden or control characters.");
    expect(validateDisplayName("Prompt\u200BDev")).toBe("Display name cannot include hidden or control characters.");
  });

  it("rejects display names longer than the max length", () => {
    const tooLong = `${"a".repeat(DISPLAY_NAME_MAX_LENGTH)} b`;
    expect(validateDisplayName(tooLong)).toBe(
      `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    );
  });

  it("counts astral-plane letters by visible character count", () => {
    const astralLetter = String.fromCodePoint(0x10400);

    expect(validateDisplayName(astralLetter.repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull();
    expect(validateDisplayName(astralLetter.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(
      `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    );
  });
});
