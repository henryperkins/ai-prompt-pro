import { describe, expect, it } from "vitest";
import {
  classifyPrimaryIntent,
  detectEnhancementContext,
} from "../../agent_service/enhancement-pipeline.mjs";
import evalCases from "./fixtures/prompt-enhancement-evals.json";

interface EvalCase {
  id: string;
  category: string;
  input: string;
  expectedPrimaryIntent: string | null;
  expectedAmbiguityLevel: string;
  expectedMissingSlots?: string[];
  forbiddenAssumptions: string[];
}

describe("prompt enhancement eval set", () => {
  describe("intent routing", () => {
    const casesWithExpectedIntent = (evalCases as EvalCase[]).filter(
      (c) => c.expectedPrimaryIntent !== null,
    );

    it.each(casesWithExpectedIntent)(
      "$id: routes to $expectedPrimaryIntent",
      (evalCase) => {
        const result = classifyPrimaryIntent(evalCase.input);
        expect(result.primaryIntent).toBe(evalCase.expectedPrimaryIntent);
      },
    );
  });

  describe("ambiguity level", () => {
    it.each(evalCases as EvalCase[])(
      "$id: ambiguity is $expectedAmbiguityLevel",
      (evalCase) => {
        const ctx = detectEnhancementContext(evalCase.input);
        expect(ctx.ambiguityLevel).toBe(evalCase.expectedAmbiguityLevel);
      },
    );
  });

  describe("missing slot detection for fact-sensitive prompts", () => {
    const factSensitive = (evalCases as EvalCase[]).filter(
      (c) => c.expectedMissingSlots && c.expectedMissingSlots.length > 0,
    );

    it.each(factSensitive)(
      "$id: detects $expectedMissingSlots",
      (evalCase) => {
        const ctx = detectEnhancementContext(evalCase.input);
        for (const slot of evalCase.expectedMissingSlots!) {
          expect(ctx.missingSlots).toContain(slot);
        }
      },
    );
  });

  describe("structured fields present for all inputs", () => {
    it.each(evalCases as EvalCase[])(
      "$id: context has required structural fields",
      (evalCase) => {
        const ctx = detectEnhancementContext(evalCase.input);
        expect(ctx).toHaveProperty("intent");
        expect(ctx).toHaveProperty("domain");
        expect(ctx).toHaveProperty("complexity");
        expect(ctx).toHaveProperty("primaryIntent");
        expect(ctx).toHaveProperty("ambiguityLevel");
        expect(ctx).toHaveProperty("missingSlots");
      },
    );
  });
});
