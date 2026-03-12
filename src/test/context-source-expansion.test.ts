import { describe, expect, it } from "vitest";
import {
  buildExpandedContextSourceBlock,
  buildSourceExpansionDecisionPrompt,
  normalizeEnhanceContextSources,
  parseSourceExpansionDecision,
  selectContextSourcesForExpansion,
} from "../../agent_service/context-source-expansion.mjs";

describe("context source expansion helpers", () => {
  it("normalizes request-side context sources", () => {
    const normalized = normalizeEnhanceContextSources([
      {
        id: "repo-readme",
        type: "file",
        title: "README.md",
        summary: "Repository overview",
        raw_content: "Full README contents",
        original_char_count: 99,
        reference: {
          kind: "file",
          ref_id: "file:README.md",
          locator: "README.md",
        },
      },
    ]);

    expect(normalized.ok).toBe(true);
    expect(normalized.value).toEqual([
      expect.objectContaining({
        id: "repo-readme",
        decisionRef: "source_1",
        type: "file",
        title: "README.md",
        summary: "Repository overview",
        rawContent: "Full README contents",
        originalCharCount: 99,
        expandable: true,
        reference: expect.objectContaining({
          refId: "file:README.md",
          locator: "README.md",
        }),
      }),
    ]);
  });

  it("builds a decision prompt with source catalog details", () => {
    const normalized = normalizeEnhanceContextSources([
      {
        id: "api-docs",
        type: "file",
        title: "docs/api.md",
        summary: "API routes and auth notes",
        raw_content: "Detailed API documentation",
      },
    ]);

    if (!normalized.ok) {
      throw new Error("Expected normalized sources");
    }

    const prompt = buildSourceExpansionDecisionPrompt({
      prompt: "Improve this prompt for repo-aware API guidance.",
      enhancementContext: {
        primaryIntent: "code",
        ambiguityLevel: "medium",
        builderMode: "guided",
        builderFields: {
          role: "Software Developer",
          context: "",
          task: "Document API usage",
          output_format: "",
          examples: "",
          guardrails: "",
        },
        session: {
          contextSummary: "",
          latestEnhancedPrompt: "",
        },
      },
      contextSources: normalized.value,
    });

    expect(prompt).toContain("decision_ref: source_1");
    expect(prompt).toContain("Only request expanded source context");
    expect(prompt).toContain("API routes and auth notes");
  });

  it("parses model decisions and selects matching expandable sources", () => {
    const normalized = normalizeEnhanceContextSources([
      {
        id: "a",
        type: "file",
        title: "README.md",
        summary: "Overview",
        raw_content: "Expanded readme",
        reference: { ref_id: "file:README.md" },
      },
      {
        id: "b",
        type: "file",
        title: "docs/api.md",
        summary: "Routes",
        raw_content: "Expanded API docs",
        reference: { ref_id: "file:docs/api.md" },
      },
    ]);

    if (!normalized.ok) {
      throw new Error("Expected normalized sources");
    }

    const decision = parseSourceExpansionDecision(JSON.stringify({
      needs_source_context: true,
      rationale: "The API summary is too high level for a repo-aware enhancement.",
      source_requests: [
        { ref: "source_2", reason: "Need the detailed route and auth notes." },
      ],
    }));
    const selected = selectContextSourcesForExpansion(
      normalized.value,
      decision.sourceRequests,
    );

    expect(decision.needsSourceContext).toBe(true);
    expect(selected).toEqual([
      expect.objectContaining({
        decisionRef: "source_2",
        title: "docs/api.md",
        rawContent: "Expanded API docs",
        selectionReason: "Need the detailed route and auth notes.",
      }),
    ]);
  });

  it("renders expanded source context blocks for the final enhancement prompt", () => {
    const block = buildExpandedContextSourceBlock([
      {
        decisionRef: "source_1",
        id: "docs-api",
        type: "file",
        title: "docs/api.md",
        summary: "API summary",
        rawContent: "Detailed API guide",
        rawContentTruncated: false,
        reference: { refId: "file:docs/api.md", locator: "docs/api.md" },
        selectionReason: "Need route specifics.",
      },
    ]);

    expect(block).toContain("## ON-DEMAND SOURCE CONTEXT");
    expect(block).toContain("Expanded Source: docs/api.md");
    expect(block).toContain("Detailed API guide");
    expect(block).toContain("Need route specifics.");
  });
});
