import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

vi.mock("@/components/fantasy/PFTemplateCard", () => ({
  PFTemplateCard: ({ title }: { title: string }) => <div>{title}</div>,
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

describe("Library featured layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("uses a compact single-column featured layout when only one prompt is available", async () => {
    mocks.usePromptBuilder.mockReturnValue({
      templateSummaries: [buildPrompt()],
      isSignedIn: true,
      deleteSavedTemplate: vi.fn(),
      deleteSavedTemplates: vi.fn().mockResolvedValue([]),
      shareSavedPrompt: vi.fn(),
      unshareSavedPrompt: vi.fn(),
      unshareSavedPrompts: vi.fn().mockResolvedValue([]),
    });

    const { default: Library } = await import("@/pages/Library");
    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    const grid = screen.getByTestId("library-featured-grid");
    const items = screen.getAllByTestId("library-featured-item");

    expect(grid.className).toContain("md:grid-cols-1");
    expect(items).toHaveLength(1);
    expect(items[0]?.className).toContain("max-w-xl");
  });
});
