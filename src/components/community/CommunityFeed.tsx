import { useMemo } from "react";
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { StateCard } from "@/components/ui/state-card";
import { useIsMobile } from "@/hooks/use-mobile";

interface CommunityFeedProps {
  posts: CommunityPost[];
  loading: boolean;
  errorMessage?: string | null;
  authorById: Record<string, CommunityProfile>;
  parentTitleById: Record<string, string>;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteStateByPost: Record<string, VoteState>;
  onCommentAdded: (postId: string) => void;
  onCommentThreadOpen?: (postId: string) => void;
  canVote: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function LoadingCard() {
  return (
    <Card className="p-4 space-y-3 border-border/80 bg-card/85">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-28 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
      </div>
    </Card>
  );
}

export function CommunityFeed({
  posts,
  loading,
  errorMessage,
  authorById,
  parentTitleById,
  onCopyPrompt,
  onToggleVote,
  voteStateByPost,
  onCommentAdded,
  onCommentThreadOpen,
  canVote,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: CommunityFeedProps) {
  const isMobile = useIsMobile();
  const renderedPosts = useMemo(
    () =>
      posts.map((post, index) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";
        const isFeatured = !isMobile && index === 0;

        return (
          <CommunityPostCard
            key={post.id}
            post={post}
            isFeatured={isFeatured}
            animationDelayMs={Math.min(index, 8) * 40}
            authorName={authorName}
            authorAvatarUrl={author?.avatarUrl}
            parentPostTitle={post.remixedFrom ? parentTitleById[post.remixedFrom] : undefined}
            onCopyPrompt={onCopyPrompt}
            onToggleVote={onToggleVote}
            voteState={voteStateByPost[post.id]}
            onCommentAdded={onCommentAdded}
            onCommentThreadOpen={onCommentThreadOpen}
            canVote={canVote}
          />
        );
      }),
    [
      posts,
      authorById,
      parentTitleById,
      onCopyPrompt,
      onToggleVote,
      voteStateByPost,
      onCommentAdded,
      onCommentThreadOpen,
      canVote,
      isMobile,
    ],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <StateCard
        variant="error"
        title="Couldn’t load community feed"
        description={errorMessage}
        primaryAction={{ label: "Go to Builder", to: "/" }}
        secondaryAction={{ label: "Open Library", to: "/library" }}
      />
    );
  }

  if (posts.length === 0) {
    return (
      <StateCard
        variant="empty"
        title="No posts match this filter"
        description="Try another category or share your first prompt."
        primaryAction={{ label: "Share your first prompt", to: "/" }}
        secondaryAction={{ label: "Open Library", to: "/library" }}
      />
    );
  }

  return (
    <div className="community-feed-grid grid grid-cols-1 gap-3 lg:grid-cols-2">
      {renderedPosts}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-1 lg:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="type-button-label h-11 px-4 sm:h-8 sm:px-3"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
