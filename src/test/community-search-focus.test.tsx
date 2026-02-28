import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  loadFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  toggleVote: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useCommunityMobileTelemetry", () => ({
  useCommunityMobileTelemetry: () => ({
    trackFirstMeaningfulAction: vi.fn(),
    trackInteraction: vi.fn(),
  }),
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
    loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
    toggleVote: (...args: unknown[]) => mocks.toggleVote(...args),
  };
});

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

async function renderCommunity() {
  const { default: Community } = await import("@/pages/Community");
  render(
    <MemoryRouter>
      <Community />
    </MemoryRouter>,
  );
}

describe("Community search focus visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFeed.mockResolvedValue([]);
    mocks.loadProfilesByIds.mockResolvedValue([]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("keeps visible focus styles and keyboard focusability on the search control", async () => {
    await renderCommunity();

    const input = await screen.findByRole("textbox", { name: "Search community posts" });
    const searchShell = screen.getByTestId("community-search-shell");

    expect(searchShell.className).toContain("focus-within:ring-2");
    expect(searchShell.className).toContain("focus-within:ring-ring");
    expect(searchShell.className).toContain("focus-within:ring-offset-2");
    expect(input.className).not.toContain("focus-visible:ring-0");

    input.focus();
    expect(input).toHaveFocus();

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalled();
    });
  }, 15_000);

  it("preserves the focus shell styling in dark mode", async () => {
    document.documentElement.classList.add("dark");
    await renderCommunity();

    const input = await screen.findByRole("textbox", { name: "Search community posts" });
    const searchShell = screen.getByTestId("community-search-shell");

    input.focus();
    expect(input).toHaveFocus();
    expect(searchShell.className).toContain("focus-within:ring-ring");
    expect(searchShell.className).toContain("focus-within:ring-offset-2");
  });
});
