import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";
import Profile from "@/pages/Profile";

const mocks = vi.hoisted(() => ({
  user: { id: "viewer-1" },
  toast: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadFollowStats: vi.fn(),
  loadProfileActivityStats: vi.fn(),
  loadPostsByAuthor: vi.fn(),
  isFollowingCommunityUser: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
  loadBlockedUserIds: vi.fn(),
  blockCommunityUser: vi.fn(),
  unblockCommunityUser: vi.fn(),
  submitCommunityReport: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

vi.mock("@/components/community/CommunityFeed", () => ({
  CommunityFeed: ({
    posts,
    featuredPostId,
    selectedPostId,
    featuredPostBadgeLabel,
    currentUserId,
    blockFilterReady,
    blockedUserIds,
    rawPostCount,
    hiddenPostCount,
    onReportPost,
    onReportComment,
    onBlockUser,
    onUnblockUser,
  }: {
    posts: CommunityPost[];
    featuredPostId?: string | null;
    selectedPostId?: string | null;
    featuredPostBadgeLabel?: string;
    currentUserId?: string | null;
    blockFilterReady?: boolean;
    blockedUserIds?: string[];
    rawPostCount?: number;
    hiddenPostCount?: number;
    onReportPost?: (post: CommunityPost) => void;
    onReportComment?: (commentId: string, userId: string, postId: string) => void;
    onBlockUser?: (userId: string) => void;
    onUnblockUser?: (userId: string) => void;
  }) => (
    <div>
      <div data-testid="community-feed-count">{posts.length}</div>
      <div data-testid="community-feed-featured-id">{featuredPostId ?? "none"}</div>
      <div data-testid="community-feed-selected-id">{selectedPostId ?? "none"}</div>
      <div data-testid="community-feed-featured-label">{featuredPostBadgeLabel ?? "none"}</div>
      <div data-testid="community-feed-first-title">{posts[0]?.title ?? "none"}</div>
      <div data-testid="community-feed-current-user">{currentUserId ?? "none"}</div>
      <div data-testid="community-feed-block-ready">{String(blockFilterReady ?? true)}</div>
      <div data-testid="community-feed-blocked-ids">{blockedUserIds?.join(",") || "none"}</div>
      <div data-testid="community-feed-raw-count">{String(rawPostCount ?? posts.length)}</div>
      <div data-testid="community-feed-hidden-count">{String(hiddenPostCount ?? 0)}</div>
      <div data-testid="community-feed-report-enabled">{String(Boolean(onReportPost && onReportComment))}</div>
      <div data-testid="community-feed-block-enabled">{String(Boolean(onBlockUser && onUnblockUser))}</div>
    </div>
  ),
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadFollowStats: (...args: unknown[]) => mocks.loadFollowStats(...args),
    loadProfileActivityStats: (...args: unknown[]) => mocks.loadProfileActivityStats(...args),
    loadPostsByAuthor: (...args: unknown[]) => mocks.loadPostsByAuthor(...args),
    isFollowingCommunityUser: (...args: unknown[]) => mocks.isFollowingCommunityUser(...args),
    loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
    loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
    loadMyRatings: (...args: unknown[]) => mocks.loadMyRatings(...args),
  };
});

vi.mock("@/lib/community-moderation", () => ({
  loadBlockedUserIds: (...args: unknown[]) => mocks.loadBlockedUserIds(...args),
  blockCommunityUser: (...args: unknown[]) => mocks.blockCommunityUser(...args),
  unblockCommunityUser: (...args: unknown[]) => mocks.unblockCommunityUser(...args),
  submitCommunityReport: (...args: unknown[]) => mocks.submitCommunityReport(...args),
}));

function buildPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "post-1",
    savedPromptId: "saved-1",
    authorId: "user-1",
    title: "Profile test post",
    enhancedPrompt: "Enhanced",
    description: "",
    useCase: "",
    category: "general",
    tags: [],
    targetModel: "",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Starter",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 0,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
    createdAt: 1_735_000_000_000,
    updatedAt: 1_735_000_000_000,
    ...overrides,
  };
}

function buildProfile(overrides: Partial<CommunityProfile> = {}): CommunityProfile {
  return {
    id: "user-1",
    displayName: "Alpha User",
    avatarUrl: null,
    ...overrides,
  };
}

function ProfileRouteHarness() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate("/profile/user-2")}>
        Go user 2
      </button>
      <Profile />
    </div>
  );
}

