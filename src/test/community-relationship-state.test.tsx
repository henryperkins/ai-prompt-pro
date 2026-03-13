import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  user: { id: "viewer-1" } as { id: string } | null,
  toast: vi.fn(),
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
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
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
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
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

function createPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Relationship state post",
    enhancedPrompt: "Review state transitions without stale personalization.",
    description: "",
    useCase: "Session switch review",
    category: "general",
    tags: ["state"],
    targetModel: "gpt-5-mini",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Audit this state change.",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 1,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
    ratingCount: 0,
    ratingAverage: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createProfile(overrides: Partial<CommunityProfile> = {}): CommunityProfile {
  return {
    id: "author-1",
    displayName: "Prompt Dev",
    avatarUrl: null,
    ...overrides,
  };
}

async function renderCommunity(initialEntries = ["/community"]) {
  vi.resetModules();
  const { default: Community } = await import("@/pages/Community");

  let view: ReturnType<typeof render> | null = null;
  await act(async () => {
    view = render(
      <MemoryRouter initialEntries={initialEntries}>
        <Community />
      </MemoryRouter>,
    );
  });

  if (!view) {
    throw new Error("Community view did not render.");
  }

  return { Community, ...view };
}

describe("Community relationship state resets", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.loadFeed.mockReset();
    mocks.loadPersonalFeed.mockReset();
    mocks.loadProfilesByIds.mockReset();
    mocks.loadPostsByIds.mockReset();
    mocks.loadMyVotes.mockReset();
    mocks.loadMyRatings.mockReset();
    mocks.loadBlockedUserIds.mockReset();
    mocks.loadFollowingUserIds.mockReset();
    mocks.user = { id: "viewer-1" };

    const post = createPost();
    mocks.loadFeed.mockResolvedValue([post]);
    mocks.loadPersonalFeed.mockResolvedValue([]);
    mocks.loadProfilesByIds.mockResolvedValue([createProfile({ id: post.authorId })]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
  });

  it("clears stale following state when the authenticated user changes", async () => {
    mocks.loadBlockedUserIds.mockResolvedValueOnce([]);
    mocks.loadBlockedUserIds.mockResolvedValueOnce([]);
    mocks.loadFollowingUserIds.mockResolvedValueOnce(["author-1"]);
    mocks.loadFollowingUserIds.mockRejectedValueOnce(new Error("follow lookup failed"));

    const { Community, rerender } = await renderCommunity();

    await screen.findByText("Relationship state post");
    await waitFor(() => {
      expect(screen.getByTestId("community-card-follow")).toHaveTextContent("Following");
    });

    mocks.user = { id: "viewer-2" };
    rerender(
      <MemoryRouter initialEntries={["/community"]}>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("community-card-follow")).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByTestId("community-card-follow")).toHaveTextContent("Follow");
    });

    expect(mocks.loadFollowingUserIds).toHaveBeenCalledTimes(2);
  });

  it("drops stale blocked-user state when the next user relationship load fails", async () => {
    mocks.loadBlockedUserIds.mockResolvedValueOnce(["author-1"]);
    mocks.loadBlockedUserIds.mockRejectedValueOnce(new Error("blocked lookup failed"));
    mocks.loadFollowingUserIds.mockResolvedValueOnce([]);
    mocks.loadFollowingUserIds.mockResolvedValueOnce([]);

    const { Community, rerender } = await renderCommunity();

    await waitFor(() => {
      expect(screen.getByTestId("community-blocked-results-state")).toBeInTheDocument();
    });

    mocks.user = { id: "viewer-2" };
    rerender(
      <MemoryRouter initialEntries={["/community"]}>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("community-blocked-results-state")).toBeNull();
      expect(screen.getByText("Relationship state post")).toBeInTheDocument();
    });
  });
});
