import { describe, expect, it } from "vitest";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  postProcessEnhancementResponse,
} from "../../agent_service/enhancement-pipeline.mjs";

describe("enhancement plan schema", () => {
  it("meta-prompt includes enhancement_plan in the JSON schema", () => {
    const ctx = detectEnhancementContext("Write a report analyzing sales data", {
      builderMode: "guided",
    });
    const prompt = buildEnhancementMetaPrompt("Write a report analyzing sales data", ctx);
    expect(prompt).toContain("enhancement_plan");
    expect(prompt).toContain("primary_intent");
    expect(prompt).toContain("target_deliverable");
    expect(prompt).toContain("verification_needs");
  });

  it("meta-prompt includes the enhancement process instruction", () => {
    const ctx = detectEnhancementContext("Analyze data", { builderMode: "guided" });
    const prompt = buildEnhancementMetaPrompt("Analyze data", ctx);
    expect(prompt).toContain("ENHANCEMENT PROCESS");
    expect(prompt).toContain("build an `enhancement_plan`");
  });

  it("normalizes enhancement_plan when model returns it", () => {
    const ctx = detectEnhancementContext("Analyze sales trends", { builderMode: "guided" });
    const llmResponse = JSON.stringify({
      enhanced_prompt: "You are a sales analyst...",
      parts_breakdown: {
        role: "Sales analyst", context: "", task: "Analyze", output_format: "Report",
        examples: null, guardrails: "",
      },
      enhancements_made: ["Added structure"],
      quality_score: { clarity: 8, specificity: 7, completeness: 7, actionability: 8, overall: 7.5 },
      suggestions: [],
      alternative_versions: { shorter: "", more_detailed: "" },
      assumptions_made: [],
      open_questions: [],
      enhancement_plan: {
        primary_intent: "analysis",
        source_task_type: "data analysis",
        target_deliverable: "sales report",
        audience: "leadership team",
        required_inputs: ["sales data by region"],
        constraints: ["use only provided data"],
        success_criteria: ["identify top 3 growth drivers"],
        assumptions: ["Q3 data is complete"],
        open_questions: ["Which regions to prioritize?"],
        verification_needs: ["cross-check totals"],
      },
    });

    const result = postProcessEnhancementResponse({
      llmResponseText: llmResponse,
      userInput: "Analyze sales trends",
      context: ctx,
    });

    expect(result.enhancement_plan).not.toBeNull();
    expect(result.enhancement_plan.primary_intent).toBe("analysis");
    expect(result.enhancement_plan.target_deliverable).toBe("sales report");
    expect(result.enhancement_plan.required_inputs).toEqual(["sales data by region"]);
    expect(result.enhancement_plan.verification_needs).toEqual(["cross-check totals"]);
  });

  it("returns null enhancement_plan when model does not include it", () => {
    const ctx = detectEnhancementContext("Write a note", { builderMode: "quick" });
    const llmResponse = JSON.stringify({
      enhanced_prompt: "Write a concise note...",
      parts_breakdown: {
        role: "", context: "", task: "Write note", output_format: "",
        examples: null, guardrails: "",
      },
      enhancements_made: [],
      quality_score: { clarity: 5, specificity: 5, completeness: 5, actionability: 5, overall: 5 },
      suggestions: [],
      alternative_versions: { shorter: "", more_detailed: "" },
    });

    const result = postProcessEnhancementResponse({
      llmResponseText: llmResponse,
      userInput: "Write a note",
      context: ctx,
    });

    expect(result.enhancement_plan).toBeNull();
  });

  it("fallback mode still works without enhancement_plan", () => {
    const ctx = detectEnhancementContext("Just a plain text", { builderMode: "quick" });
    const result = postProcessEnhancementResponse({
      llmResponseText: "You should write it like this.",
      userInput: "Just a plain text",
      context: ctx,
    });

    expect(result.parse_status).toBe("fallback");
    expect(result.enhanced_prompt).toContain("write it like this");
    expect(result.enhancement_plan).toBeNull();
  });
});
