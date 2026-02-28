import { describe, expect, it } from "vitest";
import {
  buildEnhancementMetaPrompt,
  classifyIntent,
  detectDomain,
  detectEnhancementContext,
  inspectPromptStructure,
  normalizeBuilderFields,
  parseEnhancementJsonResponse,
  parseEnhancementRequestBuilderFields,
  parseEnhancementRequestMode,
  pickPrimaryAgentMessageText,
  postProcessEnhancementResponse,
  scoreComplexity,
  scorePromptQuality,
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

  it("buildEnhancementMetaPrompt has no remaining template placeholders", () => {
    const context = detectEnhancementContext("Write code for an API endpoint", {
      builderMode: "advanced",
      builderFields: {
        role: "Backend Developer",
        context: "Node.js microservice",
        task: "Create REST endpoint",
        output_format: "Code",
        examples: "",
        guardrails: "Follow REST conventions",
      },
    });

    const prompt = buildEnhancementMetaPrompt("Write code for an API endpoint", context);
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  describe("classifyIntent", () => {
    it("detects creative intent", () => {
      expect(classifyIntent("write a short story about space")).toContain("creative");
    });

    it("detects coding intent", () => {
      expect(classifyIntent("build a function to sort arrays")).toContain("coding");
    });

    it("detects multiple intents", () => {
      const intents = classifyIntent("write code to generate a creative story");
      expect(intents).toContain("creative");
      expect(intents).toContain("coding");
    });

    it("returns empty array for unrecognized input", () => {
      expect(classifyIntent("")).toEqual([]);
    });
  });

  describe("detectDomain", () => {
    it("detects technical domain", () => {
      expect(detectDomain("deploy the api server")).toContain("technical");
    });

    it("detects business domain", () => {
      expect(detectDomain("improve our revenue strategy")).toContain("business");
    });

    it("returns empty array for unrecognized input", () => {
      expect(detectDomain("")).toEqual([]);
    });
  });

  describe("scoreComplexity", () => {
    it("returns 1 for short simple input", () => {
      expect(scoreComplexity("hello")).toBe(1);
    });

    it("returns higher score for long input", () => {
      const long = "a".repeat(301) + " and also then";
      expect(scoreComplexity(long)).toBeGreaterThan(2);
    });

    it("boosts score for complexity keywords", () => {
      expect(scoreComplexity("build a comprehensive end-to-end system")).toBeGreaterThanOrEqual(2);
    });

    it("clamps at 5", () => {
      const maxInput = "a".repeat(400) + " and also then multiple complex comprehensive detailed end-to-end";
      expect(scoreComplexity(maxInput)).toBeLessThanOrEqual(5);
    });
  });

  describe("inspectPromptStructure", () => {
    it("detects present sections", () => {
      const result = inspectPromptStructure("Role: be a teacher\nTask: explain gravity");
      expect(result.presentSections).toContain("Role");
      expect(result.presentSections).toContain("Task");
    });

    it("reports missing sections", () => {
      const result = inspectPromptStructure("just a plain prompt");
      expect(result.missingSections).toEqual(expect.arrayContaining(["Role", "Task", "Context", "Format", "Constraints"]));
    });
  });

  describe("parseEnhancementJsonResponse", () => {
    it("parses valid JSON", () => {
      const result = parseEnhancementJsonResponse('{"enhanced_prompt":"test"}');
      expect(result).toEqual({ enhanced_prompt: "test" });
    });

    it("parses code-fenced JSON", () => {
      const result = parseEnhancementJsonResponse('```json\n{"enhanced_prompt":"test"}\n```');
      expect(result).toEqual({ enhanced_prompt: "test" });
    });

    it("returns null for non-JSON input", () => {
      expect(parseEnhancementJsonResponse("just some text")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(parseEnhancementJsonResponse(null)).toBeNull();
      expect(parseEnhancementJsonResponse(undefined)).toBeNull();
    });
  });

  describe("scorePromptQuality", () => {
    it("returns low score for minimal input", () => {
      expect(scorePromptQuality("hi")).toBeLessThanOrEqual(3);
    });

    it("returns higher score for structured input", () => {
      const structured = "You are an expert. Step 1: analyze the data. Format the output as JSON. Don't include personal opinions. Example: {value: 1}. Here are 10 items.";
      expect(scorePromptQuality(structured)).toBeGreaterThanOrEqual(6);
    });
  });

  describe("pickPrimaryAgentMessageText", () => {
    it("returns the last item in order", () => {
      const map = new Map([["a", "first"], ["b", "second"]]);
      expect(pickPrimaryAgentMessageText(map, ["a", "b"])).toBe("second");
    });

    it("falls back to longest when no order match", () => {
      const map = new Map([["x", "short"], ["y", "a longer message"]]);
      expect(pickPrimaryAgentMessageText(map, [])).toBe("a longer message");
    });

    it("returns empty string for empty map", () => {
      expect(pickPrimaryAgentMessageText(new Map(), [])).toBe("");
    });
  });

  describe("normalizeBuilderFields", () => {
    it("returns defaults for null input", () => {
      const result = normalizeBuilderFields(null);
      expect(result).toEqual({
        role: "",
        context: "",
        task: "",
        output_format: "",
        examples: "",
        guardrails: "",
      });
    });

    it("trims whitespace from values", () => {
      const result = normalizeBuilderFields({ role: "  developer  ", task: " build " });
      expect(result.role).toBe("developer");
      expect(result.task).toBe("build");
    });

    it("supports outputFormat alias", () => {
      const result = normalizeBuilderFields({ outputFormat: "JSON" });
      expect(result.output_format).toBe("JSON");
    });
  });
});
