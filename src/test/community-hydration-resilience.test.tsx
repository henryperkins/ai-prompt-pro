import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    errorType,
    onRetry,
    canVote,
    voteStateByPost,
    onToggleVote,
    onCopyPrompt,
  }: {
    posts: Array<{
      id: string;
      title: string;
      upvoteCount: number;
      enhancedPrompt: string;
      starterPrompt: string;
    }>;
    errorMessage?: string | null;
    errorType?: string;
    onRetry?: () => void;
    canVote: boolean;
    voteStateByPost: Record<string, unknown>;
    onToggleVote: (postId: string, voteType: "upvote" | "verified") => void;
    onCopyPrompt: (post: { enhancedPrompt: string; starterPrompt: string }) => void;
  }) => (
    <div data-testid="community-feed">
      <div data-testid="feed-error">{errorMessage ?? "ok"}</div>
      <div data-testid="feed-error-type">{errorType ?? "none"}</div>
      <div data-testid="feed-can-vote">{String(canVote)}</div>
      <div data-testid="feed-post-count">{String(posts.length)}</div>
      <div data-testid="feed-vote-state">{JSON.stringify(voteStateByPost)}</div>
      {errorMessage && onRetry && (
        <button type="button" onClick={onRetry}>
          feed retry
        </button>
      )}
      {posts[0] && <div data-testid="feed-first-upvotes">{String(posts[0].upvoteCount)}</div>}
      {posts[0] && (
        <button
          type="button"
          onClick={() => onToggleVote(posts[0].id, "upvote")}
          disabled={!canVote}
        >
          feed upvote
        </button>
      )}
      {posts[0] && (
        <button type="button" onClick={() => onCopyPrompt(posts[0])}>
          feed copy
        </button>
      )}
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
    onToggleVote,
    onCopyPrompt,
  }: {
    post: { id: string; title: string; upvoteCount: number; enhancedPrompt: string; starterPrompt: string };
    canVote: boolean;
    voteState?: Record<string, unknown>;
    onToggleVote: (postId: string, voteType: "upvote" | "verified") => void;
    onCopyPrompt: (post: { enhancedPrompt: string; starterPrompt: string }) => void;
  }) => (
    <div data-testid="post-detail">
      <span>{post.title}</span>
      <div data-testid="detail-can-vote">{String(canVote)}</div>
      <div data-testid="detail-vote-state">{JSON.stringify(voteState ?? null)}</div>
      <div data-testid="detail-upvotes">{String(post.upvoteCount)}</div>
      <button
        type="button"
        onClick={() => onToggleVote(post.id, "upvote")}
        disabled={!canVote}
      >
        detail upvote
      </button>
      <button type="button" onClick={() => onCopyPrompt(post)}>
        detail copy
      </button>
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it("renders feed content when profile hydration fails", async () => {
    mocks.loadProfilesByIds.mockRejectedValueOnce(new Error("community_profiles_by_ids unavailable"));
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
  });

  it("retries community feed loading from the error state", async () => {
    const post = createPost({ title: "Retryable feed post" });
    mocks.loadFeed
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce([post]);

    const { default: Community } = await import("@/pages/Community");

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feed-error")).toHaveTextContent("Failed to fetch");
    });
    expect(screen.getByTestId("feed-error-type")).toHaveTextContent("network");

    fireEvent.click(screen.getByRole("button", { name: "feed retry" }));

    await waitFor(() => {
      expect(screen.getByText("Retryable feed post")).toBeInTheDocument();
    });
    expect(mocks.loadFeed).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("feed-error")).toHaveTextContent("ok");
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

  it("renders post detail when profile hydration fails", async () => {
    mocks.loadProfilesByIds.mockRejectedValueOnce(new Error("community_profiles_by_ids unavailable"));
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
    expect(screen.queryByText("Failed to load this post right now. Please try again.")).toBeNull();
  });

  it("renders post detail when remix context loading fails", async () => {
    mocks.loadRemixes.mockRejectedValueOnce(new Error("community remixes unavailable"));
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
    expect(screen.queryByText("Failed to load this post right now. Please try again.")).toBeNull();
  });

  it("retries community post loading from the error state", async () => {
    mocks.loadPost
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(createPost({ title: "Retryable post detail" }));
    const { default: CommunityPost } = await import("@/pages/CommunityPost");

    render(
      <MemoryRouter initialEntries={[`/community/${POST_ID}`]}>
        <Routes>
          <Route path="/community/:postId" element={<CommunityPost />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByTestId("post-detail")).toBeInTheDocument();
    });
    expect(mocks.loadPost).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Retryable post detail")).toBeInTheDocument();
  });

  it("guards feed vote toggles while a request is in flight", async () => {
    mocks.user.current = { id: "user-1" };
    const deferredVote = createDeferred<{ active: boolean; rowId: string }>();
    mocks.toggleVote.mockReturnValueOnce(deferredVote.promise);
    const { default: Community } = await import("@/pages/Community");

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feed-post-count")).toHaveTextContent("1");
    });

    const voteButton = screen.getByRole("button", { name: "feed upvote" });
    fireEvent.click(voteButton);
    fireEvent.click(voteButton);

    expect(mocks.toggleVote).toHaveBeenCalledTimes(1);

    deferredVote.resolve({ active: true, rowId: "vote-1" });
    await waitFor(() => {
      expect(screen.getByTestId("feed-first-upvotes")).toHaveTextContent("3");
    });
  });

  it("shows copied toast when feed copy is triggered", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { default: Community } = await import("@/pages/Community");

    render(
      <MemoryRouter>
        <Community />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feed-post-count")).toHaveTextContent("1");
    });

    fireEvent.click(screen.getByRole("button", { name: "feed copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Enhanced prompt");
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Prompt copied",
      description: "Prompt text copied to your clipboard.",
    });
  });

  it("guards post-detail vote toggles while a request is in flight", async () => {
    mocks.user.current = { id: "user-1" };
    const deferredVote = createDeferred<{ active: boolean; rowId: string }>();
    mocks.toggleVote.mockReturnValueOnce(deferredVote.promise);
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

    const voteButton = screen.getByRole("button", { name: "detail upvote" });
    fireEvent.click(voteButton);
    fireEvent.click(voteButton);

    expect(mocks.toggleVote).toHaveBeenCalledTimes(1);

    deferredVote.resolve({ active: true, rowId: "vote-1" });
    await waitFor(() => {
      expect(screen.getByTestId("detail-upvotes")).toHaveTextContent("3");
    });
  });

  it("shows copied toast when post detail copy is triggered", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

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

    fireEvent.click(screen.getByRole("button", { name: "detail copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Enhanced prompt");
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Prompt copied",
      description: "Prompt text copied to your clipboard.",
    });
  });
});
