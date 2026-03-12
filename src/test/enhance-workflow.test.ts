import { describe, expect, it } from "vitest";

import {
  parseEnhanceWorkflowStep,
  upsertEnhanceWorkflowStep,
  type EnhanceWorkflowStep,
} from "@/lib/enhance-workflow";

describe("enhance workflow helpers", () => {
  it("parses an enhance.workflow payload envelope", () => {
    expect(parseEnhanceWorkflowStep({
      event: "enhance/workflow",
      type: "enhance.workflow",
      payload: {
        step_id: "source_context",
        order: 20,
        label: "Attach source context",
        status: "completed",
        detail: "Expanded 2 attached sources.",
      },
    })).toEqual({
      stepId: "source_context",
      order: 20,
      label: "Attach source context",
      status: "completed",
      detail: "Expanded 2 attached sources.",
    });
  });

  it("returns null for invalid workflow payloads", () => {
    expect(parseEnhanceWorkflowStep({
      payload: {
        step_id: "generate_prompt",
        order: "40",
        label: "Generate enhanced prompt",
        status: "done",
      },
    })).toBeNull();
  });

  it("upserts by step id and preserves order", () => {
    const initial: EnhanceWorkflowStep[] = [
      {
        stepId: "generate_prompt",
        order: 40,
        label: "Generate enhanced prompt",
        status: "running",
      },
    ];

    const withSource = upsertEnhanceWorkflowStep(initial, {
      stepId: "source_context",
      order: 20,
      label: "Attach source context",
      status: "completed",
    });

    expect(withSource.map((step) => step.stepId)).toEqual([
      "source_context",
      "generate_prompt",
    ]);

    const completed = upsertEnhanceWorkflowStep(withSource, {
      stepId: "generate_prompt",
      order: 40,
      label: "Generate enhanced prompt",
      status: "completed",
      detail: "Structured metadata ready.",
    });

    expect(completed).toEqual([
      {
        stepId: "source_context",
        order: 20,
        label: "Attach source context",
        status: "completed",
      },
      {
        stepId: "generate_prompt",
        order: 40,
        label: "Generate enhanced prompt",
        status: "completed",
        detail: "Structured metadata ready.",
      },
    ]);
  });
});
