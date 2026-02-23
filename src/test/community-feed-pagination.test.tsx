import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CommunityPost, VoteState } from "@/lib/community";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { defaultConfig } from "@/lib/prompt-builder";

vi.mock("@/components/community/CommunityPostCard", () => ({
  CommunityPostCard: ({ post }: { post: { title: string } }) => <article>{post.title}</article>,
}));

function makePost(): CommunityPost {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    savedPromptId: "saved-1",
    authorId: "author-1",
    title: "Post",
    starterPrompt: "Starter",
    enhancedPrompt: "Enhanced",
    category: "general",
    tags: [],
    targetModel: "gpt-5-mini",
    useCase: "",
    description: "",
    publicConfig: defaultConfig,
    isPublic: true,
    upvoteCount: 0,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
    remixedFrom: null,
    remixNote: "",
    remixDiff: null,
    ratingCount: 0,
    ratingAverage: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("CommunityFeed pagination controls", () => {
  it("keeps a manual load-more fallback when pagination is available", () => {
    const onLoadMore = vi.fn();

    render(
      <MemoryRouter>
        <CommunityFeed
          posts={[makePost()]}
          loading={false}
          authorById={{}}
          parentTitleById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          voteStateByPost={{} as Record<string, VoteState>}
          onCommentAdded={vi.fn()}
          canVote={false}
          hasMore
          onLoadMore={onLoadMore}
        />
      </MemoryRouter>,
    );

    const loadMore = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(loadMore);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("disables the manual fallback while loading", () => {
    render(
      <MemoryRouter>
        <CommunityFeed
          posts={[makePost()]}
          loading={false}
          authorById={{}}
          parentTitleById={{}}
          onCopyPrompt={vi.fn()}
          onToggleVote={vi.fn()}
          voteStateByPost={{} as Record<string, VoteState>}
          onCommentAdded={vi.fn()}
          canVote={false}
          hasMore
          isLoadingMore
          onLoadMore={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });
});
