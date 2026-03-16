import { describe, expect, it } from "vitest";

import {
  buildInferInputBudget,
  buildInferInputBudgetDetail,
  normalizeInferCurrentFields,
  normalizeInferLockMetadata,
  normalizeInferRequestContext,
} from "../../agent_service/infer-request.mjs";

describe("infer request helpers", () => {
  it("allowlists current fields and lock metadata", () => {
    expect(
      normalizeInferCurrentFields({
        role: " Staff engineer ",
        format: [" Markdown ", "", 42],
        ignored: "drop me",
      }),
    ).toEqual({
      role: "Staff engineer",
      format: ["Markdown"],
    });

    expect(
      normalizeInferLockMetadata({
        role: "USER",
        tone: "empty",
        ignored: "user",
      }),
    ).toEqual({
      role: "user",
      tone: "empty",
    });
  });

  it("caps selected output formats in request context", () => {
    const formats = Array.from({ length: 12 }, (_, index) => `Format ${index + 1}`);

    expect(
      normalizeInferRequestContext({
        hasSessionContext: true,
        selectedOutputFormats: formats,
      }),
    ).toEqual({
      hasSessionContext: true,
      selectedOutputFormats: formats.slice(0, 8),
    });
  });

  it("builds a detailed composed-input budget", () => {
    const budget = buildInferInputBudget({
      prompt: "Analyze the attached brief",
      currentFields: {
        role: "Analyst",
      },
      lockMetadata: {
        tone: "user",
      },
      inferRequestContext: {
        hasAttachedSources: true,
        attachedSourceCount: 2,
        selectedOutputFormats: ["Markdown"],
      },
      sourceSummaries: ["Auth uses PAT tokens."],
      inferInput: "x".repeat(120),
    });

    expect(budget).toMatchObject({
      rawPromptChars: 26,
      sourceSummaryChars: 21,
      composedInferInputChars: 120,
    });
    expect(buildInferInputBudgetDetail(100, budget)).toContain(
      "Builder-field inference input is too large.",
    );
  });
});
