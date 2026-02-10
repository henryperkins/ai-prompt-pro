import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";

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
}

function LoadingCard() {
  return (
    <Card className="p-4 space-y-3">
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
}: CommunityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {errorMessage}
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No posts match this filter yet. Try another category or search term.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";

        return (
          <CommunityPostCard
            key={post.id}
            post={post}
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
    </div>
  );
}
