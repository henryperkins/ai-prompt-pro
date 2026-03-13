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

function renderPanel(
  workflow: EnhanceWorkflowStep[],
  options: Partial<Parameters<typeof OutputPanel>[0]> = {},
) {
  const isEnhancing = options.isEnhancing ?? false;

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
      enhancePhase={options.enhancePhase ?? (isEnhancing ? "streaming" : "done")}
      {...options}
    />,
  );
}

describe("OutputPanel workflow", () => {
  it("renders ordered workflow steps above the prompt", () => {
    renderPanel(BASE_WORKFLOW, { isEnhancing: true });

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

  it("auto-opens run progress when the panel enters a transient phase", () => {
    const { rerender } = renderPanel(BASE_WORKFLOW, {
      isEnhancing: false,
      enhancePhase: "idle",
    });

    expect(screen.queryByTestId("workflow-step-analyze_request")).not.toBeInTheDocument();

    rerender(
      <OutputPanel
        builtPrompt="Draft prompt"
        enhancedPrompt="Enhanced prompt"
        enhanceWorkflow={BASE_WORKFLOW}
        isEnhancing
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={async () => true}
        onSaveAndSharePrompt={async () => true}
        canSavePrompt
        canSharePrompt
        enhancePhase="streaming"
      />,
    );

    expect(screen.getByTestId("workflow-step-analyze_request")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
