import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  loadFeed: vi.fn(),
  loadPersonalFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
  loadFollowingUserIds: vi.fn(),
  loadBlockedUserIds: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
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
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
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
    toggleVote: vi.fn().mockResolvedValue({ active: true }),
    setPromptRating: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("@/lib/community-moderation", () => ({
  blockCommunityUser: vi.fn().mockResolvedValue(undefined),
  loadBlockedUserIds: (...args: unknown[]) => mocks.loadBlockedUserIds(...args),
  submitCommunityReport: vi.fn().mockResolvedValue(undefined),
  unblockCommunityUser: vi.fn().mockResolvedValue(undefined),
}));

async function renderFollowingCommunity() {
  const { default: Community } = await import("@/pages/Community");
  render(
    <MemoryRouter initialEntries={["/community?tab=following"]}>
      <Community />
    </MemoryRouter>,
  );
}

describe("Community following tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFeed.mockResolvedValue([]);
    mocks.loadPersonalFeed.mockResolvedValue([]);
    mocks.loadProfilesByIds.mockResolvedValue([]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadFollowingUserIds.mockResolvedValue([]);
    mocks.loadBlockedUserIds.mockResolvedValue([]);
  });

  it("uses personal-feed loading and disables no-op controls", async () => {
    await renderFollowingCommunity();

    await waitFor(() => {
      expect(mocks.loadPersonalFeed).toHaveBeenCalledWith({ limit: 20, page: 0 });
    });

    expect(mocks.loadFeed).not.toHaveBeenCalled();

    const searchInput = screen.getByRole("textbox", { name: "Search community posts" });
    expect(searchInput).toHaveAttribute("placeholder", "Search is available in the For You tab");
    const sortButtons = screen.getAllByTestId("community-sort-button");
    expect(sortButtons.length).toBeGreaterThan(0);
    sortButtons.forEach((button) => expect(button).toBeDisabled());

    expect(
      screen.getByText("Search, sort, and category filters apply to the For You tab."),
    ).toBeInTheDocument();
  });
});
