import { describe, expect, it } from "vitest";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  parseEnhancementRequestAmbiguityMode,
  postProcessEnhancementResponse,
} from "../../agent_service/enhancement-pipeline.mjs";

describe("enhancement pipeline ambiguity handling", () => {
  describe("parseEnhancementRequestAmbiguityMode", () => {
    it("accepts valid ambiguity modes", () => {
      expect(parseEnhancementRequestAmbiguityMode({ ambiguity_mode: "ask_me" })).toBe("ask_me");
      expect(parseEnhancementRequestAmbiguityMode({ ambiguity_mode: "placeholders" })).toBe("placeholders");
      expect(parseEnhancementRequestAmbiguityMode({ ambiguityMode: "infer_conservatively" })).toBe("infer_conservatively");
    });

    it("defaults to infer_conservatively for invalid values", () => {
      expect(parseEnhancementRequestAmbiguityMode({ ambiguity_mode: "invalid" })).toBe("infer_conservatively");
      expect(parseEnhancementRequestAmbiguityMode({})).toBe("infer_conservatively");
      expect(parseEnhancementRequestAmbiguityMode(null)).toBe("infer_conservatively");
    });
  });

  describe("missing-slot detection", () => {
    it("detects missing audience for vague prompts", () => {
      const ctx = detectEnhancementContext("Write a proposal");
      expect(ctx.missingSlots).toContain("audience");
    });

    it("detects missing success criteria", () => {
      const ctx = detectEnhancementContext("Make this better");
      expect(ctx.missingSlots).toContain("success_criteria");
    });

    it("does not flag audience when audience signal is present", () => {
      const ctx = detectEnhancementContext("Write a proposal for the executive team");
      expect(ctx.missingSlots).not.toContain("audience");
    });

    it("flags factual_verification for time-sensitive prompts", () => {
      const ctx = detectEnhancementContext("What are the latest AI safety statistics for this year?");
      expect(ctx.missingSlots).toContain("factual_verification");
    });

    it("does not flag target_deliverable when artifact type is clear", () => {
      const ctx = detectEnhancementContext("Write an email to the team about the launch");
      expect(ctx.missingSlots).not.toContain("target_deliverable");
    });

    it("still flags target_deliverable when builder task mirrors the raw prompt", () => {
      const ctx = detectEnhancementContext("Help", {
        builderFields: { task: "Help" },
      });
      expect(ctx.missingSlots).toContain("target_deliverable");
    });

    it("suppresses target_deliverable when builder task adds a real artifact noun", () => {
      const ctx = detectEnhancementContext("Help", {
        builderFields: { task: "Write a project plan for Q3" },
      });
      expect(ctx.missingSlots).not.toContain("target_deliverable");
    });

    it("detects audience from label-style builder context (Audience: CFOs)", () => {
      const ctx = detectEnhancementContext("Write a proposal", {
        builderFields: { context: "Audience: CFOs" },
      });
      expect(ctx.missingSlots).not.toContain("audience");
    });

    it("detects audience from 'Target audience - internal stakeholders'", () => {
      const ctx = detectEnhancementContext("Write a proposal", {
        builderFields: { context: "Target audience - internal stakeholders" },
      });
      expect(ctx.missingSlots).not.toContain("audience");
    });

    it("detects audience from 'For executives'", () => {
      const ctx = detectEnhancementContext("Write a proposal", {
        builderFields: { context: "For executives" },
      });
      expect(ctx.missingSlots).not.toContain("audience");
    });

    it("handles uppercase audience text the same as lowercase", () => {
      const ctx = detectEnhancementContext("Write a proposal", {
        builderFields: { context: "AUDIENCE: EXECUTIVES" },
      });
      expect(ctx.missingSlots).not.toContain("audience");
    });
  });

  describe("ambiguity level", () => {
    it("returns high for very vague prompts", () => {
      const ctx = detectEnhancementContext("Help");
      expect(ctx.ambiguityLevel).toBe("high");
    });

    it("returns high for short vague prompts (< 5 words)", () => {
      const ctx = detectEnhancementContext("Write a proposal");
      expect(ctx.ambiguityLevel).toBe("high");
    });

    it("returns medium for prompts with some missing context", () => {
      const ctx = detectEnhancementContext(
        "Write a blog post about machine learning trends for developers",
      );
      expect(ctx.ambiguityLevel).toBe("medium");
    });

    it("returns low for specific prompts with rich context", () => {
      const ctx = detectEnhancementContext(
        "Write a report analyzing Q3 revenue data for the board based on the provided source documents, with tables and success criteria for meeting the quarterly objective",
      );
      expect(ctx.ambiguityLevel).toBe("low");
    });
  });

  describe("ambiguity mode meta-prompt injection", () => {
    it("injects ask_me addon", () => {
      const ctx = detectEnhancementContext("Write a proposal", { ambiguityMode: "ask_me" });
      const prompt = buildEnhancementMetaPrompt("Write a proposal", ctx);
      expect(prompt).toContain("ASK ME");
      expect(prompt).toContain("CLARIFICATION BLOCK");
    });

    it("injects placeholders addon", () => {
      const ctx = detectEnhancementContext("Write a proposal", { ambiguityMode: "placeholders" });
      const prompt = buildEnhancementMetaPrompt("Write a proposal", ctx);
      expect(prompt).toContain("USE PLACEHOLDERS");
      expect(prompt).toContain("[target audience]");
    });

    it("injects infer_conservatively addon", () => {
      const ctx = detectEnhancementContext("Write a proposal", { ambiguityMode: "infer_conservatively" });
      const prompt = buildEnhancementMetaPrompt("Write a proposal", ctx);
      expect(prompt).toContain("INFER CONSERVATIVELY");
    });

    it("makes ambiguity-mode precedence explicit in the meta prompt", () => {
      const ctx = detectEnhancementContext("Write a proposal", {
        ambiguityMode: "placeholders",
      });
      const prompt = buildEnhancementMetaPrompt("Write a proposal", ctx);

      expect(prompt).toContain("Use all parts. If details are missing, handle them according to the active ambiguity mode below.");
      expect(prompt).toContain("## AMBIGUITY MODE PRECEDENCE");
      expect(prompt).toContain("Do NOT infer or guess missing information");
    });
  });

  describe("assumptions and open questions in post-processing", () => {
    it("normalizes assumptions_made and open_questions from model output", () => {
      const ctx = detectEnhancementContext("Write a proposal", { ambiguityMode: "infer_conservatively" });
      const llmResponse = JSON.stringify({
        enhanced_prompt: "You are a business consultant...",
        parts_breakdown: {
          role: "Business consultant",
          context: "General business context",
          task: "Write a proposal",
          output_format: "Document",
          examples: null,
          guardrails: "Stay professional",
        },
        enhancements_made: ["Added role"],
        quality_score: { clarity: 7, specificity: 6, completeness: 5, actionability: 7, overall: 6 },
        suggestions: ["Specify the audience"],
        alternative_versions: { shorter: "", more_detailed: "" },
        assumptions_made: [
          "Assuming a business audience",
          "Assuming formal tone is appropriate",
        ],
        open_questions: [
          "What is the proposal about?",
          "Who is the target audience?",
        ],
      });

      const result = postProcessEnhancementResponse({
        llmResponseText: llmResponse,
        userInput: "Write a proposal",
        context: ctx,
      });

      expect(result.assumptions_made).toEqual([
        "Assuming a business audience",
        "Assuming formal tone is appropriate",
      ]);
      expect(result.open_questions).toEqual([
        "What is the proposal about?",
        "Who is the target audience?",
      ]);
      expect(result.ambiguity_level).toBe("high");
    });

    it("returns empty arrays when model does not provide assumptions", () => {
      const ctx = detectEnhancementContext("Write code to sort arrays");
      const llmResponse = JSON.stringify({
        enhanced_prompt: "You are a developer...",
        parts_breakdown: { role: "Dev", context: "", task: "Sort", output_format: "Code", examples: null, guardrails: "" },
        enhancements_made: [],
        quality_score: { clarity: 7, specificity: 7, completeness: 7, actionability: 7, overall: 7 },
        suggestions: [],
        alternative_versions: { shorter: "", more_detailed: "" },
      });

      const result = postProcessEnhancementResponse({
        llmResponseText: llmResponse,
        userInput: "Write code to sort arrays",
        context: ctx,
      });

      expect(result.assumptions_made).toEqual([]);
      expect(result.open_questions).toEqual([]);
    });
  });
});
