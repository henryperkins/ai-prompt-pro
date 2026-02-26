import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CommunityPost } from "@/lib/community";
import { defaultConfig } from "@/lib/prompt-builder";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

function makePost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Card title",
    enhancedPrompt: "Enhanced prompt",
    description: "",
    useCase: "",
    category: "general",
    tags: ["tag"],
    targetModel: "gpt-5-mini",
    isPublic: true,
    publicConfig: defaultConfig,
    starterPrompt: "Starter prompt",
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

describe("CommunityPostCard action controls", () => {
  it("wires follow/save/share callbacks with expected payloads", () => {
    const post = makePost();
    const onSharePost = vi.fn();
    const onSaveToLibrary = vi.fn();
    const onToggleFollow = vi.fn();

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onSharePost={onSharePost}
          onSaveToLibrary={onSaveToLibrary}
          followingUserIds={new Set([post.authorId])}
          currentUserId="viewer-1"
          onToggleFollow={onToggleFollow}
          canVote={false}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    expect(onToggleFollow).toHaveBeenCalledWith(post.authorId, true);

    fireEvent.click(screen.getByTestId("community-save-cta"));
    expect(onSaveToLibrary).toHaveBeenCalledWith(post.id);

    fireEvent.click(screen.getByTestId("community-share"));
    expect(onSharePost).toHaveBeenCalledWith(post);
  });

  it("supports tag click filtering callbacks", () => {
    const post = makePost({ tags: ["ops"] });
    const onTagClick = vi.fn();

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onTagClick={onTagClick}
          canVote={false}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag ops" }));
    expect(onTagClick).toHaveBeenCalledWith("ops");
  });

  it("applies selected-state semantics and de-emphasizes secondary actions", () => {
    const post = makePost();

    const { unmount } = render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onSharePost={vi.fn()}
          onSaveToLibrary={vi.fn()}
          currentUserId="viewer-1"
          canVote={false}
          isSelected
        />
      </MemoryRouter>,
    );

    const selectedCard = screen.getByRole("article");
    expect(selectedCard).toHaveAttribute("data-state", "selected");
    expect(selectedCard).toHaveAttribute("data-selected", "true");

    unmount();

    render(
      <MemoryRouter>
        <CommunityPostCard
          post={post}
          authorName="Prompt Dev"
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          onCommentAdded={vi.fn()}
          onSharePost={vi.fn()}
          onSaveToLibrary={vi.fn()}
          currentUserId="viewer-1"
          canVote={false}
          isDeemphasized
        />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("community-save-cta")).toBeNull();
    expect(screen.queryByTestId("community-share")).toBeNull();
    expect(screen.getByTestId("community-remix-cta")).toBeInTheDocument();
  });
});
