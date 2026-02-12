import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { CommunityPostDetail } from "@/components/community/CommunityPostDetail";
import type { CommunityPost } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";

vi.mock("@/components/community/CommunityComments", () => ({
  CommunityComments: () => <div data-testid="community-comments" />,
}));

function buildPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "post-1",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Starter-only post",
    enhancedPrompt: "",
    description: "",
    useCase: "",
    category: "general",
    tags: [],
    targetModel: "",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Starter-only prompt body",
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    upvoteCount: 1,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
    createdAt: 1_735_000_000_000,
    updatedAt: 1_735_000_000_000,
    ...overrides,
  };
}

describe("community prompt preview fallback", () => {
  it("renders starter prompt text in feed cards when enhanced prompt is empty", () => {
    const post = buildPost();

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          canVote
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Starter-only prompt body")).toBeInTheDocument();
    expect(screen.queryByText("No prompt content available yet.")).toBeNull();
  });

  it("opens the post detail when clicking a non-interactive part of the card", () => {
    const post = buildPost();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <CommunityPostCard
                post={post}
                authorName="Prompt Dev"
                onCopyPrompt={vi.fn()}
                onToggleVote={vi.fn()}
                onCommentAdded={vi.fn()}
                canVote
              />
            }
          />
          <Route path="/community/:postId" element={<div>Post detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("heading", { name: "Starter-only post" }));

    expect(screen.getByText("Post detail route")).toBeInTheDocument();
  });

  it("does not open post detail when using card action controls", () => {
    const post = buildPost();
    const onCopyPrompt = vi.fn();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <CommunityPostCard
                post={post}
                authorName="Prompt Dev"
                onCopyPrompt={onCopyPrompt}
                onToggleVote={vi.fn()}
                onCommentAdded={vi.fn()}
                canVote
              />
            }
          />
          <Route path="/community/:postId" element={<div>Post detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(onCopyPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Post detail route")).toBeNull();
  });

  it("shows a comment badge on the comments button when comments exist", () => {
    const post = buildPost({ commentCount: 3 });

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          canVote
        />
      </MemoryRouter>,
    );

    const commentsButton = screen.getByRole("button", { name: "Comments 3" });
    expect(within(commentsButton).getByText("3")).toBeInTheDocument();
  });

  it("hides the comment badge when there are no comments", () => {
    const post = buildPost({ commentCount: 0 });

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          canVote
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Comments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comments 0" })).toBeNull();
  });

  it("renders starter prompt text in post detail when enhanced prompt is empty", () => {
    const post = buildPost();

    render(
      <MemoryRouter>
        <CommunityPostDetail
          post={post}
          authorName="Prompt Dev"
          parentPost={null}
          remixes={[]}
          authorById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          canVote
          canSaveToLibrary
          onSaveToLibrary={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Starter-only prompt body")).toBeInTheDocument();
    expect(screen.queryByText("No prompt content available yet.")).toBeNull();
  });
});
