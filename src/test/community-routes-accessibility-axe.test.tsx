import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  toast: vi.fn(),
  trackInteraction: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadFollowStats: vi.fn(),
  loadProfileActivityStats: vi.fn(),
  loadPostsByAuthor: vi.fn(),
  isFollowingCommunityUser: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
  loadPost: vi.fn(),
  loadRemixes: vi.fn(),
  loadComments: vi.fn(),
  addComment: vi.fn(),
  remixToLibrary: vi.fn(),
  toggleVote: vi.fn(),
  setPromptRating: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useCommunityMobileTelemetry", () => ({
  useCommunityMobileTelemetry: () => ({
    trackInteraction: mocks.trackInteraction,
  }),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="page-shell">
      <main>{children}</main>
    </div>
  ),
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

vi.mock("@/lib/community", () => ({
  computeNextPromptRatingSummary: () => ({ ratingCount: 1, ratingAverage: 4.8 }),
  followCommunityUser: vi.fn(),
  unfollowCommunityUser: vi.fn(),
  loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
  loadFollowStats: (...args: unknown[]) => mocks.loadFollowStats(...args),
  loadProfileActivityStats: (...args: unknown[]) => mocks.loadProfileActivityStats(...args),
  loadPostsByAuthor: (...args: unknown[]) => mocks.loadPostsByAuthor(...args),
  isFollowingCommunityUser: (...args: unknown[]) => mocks.isFollowingCommunityUser(...args),
  loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
  loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
  loadMyRatings: (...args: unknown[]) => mocks.loadMyRatings(...args),
  setPromptRating: (...args: unknown[]) => mocks.setPromptRating(...args),
  toggleVote: (...args: unknown[]) => mocks.toggleVote(...args),
  loadPost: (...args: unknown[]) => mocks.loadPost(...args),
  loadRemixes: (...args: unknown[]) => mocks.loadRemixes(...args),
  loadComments: (...args: unknown[]) => mocks.loadComments(...args),
  addComment: (...args: unknown[]) => mocks.addComment(...args),
  remixToLibrary: (...args: unknown[]) => mocks.remixToLibrary(...args),
}));

vi.mock("@/lib/community-moderation", () => ({
  loadBlockedUserIds: vi.fn(async () => []),
  submitCommunityReport: vi.fn(async () => undefined),
  blockCommunityUser: vi.fn(async () => undefined),
  unblockCommunityUser: vi.fn(async () => undefined),
}));

function buildPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Launch Readiness Forge",
    enhancedPrompt: "Turn a rollout brief into a sequence of guardrailed execution steps.",
    description: "A structured launch planning prompt.",
    useCase: "Launch planning",
    category: "general",
    tags: ["launch", "ops"],
    targetModel: "gpt-5-mini",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Help me plan this launch.",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 12,
    verifiedCount: 4,
    remixCount: 2,
    commentCount: 3,
    ratingCount: 8,
    ratingAverage: 4.8,
    createdAt: new Date("2026-01-20T12:00:00.000Z").getTime(),
    updatedAt: new Date("2026-01-20T12:00:00.000Z").getTime(),
    ...overrides,
  };
}

function buildProfile(overrides: Partial<CommunityProfile> = {}): CommunityProfile {
  return {
    id: "author-1",
    displayName: "Alex Backend",
    avatarUrl: null,
    createdAt: new Date("2025-01-14T00:00:00.000Z").getTime(),
    ...overrides,
  };
}

async function renderProfileRoute() {
  vi.resetModules();
  const { default: Profile } = await import("@/pages/Profile");

  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/profile/author-1"]}>
        <Routes>
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );
  });

  await screen.findByRole("heading", { name: "Alex Backend" });
  await screen.findByTestId("profile-follow-button");
  await screen.findByTestId("community-remix-cta");
  await waitFor(() => {
    expect(mocks.loadProfilesByIds).toHaveBeenCalledWith(["author-1"]);
    expect(mocks.loadPostsByAuthor).toHaveBeenCalled();
  });
}

async function renderCommunityPostRoute() {
  vi.resetModules();
  const { default: CommunityPost } = await import("@/pages/CommunityPost");
  const postId = "11111111-1111-1111-1111-111111111111";

  await act(async () => {
    render(
      <MemoryRouter initialEntries={[`/community/${postId}`]}>
        <Routes>
          <Route path="/community/:postId" element={<CommunityPost />} />
        </Routes>
      </MemoryRouter>,
    );
  });

  await screen.findByRole("heading", { name: "Launch Readiness Forge" });
  await screen.findByTestId("community-detail-rating-summary");
  await screen.findByLabelText("Write a comment");
  await waitFor(() => {
    expect(mocks.loadPost).toHaveBeenCalledWith(postId);
    expect(mocks.loadProfilesByIds).toHaveBeenCalled();
  });
}

describe("dynamic community route accessibility audits", () => {
  it("has no axe violations on the profile route", async () => {
    vi.clearAllMocks();
    mocks.user = { id: "viewer-1" };
    mocks.loadProfilesByIds.mockImplementation(async (ids: string[]) => {
      return ids.includes("author-1") ? [buildProfile()] : [];
    });
    mocks.loadFollowStats.mockResolvedValue({ followersCount: 28, followingCount: 12 });
    mocks.loadProfileActivityStats.mockResolvedValue({
      totalPosts: 3,
      totalUpvotes: 42,
      totalVerified: 6,
      averageRating: 4.8,
    });
    mocks.loadPostsByAuthor.mockResolvedValue([buildPost()]);
    mocks.isFollowingCommunityUser.mockResolvedValue(false);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadComments.mockResolvedValue([]);
    mocks.addComment.mockResolvedValue(null);

    await renderProfileRoute();

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations on the community post route", async () => {
    vi.clearAllMocks();
    mocks.user = { id: "viewer-1" };
    const post = buildPost();
    mocks.loadPost.mockImplementation(async (postId: string) => (postId === post.id ? post : null));
    mocks.loadRemixes.mockResolvedValue([]);
    mocks.loadProfilesByIds.mockImplementation(async (ids: string[]) => {
      return ids.includes("author-1") ? [buildProfile()] : [];
    });
    mocks.loadMyVotes.mockResolvedValue({ [post.id]: { upvote: false, verified: false } });
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadComments.mockResolvedValue([]);
    mocks.addComment.mockResolvedValue(null);
    mocks.remixToLibrary.mockResolvedValue({ title: post.title });

    await renderCommunityPostRoute();

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
