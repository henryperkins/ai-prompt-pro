import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { BuilderSourcesAdvanced } from "@/components/BuilderSourcesAdvanced";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import { OutputPanel } from "@/components/OutputPanel";
import { toConstraintInputId } from "@/lib/builder-tabs";
import { defaultContextConfig } from "@/lib/context-types";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  validateSaveDialogInput,
  validateSaveAndSharePromptInput,
  validateSavePromptInput,
} from "@/lib/output-panel-validation";

describe("Phase 2 accessibility and validation", () => {
  it("surfaces next-best-action text in context quality meter", () => {
    render(<ContextQualityMeter contextConfig={defaultContextConfig} />);

    expect(screen.getByText(/Next best action:/)).toBeInTheDocument();
  });

  it("uses sanitized checkbox ids for constraint options", () => {
    const id = toConstraintInputId("Think step-by-step");
    expect(id).toBe("builder-constraint-think-step-by-step");
    expect(id).not.toContain(" ");
  });

  it("uses nested disclosure semantics for deep adjust-detail fields", () => {
    render(
      <BuilderAdjustDetails
        config={defaultConfig}
        isOpen
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Prompt details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Prompt details" })).toHaveAttribute("aria-controls", "builder-zone-2-content");
    expect(screen.getByRole("button", { name: "Role and voice" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Output shape" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Constraints" })).toHaveAttribute("aria-expanded", "false");

    expect(screen.getByLabelText("Custom role")).toBeInTheDocument();
    expect(screen.queryByLabelText("Custom format")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom constraint")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Output shape" }));
    fireEvent.click(screen.getByRole("button", { name: "Constraints" }));

    expect(screen.getByRole("button", { name: "Output shape" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Constraints" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Custom format")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom constraint")).toBeInTheDocument();
  });

  it("exposes pressed-state semantics for tone and format toggles", () => {
    render(
      <BuilderAdjustDetails
        config={{
          ...defaultConfig,
          tone: "Casual",
          format: ["Table"],
        }}
        isOpen
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Output shape" }));

    expect(screen.getByRole("button", { name: "Casual" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Professional" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps collapsed details summaries descriptive for hidden state", () => {
    render(
      <BuilderAdjustDetails
        config={{
          ...defaultConfig,
          role: "Software Developer",
          tone: "Casual",
          format: ["Table"],
          constraints: ["Avoid jargon"],
          examples: "Input -> Output",
        }}
        isOpen={false}
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
        fieldOwnership={{
          role: "ai",
          tone: "user",
          lengthPreference: "empty",
          format: "user",
          constraints: "user",
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Prompt details" });
    const summary = screen.getByText(/Casual tone/);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "builder-zone-2-content");
    expect(summary).toHaveTextContent("Casual tone");
    expect(summary).toHaveTextContent("1 format");
    expect(summary).toHaveTextContent("1 constraint");
    expect(summary).toHaveTextContent("has examples");
    expect(summary).toHaveTextContent("(AI-suggested)");
  });

  it("keeps context authoring separate from enhancement settings", () => {
    render(
      <BuilderSourcesAdvanced
        contextConfig={defaultContextConfig}
        isOpen
        onOpenChange={() => undefined}
        onUpdateSources={() => undefined}
        onUpdateDatabaseConnections={() => undefined}
        onUpdateRag={() => undefined}
        onUpdateProjectNotes={() => undefined}
        onToggleDelimiters={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Context and sources" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "These controls add context to the current draft. Enhancement settings such as web lookup and rewrite behavior live in the preview rail.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", {
        name: "Enable web search during enhancement",
      }),
    ).not.toBeInTheDocument();
  });

  it("truncates long selected roles in the collapsed header and removes the duplicate open-state summary", () => {
    const longRole =
      "Senior UX auditor and design systems strategist for AI-assisted product experiences";
    const { rerender } = render(
      <BuilderAdjustDetails
        config={{
          ...defaultConfig,
          customRole: longRole,
        }}
        isOpen={false}
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    const collapsedRole = screen.getByTestId(
      "builder-adjust-details-selected-role",
    );
    expect(collapsedRole).toHaveTextContent(longRole);
    expect(collapsedRole).toHaveAttribute("title", longRole);
    expect(collapsedRole.className).toContain("truncate");

    rerender(
      <BuilderAdjustDetails
        config={{
          ...defaultConfig,
          customRole: longRole,
        }}
        isOpen
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(
      screen.queryByTestId("builder-adjust-details-selected-role"),
    ).not.toBeInTheDocument();
  });

  it("announces enhance phase transitions via live region", () => {
    const { rerender } = render(
      <OutputPanel
        builtPrompt="Build a launch plan"
        enhancedPrompt=""
        isEnhancing
        enhancePhase="starting"
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={async () => true}
        onSaveAndSharePrompt={async () => true}
        canSavePrompt
        canSharePrompt
      />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(
      "Enhancing. The AI is actively rewriting the prompt. The visible prompt may still change.",
    );

    rerender(
      <OutputPanel
        builtPrompt="Build a launch plan"
        enhancedPrompt="Improved launch plan"
        isEnhancing={false}
        enhancePhase="done"
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={async () => true}
        onSaveAndSharePrompt={async () => true}
        canSavePrompt
        canSharePrompt
      />,
    );

    expect(liveRegion).toHaveTextContent(
      "Enhanced prompt ready. The run is complete and the visible text is the settled AI-generated prompt.",
    );
  });

  it("validates required fields for save prompt input", () => {
    expect(validateSavePromptInput("")).toEqual({ name: "Prompt title is required." });
    expect(validateSavePromptInput("  ")).toEqual({ name: "Prompt title is required." });
    expect(validateSavePromptInput("Launch checklist")).toEqual({});
  });

  it("validates required fields for save-and-share input", () => {
    expect(
      validateSaveAndSharePromptInput({
        name: "",
        useCase: "",
        confirmedSafe: false,
      }),
    ).toEqual({
      name: "Prompt title is required.",
      useCase: "Use case is required.",
      confirmedSafe: "Confirm that the prompt contains no private or secret data.",
    });
    expect(
      validateSaveAndSharePromptInput({
        name: "Launch checklist",
        useCase: "Develop an onboarding playbook",
        confirmedSafe: true,
      }),
    ).toEqual({});
  });

  it("applies conditional validation for unified save dialog", () => {
    expect(
      validateSaveDialogInput({
        name: "",
        shareEnabled: false,
      }),
    ).toEqual({
      name: "Prompt title is required.",
    });

    expect(
      validateSaveDialogInput({
        name: "Launch checklist",
        shareEnabled: true,
        useCase: "",
        confirmedSafe: false,
      }),
    ).toEqual({
      useCase: "Use case is required.",
      confirmedSafe: "Confirm that the prompt contains no private or secret data.",
    });
  });
});
