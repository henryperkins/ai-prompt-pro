import { describe, expect, it } from "vitest";
import {
  classifyPrimaryIntent,
  detectEnhancementContext,
  parseEnhancementRequestIntentOverride,
} from "../../agent_service/enhancement-pipeline.mjs";

describe("enhancement pipeline intent routing", () => {
  describe("classifyPrimaryIntent", () => {
    it("routes 'Rewrite this email' to rewrite", () => {
      const result = classifyPrimaryIntent("Rewrite this email to be more concise");
      expect(result.primaryIntent).toBe("rewrite");
    });

    it("routes 'Analyze these retention numbers' to analysis", () => {
      const result = classifyPrimaryIntent("Analyze these retention numbers by cohort");
      expect(result.primaryIntent).toBe("analysis");
    });

    it("routes 'Write a function to sort arrays' to code", () => {
      const result = classifyPrimaryIntent("Write a function to sort arrays in Python");
      expect(result.primaryIntent).toBe("code");
    });

    it("routes 'Brainstorm ideas for a campaign' to brainstorm", () => {
      const result = classifyPrimaryIntent("Brainstorm ideas for a new marketing campaign");
      expect(result.primaryIntent).toBe("brainstorm");
    });

    it("routes 'Extract the key findings' to extraction", () => {
      const result = classifyPrimaryIntent("Extract the key findings from this report");
      expect(result.primaryIntent).toBe("extraction");
    });

    it("routes 'Research the latest trends' to research", () => {
      const result = classifyPrimaryIntent("Research the latest trends in AI safety");
      expect(result.primaryIntent).toBe("research");
    });

    it("routes 'Create a project plan' to planning", () => {
      const result = classifyPrimaryIntent("Create a project plan with milestones and timeline");
      expect(result.primaryIntent).toBe("planning");
    });

    it("preserves secondary intents for mixed prompts", () => {
      const result = classifyPrimaryIntent("Analyze and rewrite this marketing report");
      expect(result.primaryIntent).toBe("rewrite");
      expect(result.secondaryIntents.length).toBeGreaterThan(0);
    });

    it("returns null for empty input", () => {
      const result = classifyPrimaryIntent("");
      expect(result.primaryIntent).toBeNull();
      expect(result.intentConfidence).toBe(0);
    });

    it("returns confidence > 0 for matched intents", () => {
      const result = classifyPrimaryIntent("Analyze the data");
      expect(result.intentConfidence).toBeGreaterThan(0);
    });

    it("biases toward code when builder has developer role", () => {
      const result = classifyPrimaryIntent("Create a utility to debug the API", {
        builderFields: { role: "Software Developer" },
      });
      expect(result.primaryIntent).toBe("code");
    });
  });

  describe("parseEnhancementRequestIntentOverride", () => {
    it("accepts valid intent routes", () => {
      expect(parseEnhancementRequestIntentOverride({ intent_override: "rewrite" })).toBe("rewrite");
      expect(parseEnhancementRequestIntentOverride({ intent_override: "analysis" })).toBe("analysis");
      expect(parseEnhancementRequestIntentOverride({ intentOverride: "code" })).toBe("code");
    });

    it("rejects invalid intent routes", () => {
      expect(parseEnhancementRequestIntentOverride({ intent_override: "invalid" })).toBeNull();
      expect(parseEnhancementRequestIntentOverride({ intent_override: "" })).toBeNull();
      expect(parseEnhancementRequestIntentOverride({})).toBeNull();
      expect(parseEnhancementRequestIntentOverride(null)).toBeNull();
    });
  });

  describe("detectEnhancementContext with intent override", () => {
    it("uses intent_override as primaryIntent when provided", () => {
      const context = detectEnhancementContext("Write a creative story", {
        intentOverride: "rewrite",
      });
      expect(context.primaryIntent).toBe("rewrite");
      expect(context.intentSource).toBe("user");
    });

    it("uses auto-detected intent when no override", () => {
      const context = detectEnhancementContext("Analyze the quarterly numbers");
      expect(context.primaryIntent).toBe("analysis");
      expect(context.intentSource).toBe("auto");
    });

    it("retains original intents in the flat array for analysis", () => {
      const context = detectEnhancementContext("Write a creative story", {
        intentOverride: "analysis",
      });
      expect(context.intent).toContain("creative");
      expect(context.primaryIntent).toBe("analysis");
    });
  });
});
