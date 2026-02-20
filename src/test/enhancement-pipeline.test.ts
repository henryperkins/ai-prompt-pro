import { describe, expect, it } from "vitest";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  parseEnhancementRequestBuilderFields,
  parseEnhancementRequestMode,
  postProcessEnhancementResponse,
} from "../../agent_service/enhancement-pipeline.mjs";

describe("enhancement pipeline", () => {
  it("normalizes builder mode and builder fields from request payload", () => {
    expect(parseEnhancementRequestMode({ builder_mode: "ADVANCED" })).toBe("advanced");
    expect(parseEnhancementRequestMode({ builderMode: "quick" })).toBe("quick");
    expect(parseEnhancementRequestMode({ builder_mode: "unknown" })).toBe("guided");

    expect(
      parseEnhancementRequestBuilderFields({
        builder_fields: {
          role: "",
          context: "Quarterly planning cycle",
          task: "Analyze sales segments",
          output_format: "",
          examples: "",
          guardrails: "Use numbers only when supported",
        },
      }),
    ).toEqual({
      role: "",
      context: "Quarterly planning cycle",
      task: "Analyze sales segments",
      output_format: "",
      examples: "",
      guardrails: "Use numbers only when supported",
    });
  });

  it("injects the six builder fields into the meta prompt even when empty", () => {
    const context = detectEnhancementContext("Help me analyze product churn", {
      builderMode: "guided",
      builderFields: {
        role: "",
        context: "",
        task: "Analyze churn drivers",
        output_format: "",
        examples: "",
        guardrails: "",
      },
    });

    const prompt = buildEnhancementMetaPrompt("Help me analyze product churn", context);

    expect(prompt).toContain("## BUILDER FIELD SNAPSHOT");
    expect(prompt).toContain("- role: (empty)");
    expect(prompt).toContain("- context: (empty)");
    expect(prompt).toContain("- task: Analyze churn drivers");
    expect(prompt).toContain("- output_format: (empty)");
    expect(prompt).toContain("- examples: (empty)");
    expect(prompt).toContain("- guardrails: (empty)");
  });

  it("post-processes structured JSON responses and returns quality metadata", () => {
    const context = detectEnhancementContext("Analyze my company sales data", {
      builderMode: "guided",
      builderFields: {
        role: "Business Analyst",
        context: "",
        task: "Analyze sales trends by region",
        output_format: "Table | Length: standard",
        examples: "",
        guardrails: "Avoid unsupported causal claims",
      },
    });

    const llmResponse = JSON.stringify({
      enhanced_prompt: "You are a senior business analyst. Analyze sales by region and provide recommendations.",
      parts_breakdown: {
        role: "Senior business analyst persona",
        context: "Company sales analytics context",
        task: "Trend + segment + recommendations",
        output_format: "Executive summary + table + actions",
        examples: null,
        guardrails: "Evidence-based conclusions only",
      },
      enhancements_made: ["Added role clarity", "Specified output structure"],
      quality_score: {
        clarity: 9,
        specificity: 9,
        completeness: 9,
        actionability: 8,
        overall: 9,
      },
      suggestions: ["Add time window and source schema"],
      alternative_versions: {
        shorter: "Analyze sales and summarize key trends.",
        more_detailed: "Analyze sales with trend, segment, and risk analysis.",
      },
    });

    const result = postProcessEnhancementResponse({
      llmResponseText: llmResponse,
      userInput: "Analyze my company sales data",
      context,
    });

    expect(result.parse_status).toBe("json");
    expect(result.enhanced_prompt).toContain("senior business analyst");
    expect(result.quality_score.overall).toBe(9);
    expect(result.missing_parts).toEqual([]);
    expect(result.builder_fields.role).toBe("Business Analyst");
    expect(result.word_count.enhanced).toBeGreaterThan(0);
  });

  it("falls back to raw text when model output is not valid JSON", () => {
    const context = detectEnhancementContext("Write a concise release note", {
      builderMode: "quick",
      builderFields: {
        role: "",
        context: "",
        task: "",
        output_format: "",
        examples: "",
        guardrails: "",
      },
    });

    const result = postProcessEnhancementResponse({
      llmResponseText: "You are a product marketer. Draft concise release notes with bullet points.",
      userInput: "Write a concise release note",
      context,
    });

    expect(result.parse_status).toBe("fallback");
    expect(result.enhanced_prompt).toContain("product marketer");
    expect(result.builder_fields).toEqual({
      role: "",
      context: "",
      task: "",
      output_format: "",
      examples: "",
      guardrails: "",
    });
  });
});
