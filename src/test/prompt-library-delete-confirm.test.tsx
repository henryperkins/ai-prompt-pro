import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptLibraryContent } from "@/components/PromptLibrary";
import type { PromptSummary } from "@/lib/persistence";

const savedPrompt: PromptSummary = {
  id: "prompt-1",
  name: "Incident triage",
  description: "Triage and summarize incident data.",
  tags: ["ops"],
  starterPrompt: "Summarize this outage timeline.",
  updatedAt: 1_735_000_000_000,
  createdAt: 1_735_000_000_000,
  revision: 1,
  schemaVersion: 2,
  sourceCount: 0,
  databaseCount: 0,
  ragEnabled: false,
  category: "general",
  isShared: false,
  communityPostId: null,
  targetModel: "",
  useCase: "",
  remixedFrom: null,
  builtPrompt: "",
  enhancedPrompt: "",
  upvoteCount: 0,
  verifiedCount: 0,
  remixCount: 0,
  commentCount: 0,
};

describe("PromptLibrary delete confirmation", () => {
  it("requires explicit confirmation before deleting a saved prompt", () => {
    const onDeleteSaved = vi.fn();

    render(
      <PromptLibraryContent
        savedPrompts={[savedPrompt]}
        canShareSavedPrompts
        onSelectTemplate={vi.fn()}
        onSelectSaved={vi.fn()}
        onDeleteSaved={onDeleteSaved}
        onShareSaved={vi.fn()}
        onUnshareSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Incident triage" }));
    expect(onDeleteSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Delete saved prompt?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteSaved).toHaveBeenCalledWith("prompt-1");
  });

  it("uses base font size for share dialog form controls to prevent mobile focus zoom", async () => {
    render(
      <PromptLibraryContent
        savedPrompts={[savedPrompt]}
        canShareSavedPrompts
        onSelectTemplate={vi.fn()}
        onSelectSaved={vi.fn()}
        onDeleteSaved={vi.fn()}
        onShareSaved={vi.fn()}
        onUnshareSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByPlaceholderText("Prompt title")).toHaveClass("text-base");
    expect(screen.getByPlaceholderText("Description (optional)")).toHaveClass("text-base");
    expect(screen.getByPlaceholderText("Tags (comma-separated, optional)")).toHaveClass("text-base");
    expect(screen.getByPlaceholderText("Use case (required)")).toHaveClass("text-base");
    expect(screen.getByPlaceholderText("Target model (optional)")).toHaveClass("text-base");
    expect(screen.getByRole("combobox")).toHaveClass("text-base");
  });
});
