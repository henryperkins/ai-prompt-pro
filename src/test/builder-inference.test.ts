import { describe, expect, it } from "vitest";
import {
  applyInferenceUpdates,
  clearAiOwnedFields,
  createFieldOwnershipFromConfig,
  inferBuilderFieldsLocally,
  listInferenceFieldsFromUpdates,
  markOwnershipFields,
} from "@/lib/builder-inference";
import { defaultConfig } from "@/lib/prompt-builder";

describe("builder inference utilities", () => {
  it("produces local inference suggestions from prompt text", () => {
    const config = { ...defaultConfig };
    const inference = inferBuilderFieldsLocally(
      "Draft a brief email update in bullet list format for stakeholders",
      config,
    );

    expect(inference.inferredFields).toContain("role");
    expect(inference.inferredFields).toContain("lengthPreference");
    expect(inference.inferredFields).toContain("format");
    expect(inference.suggestionChips.length).toBeGreaterThan(0);
  });

  it("does not apply inferred updates to user-owned fields", () => {
    const config = {
      ...defaultConfig,
      role: "Teacher",
      tone: "Technical",
    };
    const ownership = markOwnershipFields(
      createFieldOwnershipFromConfig(config),
      ["role", "tone"],
      "user",
    );

    const inference = {
      inferredUpdates: {
        role: "Expert Copywriter",
        tone: "Casual",
        lengthPreference: "brief",
      },
      inferredFields: ["role", "tone", "lengthPreference"] as const,
      suggestionChips: [],
    };

    const applied = applyInferenceUpdates(config, ownership, inference);
    expect(applied.appliedFields).toEqual(["lengthPreference"]);
    expect(applied.updates.role).toBeUndefined();
    expect(applied.updates.tone).toBeUndefined();
    expect(applied.updates.lengthPreference).toBe("brief");
  });

  it("applies inferred updates when inferredFields is omitted", () => {
    const config = { ...defaultConfig };
    const ownership = createFieldOwnershipFromConfig(config);
    const inference = {
      inferredUpdates: {
        tone: "Technical",
        format: ["JSON"],
      },
      inferredFields: [] as const,
      suggestionChips: [],
    };

    const applied = applyInferenceUpdates(config, ownership, inference);
    expect(applied.appliedFields).toEqual(["tone", "format"]);
    expect(applied.updates.tone).toBe("Technical");
    expect(applied.updates.format).toEqual(["JSON"]);
  });

  it("clears only AI-owned inferred fields", () => {
    const ownership = {
      role: "ai",
      tone: "user",
      lengthPreference: "ai",
      format: "empty",
      constraints: "ai",
    } as const;

    const cleared = clearAiOwnedFields(ownership);
    expect(cleared.clearedFields).toEqual(["role", "lengthPreference", "constraints"]);
    expect(cleared.updates.role).toBe("");
    expect(cleared.updates.lengthPreference).toBe("standard");
    expect(cleared.updates.constraints).toEqual([]);
    expect(cleared.nextOwnership.tone).toBe("user");
  });

  it("maps manual field updates to ownership keys", () => {
    const fields = listInferenceFieldsFromUpdates({
      role: "Data Analyst",
      format: ["Table"],
      customConstraint: "Keep under 100 words",
    });

    expect(fields).toEqual(["role", "format", "constraints"]);
  });
});
