import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

const memoryRouterFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

const mocks = vi.hoisted(() => ({
  isMobile: true,
  user: null as { id: string } | null,
  toast: vi.fn(),
  loadFeed: vi.fn(),
  loadProfilesByIds: vi.fn(),
  loadPostsByIds: vi.fn(),
  loadMyVotes: vi.fn(),
  loadMyRatings: vi.fn(),
  loadFollowingUserIds: vi.fn(),
  loadBlockedUserIds: vi.fn(),
  toggleVote: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
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

vi.mock("@/hooks/useNewPostsIndicator", () => ({
  useNewPostsIndicator: () => ({
    newCount: 0,
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/community", async () => {
  const actual = await vi.importActual<typeof import("@/lib/community")>("@/lib/community");
  return {
    ...actual,
    loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
    loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
    loadPostsByIds: (...args: unknown[]) => mocks.loadPostsByIds(...args),
    loadMyVotes: (...args: unknown[]) => mocks.loadMyVotes(...args),
    loadMyRatings: (...args: unknown[]) => mocks.loadMyRatings(...args),
    loadFollowingUserIds: (...args: unknown[]) => mocks.loadFollowingUserIds(...args),
    toggleVote: (...args: unknown[]) => mocks.toggleVote(...args),
  };
});

vi.mock("@/lib/community-moderation", () => ({
  blockCommunityUser: vi.fn().mockResolvedValue(undefined),
  loadBlockedUserIds: (...args: unknown[]) => mocks.loadBlockedUserIds(...args),
  submitCommunityReport: vi.fn().mockResolvedValue(undefined),
  unblockCommunityUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/community/CommunityComments", () => ({
  CommunityComments: ({ postId }: { postId: string }) => (
    <div data-testid={`community-comments-${postId}`}>Comments for {postId}</div>
  ),
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

function createPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Mobile test post",
    enhancedPrompt: "Enhanced prompt",
    description: "",
    useCase: "",
    category: "general",
    tags: ["mobile"],
    targetModel: "gpt-5-mini",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Starter prompt",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 2,
    verifiedCount: 1,
    remixCount: 1,
    commentCount: 2,
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

async function renderCommunityPage() {
  vi.resetModules();
  const { default: Community } = await import("@/pages/Community");
  await act(async () => {
    render(
      <MemoryRouter future={memoryRouterFuture}>
        <Community />
      </MemoryRouter>,
    );
  });
  await waitFor(() => {
    expect(mocks.loadFeed).toHaveBeenCalled();
    expect(mocks.loadProfilesByIds).toHaveBeenCalled();
    expect(mocks.loadPostsByIds).toHaveBeenCalled();
    expect(mocks.loadMyVotes).toHaveBeenCalled();
  });
}

async function importCardAndDetail() {
  vi.resetModules();
  const [{ CommunityPostCard }, { CommunityPostDetail }] = await Promise.all([
    import("@/components/community/CommunityPostCard"),
    import("@/components/community/CommunityPostDetail"),
  ]);

  return { CommunityPostCard, CommunityPostDetail };
}

describe("community mobile UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobile = true;
    mocks.user = null;

    const post = createPost();
    mocks.loadFeed.mockResolvedValue([post]);
    mocks.loadProfilesByIds.mockResolvedValue([createProfile({ id: post.authorId })]);
    mocks.loadPostsByIds.mockResolvedValue([]);
    mocks.loadMyVotes.mockResolvedValue({});
    mocks.loadMyRatings.mockResolvedValue({});
    mocks.loadFollowingUserIds.mockResolvedValue([]);
    mocks.loadBlockedUserIds.mockResolvedValue([]);
    mocks.toggleVote.mockResolvedValue({ active: true, rowId: "vote-1" });
  });

  it("supports mobile filter drawer open/select semantics in Community", async () => {
    await renderCommunityPage();
    await screen.findByText("Mobile test post");

    const trigger = await screen.findByTestId("community-filter-trigger");
    fireEvent.click(trigger);

    const sheet = await screen.findByTestId("community-filter-sheet");
    expect(sheet).toBeVisible();
    expect(
      screen.getByText("Choose a category and sort order for the visible prompts."),
    ).toBeInTheDocument();
    expect(
      within(sheet).getAllByTestId("community-filter-sort-option").length,
    ).toBeGreaterThan(0);

    fireEvent.click(within(sheet).getByRole("button", { name: /^Backend/ }));

    await waitFor(() => {
      expect(screen.getByTestId("community-filter-sheet")).toHaveAttribute("data-state", "closed");
    });
    expect(trigger).toHaveTextContent("Backend · Newest");

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "backend",
          page: 0,
        }),
      );
    });
  }, 15_000);

  it("uses pressed-state semantics for category suggestions on desktop", async () => {
    mocks.isMobile = false;
    await renderCommunityPage();
    await screen.findByText("Mobile test post");

    const searchInput = await screen.findByPlaceholderText("Search by title, use case, or context keyword");
    fireEvent.focus(searchInput);

    const backendOption = await screen.findByRole("button", { name: /^Backend/ });
    expect(backendOption).toHaveAttribute("aria-pressed", "false");
  });

  it("opens comments drawer from CommunityPostCard on mobile", async () => {
    const { CommunityPostCard } = await importCardAndDetail();
    const post = createPost({ id: "card-post-1" });

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onCommentThreadOpen={vi.fn()}
          canVote
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("community-comment-toggle"));

    const commentsSheet = await screen.findByTestId("community-comments-sheet");
    expect(commentsSheet).toBeVisible();
    expect(screen.getByText("Read and add comments for this prompt.")).toBeInTheDocument();
    expect(screen.getByTestId("community-comments-card-post-1")).toBeInTheDocument();
  });

  it("keeps mobile feed cards remix-first and hides low-value token metadata", async () => {
    const { CommunityPostCard } = await importCardAndDetail();
    const post = createPost({ id: "card-post-density" });

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onSharePost={vi.fn()}
          onSaveToLibrary={vi.fn()}
          canVote
        />
      </MemoryRouter>,
    );

    const primaryActions = screen.getByTestId("community-card-primary-actions");
    const engagementRow = screen.getByTestId("community-card-engagement-row");

    expect(
      Boolean(primaryActions.compareDocumentPosition(engagementRow) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(within(primaryActions).getByTestId("community-remix-cta")).toBeVisible();
    expect(screen.queryByTitle("Estimated token count (~1.35x word count)")).not.toBeInTheDocument();
  });

  it("opens comments drawer from CommunityPostDetail on mobile", async () => {
    const { CommunityPostDetail } = await importCardAndDetail();
    const post = createPost({ id: "detail-post-1" });

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostDetail
          post={post}
          authorName="Prompt Dev"
          parentPost={null}
          remixes={[]}
          authorById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onCommentThreadOpen={vi.fn()}
          canVote
          canSaveToLibrary
          onSaveToLibrary={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("community-comments-thread-trigger"));

    const commentsSheet = await screen.findByTestId("community-comments-sheet");
    expect(commentsSheet).toBeVisible();
    expect(screen.getByText("Read and add comments for this prompt.")).toBeInTheDocument();
    expect(screen.getByTestId("community-comments-detail-post-1")).toBeInTheDocument();
  });

  it("groups detail action buttons into responsive mobile action rows", async () => {
    const { CommunityPostDetail } = await importCardAndDetail();
    const post = createPost({ id: "detail-post-actions" });

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostDetail
          post={post}
          authorName="Prompt Dev"
          parentPost={null}
          remixes={[]}
          authorById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onCommentThreadOpen={vi.fn()}
          canVote
          canSaveToLibrary
          onSaveToLibrary={vi.fn()}
          canModerate
          onReportPost={vi.fn()}
          onBlockUser={vi.fn()}
          onUnblockUser={vi.fn()}
        />
      </MemoryRouter>,
    );

    const actionGroup = screen.getByTestId("community-detail-primary-actions");
    expect(actionGroup).toHaveClass("grid", "grid-cols-1");
    expect(actionGroup.className).toContain("min-[420px]:grid-cols-2");

    expect(within(actionGroup).getByTestId("community-detail-remix-cta")).toBeVisible();
    expect(within(actionGroup).getByTestId("community-detail-save-cta")).toBeVisible();
    expect(within(actionGroup).queryByTestId("community-detail-moderation-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("community-detail-moderation-trigger")).toBeVisible();
  });

  it("keeps mobile detail participation actions ahead of secondary stats", async () => {
    const { CommunityPostDetail } = await importCardAndDetail();
    const post = createPost({ id: "detail-post-participation" });

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostDetail
          post={post}
          authorName="Prompt Dev"
          parentPost={null}
          remixes={[]}
          authorById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onCommentThreadOpen={vi.fn()}
          canVote
          canSaveToLibrary
          onSaveToLibrary={vi.fn()}
        />
      </MemoryRouter>,
    );

    const participationActions = screen.getByTestId("community-detail-participation-actions");
    const participationStats = screen.getByTestId("community-detail-participation-stats");

    expect(
      Boolean(participationActions.compareDocumentPosition(participationStats) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      within(participationActions).getByTestId("community-comments-thread-trigger"),
    ).toBeVisible();
    expect(
      within(participationStats).getByTestId("community-detail-rating-summary"),
    ).toBeVisible();
  });

  it("auto-opens comments drawer on notification entry for CommunityPostDetail", async () => {
    const { CommunityPostDetail } = await importCardAndDetail();
    const post = createPost({ id: "detail-post-notification" });
    const onCommentThreadOpen = vi.fn();

    render(
      <MemoryRouter future={memoryRouterFuture}>
        <CommunityPostDetail
          post={post}
          authorName="Prompt Dev"
          parentPost={null}
          remixes={[]}
          authorById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onCommentThreadOpen={onCommentThreadOpen}
          openCommentsOnMount
          canVote
          canSaveToLibrary
          onSaveToLibrary={vi.fn()}
        />
      </MemoryRouter>,
    );

    const commentsSheet = await screen.findByTestId("community-comments-sheet");
    expect(commentsSheet).toBeVisible();
    expect(onCommentThreadOpen).toHaveBeenCalledWith("detail-post-notification");
    expect(screen.getByTestId("community-comments-detail-post-notification")).toBeInTheDocument();
  });
});
