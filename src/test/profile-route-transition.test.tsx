import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  }: {
    posts: CommunityPost[];
    featuredPostId?: string | null;
    selectedPostId?: string | null;
    featuredPostBadgeLabel?: string;
  }) => (
    <div>
      <div data-testid="community-feed-count">{posts.length}</div>
      <div data-testid="community-feed-featured-id">{featuredPostId ?? "none"}</div>
      <div data-testid="community-feed-selected-id">{selectedPostId ?? "none"}</div>
      <div data-testid="community-feed-featured-label">{featuredPostBadgeLabel ?? "none"}</div>
      <div data-testid="community-feed-first-title">{posts[0]?.title ?? "none"}</div>
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
});
