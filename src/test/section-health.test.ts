import { describe, expect, it } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import { getSectionHealth } from "@/lib/section-health";

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("getSectionHealth", () => {
  it("marks sections empty for untouched defaults", () => {
    const health = getSectionHealth(buildConfig(), 22);
    expect(health).toEqual({
      builder: "empty",
      context: "empty",
      tone: "empty",
      quality: "empty",
    });
  });

  it("marks builder and tone as complete once key signals are present", () => {
    const health = getSectionHealth(
      buildConfig({
        role: "Software Developer",
        task: "Refactor this function",
        format: ["Markdown"],
        constraints: ["Avoid jargon"],
        tone: "Technical",
        complexity: "Advanced",
      }),
      80,
    );

    expect(health.builder).toBe("complete");
    expect(health.tone).toBe("complete");
    expect(health.quality).toBe("complete");
  });

  it("marks context complete when channels include objective and background", () => {
    const health = getSectionHealth(
      buildConfig({
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "src-1",
              type: "text",
              title: "Notes",
              rawContent: "Context notes",
              summary: "Context notes",
              addedAt: Date.now(),
            },
          ],
          structured: {
            ...defaultConfig.contextConfig.structured,
            audience: "Engineering managers",
            offer: "Launch a release readiness brief for engineering leadership.",
          },
          projectNotes: "Ship by Friday with launch notes, QA checklist, and rollback plan.",
        },
      }),
      58,
    );

    expect(health.context).toBe("complete");
    expect(health.quality).toBe("in_progress");
  });

  it("marks tone in progress when only one tone control changed", () => {
    const health = getSectionHealth(
      buildConfig({
        tone: "Creative",
      }),
      45,
    );

    expect(health.tone).toBe("in_progress");
    expect(health.quality).toBe("empty");
  });

  it("does not mark builder complete without a core intent signal", () => {
    const health = getSectionHealth(
      buildConfig({
        role: "Software Developer",
        format: ["Markdown"],
        constraints: ["Avoid jargon"],
        examples: "Use an onboarding checklist with dependencies and approvals.",
      }),
      80,
    );

    expect(health.builder).toBe("in_progress");
  });

  it("keeps context in progress when objective/background are missing despite channel count", () => {
    const health = getSectionHealth(
      buildConfig({
        contextConfig: {
          ...defaultConfig.contextConfig,
          interviewAnswers: [
            {
              questionId: "constraints",
              question: "Any constraints?",
              answer: "Do not include budget assumptions.",
            },
            {
              questionId: "timeline",
              question: "Timeline?",
              answer: "Need a launch checklist this week.",
            },
          ],
          databaseConnections: [
            {
              id: "db-1",
              label: "Production analytics",
              provider: "postgres",
              connectionRef: "postgres://example",
              database: "analytics",
              tables: ["events"],
              readOnly: true,
            },
          ],
          projectNotes: "Coordinate release notes, QA, and stakeholder comms with a rollback plan before cutover.",
        },
      }),
      58,
    );

    expect(health.context).toBe("in_progress");
  });
});
