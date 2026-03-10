import { describe, expect, it } from "vitest";
import {
  classifyPrimaryIntent,
  detectEnhancementContext,
  postProcessEnhancementResponse,
} from "../../agent_service/enhancement-pipeline.mjs";
import evalCases from "./fixtures/prompt-enhancement-evals.json";

type StructuredField =
  | "primary_intent"
  | "source_task_type"
  | "target_deliverable"
  | "audience"
  | "required_inputs"
  | "constraints"
  | "success_criteria"
  | "assumptions"
  | "open_questions"
  | "verification_needs";

type AmbiguityMode = "ask_me" | "placeholders" | "infer_conservatively";

interface EvalCase {
  id: string;
  category: string;
  input: string;
  expectedPrimaryIntent: string | null;
  expectedAmbiguityLevel: string;
  expectedMissingSlots: string[];
  requiresPlaceholders: boolean;
  requiresOpenQuestions: boolean;
  expectedStructuredFields: StructuredField[];
  forbiddenAssumptions: string[];
}

const REQUIRED_CATEGORIES = [
  "vague",
  "rewrite",
  "analysis",
  "code",
  "brainstorm",
  "extraction",
  "research",
  "planning",
  "fact-sensitive",
] as const;

const REQUIRED_CONTEXT_FIELDS = [
  "intent",
  "domain",
  "complexity",
  "primaryIntent",
  "ambiguityLevel",
  "missingSlots",
] as const;

const PLACEHOLDER_BY_SLOT: Record<string, string> = {
  target_deliverable: "[target deliverable]",
  audience: "[target audience]",
  success_criteria: "[success criteria]",
  source_material: "[source material]",
  factual_verification: "[verified source or timeframe]",
};

const QUESTION_BY_SLOT: Record<string, string> = {
  target_deliverable: "What deliverable should this produce?",
  audience: "Who is the target audience?",
  success_criteria: "What should success look like?",
  source_material: "What source material should be used?",
  factual_verification: "What timeframe or verified sources should be used?",
};

function buildQuestions(evalCase: EvalCase): string[] {
  return evalCase.expectedMissingSlots
    .map((slot) => QUESTION_BY_SLOT[slot])
    .filter((value): value is string => Boolean(value));
}

function buildPlaceholders(evalCase: EvalCase): string[] {
  return evalCase.expectedMissingSlots
    .map((slot) => PLACEHOLDER_BY_SLOT[slot])
    .filter((value): value is string => Boolean(value));
}

function buildEnhancementPlan(evalCase: EvalCase) {
  const questions = buildQuestions(evalCase);

  return {
    primary_intent: evalCase.expectedPrimaryIntent ?? evalCase.category,
    source_task_type: `${evalCase.category} request`,
    target_deliverable: evalCase.expectedMissingSlots.includes(
      "target_deliverable",
    )
      ? PLACEHOLDER_BY_SLOT.target_deliverable
      : `${evalCase.category} output`,
    audience: evalCase.expectedMissingSlots.includes("audience")
      ? PLACEHOLDER_BY_SLOT.audience
      : "stated audience",
    required_inputs: evalCase.expectedMissingSlots.includes("source_material")
      ? [PLACEHOLDER_BY_SLOT.source_material]
      : ["provided source material"],
    constraints: [
      "Preserve the user's stated objective.",
      "Flag uncertainty instead of guessing.",
    ],
    success_criteria: evalCase.expectedMissingSlots.includes(
      "success_criteria",
    )
      ? [PLACEHOLDER_BY_SLOT.success_criteria]
      : ["Return a structured, actionable response."],
    assumptions: [
      "Preserve the user's stated objective without inventing specifics.",
    ],
    open_questions:
      evalCase.requiresOpenQuestions ||
      evalCase.expectedStructuredFields.includes("open_questions")
        ? questions
        : [],
    verification_needs: evalCase.expectedMissingSlots.includes(
      "factual_verification",
    )
      ? ["Verify time-sensitive claims with current sources."]
      : ["Call out unsupported claims."],
  };
}

function buildEnhancedPrompt(evalCase: EvalCase, mode: AmbiguityMode): string {
  const role = `${evalCase.category} specialist`;
  const questions = buildQuestions(evalCase);
  const placeholders = buildPlaceholders(evalCase);

  if (mode === "ask_me" && questions.length > 0) {
    const clarificationBlock = questions
      .map((question, index) => `${index + 1}. ${question}`)
      .join("\n");

    return [
      "Before I enhance further, I need to know:",
      clarificationBlock,
      "",
      "Provisional prompt:",
      `Act as a ${role}. Keep missing details explicit and avoid inventing specifics.`,
    ].join("\n");
  }

  if (mode === "placeholders" && placeholders.length > 0) {
    return `Act as a ${role}. Complete the ${evalCase.category} request using ${placeholders.join(
      ", ",
    )} and keep unresolved details visible.`;
  }

  return `Act as a ${role}. Complete the ${evalCase.category} request with the provided context and note any uncertainty explicitly.`;
}

