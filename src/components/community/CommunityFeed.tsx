import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { Link } from "react-router-dom";

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
  canVote,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: CommunityFeedProps) {
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
      <Card className="space-y-3 border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{errorMessage}</p>
        <Button asChild size="sm" className="h-8 w-fit text-xs">
          <Link to="/">Go to Builder</Link>
        </Button>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">
          No posts match this filter yet. Try another category or share your first prompt.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8 text-xs">
            <Link to="/">Share your first prompt</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to="/library">Open Library</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="community-feed-grid grid grid-cols-1 gap-3 lg:grid-cols-2">
      {posts.map((post, index) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";
        const isFeatured = index === 0;

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
            canVote={canVote}
          />
        );
      })}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-1 lg:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="h-8 text-xs"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