describe("Profile route transitions", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.loadProfilesByIds.mockReset();
    mocks.loadFollowStats.mockReset();
    mocks.loadProfileActivityStats.mockReset();
    mocks.loadPostsByAuthor.mockReset();
    mocks.isFollowingCommunityUser.mockReset();
    mocks.loadPostsByIds.mockReset();
    mocks.loadMyVotes.mockReset();
    mocks.loadMyRatings.mockReset();
    mocks.loadBlockedUserIds.mockReset();
    mocks.blockCommunityUser.mockReset();
    mocks.unblockCommunityUser.mockReset();
    mocks.submitCommunityReport.mockReset();

    mocks.user = { id: "viewer-1" };
    mocks.loadBlockedUserIds.mockResolvedValue([]);
    mocks.blockCommunityUser.mockResolvedValue(true);
    mocks.unblockCommunityUser.mockResolvedValue(true);
    mocks.submitCommunityReport.mockResolvedValue("report-1");
  });

  it("clears stale profile content while loading the next profile", async () => {
    const neverResolve = new Promise<CommunityProfile[]>(() => undefined);

    mocks.loadProfilesByIds.mockImplementation((ids: string[]) => {
      if (ids[0] === "user-1") {
        return Promise.resolve([buildProfile({ id: "user-1", displayName: "Alpha User" })]);
      }
      if (ids[0] === "user-2") {
        return neverResolve;
      }
      return Promise.resolve([]);
    });
    mocks.loadFollowStats.mockResolvedValue({ followersCount: 3, followingCount: 5 });
    mocks.loadProfileActivityStats.mockResolvedValue({
      totalPosts: 1,
      totalUpvotes: 0,
      totalVerified: 0,
      averageRating: 0,
    });
    mocks.loadPostsByAuthor.mockImplementation((authorId: string) =>
      Promise.resolve(authorId === "user-1" ? [buildPost()] : []));
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={["/profile/user-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfileRouteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Alpha User" });
    fireEvent.click(screen.getByRole("button", { name: "Go user 2" }));

    await waitFor(() => {
      expect(mocks.loadProfilesByIds).toHaveBeenCalledWith(["user-2"]);
    });

    expect(screen.queryByRole("heading", { name: "Alpha User" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("pins an epic or legendary post as the top prompt", async () => {
    const commonPost = buildPost({
      id: "post-common",
      title: "Common Prompt",
      upvoteCount: 1,
      ratingAverage: 0,
      ratingCount: 0,
    });
    const legendaryPost = buildPost({
      id: "post-legendary",
      title: "Legendary Prompt",
      upvoteCount: 10,
      ratingAverage: 4.9,
      ratingCount: 12,
      verifiedCount: 2,
    });

    mocks.loadProfilesByIds.mockResolvedValue([
      buildProfile({
        id: "user-1",
        displayName: "Alpha User",
        createdAt: new Date("2025-01-14T00:00:00.000Z").getTime(),
      }),
    ]);
    mocks.loadFollowStats.mockResolvedValue({ followersCount: 3, followingCount: 5 });
    mocks.loadProfileActivityStats.mockResolvedValue({
      totalPosts: 2,
      totalUpvotes: 11,
      totalVerified: 2,
      averageRating: 4.9,
    });
    mocks.loadPostsByAuthor.mockResolvedValue([commonPost, legendaryPost]);
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={["/profile/user-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfileRouteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Alpha User" });
    expect(screen.getByTestId("community-feed-featured-id")).toHaveTextContent("post-legendary");
    expect(screen.getByTestId("community-feed-selected-id")).toHaveTextContent("post-legendary");
    expect(screen.getByTestId("community-feed-featured-label")).toHaveTextContent("Top Prompt");
    expect(screen.getByTestId("community-feed-first-title")).toHaveTextContent("Legendary Prompt");
  });

  it("keeps the profile route available when ancillary profile stats fail", async () => {
    mocks.loadProfilesByIds.mockResolvedValue([
      buildProfile({
        id: "user-1",
        displayName: "Alpha User",
      }),
    ]);
    mocks.loadFollowStats.mockRejectedValue(new Error("follow stats unavailable"));
    mocks.loadProfileActivityStats.mockRejectedValue(new Error("activity stats unavailable"));
    mocks.loadPostsByAuthor.mockResolvedValue([buildPost()]);
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={["/profile/user-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfileRouteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Alpha User" });
    expect(screen.getByTestId("community-feed-count")).toHaveTextContent("1");
    expect(screen.queryByText("Couldn't load profile")).not.toBeInTheDocument();
  });

  it("passes moderation context into the profile feed for signed-in viewers", async () => {
    mocks.loadProfilesByIds.mockResolvedValue([
      buildProfile({
        id: "user-1",
        displayName: "Alpha User",
      }),
    ]);
    mocks.loadFollowStats.mockResolvedValue({ followersCount: 3, followingCount: 5 });
    mocks.loadProfileActivityStats.mockResolvedValue({
      totalPosts: 1,
      totalUpvotes: 0,
      totalVerified: 0,
      averageRating: 0,
    });
    mocks.loadPostsByAuthor.mockResolvedValue([buildPost()]);
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadBlockedUserIds.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/profile/user-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfileRouteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Alpha User" });
    expect(screen.getByTestId("community-feed-current-user")).toHaveTextContent("viewer-1");
    expect(screen.getByTestId("community-feed-block-ready")).toHaveTextContent("true");
    expect(screen.getByTestId("community-feed-report-enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("community-feed-block-enabled")).toHaveTextContent("true");
  });

  it("blocks direct profile visits for authors in the viewer's blocked list", async () => {
    mocks.loadProfilesByIds.mockResolvedValue([
      buildProfile({
        id: "user-1",
        displayName: "Alpha User",
      }),
    ]);
    mocks.loadFollowStats.mockResolvedValue({ followersCount: 3, followingCount: 5 });
    mocks.loadProfileActivityStats.mockResolvedValue({
      totalPosts: 1,
      totalUpvotes: 0,
      totalVerified: 0,
      averageRating: 0,
    });
    mocks.loadPostsByAuthor.mockResolvedValue([buildPost()]);
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadBlockedUserIds.mockResolvedValue(["user-1"]);

    render(
      <MemoryRouter initialEntries={["/profile/user-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfileRouteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("You blocked this user");
    expect(screen.getByRole("button", { name: "Unblock user" })).toBeInTheDocument();
    expect(screen.queryByTestId("community-feed-count")).toBeNull();
  });
});
