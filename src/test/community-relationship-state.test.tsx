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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
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

  it("keeps blocked posts hidden while blocked-user data reloads and after that reload fails", async () => {
    const blockedReload = createDeferred<string[]>();

    mocks.loadBlockedUserIds.mockResolvedValueOnce(["author-1"]);
    mocks.loadBlockedUserIds.mockImplementationOnce(() => blockedReload.promise);
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
      expect(screen.getByTestId("community-blocked-results-state")).toBeInTheDocument();
      expect(screen.queryByText("Relationship state post")).not.toBeInTheDocument();
    });

    await act(async () => {
      blockedReload.reject(new Error("blocked lookup failed"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("community-blocked-results-state")).toBeInTheDocument();
      expect(screen.queryByText("Relationship state post")).not.toBeInTheDocument();
    });

    expect(mocks.loadBlockedUserIds).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("renders follow controls from ready follow data even while blocked-user loading is still pending", async () => {
    const blockedReload = createDeferred<string[]>();

    mocks.loadBlockedUserIds.mockResolvedValueOnce([]);
    mocks.loadBlockedUserIds.mockImplementationOnce(() => blockedReload.promise);
    mocks.loadFollowingUserIds.mockResolvedValueOnce(["author-1"]);
    mocks.loadFollowingUserIds.mockResolvedValueOnce([]);

    const { Community, rerender } = await renderCommunity();

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
      expect(screen.getByText("Relationship state post")).toBeInTheDocument();
      expect(screen.getByTestId("community-card-follow")).toHaveTextContent("Follow");
    });

    expect(screen.queryByTestId("community-block-filter-loading-state")).toBeNull();

    await act(async () => {
      blockedReload.resolve([]);
      await Promise.resolve();
    });
  });

  it("hides stale follow controls until the next viewer's follow state resolves", async () => {
    const followingReload = createDeferred<string[]>();

    mocks.loadBlockedUserIds.mockResolvedValueOnce([]);
    mocks.loadBlockedUserIds.mockResolvedValueOnce([]);
    mocks.loadFollowingUserIds.mockResolvedValueOnce(["author-1"]);
    mocks.loadFollowingUserIds.mockImplementationOnce(() => followingReload.promise);

    const { Community, rerender } = await renderCommunity();

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
      expect(screen.getByText("Relationship state post")).toBeInTheDocument();
      expect(screen.queryByTestId("community-card-follow")).toBeNull();
    });

    await act(async () => {
      followingReload.resolve([]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("community-card-follow")).toHaveTextContent("Follow");
    });
  });
});
