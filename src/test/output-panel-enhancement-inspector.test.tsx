import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnhancementInspector } from "@/components/EnhancementInspector";
import type { EnhanceMetadata } from "@/lib/enhance-metadata";

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: vi.fn(),
}));

const FULL_METADATA: EnhanceMetadata = {
  enhancedPrompt: "Enhanced prompt",
  assumptionsMade: ["Budget approval is already secured"],
  openQuestions: ["What budget ceiling should this respect?"],
  partsBreakdown: {
    role: "Senior product strategist",
    context: "B2B SaaS launch planning",
    task: "Build a launch-readiness checklist",
    output_format: "Markdown checklist | Length: detailed",
    examples: "Example launch checklist section",
    guardrails: "Stay practical and cite assumptions.",
  },
  enhancementPlan: {
    primary_intent: "planning",
    source_task_type: "launch checklist",
    target_deliverable: "Go-to-market readiness checklist",
    audience: "Product and marketing leads",
    required_inputs: ["Launch date", "Campaign goals"],
    constraints: ["Keep it under 30 items"],
    success_criteria: ["Easy to hand off", "Covers dependencies"],
    assumptions: ["Product launch scope is finalized"],
    open_questions: ["Which team owns approvals?"],
    verification_needs: ["Confirm launch date with PMM"],
  },
};

function getSection(label: string): HTMLElement {
  const section = screen.getByText(label).closest("div.rounded-lg");
  if (!section) {
    throw new Error(`Could not find section for ${label}`);
  }
  return section as HTMLElement;
}

describe("EnhancementInspector", () => {
  it("renders the full structured payload", () => {
    render(<EnhancementInspector metadata={FULL_METADATA} />);

    expect(screen.getByText("Apply to builder")).toBeInTheDocument();
    expect(screen.getByText("Review assumptions & questions")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Examples")).toBeInTheDocument();
    expect(screen.getByText("Plan details")).toBeInTheDocument();
    expect(screen.getByText("Primary intent")).toBeInTheDocument();
    expect(screen.getByText("Source task type")).toBeInTheDocument();
    expect(screen.getByText("Launch date")).toBeInTheDocument();
    expect(screen.getByText("Budget approval is already secured")).toBeInTheDocument();
    expect(screen.getByText("What budget ceiling should this respect?")).toBeInTheDocument();
    expect(screen.getByText("Product launch scope is finalized")).toBeInTheDocument();
    expect(screen.getByText("Which team owns approvals?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
  });

  it("applies all deterministic builder fields", () => {
    const onApplyToBuilder = vi.fn();
    render(
      <EnhancementInspector
        metadata={FULL_METADATA}
        onApplyToBuilder={onApplyToBuilder}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Apply all structured parts" }),
    );

    expect(onApplyToBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "Senior product strategist",
        context: "B2B SaaS launch planning",
        task: "Build a launch-readiness checklist",
        format: "Markdown checklist | Length: detailed",
        examples: "Example launch checklist section",
        constraints: expect.stringContaining("Stay practical and cite assumptions."),
        openSections: ["builder", "context"],
        action: "apply_all",
        sourceField: "all",
      }),
    );
    expect(onApplyToBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        constraints: expect.stringContaining("Keep it under 30 items"),
      }),
    );
  });

  it("supports copy and apply-to-session-context actions for plan lists", () => {
    const onApplyToSessionContext = vi.fn();
    const onCopyText = vi.fn();
    render(
      <EnhancementInspector
        metadata={FULL_METADATA}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />,
    );

    const requiredInputsSection = getSection("Required inputs");
    fireEvent.click(
      within(requiredInputsSection).getByRole("button", {
        name: "Add to session context",
      }),
    );
    fireEvent.click(
      within(requiredInputsSection).getByRole("button", { name: "Copy" }),
    );

    expect(onApplyToSessionContext).toHaveBeenCalledWith(
      "Required inputs",
      expect.stringContaining("1. Launch date"),
    );
    expect(onCopyText).toHaveBeenCalledWith(
      "Required inputs",
      expect.stringContaining("2. Campaign goals"),
    );
  });

  it("saves edited open questions and reuses the edited text for follow-up actions", () => {
    const onEditableListSaved = vi.fn();
    const onApplyEditableListToPrompt = vi.fn();
    const onApplyToSessionContext = vi.fn();
    const onCopyText = vi.fn();

    render(
      <EnhancementInspector
        metadata={FULL_METADATA}
        onEditableListSaved={onEditableListSaved}
        onApplyEditableListToPrompt={onApplyEditableListToPrompt}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />,
    );

    const planQuestionsSection = getSection("Plan open questions");
    fireEvent.click(
      within(planQuestionsSection).getByRole("button", { name: "Edit" }),
    );
    fireEvent.change(screen.getByLabelText("Plan open questions 1"), {
      target: { value: "Which team owns final approvals and deadlines?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEditableListSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "plan_open_questions",
        index: 0,
        before: "Which team owns approvals?",
        after: "Which team owns final approvals and deadlines?",
        source: "structured_inspector",
      }),
    );

    fireEvent.click(
      within(getSection("Plan open questions")).getByRole("button", {
        name: "Copy",
      }),
    );
    fireEvent.click(
      within(getSection("Plan open questions")).getByRole("button", {
        name: "Add to session context",
      }),
    );
    fireEvent.click(
      within(getSection("Plan open questions")).getByRole("button", {
        name: "Apply to prompt",
      }),
    );

    expect(onCopyText).toHaveBeenCalledWith(
      "Plan open questions",
      expect.stringContaining("1. Which team owns final approvals and deadlines?"),
    );
    expect(onApplyToSessionContext).toHaveBeenCalledWith(
      "Plan open questions",
      expect.stringContaining("1. Which team owns final approvals and deadlines?"),
    );
    expect(onApplyEditableListToPrompt).toHaveBeenCalledWith(
      "plan_open_questions",
      ["Which team owns final approvals and deadlines?"],
    );
  });

  it("does not emit an edit callback for unchanged edits", () => {
    const onEditableListSaved = vi.fn();
    render(
      <EnhancementInspector
        metadata={FULL_METADATA}
        onEditableListSaved={onEditableListSaved}
      />,
    );

    const assumptionsSection = getSection("Assumptions made");
    fireEvent.click(
      within(assumptionsSection).getByRole("button", { name: "Edit" }),
    );
    fireEvent.change(screen.getByLabelText("Assumptions made 1"), {
      target: { value: "Budget approval is already secured" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEditableListSaved).not.toHaveBeenCalled();
  });

  it("renders nothing when no structured metadata exists", () => {
    const { container } = render(
      <EnhancementInspector metadata={{ enhancedPrompt: "Prompt" }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
