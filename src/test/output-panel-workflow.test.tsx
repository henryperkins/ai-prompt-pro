import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutputPanel } from "@/components/OutputPanel";
import type { EnhanceWorkflowStep } from "@/lib/enhance-workflow";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: vi.fn(),
}));

const BASE_WORKFLOW: EnhanceWorkflowStep[] = [
  {
    stepId: "analyze_request",
    order: 10,
    label: "Analyze request",
    status: "completed",
    detail: "Detected analysis intent in structured rewrite mode.",
  },
  {
    stepId: "generate_prompt",
    order: 40,
    label: "Generate enhanced prompt",
    status: "running",
    detail: "Generating the enhanced prompt and supporting artifacts.",
  },
];

function renderPanel(workflow: EnhanceWorkflowStep[], isEnhancing = false) {
  return render(
    <OutputPanel
      builtPrompt="Draft prompt"
      enhancedPrompt="Enhanced prompt"
      enhanceWorkflow={workflow}
      isEnhancing={isEnhancing}
      onEnhance={() => undefined}
      onSaveVersion={() => undefined}
      onSavePrompt={async () => true}
      onSaveAndSharePrompt={async () => true}
      canSavePrompt
      canSharePrompt
      enhancePhase={isEnhancing ? "streaming" : "done"}
    />,
  );
}

describe("OutputPanel workflow", () => {
  it("renders ordered workflow steps above the prompt", () => {
    renderPanel(BASE_WORKFLOW, true);

    expect(screen.getByTestId("output-panel-workflow")).toBeInTheDocument();
    expect(screen.getByText("Workflow")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-step-analyze_request")).toHaveTextContent(
      "Analyze request",
    );
    expect(screen.getByTestId("workflow-step-generate_prompt")).toHaveTextContent(
      "Generate enhanced prompt",
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("does not render when no workflow steps are present", () => {
    renderPanel([]);

    expect(screen.queryByTestId("output-panel-workflow")).not.toBeInTheDocument();
  });
});
