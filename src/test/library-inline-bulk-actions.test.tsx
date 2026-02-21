import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import type { PromptSummary } from "@/lib/persistence";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
  user: { id: "user-1", email: "dev@example.com", user_metadata: {} },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildPrompt(overrides: Partial<PromptSummary> = {}): PromptSummary {
  return {
    id: "prompt-1",
    name: "Incident triage",
    description: "",
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
    ...overrides,
  };
}

describe("Library inline bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("uses batch actions for set private and delete", async () => {
    const deleteSavedTemplate = vi.fn();
    const unshareSavedPrompt = vi.fn();
    const deleteSavedTemplates = vi.fn().mockResolvedValue(["prompt-1", "prompt-2"]);
    const unshareSavedPrompts = vi.fn().mockResolvedValue(["prompt-1", "prompt-2"]);
    mocks.usePromptBuilder.mockReturnValue({
      templateSummaries: [
        buildPrompt({ id: "prompt-1", name: "Incident triage", isShared: true }),
        buildPrompt({ id: "prompt-2", name: "Release checklist", isShared: true }),
      ],
      isSignedIn: true,
      deleteSavedTemplate,
      deleteSavedTemplates,
      shareSavedPrompt: vi.fn(),
      unshareSavedPrompt,
      unshareSavedPrompts,
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { default: Library } = await import("@/pages/Library");
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.queryByRole("button", { name: "Open Bulk Edit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select Incident triage"));
    fireEvent.click(screen.getByLabelText("Select Release checklist"));

    fireEvent.click(screen.getByRole("button", { name: "Set private" }));
    await waitFor(() => {
      expect(unshareSavedPrompts).toHaveBeenCalledWith(["prompt-1", "prompt-2"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    await waitFor(() => {
      expect(deleteSavedTemplates).toHaveBeenCalledWith(["prompt-1", "prompt-2"]);
    });
    expect(unshareSavedPrompt).not.toHaveBeenCalled();
    expect(deleteSavedTemplate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("supports selected-only focus mode", async () => {
    mocks.usePromptBuilder.mockReturnValue({
      templateSummaries: [
        buildPrompt({ id: "prompt-1", name: "Incident triage" }),
        buildPrompt({ id: "prompt-2", name: "Release checklist" }),
      ],
      isSignedIn: true,
      deleteSavedTemplate: vi.fn(),
      deleteSavedTemplates: vi.fn().mockResolvedValue([]),
      shareSavedPrompt: vi.fn(),
      unshareSavedPrompt: vi.fn(),
      unshareSavedPrompts: vi.fn().mockResolvedValue([]),
    });

    const { default: Library } = await import("@/pages/Library");
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByLabelText("Select Incident triage"));
    fireEvent.click(screen.getByRole("button", { name: "Selected only" }));

    expect(screen.getByText("Incident triage")).toBeInTheDocument();
    expect(screen.queryByText("Release checklist")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByText("Release checklist")).toBeInTheDocument();
  });

  it("keeps compatibility by redirecting bulk-edit route to library", async () => {
    const { default: LibraryBulkEdit } = await import("@/pages/LibraryBulkEdit");
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/library/bulk-edit?id=prompt-1&id=prompt-2"]}>
          <Routes>
            <Route path="/library/bulk-edit" element={<LibraryBulkEdit />} />
            <Route path="/library" element={<div>Library destination</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Library destination")).toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem("library-selection-ids")).toBe("[\"prompt-1\",\"prompt-2\"]");
  });
});
