import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

const POST_ID = "11111111-1111-1111-1111-111111111111";

const mocks = vi.hoisted(() => ({
  user: {
    current: null as { id: string; is_anonymous?: boolean } | null,
  },
  toast: vi.fn(),
  loadFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  toggleVote: vi.fn(),
  loadPost: vi.fn(),
  loadRemixes: vi.fn(),
  remixToLibrary: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user.current }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/community", () => ({
  loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
  loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
  loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
  loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
  toggleVote: (...args: unknown[]) => mocks.toggleVote(...args),
  loadPost: (...args: unknown[]) => mocks.loadPost(...args),
  loadRemixes: (...args: unknown[]) => mocks.loadRemixes(...args),
  remixToLibrary: (...args: unknown[]) => mocks.remixToLibrary(...args),
}));

vi.mock("@/components/community/CommunityFeed", () => ({
  CommunityFeed: ({
    posts,
    errorMessage,
    canVote,
    voteStateByPost,
  }: {
    posts: Array<{ id: string; title: string }>;
    errorMessage?: string | null;
    canVote: boolean;
    voteStateByPost: Record<string, unknown>;
  }) => (
    <div data-testid="community-feed">
      <div data-testid="feed-error">{errorMessage ?? "ok"}</div>
      <div data-testid="feed-can-vote">{String(canVote)}</div>
      <div data-testid="feed-post-count">{String(posts.length)}</div>
      <div data-testid="feed-vote-state">{JSON.stringify(voteStateByPost)}</div>
      {posts.map((post) => (
        <span key={post.id}>{post.title}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/community/CommunityPostDetail", () => ({
  CommunityPostDetail: ({
    post,
    canVote,
    voteState,
  }: {
    post: { title: string };
    canVote: boolean;
    voteState?: Record<string, unknown>;
  }) => (
    <div data-testid="post-detail">
      <span>{post.title}</span>
      <div data-testid="detail-can-vote">{String(canVote)}</div>
      <div data-testid="detail-vote-state">{JSON.stringify(voteState ?? null)}</div>
    </div>
  ),
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

function createPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: POST_ID,
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Resilient Post",
    enhancedPrompt: "Enhanced prompt",
    description: "",
    useCase: "",
    category: "general",
    tags: [],
    targetModel: "gpt-4.1",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Starter prompt",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 2,
    verifiedCount: 1,
    remixCount: 0,
    commentCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createProfile(overrides: Partial<CommunityProfile> = {}): CommunityProfile {
  return {
    id: "author-1",
    displayName: "Community member",
    avatarUrl: null,
    ...overrides,
  };
}

describe("community hydration resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = null;

    const post = createPost({ title: "Resilient Post Title" });
    mocks.loadFeed.mockResolvedValue([post]);
    mocks.loadProfilesByIds.mockResolvedValue([createProfile({ id: post.authorId })]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});

    mocks.loadPost.mockResolvedValue(post);
    mocks.loadRemixes.mockResolvedValue([]);
    mocks.toggleVote.mockResolvedValue({ active: true, rowId: "vote-1" });
    mocks.remixToLibrary.mockResolvedValue({ title: "Remix copy" });
  });

  it("renders feed content when vote-state loading fails for signed-out users", async () => {
    mocks.loadMyVotes.mockRejectedValueOnce(new Error("Auth session missing"));
    const { default: Community } = await import("@/pages/Community");

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feed-post-count")).toHaveTextContent("1");
    });

    expect(screen.getByText("Resilient Post Title")).toBeInTheDocument();
    expect(screen.getByTestId("feed-error")).toHaveTextContent("ok");
    expect(screen.getByTestId("feed-can-vote")).toHaveTextContent("false");
    expect(screen.getByTestId("feed-vote-state")).toHaveTextContent("{}");
  });

  it("renders post detail when vote-state loading fails for signed-out users", async () => {
    mocks.loadMyVotes.mockRejectedValueOnce(new Error("Auth session missing"));
    const { default: CommunityPost } = await import("@/pages/CommunityPost");

    render(
      <MemoryRouter initialEntries={[`/community/${POST_ID}`]}>
        <Routes>
          <Route path="/community/:postId" element={<CommunityPost />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("post-detail")).toBeInTheDocument();
    });

    expect(screen.getByText("Resilient Post Title")).toBeInTheDocument();
    expect(screen.getByTestId("detail-can-vote")).toHaveTextContent("false");
    expect(screen.getByTestId("detail-vote-state")).toHaveTextContent(
      '{"upvote":false,"verified":false}',
    );
    expect(screen.queryByText("Failed to load this post right now. Please try again.")).toBeNull();
  });
});
