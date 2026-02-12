import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuilderAdjustDetails } from "@/components/BuilderAdjustDetails";
import { OutputPanel } from "@/components/OutputPanel";
import { PromptInput } from "@/components/PromptInput";
import { toConstraintInputId } from "@/lib/builder-tabs";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  validateSaveDialogInput,
  validateSaveAndSharePromptInput,
  validateSavePromptInput,
} from "@/lib/output-panel-validation";

describe("Phase 2 accessibility and validation", () => {
  it("associates PromptInput label with textarea", () => {
    render(<PromptInput value="Draft prompt" onChange={() => undefined} onClear={() => undefined} />);

    const textarea = screen.getByLabelText("Your Prompt");
    expect(textarea).toHaveAttribute("id", "builder-original-prompt");
    expect(textarea).toHaveAttribute("aria-describedby", "builder-original-prompt-meta");
  });

  it("uses sanitized checkbox ids for constraint options", () => {
    const id = toConstraintInputId("Think step-by-step");
    expect(id).toBe("builder-constraint-think-step-by-step");
    expect(id).not.toContain(" ");
  });

  it("provides accessible names for custom detail inputs", () => {
    render(
      <BuilderAdjustDetails
        config={defaultConfig}
        isOpen
        onOpenChange={() => undefined}
        onUpdate={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Custom role")).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Casual" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Professional" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute("aria-pressed", "false");
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
        onSavePrompt={() => undefined}
        onSaveAndSharePrompt={() => undefined}
        canSavePrompt
        canSharePrompt
      />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("Enhancement started.");

    rerender(
      <OutputPanel
        builtPrompt="Build a launch plan"
        enhancedPrompt="Improved launch plan"
        isEnhancing={false}
        enhancePhase="done"
        onEnhance={() => undefined}
        onSaveVersion={() => undefined}
        onSavePrompt={() => undefined}
        onSaveAndSharePrompt={() => undefined}
        canSavePrompt
        canSharePrompt
      />,
    );

    expect(liveRegion).toHaveTextContent("Enhancement complete.");
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
