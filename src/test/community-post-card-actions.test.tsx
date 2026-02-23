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
});
