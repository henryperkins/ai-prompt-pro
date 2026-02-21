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
  CommunityFeed: ({ posts }: { posts: CommunityPost[] }) => <div data-testid="community-feed-count">{posts.length}</div>,
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadFollowStats: (...args: unknown[]) => mocks.loadFollowStats(...args),
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
    expect(screen.getByText("Loading profile")).toBeInTheDocument();
  });
});
