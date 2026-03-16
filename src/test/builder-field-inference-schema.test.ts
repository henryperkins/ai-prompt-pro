import { describe, expect, it } from "vitest";

import {
  buildBuilderFieldInferenceResult,
  buildInferUserMessage,
  createEmptyBuilderFieldInferenceResult,
  INFER_BUILDER_FIELDS_SCHEMA,
} from "../../agent_service/builder-field-inference.mjs";

describe("builder-field inference schema helpers", () => {
  it("exposes a closed JSON schema for Codex outputSchema", () => {
    expect(INFER_BUILDER_FIELDS_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        role: {
          required: ["value", "confidence"],
          additionalProperties: false,
        },
        constraints: {
          required: ["value", "confidence"],
          additionalProperties: false,
        },
      },
    });
  });

  it("normalizes structured inference output while skipping set or locked fields", () => {
    const result = buildBuilderFieldInferenceResult({
      rawResponse: JSON.stringify({
        role: { value: "Software Developer", confidence: 0.92 },
        tone: { value: "Technical", confidence: 0.77 },
        lengthPreference: { value: "detailed", confidence: 0.81 },
        format: { value: ["JSON", "Table"], confidence: 0.88 },
        constraints: { value: [" Include citations ", "", "Use examples"], confidence: 0.72 },
      }),
      prompt: "Analyze the attached API brief and produce a rollout plan.",
      currentFields: {
        tone: "Professional",
        format: ["Markdown"],
      },
      lockMetadata: {
        lengthPreference: "user",
      },
    });

    expect(result.inferredUpdates).toEqual({
      role: "Software Developer",
      constraints: ["Include citations", "Use examples"],
    });
    expect(result.inferredFields).toEqual(["role", "constraints"]);
    expect(result.confidence).toEqual({
      role: 0.92,
      constraints: 0.72,
    });
    expect(result.suggestionChips.map((chip) => chip.id)).toEqual([
      "set-role",
      "set-constraints",
    ]);
  });

  it("accepts already-parsed structured objects", () => {
    const result = buildBuilderFieldInferenceResult({
      rawResponse: {
        format: { value: ["Bullet points"], confidence: 0.86 },
      },
      prompt: "Rewrite this email update for executives.",
      currentFields: {},
      lockMetadata: {},
    });

    expect(result.inferredUpdates).toEqual({
      format: ["Bullet points"],
    });
    expect(result.inferredFields).toEqual(["format"]);
  });

  it("normalizes legacy moderate length values to standard", () => {
    const result = buildBuilderFieldInferenceResult({
      rawResponse: {
        lengthPreference: { value: "moderate", confidence: 0.86 },
      },
      prompt: "Rewrite this email update for executives.",
      currentFields: {},
      lockMetadata: {},
    });

    expect(result.inferredUpdates).toEqual({
      lengthPreference: "standard",
    });
    expect(result.inferredFields).toEqual(["lengthPreference"]);
    expect(result.suggestionChips[0]?.action).toMatchObject({
      type: "set_fields",
      updates: {
        lengthPreference: "standard",
      },
    });
  });

  it("falls back to the audience chip when structured output yields nothing", () => {
    const result = buildBuilderFieldInferenceResult({
      rawResponse: JSON.stringify({}),
      prompt: "Draft a proposal for a new onboarding workflow with clear business value.",
      currentFields: {},
      lockMetadata: {},
    });

    expect(result.inferredUpdates).toEqual({});
    expect(result.inferredFields).toEqual([]);
    expect(result.suggestionChips).toHaveLength(1);
    expect(result.suggestionChips[0]?.id).toBe("append-audience");
  });

  it("returns the empty result for unparsable responses", () => {
    expect(buildBuilderFieldInferenceResult({
      rawResponse: "not json",
      prompt: "Short prompt",
      currentFields: {},
      lockMetadata: {},
    })).toEqual(createEmptyBuilderFieldInferenceResult());
  });

  it("includes request-context hints in the infer user message", () => {
    const message = buildInferUserMessage(
      "Improve this customer support workflow",
      { tone: "Technical" },
      { role: "user" },
      {
        hasAttachedSources: true,
        attachedSourceCount: 2,
        hasPresetOrRemix: false,
        hasSessionContext: true,
        selectedOutputFormats: ["Markdown", "Table"],
        hasPastedSourceMaterial: true,
        sourceSummaries: ["API authentication uses PAT tokens."],
      },
    );

    expect(message).toContain("\"prompt\": \"Improve this customer support workflow\"");
    expect(message).toContain("\"tone\": \"Technical\"");
    expect(message).toContain("Locked (skip):");
    expect(message).toContain("\"role\"");
    expect(message).toContain("- attached_sources: yes (2)");
    expect(message).toContain("- selected_output_formats: Markdown, Table");
    expect(message).toContain("- pasted_source_material_present: yes");
    expect(message).toContain("Attached source summaries:");
    expect(message).toContain("API authentication uses PAT tokens.");
  });
});
