import { describe, expect, it } from "vitest";
import { parseEnhanceMetadata } from "@/lib/enhance-metadata";

describe("parseEnhanceMetadata", () => {
  it("parses a complete backend payload", () => {
    const raw = {
      enhanced_prompt: "Enhanced prompt text",
      parts_breakdown: {
        role: "Data analyst",
        context: "Business context",
        task: "Analyze metrics",
        output_format: "Table",
        examples: null,
        guardrails: "Be concise",
      },
      enhancements_made: ["Added role", "Added format"],
      quality_score: {
        clarity: 8,
        specificity: 7,
        completeness: 6,
        actionability: 9,
        overall: 7.5,
      },
      suggestions: ["Add examples", "Specify audience"],
      alternative_versions: {
        shorter: "Short version",
        more_detailed: "Detailed version",
      },
      detected_context: {
        intent: ["analytical"],
        domain: ["business"],
        complexity: 3,
        mode: "guided",
        input_language: "en",
      },
      missing_parts: ["examples"],
      improvement_delta: 2.5,
      session_context_summary: "Session summary text",
    };

    const result = parseEnhanceMetadata(raw);
    expect(result).not.toBeNull();
    expect(result!.enhancedPrompt).toBe("Enhanced prompt text");
    expect(result!.partsBreakdown?.role).toBe("Data analyst");
    expect(result!.enhancementsMade).toEqual(["Added role", "Added format"]);
    expect(result!.qualityScore?.overall).toBe(7.5);
    expect(result!.suggestions).toEqual(["Add examples", "Specify audience"]);
    expect(result!.alternativeVersions?.shorter).toBe("Short version");
    expect(result!.detectedContext?.intent).toEqual(["analytical"]);
    expect(result!.missingParts).toEqual(["examples"]);
    expect(result!.improvementDelta).toBe(2.5);
    expect(result!.sessionContextSummary).toBe("Session summary text");
  });

  it("returns null when enhanced_prompt is missing", () => {
    const raw = {
      parts_breakdown: { role: "Analyst" },
      suggestions: ["Add context"],
    };
    expect(parseEnhanceMetadata(raw)).toBeNull();
  });

  it("returns null when enhanced_prompt is empty", () => {
    const raw = { enhanced_prompt: "   " };
    expect(parseEnhanceMetadata(raw)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseEnhanceMetadata(null)).toBeNull();
    expect(parseEnhanceMetadata(undefined)).toBeNull();
    expect(parseEnhanceMetadata("string")).toBeNull();
    expect(parseEnhanceMetadata(42)).toBeNull();
  });

  it("handles missing optional fields gracefully", () => {
    const raw = { enhanced_prompt: "Just a prompt" };
    const result = parseEnhanceMetadata(raw);
    expect(result).not.toBeNull();
    expect(result!.enhancedPrompt).toBe("Just a prompt");
    expect(result!.partsBreakdown).toBeUndefined();
    expect(result!.enhancementsMade).toBeUndefined();
    expect(result!.qualityScore).toBeUndefined();
    expect(result!.suggestions).toBeUndefined();
    expect(result!.alternativeVersions).toBeUndefined();
    expect(result!.detectedContext).toBeUndefined();
    expect(result!.missingParts).toBeUndefined();
    expect(result!.improvementDelta).toBeUndefined();
  });

  it("filters empty strings from string arrays", () => {
    const raw = {
      enhanced_prompt: "Prompt",
      enhancements_made: ["Valid", "", "  ", "Also valid"],
      suggestions: ["", ""],
    };
    const result = parseEnhanceMetadata(raw);
    expect(result!.enhancementsMade).toEqual(["Valid", "Also valid"]);
    expect(result!.suggestions).toBeUndefined();
  });

  it("returns undefined for quality_score with zero overall", () => {
    const raw = {
      enhanced_prompt: "Prompt",
      quality_score: {
        clarity: 0,
        specificity: 0,
        completeness: 0,
        actionability: 0,
        overall: 0,
      },
    };
    const result = parseEnhanceMetadata(raw);
    expect(result!.qualityScore).toBeUndefined();
  });

  it("returns undefined for empty alternative_versions", () => {
    const raw = {
      enhanced_prompt: "Prompt",
      alternative_versions: { shorter: "", more_detailed: "" },
    };
    const result = parseEnhanceMetadata(raw);
    expect(result!.alternativeVersions).toBeUndefined();
  });
});
