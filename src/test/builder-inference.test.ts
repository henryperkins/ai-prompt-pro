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
      confidence: { role: 0.78, tone: 0.72, lengthPreference: 0.72 },
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

  describe("confidence-gated auto-apply", () => {
    it("applies field when confidence >= 0.70", () => {
      const config = { ...defaultConfig };
      const ownership = createFieldOwnershipFromConfig(config);
      const inference = inferBuilderFieldsLocally("debug this API code", config);

      const { appliedFields } = applyInferenceUpdates(config, ownership, inference);
      expect(appliedFields).toContain("role");
    });

    it("skips field when confidence is artificially below 0.70", () => {
      const config = { ...defaultConfig };
      const ownership = createFieldOwnershipFromConfig(config);
      const inference = inferBuilderFieldsLocally("debug this API code", config);

      if (inference.confidence) {
        inference.confidence.role = 0.5;
      }

      const { appliedFields } = applyInferenceUpdates(config, ownership, inference);
      expect(appliedFields).not.toContain("role");
    });
  });

  describe("route-oriented suggestion chips", () => {
    it("includes source, audience, and tone chips for rewrite prompts", () => {
      const config = { ...defaultConfig };
      const result = inferBuilderFieldsLocally("rewrite this email to be more professional", config);
      const chipIds = result.suggestionChips.map((c) => c.id);
      expect(chipIds).toContain("append-source-material");
      expect(chipIds).toContain("append-audience");
      expect(chipIds).toContain("append-tone-guidance");
    });

    it("includes output format, evidence, and comparison chips for analysis prompts", () => {
      const config = { ...defaultConfig };
      const result = inferBuilderFieldsLocally("analyze these quarterly revenue trends by segment", config);
      const chipIds = result.suggestionChips.map((c) => c.id);
      expect(chipIds).toContain("append-output-format");
      expect(chipIds).toContain("append-evidence");
      expect(chipIds).toContain("append-comparison-framework");
    });

    it("suppresses source-material chips when source context is already present", () => {
      const config = { ...defaultConfig };
      const result = inferBuilderFieldsLocally(
        "rewrite this email to be more professional",
        config,
        {
          hasAttachedSources: true,
          attachedSourceCount: 1,
          hasSessionContext: true,
        },
      );

      const chipIds = result.suggestionChips.map((c) => c.id);
      expect(chipIds).not.toContain("append-source-material");
      expect(chipIds).toContain("append-audience");
    });

    it("suppresses output-format chips when formats are already selected", () => {
      const config = { ...defaultConfig, format: ["Table"] };
      const result = inferBuilderFieldsLocally(
        "analyze these quarterly revenue trends by segment",
        config,
        {
          hasAttachedSources: false,
          attachedSourceCount: 0,
          hasSessionContext: false,
          selectedOutputFormats: ["Table"],
        },
      );

      const chipIds = result.suggestionChips.map((c) => c.id);
      expect(chipIds).not.toContain("append-output-format");
      expect(chipIds).toContain("append-evidence");
      expect(chipIds).toContain("append-comparison-framework");
    });

    it("does not add comparison chips for non-analysis generate prompts", () => {
      const config = { ...defaultConfig };
      const result = inferBuilderFieldsLocally(
        "write a launch announcement for new customers",
        config,
      );

      const chipIds = result.suggestionChips.map((c) => c.id);
      expect(chipIds).not.toContain("append-comparison-framework");
    });
  });

  describe("per-match confidence from heuristics", () => {
    it("returns higher confidence for prompts with multiple role keywords", () => {
      const config = { ...defaultConfig };
      const single = inferBuilderFieldsLocally("debug this code", config);
      const multi = inferBuilderFieldsLocally("debug and refactor the code for the API endpoint", config);
      expect(multi.confidence?.role).toBeGreaterThan(single.confidence?.role ?? 0);
    });
  });
});