function buildCannedResponse(evalCase: EvalCase, mode: AmbiguityMode) {
  const questions = buildQuestions(evalCase);
  const placeholders = buildPlaceholders(evalCase);

  return {
    enhanced_prompt: buildEnhancedPrompt(evalCase, mode),
    parts_breakdown: {
      role: `${evalCase.category} specialist`,
      context:
        mode === "placeholders" && placeholders.length > 0
          ? `Keep missing details explicit with ${placeholders.join(", ")}.`
          : "Use the provided context and note missing details explicitly.",
      task: `Handle the ${evalCase.category} request without inventing specifics.`,
      output_format: "Use headings and bullets where helpful.",
      examples: "Mini example output.",
      guardrails:
        "Separate verified facts from assumptions and flag anything missing.",
    },
    enhancements_made: [
      "Clarified the requested task shape.",
      "Added structure for execution and review.",
    ],
    quality_score: {
      clarity: 8,
      specificity: 7,
      completeness: 7,
      actionability: 8,
      overall: 7.5,
    },
    suggestions:
      questions.length > 0
        ? ["Answer the open questions before finalizing the prompt."]
        : ["Add source material if you want tighter grounding."],
    alternative_versions: {
      shorter: "",
      more_detailed: "",
    },
    assumptions_made: [
      "Preserve the user's stated objective without inventing specifics.",
    ],
    open_questions:
      mode === "ask_me" || mode === "placeholders" || evalCase.requiresOpenQuestions
        ? questions
        : [],
    enhancement_plan: buildEnhancementPlan(evalCase),
  };
}

function hasStructuredContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function collectNormalizedText(result: ReturnType<typeof postProcessEnhancementResponse>): string {
  return [
    result.enhanced_prompt,
    ...result.assumptions_made,
    ...(result.open_questions ?? []),
    ...(result.enhancement_plan?.assumptions ?? []),
    ...(result.enhancement_plan?.open_questions ?? []),
  ]
    .join("\n")
    .toLowerCase();
}

describe("prompt enhancement eval set", () => {
  const cases = evalCases as EvalCase[];

  it("covers at least 50 cases across all planned categories", () => {
    const categories = new Set(cases.map((evalCase) => evalCase.category));

    expect(cases.length).toBeGreaterThanOrEqual(50);
    expect(categories).toEqual(new Set(REQUIRED_CATEGORIES));
  });

  describe("intent routing", () => {
    it.each(cases)("$id: routes to the expected primary intent", (evalCase) => {
      const result = classifyPrimaryIntent(evalCase.input);
      expect(result.primaryIntent).toBe(evalCase.expectedPrimaryIntent);
    });
  });

  describe("ambiguity heuristics", () => {
    it.each(cases)("$id: matches the expected ambiguity level", (evalCase) => {
      const context = detectEnhancementContext(evalCase.input);
      expect(context.ambiguityLevel).toBe(evalCase.expectedAmbiguityLevel);
    });

    it.each(cases)("$id: matches the expected missing slots", (evalCase) => {
      const context = detectEnhancementContext(evalCase.input);
      expect(context.missingSlots).toEqual(evalCase.expectedMissingSlots);
    });

    it.each(cases)(
      "$id: always returns the required structural context fields",
      (evalCase) => {
        const context = detectEnhancementContext(evalCase.input);

        for (const field of REQUIRED_CONTEXT_FIELDS) {
          expect(context).toHaveProperty(field);
        }
      },
    );
  });

  describe("placeholder-mode normalization", () => {
    const placeholderCases = cases.filter((evalCase) => evalCase.requiresPlaceholders);

    it.each(placeholderCases)(
      "$id: preserves visible placeholders and structured questions",
      (evalCase) => {
        const context = detectEnhancementContext(evalCase.input, {
          ambiguityMode: "placeholders",
        });
        const result = postProcessEnhancementResponse({
          llmResponseText: JSON.stringify(
            buildCannedResponse(evalCase, "placeholders"),
          ),
          userInput: evalCase.input,
          context,
        });

        expect(result.parse_status).toBe("json");
        expect(result.enhanced_prompt).toMatch(/\[[^\]]+\]/);
        expect(result.open_questions.length).toBeGreaterThan(0);
      },
    );
  });

  describe("clarification-mode normalization", () => {
    const clarificationCases = cases.filter(
      (evalCase) => evalCase.requiresOpenQuestions,
    );

    it.each(clarificationCases)(
      "$id: preserves the clarification block and open questions",
      (evalCase) => {
        const context = detectEnhancementContext(evalCase.input, {
          ambiguityMode: "ask_me",
        });
        const result = postProcessEnhancementResponse({
          llmResponseText: JSON.stringify(buildCannedResponse(evalCase, "ask_me")),
          userInput: evalCase.input,
          context,
        });

        expect(result.parse_status).toBe("json");
        expect(result.enhanced_prompt).toContain(
          "Before I enhance further, I need to know:",
        );
        expect(result.open_questions.length).toBeGreaterThan(0);
      },
    );
  });

  describe("structured plan coverage", () => {
    it.each(cases)(
      "$id: retains the expected structured plan fields without forbidden assumptions",
      (evalCase) => {
        const context = detectEnhancementContext(evalCase.input, {
          ambiguityMode: "infer_conservatively",
        });
        const result = postProcessEnhancementResponse({
          llmResponseText: JSON.stringify(
            buildCannedResponse(evalCase, "infer_conservatively"),
          ),
          userInput: evalCase.input,
          context,
        });

        expect(result.parse_status).toBe("json");
        expect(result.enhancement_plan).not.toBeNull();

        for (const field of evalCase.expectedStructuredFields) {
          expect(
            hasStructuredContent(result.enhancement_plan?.[field]),
          ).toBe(true);
        }

        const normalizedText = collectNormalizedText(result);
        for (const forbiddenAssumption of evalCase.forbiddenAssumptions) {
          expect(normalizedText).not.toContain(
            forbiddenAssumption.toLowerCase(),
          );
        }
      },
    );
  });
});
