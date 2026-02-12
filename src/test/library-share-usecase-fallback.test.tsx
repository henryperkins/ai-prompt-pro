import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

describe("Library share use case fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes starter prompt as share use case when saved use case is empty", async () => {
    const shareSavedPrompt = vi.fn().mockResolvedValue({ shared: true, postId: "post-1" });
    const prompt = buildPrompt({ useCase: "", starterPrompt: "Draft the incident timeline summary." });
    mocks.usePromptBuilder.mockReturnValue({
      templateSummaries: [prompt],
      isSignedIn: true,
      deleteSavedTemplate: vi.fn(),
      shareSavedPrompt,
      unshareSavedPrompt: vi.fn(),
    });

    const { default: Library } = await import("@/pages/Library");
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareSavedPrompt).toHaveBeenCalledWith(prompt.id, {
        useCase: "Draft the incident timeline summary.",
      });
    });
  });
});
