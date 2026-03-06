import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadFeed: vi.fn(),
  loadPersonalFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
  loadBlockedUserIds: vi.fn(),
  loadFollowingUserIds: vi.fn(),
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

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}));

vi.mock("@/components/community/CommunityFeed", () => ({
  CommunityFeed: () => <div data-testid="community-feed" />,
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
    loadPersonalFeed: (...args: unknown[]) => mocks.loadPersonalFeed(...args),
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
    loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
    loadMyRatings: (...args: unknown[]) => mocks.loadMyRatings(...args),
    loadFollowingUserIds: (...args: unknown[]) => mocks.loadFollowingUserIds(...args),
    followCommunityUser: vi.fn().mockResolvedValue(true),
    unfollowCommunityUser: vi.fn().mockResolvedValue(true),
    remixToLibrary: vi.fn().mockResolvedValue({ id: "saved-remix" }),
    setPromptRating: vi.fn().mockResolvedValue({}),
    toggleVote: vi.fn().mockResolvedValue({ active: true }),
  };
});

vi.mock("@/lib/community-moderation", () => ({
  blockCommunityUser: vi.fn().mockResolvedValue(undefined),
  loadBlockedUserIds: (...args: unknown[]) => mocks.loadBlockedUserIds(...args),
  submitCommunityReport: vi.fn().mockResolvedValue(undefined),
  unblockCommunityUser: vi.fn().mockResolvedValue(undefined),
}));

describe("Community auth discovery state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFeed.mockRejectedValue(new Error("Sign in required."));
    mocks.loadPersonalFeed.mockResolvedValue([]);
    mocks.loadProfilesByIds.mockResolvedValue([]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadBlockedUserIds.mockResolvedValue([]);
    mocks.loadFollowingUserIds.mockResolvedValue([]);
  });

  it("replaces dead-end feed controls with an auth-aware discovery state when anonymous feed loading is blocked", async () => {
    const { default: Community } = await import("@/pages/Community");

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/community"]}>
          <Community />
        </MemoryRouter>,
      );
    });

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "all",
          limit: 20,
          page: 0,
          sort: "new",
        }),
      );
    });

    expect(await screen.findByTestId("community-auth-discovery")).toBeInTheDocument();
    expect(screen.getByText("Sign in to unlock the remix feed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse Presets" })).toBeInTheDocument();
    expect(screen.queryByTestId("community-search-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("community-feed")).not.toBeInTheDocument();
  });
});
